import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, invoicesAPI, projectsAPI } from '../utils/api';

function blankInvoice(clientId = '') {
  return { client_id: clientId, project_id: '', description: '', amount: '', due_date: '', status: 'unpaid' };
}

export default function Invoices() {
  const navigate = useNavigate();
  const params = useParams();
  const routeInvoiceId = (params['*'] || '').split('/')[0] || '';

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankInvoice());
  const [detailForm, setDetailForm] = useState(blankInvoice());
  const [pageError, setPageError] = useState('');
  const [createError, setCreateError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [invoiceRows, clientRows, projectRows] = await Promise.all([invoicesAPI.list(), clientsAPI.list(), projectsAPI.list()]);
    setInvoices(invoiceRows);
    setClients(clientRows);
    setProjects(projectRows);
    setCreateForm((current) => ({ ...current, client_id: current.client_id || clientRows[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch((err) => setPageError(err.message));
  }, []);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === routeInvoiceId) || null,
    [invoices, routeInvoiceId]
  );

  useEffect(() => {
    if (!selectedInvoice) return;
    setDetailForm({
      client_id: selectedInvoice.client_id || '',
      project_id: selectedInvoice.project_id || '',
      description: selectedInvoice.description || '',
      amount: selectedInvoice.amount || '',
      due_date: selectedInvoice.due_date || '',
      status: selectedInvoice.status || 'unpaid',
    });
    setDetailError('');
  }, [selectedInvoice]);

  const createProjects = projects.filter((project) => project.client_id === createForm.client_id);
  const detailProjects = projects.filter((project) => project.client_id === detailForm.client_id);
  const selectedProject = projects.find((project) => project.id === detailForm.project_id);

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await invoicesAPI.create(createForm);
      setInvoices((prev) => [created, ...prev]);
      setCreateOpen(false);
      setCreateForm(blankInvoice(clients[0]?.id || ''));
      navigate(`/invoices/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedInvoice) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await invoicesAPI.update(selectedInvoice.id, detailForm);
      setInvoices((prev) => prev.map((invoice) => (invoice.id === updated.id ? updated : invoice)));
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
      setInvoices((prev) => prev.map((item) => (item.id === invoice.id ? { ...item, status } : item)));
      if (selectedInvoice?.id === invoice.id) {
        setDetailForm((current) => ({ ...current, status }));
      }
    } catch (err) {
      setDetailError(err.message);
      setPageError(err.message);
    }
  }

  async function handleDelete() {
    if (!selectedInvoice) return;
    setDeleting(true);
    setDetailError('');
    try {
      await invoicesAPI.remove(selectedInvoice.id);
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== selectedInvoice.id));
      navigate('/invoices');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Invoices</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => { setCreateError(''); setCreateForm(blankInvoice(clients[0]?.id || '')); setCreateOpen(true); }}>+ New Invoice</button></div>
      </div>
      <div className="content">
        {pageError && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{pageError}</div>}
        {!clients.length && (
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>No billing clients yet</div>
            <div style={{ color: 'var(--text-s)', fontSize: 13 }}>Add a client first, then you can generate invoices linked to their projects.</div>
          </div>
        )}
        <div className="card">
          <div className="card-h"><div className="card-title">Billing</div></div>
          <table className="tbl">
            <thead><tr><th>ID</th><th>Client</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} onClick={() => navigate(`/invoices/${invoice.id}`)}>
                  <td><b>{invoice.id.slice(0, 8)}</b></td>
                  <td>{invoice.client_name || 'Unknown client'}</td>
                  <td>{invoice.amount || '—'}</td>
                  <td>{invoice.due_date || '—'}</td>
                  <td><Pill status={invoice.status} /></td>
                  <td>
                    <button
                      className="btn bg bxs"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleStatus(invoice);
                      }}
                    >
                      {invoice.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Invoice"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="invoice-create-form" disabled={savingCreate || !clients.length}>
              {savingCreate ? 'Saving…' : 'Save Invoice'}
            </button>
          </>
        }
      >
        <form id="invoice-create-form" onSubmit={handleCreate}>
          {createError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{createError}</div>}
          <div className="fc">
            <div className="fc-label">Client</div>
            <select className="fi fsel" value={createForm.client_id} onChange={(event) => setCreateForm({ ...createForm, client_id: event.target.value, project_id: '' })} required>
              <option value="" disabled>Select a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fc">
            <div className="fc-label">Project</div>
            <select className="fi fsel" value={createForm.project_id} onChange={(event) => setCreateForm({ ...createForm, project_id: event.target.value })}>
              <option value="">No linked project</option>
              {createProjects.map((project) => <option key={project.id} value={project.id}>{project.service}</option>)}
            </select>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Amount</div><input className="fi" value={createForm.amount} onChange={(event) => setCreateForm({ ...createForm, amount: event.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Due Date</div><input className="fi" type="date" value={createForm.due_date} onChange={(event) => setCreateForm({ ...createForm, due_date: event.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Description</div><textarea className="fi" value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} /></div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedInvoice)}
        onClose={() => navigate('/invoices')}
        title={selectedInvoice ? `Invoice ${selectedInvoice.id.slice(0, 8)}` : 'Invoice'}
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => navigate('/invoices')}>Close</button>
            <button className="btn bg" type="button" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            <button className="btn bp" type="submit" form="invoice-detail-form" disabled={savingDetail}>{savingDetail ? 'Saving…' : 'Save Changes'}</button>
          </>
        }
      >
        {selectedInvoice && (
          <>
            {detailError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{detailError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.amount || '—'}</div><div className="stat-label">Invoice Amount</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.due_date || '—'}</div><div className="stat-label">Due Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.status === 'paid' ? 'Paid' : 'Open'}</div><div className="stat-label">Billing Status</div></div>
            </div>
            <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
              <button className="btn bg" type="button" onClick={() => toggleStatus(selectedInvoice)}>
                {detailForm.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
              </button>
            </div>
            <form id="invoice-detail-form" onSubmit={handleUpdate}>
              <div className="fc">
                <div className="fc-label">Client</div>
                <select className="fi fsel" value={detailForm.client_id} onChange={(event) => setDetailForm({ ...detailForm, client_id: event.target.value, project_id: '' })} required>
                  <option value="" disabled>Select a client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div className="fc">
                <div className="fc-label">Project</div>
                <select className="fi fsel" value={detailForm.project_id} onChange={(event) => setDetailForm({ ...detailForm, project_id: event.target.value })}>
                  <option value="">No linked project</option>
                  {detailProjects.map((project) => <option key={project.id} value={project.id}>{project.service}</option>)}
                </select>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Amount</div><input className="fi" value={detailForm.amount} onChange={(event) => setDetailForm({ ...detailForm, amount: event.target.value })} required /></div>
                <div className="fc"><div className="fc-label">Due Date</div><input className="fi" type="date" value={detailForm.due_date} onChange={(event) => setDetailForm({ ...detailForm, due_date: event.target.value })} /></div>
              </div>
              <div className="fc"><div className="fc-label">Description</div><textarea className="fi" value={detailForm.description} onChange={(event) => setDetailForm({ ...detailForm, description: event.target.value })} /></div>
              {selectedProject && (
                <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Linked project output</div>
                  <div style={{ fontSize: 13, color: 'var(--text-s)' }}>{selectedProject.service} · Stage {Number(selectedProject.stage || 0) + 1}</div>
                </div>
              )}
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
