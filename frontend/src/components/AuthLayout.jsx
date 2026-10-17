import React from 'react';
import BrandLogo from './BrandLogo';

// Two-panel sign-in frame: the brand on navy, the form on paper.
export default function AuthLayout({ eyebrow, title, intro, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <BrandLogo variant="whiteTagline" width={176} alt="Vela" />
        <p className="auth-brand-line">The calm place to run a creative studio: clients, projects and paperwork, together.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card auth-panel">
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
