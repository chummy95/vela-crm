// The Owner page's data: every studio on Vela, when it joined, when it was last around, and how
// many clients and projects it has (each studio's app reports its own counts once a session).
// Only Vela's owner can read it.

const { bearer, isOwner, listStudios, signedInUser } = require('./_notify');
const { storeConfigured } = require('./upload');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  const caller = await signedInUser(bearer(req)).catch(() => null);
  if (!caller) return res.status(401).json({ error: 'Sign in again.' });
  if (!isOwner(caller)) return res.status(403).json({ error: 'This page is only for Vela’s owner.' });
  if (!storeConfigured()) return res.status(503).json({ error: 'Storage isn’t set up.' });
  try {
    const studios = (await listStudios(req))
      .map((s) => ({
        uid: s.uid,
        name: s.name || '',
        studio: s.studio || '',
        email: s.email || '',
        created_at: s.created_at || '',
        last_seen: s.last_seen || '',
        clients: Number.isFinite(s.clients) ? s.clients : null,
        projects: Number.isFinite(s.projects) ? s.projects : null,
        owner: s.uid === caller.uid,
      }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return res.status(200).json({ studios });
  } catch (error) {
    console.error('owner error', error?.message);
    return res.status(500).json({ error: 'Couldn’t load the studios.' });
  }
};
