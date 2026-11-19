import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { recordsAPI } from '../utils/api';
import { formatDate } from '../utils/format';

// A client's records: a dated timeline of consultation notes, treatments (or services), next steps
// and progress photos. Notes and photos are private to the studio; next steps can be shown to the
// client in their portal.

const KINDS = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'treatment', label: 'Treatment' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'note', label: 'Note' },
];
const kindLabel = (k) => KINDS.find((x) => x.value === k)?.label || 'Note';
const today = () => new Date().toISOString().slice(0, 10);
const longDate = (d) => formatDate(d, { day: 'numeric', month: 'long', year: 'numeric' });

function blankRecord() {
  return { date: today(), kind: 'consultation', title: '', notes: '', treatment: '', next_steps: '', share_next_steps: true, photos: [] };
}

// Short-lived links for the photos on each record, refreshed when the records change.
function usePhotoLinks(records) {
  const [links, setLinks] = useState({});
  const key = records.map((r) => `${r.id}:${(r.photos || []).length}`).join('|');
  useEffect(() => {
    let active = true;
    records.forEach((r) => {
      const urls = (r.photos || []).map((p) => p.url).filter(Boolean);
      if (!urls.length) return;
      recordsAPI.photoLinks(r.id, urls).then((got) => { if (active) setLinks((cur) => ({ ...cur, ...got })); }).catch(() => {});
    });
    return () => { active = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return links;
}

function Photo({ src, photo, onClick, selected, size = 'md' }) {
  return (
    <button type="button" className={`rec-photo s-${size}${selected ? ' on' : ''}`} onClick={onClick} aria-label={`${photo.label || 'Photo'}, ${longDate(photo.taken_at)}`} aria-pressed={selected}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span className="rec-photo-wait" />}
      {(photo.label || size === 'lg') && <span className="rec-photo-cap">{photo.label || formatDate(photo.taken_at)}</span>}
    </button>
  );
}

function RecordEditor({ open, onClose, client, record, onSaved }) {
  const [form, setForm] = useState(blankRecord());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(0);
  const [photoLabel, setPhotoLabel] = useState('');
  const [previews, setPreviews] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(record ? { ...blankRecord(), ...record, photos: record.photos || [] } : blankRecord());
    setError('');
    setPhotoLabel('');
    setPreviews({});
  }, [open, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function addPhotos(files) {
    if (!files?.length) return;
    setError('');
    setUploading(1);
    try {
      const local = Array.from(files).filter((f) => /^image\//.test(f.type));
      const added = await recordsAPI.uploadPhotos(client.id, local, { label: photoLabel, takenAt: form.date, onProgress: (p) => setUploading(Math.max(1, p)) });
      const urls = {};
      added.forEach((p, i) => { if (local[i]) urls[p.url] = URL.createObjectURL(local[i]); });
      setPreviews((cur) => ({ ...cur, ...urls }));
      setForm((f) => ({ ...f, photos: [...f.photos, ...added] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = record ? await recordsAPI.update(record.id, form) : await recordsAPI.create(client.id, form);
      onSaved(saved, record ? 'updated' : 'created');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const portal = Boolean(client?.portal_user_id);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edit entry' : 'New entry'}
      wide
      footer={
        <>
          <button className="btn bg" type="button" onClick={onClose}>Cancel</button>
          <button className="btn bp" type="submit" form="rec-form" disabled={saving || uploading > 0}>{saving ? 'Saving…' : 'Save entry'}</button>
        </>
      }
    >
      <form id="rec-form" onSubmit={save}>
        {error && <div className="form-error">{error}</div>}
        <div className="fi-row">
          <div className="fc"><label className="fc-label" htmlFor="rec-date">Date</label><input id="rec-date" className="fi" type="date" value={form.date} onChange={set('date')} required /></div>
          <div className="fc">
            <label className="fc-label" htmlFor="rec-kind">Type</label>
            <select id="rec-kind" className="fi fsel" value={form.kind} onChange={set('kind')}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
        </div>
        <div className="fc"><label className="fc-label" htmlFor="rec-title">Title <span className="faint" style={{ fontWeight: 400 }}>optional</span></label><input id="rec-title" className="fi" value={form.title} onChange={set('title')} placeholder="e.g. Peel 1 of 4" /></div>
        <div className="fc">
          <label className="fc-label" htmlFor="rec-notes">Notes <span className="faint" style={{ fontWeight: 400 }}>private</span></label>
          <textarea id="rec-notes" className="fi" rows={5} value={form.notes} onChange={set('notes')} placeholder="What you discussed and observed" />
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor="rec-treat">Treatment or service <span className="faint" style={{ fontWeight: 400 }}>private</span></label>
          <textarea id="rec-treat" className="fi" rows={3} value={form.treatment} onChange={set('treatment')} placeholder="What you offered or did, products, settings" />
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor="rec-next">Next steps</label>
          <textarea id="rec-next" className="fi" rows={4} value={form.next_steps} onChange={set('next_steps')} placeholder="Aftercare, homecare and what happens next. One per line." />
          <label className="qb-req" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={form.share_next_steps} onChange={set('share_next_steps')} />
            Show the next steps to {client?.contact || client?.name || 'the client'} in their portal
          </label>
          {form.share_next_steps && !portal && <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>They’ll see them once you give them portal access.</div>}
          {form.share_next_steps && portal && <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>We’ll email them to say there’s an update. The email doesn’t include the details.</div>}
        </div>

        <div className="fc" style={{ marginBottom: 0 }}>
          <span className="fc-label">Progress photos <span className="faint" style={{ fontWeight: 400 }}>private</span></span>
          {form.photos.length > 0 && (
            <div className="rec-photos" style={{ marginBottom: 10 }}>
              {form.photos.map((p) => (
                <div key={p.url} className="rec-photo-edit">
                  <Photo src={previews[p.url] || record?._links?.[p.url]} photo={p} size="sm" />
                  <input className="fi" aria-label={`Label for ${p.name}`} value={p.label} placeholder="Label" onChange={(e) => setForm((f) => ({ ...f, photos: f.photos.map((x) => (x.url === p.url ? { ...x, label: e.target.value } : x)) }))} />
                  <button type="button" className="mc" aria-label={`Remove ${p.name}`} onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((x) => x.url !== p.url) }))}><Icon name="close" size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="rec-upload">
            <input className="fi" value={photoLabel} onChange={(e) => setPhotoLabel(e.target.value)} placeholder="Label for new photos, e.g. Left cheek" aria-label="Label for new photos" />
            <button className="btn bg" type="button" disabled={uploading > 0} onClick={() => fileRef.current?.click()}><Icon name="plus" size={15} />{uploading ? `Uploading ${uploading}%` : 'Add photos'}</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          </div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>Photos are stored privately and only you can see them.</div>
        </div>
      </form>
    </Modal>
  );
}

export default function ClientRecords({ client }) {
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState('timeline');
  const [editing, setEditing] = useState(null); // null closed, {} new, record to edit
  const [confirmId, setConfirmId] = useState('');
  const [viewer, setViewer] = useState(null);
  const [compare, setCompare] = useState([]);
  const links = usePhotoLinks(records);

  useEffect(() => {
    if (!client?.id) return;
    recordsAPI.listForClient(client.id)
      .then(setRecords)
      .catch((err) => setError(/permission|insufficient/i.test(err.message) ? 'Records are almost ready: they switch on in a few minutes, once the new privacy rules are published.' : err.message))
      .finally(() => setLoaded(true));
  }, [client?.id]);

  const allPhotos = useMemo(() => records
    .flatMap((r) => (r.photos || []).map((p) => ({ ...p, record: r })))
    .sort((a, b) => String(a.taken_at).localeCompare(String(b.taken_at))), [records]);

  function onSaved(saved, how) {
    setRecords((cur) => {
      const next = how === 'created' ? [saved, ...cur] : cur.map((r) => (r.id === saved.id ? { ...r, ...saved } : r));
      return next.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at)));
    });
    setEditing(null);
    setNotice(saved.notified?.sent ? `Saved. ${client.contact || client.name} can see the next steps in their portal, and we’ve let them know by email.` : saved.shared ? `Saved. The next steps are in ${client.contact || client.name}’s portal.` : 'Saved.');
  }

  async function remove(id) {
    if (confirmId !== id) { setConfirmId(id); return; }
    try {
      await recordsAPI.remove(id);
      setRecords((cur) => cur.filter((r) => r.id !== id));
      setConfirmId('');
    } catch (err) {
      setError(err.message);
    }
  }

  const toggleCompare = (url) => setCompare((cur) => (cur.includes(url) ? cur.filter((u) => u !== url) : [...cur.slice(-1), url]));
  const comparePhotos = compare.map((u) => allPhotos.find((p) => p.url === u)).filter(Boolean);

  return (
    <section className="section" aria-labelledby="rec-h">
      <div className="section-h">
        <h2 id="rec-h" className="h-section">Records</h2>
        <div className="tb-r">
          {allPhotos.length > 0 && (
            <div className="segmented" role="tablist" aria-label="Records view">
              <button type="button" role="tab" aria-selected={view === 'timeline'} className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>Timeline</button>
              <button type="button" role="tab" aria-selected={view === 'photos'} className={view === 'photos' ? 'on' : ''} onClick={() => setView('photos')}>Photos <span className="faint">{allPhotos.length}</span></button>
            </div>
          )}
          <button className="btn bg bsm" type="button" onClick={() => { setNotice(''); setEditing({}); }}><Icon name="plus" size={15} />Add entry</button>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      {notice && <div className="notice ok" role="status" style={{ marginBottom: 12 }}>{notice}</div>}

      {view === 'photos' && allPhotos.length > 0 ? (
        <div className="panel" style={{ padding: 18 }}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{compare.length === 2 ? 'Two photos chosen.' : 'Choose two photos to compare them side by side.'}</p>
          <div className="rec-photos">
            {allPhotos.map((p) => (
              <div key={p.url} className="rec-photo-tile">
                <Photo src={links[p.url]} photo={p} selected={compare.includes(p.url)} onClick={() => toggleCompare(p.url)} />
                <span className="rec-photo-date">{formatDate(p.taken_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            ))}
          </div>
          <div className="tb-r" style={{ justifyContent: 'flex-start', marginTop: 14 }}>
            <button className="btn bp bsm" type="button" disabled={compare.length !== 2} onClick={() => setViewer({ compare: true })}>Compare</button>
            {compare.length > 0 && <button className="btn bq bsm" type="button" onClick={() => setCompare([])}>Clear</button>}
          </div>
        </div>
      ) : (
        <div className="panel">
          {records.length ? (
            <ol className="rec-list">
              {records.map((r) => (
                <li key={r.id} className="rec">
                  <div className="rec-head">
                    <span className={`rec-kind k-${r.kind}`}>{kindLabel(r.kind)}</span>
                    <span className="rec-date">{longDate(r.date)}</span>
                    {r.title && <span className="rec-title">{r.title}</span>}
                    <span className="rec-actions">
                      <button className="btn bq bxs" type="button" onClick={() => { setNotice(''); setEditing({ ...r, _links: links }); }}>Edit</button>
                      <button className="btn bd bxs" type="button" onClick={() => remove(r.id)}>{confirmId === r.id ? 'Yes, delete' : 'Delete'}</button>
                      {confirmId === r.id && <button className="btn bq bxs" type="button" onClick={() => setConfirmId('')}>Keep</button>}
                    </span>
                  </div>
                  {r.notes && <div className="rec-block"><span className="rec-label">Notes</span><p>{r.notes}</p></div>}
                  {r.treatment && <div className="rec-block"><span className="rec-label">Treatment or service</span><p>{r.treatment}</p></div>}
                  {r.next_steps && (
                    <div className="rec-block">
                      <span className="rec-label">Next steps <span className={`rec-share${r.shared ? ' on' : ''}`}>{r.shared ? 'Shown to client' : 'Private'}</span></span>
                      <p>{r.next_steps}</p>
                    </div>
                  )}
                  {(r.photos || []).length > 0 && (
                    <div className="rec-photos">
                      {r.photos.map((p) => <Photo key={p.url} src={links[p.url]} photo={p} onClick={() => setViewer({ photo: p })} />)}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty">
              {loaded
                ? <>Keep consultation notes, treatments, next steps and progress photos for {client.contact || client.name} here. Notes and photos are only visible to you; you choose which next steps they see.</>
                : 'Loading…'}
            </div>
          )}
        </div>
      )}

      <RecordEditor open={editing !== null} onClose={() => setEditing(null)} client={client} record={editing?.id ? editing : null} onSaved={onSaved} />

      <Modal open={Boolean(viewer)} onClose={() => setViewer(null)} title={viewer?.compare ? 'Compare photos' : (viewer?.photo?.label || 'Photo')} wide>
        {viewer?.photo && (
          <figure className="rec-view">
            <img src={links[viewer.photo.url]} alt={viewer.photo.label || 'Progress photo'} />
            <figcaption>{viewer.photo.label ? `${viewer.photo.label}, ` : ''}{longDate(viewer.photo.taken_at)}</figcaption>
          </figure>
        )}
        {viewer?.compare && (
          <div className="rec-compare">
            {comparePhotos.map((p) => (
              <figure key={p.url} className="rec-view">
                <img src={links[p.url]} alt={p.label || 'Progress photo'} />
                <figcaption>{p.label ? `${p.label}, ` : ''}{longDate(p.taken_at)}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
}
