import React, { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mo open" onClick={e => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="md">
        <div className="mh">
          <span className="mt">{title}</span>
          <button className="mc" onClick={onClose}>✕</button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}
