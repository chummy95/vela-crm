import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { formatBytes } from './ReviewParts';
import { reviewsAPI, uploadsAPI } from '../utils/api';

// Share work for a step: upload files and/or add links, add a note, send to the client.
// With kind="delivery" it hands over the final files instead (no approval needed).
export default function ReviewComposer({ open, onClose, onSent, project, stageIndex, step, kind = 'review', round = 1 }) {
  const [note, setNote] = useState('');
  const [items, setItems] = useState([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadsReady, setUploadsReady] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setNote('');
    setItems([]);
    setLinkUrl('');
    setLinkName('');
    setError('');
    uploadsAPI.status().then((s) => setUploadsReady(Boolean(s.configured)));
  }, [open]);

  function update(key, changes) {
    setItems((current) => current.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const added = files.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, name: file.name, size: file.size, type: file.type, progress: 0, status: 'uploading' }));
    setItems((current) => [...current, ...added]);
    await Promise.all(files.map(async (file, i) => {
      const key = added[i].key;
      try {
        const uploaded = await uploadsAPI.upload(file, {
          folder: `projects/${project.id}/${step.id}`,
          onProgress: (pct) => update(key, { progress: Math.round(pct) }),
        });
        update(key, { ...uploaded, progress: 100, status: 'done' });
      } catch (err) {
        update(key, { status: 'error', error: err.message || 'Upload failed' });
      }
    }));
  }

  function addLink(event) {
    event.preventDefault();
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      setItems((current) => [...current, { key: `link-${Math.random()}`, name: linkName.trim() || host, url, kind: 'link', status: 'done' }]);
      setLinkUrl('');
      setLinkName('');
    } catch {
      setError('That link doesn’t look right.');
    }
  }

  async function send() {
    const ready = items.filter((it) => it.status === 'done');
    if (!ready.length) { setError('Add at least one file or link.'); return; }
    setSending(true);
    setError('');
    try {
      const sent = await reviewsAPI.send({
        project_id: project.id,
        stage_index: stageIndex,
        step_id: step.id,
        title: step.label,
        note,
        kind,
        files: ready.map(({ name, url, type, size, kind: k }) => ({ name, url, type, size, kind: k || 'file' })),
      });
      onSent?.(sent);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const uploading = items.some((it) => it.status === 'uploading');
  const delivery = kind === 'delivery';
  const client = project?.client_name || 'the client';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={delivery ? 'Hand over the final files' : round > 1 ? `Send a revised ${step?.label?.toLowerCase()}` : `Share ${step?.label?.toLowerCase()} for review`}
      footer={
        <>
          <button className="btn bg" type="button" onClick={onClose}>Cancel</button>
          <button className="btn bp" type="button" disabled={sending || uploading || !items.some((it) => it.status === 'done')} onClick={send}>
            <Icon name="send" />{sending ? 'Sending…' : uploading ? 'Uploading…' : delivery ? `Send to ${client}` : `Send to ${client} for approval`}
          </button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
        {delivery
          ? `${client} will be able to download these from their portal straight away.`
          : `${client} will see this in their portal, can leave comments, and can approve it or ask for changes. You’ll be notified either way.`}
      </p>

      <div
        className={`dropzone${dragging ? ' on' : ''}${uploadsReady === false ? ' off' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (uploadsReady) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (uploadsReady) addFiles(e.dataTransfer.files); }}
      >
        {uploadsReady === false ? (
          <span className="muted" style={{ fontSize: 13.5 }}>File uploads aren’t switched on yet, so add links below for now.</span>
        ) : (
          <>
            <Icon name="plus" size={20} className="ico muted" />
            <span style={{ fontSize: 14 }}>Drop files here or <button type="button" className="auth-link" onClick={() => inputRef.current?.click()}>choose files</button></span>
            <span className="faint" style={{ fontSize: 12.5 }}>PDFs, images, ZIPs and design files, up to 500 MB each</span>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </>
        )}
      </div>

      <form onSubmit={addLink} className="fi-row" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'end', marginTop: 14 }}>
        <div className="fc" style={{ marginBottom: 0 }}>
          <label className="fc-label" htmlFor="rc-link">Or add a link</label>
          <input id="rc-link" className="fi" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Drive, Dropbox or Figma link" />
        </div>
        <div className="fc" style={{ marginBottom: 0 }}>
          <label className="fc-label" htmlFor="rc-link-name">Link name <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input id="rc-link-name" className="fi" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Presentation in Figma" />
        </div>
        <button className="btn bg" type="submit" disabled={!linkUrl.trim()}>Add link</button>
      </form>

      {items.length > 0 && (
        <ul className="file-rows" style={{ marginTop: 14 }}>
          {items.map((it) => (
            <li key={it.key} className="file-row" style={{ cursor: 'default' }}>
              <Icon name={it.kind === 'link' ? 'link' : 'proposal'} size={18} className="ico muted" />
              <span className="row-main">
                <span className="row-title" style={{ display: 'block' }}>{it.name}</span>
                <span className="row-sub" style={{ display: 'block', color: it.status === 'error' ? 'var(--err)' : undefined }}>
                  {it.status === 'uploading' ? `Uploading ${it.progress || 0}%` : it.status === 'error' ? it.error : it.kind === 'link' ? it.url : formatBytes(it.size)}
                </span>
                {it.status === 'uploading' && <span className="q-progress" style={{ marginTop: 6, display: 'block' }}><span style={{ width: `${it.progress || 0}%` }} /></span>}
              </span>
              <button type="button" className="mc" aria-label={`Remove ${it.name}`} onClick={() => setItems((c) => c.filter((x) => x.key !== it.key))}><Icon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="fc" style={{ marginTop: 16, marginBottom: 0 }}>
        <label className="fc-label" htmlFor="rc-note">Note to {client} <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></label>
        <textarea id="rc-note" className="fi" value={note} onChange={(e) => setNote(e.target.value)} placeholder={delivery ? 'What’s included and how to use it' : 'What you’d like them to look at, and any questions'} />
      </div>
    </Modal>
  );
}
