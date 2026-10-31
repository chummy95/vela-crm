import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import Icon from './Icon';

// Shared frame for the studio app and the client portal: sidebar, mobile drawer, page outlet.
// `brand` (optional) shows the studio's own logo or name instead of Vela's.
function SidebarMark({ brand, logoVariant, width, compact = false }) {
  if (brand?.logo) return <img className="sb-studio-logo" src={brand.logo} alt={brand.name || 'Studio'} style={{ maxWidth: width, maxHeight: compact ? 36 : 56 }} />;
  if (brand?.branded && brand.name) return <span className={`sb-studio-name${compact ? ' compact' : ''}`}>{brand.name}</span>;
  return <BrandLogo variant={logoVariant} width={compact ? 84 : width} alt="Vela" className="brand-logo" />;
}

export default function Shell({ nav, home, logoVariant = 'white', logoWidth = 112, userName, userSub, onSignOut, brand }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`app${open ? ' nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sb-logo">
          <button type="button" onClick={() => navigate(home)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} aria-label="Go to overview">
            <SidebarMark brand={brand} logoVariant={logoVariant} width={brand?.logo ? 150 : logoWidth} />
          </button>
          <button type="button" className="sb-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon name="close" size={20} />
          </button>
        </div>
        <nav className="sb-nav">
          {nav.map((item) => (
            <React.Fragment key={item.to}>
              {item.section && <div className="sb-sec">{item.section}</div>}
              <NavLink to={item.to} end={item.to === home} className={({ isActive }) => `ni${isActive ? ' active' : ''}`}>
                <Icon name={item.icon} />
                {item.label}
                {item.badge ? <span className="ni-badge" aria-label={`${item.badge} new`}>{item.badge}</span> : null}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        {brand?.branded && <div className="sb-powered">Powered by Vela</div>}
        <div className="sb-user">
          <div className="ua" aria-hidden="true">{(userName || 'V')[0]}</div>
          <div style={{ minWidth: 0 }}>
            <div className="un">{userName}</div>
            {userSub && <div className="sb-studio">{userSub}</div>}
          </div>
          <button type="button" className="sb-signout" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <main className="main">
        <div className="mobile-bar">
          <SidebarMark brand={brand} logoVariant={logoVariant} width={120} compact />
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={22} />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
