import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { filesAPI, reviewsAPI } from '../utils/api';

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

const isImage = (f) => f.kind !== 'link' && (/^image\//.test(f.type || '') || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(f.url));

// Private files (uploaded to Vela's store) open through short-lived links fetched per review.
function useOpenableFiles(reviewId, files) {
  const privateUrls = files.filter((f) => f.pathname).map((f) => f.url);
  const key = `${reviewId}|${privateUrls.join('|')}`;
  const [state, setState] = useState({ key: '', links: {}, error: '' });

  useEffect(() => {
    if (!privateUrls.length) return undefined;
    let cancelled = false;
    const load = () => filesAPI.links(reviewId, privateUrls)
      .then((links) => { if (!cancelled) setState({ key, links, error: '' }); })
      .catch((err) => { if (!cancelled) setState({ key, links: {}, error: err.message }); });
    load();
    const timer = setInterval(load, 45 * 60 * 1000); // links last an hour
    return () => { cancelled = true; clearInterval(timer); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !privateUrls.length || state.key === key;
  return {
    error: state.key === key ? state.error : '',
    files: files.map((f) => (f.pathname ? { ...f, href: ready ? state.links[f.url] || '' : '' , pending: !ready } : { ...f, href: f.url })),
  };
}

// Images as a gallery; everything else (PDFs, archives, links) as a list.
export function FileList({ files: rawFiles = [], reviewId, download = false }) {
  const { files, error } = useOpenableFiles(reviewId, rawFiles);
  const images = files.filter(isImage);
  const others = files.filter((f) => !isImage(f));
  return (
    <div>
      {error && <div className="form-error">{error}</div>}
      {images.length > 0 && (
        <div className="gallery">
          {images.map((f) => (
            <figure key={f.url} className="gallery-item">
              {f.href ? (
                <a href={f.href} target="_blank" rel="noreferrer" title={`Open ${f.name} full size`}>
                  <img src={f.href} alt={f.name} loading="lazy" />
                </a>
              ) : <div className="gallery-wait">{f.pending ? 'Loading…' : 'Not available'}</div>}
              <figcaption>
                <span>{f.name}</span>
                {download && f.href && <a href={f.href} download={f.name} target="_blank" rel="noreferrer">Download</a>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="file-rows">
          {others.map((f) => (
            <li key={f.url}>
              <a className="file-row" href={f.href || undefined} aria-disabled={!f.href} target="_blank" rel="noreferrer" download={download && f.kind !== 'link' ? f.name : undefined}>
                <Icon name={f.kind === 'link' ? 'link' : 'proposal'} size={18} className="ico muted" />
                <span className="row-main">
                  <span className="row-title" style={{ display: 'block' }}>{f.name}</span>
                  <span className="row-sub" style={{ display: 'block' }}>
                    {f.kind === 'link' ? new URL(f.url).hostname.replace(/^www\./, '') : [String(f.type || '').split('/').pop().toUpperCase(), formatBytes(f.size)].filter(Boolean).join(', ')}
                  </span>
                </span>
                <span className="faint" style={{ fontSize: 13 }}>{f.pending ? 'Loading…' : !f.href ? 'Not available' : f.kind === 'link' ? 'Open link' : download ? 'Download' : 'Open'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function when(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Live comment thread on a review. `viewer` is 'studio' or 'client'.
export function CommentThread({ reviewId, viewer, placeholder = 'Write a comment', disabled = false }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => reviewsAPI.subscribeComments(reviewId, setComments, (err) => setError(err.message)), [reviewId]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [comments.length]);

  async function send(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError('');
    try {
      await reviewsAPI.addComment(reviewId, draft);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="thread">
      {comments.length === 0 && <p className="muted" style={{ fontSize: 13.5 }}>No comments yet.</p>}
      {comments.map((c) => {
        const mine = c.author_role === viewer;
        return (
          <div key={c.id} className={`bubble-row${mine ? ' out' : ''}`}>
            <div className="bubble">
              {c.decision && <div className="bubble-tag">{c.decision === 'approved' ? 'Approved' : 'Asked for changes'}</div>}
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
              <div className="bubble-time">{mine ? 'You' : c.author_name}, {when(c.created_at)}</div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}
      {!disabled && (
        <form onSubmit={send} className="chat-compose" style={{ padding: '12px 0 0', border: 'none', background: 'transparent' }}>
          <label className="sr-only" htmlFor={`comment-${reviewId}`}>Comment</label>
          <textarea
            id={`comment-${reviewId}`}
            className="fi"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
            placeholder={placeholder}
            style={{ minHeight: 44, resize: 'vertical' }}
          />
          <button className="btn bp" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Comment'}</button>
        </form>
      )}
    </div>
  );
}

export const REVIEW_STATUS = {
  in_review: { label: 'Waiting for client', pill: 'pending' },
  approved: { label: 'Approved', pill: 'approved' },
  changes_requested: { label: 'Changes requested', pill: 'overdue' },
  delivered: { label: 'Delivered', pill: 'completed' },
};
