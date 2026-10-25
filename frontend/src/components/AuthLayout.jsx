import React from 'react';
import BrandLogo from './BrandLogo';

// Columns of Vela wordmarks rolling down the navy panel, each at its own size, pace and depth.
const COLUMNS = [
  { width: 120, speed: 40, opacity: 0.06, offset: -12 },
  { width: 210, speed: 26, opacity: 0.11, offset: -19 },
  { width: 150, speed: 34, opacity: 0.07, offset: -5 },
];
const PER_SET = 6;

function VelaRoll() {
  return (
    <div className="vela-roll" aria-hidden="true">
      {COLUMNS.map((col, c) => (
        <div
          key={c}
          className="vela-roll-col"
          style={{ '--w': `${col.width}px`, '--speed': `${col.speed}s`, '--o': col.opacity, '--offset': `${col.offset}s` }}
        >
          <div className="vela-roll-track">
            {Array.from({ length: PER_SET * 2 }, (_, i) => (
              <BrandLogo key={i} variant="white" width={col.width} alt="" className="vela-roll-mark" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Two-panel sign-in frame: the brand on navy, the form on paper.
export default function AuthLayout({ eyebrow, title, intro, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <VelaRoll />
        <div className="auth-brand-logo"><BrandLogo variant="whiteTagline" width={176} alt="Vela" /></div>
        <p className="auth-brand-line">
          <span>The calm place to run a creative studio:</span>{' '}
          <span>clients, projects and paperwork,</span>{' '}
          <span>together.</span>
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-card auth-panel auth-enter">
          <div className="auth-mobile-logo"><BrandLogo variant="blueTagline" width={120} alt="Vela" /></div>
          {eyebrow && <div className="auth-eyebrow">{eyebrow}</div>}
          <h1 className="auth-title">{title}</h1>
          {intro && <p className="auth-copy">{intro}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
