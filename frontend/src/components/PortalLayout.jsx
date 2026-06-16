import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/portal', label: 'Overview', icon: '🏠', section: 'Portal' },
  { to: '/portal/projects', label: 'Projects', icon: '📁', section: 'Workspace' },
  { to: '/portal/invoices', label: 'Invoices', icon: '💳' },
  { to: '/portal/proposals', label: 'Proposals', icon: '📋' },
  { to: '/portal/contracts', label: 'Contracts', icon: '✍️' },
  { to: '/portal/schedule', label: 'Schedule', icon: '📅', section: 'Updates' },
  { to: '/portal/messages', label: 'Messages', icon: '💬' },
];

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/portal/login');
  }

  return (
    <div className="app">
      <aside className="sidebar" style={{ background: 'linear-gradient(180deg, var(--navy), #314976)' }}>
        <div className="sb-logo" onClick={() => navigate('/portal')}>
          PORT<span>AL</span>
        </div>
        <nav className="sb-nav">
          {NAV.map((item) => (
            <React.Fragment key={item.to}>
              {item.section && <div className="sb-sec">{item.section}</div>}
              <NavLink to={item.to} end={item.to === '/portal'} className={({ isActive }) => `ni${isActive ? ' active' : ''}`}>
                <span className="ico">{item.icon}</span>
                {item.label}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        <div className="sb-user">
          <div className="ua">{(user?.client_name || user?.name || 'C')[0]}</div>
          <div>
            <div className="un">{user?.client_name || user?.name || 'Client'}</div>
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
