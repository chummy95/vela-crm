import React, { useEffect, useState } from 'react';
import { eventsAPI } from '../utils/api';

export default function PortalSchedule() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    eventsAPI.list().then(setEvents).catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Schedule</div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Upcoming Sessions</div></div>
          <table className="tbl">
            <thead><tr><th>Event</th><th>Date</th><th>Time</th><th>Type</th><th>Meeting Link</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td><b>{event.title}</b></td>
                  <td>{event.date || '—'}</td>
                  <td>{event.time || '—'}</td>
                  <td>{event.event_type || '—'}</td>
                  <td>{event.meeting_link ? <a href={event.meeting_link} target="_blank" rel="noreferrer">Open link</a> : '—'}</td>
                </tr>
              ))}
              {!events.length && <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No meetings have been scheduled yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
