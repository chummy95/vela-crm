import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, proposalsAPI } from '../utils/api';

function blankProposal(clientId = '', clientName = '') {
  return {
    client_id: clientId,
    client_name: clientName,
    service: '',
    date: '',
    value: '',
    intro: '',
    overview: '',
    packages: '',
    deliverables: '',
    timeline: '',
    terms: '',
    process: '',
    status: 'draft',
  };
}

function toLines(value) {
  return Array.isArray(value) ? value.join('\n') : String(value || '');
}

function toItems(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Proposals() {
  const navigate = useNavigate();
  const params = useParams();
  const routeProposalId = (params['*'] || '').split('/')[0] || '';

  const [proposals, setProposals] = useState([]);
  const [clients, setClients] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankProposal());
  const [detailForm, setDetailForm] = useState(blankProposal());
  const [pageError, setPageError] = useState('');
  const [createError, setCreateError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [proposalRows, clientRows] = await Promise.all([proposalsAPI.list(), clientsAPI.list()]);
    setProposals(proposalRows);
    setClients(clientRows);
    if (clientRows[0]) {
      setCreateForm((current) => ({
        ...current,
        client_id: current.client_id || clientRows[0].id,
        client_name: current.client_name || clientRows[0].name,
      }));
    }
  }

  useEffect(() => {
    load().catch((err) => setPageError(err.message));
  }, []);

  const selectedProposal = useMemo(
    () => proposals.find((proposal) => proposal.id === routeProposalId) || null,
    [proposals, routeProposalId]
  );

  useEffect(() => {
    if (!selectedProposal) return;
    setDetailForm({
      client_id: selectedProposal.client_id || '',
      client_name: selectedProposal.client_name || '',
      service: selectedProposal.service || '',
      date: selectedProposal.date || '',
      value: selectedProposal.value || '',
      intro: selectedProposal.intro || '',
      overview: selectedProposal.overview || '',
      packages: toLines(selectedProposal.packages),
      deliverables: toLines(selectedProposal.deliverables),
      timeline: toLines(selectedProposal.timeline),
      terms: selectedProposal.terms || '',
      process: selectedProposal.process || '',
      status: selectedProposal.status || 'draft',
    });
    setDetailError('');
  }, [selectedProposal]);

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const payload = {
        ...createForm,
        packages: toItems(createForm.packages),
        deliverables: toItems(createForm.deliverables),
        timeline: toItems(createForm.timeline),
      };
      const created = await proposalsAPI.create(payload);
      setProposals((prev) => [created, ...prev]);
      setCreateOpen(false);
      navigate(`/proposals/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedProposal) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await proposalsAPI.update(selectedProposal.id, {
        ...detailForm,
        packages: toItems(detailForm.packages),
        deliverables: toItems(detailForm.deliverables),
        timeline: toItems(detailForm.timeline),
      });
      setProposals((prev) => prev.map((proposal) => (proposal.id === updated.id ? updated : proposal)));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingDetail(false);
    }
  }

  async function setStatus(proposal, status) {
    try {
      const updated = await proposalsAPI.update(proposal.id, { ...proposal, status });
      setProposals((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedProposal?.id === proposal.id) {
        setDetailForm((current) => ({ ...current, status }));
      }
    } catch (err) {
      setDetailError(err.message);
      setPageError(err.message);
    }
  }

  async function handleDelete() {
    if (!selectedProposal) return;
    setDeleting(true);
    setDetailError('');
    try {
      await proposalsAPI.remove(selectedProposal.id);
      setProposals((prev) => prev.filter((proposal) => proposal.id !== selectedProposal.id));
      navigate('/proposals');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const previewPackages = toItems(detailForm.packages);
  const previewDeliverables = toItems(detailForm.deliverables);
  const previewTimeline = toItems(detailForm.timeline);

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Proposals</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => { setCreateError(''); setCreateOpen(true); }}>+ New Proposal</button></div>
      </div>
      <div className="content">
        {pageError && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{pageError}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Proposal Pipeline</div></div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Service</th><th>Value</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id} onClick={() => navigate(`/proposals/${proposal.id}`)}>
                  <td><b>{proposal.client_name || 'No client linked'}</b></td>
                  <td>{proposal.service || '—'}</td>
                  <td>{proposal.value || '—'}</td>
                  <td>{proposal.date || '—'}</td>
                  <td><Pill status={proposal.status} /></td>
                  <td>
                    <button
                      className="btn bg bxs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setStatus(proposal, proposal.status === 'approved' ? 'sent' : 'approved');
                      }}
                    >
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Proposal"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="proposal-create-form" disabled={savingCreate}>{savingCreate ? 'Saving…' : 'Save Proposal'}</button>
          </>
        }
      >
        <form id="proposal-create-form" onSubmit={handleCreate}>
          {createError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{createError}</div>}
          <div className="fc">
            <div className="fc-label">Client</div>
            <select
              className="fi fsel"
              value={createForm.client_id}
              onChange={(event) => {
                const client = clients.find((item) => item.id === event.target.value);
                setCreateForm({ ...createForm, client_id: event.target.value, client_name: client?.name || '' });
              }}
            >
              <option value="">No linked client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Service</div><input className="fi" value={createForm.service} onChange={(event) => setCreateForm({ ...createForm, service: event.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Value</div><input className="fi" value={createForm.value} onChange={(event) => setCreateForm({ ...createForm, value: event.target.value })} /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Date</div><input className="fi" type="date" value={createForm.date} onChange={(event) => setCreateForm({ ...createForm, date: event.target.value })} /></div>
            <div className="fc"><div className="fc-label">Status</div>
              <select className="fi fsel" value={createForm.status} onChange={(event) => setCreateForm({ ...createForm, status: event.target.value })}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="approved">Approved</option>
              </select>
            </div>
          </div>
          <div className="fc"><div className="fc-label">Intro</div><textarea className="fi" value={createForm.intro} onChange={(event) => setCreateForm({ ...createForm, intro: event.target.value })} /></div>
          <div className="fc"><div className="fc-label">Overview</div><textarea className="fi" value={createForm.overview} onChange={(event) => setCreateForm({ ...createForm, overview: event.target.value })} /></div>
          <div className="fc"><div className="fc-label">Packages (one per line)</div><textarea className="fi" value={createForm.packages} onChange={(event) => setCreateForm({ ...createForm, packages: event.target.value })} /></div>
          <div className="fc"><div className="fc-label">Deliverables (one per line)</div><textarea className="fi" value={createForm.deliverables} onChange={(event) => setCreateForm({ ...createForm, deliverables: event.target.value })} /></div>
          <div className="fc"><div className="fc-label">Timeline (one per line)</div><textarea className="fi" value={createForm.timeline} onChange={(event) => setCreateForm({ ...createForm, timeline: event.target.value })} /></div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedProposal)}
        onClose={() => navigate('/proposals')}
        title={selectedProposal ? `${selectedProposal.client_name || 'Proposal'} · ${selectedProposal.service}` : 'Proposal'}
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => navigate('/proposals')}>Close</button>
            <button className="btn bg" type="button" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            <button className="btn bp" type="submit" form="proposal-detail-form" disabled={savingDetail}>{savingDetail ? 'Saving…' : 'Save Changes'}</button>
          </>
        }
      >
        {selectedProposal && (
          <>
            {detailError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{detailError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.value || '—'}</div><div className="stat-label">Quoted Value</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.date || '—'}</div><div className="stat-label">Proposal Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.status}</div><div className="stat-label">Current Status</div></div>
            </div>

            <form id="proposal-detail-form" onSubmit={handleUpdate}>
              <div className="fc">
                <div className="fc-label">Client</div>
                <select
                  className="fi fsel"
                  value={detailForm.client_id}
                  onChange={(event) => {
                    const client = clients.find((item) => item.id === event.target.value);
                    setDetailForm({ ...detailForm, client_id: event.target.value, client_name: client?.name || '' });
                  }}
                >
                  <option value="">No linked client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Service</div><input className="fi" value={detailForm.service} onChange={(event) => setDetailForm({ ...detailForm, service: event.target.value })} required /></div>
                <div className="fc"><div className="fc-label">Value</div><input className="fi" value={detailForm.value} onChange={(event) => setDetailForm({ ...detailForm, value: event.target.value })} /></div>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Date</div><input className="fi" type="date" value={detailForm.date} onChange={(event) => setDetailForm({ ...detailForm, date: event.target.value })} /></div>
                <div className="fc"><div className="fc-label">Status</div>
                  <select className="fi fsel" value={detailForm.status} onChange={(event) => setDetailForm({ ...detailForm, status: event.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>
              <div className="fc"><div className="fc-label">Intro</div><textarea className="fi" value={detailForm.intro} onChange={(event) => setDetailForm({ ...detailForm, intro: event.target.value })} /></div>
              <div className="fc"><div className="fc-label">Overview</div><textarea className="fi" value={detailForm.overview} onChange={(event) => setDetailForm({ ...detailForm, overview: event.target.value })} /></div>
              <div className="fc"><div className="fc-label">Packages (one per line)</div><textarea className="fi" value={detailForm.packages} onChange={(event) => setDetailForm({ ...detailForm, packages: event.target.value })} /></div>
              <div className="fc"><div className="fc-label">Deliverables (one per line)</div><textarea className="fi" value={detailForm.deliverables} onChange={(event) => setDetailForm({ ...detailForm, deliverables: event.target.value })} /></div>
              <div className="fc"><div className="fc-label">Timeline (one per line)</div><textarea className="fi" value={detailForm.timeline} onChange={(event) => setDetailForm({ ...detailForm, timeline: event.target.value })} /></div>
              <div className="fc"><div className="fc-label">Process</div><textarea className="fi" value={detailForm.process} onChange={(event) => setDetailForm({ ...detailForm, process: event.target.value })} /></div>
              <div className="fc"><div className="fc-label">Terms</div><textarea className="fi" value={detailForm.terms} onChange={(event) => setDetailForm({ ...detailForm, terms: event.target.value })} /></div>
            </form>

            <div style={{ marginTop: 14, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                Proposal Preview
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 10 }}>
                {detailForm.client_name || 'Client'} · {detailForm.service || 'Service'} · {detailForm.value || 'Quote pending'}
              </div>
              {detailForm.intro && <p style={{ marginBottom: 10 }}>{detailForm.intro}</p>}
              {detailForm.overview && <p style={{ marginBottom: 12, color: 'var(--text-s)' }}>{detailForm.overview}</p>}
              {!!previewPackages.length && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Packages</div>
                  {previewPackages.map((item) => <div key={item} style={{ fontSize: 13, marginBottom: 4 }}>• {item}</div>)}
                </div>
              )}
              {!!previewDeliverables.length && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Deliverables</div>
                  {previewDeliverables.map((item) => <div key={item} style={{ fontSize: 13, marginBottom: 4 }}>• {item}</div>)}
                </div>
              )}
              {!!previewTimeline.length && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Timeline</div>
                  {previewTimeline.map((item) => <div key={item} style={{ fontSize: 13, marginBottom: 4 }}>• {item}</div>)}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
