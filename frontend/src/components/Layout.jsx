import React from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from './Shell';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/',          label: 'Dashboard', icon: 'home' },
  { to: '/clients',   label: 'Clients',   icon: 'users',    section: 'Work' },
  { to: '/projects',  label: 'Projects',  icon: 'folder' },
  { to: '/messages',  label: 'Messages',  icon: 'message' },
  { to: '/scheduler', label: 'Schedule',  icon: 'calendar' },
  { to: '/proposals', label: 'Proposals', icon: 'proposal', section: 'Paperwork' },
  { to: '/contracts', label: 'Contracts', icon: 'contract' },
  { to: '/invoices',  label: 'Invoices',  icon: 'receipt' },
  { to: '/forms',     label: 'Enquiries', icon: 'inbox',    section: 'Studio' },
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <Shell
      nav={NAV}
      home="/"
      userName={user?.name || 'Studio'}
      userSub={user?.studio_name}
      onSignOut={handleLogout}
    />
  );
}
