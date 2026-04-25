import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { contractsAPI, formsAPI, invoicesAPI, projectsAPI, proposalsAPI, eventsAPI } from '../utils/api';
import { STAGES } from '../utils/constants';
import Pill from '../components/Pill';

function parseAmount(value) {
  const numeric = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function serviceStageLabels(service) {
  const normalized = String(service || '').toLowerCase();
  if (normalized.includes('pack')) return STAGES.packaging;
  if (normalized.includes('web')) return STAGES.web;
  return STAGES.brand;
}

function stageLabel(project) {
  const labels = serviceStageLabels(project?.service);
  const index = Number(project?.stage || 0);
  return labels[index] || `Stage ${index + 1}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function submissionHeadline(data) {
  const values = Object.values(data || {}).filter(Boolean);
  return values.slice(0, 2).join(' · ') || 'New enquiry received';
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [events, setEvents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      projectsAPI.list(),
      invoicesAPI.list(),
      proposalsAPI.list(),
      contractsAPI.list(),
      eventsAPI.list(),
      formsAPI.submissions(),
    ])
      .then(([projectRows, invoiceRows, proposalRows, contractRows, eventRows, submissionRows]) => {
        setProjects(projectRows);
        setInvoices(invoiceRows);
        setProposals(proposalRows);
        setContracts(contractRows);
        setEvents(eventRows);
        setSubmissions(submissionRows);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const outstandingInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status !== 'paid'),
    [invoices]
  );
  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === 'active'),
    [projects]
  );
  const approvedProposals = useMemo(
    () => proposals.filter((proposal) => proposal.status === 'approved'),
    [proposals]
  );
  const signedContracts = useMemo(
    () => contracts.filter((contract) => contract.signed),
    [contracts]
  );
  const outstandingAmount = useMemo(
    () => outstandingInvoices.reduce((sum, invoice) => sum + parseAmount(invoice.amount), 0),
    [outstandingInvoices]
  );
  const paidAmount = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + parseAmount(invoice.amount), 0),
    [invoices]
  );
  const upcomingEvents = useMemo(
    () => events.slice(0, 5),
    [events]
  );
  const latestSubmissions = useMemo(
    () => submissions.slice(0, 5),
    [submissions]
  );
  const recentProjects = useMemo(
    () => activeProjects.slice(0, 5),
    [activeProjects]
  );
  const recentInvoices = useMemo(
    () => outstandingInvoices.slice(0, 5),
    [outstandingInvoices]
  );

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Studio Dashboard</div>
        <div className="tb-r">
          <button className="btn bg bsm" onClick={() => navigate('/forms')}>View Intake</button>
          <button className="btn bg bsm" onClick={() => navigate('/projects')}>Projects</button>
          <button className="btn bp bsm" onClick={() => navigate('/invoices')}>Invoices</button>
        </div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
            {user?.studio_name || user?.name || 'Your studio'}
          </div>
          <div style={{ color: 'var(--text-s)', fontSize: 13 }}>
            Track live projects, open invoices, and incoming leads from one place.
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card" onClick={() => navigate('/invoices')}>
            <div className="stat-val">{outstandingInvoices.length}</div>
            <div className="stat-label">Open Invoices</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/projects')}>
            <div className="stat-val">{activeProjects.length}</div>
            <div className="stat-label">Active Projects</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/proposals')}>
            <div className="stat-val">{approvedProposals.length}</div>
            <div className="stat-label">Approved Proposals</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/forms')}>
            <div className="stat-val">{submissions.length}</div>
            <div className="stat-label">Total Leads</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Cash Snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{formatMoney(outstandingAmount, user?.currency || 'GBP')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-s)' }}>Outstanding revenue</div>
              </div>
              <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{formatMoney(paidAmount, user?.currency || 'GBP')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-s)' }}>Collected revenue</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Pipeline Snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{proposals.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-s)' }}>Proposals</div>
              </div>
              <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{signedContracts.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-s)' }}>Signed Contracts</div>
              </div>
              <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{events.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-s)' }}>Scheduled Events</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div className="card-title">Active Projects</div>
            <button className="btn bg bsm" onClick={() => navigate('/projects')}>View All</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Service</th><th>Stage Output</th><th>Status</th></tr></thead>
            <tbody>
              {recentProjects.map((project) => (
                <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)}>
                  <td><b>{project.client_name || 'Unknown client'}</b></td>
                  <td>{project.service || '—'}</td>
                  <td>{stageLabel(project)}</td>
                  <td><Pill status={project.status} /></td>
                </tr>
              ))}
              {recentProjects.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ color: 'var(--text-s)', textAlign: 'center', padding: '24px' }}>
                    No projects yet. Add a client, then create your first project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <div className="card">
            <div className="card-h">
              <div className="card-title">Open Invoices</div>
              <button className="btn bg bsm" onClick={() => navigate('/invoices')}>Billing</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Client</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} onClick={() => navigate(`/invoices/${invoice.id}`)}>
                    <td><b>{invoice.client_name || 'Unknown client'}</b></td>
                    <td>{invoice.amount || '—'}</td>
                    <td>{formatDate(invoice.due_date)}</td>
                    <td><Pill status={invoice.status} /></td>
                  </tr>
                ))}
                {recentInvoices.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ color: 'var(--text-s)', textAlign: 'center', padding: '24px' }}>
                      No unpaid invoices right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="card-title">Upcoming Schedule</div>
              <button className="btn bg bsm" onClick={() => navigate('/scheduler')}>Open Calendar</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Event</th><th>Client</th><th>Date</th><th>Time</th></tr></thead>
              <tbody>
                {upcomingEvents.map((event) => (
                  <tr key={event.id} onClick={() => navigate('/scheduler')}>
                    <td><b>{event.title}</b></td>
                    <td>{event.client_name || 'Internal'}</td>
                    <td>{formatDate(event.date)}</td>
                    <td>{event.time || '—'}</td>
                  </tr>
                ))}
                {upcomingEvents.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ color: 'var(--text-s)', textAlign: 'center', padding: '24px' }}>
                      No upcoming events scheduled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <div className="card-title">Recent Enquiries</div>
            <button className="btn bg bsm" onClick={() => navigate('/forms')}>Open Inbox</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Submitted</th><th>Lead Summary</th></tr></thead>
            <tbody>
              {latestSubmissions.map((submission) => (
                <tr key={submission.id} onClick={() => navigate('/forms')}>
                  <td>{formatDate(submission.submitted_at)}</td>
                  <td>{submissionHeadline(submission.data)}</td>
                </tr>
              ))}
              {latestSubmissions.length === 0 && (
                <tr>
                  <td colSpan="2" style={{ color: 'var(--text-s)', textAlign: 'center', padding: '24px' }}>
                    No enquiries yet. Share your intake form to start receiving leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
