// Issues short-lived upload tokens so the studio can upload files straight to Vercel Blob.
//
// Only studio accounts may upload: the caller's Firebase sign-in token is used to read their
// own profile from Firestore (the security rules only allow that for the real owner of the
// token), and client accounts are turned away. Needs BLOB_READ_WRITE_TOKEN, which Vercel adds
// automatically when a Blob store is connected to the project.

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

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'File storage isn’t set up yet.' });
  }

  try {
    const { handleUpload } = await import('@vercel/blob/client');
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let token = '';
        try { token = JSON.parse(clientPayload || '{}').token || ''; } catch { token = ''; }
        const uid = await assertStudio(token);
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_BYTES,
          tokenPayload: JSON.stringify({ uid }),
        };
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Upload failed.' });
  }
};

module.exports.assertStudio = assertStudio;
module.exports.uidFromToken = uidFromToken;
