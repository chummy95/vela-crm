import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, contractsAPI } from '../utils/api';
import { DEFAULT_CLAUSES } from '../utils/constants';

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    client_id: '',
    client_name: '',
    client_email: '',
    client_address: '',
    service: '',
    value: '',
    start_date: '',
    duration: '',
    date: '',
    clauses: DEFAULT_CLAUSES,
  });

  useEffect(() => {
    Promise.all([contractsAPI.list(), clientsAPI.list()])
      .then(([contractRows, clientRows]) => {
        setContracts(contractRows);
        setClients(clientRows);
        const client = clientRows[0];
        if (client) {
          setForm((current) => ({
            ...current,
            client_id: current.client_id || client.id,
            client_name: current.client_name || client.name,
            client_email: current.client_email || client.email || '',
          }));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e?.preventDefault();
    try {
      const created = await contractsAPI.create(form);
      setContracts((prev) => [{ ...form, id: created.id, signed: 0 }, ...prev]);
      setModal(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function sign(contract) {
    try {
      await contractsAPI.sign(contract.id);
      setContracts((prev) => prev.map((item) => (item.id === contract.id ? { ...item, signed: 1 } : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Contracts</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => setModal(true)}>+ New Contract</button></div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Agreements</div></div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Service</th><th>Value</th><th>Start</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td><b>{contract.client_name}</b></td>
                  <td>{contract.service || '—'}</td>
                  <td>{contract.value || '—'}</td>
                  <td>{contract.start_date || '—'}</td>
                  <td><Pill status={contract.signed ? 'signed' : 'pending'} label={contract.signed ? 'Signed' : 'Pending'} /></td>
                  <td>{!contract.signed && <button className="btn bg bxs" onClick={() => sign(contract)}>Mark Signed</button>}</td>
                </tr>
              ))}
              {contracts.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No contracts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Create Contract"
        footer={<><button className="btn bg" onClick={() => setModal(false)}>Cancel</button><button className="btn bp" onClick={handleCreate}>Save Contract</button></>}
      >
        <form onSubmit={handleCreate}>
          <div className="fc">
            <div className="fc-label">Client</div>
            <select
              className="fi fsel"
              value={form.client_id}
              onChange={(e) => {
                const client = clients.find((item) => item.id === e.target.value);
                setForm({
                  ...form,
                  client_id: e.target.value,
                  client_name: client?.name || '',
                  client_email: client?.email || '',
                });
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
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Start Date</div><input className="fi" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div className="fc"><div className="fc-label">Duration</div><input className="fi" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Client Email</div><input className="fi" type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
        </form>
      </Modal>
    </>
  );
}
