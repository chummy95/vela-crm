import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/',          label: 'Dashboard',     icon: '🏠', section: 'Overview' },
  { to: '/projects',  label: 'Projects',      icon: '📁', section: 'Work' },
  { to: '/clients',   label: 'Clients',       icon: '👥' },
  { to: '/invoices',  label: 'Invoices',      icon: '💳' },
  { to: '/proposals', label: 'Proposals',     icon: '📋', section: 'Documents' },
  { to: '/contracts', label: 'Contracts',     icon: '✍️' },
  { to: '/scheduler', label: 'Scheduler',     icon: '📅', section: 'Studio' },
  { to: '/forms',     label: 'Forms',         icon: '📝' },
  { to: '/messages',  label: 'Messages',      icon: '💬' },
  { to: '/analytics', label: 'Analytics',     icon: '📊' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sb-logo" onClick={() => navigate('/')}>VEL<span>A</span></div>
        <nav className="sb-nav">
          {NAV.map(item => (
            <React.Fragment key={item.to}>
              {item.section && <div className="sb-sec">{item.section}</div>}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `ni${isActive ? ' active' : ''}`}
              >
                <span className="ico">{item.icon}</span>
                {item.label}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        <div className="sb-user">
          <div className="ua">{user?.name?.[0] || 'M'}</div>
          <div>
            <div className="un">{user?.name || 'Mayaa'}</div>
            <div className="up" onClick={handleLogout} style={{ cursor: 'pointer' }}>Sign Out</div>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
