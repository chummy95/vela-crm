import React, { useEffect, useMemo, useState } from 'react';
import { ownerAPI } from '../utils/api';
import { formatDate, relativeDay } from '../utils/format';

const DAY = 86400000;

function ago(iso) {
  if (!iso) return '—';
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60 * 60 * 1000) return 'Just now';
  if (diff < DAY) return `${Math.round(diff / 3600000)} h ago`;
  return relativeDay(iso.slice(0, 10));
}

// Vela's owner only: every studio that has joined, newest first.
export default function Owner() {
  const [studios, setStudios] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    ownerAPI.studios().then(setStudios).catch((err) => setError(err.message)).finally(() => setLoaded(true));
  }, []);

  const figures = useMemo(() => {
    const now = Date.now();
    const within = (iso, days) => iso && now - Date.parse(iso) < days * DAY;
    return {
      total: studios.length,
      week: studios.filter((s) => within(s.created_at, 7)).length,
      active: studios.filter((s) => within(s.last_seen, 7)).length,
      clients: studios.reduce((n, s) => n + (s.clients || 0), 0),
    };
  }, [studios]);

  const rows = studios.filter((s) => {
    const q = query.trim().toLowerCase();
    return !q || [s.name, s.studio, s.email].some((v) => String(v || '').toLowerCase().includes(q));
  });

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Owner</h1>
        <div className="tb-r">
          <input className="fi" style={{ width: 240 }} placeholder="Search studios" aria-label="Search studios" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="figures" style={{ marginBottom: 24 }}>
            <div className="figure"><div className="figure-val">{figures.total}</div><div className="figure-label">Studios on Vela</div></div>
            <div className="figure"><div className="figure-val">{figures.week}</div><div className="figure-label">Joined this week</div></div>
            <div className="figure"><div className="figure-val">{figures.active}</div><div className="figure-label">Active this week</div></div>
            <div className="figure"><div className="figure-val">{figures.clients}</div><div className="figure-label">Clients across studios</div></div>
          </div>
          <div className="panel tbl-wrap">
            {rows.length ? (
              <table className="tbl">
                <thead>
                  <tr><th>Studio</th><th className="hide-sm">Email</th><th>Joined</th><th className="hide-sm">Last active</th><th className="r">Clients</th><th className="r hide-sm">Projects</th></tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.uid} style={{ cursor: 'default' }}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.studio || '—'}{s.owner && <span className="faint" style={{ fontWeight: 400 }}> (you)</span>}</div>
                        <div className="row-sub">{s.name}</div>
                      </td>
                      <td className="hide-sm"><a href={`mailto:${s.email}`}>{s.email}</a></td>
                      <td>{s.created_at ? formatDate(s.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="hide-sm muted">{ago(s.last_seen)}</td>
                      <td className="r num">{s.clients ?? '—'}</td>
                      <td className="r num hide-sm">{s.projects ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                {!loaded ? 'Loading…' : query ? 'No studios match that search.' : 'No studios yet. They appear here as they sign up or open Vela.'}
              </div>
            )}
          </div>
          <p className="faint" style={{ fontSize: 12.5, marginTop: 12 }}>
            Studios that joined before this page existed appear the next time they open Vela. Client and project counts update when each studio opens Vela.
          </p>
        </div>
      </div>
    </>
  );
}
