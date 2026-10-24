import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, formsAPI } from '../utils/api';
import { formatDate, relativeDay } from '../utils/format';
import {
  CHOICE_TYPES, QUESTION_TYPES, STUDIO_ENQUIRY_TEMPLATE, fieldName, normalizeField, pickAnswer, resizeHeader,
} from '../utils/intakeForm';

function prettyKey(key) {
  const words = String(key).replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fromTemplate() {
  return {
    title: STUDIO_ENQUIRY_TEMPLATE.title,
    intro: STUDIO_ENQUIRY_TEMPLATE.intro,
    thanks: STUDIO_ENQUIRY_TEMPLATE.thanks,
    fields: STUDIO_ENQUIRY_TEMPLATE.fields.map(normalizeField),
  };
}

// One question in the builder.
function QuestionEditor({ field, index, total, onChange, onMove, onRemove, onDuplicate }) {
  const [showHelp, setShowHelp] = useState(Boolean(field.help));
  const hasChoices = CHOICE_TYPES.includes(field.field_type);
  const set = (key, value) => onChange({ ...field, [key]: value });
  const setChoice = (i, value) => set('choices', field.choices.map((c, n) => (n === i ? value : c)));
  const choiceIcon = field.field_type === 'checkboxes' ? 'qb-box' : field.field_type === 'radio' ? 'qb-dot' : 'qb-num';

  return (
    <li className="panel qb">
      <div className="qb-top">
        <div className="fc" style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
          <label className="fc-label" htmlFor={`q-${field.id}`}>Question {index + 1}</label>
          <textarea
            id={`q-${field.id}`}
            className="fi qb-label"
            rows={1}
            value={field.label}
            onChange={(e) => set('label', e.target.value.replace(/\n/g, ' '))}
            placeholder="Type your question"
          />
        </div>
        <div className="fc qb-type" style={{ marginBottom: 0 }}>
          <label className="fc-label" htmlFor={`qt-${field.id}`}>Answer type</label>
          <select
            id={`qt-${field.id}`}
            className="fi fsel"
            value={field.field_type}
            onChange={(e) => {
              const next = e.target.value;
              onChange({
                ...field,
                field_type: next,
                choices: CHOICE_TYPES.includes(next) && !field.choices.length ? ['Option 1'] : field.choices,
                allow_other: next === 'select' ? false : field.allow_other,
              });
            }}
          >
            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {showHelp && (
        <div className="fc" style={{ marginTop: 12, marginBottom: 0 }}>
          <label className="fc-label" htmlFor={`qh-${field.id}`}>Description (optional)</label>
          <input id={`qh-${field.id}`} className="fi" value={field.help} onChange={(e) => set('help', e.target.value)} placeholder="A short hint shown under the question" />
        </div>
      )}

      {hasChoices && (
        <div className="qb-choices" role="group" aria-label={`Choices for question ${index + 1}`}>
          {field.choices.map((choice, i) => (
            <div key={i} className="qb-choice">
              <span className={choiceIcon} aria-hidden="true">{choiceIcon === 'qb-num' ? `${i + 1}.` : ''}</span>
              <input
                className="fi"
                value={choice}
                aria-label={`Choice ${i + 1}`}
                onChange={(e) => setChoice(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const next = field.choices.slice();
                    next.splice(i + 1, 0, '');
                    set('choices', next);
                    requestAnimationFrame(() => e.target.closest('.qb-choices')?.querySelectorAll('input.fi')[i + 1]?.focus());
                  }
                }}
              />
              <button className="mc" type="button" aria-label={`Remove choice ${i + 1}`} disabled={field.choices.length <= 1} onClick={() => set('choices', field.choices.filter((_, n) => n !== i))}><Icon name="close" size={15} /></button>
            </div>
          ))}
          {field.allow_other && (
            <div className="qb-choice">
              <span className={choiceIcon} aria-hidden="true" />
              <span className="qb-other-row">Other: <i>they type their own answer</i></span>
              <button className="mc" type="button" aria-label="Remove the Other choice" onClick={() => set('allow_other', false)}><Icon name="close" size={15} /></button>
            </div>
          )}
          <div className="qb-choice-actions">
            <button className="btn bq bxs" type="button" onClick={() => set('choices', [...field.choices, `Option ${field.choices.length + 1}`])}><Icon name="plus" size={14} />Add choice</button>
            {!field.allow_other && field.field_type !== 'select' && (
              <button className="btn bq bxs" type="button" onClick={() => set('allow_other', true)}>Add “Other”</button>
            )}
          </div>
        </div>
      )}

      <div className="qb-foot">
        <div className="qb-tools">
          <button className="btn bq bxs" type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`}><Icon name="up" size={14} /></button>
          <button className="btn bq bxs" type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`Move question ${index + 1} down`}><Icon name="down" size={14} /></button>
          <button className="btn bq bxs" type="button" onClick={onDuplicate} aria-label={`Duplicate question ${index + 1}`}><Icon name="copy" size={14} /><span className="hide-sm">Duplicate</span></button>
          {!showHelp && <button className="btn bq bxs" type="button" onClick={() => setShowHelp(true)}>Add description</button>}
          <button className="btn bd bxs" type="button" onClick={onRemove}>Remove</button>
        </div>
        <label className="qb-req">
          <input type="checkbox" checked={field.required} onChange={(e) => set('required', e.target.checked)} />
          Required
        </label>
      </div>
    </li>
  );
}

export default function Forms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [tab, setTab] = useState('inbox');
  const [form, setForm] = useState(null);
  const [legacy, setLegacy] = useState(false);
  const [everSaved, setEverSaved] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const shareUrl = user?.id ? `${window.location.origin}/intake/${user.id}` : '';

  useEffect(() => {
    Promise.all([formsAPI.getConfig(), formsAPI.submissions()])
      .then(([config, submissionRows]) => {
        setForm({
          title: config.title ?? '',
          intro: config.intro ?? '',
          thanks: config.thanks ?? '',
          header_image: config.header_image || '',
          fields: (config.fields || []).map(normalizeField),
        });
        setLegacy(Boolean(config.legacy));
        setEverSaved(Boolean(config.has_saved));
        setSubmissions(submissionRows);
        setSelectedId(submissionRows[0]?.id || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  // Before leaving with unsaved changes, ask.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const selected = submissions.find((s) => s.id === selectedId) || null;

  // Answer keys in the order of the form, with the question as it was written.
  const labels = useMemo(() => {
    const map = new Map();
    (form?.fields || []).forEach((f, i) => { if (f.label) map.set(fieldName(f, i), f.label); });
    return map;
  }, [form]);

  function answersOf(submission) {
    const data = submission?.data || {};
    const known = [...labels.keys()].filter((k) => data[k] !== undefined && data[k] !== '');
    const extra = Object.keys(data).filter((k) => !labels.has(k) && data[k] !== '');
    return [...known, ...extra].map((k) => ({ key: k, label: labels.get(k) || prettyKey(k), value: String(data[k]) }));
  }

  function update(patch) {
    setForm((cur) => ({ ...cur, ...patch }));
    setDirty(true);
    setSavedNote('');
  }

  function setFields(fields) { update({ fields }); }

  function moveField(index, direction) {
    const next = form.fields.slice();
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setFields(next);
  }

  function applyTemplate() {
    const hasQuestions = form.fields.some((f) => f.label);
    if (hasQuestions && !window.confirm('Replace your title, introduction and questions with the template? Your header image stays. Nothing is saved until you click Save form.')) return;
    update(fromTemplate());
    setLegacy(false);
  }

  async function pickHeader(file) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      update({ header_image: await resizeHeader(file) });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const missingChoices = form.fields.find((f) => f.label && CHOICE_TYPES.includes(f.field_type) && !f.choices.some((c) => c.trim()) && !f.allow_other);
      if (missingChoices) throw new Error(`Add at least one choice to “${missingChoices.label}”.`);
      const result = await formsAPI.saveConfig(form);
      setForm((cur) => ({ ...cur, fields: (result.fields || []).map(normalizeField) }));
      setDirty(false);
      setLegacy(false);
      setEverSaved(true);
      setSavedNote('Saved. Your public form is up to date.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addAsClient(submission) {
    setConverting(true);
    setError('');
    try {
      const data = submission.data || {};
      const person = pickAnswer(data, 'name');
      const created = await clientsAPI.create({
        name: pickAnswer(data, 'business') || person || 'New client',
        contact: person,
        email: pickAnswer(data, 'email'),
        location: pickAnswer(data, 'location'),
        industry: 'Other',
        color: '#1B2B4B',
      });
      navigate(`/clients/${created.id}`);
    } catch (err) {
      setError(err.message);
      setConverting(false);
    }
  }

  const tabs = (
    <div className="segmented" role="tablist" aria-label="Enquiries view">
      <button type="button" role="tab" aria-selected={tab === 'inbox'} className={tab === 'inbox' ? 'on' : ''} onClick={() => setTab('inbox')}>
        Inbox <span className="faint">{submissions.length}</span>
      </button>
      <button type="button" role="tab" aria-selected={tab === 'form'} className={tab === 'form' ? 'on' : ''} onClick={() => setTab('form')}>
        Your form{dirty ? ' •' : ''}
      </button>
    </div>
  );

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Enquiries</h1>
        <div className="tb-r">
          {tabs}
          <button className="btn bg hide-sm" type="button" onClick={copyLink} disabled={!shareUrl}><Icon name={copied ? 'check' : 'link'} />{copied ? 'Link copied' : 'Copy form link'}</button>
          {tab === 'form' && <button className="btn bp" type="button" onClick={save} disabled={saving || (!dirty && everSaved)}>{saving ? 'Saving…' : dirty || !everSaved ? 'Save form' : 'Saved'}</button>}
        </div>
      </div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error" role="alert">{error}</div>}

          {tab === 'inbox' && (
            submissions.length ? (
              <div className="split inbox-split">
                <section className="panel" aria-label="Enquiry detail" style={{ order: 2, minWidth: 0 }}>
                  {selected ? (
                    <>
                      <div className="card-h">
                        <div style={{ minWidth: 0 }}>
                          <h2 className="card-title">{pickAnswer(selected.data, 'name') || pickAnswer(selected.data, 'business') || 'Enquiry'}</h2>
                          <div className="muted" style={{ fontSize: 13 }}>
                            {[pickAnswer(selected.data, 'business'), pickAnswer(selected.data, 'location')].filter(Boolean).join(', ')}
                            {(pickAnswer(selected.data, 'business') || pickAnswer(selected.data, 'location')) ? ' · ' : ''}
                            Received {formatDate(selected.submitted_at, { weekday: 'short', day: 'numeric', month: 'long' })}
                          </div>
                        </div>
                        <button className="btn bp bsm" type="button" disabled={converting} onClick={() => addAsClient(selected)}>
                          <Icon name="plus" />{converting ? 'Adding…' : 'Add as client'}
                        </button>
                      </div>
                      <dl className="answers">
                        {answersOf(selected).map(({ key, label, value }) => (
                          <div key={key} className="answer">
                            <dt>{label}</dt>
                            <dd>
                              {/e[-_ ]?mail/i.test(key) && /@/.test(value) ? <a href={`mailto:${value}`}>{value}</a>
                                : /instagram/i.test(key) && /^@?[\w.]+$/.test(value) ? <a href={`https://instagram.com/${value.replace(/^@/, '')}`} target="_blank" rel="noreferrer">{value}</a>
                                  : value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : <div className="empty">Choose an enquiry to read it.</div>}
                </section>
                <section className="panel" aria-label="All enquiries" style={{ order: 1 }}>
                  <ul className="rows">
                    {submissions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="row"
                          onClick={() => setSelectedId(s.id)}
                          style={{ width: '100%', border: 'none', textAlign: 'left', background: s.id === selectedId ? 'var(--info-bg)' : 'transparent' }}
                          aria-current={s.id === selectedId}
                        >
                          <span className="row-main">
                            <span className="row-title" style={{ display: 'block' }}>{pickAnswer(s.data, 'name') || pickAnswer(s.data, 'business') || 'Someone new'}</span>
                            <span className="row-sub" style={{ display: 'block' }}>
                              {[pickAnswer(s.data, 'business'), pickAnswer(s.data, 'service')].filter(Boolean).join(', ') || 'No details'}
                            </span>
                          </span>
                          <span className="row-aside">{relativeDay(s.submitted_at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : (
              <div className="panel empty" style={{ padding: 40 }}>
                {loaded
                  ? <><b>No enquiries yet.</b> Put your form link on your website or Instagram bio, and new enquiries land here.
                      <div style={{ marginTop: 14 }}><button className="btn bp" type="button" onClick={copyLink}><Icon name={copied ? 'check' : 'link'} />{copied ? 'Link copied' : 'Copy form link'}</button></div></>
                  : 'Loading…'}
              </div>
            )
          )}

          {tab === 'form' && !form && <div className="panel empty" style={{ padding: 40 }}>{loaded ? 'Your form couldn’t load.' : 'Loading…'}</div>}

          {tab === 'form' && form && (
            <div className="split">
              <section aria-label="Form builder" className="fb">
                {savedNote && <div className="notice ok" role="status">{savedNote}</div>}
                {!everSaved && !dirty && (
                  <div className="notice fb-legacy">
                    <span>This is the enquiry template. Add your header image, make any changes, then save to publish it on your form link.</span>
                  </div>
                )}
                {legacy && (
                  <div className="notice fb-legacy">
                    <span>Your form still has the older questions. Start from the enquiry template to get a title, introduction and the full set of questions.</span>
                    <button className="btn bp bsm" type="button" onClick={applyTemplate}>Use the template</button>
                  </div>
                )}

                <div className="panel fb-block">
                  <div className="fb-block-h">
                    <h2 className="card-title">Header image</h2>
                    <span className="muted" style={{ fontSize: 13 }}>Your logo or a banner, shown across the top. A wide image works best, around 1600 × 400.</span>
                  </div>
                  {form.header_image ? (
                    <div className="fb-header-preview">
                      <img src={form.header_image} alt="Form header" />
                    </div>
                  ) : (
                    <button className="fb-drop" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); pickHeader(e.dataTransfer.files?.[0]); }}>
                      <Icon name="plus" size={18} />
                      <span>{uploading ? 'Preparing image…' : 'Upload a header image'}</span>
                      <span className="faint" style={{ fontSize: 12.5 }}>PNG or JPG, or drop it here</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickHeader(e.target.files?.[0])} />
                  {form.header_image && (
                    <div className="tb-r" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
                      <button className="btn bg bsm" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Preparing…' : 'Replace image'}</button>
                      <button className="btn bd bsm" type="button" onClick={() => update({ header_image: '' })}>Remove</button>
                    </div>
                  )}
                </div>

                <div className="panel fb-block fb-title-block">
                  <div className="fc">
                    <label className="fc-label" htmlFor="fb-title">Form title</label>
                    <input id="fb-title" className="fi fb-title" value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="Tell us about your project" />
                  </div>
                  <div className="fc" style={{ marginBottom: 0 }}>
                    <label className="fc-label" htmlFor="fb-intro">Introduction</label>
                    <textarea id="fb-intro" className="fi" rows={9} value={form.intro} onChange={(e) => update({ intro: e.target.value })} placeholder="A few lines to welcome people and set expectations" />
                    <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>Line breaks show as you type them. Write <code>__STUDIO_NAME__</code> to insert your studio name from Settings.</div>
                  </div>
                </div>

                <ol className="fb-questions">
                  {form.fields.map((field, index) => (
                    <QuestionEditor
                      key={field.id}
                      field={field}
                      index={index}
                      total={form.fields.length}
                      onChange={(next) => setFields(form.fields.map((f, i) => (i === index ? next : f)))}
                      onMove={(dir) => moveField(index, dir)}
                      onRemove={() => setFields(form.fields.filter((_, i) => i !== index))}
                      onDuplicate={() => {
                        const next = form.fields.slice();
                        next.splice(index + 1, 0, normalizeField({ ...field, id: '', label: `${field.label} (copy)` }, index + 1));
                        setFields(next);
                      }}
                    />
                  ))}
                </ol>
                <button className="btn bg" type="button" onClick={() => setFields([...form.fields, normalizeField({ field_type: 'text' }, form.fields.length)])}><Icon name="plus" />Add a question</button>

                <div className="panel fb-block" style={{ marginTop: 18 }}>
                  <div className="fc" style={{ marginBottom: 0 }}>
                    <label className="fc-label" htmlFor="fb-thanks">Thank-you message</label>
                    <textarea id="fb-thanks" className="fi" rows={3} value={form.thanks} onChange={(e) => update({ thanks: e.target.value })} placeholder="Shown after someone sends the form" />
                  </div>
                </div>
              </section>

              <aside className="panel fb-aside" aria-label="Sharing">
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 6 }}>Your public form</h2>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Anyone with this link can send you an enquiry. It uses your brand colours and fonts from Settings.</p>
                  <input className="fi" readOnly value={shareUrl} aria-label="Form link" onFocus={(e) => e.target.select()} />
                  <div className="tb-r" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
                    <button className="btn bg bsm" type="button" onClick={copyLink}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy'}</button>
                    <a className="btn bg bsm" href={shareUrl} target="_blank" rel="noreferrer"><Icon name="link" />Open form</a>
                  </div>
                  {dirty && <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>You have unsaved changes. The link shows the last saved version.</p>}
                </div>
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 6 }}>Start again</h2>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Load the enquiry template: a title, an introduction and {STUDIO_ENQUIRY_TEMPLATE.fields.length} questions about the client, their business, services, budget and timing. Edit anything after.</p>
                  <button className="btn bg bsm" type="button" onClick={applyTemplate}>Use the enquiry template</button>
                </div>
                <div className="aside-block">
                  <div className="row-sub">{form.fields.filter((f) => f.label).length} questions, {form.fields.filter((f) => f.label && f.required).length} required</div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
