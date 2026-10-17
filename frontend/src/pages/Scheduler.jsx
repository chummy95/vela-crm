import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { clientsAPI, eventsAPI } from '../utils/api';
import { daysFromToday, formatDate } from '../utils/format';

const EVENT_TYPES = ['Call', 'Presentation', 'Review', 'Workshop', 'Photoshoot', 'Deadline', 'Studio time'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function blankEvent(date = '') {
  return { client_id: '', title: '', event_type: 'Call', date, time: '', duration: '', meeting_link: '' };
}

function byWhen(a, b) {
  return `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`);
}

function dayHeading(date) {
  const diff = daysFromToday(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });
}

function EventFields({ id, value, onChange, onSubmit, clients, error }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <form id={id} onSubmit={onSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="fc">
        <label className="fc-label" htmlFor={`${id}-title`}>What’s happening</label>
        <input id={`${id}-title`} className="fi" value={value.title} onChange={set('title')} placeholder="First draft presentation" required autoFocus />
      </div>
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-client`}>Client</label>
          <select id={`${id}-client`} className="fi fsel" value={value.client_id} onChange={set('client_id')}>
            <option value="">No client (studio time)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-type`}>Type</label>
          <select id={`${id}-type`} className="fi fsel" value={value.event_type} onChange={set('event_type')}>
            {[...new Set([...EVENT_TYPES, value.event_type].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-date`}>Date</label>
          <input id={`${id}-date`} className="fi" type="date" value={value.date} onChange={set('date')} required />
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-time`}>Time</label>
          <input id={`${id}-time`} className="fi" type="time" value={value.time} onChange={set('time')} />
        </div>
      </div>
      <div className="fi-row">
        <div className="fc" style={{ marginBottom: 0 }}>
          <label className="fc-label" htmlFor={`${id}-dur`}>Length in minutes</label>
          <input id={`${id}-dur`} className="fi" inputMode="numeric" value={value.duration} onChange={set('duration')} placeholder="60" />
        </div>
        <div className="fc" style={{ marginBottom: 0 }}>
          <label className="fc-label" htmlFor={`${id}-link`}>Meeting link</label>
          <input id={`${id}-link`} className="fi" type="url" value={value.meeting_link} onChange={set('meeting_link')} placeholder="https://" />
        </div>
      </div>
    </form>
  );
}

export default function Scheduler() {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState('');
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [pickedDay, setPickedDay] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankEvent());
  const [createError, setCreateError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);

  const [selectedId, setSelectedId] = useState('');
  const [detailForm, setDetailForm] = useState(blankEvent());
  const [detailError, setDetailError] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([eventsAPI.list(), clientsAPI.list()])
      .then(([rows, clientRows]) => { setEvents([...rows].sort(byWhen)); setClients(clientRows); })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const selected = useMemo(() => events.find((e) => e.id === selectedId) || null, [events, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setDetailForm({
      client_id: selected.client_id || '', title: selected.title || '', event_type: selected.event_type || 'Call',
      date: selected.date || '', time: selected.time || '', duration: selected.duration || '', meeting_link: selected.meeting_link || '',
    });
    setDetailError('');
    setConfirmDelete(false);
  }, [selected]);

  const colorFor = (e) => clients.find((c) => c.id === e.client_id)?.color || e.color || 'var(--vela)';
  const todayIso = iso(new Date());

  const byDay = useMemo(() => {
    const map = new Map();
    events.forEach((e) => { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date).push(e); });
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - offset);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: cells }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: iso(d), day: d.getDate(), inMonth: d.getMonth() === month.getMonth() };
    });
  }, [month]);

  const agenda = useMemo(() => {
    const list = pickedDay ? events.filter((e) => e.date === pickedDay) : events.filter((e) => e.date >= todayIso);
    const groups = [];
    list.forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    });
    return groups;
  }, [events, pickedDay, todayIso]);

  function shiftMonth(delta) {
    setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + delta); return d; });
  }

  function openCreate(date = pickedDay || '') {
    setCreateForm(blankEvent(date));
    setCreateError('');
    setCreateOpen(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await eventsAPI.create(createForm);
      setEvents((prev) => [...prev, created].sort(byWhen));
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await eventsAPI.update(selected.id, detailForm);
      setEvents((prev) => prev.map((e) => (e.id === selected.id ? { ...e, ...(updated || detailForm) } : e)).sort(byWhen));
      setSelectedId('');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await eventsAPI.remove(selected.id);
      setEvents((prev) => prev.filter((e) => e.id !== selected.id));
      setSelectedId('');
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Schedule</h1>
        <div className="tb-r"><button className="btn bp" type="button" onClick={() => openCreate()}><Icon name="plus" />Book time</button></div>
      </div>
      <div className="content">
        <div className="page">
          {pageError && <div className="form-error">{pageError}</div>}
          <div className="split cal-split">
            <section className="panel" aria-label="Calendar" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 className="h-section">{monthLabel}</h2>
                <div className="tb-r">
                  <button className="btn bq bsm" type="button" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); setPickedDay(''); }}>Today</button>
                  <button className="btn bg bsm" type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><Icon name="back" /></button>
                  <button className="btn bg bsm" type="button" onClick={() => shiftMonth(1)} aria-label="Next month"><Icon name="forward" /></button>
                </div>
              </div>
              <div className="cal" role="grid" aria-label={monthLabel}>
                {WEEKDAYS.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
                {grid.map((cell) => {
                  const dayEvents = byDay.get(cell.date) || [];
                  const cls = ['cal-day', cell.inMonth ? '' : 'out', cell.date === todayIso ? 'today' : '', cell.date === pickedDay ? 'picked' : ''].join(' ');
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      className={cls}
                      onClick={() => setPickedDay(cell.date === pickedDay ? '' : cell.date)}
                      aria-label={`${formatDate(cell.date, { weekday: 'long', day: 'numeric', month: 'long' })}${dayEvents.length ? `, ${dayEvents.length} booked` : ''}`}
                      aria-pressed={cell.date === pickedDay}
                    >
                      <span className="cal-num">{cell.day}</span>
                      <span className="cal-dots">
                        {dayEvents.slice(0, 3).map((e) => <span key={e.id} style={{ background: colorFor(e) }} />)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="panel" aria-labelledby="agenda-h">
              <div className="card-h">
                <h2 id="agenda-h" className="card-title">{pickedDay ? dayHeading(pickedDay) : 'Coming up'}</h2>
                {pickedDay
                  ? <button className="btn bq bsm" type="button" onClick={() => setPickedDay('')}>Show all upcoming</button>
                  : null}
              </div>
              {agenda.length ? (
                <div style={{ paddingBottom: 8 }}>
                  {agenda.map((group) => (
                    <div key={group.date}>
                      {!pickedDay && <div className={`agenda-day${group.date === todayIso ? ' today' : ''}`}>{dayHeading(group.date)}</div>}
                      {group.items.map((e) => (
                        <button key={e.id} type="button" className="agenda-item agenda-btn" onClick={() => setSelectedId(e.id)}>
                          <span className="agenda-time">{e.time || 'All day'}</span>
                          <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left' }}>
                            <span className="signal" style={{ background: colorFor(e), marginTop: 6 }} />
                            <span>
                              <span className="row-title" style={{ display: 'block' }}>{e.title || e.event_type}</span>
                              <span className="row-sub" style={{ display: 'block' }}>
                                {[e.client_name || 'Studio time', e.event_type, e.duration ? `${e.duration} min` : ''].filter(Boolean).join(', ')}
                              </span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  {!loaded ? 'Loading…' : pickedDay
                    ? <>Nothing booked on this day. <button type="button" className="btn bq bxs" style={{ padding: 0, color: 'var(--vela)' }} onClick={() => openCreate(pickedDay)}>Book time</button></>
                    : 'Nothing booked ahead. Use Book time to add a call, review or deadline.'}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Book time"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="event-create" disabled={savingCreate}>{savingCreate ? 'Booking…' : 'Book it'}</button>
          </>
        }
      >
        <EventFields id="event-create" value={createForm} onChange={setCreateForm} onSubmit={handleCreate} clients={clients} error={createError} />
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title={selected?.title || 'Booking'}
        footer={
          <>
            <button className="btn bd spacer" type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing…' : confirmDelete ? 'Yes, cancel booking' : 'Cancel booking'}
            </button>
            {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button>}
            <button className="btn bg" type="button" onClick={() => setSelectedId('')}>Close</button>
            <button className="btn bp" type="submit" form="event-edit" disabled={savingDetail}>{savingDetail ? 'Saving…' : 'Save changes'}</button>
          </>
        }
      >
        {selected?.meeting_link && (
          <a className="btn bg" href={selected.meeting_link} target="_blank" rel="noreferrer" style={{ marginBottom: 16 }}><Icon name="link" />Open meeting link</a>
        )}
        <EventFields id="event-edit" value={detailForm} onChange={setDetailForm} onSubmit={handleUpdate} clients={clients} error={detailError} />
      </Modal>
    </>
  );
}
