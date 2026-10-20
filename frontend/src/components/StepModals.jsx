import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { invoicesAPI, projectsAPI } from '../utils/api';
import { STEP_TYPES, getWorkflow, newStepId } from '../utils/workflow';
import { formatMoney } from '../utils/format';

const isoDay = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const copyWorkflow = (project) => getWorkflow(project).map((stage) => ({ ...stage, steps: stage.steps.map((s) => ({ ...s })) }));

// Link the final invoice step to an invoice: an existing one for this project, or a new one.
export function FinalInvoiceModal({ open, onClose, project, step, invoices = [], currency = 'GBP', onSaved }) {
  const linkedElsewhere = useMemo(() => new Set(getWorkflow(project || {}).flatMap((st) => st.steps).map((s) => s.invoice_id).filter(Boolean)), [project]);
  const candidates = useMemo(() => invoices.filter((i) => i.project_id === project?.id && !linkedElsewhere.has(i.id)), [invoices, project, linkedElsewhere]);
  const remaining = useMemo(() => {
    const billed = invoices.filter((i) => i.project_id === project?.id).reduce((sum, i) => sum + (Number(i.subtotal ?? i.amount) || 0), 0);
    return Math.max(0, (Number(project?.value) || 0) - billed);
  }, [invoices, project]);

  const [choice, setChoice] = useState('new');
  const [form, setForm] = useState({ amount: '', description: '', due_date: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    const unpaidFinal = candidates.find((i) => /final|balance/i.test(i.description || ''));
    setChoice(unpaidFinal ? unpaidFinal.id : 'new');
    setForm({ amount: remaining ? String(remaining) : '', description: `${project?.service || 'Project'} final balance`, due_date: isoDay(14) });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      let invoice = candidates.find((i) => i.id === choice);
      if (!invoice) {
        invoice = await invoicesAPI.create({ client_id: project.client_id, project_id: project.id, items: [{ description: form.description, quantity: 1, unit_price: form.amount }], due_date: form.due_date, status: 'unpaid' });
      }
      const workflow = copyWorkflow(project).map((stage) => ({ ...stage, steps: stage.steps.map((s) => (s.id === step.id ? { ...s, invoice_id: invoice.id } : s)) }));
      await projectsAPI.update(project.id, { workflow });
      onSaved?.({ workflow, invoice, created: choice === 'new' });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Final invoice"
      footer={
        <>
          <button className="btn bg" type="button" onClick={onClose}>Cancel</button>
          <button className="btn bp" type="submit" form="final-invoice" disabled={saving}>{saving ? 'Saving…' : choice === 'new' ? 'Create invoice' : 'Use this invoice'}</button>
        </>
      }
    >
      <form id="final-invoice" onSubmit={save}>
        {error && <div className="form-error">{error}</div>}
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          {project?.client_name} sees it in their portal. The final files step unlocks once you mark it paid.
        </p>
        {candidates.length > 0 && (
          <fieldset className="fc" style={{ border: 'none', padding: 0 }}>
            <legend className="fc-label">Use an invoice you’ve already made</legend>
            {candidates.map((i) => (
              <label key={i.id} className="file-row" style={{ cursor: 'pointer', marginBottom: 8 }}>
                <input type="radio" name="fi-choice" checked={choice === i.id} onChange={() => setChoice(i.id)} />
                <span className="row-main">
                  <span className="row-title" style={{ display: 'block' }}>{i.description || 'Invoice'}</span>
                  <span className="row-sub" style={{ display: 'block' }}>{formatMoney(i.amount, currency)}, {i.status === 'paid' ? 'paid' : 'unpaid'}</span>
                </span>
              </label>
            ))}
            <label className="file-row" style={{ cursor: 'pointer' }}>
              <input type="radio" name="fi-choice" checked={choice === 'new'} onChange={() => setChoice('new')} />
              <span className="row-title">Create a new invoice</span>
            </label>
          </fieldset>
        )}
        {choice === 'new' && (
          <>
            <div className="fc">
              <label className="fc-label" htmlFor="fi-desc">Description</label>
              <input id="fi-desc" className="fi" value={form.description} onChange={set('description')} required />
            </div>
            <div className="fi-row">
              <div className="fc">
                <label className="fc-label" htmlFor="fi-amount">Amount <span className="faint" style={{ fontWeight: 400 }}>(before VAT)</span></label>
                <input id="fi-amount" className="fi" inputMode="decimal" value={form.amount} onChange={set('amount')} required placeholder="2400" />
                {Number(project?.value) > 0 && <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{formatMoney(remaining, currency)} of {formatMoney(project.value, currency)} not invoiced yet</div>}
              </div>
              <div className="fc">
                <label className="fc-label" htmlFor="fi-due">Due date</label>
                <input id="fi-due" className="fi" type="date" value={form.due_date} onChange={set('due_date')} />
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

// Rename, add, remove and reorder the steps in each stage of one project.
export function EditStepsModal({ open, onClose, project, onSaved }) {
  const [stages, setStages] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && project) { setStages(copyWorkflow(project)); setError(''); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const editStage = (si, fn) => setStages((all) => all.map((st, i) => (i === si ? fn(st) : st)));
  const editStep = (si, k, changes) => editStage(si, (st) => ({ ...st, steps: st.steps.map((s, j) => (j === k ? { ...s, ...changes } : s)) }));
  const move = (si, k, dir) => editStage(si, (st) => {
    const steps = [...st.steps];
    const [item] = steps.splice(k, 1);
    steps.splice(k + dir, 0, item);
    return { ...st, steps };
  });

  async function save() {
    setSaving(true);
    setError('');
    try {
      const workflow = stages.map((st) => ({ ...st, steps: st.steps.filter((s) => s.label.trim()) }));
      await projectsAPI.update(project.id, { workflow });
      onSaved?.(workflow);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit steps"
      footer={
        <>
          <button className="btn bg" type="button" onClick={onClose}>Cancel</button>
          <button className="btn bp" type="button" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save steps'}</button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>Only changes this project. Steps run in order, and anything already shared with the client stays on record.</p>
      {stages.map((stage, si) => (
        <div key={si} className="wf-stage">
          <label className="fc-label" htmlFor={`wf-stage-${si}`}>Stage {si + 1}</label>
          <input id={`wf-stage-${si}`} className="fi" value={stage.label} onChange={(e) => editStage(si, (st) => ({ ...st, label: e.target.value }))} style={{ fontWeight: 500 }} />
          {stage.steps.map((s, k) => (
            <div key={s.id} className="wf-step">
              <input className="fi" aria-label={`Step ${k + 1} name`} value={s.label} onChange={(e) => editStep(si, k, { label: e.target.value })} />
              <select className="fi fsel" aria-label={`Step ${k + 1} type`} value={s.type} onChange={(e) => editStep(si, k, { type: e.target.value })}>
                {Object.entries(STEP_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <span style={{ display: 'flex' }}>
                <button type="button" className="mc" aria-label="Move up" disabled={k === 0} onClick={() => move(si, k, -1)}><Icon name="up" size={15} /></button>
                <button type="button" className="mc" aria-label="Move down" disabled={k === stage.steps.length - 1} onClick={() => move(si, k, 1)}><Icon name="down" size={15} /></button>
                <button type="button" className="mc" aria-label={`Remove ${s.label}`} onClick={() => editStage(si, (st) => ({ ...st, steps: st.steps.filter((_, j) => j !== k) }))}><Icon name="close" size={15} /></button>
              </span>
            </div>
          ))}
          <button type="button" className="btn bq bsm" style={{ marginTop: 10 }} onClick={() => editStage(si, (st) => ({ ...st, steps: [...st.steps, { id: newStepId(si, 'step'), type: 'review', label: '' }] }))}>
            <Icon name="plus" size={15} />Add a step
          </button>
        </div>
      ))}
    </Modal>
  );
}
