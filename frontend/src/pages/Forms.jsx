import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, formsAPI } from '../utils/api';
import { formatDate, relativeDay } from '../utils/format';

const TYPES = [
  { value: 'text', label: 'Short answer' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Long answer' },
  { value: 'select', label: 'Dropdown' },
];

function normalizeField(field, index) {
  return {
    label: field.label || '',
    field_type: field.field_type || 'text',
    required: Boolean(field.required),
    options: field.options || '',
    sort_order: field.sort_order ?? index,
  };
}

function pick(data, pattern) {
  const key = Object.keys(data || {}).find((k) => pattern.test(k));
  return key ? data[key] : '';
}

export default function Forms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('inbox');
  const [fields, setFields] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);
  const shareUrl = user?.id ? `${window.location.origin}/intake/${user.id}` : '';

  useEffect(() => {
    Promise.all([formsAPI.getFields(), formsAPI.submissions()])
      .then(([fieldRows, submissionRows]) => {
        setFields(fieldRows.map(normalizeField));
        setSubmissions(submissionRows);
        setSelectedId(submissionRows[0]?.id || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const sortedFields = useMemo(
    () => fields.slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    [fields]
  );
  const selected = submissions.find((s) => s.id === selectedId) || null;

  function replaceFields(next) {
    setFields(next.map((field, index) => ({ ...field, sort_order: index })));
    setDirty(true);
    setSavedNote('');
  }

  function updateField(index, key, value) {
    replaceFields(sortedFields.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
  }

  function moveField(index, direction) {
    const next = sortedFields.slice();
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    replaceFields(next);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const result = await formsAPI.saveFields(sortedFields);
      setFields((result.fields || sortedFields).map(normalizeField));
      setDirty(false);
      setSavedNote('Saved. Your public form now shows these questions.');
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
      const created = await clientsAPI.create({
        name: pick(data, /brand|business|company/i) || pick(data, /full[\s_]?name|^name$/i) || 'New client',
        contact: pick(data, /full[\s_]?name|^name$/i),
        email: pick(data, /email/i),
        location: pick(data, /location|city|country/i),
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
        Your form
      </button>
    </div>
  );

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Enquiries</h1>
        <div className="tb-r">
          {tabs}
          <button className="btn bg" type="button" onClick={copyLink} disabled={!shareUrl}><Icon name={copied ? 'check' : 'link'} />{copied ? 'Link copied' : 'Copy form link'}</button>
          {tab === 'form' && <button className="btn bp" type="button" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save form'}</button>}
        </div>
      </div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}

          {tab === 'inbox' && (
            submissions.length ? (
              <div className="split inbox-split">
                <section className="panel" aria-label="Enquiry detail" style={{ order: 2, minWidth: 0 }}>
                  {selected ? (
                    <>
                      <div className="card-h">
                        <div>
                          <h2 className="card-title">{pick(selected.data, /full[\s_]?name|^name$/i) || 'Enquiry'}</h2>
                          <div className="muted" style={{ fontSize: 13 }}>Received {formatDate(selected.submitted_at, { weekday: 'short', day: 'numeric', month: 'long' })}</div>
                        </div>
                        <button className="btn bp bsm" type="button" disabled={converting} onClick={() => addAsClient(selected)}>
                          <Icon name="plus" />{converting ? 'Adding…' : 'Add as client'}
                        </button>
                      </div>
                      <dl style={{ padding: '6px 20px 18px' }}>
                        {Object.entries(selected.data || {}).map(([key, value]) => (
                          <div key={key} style={{ padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
                            <dt className="faint" style={{ fontSize: 12.5 }}>{(key.charAt(0).toUpperCase() + key.slice(1)).replace(/_/g, ' ')}</dt>
                            <dd style={{ fontSize: 14, marginTop: 2, whiteSpace: 'pre-wrap' }}>
                              {/email/i.test(key) ? <a href={`mailto:${value}`}>{String(value)}</a> : String(value)}
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
                            <span className="row-title" style={{ display: 'block' }}>{pick(s.data, /full[\s_]?name|^name$/i) || 'Someone new'}</span>
                            <span className="row-sub" style={{ display: 'block' }}>
                              {[pick(s.data, /brand|business|company/i), pick(s.data, /service/i)].filter(Boolean).join(', ') || 'No details'}
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

          {tab === 'form' && (
            <div className="split">
              <section aria-label="Form questions">
                {savedNote && <div className="notice ok" style={{ marginBottom: 14 }}>{savedNote}</div>}
                <ol style={{ listStyle: 'none' }}>
                  {sortedFields.map((field, index) => (
                    <li key={index} className="panel" style={{ padding: 18, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span className="muted" style={{ fontSize: 13 }}>Question {index + 1}</span>
                        <span className="tb-r">
                          <button className="btn bq bxs" type="button" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`}>Move up</button>
                          <button className="btn bq bxs" type="button" onClick={() => moveField(index, 1)} disabled={index === sortedFields.length - 1} aria-label={`Move question ${index + 1} down`}>Move down</button>
                          <button className="btn bd bxs" type="button" onClick={() => replaceFields(sortedFields.filter((_, i) => i !== index))}>Remove</button>
                        </span>
                      </div>
                      <div className="fi-row">
                        <div className="fc">
                          <label className="fc-label" htmlFor={`q-${index}`}>Question</label>
                          <input id={`q-${index}`} className="fi" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} placeholder="What’s your budget?" />
                        </div>
                        <div className="fc">
                          <label className="fc-label" htmlFor={`qt-${index}`}>Answer type</label>
                          <select id={`qt-${index}`} className="fi fsel" value={field.field_type} onChange={(e) => updateField(index, 'field_type', e.target.value)}>
                            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                      </div>
                      {field.field_type === 'select' && (
                        <div className="fc">
                          <label className="fc-label" htmlFor={`qo-${index}`}>Choices, separated by commas</label>
                          <input id={`qo-${index}`} className="fi" value={field.options || ''} onChange={(e) => updateField(index, 'options', e.target.value)} placeholder="Brand Identity, Packaging Design, Web Design" />
                        </div>
                      )}
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
                        <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => updateField(index, 'required', e.target.checked)} />
                        Required
                      </label>
                    </li>
                  ))}
                </ol>
                <button className="btn bg" type="button" onClick={() => replaceFields([...sortedFields, normalizeField({}, sortedFields.length)])}><Icon name="plus" />Add a question</button>
              </section>
              <aside className="panel" aria-label="Sharing">
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 6 }}>Your public form</h2>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Anyone with this link can send you an enquiry. Questions without a label are left out when you save.</p>
                  <input className="fi" readOnly value={shareUrl} aria-label="Form link" onFocus={(e) => e.target.select()} />
                  <div className="tb-r" style={{ marginTop: 10 }}>
                    <button className="btn bg bsm" type="button" onClick={copyLink}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy'}</button>
                    <a className="btn bg bsm" href={shareUrl} target="_blank" rel="noreferrer"><Icon name="link" />Open form</a>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
