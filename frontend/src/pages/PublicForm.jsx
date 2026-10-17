import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formsAPI } from '../utils/api';

function fieldName(field, index) {
  const base = (field.label || `field_${index + 1}`).trim().toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `field_${index + 1}`;
}

function initialValues(fields) {
  return Object.fromEntries(fields.map((field, index) => [fieldName(field, index), '']));
}

export default function PublicForm() {
  const { userId = '' } = useParams();
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const sortedFields = useMemo(
    () => fields.slice().sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0)),
    [fields]
  );

  useEffect(() => {
    let active = true;

    formsAPI
      .getPublicFields(userId)
      .then((fieldRows) => {
        if (!active) {
          return;
        }
        setFields(fieldRows);
        setValues(initialValues(fieldRows));
        setError('');
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      await formsAPI.submitPublic(userId, values);
      setSubmitted(true);
      setError('');
      setValues(initialValues(sortedFields));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const setValue = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));

  return (
    <div className="public-form">
      <div className="public-form-inner">
        <header style={{ marginBottom: 28 }}>
          <h1 className="h-display" style={{ fontSize: 36 }}>Tell us about your project</h1>
          <p className="lede" style={{ marginTop: 10 }}>A few details help the studio understand what you need. You’ll hear back personally, usually within two working days.</p>
        </header>

        <div className="panel" style={{ padding: 28 }}>
          {loading && <div className="muted">Loading the form…</div>}
          {!loading && error && <div className="form-error" role="alert">{error}</div>}

          {!loading && submitted && (
            <div role="status">
              <h2 className="h-section">Thank you, your enquiry is in.</h2>
              <p className="muted" style={{ marginTop: 6 }}>The studio will read it and reply to the email you gave.</p>
              <button className="btn bg" type="button" style={{ marginTop: 18 }} onClick={() => setSubmitted(false)}>Send another enquiry</button>
            </div>
          )}

          {!loading && !submitted && sortedFields.length > 0 && (
            <form onSubmit={handleSubmit}>
              {sortedFields.map((field, index) => {
                const name = fieldName(field, index);
                const id = `pf-${name}`;
                const isRequired = Boolean(field.required);
                const options = String(field.options || '').split(',').map((o) => o.trim()).filter(Boolean);
                return (
                  <div className="fc" key={name} style={{ marginBottom: 18 }}>
                    <label className="fc-label" htmlFor={id} style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                      {field.label}{!isRequired && <span className="faint" style={{ fontWeight: 400 }}> (optional)</span>}
                    </label>
                    {field.field_type === 'textarea' && (
                      <textarea id={id} className="fi" rows="5" value={values[name] || ''} onChange={setValue(name)} required={isRequired} style={{ minHeight: 130 }} />
                    )}
                    {field.field_type === 'select' && (
                      <select id={id} className="fi fsel" value={values[name] || ''} onChange={setValue(name)} required={isRequired}>
                        <option value="">Choose one</option>
                        {options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {!['textarea', 'select'].includes(field.field_type) && (
                      <input
                        id={id}
                        className="fi"
                        type={field.field_type === 'email' ? 'email' : 'text'}
                        autoComplete={field.field_type === 'email' ? 'email' : /name/i.test(field.label) ? 'name' : undefined}
                        value={values[name] || ''}
                        onChange={setValue(name)}
                        required={isRequired}
                      />
                    )}
                  </div>
                );
              })}
              <button className="btn bp" type="submit" disabled={submitting} style={{ padding: '11px 20px', fontSize: 14 }}>
                {submitting ? 'Sending…' : 'Send enquiry'}
              </button>
            </form>
          )}
        </div>
        <p className="faint" style={{ fontSize: 12, marginTop: 18, textAlign: 'center' }}>Sent securely with Vela</p>
      </div>
    </div>
  );
}
