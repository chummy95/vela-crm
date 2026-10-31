// A studio's email notification settings: where its emails go and which ones it wants.
// GET returns them (creating them from the sign-in email the first time); POST saves them.
// Only the signed-in studio can read or change its own settings.

const { DEFAULT_PREFS, bearer, isEmail, renderEmail, sendEmail, signedInUser, siteUrl, studioSettings, writeJson, emailConfigured } = require('./_notify');
const { storeConfigured } = require('./upload');

function clean(body, current, caller) {
  const email = String(body.email ?? current.email ?? caller.email ?? '').trim().toLowerCase();
  if (email && !isEmail(email)) throw new Error('Enter a valid email address.');
  const next = { email: email || caller.email, name: String(caller.profile?.studio_name || caller.profile?.name || current.name || '').slice(0, 120) };
  Object.keys(DEFAULT_PREFS).forEach((key) => { next[key] = body[key] !== undefined ? Boolean(body[key]) : current[key] ?? DEFAULT_PREFS[key]; });
  next.updated_at = new Date().toISOString();
  return next;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  const caller = await signedInUser(bearer(req)).catch(() => null);
  if (!caller || caller.profile?.role !== 'studio') return res.status(401).json({ error: 'Sign in again.' });
  if (!storeConfigured()) return res.status(503).json({ error: 'Notifications aren’t set up yet.' });

  try {
    const current = (await studioSettings(req, caller.uid)) || null;
    if (req.method === 'GET') {
      if (current) return res.status(200).json({ ...current, ready: emailConfigured() });
      const created = clean({}, {}, caller);
      await writeJson(req, `notify/studios/${caller.uid}.json`, created);
      return res.status(200).json({ ...created, ready: emailConfigured() });
    }

    const next = clean(req.body || {}, current || {}, caller);
    await writeJson(req, `notify/studios/${caller.uid}.json`, next);

    if (req.body?.test) {
      const { html, text } = renderEmail({
        eyebrow: 'Test email',
        headline: 'Your Vela emails are working',
        lines: ['This is where Vela will tell you when a client signs a contract, fills in a questionnaire, approves work, leaves a comment, messages you or sends an enquiry.'],
        button: { label: 'Open Vela', href: siteUrl(req) },
        footer: 'You asked for this test email in Vela Settings.',
      });
      const result = await sendEmail({ to: next.email, subject: 'Your Vela emails are working', html, text });
      return res.status(200).json({ ...next, ready: emailConfigured(), test: result });
    }
    return res.status(200).json({ ...next, ready: emailConfigured() });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Couldn’t save your email settings.' });
  }
};
