import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { contractsAPI } from '../utils/api';

function renderClauseBody(clause, contract) {
  return String(clause.body || '')
    .replace('__SERVICE__', contract.service || 'the agreed service')
    .replace('__VALUE__', contract.value || 'the agreed value');
}

export default function PortalContracts() {
  const navigate = useNavigate();
  const params = useParams();
  const routeContractId = (params['*'] || '').split('/')[0] || '';
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    contractsAPI.list().then(setContracts).catch((loadError) => setError(loadError.message));
  }, []);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === routeContractId) || null,
    [contracts, routeContractId]
  );

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Contracts</div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Agreements</div></div>
          <table className="tbl">
            <thead><tr><th>Service</th><th>Value</th><th>Start Date</th><th>Status</th></tr></thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id} onClick={() => navigate(`/portal/contracts/${contract.id}`)}>
                  <td><b>{contract.service || '—'}</b></td>
                  <td>{contract.value || '—'}</td>
                  <td>{contract.start_date || '—'}</td>
                  <td><Pill status={contract.signed ? 'signed' : 'pending'} label={contract.signed ? 'Signed' : 'Pending'} /></td>
                </tr>
              ))}
              {!contracts.length && <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No contracts have been shared yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedContract)}
        onClose={() => navigate('/portal/contracts')}
        title={selectedContract ? selectedContract.service : 'Contract'}
        footer={<button className="btn bp" type="button" onClick={() => navigate('/portal/contracts')}>Close</button>}
      >
        {selectedContract && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedContract.value || '—'}</div><div className="stat-label">Value</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedContract.start_date || '—'}</div><div className="stat-label">Start Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedContract.signed ? 'Signed' : 'Pending'}</div><div className="stat-label">Status</div></div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}><Pill status={selectedContract.signed ? 'signed' : 'pending'} label={selectedContract.signed ? 'Signed contract' : 'Awaiting signature'} /></div>
              {(selectedContract.clauses || []).map((clause) => (
                <div key={clause.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{clause.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-s)' }}>{renderClauseBody(clause, selectedContract)}</div>
                </div>
              ))}
              {!(selectedContract.clauses || []).length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No contract clauses have been attached yet.</div>}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
