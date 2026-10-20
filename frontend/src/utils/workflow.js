// Project workflow: the stages of a project and the steps inside each stage.
//
// A project uses its own saved `workflow` if it has one; otherwise it falls back to the
// default for its service. Step ids are stable so reviews and questionnaires can point at them.

import { STAGES } from './constants';

export const STEP_TYPES = {
  questionnaire: 'Questionnaire',
  review: 'Upload for review',
  invoice: 'Final invoice',
  files: 'Final files',
};

function slug(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'step';
}

const step = (stageIndex, type, label, extra = {}) => ({ id: `s${stageIndex}-${slug(label)}`, type, label, ...extra });

function handoverSteps(i) {
  return [
    step(i, 'review', 'Final sign-off', { help: 'Share the complete brand for the client’s final approval.' }),
    step(i, 'invoice', 'Final invoice'),
    step(i, 'files', 'Final files'),
    step(i, 'questionnaire', 'Project feedback', { template: 'project_feedback' }),
  ];
}

export function serviceKey(service) {
  const value = String(service || '').toLowerCase();
  if (value.includes('pack')) return 'packaging';
  if (value.includes('web')) return 'web';
  return 'brand';
}

export function defaultWorkflow(service) {
  const key = serviceKey(service);
  if (key === 'brand') {
    return [
      { label: 'Strategy', steps: [
        step(0, 'questionnaire', 'Brand strategy questionnaire', { template: 'brand_strategy' }),
        step(0, 'review', 'Strategy first draft'),
      ] },
      { label: 'Brand Identity Presentation', steps: [
        step(1, 'review', 'Creative direction'),
        step(1, 'review', 'Logo design'),
        step(1, 'review', 'Brand assets'),
        step(1, 'review', 'Packaging'),
      ] },
      { label: 'Sign-off & Handover', steps: handoverSteps(2) },
    ];
  }
  const labels = STAGES[key];
  return labels.map((label, i) => (i === labels.length - 1
    ? { label, steps: handoverSteps(i) }
    : { label, steps: [step(i, 'review', label)] }));
}

export function getWorkflow(project) {
  if (Array.isArray(project?.workflow) && project.workflow.length) return project.workflow;
  return defaultWorkflow(project?.service);
}

export function workflowLabels(project) {
  return getWorkflow(project).map((s) => s.label);
}

export function newStepId(stageIndex, label) {
  return `s${stageIndex}-${slug(label)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Step status ─────────────────────────────────────────────── */

const byRoundDesc = (a, b) => Number(b.round || 0) - Number(a.round || 0) || String(b.sent_at).localeCompare(String(a.sent_at));

export function reviewsForStep(stepId, project, reviews = []) {
  return reviews.filter((r) => r.project_id === project.id && r.step_id === stepId).sort(byRoundDesc);
}

export function responseForStep(s, stageIndex, project, responses = []) {
  const mine = responses.filter((r) => r.project_id === project.id);
  return mine.filter((r) => r.step_id === s.id).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)))[0]
    // Questionnaires sent before steps existed: match by stage and title.
    || mine.find((r) => !r.step_id && Number(r.stage_index || 0) === stageIndex && r.title === s.label)
    || null;
}

// Returns { state, ... } where state is one of: todo, waiting, changes, done.
export function stepStatus(s, stageIndex, project, { reviews = [], responses = [], invoices = [] } = {}) {
  if (s.type === 'questionnaire') {
    const response = responseForStep(s, stageIndex, project, responses);
    if (!response) return { state: 'todo' };
    return { state: response.status === 'submitted' ? 'done' : 'waiting', response };
  }
  if (s.type === 'review' || s.type === 'files') {
    const rounds = reviewsForStep(s.id, project, reviews);
    const latest = rounds[0];
    if (!latest) return { state: 'todo', rounds };
    if (s.type === 'files') return { state: 'done', review: latest, rounds };
    const state = latest.status === 'approved' ? 'done' : latest.status === 'changes_requested' ? 'changes' : 'waiting';
    return { state, review: latest, rounds };
  }
  if (s.type === 'invoice') {
    const invoice = invoices.find((i) => i.id === s.invoice_id);
    if (!invoice) return { state: 'todo' };
    return { state: invoice.status === 'paid' ? 'done' : 'waiting', invoice };
  }
  return { state: 'todo' };
}

// Every step in a stage with its status, and whether it's unlocked yet.
// Steps run in order: a step opens once the one before it is done.
export function stageSteps(project, stageIndex, ctx) {
  const stage = getWorkflow(project)[stageIndex];
  if (!stage) return [];
  let previousDone = true;
  return stage.steps.map((s) => {
    const status = stepStatus(s, stageIndex, project, ctx);
    const started = status.state !== 'todo';
    const locked = !previousDone && !started;
    previousDone = status.state === 'done';
    return { step: s, ...status, locked };
  });
}

export function stageComplete(project, stageIndex, ctx) {
  const steps = stageSteps(project, stageIndex, ctx);
  return steps.length > 0 && steps.every((s) => s.state === 'done');
}

export function sanitizeWorkflow(workflow) {
  const types = Object.keys(STEP_TYPES);
  return (Array.isArray(workflow) ? workflow : [])
    .map((stage, i) => ({
      label: String(stage.label || '').trim() || `Stage ${i + 1}`,
      steps: (Array.isArray(stage.steps) ? stage.steps : [])
        .filter((s) => String(s.label || '').trim())
        .map((s) => {
          const clean = { id: String(s.id || newStepId(i, s.label)), type: types.includes(s.type) ? s.type : 'review', label: String(s.label).trim() };
          if (s.template) clean.template = String(s.template);
          if (s.invoice_id) clean.invoice_id = String(s.invoice_id);
          if (s.help) clean.help = String(s.help);
          return clean;
        }),
    }))
    .filter((stage) => stage.label);
}
