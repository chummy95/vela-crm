import React from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from './Shell';
import { useAuth } from '../hooks/useAuth';
import { useStudioTheme } from '../hooks/useStudioTheme';

const NAV = [
  { to: '/portal',           label: 'Overview',  icon: 'home' },
  { to: '/portal/projects',  label: 'Projects',  icon: 'folder',   section: 'Your work' },
  { to: '/portal/questionnaires', label: 'Questionnaires', icon: 'clipboard' },
  { to: '/portal/messages',  label: 'Messages',  icon: 'message' },
  { to: '/portal/schedule',  label: 'Schedule',  icon: 'calendar' },
  { to: '/portal/proposals', label: 'Proposals', icon: 'proposal', section: 'Paperwork' },
  { to: '/portal/contracts', label: 'Contracts', icon: 'contract' },
  { to: '/portal/invoices',  label: 'Invoices',  icon: 'receipt' },
];

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const brand = useStudioTheme(user?.id ? `${user.role || 'u'}-${user.id}` : '');

  async function handleLogout() {
    await logout();
    navigate('/portal/login');
  }

  return (
    <Shell
      nav={NAV}
      home="/portal"
      logoVariant="whiteTagline"
      logoWidth={132}
      userName={user?.name || 'Client'}
      userSub={user?.client_name}
      onSignOut={handleLogout}
      brand={brand}
    />
  );
}
