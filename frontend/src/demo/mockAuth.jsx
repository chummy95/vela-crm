// Demo-mode auth: always signed in as a sample studio user (or a client when the URL starts with /portal).
import React, { createContext, useContext, useState } from 'react';
import { DEMO_USER, normalizeRole, USER_ROLES } from './mockApi';

const AuthContext = createContext(null);

const DEMO_CLIENT = { id: 'p1', name: 'Layla Haddad', client_name: 'Maison Noor', client_id: 'c1', role: 'client' };

export function AuthProvider({ children }) {
  const startAsClient = typeof window !== 'undefined' && window.location.pathname.startsWith('/portal');
  const [user, setUser] = useState(startAsClient ? DEMO_CLIENT : DEMO_USER);
  const value = {
    token: user ? 'demo' : null,
    user,
    ready: true,
    error: '',
    async login() { setUser(DEMO_USER); return { redirectTo: '/' }; },
    async register() { setUser(DEMO_USER); return { redirectTo: '/' }; },
    async logout() { setUser(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function isClientUser(user) {
  return normalizeRole(user?.role) === USER_ROLES.CLIENT;
}

export function isStudioUser(user) {
  return normalizeRole(user?.role) === USER_ROLES.STUDIO;
}
