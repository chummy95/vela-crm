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

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f6efe6 0%, #fffdf8 100%)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 700, color: 'var(--navy)', letterSpacing: '1px' }}>
            VEL<span style={{ color: 'var(--gold)' }}>A</span>
          </div>
          <div style={{ marginTop: 10, color: 'var(--text-s)', fontSize: 15 }}>
            Share a few details about your project and the studio will get back to you.
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {loading && <div style={{ color: 'var(--text-s)' }}>Loading form…</div>}
          {!loading && error && <div style={{ marginBottom: 16, color: 'var(--err)' }}>{error}</div>}
          {!loading && submitted && (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--ok-bg)', color: 'var(--ok)' }}>
              Thanks. Your enquiry has been submitted successfully.
            </div>
          )}

          {!loading && !error && (
            <form onSubmit={handleSubmit}>
              {sortedFields.map((field, index) => {
                const name = fieldName(field, index);
                const isRequired = Boolean(field.required);
                const options = String(field.options || '')
                  .split(',')
                  .map((option) => option.trim())
                  .filter(Boolean);

                return (
                  <div className="fc" key={name}>
                    <div className="fc-label">{field.label}{isRequired ? ' *' : ''}</div>
                    {field.field_type === 'textarea' && (
                      <textarea
                        className="fi"
                        rows="5"
                        value={values[name] || ''}
                        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                        required={isRequired}
                        style={{ resize: 'vertical', minHeight: 120 }}
                      />
                    )}
                    {field.field_type === 'select' && (
                      <select
                        className="fi fsel"
                        value={values[name] || ''}
                        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                        required={isRequired}
                      >
                        <option value="">Select an option</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                    {!['textarea', 'select'].includes(field.field_type) && (
                      <input
                        className="fi"
                        type={field.field_type === 'email' ? 'email' : 'text'}
                        value={values[name] || ''}
                        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                        required={isRequired}
                      />
                    )}
                  </div>
                );
              })}

              <button className="btn bp" type="submit" disabled={submitting} style={{ marginTop: 10 }}>
                {submitting ? 'Submitting…' : 'Send Enquiry'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
