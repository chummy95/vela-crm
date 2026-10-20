import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import ReviewComposer from '../components/ReviewComposer';
import { CommentThread, FileList, REVIEW_STATUS } from '../components/ReviewParts';
import { useQuestionnaireAlerts, reviewNeedsLook } from '../hooks/useQuestionnaireAlerts';
import { projectsAPI, reviewsAPI } from '../utils/api';
import { getWorkflow } from '../utils/workflow';
import { formatDate } from '../utils/format';

const stamp = (v) => (v ? formatDate(v, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Studio view of one piece of shared work: files, the client's decision, comments and earlier versions.
export default function Review() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reviews: liveReviews } = useQuestionnaireAlerts();
  const [fetched, setFetched] = useState(null);
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [composer, setComposer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const review = liveReviews.find((r) => r.id === id) || fetched;

  useEffect(() => {
    setLoaded(false);
    setConfirmDelete(false);
    reviewsAPI.get(id)
      .then((r) => {
        setFetched(r);
        return projectsAPI.get(r.project_id).then(setProject).catch(() => {});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [id]);

  // Opening the page counts as seeing the client's latest activity.
  useEffect(() => {
    if (review && reviewNeedsLook(review)) reviewsAPI.markSeen(review.id).catch(() => {});
  }, [review?.id, review?.client_activity_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const rounds = useMemo(() => {
    if (!review) return [];
    const all = liveReviews.length ? liveReviews : [review];
    return all.filter((r) => r.project_id === review.project_id && r.step_id === review.step_id).sort((a, b) => b.round - a.round);
  }, [liveReviews, review]);

  if (!review) {
    return (
      <>
        <div className="topbar"><nav className="tb-crumb"><Link to="/projects"><Icon name="back" size={16} />Projects</Link></nav></div>
        <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? (error || 'This review doesn’t exist any more.') : 'Loading…'}</div></div>
      </>
    );
  }

  const status = REVIEW_STATUS[review.status] || REVIEW_STATUS.in_review;
  const latest = rounds[0]?.id === review.id || !rounds.length;
  const delivery = review.kind === 'delivery';
  const step = project ? getWorkflow(project)[review.stage_index]?.steps.find((s) => s.id === review.step_id) : null;

  async function markApproved() {
    setBusy(true);
    setError('');
    try {
      await reviewsAPI.setStatus(review.id, 'approved');
      setFetched((r) => ({ ...r, status: 'approved' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await reviewsAPI.remove(review.id);
      navigate(`/projects/${review.project_id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <nav className="tb-crumb" aria-label="Breadcrumb">
          <Link to={`/projects/${review.project_id}`}><Icon name="back" size={16} />{review.client_name}, {review.project_service || 'project'}</Link>
        </nav>
        <div className="tb-r">
          <button className="btn bq" type="button" disabled={busy} onClick={remove}>{confirmDelete ? 'Yes, delete it' : 'Delete'}</button>
          {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep</button>}
          {latest && !delivery && review.status === 'in_review' && <button className="btn bg" type="button" disabled={busy} onClick={markApproved}><Icon name="check" />Mark approved</button>}
          {latest && !delivery && review.status !== 'approved' && <button className={`btn ${review.status === 'changes_requested' ? 'bp' : 'bg'}`} type="button" onClick={() => setComposer(true)}><Icon name="send" />Send revised version</button>}
        </div>
      </div>
      <div className="content">
        <div className="page">
          <header className="review-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="muted" style={{ fontSize: 13.5 }}>{review.stage_label}{review.round > 1 ? `, version ${review.round}` : ''}</div>
              <h1 className="h-display">{review.title}</h1>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                {delivery ? 'Delivered' : 'Shared'} with {review.contact_name || review.client_name} on {stamp(review.sent_at)}
              </div>
            </div>
            <Pill status={status.pill} label={status.label} />
          </header>

          {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}
          {confirmDelete && <div className="form-error" style={{ marginTop: 16 }}>This removes the files list and comments for this version. The client won’t see it any more.</div>}
          {!latest && <div className="locked-note" style={{ marginTop: 16 }}><Icon name="clipboard" size={16} />This is an earlier version. <Link to={`/reviews/${rounds[0].id}`}>Open the latest</Link></div>}

          <div className="split section">
            <section aria-label="Shared work">
              {review.status === 'changes_requested' && review.decision_note && (
                <div className="decision" style={{ marginBottom: 18, borderColor: 'var(--brass)' }}>
                  <div className="row-title">{review.contact_name || review.client_name} asked for changes, {stamp(review.decided_at)}</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{review.decision_note}</div>
                </div>
              )}
              {review.status === 'approved' && (
                <div className="decision approved" style={{ marginBottom: 18 }}>
                  <div className="row-title" style={{ color: 'var(--ok)' }}><Icon name="check" size={16} /> Approved{review.decided_at ? ` on ${stamp(review.decided_at)}` : ''}</div>
                  {review.decision_note && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{review.decision_note}</div>}
                </div>
              )}
              {review.note && <div className="review-note">{review.note}</div>}
              <div className="panel" style={{ padding: 18 }}>
                <h2 className="card-title" style={{ marginBottom: 12 }}>{delivery ? 'Final files' : 'Files'}</h2>
                <FileList files={review.files || []} reviewId={review.id} />
              </div>
              {rounds.length > 1 && (
                <div className="panel" style={{ padding: 18, marginTop: 18 }}>
                  <h2 className="card-title" style={{ marginBottom: 6 }}>Versions</h2>
                  <ol className="rounds">
                    {rounds.map((r) => (
                      <li key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className="row-main">{r.id === review.id ? <b>Version {r.round}</b> : <Link to={`/reviews/${r.id}`}>Version {r.round}</Link>} <span className="faint">sent {stamp(r.sent_at)}</span></span>
                        <Pill status={(REVIEW_STATUS[r.status] || REVIEW_STATUS.in_review).pill} label={(REVIEW_STATUS[r.status] || REVIEW_STATUS.in_review).label} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
            <aside className="panel" style={{ padding: 18, alignSelf: 'start' }} aria-labelledby="cm-h">
              <h2 id="cm-h" className="card-title" style={{ marginBottom: 12 }}>Comments</h2>
              <CommentThread reviewId={review.id} viewer="studio" placeholder={`Reply to ${review.contact_name || review.client_name}`} />
            </aside>
          </div>
        </div>
      </div>
      {project && (
        <ReviewComposer
          open={composer}
          onClose={() => setComposer(false)}
          onSent={(sent) => navigate(`/reviews/${sent.id}`)}
          project={project}
          stageIndex={review.stage_index}
          step={step || { id: review.step_id, label: review.title }}
          round={review.round + 1}
        />
      )}
    </>
  );
}
