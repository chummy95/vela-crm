import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, contractsAPI } from '../utils/api';
import { DEFAULT_CLAUSES } from '../utils/constants';

function blankContract(clientId = '', clientName = '', clientEmail = '') {
  return {
    client_id: clientId,
    client_name: clientName,
    client_email: clientEmail,
    client_address: '',
    service: '',
    value: '',
    start_date: '',
    duration: '',
    date: '',
    clauses: DEFAULT_CLAUSES,
  };
}

function renderClauseBody(clause, form) {
  return String(clause.body || '')
    .replace('__SERVICE__', form.service || 'the agreed service')
    .replace('__VALUE__', form.value || 'the agreed value');
}

export default function Contracts() {
  const navigate = useNavigate();
  const params = useParams();
  const routeContractId = (params['*'] || '').split('/')[0] || '';

  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankContract());
  const [detailForm, setDetailForm] = useState(blankContract());
  const [pageError, setPageError] = useState('');
  const [createError, setCreateError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [contractRows, clientRows] = await Promise.all([contractsAPI.list(), clientsAPI.list()]);
    setContracts(contractRows);
    setClients(clientRows);
    if (clientRows[0]) {
      setCreateForm((current) => ({
        ...current,
        client_id: current.client_id || clientRows[0].id,
        client_name: current.client_name || clientRows[0].name,
        client_email: current.client_email || clientRows[0].email || '',
      }));
    }
  }

  useEffect(() => {
    load().catch((err) => setPageError(err.message));
  }, []);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === routeContractId) || null,
    [contracts, routeContractId]
  );

  useEffect(() => {
    if (!selectedContract) return;
    setDetailForm({
      client_id: selectedContract.client_id || '',
      client_name: selectedContract.client_name || '',
      client_email: selectedContract.client_email || '',
      client_address: selectedContract.client_address || '',
      service: selectedContract.service || '',
      value: selectedContract.value || '',
      start_date: selectedContract.start_date || '',
      duration: selectedContract.duration || '',
      date: selectedContract.date || '',
      clauses: Array.isArray(selectedContract.clauses) ? selectedContract.clauses : DEFAULT_CLAUSES,
      signed: Boolean(selectedContract.signed),
    });
    setDetailError('');
  }, [selectedContract]);

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await contractsAPI.create(createForm);
      setContracts((prev) => [created, ...prev]);
      setCreateOpen(false);
      navigate(`/contracts/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedContract) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await contractsAPI.update(selectedContract.id, detailForm);
      setContracts((prev) => prev.map((contract) => (contract.id === updated.id ? updated : contract)));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingDetail(false);
    }
  }

  async function sign(contract) {
    try {
      await contractsAPI.sign(contract.id);
      setContracts((prev) => prev.map((item) => (item.id === contract.id ? { ...item, signed: true } : item)));
      if (selectedContract?.id === contract.id) {
        setDetailForm((current) => ({ ...current, signed: true }));
      }
    } catch (err) {
      setDetailError(err.message);
      setPageError(err.message);
    }
  }

  async function handleDelete() {
    if (!selectedContract) return;
    setDeleting(true);
    setDetailError('');
    try {
      await contractsAPI.remove(selectedContract.id);
      setContracts((prev) => prev.filter((contract) => contract.id !== selectedContract.id));
      navigate('/contracts');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Contracts</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => { setCreateError(''); setCreateOpen(true); }}>+ New Contract</button></div>
      </div>
      <div className="content">
        {pageError && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{pageError}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Agreements</div></div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Service</th><th>Value</th><th>Start</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id} onClick={() => navigate(`/contracts/${contract.id}`)}>
                  <td><b>{contract.client_name}</b></td>
                  <td>{contract.service || '—'}</td>
                  <td>{contract.value || '—'}</td>
                  <td>{contract.start_date || '—'}</td>
                  <td><Pill status={contract.signed ? 'signed' : 'pending'} label={contract.signed ? 'Signed' : 'Pending'} /></td>
                  <td>
                    {!contract.signed && (
                      <button
                        className="btn bg bxs"
                        onClick={(event) => {
                          event.stopPropagation();
                          sign(contract);
                        }}
                      >
                        Mark Signed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No contracts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Contract"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="contract-create-form" disabled={savingCreate}>{savingCreate ? 'Saving…' : 'Save Contract'}</button>
          </>
        }
      >
        <form id="contract-create-form" onSubmit={handleCreate}>
          {createError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{createError}</div>}
          <div className="fc">
            <div className="fc-label">Client</div>
            <select
              className="fi fsel"
              value={createForm.client_id}
              onChange={(event) => {
                const client = clients.find((item) => item.id === event.target.value);
                setCreateForm({
                  ...createForm,
                  client_id: event.target.value,
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
            <div className="fc"><div className="fc-label">Service</div><input className="fi" value={createForm.service} onChange={(event) => setCreateForm({ ...createForm, service: event.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Value</div><input className="fi" value={createForm.value} onChange={(event) => setCreateForm({ ...createForm, value: event.target.value })} /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Start Date</div><input className="fi" type="date" value={createForm.start_date} onChange={(event) => setCreateForm({ ...createForm, start_date: event.target.value })} /></div>
            <div className="fc"><div className="fc-label">Duration</div><input className="fi" value={createForm.duration} onChange={(event) => setCreateForm({ ...createForm, duration: event.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Client Email</div><input className="fi" type="email" value={createForm.client_email} onChange={(event) => setCreateForm({ ...createForm, client_email: event.target.value })} /></div>
          <div className="fc"><div className="fc-label">Client Address</div><textarea className="fi" value={createForm.client_address} onChange={(event) => setCreateForm({ ...createForm, client_address: event.target.value })} /></div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedContract)}
        onClose={() => navigate('/contracts')}
        title={selectedContract ? `${selectedContract.client_name} · ${selectedContract.service}` : 'Contract'}
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => navigate('/contracts')}>Close</button>
            <button className="btn bg" type="button" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            <button className="btn bp" type="submit" form="contract-detail-form" disabled={savingDetail}>{savingDetail ? 'Saving…' : 'Save Changes'}</button>
          </>
        }
      >
        {selectedContract && (
          <>
            {detailError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{detailError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.value || '—'}</div><div className="stat-label">Contract Value</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.start_date || '—'}</div><div className="stat-label">Start Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.signed ? 'Signed' : 'Pending'}</div><div className="stat-label">Execution Status</div></div>
            </div>
            {!detailForm.signed && <button className="btn bp" type="button" style={{ marginBottom: 14 }} onClick={() => sign(selectedContract)}>Mark Signed</button>}
            <form id="contract-detail-form" onSubmit={handleUpdate}>
              <div className="fc">
                <div className="fc-label">Client</div>
                <select
                  className="fi fsel"
                  value={detailForm.client_id}
                  onChange={(event) => {
                    const client = clients.find((item) => item.id === event.target.value);
                    setDetailForm({
                      ...detailForm,
                      client_id: event.target.value,
                      client_name: client?.name || '',
                      client_email: client?.email || detailForm.client_email,
                    });
                  }}
                  required
                >
                  <option value="" disabled>Select a client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Service</div><input className="fi" value={detailForm.service} onChange={(event) => setDetailForm({ ...detailForm, service: event.target.value })} required /></div>
                <div className="fc"><div className="fc-label">Value</div><input className="fi" value={detailForm.value} onChange={(event) => setDetailForm({ ...detailForm, value: event.target.value })} /></div>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Start Date</div><input className="fi" type="date" value={detailForm.start_date} onChange={(event) => setDetailForm({ ...detailForm, start_date: event.target.value })} /></div>
                <div className="fc"><div className="fc-label">Duration</div><input className="fi" value={detailForm.duration} onChange={(event) => setDetailForm({ ...detailForm, duration: event.target.value })} /></div>
              </div>
              <div className="fc"><div className="fc-label">Client Email</div><input className="fi" type="email" value={detailForm.client_email} onChange={(event) => setDetailForm({ ...detailForm, client_email: event.target.value })} /></div>
              <div className="fc"><div className="fc-label">Client Address</div><textarea className="fi" value={detailForm.client_address} onChange={(event) => setDetailForm({ ...detailForm, client_address: event.target.value })} /></div>
            </form>

            <div style={{ marginTop: 14, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                Contract Preview
              </div>
              {detailForm.clauses.map((clause) => (
                <div key={clause.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{clause.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-s)' }}>{renderClauseBody(clause, detailForm)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
