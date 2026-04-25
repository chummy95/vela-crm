import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { clientsAPI, eventsAPI } from '../utils/api';

function blankEvent(clientId = '') {
  return { client_id: clientId, title: '', event_type: 'Call', date: '', time: '', duration: '', meeting_link: '' };
}

export default function Scheduler() {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [createForm, setCreateForm] = useState(blankEvent());
  const [detailForm, setDetailForm] = useState(blankEvent());
  const [pageError, setPageError] = useState('');
  const [createError, setCreateError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [eventRows, clientRows] = await Promise.all([eventsAPI.list(), clientsAPI.list()]);
    setEvents(eventRows);
    setClients(clientRows);
    setCreateForm((current) => ({ ...current, client_id: current.client_id || clientRows[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch((err) => setPageError(err.message));
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  useEffect(() => {
    if (!selectedEvent) return;
    setDetailForm({
      client_id: selectedEvent.client_id || '',
      title: selectedEvent.title || '',
      event_type: selectedEvent.event_type || 'Call',
      date: selectedEvent.date || '',
      time: selectedEvent.time || '',
      duration: selectedEvent.duration || '',
      meeting_link: selectedEvent.meeting_link || '',
    });
    setDetailError('');
  }, [selectedEvent]);

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await eventsAPI.create(createForm);
      setEvents((prev) => [...prev, created].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
      setCreateOpen(false);
      setSelectedEventId(created.id);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedEvent) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await eventsAPI.update(selectedEvent.id, detailForm);
      setEvents((prev) =>
        prev
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      );
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleDelete(id = selectedEvent?.id) {
    if (!id) return;
    setDeleting(true);
    setDetailError('');
    try {
      await eventsAPI.remove(id);
      setEvents((prev) => prev.filter((item) => item.id !== id));
      setSelectedEventId('');
    } catch (err) {
      setDetailError(err.message);
      setPageError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Scheduler</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => { setCreateError(''); setCreateForm(blankEvent(clients[0]?.id || '')); setCreateOpen(true); }}>+ New Event</button></div>
      </div>
      <div className="content">
        {pageError && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{pageError}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Upcoming</div></div>
          <table className="tbl">
            <thead><tr><th>Title</th><th>Client</th><th>Date</th><th>Time</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} onClick={() => setSelectedEventId(event.id)}>
                  <td><b>{event.title}</b></td>
                  <td>{event.client_name || 'Internal'}</td>
                  <td>{event.date}</td>
                  <td>{event.time || '—'}</td>
                  <td>{event.event_type || '—'}</td>
                  <td>
                    <button
                      className="btn bg bxs"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        handleDelete(event.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No events scheduled.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Event"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="event-create-form" disabled={savingCreate}>{savingCreate ? 'Saving…' : 'Save Event'}</button>
          </>
        }
      >
        <form id="event-create-form" onSubmit={handleCreate}>
          {createError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{createError}</div>}
          <div className="fc">
            <div className="fc-label">Client</div>
            <select className="fi fsel" value={createForm.client_id} onChange={(event) => setCreateForm({ ...createForm, client_id: event.target.value })}>
              <option value="">No client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fc"><div className="fc-label">Title</div><input className="fi" value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} required /></div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Date</div><input className="fi" type="date" value={createForm.date} onChange={(event) => setCreateForm({ ...createForm, date: event.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Time</div><input className="fi" type="time" value={createForm.time} onChange={(event) => setCreateForm({ ...createForm, time: event.target.value })} /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Event Type</div><input className="fi" value={createForm.event_type} onChange={(event) => setCreateForm({ ...createForm, event_type: event.target.value })} /></div>
            <div className="fc"><div className="fc-label">Duration</div><input className="fi" value={createForm.duration} onChange={(event) => setCreateForm({ ...createForm, duration: event.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Meeting Link</div><input className="fi" value={createForm.meeting_link} onChange={(event) => setCreateForm({ ...createForm, meeting_link: event.target.value })} /></div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEventId('')}
        title={selectedEvent ? selectedEvent.title : 'Event'}
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setSelectedEventId('')}>Close</button>
            <button className="btn bg" type="button" onClick={() => handleDelete()} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            <button className="btn bp" type="submit" form="event-detail-form" disabled={savingDetail}>{savingDetail ? 'Saving…' : 'Save Changes'}</button>
          </>
        }
      >
        {selectedEvent && (
          <>
            {detailError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{detailError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.date || '—'}</div><div className="stat-label">Event Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.time || '—'}</div><div className="stat-label">Start Time</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{detailForm.event_type || '—'}</div><div className="stat-label">Event Type</div></div>
            </div>
            <form id="event-detail-form" onSubmit={handleUpdate}>
              <div className="fc">
                <div className="fc-label">Client</div>
                <select className="fi fsel" value={detailForm.client_id} onChange={(event) => setDetailForm({ ...detailForm, client_id: event.target.value })}>
                  <option value="">No client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div className="fc"><div className="fc-label">Title</div><input className="fi" value={detailForm.title} onChange={(event) => setDetailForm({ ...detailForm, title: event.target.value })} required /></div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Date</div><input className="fi" type="date" value={detailForm.date} onChange={(event) => setDetailForm({ ...detailForm, date: event.target.value })} required /></div>
                <div className="fc"><div className="fc-label">Time</div><input className="fi" type="time" value={detailForm.time} onChange={(event) => setDetailForm({ ...detailForm, time: event.target.value })} /></div>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Event Type</div><input className="fi" value={detailForm.event_type} onChange={(event) => setDetailForm({ ...detailForm, event_type: event.target.value })} /></div>
                <div className="fc"><div className="fc-label">Duration</div><input className="fi" value={detailForm.duration} onChange={(event) => setDetailForm({ ...detailForm, duration: event.target.value })} /></div>
              </div>
              <div className="fc"><div className="fc-label">Meeting Link</div><input className="fi" value={detailForm.meeting_link} onChange={(event) => setDetailForm({ ...detailForm, meeting_link: event.target.value })} /></div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
