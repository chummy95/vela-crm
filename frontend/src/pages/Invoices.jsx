import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, invoicesAPI, projectsAPI } from '../utils/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ client_id: '', project_id: '', description: '', amount: '', due_date: '' });

  useEffect(() => {
    Promise.all([invoicesAPI.list(), clientsAPI.list(), projectsAPI.list()])
      .then(([invoiceRows, clientRows, projectRows]) => {
        setInvoices(invoiceRows);
        setClients(clientRows);
        setProjects(projectRows);
        setForm((current) => ({ ...current, client_id: current.client_id || clientRows[0]?.id || '' }));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e?.preventDefault();
    try {
      const created = await invoicesAPI.create(form);
      setInvoices((prev) => [created, ...prev]);
      setModal(false);
      setError('');
      setForm({ client_id: clients[0]?.id || '', project_id: '', description: '', amount: '', due_date: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleStatus(invoice) {
    const status = invoice.status === 'paid' ? 'unpaid' : 'paid';
    try {
      await invoicesAPI.updateStatus(invoice.id, status);
      setInvoices((prev) => prev.map((item) => (item.id === invoice.id ? { ...item, status } : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  const clientProjects = projects.filter((project) => project.client_id === form.client_id);

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Invoices</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => setModal(true)}>+ New Invoice</button></div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Billing</div></div>
          <table className="tbl">
            <thead><tr><th>ID</th><th>Client</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><b>{invoice.id}</b></td>
                  <td>{invoice.client_name || 'Unknown client'}</td>
                  <td>{invoice.amount || '—'}</td>
                  <td>{invoice.due_date || '—'}</td>
                  <td><Pill status={invoice.status} /></td>
                  <td><button className="btn bg bxs" onClick={() => toggleStatus(invoice)}>{invoice.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}</button></td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Create Invoice"
        footer={<><button className="btn bg" onClick={() => setModal(false)}>Cancel</button><button className="btn bp" onClick={handleCreate}>Save Invoice</button></>}
      >
        <form onSubmit={handleCreate}>
          <div className="fc">
            <div className="fc-label">Client</div>
            <select className="fi fsel" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, project_id: '' })} required>
              <option value="" disabled>Select a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fc">
            <div className="fc-label">Project</div>
            <select className="fi fsel" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">No linked project</option>
              {clientProjects.map((project) => <option key={project.id} value={project.id}>{project.service}</option>)}
            </select>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Amount</div><input className="fi" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Due Date</div><input className="fi" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Description</div><input className="fi" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </form>
      </Modal>
    </>
  );
}
