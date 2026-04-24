import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../utils/api';

export default function Analytics() {
  const [revenue, setRevenue] = useState({ invoices: [], byService: [], months: 6 });
  const [pipeline, setPipeline] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([analyticsAPI.revenue(6), analyticsAPI.pipeline()])
      .then(([revenueData, pipelineData]) => {
        setRevenue(revenueData);
        setPipeline(pipelineData);
      })
      .catch((err) => setError(err.message));
  }, []);

  const paidTotal = revenue.invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Analytics</div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-val">{pipeline?.enquiries ?? 0}</div><div className="stat-label">Enquiries</div></div>
          <div className="stat-card"><div className="stat-val">{pipeline?.proposals_sent ?? 0}</div><div className="stat-label">Proposals</div></div>
          <div className="stat-card"><div className="stat-val">{pipeline?.contracts_signed ?? 0}</div><div className="stat-label">Signed Contracts</div></div>
          <div className="stat-card"><div className="stat-val">{paidTotal}</div><div className="stat-label">Paid Revenue</div></div>
        </div>

        <div className="card">
          <div className="card-h"><div className="card-title">Services Breakdown</div></div>
          <table className="tbl">
            <thead><tr><th>Service</th><th>Projects</th></tr></thead>
            <tbody>
              {revenue.byService.map((row) => (
                <tr key={row.service}>
                  <td><b>{row.service}</b></td>
                  <td>{row.count}</td>
                </tr>
              ))}
              {!revenue.byService.length && <tr><td colSpan="2" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No analytics yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
