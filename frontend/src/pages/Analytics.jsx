import React, { useEffect, useMemo, useState } from 'react';
import { analyticsAPI, contractsAPI, formsAPI, invoicesAPI, projectsAPI, proposalsAPI } from '../utils/api';
import Pill from '../components/Pill';

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function submissionSummary(data) {
  return Object.values(data || {}).filter(Boolean).slice(0, 2).join(' · ') || 'New enquiry';
}

export default function Analytics() {
  const [revenue, setRevenue] = useState({ invoices: [], byService: [], months: 6, totalPaid: 0, totalOutstanding: 0 });
  const [pipeline, setPipeline] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      analyticsAPI.revenue(6),
      analyticsAPI.pipeline(),
      invoicesAPI.list(),
      projectsAPI.list(),
      proposalsAPI.list(),
      contractsAPI.list(),
      formsAPI.submissions(),
    ])
      .then(([revenueData, pipelineData, invoiceRows, projectRows, proposalRows, contractRows, submissionRows]) => {
        setRevenue(revenueData);
        setPipeline(pipelineData);
        setInvoices(invoiceRows);
        setProjects(projectRows);
        setProposals(proposalRows);
        setContracts(contractRows);
        setSubmissions(submissionRows);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const unpaidInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status !== 'paid'),
    [invoices]
  );
  const approvedProposals = useMemo(
    () => proposals.filter((proposal) => proposal.status === 'approved'),
    [proposals]
  );
  const signedContracts = useMemo(
    () => contracts.filter((contract) => contract.signed),
    [contracts]
  );
  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === 'active'),
    [projects]
  );
  const deliveredProjects = useMemo(
    () => projects.filter((project) => project.status === 'delivered' || project.status === 'completed'),
    [projects]
  );
  const averageInvoice = useMemo(() => {
    if (!invoices.length) return 0;
    return invoices.reduce((sum, invoice) => sum + parseAmount(invoice.amount), 0) / invoices.length;
  }, [invoices]);
  const winRate = useMemo(() => {
    if (!proposals.length) return 0;
    return Math.round((signedContracts.length / proposals.length) * 100);
  }, [proposals.length, signedContracts.length]);
  const recentSubmissions = useMemo(
    () => submissions.slice(0, 5),
    [submissions]
  );

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Analytics</div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-val">{formatMoney(revenue.totalPaid)}</div>
            <div className="stat-label">Collected Revenue</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{formatMoney(revenue.totalOutstanding)}</div>
            <div className="stat-label">Outstanding Revenue</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{activeProjects.length}</div>
            <div className="stat-label">Active Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{pipeline?.enquiries ?? submissions.length}</div>
            <div className="stat-label">Total Enquiries</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Financial Health</div>
            <div style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 6 }}>Average invoice</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>{formatMoney(averageInvoice)}</div>
            <Pill status={unpaidInvoices.length ? 'unpaid' : 'paid'} label={`${unpaidInvoices.length} open invoices`} />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Conversion</div>
            <div style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 6 }}>Proposal to contract win rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>{winRate}%</div>
            <Pill status={approvedProposals.length ? 'approved' : 'draft'} label={`${approvedProposals.length} approved proposals`} />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Delivery</div>
            <div style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 6 }}>Completed delivery output</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>{deliveredProjects.length}</div>
            <Pill status={signedContracts.length ? 'signed' : 'pending'} label={`${signedContracts.length} signed contracts`} />
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="card-title">Revenue Ledger</div></div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><b>{invoice.client_name || 'Unknown client'}</b></td>
                  <td>{invoice.amount || '—'}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td><Pill status={invoice.status} /></td>
                </tr>
              ))}
              {!invoices.length && <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No invoice data yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginTop: 14 }}>
          <div className="card">
            <div className="card-h"><div className="card-title">Service Breakdown</div></div>
            <table className="tbl">
              <thead><tr><th>Service</th><th>Projects</th></tr></thead>
              <tbody>
                {revenue.byService.map((row) => (
                  <tr key={row.service}>
                    <td><b>{row.service}</b></td>
                    <td>{row.count}</td>
                  </tr>
                ))}
                {!revenue.byService.length && <tr><td colSpan="2" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No services tracked yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h"><div className="card-title">Pipeline Output</div></div>
            <table className="tbl">
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><b>Enquiries</b></td><td>{pipeline?.enquiries ?? submissions.length}</td></tr>
                <tr><td><b>Proposals Sent</b></td><td>{pipeline?.proposals_sent ?? proposals.length}</td></tr>
                <tr><td><b>Contracts Signed</b></td><td>{pipeline?.contracts_signed ?? signedContracts.length}</td></tr>
                <tr><td><b>Active Projects</b></td><td>{pipeline?.active_projects ?? activeProjects.length}</td></tr>
                <tr><td><b>Delivered Projects</b></td><td>{pipeline?.delivered ?? deliveredProjects.length}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h"><div className="card-title">Recent Enquiries</div></div>
          <table className="tbl">
            <thead><tr><th>Submitted</th><th>Summary</th></tr></thead>
            <tbody>
              {recentSubmissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{formatDate(submission.submitted_at)}</td>
                  <td>{submissionSummary(submission.data)}</td>
                </tr>
              ))}
              {!recentSubmissions.length && <tr><td colSpan="2" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No enquiries captured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
