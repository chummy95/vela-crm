import React, { useRef, useState } from 'react';
import Icon from './Icon';
import { PLACEHOLDERS } from '../utils/contractTemplate';

const newId = () => `cl-${Math.random().toString(36).slice(2, 8)}`;

// Edit a contract's sections: title and terms, add, remove and reorder, insert placeholders.
export default function ClauseEditor({ clauses, onChange, disabled = false }) {
  const [open, setOpen] = useState(null);
  const lastField = useRef({ index: null, el: null });

  const update = (index, changes) => onChange(clauses.map((c, i) => (i === index ? { ...c, ...changes } : c)));
  const move = (index, dir) => {
    const next = [...clauses];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    onChange(next);
  };

  function insert(token) {
    const { index, el } = lastField.current;
    if (index === null || !el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const body = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
    update(index, { body });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  }

  return (
    <div className="clauses-edit">
      <details className="ph-help">
        <summary>Placeholders and formatting</summary>
        <p className="muted" style={{ fontSize: 12.5, margin: '8px 0' }}>Click a placeholder to insert it where your cursor is. It fills in from the contract, the client and your Settings.</p>
        <div className="ph-chips">
          {PLACEHOLDERS.map(([token, label]) => (
            <button key={token} type="button" className="ph-chip" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(token)} title={token}>{label}</button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          Start a line with <code>## </code> for a sub-heading, <code>- </code> for a bullet point, and wrap words in <code>**</code> for bold.
        </p>
      </details>
      <ol className="clause-list">
        {clauses.map((clause, index) => {
          const expanded = open === index;
          return (
            <li key={clause.id || index} className={`clause-item${expanded ? ' open' : ''}`}>
              <div className="clause-row">
                <button type="button" className="clause-toggle" onClick={() => setOpen(expanded ? null : index)} aria-expanded={expanded}>
                  <span className="faint">{index + 1}.</span> {clause.title || 'Untitled section'}
                </button>
                <span className="clause-tools">
                  <button type="button" className="mc" aria-label="Move up" disabled={disabled || index === 0} onClick={() => move(index, -1)}><Icon name="up" size={15} /></button>
                  <button type="button" className="mc" aria-label="Move down" disabled={disabled || index === clauses.length - 1} onClick={() => move(index, 1)}><Icon name="down" size={15} /></button>
                  <button type="button" className="mc" aria-label={`Remove ${clause.title}`} disabled={disabled} onClick={() => onChange(clauses.filter((_, i) => i !== index))}><Icon name="close" size={15} /></button>
                </span>
              </div>
              {expanded && (
                <div className="clause-fields">
                  <label className="fc-label" htmlFor={`cl-title-${index}`}>Section title</label>
                  <input id={`cl-title-${index}`} className="fi" value={clause.title} disabled={disabled} onChange={(e) => update(index, { title: e.target.value })} />
                  <label className="fc-label" htmlFor={`cl-body-${index}`} style={{ marginTop: 10 }}>Terms</label>
                  <textarea
                    id={`cl-body-${index}`}
                    className="fi clause-text"
                    value={clause.body}
                    disabled={disabled}
                    rows={Math.min(18, Math.max(4, String(clause.body || '').split('\n').length + 1))}
                    onFocus={(e) => { lastField.current = { index, el: e.target }; }}
                    onSelect={(e) => { lastField.current = { index, el: e.target }; }}
                    onChange={(e) => update(index, { body: e.target.value })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="btn bq bsm"
        disabled={disabled}
        onClick={() => { onChange([...clauses, { id: newId(), title: 'New section', body: '' }]); setOpen(clauses.length); }}
      >
        <Icon name="plus" size={15} />Add a section
      </button>
    </div>
  );
}
