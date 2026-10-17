import React from 'react';
import { initials } from '../utils/format';

// A small brand swatch carrying the client's initials in their own colour.
export default function ClientMark({ name, color, size = 32 }) {
  return (
    <span
      className="mark"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: color || 'var(--ink)',
        fontSize: Math.round(size * 0.4),
        borderRadius: Math.max(6, Math.round(size * 0.26)),
      }}
    >
      {initials(name)}
    </span>
  );
}
