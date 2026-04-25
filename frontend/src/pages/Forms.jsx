import React, { useEffect, useMemo, useState } from 'react';
import { formsAPI } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

function normalizeField(field, index) {
  return {
    label: field.label || '',
    field_type: field.field_type || 'text',
    required: Boolean(field.required),
    options: field.options || '',
    sort_order: field.sort_order ?? index,
  };
}

export default function Forms() {
  const { user } = useAuth();
  const [fields, setFields] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl = user?.id ? `${window.location.origin}/intake/${user.id}` : '';

  useEffect(() => {
    Promise.all([formsAPI.getFields(), formsAPI.submissions()])
      .then(([fieldRows, submissionRows]) => {
        setFields(fieldRows.map(normalizeField));
        setSubmissions(submissionRows);
      })
      .catch((err) => setError(err.message));
  }, []);

  const sortedFields = useMemo(
    () => fields.slice().sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0)),
    [fields]
  );

  function replaceFields(nextFields) {
    setFields(nextFields.map((field, index) => ({ ...field, sort_order: index })));
  }

  function updateField(index, key, value) {
    replaceFields(sortedFields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, [key]: value } : field)));
  }

  function addField() {
    replaceFields([...sortedFields, normalizeField({ label: '', field_type: 'text', required: false, options: '' }, sortedFields.length)]);
  }

  function removeField(index) {
    replaceFields(sortedFields.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function moveField(index, direction) {
    const next = sortedFields.slice();
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    replaceFields(next);
  }

  async function save() {
    try {
      setSaving(true);
      const result = await formsAPI.saveFields(sortedFields);
      replaceFields(result.fields || sortedFields);
      setError('');
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
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Forms</div>
        <div className="tb-r">
          <button className="btn bg bsm" onClick={addField}>+ Field</button>
          <button className="btn bp bsm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Form'}</button>
        </div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h"><div className="card-title">Shareable Intake Link</div></div>
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--text-s)', marginBottom: 10 }}>
              Share this public link with clients so they can submit their enquiry straight into Firestore.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="fi" readOnly value={shareUrl} />
              <button className="btn bg" type="button" onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</button>
              <a className="btn bp" href={shareUrl} target="_blank" rel="noreferrer">Preview</a>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="card-title">Intake Fields</div></div>
          <div style={{ padding: 18 }}>
            {sortedFields.map((field, index) => (
              <div key={`${field.label}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Field {index + 1}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn bg bxs" type="button" onClick={() => moveField(index, -1)} disabled={index === 0}>Up</button>
                    <button className="btn bg bxs" type="button" onClick={() => moveField(index, 1)} disabled={index === sortedFields.length - 1}>Down</button>
                    <button className="btn bg bxs" type="button" onClick={() => removeField(index)}>Remove</button>
                  </div>
                </div>
                <div className="fi-row">
                  <div className="fc"><div className="fc-label">Label</div><input className="fi" value={field.label} onChange={(event) => updateField(index, 'label', event.target.value)} /></div>
                  <div className="fc">
                    <div className="fc-label">Type</div>
                    <select className="fi fsel" value={field.field_type} onChange={(event) => updateField(index, 'field_type', event.target.value)}>
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                    </select>
                  </div>
                </div>
                <div className="fi-row">
                  <div className="fc"><div className="fc-label">Options</div><input className="fi" value={field.options || ''} onChange={(event) => updateField(index, 'options', event.target.value)} placeholder="Comma-separated for select fields" /></div>
                  <div className="fc">
                    <div className="fc-label">Required</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40 }}>
                      <input type="checkbox" checked={Boolean(field.required)} onChange={(event) => updateField(index, 'required', event.target.checked)} />
                      <span style={{ fontSize: 13, color: 'var(--text-s)' }}>Mark this question as required</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
            {!sortedFields.length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No intake fields yet. Add your first one.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="card-title">Recent Submissions</div></div>
          <table className="tbl">
            <thead><tr><th>Submitted</th><th>Details</th></tr></thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{submission.submitted_at}</td>
                  <td>
                    {Object.entries(submission.data || {}).map(([key, value]) => (
                      <div key={key} style={{ fontSize: 12, marginBottom: 4 }}><b>{key.replace(/_/g, ' ')}:</b> {String(value)}</div>
                    ))}
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && <tr><td colSpan="2" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No submissions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
