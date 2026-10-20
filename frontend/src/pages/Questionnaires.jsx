import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import QuestionnaireForm from '../components/QuestionnaireForm';
import SendQuestionnaire from '../components/SendQuestionnaire';
import { desktopAlertsState, enableDesktopAlerts, useQuestionnaireAlerts } from '../hooks/useQuestionnaireAlerts';
import { clientsAPI, questionnairesAPI } from '../utils/api';
import { formatDate, relativeDay, stageLabels } from '../utils/format';
import {
  QUESTION_TYPES, RESPONSE_STATUS, answerableQuestions, blankQuestion, brandStrategyStarter, hasAnswer, progress, questionsFromText,
} from '../utils/questionnaires';

const longDate = { day: 'numeric', month: 'long', year: 'numeric' };

function stageName(r) {
  if (!r.project_service) return '';
  const labels = stageLabels(r.project_service);
  return labels[Number(r.stage_index || 0)] || '';
}

function statusLabel(r) {
  if (r.status === 'in_progress') {
    const p = progress(r.questions, r.answers);
    return `In progress, ${p.done} of ${p.total}`;
  }
  return RESPONSE_STATUS[r.status]?.label || 'Not started';
}

/* ── Answers view ─────────────────────────────────────────────── */
function ResponseView({ id }) {
  const navigate = useNavigate();
  const [response, setResponse] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    questionnairesAPI.getResponse(id)
      .then((r) => {
        setResponse(r);
        if (r.status === 'submitted' && !r.seen_by_studio) questionnairesAPI.markSeen(id).catch(() => {});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [id]);

  async function reopen() {
    if (confirm !== 'reopen') { setConfirm('reopen'); return; }
    setBusy(true);
    try {
      const changes = await questionnairesAPI.reopen(id);
      setResponse((r) => ({ ...r, ...changes }));
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (confirm !== 'delete') { setConfirm('delete'); return; }
    setBusy(true);
    try {
      await questionnairesAPI.removeResponse(id);
      navigate('/questionnaires');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const crumb = <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/questionnaires"><Icon name="back" size={16} />Questionnaires</Link></nav>;

  if (!response) {
    return (
      <>
        <div className="topbar">{crumb}</div>
        <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? (error || 'This questionnaire doesn’t exist any more.') : 'Loading…'}</div></div>
      </>
    );
  }

  const p = progress(response.questions, response.answers);
  const submitted = response.status === 'submitted';
  const stage = stageName(response);

  return (
    <>
      <div className="topbar">
        {crumb}
        <div className="tb-r">
          {submitted && <button className="btn bg" type="button" onClick={() => window.print()}><Icon name="print" />Print or save as PDF</button>}
          {submitted && (
            <>
              {confirm === 'reopen' && <button className="btn bq" type="button" onClick={() => setConfirm('')}>Cancel</button>}
              <button className="btn bg" type="button" disabled={busy} onClick={reopen}>{confirm === 'reopen' ? 'Yes, let them edit it again' : 'Reopen for edits'}</button>
            </>
          )}
        </div>
      </div>
      <div className="content">
        <div className="page" style={{ maxWidth: 860 }}>
          {error && <div className="form-error">{error}</div>}
          {!submitted && (
            <div className="notice no-print" style={{ background: 'var(--info-bg)', color: 'var(--info)', marginBottom: 16 }}>
              {response.status === 'sent' ? `Sent ${relativeDay(response.sent_at)}. ${response.contact_name || response.client_name} hasn’t started it yet.` : `${response.contact_name || response.client_name} is filling it in: ${p.done} of ${p.total} answered so far. You’ll be notified when they submit.`}
            </div>
          )}
          <article className="doc-preview" style={{ position: 'static' }}>
            <div className="doc-kicker">
              {submitted ? `Submitted ${formatDate(response.submitted_at, longDate)}` : statusLabel(response)}
            </div>
            <h1 className="doc-title">{response.title}</h1>
            <div className="doc-for">
              {response.contact_name ? `${response.contact_name}, ` : ''}{response.client_name}
              {response.project_service ? ` · ${response.project_service}${stage ? `, ${stage}` : ''}` : ''}
            </div>
            {response.questions.map((q) => {
              if (q.type === 'section') return <h3 key={q.id} style={{ marginTop: 30 }}>{q.label}</h3>;
              const a = response.answers?.[q.id];
              return (
                <div key={q.id} className="answer-block">
                  <div className="answer-q">{q.label}</div>
                  <div className={`answer-a${hasAnswer(a) ? '' : ' none'}`}>{hasAnswer(a) ? (Array.isArray(a) ? a.join(', ') : a) : 'No answer'}</div>
                </div>
              );
            })}
          </article>
          <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {response.project_id && <Link className="btn bg" to={`/projects/${response.project_id}`}><Icon name="folder" />Open project</Link>}
            <Link className="btn bg" to={`/clients/${response.client_id}`}><Icon name="users" />Client profile</Link>
            <span style={{ marginLeft: 'auto' }} />
            {confirm === 'delete' && <button className="btn bq" type="button" onClick={() => setConfirm('')}>Keep it</button>}
            <button className="btn bd" type="button" disabled={busy} onClick={remove}>{confirm === 'delete' ? 'Yes, delete it and the answers' : 'Delete'}</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Template editor ──────────────────────────────────────────── */
function TemplateEditor({ id }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [sentNote, setSentNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    questionnairesAPI.getTemplate(id)
      .then((t) => setForm({ title: t.title || '', description: t.description || '', questions: t.questions || [] }))
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [id]);

  function update(changes) {
    setForm((f) => ({ ...f, ...changes }));
    setDirty(true);
  }

  function updateQuestion(index, changes) {
    update({ questions: form.questions.map((q, i) => (i === index ? { ...q, ...changes } : q)) });
  }

  function move(index, dir) {
    const next = form.questions.slice();
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    update({ questions: next });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const saved = await questionnairesAPI.updateTemplate(id, form);
      setForm((f) => ({ ...f, questions: saved.questions || f.questions }));
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function openSend() {
    if (dirty && !(await save())) return;
    setSendOpen(true);
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await questionnairesAPI.removeTemplate(id);
      navigate('/questionnaires?tab=templates');
    } catch (err) {
      setError(err.message);
    }
  }

  const crumb = <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/questionnaires?tab=templates"><Icon name="back" size={16} />Questionnaires</Link></nav>;
  if (!form) {
    return (
      <>
        <div className="topbar">{crumb}</div>
        <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? (error || 'This questionnaire doesn’t exist any more.') : 'Loading…'}</div></div>
      </>
    );
  }

  const count = answerableQuestions(form.questions).length;

  return (
    <>
      <div className="topbar">
        {crumb}
        <div className="tb-r">
          <span className="faint" style={{ fontSize: 12.5 }}>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt}` : ''}</span>
          <div className="segmented" role="tablist" aria-label="Editor view">
            <button type="button" role="tab" aria-selected={!preview} className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>Edit</button>
            <button type="button" role="tab" aria-selected={preview} className={preview ? 'on' : ''} onClick={() => setPreview(true)}>Preview</button>
          </div>
          <button className="btn bg" type="button" disabled={saving || !dirty} onClick={save}>Save</button>
          <button className="btn bp" type="button" disabled={saving || !count} onClick={openSend}><Icon name="send" />Send to a client</button>
        </div>
      </div>
      <div className="content">
        <div className="page" style={{ maxWidth: 860 }}>
          {error && <div className="form-error">{error}</div>}
          {sentNote && <div className="notice ok" style={{ marginBottom: 16 }}>{sentNote}</div>}

          {preview ? (
            <div className="panel" style={{ padding: '28px 32px' }}>
              <div className="muted" style={{ fontSize: 13 }}>This is what your client sees</div>
              <h1 className="h-display" style={{ marginTop: 4 }}>{form.title || 'Untitled questionnaire'}</h1>
              {form.description && <p className="lede" style={{ marginTop: 8 }}>{form.description}</p>}
              <QuestionnaireForm questions={form.questions.filter((q) => q.label)} answers={{}} readOnly idPrefix="pv" />
            </div>
          ) : (
            <>
              <div className="panel" style={{ padding: 22, marginBottom: 16 }}>
                <div className="fc">
                  <label className="fc-label" htmlFor="qt-title">Title</label>
                  <input id="qt-title" className="fi" value={form.title} onChange={(e) => update({ title: e.target.value })} style={{ fontSize: 16 }} />
                </div>
                <div className="fc" style={{ marginBottom: 0 }}>
                  <label className="fc-label" htmlFor="qt-desc">Introduction for the client</label>
                  <textarea id="qt-desc" className="fi" value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="What this is for and how long it takes" />
                </div>
              </div>

              <ol style={{ listStyle: 'none' }}>
                {form.questions.map((q, index) => {
                  const isSection = q.type === 'section';
                  return (
                    <li key={q.id} className={`panel q-editor-item${isSection ? ' section' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <select className="fi fsel" style={{ width: 'auto', padding: '5px 28px 5px 9px', fontSize: 13 }} value={q.type} onChange={(e) => updateQuestion(index, { type: e.target.value })} aria-label={`Type for item ${index + 1}`}>
                          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <span className="tb-r">
                          <button className="btn bq bxs" type="button" onClick={() => move(index, -1)} disabled={index === 0}>Move up</button>
                          <button className="btn bq bxs" type="button" onClick={() => move(index, 1)} disabled={index === form.questions.length - 1}>Move down</button>
                          <button className="btn bd bxs" type="button" onClick={() => update({ questions: form.questions.filter((_, i) => i !== index) })}>Remove</button>
                        </span>
                      </div>
                      <input
                        className="fi"
                        value={q.label}
                        onChange={(e) => updateQuestion(index, { label: e.target.value })}
                        placeholder={isSection ? 'Section heading, for example “Your audience”' : 'Your question'}
                        aria-label={isSection ? 'Section heading' : 'Question'}
                        style={isSection ? { fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600 } : { fontWeight: 500 }}
                      />
                      {!isSection && (
                        <>
                          <input className="fi" style={{ marginTop: 8, fontSize: 13 }} value={q.help || ''} onChange={(e) => updateQuestion(index, { help: e.target.value })} placeholder="Hint shown under the question (optional)" aria-label="Hint" />
                          {(q.type === 'choice' || q.type === 'checkboxes') && (
                            <input className="fi" style={{ marginTop: 8, fontSize: 13 }} value={q.options || ''} onChange={(e) => updateQuestion(index, { options: e.target.value })} placeholder="Choices, separated by commas" aria-label="Choices" />
                          )}
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 10, cursor: 'pointer' }}>
                            <input type="checkbox" checked={Boolean(q.required)} onChange={(e) => updateQuestion(index, { required: e.target.checked })} />
                            Must be answered
                          </label>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="tb-r" style={{ marginTop: 4 }}>
                <button className="btn bg" type="button" onClick={() => update({ questions: [...form.questions, blankQuestion('textarea')] })}><Icon name="plus" />Add a question</button>
                <button className="btn bg" type="button" onClick={() => update({ questions: [...form.questions, blankQuestion('section')] })}><Icon name="plus" />Add a section</button>
                <button className="btn bq" type="button" onClick={() => { setPasteText(''); setPasteOpen(true); }}>Paste questions in</button>
              </div>

              <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
                <button className="btn bd" type="button" onClick={remove}>{confirmDelete ? 'Yes, delete this questionnaire' : 'Delete questionnaire'}</button>
                {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button>}
              </div>
              {confirmDelete && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Copies you’ve already sent to clients, and their answers, are kept.</p>}
            </>
          )}
        </div>
      </div>

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Paste questions in"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setPasteOpen(false)}>Cancel</button>
            <button
              className="btn bp"
              type="button"
              disabled={!questionsFromText(pasteText).length}
              onClick={() => { update({ questions: [...form.questions, ...questionsFromText(pasteText)] }); setPasteOpen(false); }}
            >
              Add {questionsFromText(pasteText).length || ''} {questionsFromText(pasteText).length === 1 ? 'item' : 'items'}
            </button>
          </>
        }
      >
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>
          Paste from your existing questionnaire, one question per line. Start a line with # to make it a section heading. Numbers and bullets are removed for you.
        </p>
        <textarea className="fi" rows={12} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'# About your business\nWhat does your business do?\nWho is your ideal customer?'} aria-label="Questions to add" autoFocus />
      </Modal>

      <SendQuestionnaire
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        defaults={{ template_id: id }}
        onSent={(r) => setSentNote(`Sent to ${r.client_name}. It’s in their portal now.`)}
      />
    </>
  );
}

