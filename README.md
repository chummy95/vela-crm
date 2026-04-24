# Vela CRM

Vela is now a Firebase-backed CRM for creative studios. The active runtime is the React frontend plus Firebase Auth and Cloud Firestore.

## Active Architecture
- Frontend: React 18, React Router, Vite
- Data/auth backend: Firebase Authentication + Cloud Firestore
- Legacy folder: `backend/` is kept only as a reference and is no longer required for the app to run

## What Was Converted
- Login and registration now use Firebase Email/Password auth
- All CRM data now reads and writes directly to Firestore
- Intake forms now have both:
  - an internal builder page at `/forms`
  - a public submission page at `/intake/:userId`
- Firestore security rules now enforce record ownership for studio data

## Firebase Files In This Repo
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
- `.firebaserc`
- `frontend/.env.example`

## Firebase Console Setup
Use Firebase project `vela-crm-20260420`.

### 1. Add a Web App
In Firebase console:
1. Open Project Settings
2. Add a Web app
3. Copy the config values into `frontend/.env.local`

Example:
```bash
VITE_FIREBASE_API_KEY=AIzaSyDP-_qJDifpCQ8bsfTv2pbXcmIIgTDLO1Y
VITE_FIREBASE_AUTH_DOMAIN=vela-crm-20260420.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=vela-crm-20260420
VITE_FIREBASE_STORAGE_BUCKET=vela-crm-20260420.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=121081847097
VITE_FIREBASE_APP_ID=1:121081847097:web:d4dfe93c22d04635075ce8
```

### 2. Enable Authentication
Turn on:
- Email/Password

### 3. Create Firestore
Create a Cloud Firestore database for the project.

### 4. Publish Firestore Rules
After installing the Firebase CLI and logging in:
```bash
firebase deploy --only firestore:rules
```

## Run Locally
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Public Intake Forms
Once a user is logged in, the Forms page shows a shareable public URL:

```text
/intake/<firebase-user-id>
```

Client submissions from that page are written straight into Firestore and appear back in the signed-in studio dashboard.

## Notes
- The app no longer depends on the Express API for runtime data access.
- Do not deploy the old `backend/` to Vercel as the production backend.
