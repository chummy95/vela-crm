import React, { useEffect, useState } from 'react';
import { formsAPI } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export default function Forms() {
  const { user } = useAuth();
  const [fields, setFields] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const shareUrl = user?.id ? `${window.location.origin}/intake/${user.id}` : '';

  useEffect(() => {
    Promise.all([formsAPI.getFields(), formsAPI.submissions()])
      .then(([fieldRows, submissionRows]) => {
        setFields(fieldRows.map((field, index) => ({ ...field, sort_order: field.sort_order ?? index })));
        setSubmissions(submissionRows);
      })
      .catch((err) => setError(err.message));
  }, []);

  function updateField(index, key, value) {
    setFields((prev) => prev.map((field, fieldIndex) => (fieldIndex === index ? { ...field, [key]: value } : field)));
  }

  function addField() {
    setFields((prev) => [...prev, { label: '', field_type: 'text', required: 0, options: '', sort_order: prev.length }]);
  }

  async function save() {
    try {
      setSaving(true);
      await formsAPI.saveFields(fields);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
            <input className="fi" readOnly value={shareUrl} />
          </div>
        </div>
        <div className="card">
          <div className="card-h"><div className="card-title">Intake Fields</div></div>
          <div style={{ padding: 18 }}>
            {fields.map((field, index) => (
              <div key={`${field.label}-${index}`} className="fi-row" style={{ marginBottom: 10 }}>
                <div className="fc"><div className="fc-label">Label</div><input className="fi" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} /></div>
                <div className="fc">
                  <div className="fc-label">Type</div>
                  <select className="fi fsel" value={field.field_type} onChange={(e) => updateField(index, 'field_type', e.target.value)}>
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                  </select>
                </div>
                <div className="fc"><div className="fc-label">Options</div><input className="fi" value={field.options || ''} onChange={(e) => updateField(index, 'options', e.target.value)} /></div>
              </div>
            ))}
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
                      <div key={key} style={{ fontSize: 12, marginBottom: 4 }}><b>{key}:</b> {String(value)}</div>
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
