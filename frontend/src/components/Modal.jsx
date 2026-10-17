import React, { useEffect } from 'react';
import Icon from './Icon';

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mo open" onClick={e => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="md" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="mh">
          <span className="mt">{title}</span>
          <button className="mc" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}
