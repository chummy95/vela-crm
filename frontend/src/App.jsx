import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, isClientUser, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Proposals from './pages/Proposals';
import Contracts from './pages/Contracts';
import Scheduler from './pages/Scheduler';
import Forms from './pages/Forms';
import Messages from './pages/Messages';
import Analytics from './pages/Analytics';
import PublicForm from './pages/PublicForm';
import PortalLogin from './pages/PortalLogin';
import PortalDashboard from './pages/PortalDashboard';
import PortalProjects from './pages/PortalProjects';
import PortalInvoices from './pages/PortalInvoices';
import PortalProposals from './pages/PortalProposals';
import PortalContracts from './pages/PortalContracts';
import PortalSchedule from './pages/PortalSchedule';
import PortalMessages from './pages/PortalMessages';

function homeForRole(user) {
  return isClientUser(user) ? '/portal' : '/';
}

function Protected({ children, allowedRole = '' }) {
  const { token, ready, user } = useAuth();

  if (!ready) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--card)', color: 'var(--text-s)' }}>Loading…</div>;
  }

  if (!token) {
    return <Navigate to={allowedRole === 'client' ? '/portal/login' : '/login'} replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to={homeForRole(user)} replace />;
  }

  return children;
}

function PublicOnly({ children }) {
  const { token, ready, user } = useAuth();

  if (!ready) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--card)', color: 'var(--text-s)' }}>Loading…</div>;
  }

  return token ? <Navigate to={homeForRole(user)} replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/portal/login" element={<PublicOnly><PortalLogin /></PublicOnly>} />
        <Route path="/intake/:userId" element={<PublicForm />} />
        <Route path="/" element={<Protected allowedRole="studio"><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="projects/*" element={<Projects />} />
          <Route path="clients" element={<Clients />} />
          <Route path="invoices/*" element={<Invoices />} />
          <Route path="proposals/*" element={<Proposals />} />
          <Route path="contracts/*" element={<Contracts />} />
          <Route path="scheduler" element={<Scheduler />} />
          <Route path="forms" element={<Forms />} />
          <Route path="messages" element={<Messages />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route path="/portal" element={<Protected allowedRole="client"><PortalLayout /></Protected>}>
          <Route index element={<PortalDashboard />} />
          <Route path="projects/*" element={<PortalProjects />} />
          <Route path="invoices/*" element={<PortalInvoices />} />
          <Route path="proposals/*" element={<PortalProposals />} />
          <Route path="contracts/*" element={<PortalContracts />} />
          <Route path="schedule" element={<PortalSchedule />} />
          <Route path="messages" element={<PortalMessages />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
