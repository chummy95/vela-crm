import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from './Shell';
import { useAuth } from '../hooks/useAuth';
import { useStudioTheme } from '../hooks/useStudioTheme';
import { clientsAPI, notifyAPI, projectsAPI } from '../utils/api';
import { QuestionnaireAlertsProvider, useQuestionnaireAlerts } from '../hooks/useQuestionnaireAlerts';

const NAV = [
  { to: '/',          label: 'Dashboard', icon: 'home' },
  { to: '/clients',   label: 'Clients',   icon: 'users',    section: 'Work' },
  { to: '/projects',  label: 'Projects',  icon: 'folder' },
  { to: '/questionnaires', label: 'Questionnaires', icon: 'clipboard' },
  { to: '/messages',  label: 'Messages',  icon: 'message' },
  { to: '/scheduler', label: 'Schedule',  icon: 'calendar' },
  { to: '/proposals', label: 'Proposals', icon: 'proposal', section: 'Paperwork' },
  { to: '/contracts', label: 'Contracts', icon: 'contract' },
  { to: '/invoices',  label: 'Invoices',  icon: 'receipt' },
  { to: '/forms',     label: 'Enquiries', icon: 'inbox',    section: 'Studio' },
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/settings',  label: 'Settings',  icon: 'settings' },
];

export default function Layout() {
  return (
    <QuestionnaireAlertsProvider>
      <StudioShell />
    </QuestionnaireAlertsProvider>
  );
}

function StudioShell() {
  const { user, logout } = useAuth();
  const { unseen, reviewUnseen } = useQuestionnaireAlerts();
  const nav = NAV.map((item) => {
    if (item.to === '/questionnaires') return { ...item, badge: unseen.length };
    if (item.to === '/projects') return { ...item, badge: reviewUnseen.length };
    return item;
  });
  const navigate = useNavigate();
  const brand = useStudioTheme(user?.id ? `${user.role || 'u'}-${user.id}` : '');

  // Once a session: make sure Vela knows where to email this studio, and check in (last seen,
  // client and project counts) for the owner's overview. Also tells us if this is Vela's owner.
  const [isOwner, setIsOwner] = useState(() => {
    try { return sessionStorage.getItem('vela-owner') === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (!user?.id) return;
    const key = `vela-checkin-${user.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* private mode */ }
    Promise.all([clientsAPI.list().catch(() => null), projectsAPI.list().catch(() => null)])
      .then(([clients, projects]) => notifyAPI.checkIn({ clients: clients?.length, projects: projects?.length }))
      .then((result) => {
        setIsOwner(Boolean(result?.owner));
        try {
          sessionStorage.setItem(key, '1');
          sessionStorage.setItem('vela-owner', result?.owner ? '1' : '0');
        } catch { /* private mode */ }
      })
      .catch(() => {});
  }, [user?.id]);
  const navItems = isOwner ? [...nav, { to: '/owner', label: 'Owner', icon: 'chart', section: 'Vela' }] : nav;

  async function handleLogout() {
    try { sessionStorage.removeItem('vela-owner'); } catch { /* private mode */ }
    await logout();
    navigate('/login');
  }

  return (
    <Shell
      nav={navItems}
      home="/"
      userName={user?.name || 'Studio'}
      userSub={user?.studio_name}
      onSignOut={handleLogout}
      brand={brand}
    />
  );
}
