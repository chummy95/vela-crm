import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { JourneyRail } from '../components/ProjectJourney';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, contractsAPI, eventsAPI, invoicesAPI, messagesAPI, projectsAPI, proposalsAPI, questionnairesAPI } from '../utils/api';
import { progress } from '../utils/questionnaires';
import { daysFromToday, formatDate, formatMoney, greeting, isOverdue, relativeDay, stageLabel, stageLabels } from '../utils/format';

export default function PortalDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ client: null, projects: [], invoices: [], proposals: [], contracts: [], events: [], messages: [], forms: [] });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      clientsAPI.list(), projectsAPI.list(), invoicesAPI.list(), proposalsAPI.list(), contractsAPI.list(), eventsAPI.list(),
      messagesAPI.thread(user?.client_id).catch(() => []),
      questionnairesAPI.listResponses().catch(() => []),
    ])
      .then(([clients, projects, invoices, proposals, contracts, events, messages, forms]) => {
        setData({ client: clients[0] || null, projects, invoices, proposals, contracts, events, messages, forms });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [user?.client_id]);

  const { client, projects, invoices, proposals, contracts, events, messages, forms } = data;
  const firstName = String(user?.name || '').split(' ')[0];

  const todo = useMemo(() => {
    const items = [];
    forms.filter((f) => f.status !== 'submitted').forEach((f) => {
      const p = progress(f.questions, f.answers);
      items.push({
        key: `qr-${f.id}`, level: 'info',
        title: f.status === 'in_progress' ? `Finish your ${f.title.charAt(0).toLowerCase()}${f.title.slice(1)}` : `Fill in your ${f.title.charAt(0).toLowerCase()}${f.title.slice(1)}`,
        sub: f.status === 'in_progress' ? `${p.done} of ${p.total} answered, saved as you go` : `${p.total} questions from the studio`,
        to: `/portal/questionnaires/${f.id}`,
      });
    });
    proposals.filter((p) => p.status === 'sent').forEach((p) => items.push({
      key: `pp-${p.id}`, level: 'info', title: `Review the ${p.service || 'new'} proposal`, sub: `Sent ${relativeDay(p.date || p.created_at)}`, to: `/portal/proposals/${p.id}`,
    }));
    contracts.filter((c) => !c.signed).forEach((c) => items.push({
      key: `ct-${c.id}`, level: 'warn', title: c.service ? `Your ${c.service} contract is waiting to be signed` : 'Your contract is waiting to be signed', sub: 'Read it through. The studio marks it signed once you’ve signed', to: `/portal/contracts/${c.id}`,
    }));
    invoices.filter((i) => i.status !== 'paid').forEach((i) => items.push({
      key: `inv-${i.id}`, level: isOverdue(i) ? 'err' : 'warn',
      title: `${formatMoney(i.amount)} ${isOverdue(i) ? 'is overdue' : 'to pay'}`,
      sub: `${i.description || 'Invoice'}${i.due_date ? `, due ${relativeDay(i.due_date)}` : ''}`, to: `/portal/invoices/${i.id}`,
    }));
    return items;
  }, [proposals, contracts, invoices, forms]);

  const upcoming = events.filter((e) => (daysFromToday(e.date) ?? -1) >= 0).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 3);
  const lastMessage = messages[messages.length - 1];

  return (
    <div className="content">
      <div className="page">
        <header>
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>{client?.name || user?.client_name || 'Your workspace'}</div>
          <h1 className="h-display">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="lede" style={{ marginTop: 8 }}>Everything about your project with the studio, in one place.</p>
        </header>

        {error && <div className="form-error" style={{ marginTop: 20 }}>{error}</div>}

        <section className="section" aria-labelledby="pp-h">
          <div className="section-h">
            <h2 id="pp-h" className="h-section">Where your project is</h2>
            {projects.length > 1 && <Link className="link" to="/portal/projects">All projects</Link>}
          </div>
          <div className="panel">
            {projects.length ? (
              <div className="journeys">
                {projects.map((p) => {
                  const total = stageLabels(p.service).length;
                  const done = p.status === 'delivered' || p.status === 'completed';
                  return (
                    <Link key={p.id} className="journey tight" to={`/portal/projects/${p.id}`}>
                      <span style={{ minWidth: 0 }}>
                        <span className="journey-name" style={{ display: 'block' }}>{p.service}</span>
                        <span className="journey-service">{done ? 'Delivered' : `Now in ${stageLabel(p)}`}</span>
                      </span>
                      <JourneyRail project={p} />
                      <span className="journey-meta"><span className="journey-when">{done ? 'Complete' : `Stage ${Number(p.stage || 0) + 1} of ${total}`}</span></span>
                    </Link>
                  );
                })}
              </div>
            ) : <div className="empty">{loaded ? 'Your studio hasn’t shared a project here yet.' : 'Loading…'}</div>}
          </div>
        </section>

        <div className="split even section">
          <section className="panel" aria-labelledby="todo-h">
            <div className="card-h"><h2 id="todo-h" className="card-title">Waiting on you</h2></div>
            {todo.length ? (
              <ul className="rows">
                {todo.map((item) => (
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
            ) : <div className="empty">{loaded ? 'Nothing needs you right now.' : 'Loading…'}</div>}
          </section>

          <section className="panel" aria-label="Schedule and messages">
            <div className="aside-block">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h2 className="card-title">Coming up</h2>
                <Link to="/portal/schedule" style={{ fontSize: 13 }}>Full schedule</Link>
              </div>
              {upcoming.length ? upcoming.map((e) => (
                <div key={e.id} style={{ padding: '7px 0' }}>
                  <div className="row-title">{e.title || e.event_type}</div>
                  <div className="row-sub">{formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })}{e.time ? ` at ${e.time}` : ''}</div>
                </div>
              )) : <p className="muted" style={{ fontSize: 13 }}>Nothing booked yet.</p>}
            </div>
            <div className="aside-block">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h2 className="card-title">Latest message</h2>
                <Link to="/portal/messages" style={{ fontSize: 13 }}>Open messages</Link>
              </div>
              {lastMessage ? (
                <>
                  <div className="faint" style={{ fontSize: 12 }}>{lastMessage.outbound ? 'From the studio' : 'You'}, {relativeDay(lastMessage.sent_at)}</div>
                  <p style={{ fontSize: 14, marginTop: 2 }}>{lastMessage.text}</p>
                </>
              ) : <p className="muted" style={{ fontSize: 13 }}>No messages yet. Say hello any time.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
