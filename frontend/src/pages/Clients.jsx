import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { clientsAPI, contractsAPI, invoicesAPI, projectsAPI, proposalsAPI } from '../utils/api';

const INDUSTRIES = ['Beauty & Wellness', 'Fashion & Lifestyle', 'Hospitality', 'Interiors', 'Other'];

function blankClient() {
  return { name: '', contact: '', email: '', location: '', industry: 'Beauty & Wellness', color: '#1B2B4B' };
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [createForm, setCreateForm] = useState(blankClient());
  const [detailForm, setDetailForm] = useState(blankClient());
  const [pageError, setPageError] = useState('');
  const [createError, setCreateError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [clientRows, projectRows, invoiceRows, proposalRows, contractRows] = await Promise.all([
      clientsAPI.list(),
      projectsAPI.list(),
      invoicesAPI.list(),
      proposalsAPI.list(),
      contractsAPI.list(),
    ]);
    setClients(clientRows);
    setProjects(projectRows);
    setInvoices(invoiceRows);
    setProposals(proposalRows);
    setContracts(contractRows);
  }

  useEffect(() => {
    load().catch((err) => setPageError(err.message));
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (!selectedClient) return;
    setDetailForm({
      name: selectedClient.name || '',
      contact: selectedClient.contact || '',
      email: selectedClient.email || '',
      location: selectedClient.location || '',
      industry: selectedClient.industry || 'Other',
      color: selectedClient.color || '#1B2B4B',
    });
    setDetailError('');
  }, [selectedClient]);

  const selectedSummary = useMemo(() => {
    if (!selectedClient) return null;
    return {
      projects: projects.filter((project) => project.client_id === selectedClient.id).length,
      invoices: invoices.filter((invoice) => invoice.client_id === selectedClient.id).length,
      proposals: proposals.filter((proposal) => proposal.client_id === selectedClient.id).length,
      contracts: contracts.filter((contract) => contract.client_id === selectedClient.id).length,
    };
  }, [contracts, invoices, projects, proposals, selectedClient]);

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await clientsAPI.create(createForm);
      setClients((prev) => [created, ...prev]);
      setCreateForm(blankClient());
      setCreateOpen(false);
      setSelectedClientId(created.id);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedClient) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await clientsAPI.update(selectedClient.id, detailForm);
      setClients((prev) => prev.map((client) => (client.id === updated.id ? updated : client)));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleDelete() {
    if (!selectedClient) return;
    setDeleting(true);
    setDetailError('');
    try {
      await clientsAPI.remove(selectedClient.id);
      setClients((prev) => prev.filter((client) => client.id !== selectedClient.id));
      setSelectedClientId('');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Clients</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => { setCreateError(''); setCreateForm(blankClient()); setCreateOpen(true); }}>+ Add Client</button></div>
      </div>
      <div className="content">
        {pageError && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{pageError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {clients.map((client) => (
            <button
              key={client.id}
              className="card"
              type="button"
              style={{ cursor: 'pointer', textAlign: 'left', borderColor: selectedClientId === client.id ? 'var(--navy)' : 'var(--border)' }}
              onClick={() => setSelectedClientId(client.id)}
            >
              <div style={{ height: 72, background: client.color || 'var(--navy)', padding: '16px 18px' }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700, color: '#fff' }}>{client.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{client.industry} · {client.location || 'No location yet'}</div>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{client.contact || 'No contact added'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-s)', marginTop: 2 }}>{client.email || 'No email added'}</div>
              </div>
            </button>
          ))}
          {clients.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-s)', padding: 40 }}>No clients yet.</div>}
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Client"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="client-create-form" disabled={savingCreate}>
              {savingCreate ? 'Saving…' : 'Add Client'}
            </button>
          </>
        }
      >
        <form id="client-create-form" onSubmit={handleCreate}>
          {createError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{createError}</div>}
          <div className="fc"><div className="fc-label">Brand Name</div><input className="fi" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} required /></div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Contact Name</div><input className="fi" value={createForm.contact} onChange={(event) => setCreateForm({ ...createForm, contact: event.target.value })} /></div>
            <div className="fc"><div className="fc-label">Email</div><input className="fi" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Location</div><input className="fi" value={createForm.location} onChange={(event) => setCreateForm({ ...createForm, location: event.target.value })} /></div>
            <div className="fc"><div className="fc-label">Industry</div>
              <select className="fi fsel" value={createForm.industry} onChange={(event) => setCreateForm({ ...createForm, industry: event.target.value })}>
                {INDUSTRIES.map((industry) => <option key={industry}>{industry}</option>)}
              </select>
            </div>
          </div>
          <div className="fc"><div className="fc-label">Brand Colour</div><input type="color" value={createForm.color} onChange={(event) => setCreateForm({ ...createForm, color: event.target.value })} style={{ width: 40, height: 32, borderRadius: 6, border: '1.5px solid var(--border)', cursor: 'pointer' }} /></div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedClient)}
        onClose={() => setSelectedClientId('')}
        title={selectedClient ? selectedClient.name : 'Client'}
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setSelectedClientId('')}>Close</button>
            <button className="btn bg" type="button" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            <button className="btn bp" type="submit" form="client-detail-form" disabled={savingDetail}>{savingDetail ? 'Saving…' : 'Save Changes'}</button>
          </>
        }
      >
        {selectedClient && (
          <>
            {detailError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{detailError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedSummary?.projects || 0}</div><div className="stat-label">Projects</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedSummary?.invoices || 0}</div><div className="stat-label">Invoices</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedSummary?.proposals || 0}</div><div className="stat-label">Proposals</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedSummary?.contracts || 0}</div><div className="stat-label">Contracts</div></div>
            </div>
            <form id="client-detail-form" onSubmit={handleUpdate}>
              <div className="fc"><div className="fc-label">Brand Name</div><input className="fi" value={detailForm.name} onChange={(event) => setDetailForm({ ...detailForm, name: event.target.value })} required /></div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Contact Name</div><input className="fi" value={detailForm.contact} onChange={(event) => setDetailForm({ ...detailForm, contact: event.target.value })} /></div>
                <div className="fc"><div className="fc-label">Email</div><input className="fi" type="email" value={detailForm.email} onChange={(event) => setDetailForm({ ...detailForm, email: event.target.value })} /></div>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Location</div><input className="fi" value={detailForm.location} onChange={(event) => setDetailForm({ ...detailForm, location: event.target.value })} /></div>
                <div className="fc"><div className="fc-label">Industry</div>
                  <select className="fi fsel" value={detailForm.industry} onChange={(event) => setDetailForm({ ...detailForm, industry: event.target.value })}>
                    {INDUSTRIES.map((industry) => <option key={industry}>{industry}</option>)}
                  </select>
                </div>
              </div>
              <div className="fc"><div className="fc-label">Brand Colour</div><input type="color" value={detailForm.color} onChange={(event) => setDetailForm({ ...detailForm, color: event.target.value })} style={{ width: 40, height: 32, borderRadius: 6, border: '1.5px solid var(--border)', cursor: 'pointer' }} /></div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
