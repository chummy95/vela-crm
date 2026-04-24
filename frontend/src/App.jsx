import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
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

function Protected({ children }) {
  const { token, ready } = useAuth();

  if (!ready) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--card)', color: 'var(--text-s)' }}>Loading…</div>;
  }

  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/intake/:userId" element={<PublicForm />} />
        <Route path="/" element={<Protected><Layout /></Protected>}>
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
      </Routes>
    </AuthProvider>
  );
}
