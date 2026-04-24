import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, proposalsAPI } from '../utils/api';

export default function Proposals() {
  const [proposals, setProposals] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ client_id: '', client_name: '', service: '', date: '', value: '', status: 'draft' });

  useEffect(() => {
    Promise.all([proposalsAPI.list(), clientsAPI.list()])
      .then(([proposalRows, clientRows]) => {
        setProposals(proposalRows);
        setClients(clientRows);
        if (clientRows[0]) {
          setForm((current) => ({ ...current, client_id: current.client_id || clientRows[0].id, client_name: current.client_name || clientRows[0].name }));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e?.preventDefault();
    try {
      const payload = { ...form, packages: [], deliverables: [], timeline: [] };
      const created = await proposalsAPI.create(payload);
      setProposals((prev) => [{ ...payload, id: created.id }, ...prev]);
      setModal(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(proposal, status) {
    try {
      await proposalsAPI.update(proposal.id, { ...proposal, status });
      setProposals((prev) => prev.map((item) => (item.id === proposal.id ? { ...item, status } : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Proposals</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => setModal(true)}>+ New Proposal</button></div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Proposal Pipeline</div></div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Service</th><th>Value</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id}>
                  <td><b>{proposal.client_name}</b></td>
                  <td>{proposal.service || '—'}</td>
                  <td>{proposal.value || '—'}</td>
                  <td>{proposal.date || '—'}</td>
                  <td><Pill status={proposal.status} /></td>
                  <td>
                    <button className="btn bg bxs" onClick={() => updateStatus(proposal, proposal.status === 'approved' ? 'sent' : 'approved')}>
                      {proposal.status === 'approved' ? 'Mark Sent' : 'Approve'}
                    </button>
                  </td>
                </tr>
              ))}
              {proposals.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No proposals yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Create Proposal"
        footer={<><button className="btn bg" onClick={() => setModal(false)}>Cancel</button><button className="btn bp" onClick={handleCreate}>Save Proposal</button></>}
      >
        <form onSubmit={handleCreate}>
          <div className="fc">
            <div className="fc-label">Client</div>
            <select
              className="fi fsel"
              value={form.client_id}
              onChange={(e) => {
                const client = clients.find((item) => item.id === e.target.value);
                setForm({ ...form, client_id: e.target.value, client_name: client?.name || '' });
              }}
              required
            >
              <option value="" disabled>Select a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Service</div><input className="fi" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Value</div><input className="fi" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Date</div><input className="fi" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        </form>
      </Modal>
    </>
  );
}
