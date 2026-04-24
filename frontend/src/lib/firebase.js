import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyDP-_qJDifpCQ8bsfTv2pbXcmIIgTDLO1Y',
  authDomain: 'vela-crm-20260420.firebaseapp.com',
  projectId: 'vela-crm-20260420',
  storageBucket: 'vela-crm-20260420.firebasestorage.app',
  messagingSenderId: '121081847097',
  appId: '1:121081847097:web:d4dfe93c22d04635075ce8',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

export const isFirebaseConfigured = requiredKeys.every((key) => firebaseConfig[key]);
export const firebaseConfigError = isFirebaseConfigured
  ? ''
  : 'Firebase config is missing. Add your Vite Firebase environment variables before running the app.';

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export function ensureFirebaseConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error(firebaseConfigError);
  }
}

export { app, auth, db, firebaseConfig };