/* ── List: sent questionnaires and templates ─────────────────── */
function QuestionnaireList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'templates' ? 'templates' : 'sent';
  const { responses, loaded: responsesLoaded } = useQuestionnaireAlerts();
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [alerts, setAlerts] = useState(desktopAlertsState());
  const [emailOn, setEmailOn] = useState(null);

  useEffect(() => {
    Promise.all([questionnairesAPI.listTemplates(), clientsAPI.list()])
      .then(([t, c]) => { setTemplates(t); setClients(c); })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
    fetch('/api/notify-submission')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEmailOn(d && typeof d.configured === 'boolean' ? d.configured : null))
      .catch(() => setEmailOn(null));
  }, []);

  const rows = useMemo(() => [...responses].sort((a, b) => {
    const rank = (r) => (r.status === 'submitted' && !r.seen_by_studio ? 0 : r.status === 'submitted' ? 2 : 1);
    return rank(a) - rank(b) || String(b.updated_at).localeCompare(String(a.updated_at));
  }), [responses]);

  async function create(kind) {
    setCreating(true);
    setError('');
    try {
      const body = kind === 'starter' ? brandStrategyStarter() : { title: 'Untitled questionnaire', description: '', questions: [blankQuestion('textarea')] };
      if (kind === 'blank') body.questions[0].label = 'Your first question';
      const created = await questionnairesAPI.createTemplate(body);
      navigate(`/questionnaires/templates/${created.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const colorFor = (clientId) => clients.find((c) => c.id === clientId)?.color;
  const hasStarter = templates.some((t) => t.title === brandStrategyStarter().title);

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Questionnaires</h1>
        <div className="tb-r">
          <div className="segmented" role="tablist" aria-label="Questionnaires view">
            <button type="button" role="tab" aria-selected={tab === 'sent'} className={tab === 'sent' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>
              Sent to clients <span className="faint">{responses.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'templates'} className={tab === 'templates' ? 'on' : ''} onClick={() => setParams({ tab: 'templates' }, { replace: true })}>
              Your questionnaires <span className="faint">{templates.length}</span>
            </button>
          </div>
          <button className="btn bp" type="button" onClick={() => setSendOpen(true)}><Icon name="send" />Send a questionnaire</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}

          <div className="tb-r" style={{ marginBottom: 14, fontSize: 13 }}>
            <span className="muted">You’re notified in Vela when a client submits.</span>
            {alerts === 'default' && <button type="button" className="auth-link" onClick={async () => setAlerts(await enableDesktopAlerts())}>Also show desktop alerts</button>}
            {alerts === 'granted' && <span className="muted">Desktop alerts are on.</span>}
            {emailOn === true && <span className="muted">Email alerts are on.</span>}
            {emailOn === false && <span style={{ color: 'var(--warn)' }}>Email alerts aren’t set up yet.</span>}
          </div>

          {tab === 'sent' && (
            <div className="panel tbl-wrap">
              {rows.length ? (
                <table className="tbl">
                  <thead><tr><th>Client</th><th>Questionnaire</th><th className="hide-sm">Project stage</th><th>Status</th><th className="r hide-sm">Updated</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const isNew = r.status === 'submitted' && !r.seen_by_studio;
                      return (
                        <tr key={r.id} onClick={() => navigate(`/questionnaires/responses/${r.id}`)}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <ClientMark name={r.client_name} color={colorFor(r.client_id)} size={28} />
                              <span style={{ fontWeight: 500 }}>{r.client_name}</span>
                            </div>
                          </td>
                          <td>
                            {r.title}
                            {isNew && <span className="ni-badge" style={{ marginLeft: 8, display: 'inline-flex' }}>New</span>}
                          </td>
                          <td className="hide-sm muted">{r.project_service ? `${r.project_service}, ${stageName(r)}` : '—'}</td>
                          <td><Pill status={RESPONSE_STATUS[r.status]?.pill || 'pending'} label={statusLabel(r)} /></td>
                          <td className="r hide-sm muted">{relativeDay(r.status === 'submitted' ? r.submitted_at : r.updated_at || r.sent_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty" style={{ padding: 40 }}>
                  {!responsesLoaded ? 'Loading…' : templates.length
                    ? <><b>Nothing sent yet.</b> Send a questionnaire to a client and it appears in their portal. You’ll be notified when they submit.<div style={{ marginTop: 14 }}><button className="btn bp" type="button" onClick={() => setSendOpen(true)}><Icon name="send" />Send a questionnaire</button></div></>
                    : <><b>Start with your brand strategy questionnaire.</b> Vela has a ready-made set of strategy questions you can edit, or paste in your own.<div className="tb-r" style={{ marginTop: 14 }}><button className="btn bp" type="button" disabled={creating} onClick={() => create('starter')}>Use the brand strategy questions</button><button className="btn bg" type="button" disabled={creating} onClick={() => create('blank')}>Start from scratch</button></div></>}
                </div>
              )}
            </div>
          )}

          {tab === 'templates' && (
            <>
              <div className="panel">
                {templates.length ? (
                  <ul className="rows">
                    {templates.map((t) => {
                      const sentCount = responses.filter((r) => r.template_id === t.id).length;
                      return (
                        <li key={t.id}>
                          <Link className="row" to={`/questionnaires/templates/${t.id}`} style={{ alignItems: 'center' }}>
                            <Icon name="clipboard" size={20} className="ico muted" />
                            <span className="row-main">
                              <span className="row-title" style={{ display: 'block' }}>{t.title}</span>
                              <span className="row-sub" style={{ display: 'block' }}>
                                {answerableQuestions(t.questions).length} questions{sentCount ? `, sent ${sentCount} ${sentCount === 1 ? 'time' : 'times'}` : ''}
                              </span>
                            </span>
                            <span className="row-aside">Edited {relativeDay(t.updated_at)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'No questionnaires yet.' : 'Loading…'}</div>}
              </div>
              <div className="tb-r" style={{ marginTop: 14 }}>
                {!hasStarter && <button className="btn bg" type="button" disabled={creating} onClick={() => create('starter')}><Icon name="plus" />Brand strategy questionnaire</button>}
                <button className="btn bg" type="button" disabled={creating} onClick={() => create('blank')}><Icon name="plus" />New questionnaire</button>
              </div>
            </>
          )}
        </div>
      </div>

      <SendQuestionnaire open={sendOpen} onClose={() => setSendOpen(false)} onSent={(r) => navigate(`/questionnaires/responses/${r.id}`)} />
    </>
  );
}

export default function Questionnaires() {
  const params = useParams();
  const [kind, id] = (params['*'] || '').split('/');
  if (kind === 'responses' && id) return <ResponseView id={id} />;
  if (kind === 'templates' && id) return <TemplateEditor id={id} />;
  return <QuestionnaireList />;
}
