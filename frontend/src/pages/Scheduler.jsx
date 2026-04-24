import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { clientsAPI, eventsAPI } from '../utils/api';

export default function Scheduler() {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ client_id: '', title: '', event_type: 'Call', date: '', time: '', duration: '', meeting_link: '' });

  useEffect(() => {
    Promise.all([eventsAPI.list(), clientsAPI.list()])
      .then(([eventRows, clientRows]) => {
        setEvents(eventRows);
        setClients(clientRows);
        setForm((current) => ({ ...current, client_id: current.client_id || clientRows[0]?.id || '' }));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e?.preventDefault();
    try {
      const created = await eventsAPI.create(form);
      setEvents((prev) => [...prev, created].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
      setModal(false);
      setError('');
      setForm({ client_id: clients[0]?.id || '', title: '', event_type: 'Call', date: '', time: '', duration: '', meeting_link: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await eventsAPI.remove(id);
      setEvents((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Scheduler</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => setModal(true)}>+ New Event</button></div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Upcoming</div></div>
          <table className="tbl">
            <thead><tr><th>Title</th><th>Client</th><th>Date</th><th>Time</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td><b>{event.title}</b></td>
                  <td>{event.client_name || 'Internal'}</td>
                  <td>{event.date}</td>
                  <td>{event.time || '—'}</td>
                  <td>{event.event_type || '—'}</td>
                  <td><button className="btn bg bxs" onClick={() => remove(event.id)}>Delete</button></td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No events scheduled.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Create Event"
        footer={<><button className="btn bg" onClick={() => setModal(false)}>Cancel</button><button className="btn bp" onClick={handleCreate}>Save Event</button></>}
      >
        <form onSubmit={handleCreate}>
          <div className="fc">
            <div className="fc-label">Client</div>
            <select className="fi fsel" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">No client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fc"><div className="fc-label">Title</div><input className="fi" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Date</div><input className="fi" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Time</div><input className="fi" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Event Type</div><input className="fi" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} /></div>
            <div className="fc"><div className="fc-label">Duration</div><input className="fi" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Meeting Link</div><input className="fi" value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} /></div>
        </form>
      </Modal>
    </>
  );
}
