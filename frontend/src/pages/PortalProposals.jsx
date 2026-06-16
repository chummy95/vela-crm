import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { proposalsAPI } from '../utils/api';

function toItems(value) {
  return Array.isArray(value) ? value : [];
}

export default function PortalProposals() {
  const navigate = useNavigate();
  const params = useParams();
  const routeProposalId = (params['*'] || '').split('/')[0] || '';
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    proposalsAPI.list().then(setProposals).catch((loadError) => setError(loadError.message));
  }, []);

  const selectedProposal = useMemo(
    () => proposals.find((proposal) => proposal.id === routeProposalId) || null,
    [proposals, routeProposalId]
  );

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Proposals</div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Shared Proposals</div></div>
          <table className="tbl">
            <thead><tr><th>Service</th><th>Value</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id} onClick={() => navigate(`/portal/proposals/${proposal.id}`)}>
                  <td><b>{proposal.service || '—'}</b></td>
                  <td>{proposal.value || '—'}</td>
                  <td>{proposal.date || '—'}</td>
                  <td><Pill status={proposal.status} /></td>
                </tr>
              ))}
              {!proposals.length && <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No proposals are available yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedProposal)}
        onClose={() => navigate('/portal/proposals')}
        title={selectedProposal ? selectedProposal.service : 'Proposal'}
        footer={<button className="btn bp" type="button" onClick={() => navigate('/portal/proposals')}>Close</button>}
      >
        {selectedProposal && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedProposal.value || '—'}</div><div className="stat-label">Quoted Value</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedProposal.date || '—'}</div><div className="stat-label">Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedProposal.status}</div><div className="stat-label">Status</div></div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Overview</div>
              <div style={{ color: 'var(--text-s)', fontSize: 13, marginBottom: 14 }}>{selectedProposal.overview || selectedProposal.intro || 'No summary has been added yet.'}</div>

              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Deliverables</div>
              {toItems(selectedProposal.deliverables).map((item) => (
                <div key={item} style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 6 }}>• {item}</div>
              ))}
              {!toItems(selectedProposal.deliverables).length && <div style={{ color: 'var(--text-s)', fontSize: 13, marginBottom: 14 }}>No deliverables listed.</div>}

              <div style={{ fontWeight: 700, color: 'var(--navy)', margin: '14px 0 8px' }}>Timeline</div>
              {toItems(selectedProposal.timeline).map((item) => (
                <div key={item} style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 6 }}>• {item}</div>
              ))}
              {!toItems(selectedProposal.timeline).length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No timeline has been attached yet.</div>}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
