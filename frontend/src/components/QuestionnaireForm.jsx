import React from 'react';
import { optionList } from '../utils/questionnaires';

// Renders a questionnaire's questions as a fillable form (client portal) or a preview (studio).
export default function QuestionnaireForm({ questions = [], answers = {}, onChange, readOnly = false, missing = new Set(), idPrefix = 'q' }) {
  function set(id, value) {
    if (!readOnly && onChange) onChange({ ...answers, [id]: value });
  }

  function toggle(id, option) {
    const current = Array.isArray(answers[id]) ? answers[id] : [];
    set(id, current.includes(option) ? current.filter((o) => o !== option) : [...current, option]);
  }

  return (
    <div>
      {questions.map((q) => {
        if (q.type === 'section') {
          return <h2 key={q.id} className="q-section">{q.label}</h2>;
        }
        const fieldId = `${idPrefix}-${q.id}`;
        const value = answers[q.id];
        const isMissing = missing.has(q.id);
        const options = optionList(q);
        return (
          <div key={q.id} className={`q-item${isMissing ? ' missing' : ''}`} id={`wrap-${fieldId}`}>
            {q.type === 'choice' || q.type === 'checkboxes' ? (
              <fieldset style={{ border: 'none' }}>
                <legend className="q-label">{q.label}{!q.required && <span className="faint" style={{ fontWeight: 400 }}> (optional)</span>}</legend>
                {q.help && <div className="q-help">{q.help}</div>}
                <div className="q-options">
                  {options.map((option) => {
                    const on = q.type === 'choice' ? value === option : Array.isArray(value) && value.includes(option);
                    return (
                      <label key={option} className={`q-option${on ? ' on' : ''}`}>
                        <input
                          type={q.type === 'choice' ? 'radio' : 'checkbox'}
                          name={fieldId}
                          checked={on}
                          disabled={readOnly}
                          onChange={() => (q.type === 'choice' ? set(q.id, option) : toggle(q.id, option))}
                        />
                        {option}
                      </label>
                    );
                  })}
                  {!options.length && <span className="faint" style={{ fontSize: 13 }}>No choices added yet.</span>}
                </div>
              </fieldset>
            ) : (
              <>
                <label className="q-label" htmlFor={fieldId}>{q.label}{!q.required && <span className="faint" style={{ fontWeight: 400 }}> (optional)</span>}</label>
                {q.help && <div className="q-help">{q.help}</div>}
                {q.type === 'text' ? (
                  <input id={fieldId} className="fi" value={value || ''} onChange={(e) => set(q.id, e.target.value)} readOnly={readOnly} />
                ) : (
                  <textarea id={fieldId} className="fi" rows={4} value={value || ''} onChange={(e) => set(q.id, e.target.value)} readOnly={readOnly} style={{ minHeight: 110 }} />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
