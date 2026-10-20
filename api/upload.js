// Lets the studio upload files straight from the browser to Vercel Blob (private store).
//
// The browser asks this route for a short-lived presigned upload URL. Only studio accounts get
// one: the caller's Firebase sign-in token is used to read their own profile from Firestore (the
// security rules only allow that for the real owner of the token), and client accounts are
// turned away. Each studio may only upload under its own folder, studio/<uid>/.
//
// Works with the store connected to the Vercel project: either OIDC (BLOB_STORE_ID, which Vercel
// adds when a store is connected) or a classic BLOB_READ_WRITE_TOKEN.

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vela-crm-2ca57';
const MAX_BYTES = 500 * 1024 * 1024;

function uidFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    return String(payload.user_id || payload.sub || '');
  } catch {
    return '';
  }
}

async function assertStudio(token) {
  const uid = uidFromToken(token);
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Sign in again to upload files.');
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Only the studio can upload files.');
  const doc = await res.json();
  if (doc?.fields?.role?.stringValue === 'client') throw new Error('Only the studio can upload files.');
  return uid;
}

function storeConfigured() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

// Credentials for Blob calls: OIDC from the request when the store uses it, else the env token.
function blobAuth(req) {
  const oidcToken = req.headers['x-vercel-oidc-token'];
  if (process.env.BLOB_STORE_ID && oidcToken) return { oidcToken: String(oidcToken), storeId: process.env.BLOB_STORE_ID };
  return {};
}

function safePath(pathname, uid) {
  const value = String(pathname || '');
  return value.startsWith(`studio/${uid}/`) && !value.includes('..') && /^[A-Za-z0-9._\-/]{1,400}$/.test(value);
}

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ configured: storeConfigured() });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!storeConfigured()) {
    return res.status(503).json({ error: 'File storage isn’t set up yet.' });
  }

  try {
    const { handleUploadPresigned } = await import('@vercel/blob/client');
    const { issueSignedToken } = await import('@vercel/blob');
    const result = await handleUploadPresigned({
      body: req.body,
      request: req,
      getSignedToken: async (pathname, clientPayload) => {
        let token = '';
        try { token = JSON.parse(clientPayload || '{}').token || ''; } catch { token = ''; }
        const uid = await assertStudio(token);
        if (!safePath(pathname, uid)) throw new Error('That upload location isn’t allowed.');
        const signed = await issueSignedToken({
          ...blobAuth(req),
          pathname,
          operations: ['put'],
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 30 * 60 * 1000,
        });
        return { token: signed, urlOptions: { maximumSizeInBytes: MAX_BYTES } };
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('upload error', error?.message);
    return res.status(400).json({ error: error.message || 'Upload failed.' });
  }
}

module.exports = handler;
module.exports.assertStudio = assertStudio;
module.exports.uidFromToken = uidFromToken;
module.exports.safePath = safePath;
module.exports.blobAuth = blobAuth;
module.exports.storeConfigured = storeConfigured;
