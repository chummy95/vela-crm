import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { contractsAPI, formsAPI, invoicesAPI, projectsAPI, proposalsAPI } from '../utils/api';
import { formatMoney, parseAmount, toDate } from '../utils/format';

function isDone(p) {
  return p.status === 'delivered' || p.status === 'completed';
}

// One-series horizontal bar list: one hue, value labels in text ink, hover shows the exact figure.
function BarList({ rows, format = (v) => v, label }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${format(r.value)}`}>
          <span className="barlist-label">{r.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%` }} />
          </span>
          <span className="barlist-val num">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Columns({ rows, format, label }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="cols" role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${format(r.value)}`).join(', ')}`}>
      {rows.map((r) => (
        <div key={r.key} className="col" title={`${r.label}: ${format(r.value)}`}>
          <span className="col-val num">{r.value ? format(r.value) : ''}</span>
          <span className="col-bar" style={{ height: `${(r.value / max) * 100}%` }} />
          <span className="col-label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const currency = user?.currency || 'GBP';
  const money = (v) => formatMoney(v, currency);
  const [data, setData] = useState({ invoices: [], projects: [], proposals: [], contracts: [], submissions: [] });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    Promise.all([invoicesAPI.list(), projectsAPI.list(), proposalsAPI.list(), contractsAPI.list(), formsAPI.submissions()])
      .then(([invoices, projects, proposals, contracts, submissions]) => setData({ invoices, projects, proposals, contracts, submissions }))
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const { invoices, projects, proposals, contracts, submissions } = data;

  const totals = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'paid');
    const valued = projects.filter((p) => parseAmount(p.value) > 0);
    const decided = proposals.filter((p) => p.status === 'approved' || p.status === 'sent');
    return {
      collected: paid.reduce((s, i) => s + parseAmount(i.amount), 0),
      waiting: invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + parseAmount(i.amount), 0),
      avgProject: valued.length ? valued.reduce((s, p) => s + parseAmount(p.value), 0) / valued.length : 0,
      winRate: decided.length ? Math.round((proposals.filter((p) => p.status === 'approved').length / decided.length) * 100) : null,
    };
  }, [invoices, projects, proposals]);

  const funnel = useMemo(() => [
    { key: 'enq', label: 'Enquiries', value: submissions.length },
    { key: 'prop', label: 'Proposals written', value: proposals.length },
    { key: 'sign', label: 'Contracts signed', value: contracts.filter((c) => c.signed).length },
    { key: 'active', label: 'Projects in progress', value: projects.filter((p) => !isDone(p)).length },
    { key: 'done', label: 'Projects delivered', value: projects.filter(isDone).length },
  ], [submissions, proposals, contracts, projects]);

  const monthly = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), value: 0 };
    });
    invoices.filter((i) => i.status === 'paid').forEach((i) => {
      const d = toDate(i.due_date || i.created_at);
      if (!d) return;
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.value += parseAmount(i.amount);
    });
    return months;
  }, [invoices]);

  const byService = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      const key = p.service || 'Other';
      map.set(key, (map.get(key) || 0) + parseAmount(p.value));
    });
    return [...map.entries()].map(([service, value]) => ({ key: service, label: service, value })).sort((a, b) => b.value - a.value);
  }, [projects]);

  const byClient = useMemo(() => {
    const map = new Map();
    invoices.filter((i) => i.status === 'paid').forEach((i) => {
      const key = i.client_name || 'Unknown client';
      map.set(key, (map.get(key) || 0) + parseAmount(i.amount));
    });
    return [...map.entries()].map(([name, value]) => ({ key: name, label: name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [invoices]);

  const nothingYet = loaded && !invoices.length && !projects.length && !proposals.length && !submissions.length;

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Analytics</h1>
        <div className="tb-r">
          <button className="btn bg bsm" type="button" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
            {showTable ? 'Show charts' : 'Show as tables'}
          </button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          {nothingYet && (
            <div className="panel empty" style={{ padding: 40, marginBottom: 24 }}>
              <b>Not enough to chart yet.</b> As enquiries, proposals, projects and invoices come in, this page shows how your studio is doing.
            </div>
          )}

          <div className="figures">
            <div className="figure"><div className="figure-val">{money(totals.collected)}</div><div className="figure-label">Collected</div></div>
            <div className="figure"><div className="figure-val">{money(totals.waiting)}</div><div className="figure-label">Waiting to be paid</div></div>
            <div className="figure"><div className="figure-val">{money(totals.avgProject)}</div><div className="figure-label">Average project value</div></div>
            <div className="figure"><div className="figure-val">{totals.winRate === null ? '—' : `${totals.winRate}%`}</div><div className="figure-label">Proposals approved</div></div>
          </div>

          <div className="split even section">
            <section className="panel" style={{ padding: 20 }} aria-labelledby="rev-h">
              <h2 id="rev-h" className="card-title">Paid invoices, last six months</h2>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>Grouped by each invoice’s due date.</p>
              {showTable ? (
                <table className="tbl"><thead><tr><th>Month</th><th className="r">Paid</th></tr></thead>
                  <tbody>{monthly.map((m) => <tr key={m.key}><td>{m.label}</td><td className="r num">{money(m.value)}</td></tr>)}</tbody></table>
              ) : <Columns rows={monthly} format={money} label="Paid invoices by month" />}
            </section>

            <section className="panel" style={{ padding: 20 }} aria-labelledby="fun-h">
              <h2 id="fun-h" className="card-title">From enquiry to delivery</h2>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>Everything recorded in Vela so far.</p>
              {showTable ? (
                <table className="tbl"><thead><tr><th>Step</th><th className="r">Count</th></tr></thead>
                  <tbody>{funnel.map((f) => <tr key={f.key}><td>{f.label}</td><td className="r num">{f.value}</td></tr>)}</tbody></table>
              ) : <BarList rows={funnel} label="Pipeline counts" />}
            </section>

            <section className="panel" style={{ padding: 20 }} aria-labelledby="svc-h">
              <h2 id="svc-h" className="card-title">Project value by service</h2>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>Total value of every project, by what you’re making.</p>
              {byService.length ? (showTable ? (
                <table className="tbl"><thead><tr><th>Service</th><th className="r">Value</th></tr></thead>
                  <tbody>{byService.map((r) => <tr key={r.key}><td>{r.label}</td><td className="r num">{money(r.value)}</td></tr>)}</tbody></table>
              ) : <BarList rows={byService} format={money} label="Project value by service" />) : <p className="muted" style={{ fontSize: 13 }}>No projects yet.</p>}
            </section>

            <section className="panel" style={{ padding: 20 }} aria-labelledby="cli-h">
              <h2 id="cli-h" className="card-title">Top clients by money collected</h2>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>From paid invoices. <Link to="/invoices">See all invoices</Link></p>
              {byClient.length ? (showTable ? (
                <table className="tbl"><thead><tr><th>Client</th><th className="r">Collected</th></tr></thead>
                  <tbody>{byClient.map((r) => <tr key={r.key}><td>{r.label}</td><td className="r num">{money(r.value)}</td></tr>)}</tbody></table>
              ) : <BarList rows={byClient} format={money} label="Collected by client" />) : <p className="muted" style={{ fontSize: 13 }}>No paid invoices yet.</p>}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
