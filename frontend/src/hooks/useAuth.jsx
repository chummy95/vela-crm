import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseConfigError, isFirebaseConfigured } from '../lib/firebase';
import { authAPI, normalizeRole, USER_ROLES } from '../utils/api';

const AuthContext = createContext(null);

function normalizeUser(firebaseUser, profile = {}) {
  return {
    id: firebaseUser?.uid || profile.id || '',
    email: firebaseUser?.email || profile.email || '',
    ...profile,
    role: normalizeRole(profile.role),
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(firebaseConfigError);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setReady(true);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setToken(null);
        setUser(null);
        setReady(true);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
        const profile = snapshot.exists() ? snapshot.data() : {};
        setToken(firebaseUser.uid);
        setUser(normalizeUser(firebaseUser, profile));
        setError('');
      } catch (authError) {
        setError(authError.message);
      } finally {
        setReady(true);
      }
    });

    return unsubscribe;
  }, []);

  async function login(credentials, options) {
    setError('');
    const result = await authAPI.login(credentials, options);
    if (auth?.currentUser) {
      setToken(auth.currentUser.uid);
      setUser(normalizeUser(auth.currentUser, result.user || {}));
    }
    return result;
  }

  async function register(details) {
    setError('');
    const result = await authAPI.register(details);
    if (auth?.currentUser) {
      setToken(auth.currentUser.uid);
      setUser(normalizeUser(auth.currentUser, result.user || {}));
    }
    return result;
  }

  async function logout() {
    setToken(null);
    setUser(null);
    await authAPI.logout();
  }

  return (
    <AuthContext.Provider value={{ token, user, ready, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
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
