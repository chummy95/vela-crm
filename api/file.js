// Gives short-lived links to private files attached to shared work.
//
// Files live in a private Vercel Blob store, so they can't be opened from their stored URL.
// The browser sends the review id and its Firebase sign-in token; this route reads the review
// from Firestore *as that user*, so the security rules decide whether they may see it (the
// studio that owns it, or that client). Only files listed on that review get a link, and each
// link works for one hour.

const { blobAuth, storeConfigured } = require('./upload');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vela-crm-2ca57';
const LINK_MINUTES = 60;

function filesFromDoc(doc) {
  const values = doc?.fields?.files?.arrayValue?.values || [];
  return values.map((v) => {
    const f = v?.mapValue?.fields || {};
    return { url: f.url?.stringValue || '', pathname: f.pathname?.stringValue || '' };
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const reviewId = String(req.body?.reviewId || '').trim();
  const wanted = Array.isArray(req.body?.urls) ? req.body.urls.map(String).slice(0, 50) : [];
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(reviewId) || !token || !wanted.length) {
    return res.status(400).json({ error: 'Missing file or sign-in.' });
  }
  if (!storeConfigured()) {
    return res.status(503).json({ error: 'File storage isn’t set up yet.' });
  }

  const docRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/reviews/${reviewId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!docRes.ok) return res.status(403).json({ error: 'Not allowed.' });
  const files = filesFromDoc(await docRes.json());

  try {
    const { issueSignedToken, presignUrl } = await import('@vercel/blob');
    const validUntil = Date.now() + LINK_MINUTES * 60 * 1000;
    const links = {};
    for (const url of wanted) {
      const file = files.find((f) => f.url === url && f.pathname);
      if (!file) continue;
      const signed = await issueSignedToken({ ...blobAuth(req), pathname: file.pathname, operations: ['get'], validUntil });
      const { presignedUrl } = await presignUrl(signed, { operation: 'get', pathname: file.pathname, access: 'private' });
      links[url] = presignedUrl;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ links, validUntil });
  } catch (error) {
    console.error('file link error', error?.message);
    return res.status(500).json({ error: 'Couldn’t open that file right now.' });
  }
};

module.exports.filesFromDoc = filesFromDoc;
