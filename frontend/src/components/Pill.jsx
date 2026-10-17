import React from 'react';
import { STATUS_COLORS } from '../utils/constants';

function sentenceCase(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function Pill({ status, label }) {
  const s = STATUS_COLORS[status] || { bg: 'var(--navy-pale)', color: 'var(--navy)' };
  return (
    <span className="pill" style={{ background: s.bg, color: s.color }}>
      {sentenceCase(label || status)}
    </span>
  );
}
