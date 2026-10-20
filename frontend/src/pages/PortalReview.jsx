import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import { CommentThread, FileList } from '../components/ReviewParts';
import { reviewsAPI } from '../utils/api';
import { formatDate } from '../utils/format';

const stamp = (v) => (v ? formatDate(v, { day: 'numeric', month: 'long' }) : '');

const CLIENT_STATUS = {
  in_review: { label: 'Waiting for you', pill: 'pending' },
  approved: { label: 'Approved', pill: 'approved' },
  changes_requested: { label: 'Changes requested', pill: 'overdue' },
  delivered: { label: 'Ready to download', pill: 'completed' },
};

// The client's view of work shared for review: look, comment, then approve or ask for changes.
export default function PortalReview() {
  const { id } = useParams();
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setMode('');
    reviewsAPI.get(id).then(setReview).catch((err) => setError(err.message)).finally(() => setLoaded(true));
  }, [id]);

  if (!review) {
    return (
      <>
        <div className="topbar"><nav className="tb-crumb"><Link to="/portal/projects"><Icon name="back" size={16} />Projects</Link></nav></div>
        <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? 'This isn’t available any more.' : 'Loading…'}</div></div>
      </>
    );
  }

  const delivery = review.kind === 'delivery';
  const status = CLIENT_STATUS[review.status] || CLIENT_STATUS.in_review;
  const waiting = review.status === 'in_review';

  async function decide(decision) {
    if (decision === 'changes_requested' && !note.trim()) {
      setError('Let us know what you’d like changed.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await reviewsAPI.decide(review.id, decision, note);
      setReview({ ...review, ...updated });
      setMode('');
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <nav className="tb-crumb" aria-label="Breadcrumb"><Link to={`/portal/projects/${review.project_id}`}><Icon name="back" size={16} />{review.project_service || 'Your project'}</Link></nav>
      </div>
      <div className="content">
        <div className="page">
          <header className="review-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="muted" style={{ fontSize: 13.5 }}>{review.stage_label}{review.round > 1 ? `, version ${review.round}` : ''}</div>
              <h1 className="h-display">{delivery ? 'Your final files' : review.title}</h1>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Shared on {stamp(review.sent_at)}</div>
            </div>
            <Pill status={status.pill} label={status.label} />
          </header>

          {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}

          <div className="split section">
            <section aria-label={delivery ? 'Final files' : 'Work to review'}>
              {review.note && <div className="review-note">{review.note}</div>}
              <div className="panel" style={{ padding: 18 }}>
                <h2 className="card-title" style={{ marginBottom: 12 }}>{delivery ? 'Download your files' : 'Have a look'}</h2>
                <FileList files={review.files || []} reviewId={review.id} download={delivery} />
              </div>

              {!delivery && (
                <div style={{ marginTop: 18 }}>
                  {waiting && !mode && (
                    <div className="decision">
                      <div className="row-title">Happy with how this looks?</div>
                      <div className="muted" style={{ fontSize: 13.5 }}>Approve it to move to the next step, or tell us what you’d like changed. You can also leave comments first.</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        <button className="btn bp" type="button" onClick={() => setMode('approve')}><Icon name="check" />Approve</button>
                        <button className="btn bg" type="button" onClick={() => setMode('changes')}>Request changes</button>
                      </div>
                    </div>
                  )}
                  {waiting && mode && (
                    <div className="decision">
                      <label className="row-title" htmlFor="decision-note">{mode === 'approve' ? 'Approve this' : 'What would you like changed?'}</label>
                      <textarea
                        id="decision-note"
                        className="fi"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={mode === 'approve' ? 'Anything you’d like to add? (optional)' : 'Be as specific as you can, it helps the next version land.'}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn bp" type="button" disabled={saving} onClick={() => decide(mode === 'approve' ? 'approved' : 'changes_requested')}>
                          {saving ? 'Sending…' : mode === 'approve' ? 'Confirm approval' : 'Send change request'}
                        </button>
                        <button className="btn bq" type="button" onClick={() => { setMode(''); setError(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {review.status === 'approved' && (
                    <div className="decision approved">
                      <div className="row-title" style={{ color: 'var(--ok)' }}>You approved this{review.decided_at ? ` on ${stamp(review.decided_at)}` : ''}. Thank you.</div>
                    </div>
                  )}
                  {review.status === 'changes_requested' && (
                    <div className="decision">
                      <div className="row-title">You asked for changes{review.decided_at ? ` on ${stamp(review.decided_at)}` : ''}</div>
                      {review.decision_note && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{review.decision_note}</div>}
                      <div className="muted" style={{ fontSize: 13.5 }}>A revised version will appear in your project when it’s ready.</div>
                    </div>
                  )}
                </div>
              )}
            </section>
            <aside className="panel" style={{ padding: 18, alignSelf: 'start' }} aria-labelledby="cm-h">
              <h2 id="cm-h" className="card-title" style={{ marginBottom: 4 }}>Comments</h2>
              <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Questions, thoughts or remarks. The studio is notified.</p>
              <CommentThread reviewId={review.id} viewer="client" placeholder="Write your comments" />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
