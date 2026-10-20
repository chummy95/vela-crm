import { workflowLabels } from './workflow';

export function parseAmount(value) {
  const numeric = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatMoney(value, currency = 'GBP') {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(parseAmount(value));
  } catch {
    return `£${parseAmount(value).toLocaleString('en-GB')}`;
  }
}

export function toDate(value) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysFromToday(value) {
  const date = toDate(value);
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - startOfToday()) / 86400000);
}

export function formatDate(value, opts = { day: 'numeric', month: 'short' }) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-GB', opts) : '—';
}

export function relativeDay(value) {
  const diff = daysFromToday(value);
  if (diff === null) return '—';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) return `in ${diff} days`;
  if (diff < -1 && diff > -14) return `${Math.abs(diff)} days ago`;
  return formatDate(value);
}

export function isOverdue(invoice) {
  if (!invoice || invoice.status === 'paid') return false;
  const diff = daysFromToday(invoice.due_date);
  return diff !== null && diff < 0;
}

// Accepts a project (uses its own workflow) or a service name.
export function stageLabels(projectOrService) {
  if (projectOrService && typeof projectOrService === 'object') return workflowLabels(projectOrService);
  return workflowLabels({ service: projectOrService });
}

export function stageLabel(project) {
  const labels = stageLabels(project);
  const index = Math.min(Number(project?.stage || 0), labels.length - 1);
  return labels[index] || `Stage ${index + 1}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
