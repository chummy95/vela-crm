import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import QuestionnaireForm from '../components/QuestionnaireForm';
import { questionnairesAPI } from '../utils/api';
import { formatDate, relativeDay, stageLabels } from '../utils/format';
import { RESPONSE_STATUS, missingRequired, progress } from '../utils/questionnaires';

function stageName(r) {
  if (r.stage_label) return r.stage_label;
  if (!r.project_service) return '';
  return stageLabels(r.project_service)[Number(r.stage_index || 0)] || '';
}

function FillQuestionnaire({ id }) {
  const [response, setResponse] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [missing, setMissing] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const timer = useRef(null);
  const latest = useRef({});

  useEffect(() => {
    questionnairesAPI.getResponse(id)
      .then((r) => { setResponse(r); setAnswers(r.answers || {}); latest.current = r.answers || {}; })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [id]);

  const flush = useCallback(async () => {
    if (!dirty.current) return true;
    clearTimeout(timer.current);
    dirty.current = false;
    setSaveState('saving');
    try {
      await questionnairesAPI.saveAnswers(id, latest.current);
      setSaveState('saved');
      return true;
    } catch (err) {
      dirty.current = true;
      setSaveState('error');
      setError(err.message);
      return false;
    }
  }, [id]);

  useEffect(() => {
    const warn = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); flush(); };
  }, [flush]);

  function onChange(next) {
    setAnswers(next);
    latest.current = next;
    dirty.current = true;
    setSaveState('pending');
    setConfirming(false);
    if (missing.size) setMissing(new Set(missingRequired(response.questions, next).map((q) => q.id)));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  }

  async function handleSubmit() {
    const gaps = missingRequired(response.questions, answers);
    if (gaps.length) {
      setMissing(new Set(gaps.map((q) => q.id)));
      setConfirming(false);
      document.getElementById(`wrap-fq-${gaps[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirming) { setConfirming(true); return; }
    setSubmitting(true);
    setError('');
    clearTimeout(timer.current);
    dirty.current = false;
    try {
      const done = await questionnairesAPI.submit(id, answers);
      setResponse(done);
      window.scrollTo?.(0, 0);
      document.querySelector('.content')?.scrollTo?.({ top: 0 });
    } catch (err) {
      setError(err.message);
      dirty.current = true;
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  const crumb = <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/portal/questionnaires"><Icon name="back" size={16} />Questionnaires</Link></nav>;

  if (!response) {
    return (
      <>
        <div className="topbar">{crumb}</div>
        <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? 'This questionnaire isn’t available.' : 'Loading…'}</div></div>
      </>
    );
  }

  const submitted = response.status === 'submitted';
  const p = progress(response.questions, answers);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const saveText = { saving: 'Saving…', saved: 'All changes saved', pending: 'Saving soon…', error: 'Couldn’t save. Check your connection.' }[saveState] || '';

  return (
    <>
      <div className="topbar">
        {crumb}
        {!submitted && <div className="tb-r"><span className="faint" style={{ fontSize: 12.5 }} aria-live="polite">{saveText}</span></div>}
      </div>
      <div className="content">
        <div className="page q-fill">
          {submitted ? (
            <div className="notice ok" style={{ marginBottom: 20, padding: '16px 18px' }} role="status">
              <div style={{ fontWeight: 600, fontSize: 15 }}>Thank you, your answers are with the studio.</div>
              <div style={{ marginTop: 2 }}>Sent {formatDate(response.submitted_at, { day: 'numeric', month: 'long', year: 'numeric' })}. If you need to change something, send the studio a message.</div>
            </div>
          ) : null}

          <header>
            <div className="muted" style={{ fontSize: 13.5 }}>{response.project_service ? `${response.project_service}${stageName(response) ? `, ${stageName(response)}` : ''}` : 'From the studio'}</div>
            <h1 className="h-display" style={{ marginTop: 4 }}>{response.title}</h1>
            {response.description && <p className="lede" style={{ marginTop: 10 }}>{response.description}</p>}
          </header>

          {!submitted && (
            <div style={{ margin: '22px 0 6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span className="muted">{p.done} of {p.total} answered</span>
                <span className="faint">Your answers save as you type</span>
              </div>
              <div className="q-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div>
            </div>
          )}

          {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}

          <QuestionnaireForm questions={response.questions} answers={answers} onChange={onChange} readOnly={submitted} missing={missing} idPrefix="fq" />

          {!submitted && (
            <div className="q-submitbar">
              <span className="muted" style={{ fontSize: 13.5 }}>
                {missing.size
                  ? <span style={{ color: 'var(--err)' }}>{missing.size === 1 ? 'One required question still needs an answer.' : `${missing.size} required questions still need answers.`}</span>
                  : confirming ? 'Ready to send? You won’t be able to change your answers afterwards.' : 'You can leave and come back. Nothing is sent until you press send.'}
              </span>
              <span className="tb-r">
                {confirming && <button className="btn bq" type="button" onClick={() => setConfirming(false)}>Not yet</button>}
                <button className="btn bp" type="button" disabled={submitting} onClick={handleSubmit}>
                  <Icon name="send" />{submitting ? 'Sending…' : confirming ? 'Yes, send my answers' : 'Send to the studio'}
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function QuestionnaireList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    questionnairesAPI.listResponses()
      .then((r) => setRows([...r].sort((a, b) => (a.status === 'submitted') - (b.status === 'submitted') || String(b.sent_at).localeCompare(String(a.sent_at)))))
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Questionnaires</h1></div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          <div className="panel">
            {rows.length ? (
              <ul className="rows">
                {rows.map((r) => {
                  const p = progress(r.questions, r.answers);
                  const action = r.status === 'submitted' ? 'View answers' : r.status === 'in_progress' ? 'Continue' : 'Start';
                  return (
                    <li key={r.id}>
                      <button type="button" className="row" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', alignItems: 'center' }} onClick={() => navigate(`/portal/questionnaires/${r.id}`)}>
                        <Icon name="clipboard" size={20} className="ico muted" />
                        <span className="row-main">
                          <span className="row-title" style={{ display: 'block' }}>{r.title}</span>
                          <span className="row-sub" style={{ display: 'block' }}>
                            {r.status === 'submitted' ? `Sent ${relativeDay(r.submitted_at)}` : r.status === 'in_progress' ? `${p.done} of ${p.total} answered` : `${p.total} questions, from ${relativeDay(r.sent_at)}`}
                          </span>
                        </span>
                        <Pill status={RESPONSE_STATUS[r.status]?.pill || 'pending'} label={r.status === 'submitted' ? 'Sent' : RESPONSE_STATUS[r.status]?.label} />
                        <span className="btn bg bsm hide-sm" aria-hidden="true">{action}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'Nothing to fill in right now. When the studio sends you a questionnaire, it appears here.' : 'Loading…'}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function PortalQuestionnaires() {
  const params = useParams();
  const id = (params['*'] || '').split('/')[0];
  return id ? <FillQuestionnaire id={id} /> : <QuestionnaireList />;
}
