import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, invoicesAPI, projectsAPI } from '../utils/api';
import { formatDate, formatMoney, isOverdue, parseAmount, relativeDay, stageLabel } from '../utils/format';

const FILTERS = [
  { key: 'open', label: 'Unpaid' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
];

function blankInvoice(clientId = '') {
  return { client_id: clientId, project_id: '', description: '', amount: '', due_date: '', status: 'unpaid' };
}

function InvoiceFields({ id, value, onChange, onSubmit, clients, projects, error }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const clientProjects = projects.filter((p) => p.client_id === value.client_id);
  return (
    <form id={id} onSubmit={onSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-client`}>Client</label>
          <select id={`${id}-client`} className="fi fsel" value={value.client_id} onChange={(e) => onChange({ ...value, client_id: e.target.value, project_id: '' })} required>
            <option value="" disabled>Choose a client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-project`}>Project</label>
          <select id={`${id}-project`} className="fi fsel" value={value.project_id} onChange={set('project_id')}>
            <option value="">Not linked to a project</option>
            {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.service}</option>)}
          </select>
        </div>
      </div>
      <div className="fc">
        <label className="fc-label" htmlFor={`${id}-desc`}>What it’s for</label>
        <input id={`${id}-desc`} className="fi" value={value.description} onChange={set('description')} placeholder="Brand identity, 50% deposit" />
      </div>
      <div className="fi-row">
        <div className="fc" style={{ marginBottom: 0 }}>
          <label className="fc-label" htmlFor={`${id}-amount`}>Amount</label>
          <input id={`${id}-amount`} className="fi" inputMode="decimal" value={value.amount} onChange={set('amount')} placeholder="2400" required />
        </div>
        <div className="fc" style={{ marginBottom: 0 }}>
          <label className="fc-label" htmlFor={`${id}-due`}>Due date</label>
          <input id={`${id}-due`} className="fi" type="date" value={value.due_date} onChange={set('due_date')} />
        </div>
      </div>
    </form>
  );
}

export default function Invoices() {
  const navigate = useNavigate();
  const params = useParams();
  const routeInvoiceId = (params['*'] || '').split('/')[0] || '';
  const { user } = useAuth();
  const currency = user?.currency || 'GBP';

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('open');
  const [pageError, setPageError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankInvoice());
  const [createError, setCreateError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);

  const [detailForm, setDetailForm] = useState(blankInvoice());
  const [detailError, setDetailError] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([invoicesAPI.list(), clientsAPI.list(), projectsAPI.list()])
      .then(([invoiceRows, clientRows, projectRows]) => {
        setInvoices(invoiceRows);
        setClients(clientRows);
        setProjects(projectRows);
      })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const selected = useMemo(() => invoices.find((i) => i.id === routeInvoiceId) || null, [invoices, routeInvoiceId]);

  useEffect(() => {
    if (!selected) return;
    setDetailForm({
      client_id: selected.client_id || '',
      project_id: selected.project_id || '',
      description: selected.description || '',
      amount: selected.amount || '',
      due_date: selected.due_date || '',
      status: selected.status || 'unpaid',
    });
    setDetailError('');
    setConfirmDelete(false);
  }, [selected]);

  const totals = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status !== 'paid');
    return {
      unpaid: unpaid.reduce((s, i) => s + parseAmount(i.amount), 0),
      overdue: unpaid.filter(isOverdue).reduce((s, i) => s + parseAmount(i.amount), 0),
      overdueCount: unpaid.filter(isOverdue).length,
      paid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + parseAmount(i.amount), 0),
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

  function colorFor(clientId) {
    return clients.find((c) => c.id === clientId)?.color;
  }

  function openCreate() {
    setCreateForm(blankInvoice(clients[0]?.id || ''));
    setCreateError('');
    setCreateOpen(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await invoicesAPI.create(createForm);
      setInvoices((prev) => [created, ...prev]);
      setCreateOpen(false);
      setFilter('open');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await invoicesAPI.update(selected.id, detailForm);
      setInvoices((prev) => prev.map((i) => (i.id === selected.id ? { ...i, ...(updated || detailForm) } : i)));
      navigate('/invoices');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingDetail(false);
    }
  }

  async function toggleStatus(invoice) {
    const status = invoice.status === 'paid' ? 'unpaid' : 'paid';
    try {
      await invoicesAPI.updateStatus(invoice.id, status);
      setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? { ...i, status } : i)));
      if (selected?.id === invoice.id) setDetailForm((current) => ({ ...current, status }));
    } catch (err) {
      if (selected) setDetailError(err.message);
      else setPageError(err.message);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await invoicesAPI.remove(selected.id);
      setInvoices((prev) => prev.filter((i) => i.id !== selected.id));
      navigate('/invoices');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const selectedOverdue = selected && isOverdue(selected);
  const linkedProject = projects.find((p) => p.id === detailForm.project_id);

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
          <button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />New invoice</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {pageError && <div className="form-error">{pageError}</div>}

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
                  <tr><th>Client</th><th className="hide-sm">For</th><th className="r">Amount</th><th>Due</th><th>Status</th><th className="r"><span className="sr-only">Actions</span></th></tr>
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
                        <td className="hide-sm muted">{inv.description || '—'}</td>
                        <td className="r num" style={{ fontWeight: 500 }}>{formatMoney(inv.amount, currency)}</td>
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

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New invoice"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="invoice-create" disabled={savingCreate || !clients.length}>{savingCreate ? 'Creating…' : 'Create invoice'}</button>
          </>
        }
      >
        {clients.length
          ? <InvoiceFields id="invoice-create" value={createForm} onChange={setCreateForm} onSubmit={handleCreate} clients={clients} projects={projects} error={createError} />
          : <div className="empty" style={{ padding: 0 }}>Invoices belong to a client. <Link to="/clients?new=1">Add your first client</Link> first.</div>}
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={() => navigate('/invoices')}
        title={selected ? `Invoice for ${selected.client_name || 'client'}` : 'Invoice'}
        footer={
          <>
            <button className="btn bd spacer" type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : confirmDelete ? 'Yes, delete invoice' : 'Delete'}
            </button>
            {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button>}
            <button className="btn bg" type="button" onClick={() => navigate('/invoices')}>Close</button>
            <button className="btn bp" type="submit" form="invoice-edit" disabled={savingDetail}>{savingDetail ? 'Saving…' : 'Save changes'}</button>
          </>
        }
      >
        {selected && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              <div>
                <div className="figure-val" style={{ fontSize: 34 }}>{formatMoney(detailForm.amount, currency)}</div>
                <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                  {detailForm.status === 'paid'
                    ? 'Paid'
                    : detailForm.due_date
                      ? <span style={{ color: selectedOverdue ? 'var(--err)' : undefined }}>Due {relativeDay(detailForm.due_date)}{selectedOverdue ? ', overdue' : ''}</span>
                      : 'No due date set'}
                  {linkedProject ? `, for ${linkedProject.service} (${stageLabel(linkedProject)})` : ''}
                </div>
              </div>
              <button className={`btn ${detailForm.status === 'paid' ? 'bg' : 'bp'}`} type="button" onClick={() => toggleStatus(selected)}>
                <Icon name="check" />{detailForm.status === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}
              </button>
            </div>
            {confirmDelete && <div className="form-error">Deleting this invoice can’t be undone.</div>}
            <InvoiceFields id="invoice-edit" value={detailForm} onChange={setDetailForm} onSubmit={handleUpdate} clients={clients} projects={projects} error={detailError} />
          </>
        )}
      </Modal>
    </>
  );
}
