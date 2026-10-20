import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import ClientForm, { clientToForm } from '../components/ClientForm';
import { JourneyRail } from '../components/ProjectJourney';
import { useAuth } from '../hooks/useAuth';
import { useQuestionnaireAlerts } from '../hooks/useQuestionnaireAlerts';
import { RESPONSE_STATUS } from '../utils/questionnaires';
import {
  clientsAPI, contractsAPI, eventsAPI, invoicesAPI, messagesAPI, projectsAPI, proposalsAPI,
} from '../utils/api';
import {
  daysFromToday, formatDate, formatMoney, isOverdue, parseAmount, relativeDay, stageLabel, stageLabels,
} from '../utils/format';

function blankPortal(client) {
  return {
    name: client?.portal_name || client?.contact || client?.name || '',
    email: client?.portal_email || client?.email || '',
    password: '',
  };
}

export default function ClientProfile() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currency = user?.currency || 'GBP';
  const { responses } = useQuestionnaireAlerts();

  const [client, setClient] = useState(null);
  const [related, setRelated] = useState({ projects: [], invoices: [], proposals: [], contracts: [], events: [], messages: [] });
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(clientToForm(null));
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [portalForm, setPortalForm] = useState(blankPortal(null));
  const [portalError, setPortalError] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    Promise.all([
      clientsAPI.list(), projectsAPI.list(), invoicesAPI.list(), proposalsAPI.list(), contractsAPI.list(), eventsAPI.list(),
    ])
      .then(async ([clients, projects, invoices, proposals, contracts, events]) => {
        const found = clients.find((c) => c.id === clientId) || null;
        const mine = (rows) => rows.filter((r) => r.client_id === clientId);
        let messages = [];
        if (found) {
          try { messages = await messagesAPI.thread(clientId); } catch { messages = []; }
        }
        if (cancelled) return;
        setClient(found);
        setPortalForm(blankPortal(found));
        setRelated({
          projects: mine(projects), invoices: mine(invoices), proposals: mine(proposals),
          contracts: mine(contracts), events: mine(events), messages,
        });
      })
      .catch((err) => !cancelled && setPageError(err.message))
      .finally(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, [clientId]);

  const { projects, invoices, proposals, contracts, events, messages } = related;

  const money = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status !== 'paid');
    return {
      billed: invoices.reduce((s, i) => s + parseAmount(i.amount), 0),
      paid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + parseAmount(i.amount), 0),
      unpaid: unpaid.reduce((s, i) => s + parseAmount(i.amount), 0),
      overdue: unpaid.filter(isOverdue).reduce((s, i) => s + parseAmount(i.amount), 0),
    };
  }, [invoices]);

  const activeProjects = projects.filter((p) => p.status === 'active');
  const pastProjects = projects.filter((p) => p.status !== 'active');
  const upcoming = events
    .filter((e) => (daysFromToday(e.date) ?? -1) >= 0)
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))
    .slice(0, 3);
  const paperwork = [
    ...proposals.map((p) => ({ id: p.id, kind: 'Proposal', to: `/proposals/${p.id}`, title: p.service || 'Proposal', date: p.date || p.created_at, value: p.value, status: p.status || 'draft' })),
    ...contracts.map((c) => ({ id: c.id, kind: 'Contract', to: `/contracts/${c.id}`, title: c.service || 'Contract', date: c.date || c.created_at, value: c.value, status: c.signed ? 'signed' : 'unsigned' })),
    ...responses.filter((r) => r.client_id === clientId).map((r) => ({
      id: r.id, kind: 'Questionnaire', to: `/questionnaires/responses/${r.id}`, title: r.title, date: r.submitted_at || r.sent_at, value: '',
      status: RESPONSE_STATUS[r.status]?.pill || 'pending', label: RESPONSE_STATUS[r.status]?.label,
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  function openEdit() {
    setEditForm(clientToForm(client));
    setEditError('');
    setConfirmDelete(false);
    setEditOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      const updated = await clientsAPI.update(client.id, editForm);
      setClient((current) => ({ ...current, ...updated }));
      setEditOpen(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    setEditError('');
    try {
      await clientsAPI.remove(client.id);
      navigate('/clients');
    } catch (err) {
      setEditError(err.message);
      setDeleting(false);
    }
  }

  async function handleCreatePortal(event) {
    event.preventDefault();
    setProvisioning(true);
    setPortalError('');
    try {
      const updated = await clientsAPI.createPortalAccess(client.id, portalForm);
      setClient((current) => ({ ...current, ...updated }));
      setPortalForm((current) => ({ ...current, password: '' }));
    } catch (err) {
      setPortalError(err.message);
    } finally {
      setProvisioning(false);
    }
  }

  async function copyPortalLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portal/login`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setPortalError(err.message);
    }
  }

  const crumb = (
    <nav className="tb-crumb" aria-label="Breadcrumb">
      <Link to="/clients"><Icon name="back" size={16} />Clients</Link>
    </nav>
  );

  if (loaded && !client) {
    return (
      <>
        <div className="topbar">{crumb}</div>
        <div className="content">
          <div className="page panel empty" style={{ padding: 40 }}>
            {pageError || <><b>This client doesn’t exist any more.</b> They may have been deleted. <Link to="/clients">Back to all clients</Link></>}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        {crumb}
        {client && (
          <div className="tb-r">
            <button className="btn bg" type="button" onClick={() => navigate(`/messages?client=${client.id}`)}><Icon name="message" />Message</button>
            <button className="btn bg" type="button" onClick={openEdit}><Icon name="edit" />Edit details</button>
          </div>
        )}
      </div>

      <div className="content">
        <div className="page">
          {!client ? <div className="muted">Loading…</div> : (
            <>
              {pageError && <div className="form-error">{pageError}</div>}

              <header className="profile-head">
                <ClientMark name={client.name} color={client.color} size={68} />
                <div style={{ minWidth: 0 }}>
                  <h1 className="h-display">{client.name}</h1>
                  <div className="profile-facts">
                    <div className="fact"><span>Main contact</span>{client.contact || '—'}</div>
                    <div className="fact"><span>Email</span>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : '—'}</div>
                    <div className="fact"><span>Location</span>{client.location || '—'}</div>
                    <div className="fact"><span>Industry</span>{client.industry || '—'}</div>
                  </div>
                </div>
              </header>

              <div className="figures" style={{ marginTop: 28 }}>
                <div className="figure">
                  <div className="figure-val">{formatMoney(money.billed, currency)}</div>
                  <div className="figure-label">Billed in total</div>
                </div>
                <div className="figure">
                  <div className="figure-val">{formatMoney(money.paid, currency)}</div>
                  <div className="figure-label">Paid</div>
                </div>
                <div className="figure">
                  <div className="figure-val">{formatMoney(money.unpaid, currency)}</div>
                  <div className="figure-label">Waiting to be paid</div>
                  {money.overdue > 0 && <div className="figure-note">{formatMoney(money.overdue, currency)} overdue</div>}
                </div>
                <div className="figure">
                  <div className="figure-val">{activeProjects.length}</div>
                  <div className="figure-label">{activeProjects.length === 1 ? 'Active project' : 'Active projects'}</div>
                </div>
              </div>

              <div className="split section">
                <div style={{ minWidth: 0 }}>
                  <section aria-labelledby="proj-h">
                    <div className="section-h">
                      <h2 id="proj-h" className="h-section">Projects</h2>
                      <Link className="link" to="/projects">Start a project</Link>
                    </div>
                    <div className="panel">
                      {projects.length ? (
                        <div className="journeys">
                          {[...activeProjects, ...pastProjects].map((p) => {
                            const total = stageLabels(p.service).length;
                            const done = p.status !== 'active';
                            return (
                              <Link key={p.id} className="journey tight" to={`/projects/${p.id}`}>
                                <span style={{ minWidth: 0 }}>
                                  <span className="journey-name" style={{ display: 'block', fontSize: 15 }}>{p.service || 'Project'}</span>
                                  <span className="journey-service">{done ? 'Delivered' : `Now in ${stageLabel(p)}`}</span>
                                </span>
                                <JourneyRail project={p} compact />
                                <span className="journey-meta">
                                  <span className="journey-value" style={{ display: 'block' }}>{p.value ? formatMoney(p.value, currency) : '—'}</span>
                                  <span className="journey-when">{done ? `${total} of ${total} stages` : `Stage ${Number(p.stage || 0) + 1} of ${total}`}</span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty">No projects with {client.name} yet. Once a contract is signed, start a project to track each stage.</div>
                      )}
                    </div>
                  </section>

                  <section className="section" aria-labelledby="inv-h">
                    <div className="section-h">
                      <h2 id="inv-h" className="h-section">Invoices</h2>
                      <Link className="link" to="/invoices">New invoice</Link>
                    </div>
                    <div className="panel tbl-wrap">
                      {invoices.length ? (
                        <table className="tbl">
                          <thead><tr><th>For</th><th className="r">Amount</th><th>Due</th><th>Status</th></tr></thead>
                          <tbody>
                            {invoices.map((inv) => {
                              const overdue = isOverdue(inv);
                              return (
                                <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                                  <td>{inv.description || 'Invoice'}</td>
                                  <td className="r num" style={{ fontWeight: 500 }}>{formatMoney(inv.amount, currency)}</td>
                                  <td className="muted">{inv.status === 'paid' ? formatDate(inv.due_date) : relativeDay(inv.due_date)}</td>
                                  <td><Pill status={overdue ? 'overdue' : inv.status} /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="empty">No invoices sent to {client.name} yet.</div>
                      )}
                    </div>
                  </section>

                  <section className="section" aria-labelledby="docs-h">
                    <div className="section-h"><h2 id="docs-h" className="h-section">Paperwork and questionnaires</h2></div>
                    <div className="panel">
                      {paperwork.length ? (
                        <ul className="rows">
                          {paperwork.map((d) => (
                            <li key={`${d.kind}-${d.id}`}>
                              <Link className="row" to={d.to} style={{ alignItems: 'center' }}>
                                <Icon name={d.kind === 'Proposal' ? 'proposal' : d.kind === 'Questionnaire' ? 'clipboard' : 'contract'} size={20} className="ico muted" />
                                <span className="row-main">
                                  <span className="row-title" style={{ display: 'block' }}>{d.kind}: {d.title}</span>
                                  <span className="row-sub" style={{ display: 'block' }}>{formatDate(d.date, { day: 'numeric', month: 'short', year: 'numeric' })}{d.value ? `, ${formatMoney(d.value, currency)}` : ''}</span>
                                </span>
                                <Pill status={d.status} label={d.label} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty">Nothing sent to {client.name} yet. <Link to="/proposals">Write a proposal</Link> or <Link to="/questionnaires">send a questionnaire</Link>.</div>
                      )}
                    </div>
                  </section>
                </div>

                <aside className="panel" aria-label="Client portal, schedule and messages">
                  <div className="aside-block">
                    <h2 className="card-title" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="key" size={18} className="ico muted" />Portal access
                    </h2>
                    {portalError && <div className="form-error">{portalError}</div>}
                    {client.portal_user_id ? (
                      <>
                        <div className="notice ok" style={{ marginBottom: 12 }}>
                          {client.portal_name || client.contact || client.name} can sign in with {client.portal_email || client.email || 'their portal email'}.
                        </div>
                        <button className="btn bg bsm" type="button" onClick={copyPortalLink}>
                          <Icon name={copied ? 'check' : 'copy'} />{copied ? 'Link copied' : 'Copy portal sign-in link'}
                        </button>
                      </>
                    ) : (
                      <form onSubmit={handleCreatePortal}>
                        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                          Give {client.contact || client.name} a login to see their projects, invoices and paperwork.
                        </p>
                        <div className="fc">
                          <label className="fc-label" htmlFor="portal-name">Name</label>
                          <input id="portal-name" className="fi" value={portalForm.name} onChange={(e) => setPortalForm({ ...portalForm, name: e.target.value })} required />
                        </div>
                        <div className="fc">
                          <label className="fc-label" htmlFor="portal-email">Email</label>
                          <input id="portal-email" className="fi" type="email" value={portalForm.email} onChange={(e) => setPortalForm({ ...portalForm, email: e.target.value })} required />
                        </div>
                        <div className="fc">
                          <label className="fc-label" htmlFor="portal-pass">Temporary password</label>
                          <input id="portal-pass" className="fi" type="password" autoComplete="new-password" value={portalForm.password} onChange={(e) => setPortalForm({ ...portalForm, password: e.target.value })} required />
                        </div>
                        <button className="btn bp bsm" type="submit" disabled={provisioning}>{provisioning ? 'Creating login…' : 'Create portal login'}</button>
                      </form>
                    )}
                  </div>

                  <div className="aside-block">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <h2 className="card-title">Coming up</h2>
                      <Link to="/scheduler" style={{ fontSize: 13 }}>Book time</Link>
                    </div>
                    {upcoming.length ? upcoming.map((e) => (
                      <div key={e.id} style={{ padding: '8px 0' }}>
                        <div className="row-title">{e.title || e.event_type || 'Meeting'}</div>
                        <div className="row-sub">{formatDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}{e.time ? ` at ${e.time}` : ''}</div>
                      </div>
                    )) : <p className="muted" style={{ fontSize: 13 }}>Nothing booked with {client.name}.</p>}
                  </div>

                  <div className="aside-block">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <h2 className="card-title">Latest messages</h2>
                      <Link to={`/messages?client=${client.id}`} style={{ fontSize: 13 }}>Open conversation</Link>
                    </div>
                    {messages.length ? messages.slice(-3).map((m) => (
                      <div key={m.id} style={{ padding: '8px 0' }}>
                        <div className="faint" style={{ fontSize: 12 }}>{m.outbound ? 'You' : (client.contact || client.name)}, {relativeDay(m.sent_at)}</div>
                        <div style={{ fontSize: 13.5, marginTop: 2 }}>{m.text}</div>
                      </div>
                    )) : <p className="muted" style={{ fontSize: 13 }}>No messages yet.</p>}
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit client details"
        footer={
          <>
            <button className="btn bd spacer" type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : confirmDelete ? 'Yes, delete this client' : 'Delete client'}
            </button>
            {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep client</button>}
            <button className="btn bg" type="button" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="client-edit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </>
        }
      >
        {confirmDelete && (
          <div className="form-error">Deleting {client?.name} can’t be undone. Their projects, invoices and documents will stay in Vela.</div>
        )}
        <ClientForm id="client-edit" value={editForm} onChange={setEditForm} onSubmit={handleSave} error={editError} />
      </Modal>
    </>
  );
}
