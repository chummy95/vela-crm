import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import { eventsAPI } from '../utils/api';
import { daysFromToday, formatDate } from '../utils/format';

function dayHeading(date) {
  const diff = daysFromToday(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function PortalSchedule() {
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    eventsAPI.list().then(setEvents).catch((err) => setError(err.message)).finally(() => setLoaded(true));
  }, []);

  const groups = useMemo(() => {
    const upcoming = events.filter((e) => (daysFromToday(e.date) ?? -1) >= 0).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const out = [];
    upcoming.forEach((e) => {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else out.push({ date: e.date, items: [e] });
    });
    return out;
  }, [events]);

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Schedule</h1></div>
      <div className="content">
        <div className="page" style={{ maxWidth: 760 }}>
          {error && <div className="form-error">{error}</div>}
          <div className="panel">
            {groups.length ? groups.map((g) => (
              <div key={g.date} style={{ paddingBottom: 6 }}>
                <div className={`agenda-day${daysFromToday(g.date) === 0 ? ' today' : ''}`}>{dayHeading(g.date)}</div>
                {g.items.map((e) => (
                  <div key={e.id} className="agenda-item" style={{ gridTemplateColumns: '56px 1fr auto', alignItems: 'start' }}>
                    <span className="agenda-time">{e.time || 'All day'}</span>
                    <span>
                      <span className="row-title" style={{ display: 'block' }}>{e.title || e.event_type}</span>
                      <span className="row-sub" style={{ display: 'block' }}>{[e.event_type, e.duration ? `${e.duration} min` : ''].filter(Boolean).join(', ')}</span>
                    </span>
                    {e.meeting_link && <a className="btn bg bsm" href={e.meeting_link} target="_blank" rel="noreferrer"><Icon name="link" />Join</a>}
                  </div>
                ))}
              </div>
            )) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'Nothing booked yet. Your studio will add calls and reviews here.' : 'Loading…'}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
