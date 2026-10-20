import React from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from './Shell';
import { useAuth } from '../hooks/useAuth';
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

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <Shell
      nav={nav}
      home="/"
      userName={user?.name || 'Studio'}
      userSub={user?.studio_name}
      onSignOut={handleLogout}
    />
  );
}
