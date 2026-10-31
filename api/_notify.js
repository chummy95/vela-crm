// Shared helpers for Vela's email notifications (not a route: files starting with _ aren't served).
//
// Who gets what is kept in the private Blob store, not Firestore, so the server can look up a
// studio's notification address even when the person triggering the email (a client, or someone
// sending the public enquiry form) isn't allowed to read the studio's own records.
//   notify/studios/<uid>.json  { email, name, studio_emails, enquiry_emails, client_emails }
//   notify/sent/<key>.json     { at }   (stops repeats, e.g. one email per paid invoice)

const { blobAuth, storeConfigured } = require('./upload');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vela-crm-2ca57';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FROM = process.env.NOTIFY_FROM || 'Vela <onboarding@resend.dev>';
const DEFAULT_PREFS = { studio_emails: true, enquiry_emails: true, client_emails: true };

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// ── Firestore REST ──────────────────────────────────────────────
function decode(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

async function readDoc(path, token) {
  const res = await fetch(`${FIRESTORE}/${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return null;
  const json = await res.json();
  return { id: json.name?.split('/').pop(), ...decodeFields(json.fields) };
}

function bearer(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

// Who is calling. Firestore only returns users/<uid> to its owner with a valid sign-in token, so a
// successful read proves the token is genuine and names the user.
async function signedInUser(token) {
  if (!token) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const uid = String(payload.user_id || payload.sub || '');
  if (!/^[A-Za-z0-9]{10,128}$/.test(uid)) return null;
  const profile = await readDoc(`users/${uid}`, token);
  if (!profile) return null;
  return { uid, email: String(payload.email || profile.email || ''), profile };
}

// ── Private Blob store ──────────────────────────────────────────
async function readJson(req, pathname) {
  if (!storeConfigured()) return null;
  const { get } = await import('@vercel/blob');
  try {
    const result = await get(pathname, { access: 'private', useCache: false, ...blobAuth(req) });
    if (!result || result.statusCode !== 200) return null;
    return await new Response(result.stream).json();
  } catch {
    return null;
  }
}

async function writeJson(req, pathname, data) {
  if (!storeConfigured()) throw new Error('Storage isn’t set up.');
  const { put } = await import('@vercel/blob');
  await put(pathname, JSON.stringify(data), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...blobAuth(req),
  });
}

async function studioSettings(req, uid) {
  if (!/^[A-Za-z0-9]{10,128}$/.test(String(uid || ''))) return null;
  const saved = await readJson(req, `notify/studios/${uid}.json`);
  return saved ? { ...DEFAULT_PREFS, ...saved } : null;
}

// True the first time a key is seen; used so the same event never emails twice.
async function firstTime(req, key) {
  const path = `notify/sent/${String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)}.json`;
  if (await readJson(req, path)) return false;
  await writeJson(req, path, { at: new Date().toISOString() }).catch(() => {});
  return true;
}

// At most one email per key in the window (for chatty things like messages).
async function throttled(req, key, minutes) {
  const path = `notify/sent/${String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)}.json`;
  const last = await readJson(req, path);
  if (last?.at && Date.now() - Date.parse(last.at) < minutes * 60 * 1000) return true;
  await writeJson(req, path, { at: new Date().toISOString() }).catch(() => {});
  return false;
}

function fresh(stamp, minutes = 15) {
  const when = Date.parse(stamp || '');
  return Boolean(when) && Date.now() - when < minutes * 60 * 1000 && when - Date.now() < 5 * 60 * 1000;
}

// ── Email ───────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function siteUrl(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (/^([a-z0-9-]+\.)*vela-studio\.net$/i.test(host) || /^localhost(:\d+)?$/.test(host)) return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
  return 'https://vela-studio.net';
}

function isEmail(value) {
  return /^[^\s@<>",]+@[^\s@<>",]+\.[^\s@<>",]+$/.test(String(value || '')) && String(value).length < 200;
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

// One layout for every email. `brand` is the studio's look for emails to clients, Vela's otherwise.
function renderEmail({ brand = {}, eyebrow, headline, lines = [], rows = [], button, footer }) {
  const primary = safeColor(brand.primary, '#1B2B4B');
  const accent = safeColor(brand.accent, '#A9822F');
  const name = brand.name || 'Vela';
  const body = lines.filter(Boolean).map((l) => `<p style="margin:0 0 14px;color:#4A5468;font-size:15px;line-height:1.6">${escapeHtml(l)}</p>`).join('');
  const table = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 20px">${rows.map(([k, v]) => `
        <tr><td style="padding:10px 0;border-top:1px solid #ECE7DE;font-size:12.5px;color:#7A8296;vertical-align:top">${escapeHtml(k)}</td></tr>
        <tr><td style="padding:0 0 10px;font-size:14.5px;color:#1F2633;white-space:pre-wrap;line-height:1.5">${escapeHtml(v)}</td></tr>`).join('')}</table>`
    : '';
  const cta = button
    ? `<p style="margin:6px 0 26px"><a href="${escapeHtml(button.href)}" style="background:${primary};color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-size:14.5px;font-weight:600">${escapeHtml(button.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F6F3EE">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F3EE;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #ECE7DE">
      <tr><td style="background:${primary};height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>
      <tr><td style="padding:28px 30px 8px;font-family:Helvetica,Arial,sans-serif">
        <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:17px;color:${primary}">${escapeHtml(name)}</p>
        ${eyebrow ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${accent}">${escapeHtml(eyebrow)}</p>` : ''}
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:600;font-size:24px;line-height:1.25;color:#1F2633">${escapeHtml(headline)}</h1>
        ${body}${table}${cta}
      </td></tr>
      <tr><td style="padding:16px 30px 24px;border-top:1px solid #F0ECE5;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8A92A3">${escapeHtml(footer || 'Sent by Vela.')}</td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [headline, ...lines, ...rows.map(([k, v]) => `${k}: ${v}`), button ? `${button.label}: ${button.href}` : '', footer || ''].filter(Boolean).join('\n\n');
  return { html, text };
}

async function sendEmail({ to, subject, html, text, replyTo, fromName }) {
  if (!emailConfigured()) return { sent: false, reason: 'Email isn’t set up.' };
  if (!isEmail(to)) return { sent: false, reason: 'No email address to send to.' };
  const address = FROM.match(/<([^>]+)>/)?.[1] || FROM;
  const from = fromName ? `${String(fromName).replace(/[<>"\r\n]/g, '').slice(0, 60)} via Vela <${address}>` : FROM;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: String(subject).slice(0, 200), html, text, ...(isEmail(replyTo) ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Resend error', res.status, detail.slice(0, 300));
    return { sent: false, reason: 'The email service rejected the message.' };
  }
  return { sent: true };
}

module.exports = {
  DEFAULT_PREFS,
  FIRESTORE,
  bearer,
  decodeFields,
  emailConfigured,
  escapeHtml,
  firstTime,
  fresh,
  isEmail,
  readDoc,
  readJson,
  renderEmail,
  sendEmail,
  signedInUser,
  siteUrl,
  studioSettings,
  throttled,
  writeJson,
};
