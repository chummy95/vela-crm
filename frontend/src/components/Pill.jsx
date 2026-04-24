import React from 'react';
import { STATUS_COLORS } from '../utils/constants';

export default function Pill({ status, label }) {
  const s = STATUS_COLORS[status] || { bg: 'var(--navy-pale)', color: 'var(--navy)' };
  return (
    <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:'20px', fontSize:'10.5px', fontWeight:600, background:s.bg, color:s.color }}>
      {label || status}
    </span>
  );
}
