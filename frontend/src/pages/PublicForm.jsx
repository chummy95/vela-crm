import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formsAPI } from '../utils/api';
import { brandVars, loadBrandFonts } from '../utils/brand';
import { fieldName, fillIntro, normalizeField } from '../utils/intakeForm';

const OTHER = '__other__';

function brandProfile(brand = {}) {
  return {
    brand_primary: brand.primary || undefined,
    brand_accent: brand.accent || undefined,
    heading_font: brand.heading_font || '',
    body_font: brand.body_font || '',
  };
}

// One question, as the visitor answers it.
function Question({ field, index, value, other, onChange, onOther, invalid }) {
  const id = `pf-${index}`;
  const choices = field.choices;
  const label = (
    <>
      {field.label}
      {field.required && <span className="pq-req" aria-hidden="true"> *</span>}
    </>
  );
  const help = field.help ? <p className="pq-help" id={`${id}-help`}>{field.help}</p> : null;
  const describedBy = field.help ? `${id}-help` : undefined;

  if (field.field_type === 'checkboxes' || field.field_type === 'radio') {
    const many = field.field_type === 'checkboxes';
    const selected = many ? (Array.isArray(value) ? value : []) : value;
    const toggle = (choice) => {
      if (!many) { onChange(choice); return; }
      onChange(selected.includes(choice) ? selected.filter((c) => c !== choice) : [...selected, choice]);
    };
    const isOn = (choice) => (many ? selected.includes(choice) : selected === choice);
    return (
      <fieldset className={`pq${invalid ? ' invalid' : ''}`} aria-describedby={describedBy}>
        <legend className="pq-label">{label}</legend>
        {help}
        <div className="pq-choices">
          {choices.map((choice) => (
            <label key={choice} className="pq-choice">
              <input type={many ? 'checkbox' : 'radio'} name={id} checked={isOn(choice)} onChange={() => toggle(choice)} />
              <span>{choice}</span>
            </label>
          ))}
          {field.allow_other && (
            <label className="pq-choice pq-other">
              <input type={many ? 'checkbox' : 'radio'} name={id} checked={isOn(OTHER)} onChange={() => toggle(OTHER)} />
              <span>Other:</span>
              <input
                className="pq-input"
                aria-label={`${field.label}: other`}
                value={other || ''}
                onChange={(e) => { onOther(e.target.value); if (!isOn(OTHER) && e.target.value) toggle(OTHER); }}
              />
            </label>
          )}
        </div>
        {invalid && <p className="pq-error">{invalid}</p>}
      </fieldset>
    );
  }

  return (
    <div className={`pq${invalid ? ' invalid' : ''}`}>
      <label className="pq-label" htmlFor={id}>{label}</label>
      {help}
      {field.field_type === 'textarea' && (
        <textarea id={id} className="pq-input pq-area" rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} required={field.required} aria-describedby={describedBy} placeholder="Your answer" />
      )}
      {field.field_type === 'select' && (
        <select id={id} className="pq-input pq-select" value={value || ''} onChange={(e) => onChange(e.target.value)} required={field.required} aria-describedby={describedBy}>
          <option value="">Choose</option>
          {choices.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {!['textarea', 'select'].includes(field.field_type) && (
        <input
          id={id}
          className="pq-input"
          type={{ email: 'email', phone: 'tel', date: 'date' }[field.field_type] || 'text'}
          autoComplete={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : /^your name$|full name/i.test(field.label) ? 'name' : undefined}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          aria-describedby={describedBy}
          placeholder="Your answer"
        />
      )}
      {invalid && <p className="pq-error">{invalid}</p>}
    </div>
  );
}

export default function PublicForm() {
  const { userId = '' } = useParams();
  const [config, setConfig] = useState(null);
  const [values, setValues] = useState({});
  const [others, setOthers] = useState({});
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    formsAPI.getPublicConfig(userId)
      .then((c) => {
        if (!active) return;
        setConfig(c);
        loadBrandFonts(brandProfile(c.brand));
        const name = c.brand?.business_name;
        if (name) document.title = `${c.title || 'Enquiry'}, ${name}`;
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const fields = useMemo(() => (config?.fields || []).map(normalizeField), [config]);

  function answerFor(field, index) {
    const key = fieldName(field, index);
    const value = values[key];
    const other = (others[key] || '').trim();
    if (field.field_type === 'checkboxes') {
      const list = (Array.isArray(value) ? value : []).map((v) => (v === OTHER ? (other ? `Other: ${other}` : '') : v)).filter(Boolean);
      return list.join(', ');
    }
    if (value === OTHER) return other ? `Other: ${other}` : '';
    return typeof value === 'string' ? value.trim() : '';
  }

  function problemWith(field, index) {
    const answer = answerFor(field, index);
    if (!answer) return field.required ? 'This question needs an answer.' : '';
    if (field.field_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return 'Enter a valid email address.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const blank = fields.map((f, i) => {
      const answer = answerFor(f, i);
      if (f.required && !answer) return i;
      if (answer && f.field_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return i;
      return -1;
    }).filter((i) => i >= 0);
    setMissing(blank);
    if (blank.length) {
      document.getElementById(`pf-${blank[0]}`)?.focus?.();
      document.querySelectorAll('.pq.invalid')[0]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      setError('Please check the questions marked in red.');
      return;
    }
    const data = Object.fromEntries(fields.map((f, i) => [fieldName(f, i), answerFor(f, i)]).filter(([, v]) => v));
    try {
      setSubmitting(true);
      setError('');
      await formsAPI.submitPublic(userId, data);
      setSubmitted(true);
      setValues({});
      setOthers({});
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
      document.querySelector('.public-form')?.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const brand = config?.brand || {};
  const studioName = brand.business_name || '';
  const style = brandVars(brandProfile(brand));

  return (
    <div className="public-form branded" style={style}>
      <div className="public-form-inner">
        {config?.header_image && (
          <div className="pf-header"><img src={config.header_image} alt={studioName || 'Studio header'} /></div>
        )}

        <div className="pf-card pf-intro">
          {loading && <div className="muted">Loading the form…</div>}
          {!loading && config && (
            <>
              <h1 className="pf-title">{config.title || 'Tell us about your project'}</h1>
              {config.intro && <div className="pf-text">{fillIntro(config.intro, studioName)}</div>}
            </>
          )}
          {!loading && !submitted && fields.some((f) => f.required) && <p className="pf-required-note">* Indicates required question</p>}
        </div>

        {!loading && submitted && (
          <div className="pf-card" role="status">
            <h2 className="pf-title" style={{ fontSize: 24 }}>Thank you</h2>
            <div className="pf-text">{config?.thanks || 'Your enquiry is in. The studio will be in touch soon.'}</div>
            <button className="pf-link" type="button" onClick={() => setSubmitted(false)}>Send another response</button>
          </div>
        )}

        {!loading && !submitted && fields.length > 0 && (
          <form onSubmit={handleSubmit} noValidate>
            {fields.map((field, index) => {
              const key = fieldName(field, index);
              return (
                <div key={field.id || key} className="pf-card">
                  <Question
                    field={field}
                    index={index}
                    value={values[key] ?? (field.field_type === 'checkboxes' ? [] : '')}
                    other={others[key]}
                    invalid={missing.includes(index) ? problemWith(field, index) : ''}
                    onChange={(v) => setValues((cur) => ({ ...cur, [key]: v }))}
                    onOther={(v) => setOthers((cur) => ({ ...cur, [key]: v }))}
                  />
                </div>
              );
            })}
            {error && <div className="form-error" role="alert" style={{ marginTop: 4 }}>{error}</div>}
            <div className="pf-actions">
              <button className="pf-submit" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Submit'}</button>
              <button className="pf-link" type="button" onClick={() => { setValues({}); setOthers({}); setMissing([]); setError(''); }}>Clear form</button>
            </div>
          </form>
        )}
        {!loading && !config && error && <div className="form-error" role="alert">{error}</div>}
        <p className="faint" style={{ fontSize: 12, marginTop: 22, textAlign: 'center' }}>Sent securely with Vela</p>
      </div>
    </div>
  );
}
