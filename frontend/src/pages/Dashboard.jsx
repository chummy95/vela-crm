import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { contractsAPI, formsAPI, invoicesAPI, projectsAPI, proposalsAPI, eventsAPI } from '../utils/api';
import { JourneyRail } from '../components/ProjectJourney';
import ClientMark from '../components/ClientMark';
import Icon from '../components/Icon';
import {
  daysFromToday, formatDate, formatMoney, greeting, isOverdue, parseAmount, relativeDay, stageLabels, toDate,
} from '../utils/format';

function pick(data, pattern) {
  const key = Object.keys(data || {}).find((k) => pattern.test(k));
  return key ? data[key] : '';
}

function dayHeading(dateString) {
  const diff = daysFromToday(dateString);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return formatDate(dateString, { weekday: 'long', day: 'numeric', month: 'short' });
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currency = user?.currency || 'GBP';
  const [data, setData] = useState({ projects: [], invoices: [], proposals: [], contracts: [], events: [], submissions: [] });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([projectsAPI.list(), invoicesAPI.list(), proposalsAPI.list(), contractsAPI.list(), eventsAPI.list(), formsAPI.submissions()])
      .then(([projects, invoices, proposals, contracts, events, submissions]) => {
        setData({ projects, invoices, proposals, contracts, events, submissions });
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoaded(true));
  }, []);

  const { projects, invoices, proposals, contracts, events, submissions } = data;

  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'active'), [projects]);

  const money = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status !== 'paid');
    const overdue = unpaid.filter(isOverdue);
    return {
      outstanding: unpaid.reduce((s, i) => s + parseAmount(i.amount), 0),
      overdue: overdue.reduce((s, i) => s + parseAmount(i.amount), 0),
      collected: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + parseAmount(i.amount), 0),
      proposed: proposals.filter((p) => p.status === 'sent').reduce((s, p) => s + parseAmount(p.value), 0),
      booked: activeProjects.reduce((s, p) => s + parseAmount(p.value), 0),
    };
  }, [invoices, proposals, activeProjects]);

  const attention = useMemo(() => {
    const items = [];
    invoices.filter(isOverdue).forEach((inv) => items.push({
      key: `inv-${inv.id}`, level: 'err', rank: 0,
      title: `${inv.client_name || 'A client'} owes ${formatMoney(inv.amount, currency)}`,
      sub: `${inv.description || 'Invoice'}, due ${relativeDay(inv.due_date)}`,
      to: `/invoices/${inv.id}`,
    }));
    invoices.filter((inv) => inv.status !== 'paid' && !isOverdue(inv)).forEach((inv) => {
      const diff = daysFromToday(inv.due_date);
      if (diff !== null && diff <= 7) {
        items.push({
          key: `due-${inv.id}`, level: 'warn', rank: 1,
          title: `${formatMoney(inv.amount, currency)} due from ${inv.client_name || 'a client'}`,
          sub: `${inv.description || 'Invoice'}, due ${relativeDay(inv.due_date)}`,
          to: `/invoices/${inv.id}`,
        });
      }
    });
    contracts.filter((c) => !c.signed).forEach((c) => items.push({
      key: `ct-${c.id}`, level: 'warn', rank: 2,
      title: `${c.client_name || 'A client'} hasn’t signed their contract`,
      sub: `${c.service || 'Contract'}${c.value ? `, ${formatMoney(c.value, currency)}` : ''}`,
      to: `/contracts/${c.id}`,
    }));
    proposals.filter((p) => p.status === 'sent').forEach((p) => items.push({
      key: `pp-${p.id}`, level: 'info', rank: 3,
      title: `Waiting on ${p.client_name || 'a client'} to approve a proposal`,
      sub: `${p.service || 'Proposal'}, sent ${relativeDay(p.date || p.created_at)}`,
      to: `/proposals/${p.id}`,
    }));
    submissions.filter((s) => {
      const diff = daysFromToday(s.submitted_at);
      return diff !== null && diff >= -7;
    }).forEach((s) => items.push({
      key: `sub-${s.id}`, level: 'info', rank: 4,
      title: `New enquiry from ${pick(s.data, /full[\s_]?name|^name$/i) || 'someone new'}`,
      sub: [pick(s.data, /brand|business|company/i), pick(s.data, /service/i)].filter(Boolean).join(', ') || `Received ${relativeDay(s.submitted_at)}`,
      to: '/forms',
    }));
    return items.sort((a, b) => a.rank - b.rank);
  }, [invoices, contracts, proposals, submissions, currency]);

  const week = useMemo(() => {
    const upcoming = events
      .filter((e) => {
        const diff = daysFromToday(e.date);
        return diff !== null && diff >= 0 && diff <= 6;
      })
      .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
    const groups = [];
    upcoming.forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    });
    return groups;
  }, [events]);

  const recentEnquiries = useMemo(
    () => [...submissions].sort((a, b) => (toDate(b.submitted_at) || 0) - (toDate(a.submitted_at) || 0)).slice(0, 4),
    [submissions]
  );

  async function copyIntakeLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/intake/${user?.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      setError(copyError.message);
    }
  }

  const firstName = (user?.name || '').split(' ')[0];
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const needsYou = attention.filter((a) => a.rank <= 2).length;

  return (
    <div className="content">
      <div className="page">
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>{today}</div>
            <h1 className="h-display">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
            {loaded && (
              <p className="lede" style={{ marginTop: 8 }}>
                {activeProjects.length
                  ? `${plural(activeProjects.length, 'project')} in motion`
                  : 'No projects in motion yet'}
                {needsYou ? ` and ${plural(needsYou, 'thing')} waiting on you.` : '. Nothing is waiting on you.'}
              </p>
            )}
          </div>
          <div className="tb-r">
            <button className="btn bg" type="button" onClick={copyIntakeLink}>
              <Icon name={copied ? 'check' : 'link'} />
              {copied ? 'Link copied' : 'Copy enquiry form link'}
            </button>
            <button className="btn bp" type="button" onClick={() => navigate('/clients?new=1')}>
              <Icon name="plus" />
              Add client
            </button>
          </div>
        </header>

        {error && <div className="form-error" style={{ marginTop: 20 }}>{error}</div>}

        <div className="figures" style={{ marginTop: 28 }}>
          <div className="figure">
            <div className="figure-val">{formatMoney(money.outstanding, currency)}</div>
            <div className="figure-label">Waiting to be paid</div>
            {money.overdue > 0 && <div className="figure-note">{formatMoney(money.overdue, currency)} overdue</div>}
          </div>
          <div className="figure">
            <div className="figure-val">{formatMoney(money.collected, currency)}</div>
            <div className="figure-label">Collected</div>
          </div>
          <div className="figure">
            <div className="figure-val">{formatMoney(money.booked, currency)}</div>
            <div className="figure-label">Booked in active projects</div>
          </div>
          <div className="figure">
            <div className="figure-val">{formatMoney(money.proposed, currency)}</div>
            <div className="figure-label">Out in proposals</div>
          </div>
        </div>

        <div className="split even section">
          <section className="panel" aria-labelledby="attn-h">
            <div className="card-h"><h2 id="attn-h" className="card-title">Needs your attention</h2></div>
            {attention.length ? (
              <ul className="rows">
                {attention.slice(0, 6).map((item) => (
                  <li key={item.key}>
                    <Link className="row" to={item.to}>
                      <span className={`signal ${item.level}`} />
                      <span className="row-main">
                        <span className="row-title" style={{ display: 'block' }}>{item.title}</span>
                        <span className="row-sub" style={{ display: 'block' }}>{item.sub}</span>
                      </span>
                      <Icon name="forward" size={16} className="ico faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">{loaded ? 'You’re all caught up. Overdue invoices, unsigned contracts and new enquiries will appear here.' : 'Loading…'}</div>
            )}
          </section>

          <section className="panel" aria-labelledby="week-h">
            <div className="card-h">
              <h2 id="week-h" className="card-title">This week</h2>
              <Link to="/scheduler" style={{ fontSize: 13 }}>Open schedule</Link>
            </div>
            {week.length ? (
              <div style={{ paddingBottom: 8 }}>
                {week.map((group) => (
                  <div key={group.date}>
                    <div className={`agenda-day${daysFromToday(group.date) === 0 ? ' today' : ''}`}>{dayHeading(group.date)}</div>
                    {group.items.map((e) => (
                      <div key={e.id} className="agenda-item">
                        <span className="agenda-time">{e.time || 'All day'}</span>
                        <span>
                          <span className="row-title" style={{ display: 'block' }}>{e.title || e.event_type || 'Meeting'}</span>
                          <span className="row-sub" style={{ display: 'block' }}>{e.client_name || 'Studio time'}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">{loaded ? 'Nothing booked in the next seven days.' : 'Loading…'}</div>
            )}
          </section>
        </div>

        <section className="section" aria-labelledby="motion-h">
          <div className="section-h">
            <h2 id="motion-h" className="h-section">Projects in motion</h2>
            <Link className="link" to="/projects">All projects</Link>
          </div>
          <div className="panel">
            {activeProjects.length ? (
              <div className="journeys">
                {activeProjects.map((p) => {
                  const total = stageLabels(p.service).length;
                  return (
                    <Link key={p.id} className="journey" to={`/projects/${p.id}`}>
                      <span className="journey-who">
                        <ClientMark name={p.client_name} color={p.client_color} size={36} />
                        <span style={{ minWidth: 0 }}>
                          <span className="journey-name" style={{ display: 'block' }}>{p.client_name || 'Untitled client'}</span>
                          <span className="journey-service">{p.service}</span>
                        </span>
                      </span>
                      <JourneyRail project={p} />
                      <span className="journey-meta">
                        <span className="journey-value" style={{ display: 'block' }}>{p.value ? formatMoney(p.value, currency) : '—'}</span>
                        <span className="journey-when">Stage {Math.min(Number(p.stage || 0) + 1, total)} of {total}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="empty">
                {loaded ? <>No active projects. <Link to="/projects">Start a project</Link> once a client has signed.</> : 'Loading…'}
              </div>
            )}
          </div>
        </section>

        <section className="section" aria-labelledby="enq-h">
          <div className="section-h">
            <h2 id="enq-h" className="h-section">Latest enquiries</h2>
            <Link className="link" to="/forms">All enquiries</Link>
          </div>
          <div className="panel tbl-wrap">
            {recentEnquiries.length ? (
              <table className="tbl">
                <thead>
                  <tr><th>From</th><th>Brand</th><th className="hide-sm">Interested in</th><th className="hide-sm">Budget</th><th className="r">Received</th></tr>
                </thead>
                <tbody>
                  {recentEnquiries.map((s) => (
                    <tr key={s.id} onClick={() => navigate('/forms')}>
                      <td style={{ fontWeight: 500 }}>{pick(s.data, /full[\s_]?name|^name$/i) || '—'}</td>
                      <td>{pick(s.data, /brand|business|company/i) || '—'}</td>
                      <td className="hide-sm">{pick(s.data, /service/i) || '—'}</td>
                      <td className="hide-sm">{pick(s.data, /budget/i) || '—'}</td>
                      <td className="r muted">{relativeDay(s.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">{loaded ? <>No enquiries yet. Copy your enquiry form link above and add it to your website.</> : 'Loading…'}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
