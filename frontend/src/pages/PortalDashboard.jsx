import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Pill from '../components/Pill';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, contractsAPI, eventsAPI, invoicesAPI, messagesAPI, projectsAPI, proposalsAPI } from '../utils/api';
import { STAGES } from '../utils/constants';

function parseAmount(value) {
  const numeric = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function stageLabel(project) {
  const service = String(project?.service || '').toLowerCase();
  const labels = service.includes('pack') ? STAGES.packaging : service.includes('web') ? STAGES.web : STAGES.brand;
  const index = Number(project?.stage || 0);
  return labels[index] || `Stage ${index + 1}`;
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      clientsAPI.list(),
      projectsAPI.list(),
      invoicesAPI.list(),
      proposalsAPI.list(),
      contractsAPI.list(),
      eventsAPI.list(),
      messagesAPI.thread(user?.client_id),
    ])
      .then(([clientRows, projectRows, invoiceRows, proposalRows, contractRows, eventRows, messageRows]) => {
        setClient(clientRows[0] || null);
        setProjects(projectRows);
        setInvoices(invoiceRows);
        setProposals(proposalRows);
        setContracts(contractRows);
        setEvents(eventRows);
        setMessages(messageRows);
        setError('');
      })
      .catch((loadError) => setError(loadError.message));
  }, [user?.client_id]);

  const openInvoices = useMemo(() => invoices.filter((invoice) => invoice.status !== 'paid'), [invoices]);
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'active'), [projects]);
  const signedContracts = useMemo(() => contracts.filter((contract) => contract.signed), [contracts]);
  const totalOutstanding = useMemo(() => openInvoices.reduce((sum, invoice) => sum + parseAmount(invoice.amount), 0), [openInvoices]);

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Client Portal</div>
        <div className="tb-r">
          <button className="btn bg bsm" onClick={() => navigate('/portal/projects')}>Projects</button>
          <button className="btn bg bsm" onClick={() => navigate('/portal/invoices')}>Invoices</button>
          <button className="btn bp bsm" onClick={() => navigate('/portal/messages')}>Messages</button>
        </div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
            {client?.name || user?.client_name || 'Your Workspace'}
          </div>
          <div style={{ color: 'var(--text-s)', fontSize: 13 }}>
            Review active work, document progress, invoices, and studio updates in one place.
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card" onClick={() => navigate('/portal/projects')}>
            <div className="stat-val">{activeProjects.length}</div>
            <div className="stat-label">Active Projects</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/portal/invoices')}>
            <div className="stat-val">{openInvoices.length}</div>
            <div className="stat-label">Open Invoices</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/portal/contracts')}>
            <div className="stat-val">{signedContracts.length}</div>
            <div className="stat-label">Signed Contracts</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/portal/schedule')}>
            <div className="stat-val">{events.length}</div>
            <div className="stat-label">Upcoming Events</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <div className="card">
            <div className="card-h">
              <div className="card-title">Project Snapshot</div>
              <button className="btn bg bsm" onClick={() => navigate('/portal/projects')}>View All</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Service</th><th>Current Output</th><th>Status</th></tr></thead>
              <tbody>
                {projects.slice(0, 4).map((project) => (
                  <tr key={project.id} onClick={() => navigate(`/portal/projects/${project.id}`)}>
                    <td><b>{project.service || '—'}</b></td>
                    <td>{stageLabel(project)}</td>
                    <td><Pill status={project.status} /></td>
                  </tr>
                ))}
                {!projects.length && <tr><td colSpan="3" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No projects have been shared yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Billing Snapshot</div>
            <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{formatMoney(totalOutstanding)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-s)' }}>Total outstanding</div>
            </div>
            {openInvoices.slice(0, 3).map((invoice) => (
              <div key={invoice.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                  <b style={{ color: 'var(--navy)' }}>{invoice.amount || '—'}</b>
                  <Pill status={invoice.status} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-s)' }}>Due {formatDate(invoice.due_date)} · {invoice.description || 'Studio invoice'}</div>
              </div>
            ))}
            {!openInvoices.length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No open invoices right now.</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginTop: 14 }}>
          <div className="card">
            <div className="card-h">
              <div className="card-title">Documents</div>
              <button className="btn bg bsm" onClick={() => navigate('/portal/proposals')}>Open</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Type</th><th>Service</th><th>Status</th></tr></thead>
              <tbody>
                {proposals.slice(0, 2).map((proposal) => (
                  <tr key={proposal.id} onClick={() => navigate(`/portal/proposals/${proposal.id}`)}>
                    <td><b>Proposal</b></td>
                    <td>{proposal.service || '—'}</td>
                    <td><Pill status={proposal.status} /></td>
                  </tr>
                ))}
                {contracts.slice(0, 2).map((contract) => (
                  <tr key={contract.id} onClick={() => navigate(`/portal/contracts/${contract.id}`)}>
                    <td><b>Contract</b></td>
                    <td>{contract.service || '—'}</td>
                    <td><Pill status={contract.signed ? 'signed' : 'pending'} label={contract.signed ? 'Signed' : 'Pending'} /></td>
                  </tr>
                ))}
                {!proposals.length && !contracts.length && <tr><td colSpan="3" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No documents have been shared yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="card-title">Latest Messages</div>
              <button className="btn bg bsm" onClick={() => navigate('/portal/messages')}>Open Thread</button>
            </div>
            <div style={{ padding: 18 }}>
              {messages.slice(-4).map((message) => (
                <div key={message.id} style={{ marginBottom: 10, textAlign: message.outbound ? 'left' : 'right' }}>
                  <div style={{ display: 'inline-block', padding: '10px 12px', borderRadius: 10, background: message.outbound ? 'var(--navy-pale)' : 'var(--navy)', color: message.outbound ? 'var(--text)' : '#fff', maxWidth: '85%' }}>
                    <div style={{ fontSize: 13 }}>{message.text}</div>
                    <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.8 }}>{formatDate(message.sent_at)}</div>
                  </div>
                </div>
              ))}
              {!messages.length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No conversation history yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
