import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { invoicesAPI, projectsAPI } from '../utils/api';
import { formatDate, formatMoney, isOverdue, parseAmount, relativeDay } from '../utils/format';

export default function PortalInvoices() {
  const navigate = useNavigate();
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([invoicesAPI.list(), projectsAPI.list()])
      .then(([rows, projectRows]) => { setInvoices(rows); setProjects(projectRows); })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const selected = useMemo(() => invoices.find((i) => i.id === routeId) || null, [invoices, routeId]);
  const linked = projects.find((p) => p.id === selected?.project_id);
  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const rows = [...invoices].sort((a, b) => (a.status === 'paid') - (b.status === 'paid') || String(a.due_date).localeCompare(String(b.due_date)));

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Invoices</h1></div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          <div className="figures" style={{ marginBottom: 24 }}>
            <div className="figure"><div className="figure-val">{formatMoney(unpaid.reduce((s, i) => s + parseAmount(i.amount), 0))}</div><div className="figure-label">To pay</div></div>
            <div className="figure"><div className="figure-val">{formatMoney(invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + parseAmount(i.amount), 0))}</div><div className="figure-label">Paid so far</div></div>
          </div>
          <div className="panel tbl-wrap">
            {rows.length ? (
              <table className="tbl">
                <thead><tr><th>For</th><th className="r">Amount</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((inv) => {
                    const overdue = isOverdue(inv);
                    return (
                      <tr key={inv.id} onClick={() => navigate(`/portal/invoices/${inv.id}`)}>
                        <td style={{ fontWeight: 500 }}>{inv.description || 'Invoice'}</td>
                        <td className="r num" style={{ fontWeight: 500 }}>{formatMoney(inv.amount)}</td>
                        <td style={{ color: overdue ? 'var(--err)' : 'var(--text-2)' }}>{inv.due_date ? (inv.status === 'paid' ? formatDate(inv.due_date) : relativeDay(inv.due_date)) : '—'}</td>
                        <td><Pill status={overdue ? 'overdue' : inv.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'No invoices yet.' : 'Loading…'}</div>}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => navigate('/portal/invoices')}
        title={selected?.description || 'Invoice'}
        footer={<button className="btn bp" type="button" onClick={() => navigate('/portal/invoices')}>Done</button>}
      >
        {selected && (
          <>
            <div className="figure-val" style={{ fontSize: 34 }}>{formatMoney(selected.amount)}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill status={isOverdue(selected) ? 'overdue' : selected.status} />
              <span className="muted" style={{ fontSize: 13.5 }}>
                {selected.status === 'paid' ? 'Thank you, this is paid.' : selected.due_date ? `Due ${formatDate(selected.due_date, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'No due date set'}
              </span>
            </div>
            {linked && <p className="muted" style={{ fontSize: 13.5, marginTop: 16 }}>For your {linked.service} project.</p>}
            {selected.status !== 'paid' && <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>Payment details come from the studio directly. If you have a question about this invoice, send a message.</p>}
          </>
        )}
      </Modal>
    </>
  );
}
