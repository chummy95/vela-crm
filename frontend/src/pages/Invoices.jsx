import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import InvoiceDocument from '../components/InvoiceDocument';
import InvoiceEditor, { blankInvoiceForm, invoiceToForm } from '../components/InvoiceEditor';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, invoicesAPI, paymentsAPI, projectsAPI, studioProfileAPI } from '../utils/api';
import { formatDate, formatMoney, isOverdue, relativeDay, stageLabel } from '../utils/format';
import { DEFAULT_STUDIO_PROFILE, money, toNumber } from '../utils/invoices';
import { downloadInvoicePdf } from '../utils/invoicePdf';

const FILTERS = [
  { key: 'open', label: 'Unpaid' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
];

const longDate = { day: 'numeric', month: 'long', year: 'numeric' };

export default function Invoices() {
  const navigate = useNavigate();
  const params = useParams();
  const routeInvoiceId = (params['*'] || '').split('/')[0] || '';
  const { user } = useAuth();

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState(DEFAULT_STUDIO_PROFILE);
  const [stripe, setStripe] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('open');
  const [pageError, setPageError] = useState('');
  const [editor, setEditor] = useState(null); // { mode: 'create' | 'edit', initial }
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const currency = profile.currency || user?.currency || 'GBP';

  useEffect(() => {
    Promise.all([invoicesAPI.list(), clientsAPI.list(), projectsAPI.list(), studioProfileAPI.get().catch(() => DEFAULT_STUDIO_PROFILE)])
      .then(([invoiceRows, clientRows, projectRows, profileRow]) => {
        setInvoices(invoiceRows);
        setClients(clientRows);
        setProjects(projectRows);
        setProfile(profileRow);
      })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
    paymentsAPI.status().then((s) => setStripe(Boolean(s.stripe)));
  }, []);

  // Invoices marked paid in the background (Stripe) while this page is open.
  useEffect(() => {
    const onPaid = (e) => setInvoices((prev) => prev.map((i) => (i.id === e.detail.id ? { ...i, ...e.detail.changes } : i)));
    window.addEventListener('vela:invoice-paid', onPaid);
    return () => window.removeEventListener('vela:invoice-paid', onPaid);
  }, []);

  useEffect(() => { setConfirmDelete(false); }, [routeInvoiceId]);

  const selected = useMemo(() => invoices.find((i) => i.id === routeInvoiceId) || null, [invoices, routeInvoiceId]);
  const cur = (inv) => inv?.currency || currency;

  const totals = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status !== 'paid');
    return {
      unpaid: unpaid.reduce((s, i) => s + toNumber(i.amount), 0),
      overdue: unpaid.filter(isOverdue).reduce((s, i) => s + toNumber(i.amount), 0),
      overdueCount: unpaid.filter(isOverdue).length,
      paid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + toNumber(i.amount), 0),
    };
  }, [invoices]);

  const rows = useMemo(() => {
    const list = invoices.filter((i) => (filter === 'all' ? true : filter === 'paid' ? i.status === 'paid' : i.status !== 'paid'));
    return [...list].sort((a, b) => {
      if (filter !== 'paid') {
        const oa = isOverdue(a) ? 0 : 1;
        const ob = isOverdue(b) ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
      }
      return String(b.due_date || '').localeCompare(String(a.due_date || ''));
    });
  }, [invoices, filter]);

  const counts = {
    open: invoices.filter((i) => i.status !== 'paid').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
    all: invoices.length,
  };

  const colorFor = (clientId) => clients.find((c) => c.id === clientId)?.color;

  function openCreate() {
    const first = clients[0];
    const initial = blankInvoiceForm(profile, '');
    if (first) {
      const last = invoices.find((i) => i.client_id === first.id && i.bill_to);
      Object.assign(initial, { client_id: first.id, bill_to: { name: first.name, contact: first.contact || '', email: first.email || '', address: last?.bill_to?.address || '', vat_number: last?.bill_to?.vat_number || '' } });
    }
    setEditor({ mode: 'create', initial });
  }

  async function saveInvoice(form) {
    if (editor.mode === 'create') {
      const created = await invoicesAPI.create(form);
      setInvoices((prev) => [created, ...prev]);
      setProfile((p) => ({ ...p, next_invoice_number: (Number(p.next_invoice_number) || 1) + 1 }));
      navigate(`/invoices/${created.id}`);
    } else {
      const updated = await invoicesAPI.update(selected.id, form);
      setInvoices((prev) => prev.map((i) => (i.id === selected.id ? { ...i, ...updated } : i)));
    }
  }

  async function toggleStatus(invoice) {
    const status = invoice.status === 'paid' ? 'unpaid' : 'paid';
    setBusy(true);
    try {
      const result = await invoicesAPI.updateStatus(invoice.id, status, { payment_method: status === 'paid' ? 'Marked paid' : '' });
      setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? { ...i, status, paid_at: result.paid_at || '', payment_method: result.payment_method || '' } : i)));
    } catch (err) {
      setPageError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await invoicesAPI.remove(selected.id);
      setInvoices((prev) => prev.filter((i) => i.id !== selected.id));
      navigate('/invoices');
    } catch (err) {
      setPageError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(invoice) {
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice, profile);
    } catch (err) {
      setPageError(err.message || 'Couldn’t create the PDF.');
    } finally {
      setDownloading(false);
    }
  }

  const editorModal = (
    <InvoiceEditor
      open={Boolean(editor)}
      onClose={() => setEditor(null)}
      onSave={saveInvoice}
      initial={editor?.initial}
      clients={clients}
      projects={projects}
      invoices={invoices}
      title={editor?.mode === 'edit' ? `Edit ${selected?.number || 'invoice'}` : 'New invoice'}
      saveLabel={editor?.mode === 'edit' ? 'Save changes' : 'Create invoice'}
    />
  );

  const setupMissing = loaded && !profile.business_name && !profile.logo && !profile.address;

  /* ── One invoice ─────────────────────────────────────────── */
  if (routeInvoiceId) {
    if (!selected) {
      return (
        <>
          <div className="topbar"><nav className="tb-crumb"><Link to="/invoices"><Icon name="back" size={16} />Invoices</Link></nav></div>
          <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? <>This invoice doesn’t exist any more. <Link to="/invoices">Back to invoices</Link></> : 'Loading…'}</div></div>
        </>
      );
    }
    const overdue = isOverdue(selected);
    const paid = selected.status === 'paid';
    const project = projects.find((p) => p.id === selected.project_id);
    const payLink = selected.payment_link || profile.payment_link;
    const howToPay = [
      stripe && profile.card_payments ? 'Card payment with Stripe (marked paid by itself)' : '',
      payLink ? 'Payment link' : '',
      profile.bank_details ? 'Bank transfer' : '',
    ].filter(Boolean);
    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/invoices"><Icon name="back" size={16} />Invoices</Link></nav>
          <div className="tb-r">
            <button className="btn bq" type="button" disabled={busy} onClick={handleDelete}>{confirmDelete ? 'Yes, delete it' : 'Delete'}</button>
            {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep</button>}
            <button className="btn bg" type="button" onClick={() => setEditor({ mode: 'edit', initial: invoiceToForm(selected) })}><Icon name="edit" />Edit</button>
            <button className="btn bg" type="button" disabled={downloading} onClick={() => download(selected)}><Icon name="download" />{downloading ? 'Preparing…' : 'Download PDF'}</button>
            <button className={`btn ${paid ? 'bg' : 'bp'}`} type="button" disabled={busy} onClick={() => toggleStatus(selected)}><Icon name="check" />{paid ? 'Mark as unpaid' : 'Mark as paid'}</button>
          </div>
        </div>
        <div className="content">
          <div className="page">
            {pageError && <div className="form-error">{pageError}</div>}
            {confirmDelete && <div className="form-error">Deleting this invoice can’t be undone. Your client won’t see it any more.</div>}
            <header className="review-head" style={{ marginBottom: 22 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="muted" style={{ fontSize: 13.5 }}>{selected.number ? `${selected.number}, ` : ''}{selected.client_name}</div>
                <h1 className="h-display">{money(selected.amount, cur(selected))}</h1>
                <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                  {paid
                    ? `Paid ${formatDate(selected.paid_at, longDate) || ''}${selected.payment_method && selected.payment_method !== 'Marked paid' ? ` by ${selected.payment_method}` : ''}`
                    : selected.due_date ? <span style={{ color: overdue ? 'var(--err)' : undefined }}>Due {relativeDay(selected.due_date)}{overdue ? ', overdue' : ''}</span> : 'No due date'}
                  {project ? `, for ${project.service} (${stageLabel(project)})` : ''}
                </div>
              </div>
              <Pill status={overdue ? 'overdue' : selected.status} />
            </header>
            <div className="inv-split">
              <InvoiceDocument invoice={selected} profile={profile} />
              <aside className="panel" aria-label="How the client pays">
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 6 }}>How {selected.client_name || 'the client'} can pay</h2>
                  {howToPay.length
                    ? <ul className="plain-list">{howToPay.map((h) => <li key={h}><Icon name="check" size={14} /> {h}</li>)}</ul>
                    : <p className="muted" style={{ fontSize: 13.5 }}>No payment options yet.</p>}
                  <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>They see this invoice, a Pay button and the PDF in their portal.</p>
                </div>
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 6 }}>Your details</h2>
                  <p className="muted" style={{ fontSize: 13 }}>Logo, address, VAT number and bank details come from <Link to="/settings">Settings</Link>.</p>
                </div>
              </aside>
            </div>
          </div>
        </div>
        {editorModal}
      </>
    );
  }

  /* ── All invoices ───────────────────────────────────────── */
  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Invoices</h1>
        <div className="tb-r">
          <div className="segmented" role="tablist" aria-label="Filter invoices">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                {f.label} <span className="faint">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <button className="btn bp" type="button" onClick={openCreate} disabled={!clients.length}><Icon name="plus" />New invoice</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {pageError && <div className="form-error">{pageError}</div>}
          {setupMissing && (
            <div className="locked-note" style={{ marginBottom: 20 }}>
              <Icon name="receipt" size={16} />
              <span>Add your logo, address, VAT and bank details so they appear on your invoices. <Link to="/settings">Set up invoices</Link></span>
            </div>
          )}

          <div className="figures" style={{ marginBottom: 24 }}>
            <div className="figure"><div className="figure-val">{formatMoney(totals.unpaid, currency)}</div><div className="figure-label">Waiting to be paid</div></div>
            <div className="figure">
              <div className="figure-val" style={{ color: totals.overdue ? 'var(--err)' : undefined }}>{formatMoney(totals.overdue, currency)}</div>
              <div className="figure-label">{totals.overdueCount === 1 ? '1 invoice overdue' : `${totals.overdueCount} invoices overdue`}</div>
            </div>
            <div className="figure"><div className="figure-val">{formatMoney(totals.paid, currency)}</div><div className="figure-label">Collected</div></div>
          </div>

          <div className="panel tbl-wrap">
            {rows.length ? (
              <table className="tbl">
                <thead>
                  <tr><th>Client</th><th className="hide-sm">Number</th><th className="hide-sm">For</th><th className="r">Total</th><th>Due</th><th>Status</th><th className="r"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {rows.map((inv) => {
                    const overdue = isOverdue(inv);
                    return (
                      <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ClientMark name={inv.client_name} color={colorFor(inv.client_id)} size={28} />
                            <span style={{ fontWeight: 500 }}>{inv.client_name || 'Unknown client'}</span>
                          </div>
                        </td>
                        <td className="hide-sm muted num">{inv.number || '—'}</td>
                        <td className="hide-sm muted">{inv.description || '—'}</td>
                        <td className="r num" style={{ fontWeight: 500 }}>{money(inv.amount, cur(inv))}</td>
                        <td style={{ color: overdue ? 'var(--err)' : 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {inv.due_date ? (inv.status === 'paid' ? formatDate(inv.due_date) : relativeDay(inv.due_date)) : '—'}
                        </td>
                        <td><Pill status={overdue ? 'overdue' : inv.status} /></td>
                        <td className="r">
                          <button className="btn bg bxs" type="button" onClick={(e) => { e.stopPropagation(); toggleStatus(inv); }}>
                            {inv.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                {!loaded && 'Loading…'}
                {loaded && invoices.length === 0 && (
                  clients.length
                    ? <><b>No invoices yet.</b> Create one for a deposit or final balance and track when it’s paid.<div style={{ marginTop: 14 }}><button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />New invoice</button></div></>
                    : <><b>No invoices yet.</b> Invoices belong to a client. <Link to="/clients?new=1">Add your first client</Link> to get started.</>
                )}
                {loaded && invoices.length > 0 && (filter === 'paid' ? 'No paid invoices yet.' : 'Nothing is waiting to be paid.')}
              </div>
            )}
          </div>
        </div>
      </div>
      {editorModal}
    </>
  );
}
