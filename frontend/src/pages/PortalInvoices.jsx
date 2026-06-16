import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { invoicesAPI, projectsAPI } from '../utils/api';

export default function PortalInvoices() {
  const navigate = useNavigate();
  const params = useParams();
  const routeInvoiceId = (params['*'] || '').split('/')[0] || '';
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([invoicesAPI.list(), projectsAPI.list()])
      .then(([invoiceRows, projectRows]) => {
        setInvoices(invoiceRows);
        setProjects(projectRows);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === routeInvoiceId) || null,
    [invoices, routeInvoiceId]
  );

  const linkedProject = projects.find((project) => project.id === selectedInvoice?.project_id);

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Invoices</div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h">
            <div className="card-title">Billing</div>
            <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{invoices.length} total</div>
          </div>
          <table className="tbl">
            <thead><tr><th>Reference</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} onClick={() => navigate(`/portal/invoices/${invoice.id}`)}>
                  <td><b>{invoice.id.slice(0, 8)}</b></td>
                  <td>{invoice.amount || '—'}</td>
                  <td>{invoice.due_date || '—'}</td>
                  <td><Pill status={invoice.status} /></td>
                </tr>
              ))}
              {!invoices.length && <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No invoices have been shared yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedInvoice)}
        onClose={() => navigate('/portal/invoices')}
        title={selectedInvoice ? `Invoice ${selectedInvoice.id.slice(0, 8)}` : 'Invoice'}
        footer={<button className="btn bp" type="button" onClick={() => navigate('/portal/invoices')}>Close</button>}
      >
        {selectedInvoice && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedInvoice.amount || '—'}</div><div className="stat-label">Amount</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedInvoice.due_date || '—'}</div><div className="stat-label">Due Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedInvoice.status === 'paid' ? 'Paid' : 'Open'}</div><div className="stat-label">Status</div></div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-h">
                <div className="card-title">Invoice Notes</div>
                <Pill status={selectedInvoice.status} />
              </div>
              <div style={{ padding: 18, fontSize: 13, color: 'var(--text-s)' }}>
                {selectedInvoice.description || 'No additional billing note has been attached yet.'}
              </div>
            </div>

            {linkedProject && (
              <div className="card">
                <div className="card-h"><div className="card-title">Linked Project</div></div>
                <div style={{ padding: 18 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{linkedProject.service}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-s)' }}>Stage {Number(linkedProject.stage || 0) + 1} · {linkedProject.status}</div>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
