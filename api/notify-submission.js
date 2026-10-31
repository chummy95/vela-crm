// Emails the studio when a client submits a questionnaire, approves or asks for changes
// to shared work, or leaves a comment on it.
//
// Called by the client portal right after a submission, with the client's Firebase sign-in token.
// It reads the questionnaire back from Firestore *as that client*, so the security rules decide
// whether the caller really owns it, and only emails if it was genuinely submitted in the last
// few minutes. Needs two environment variables in Vercel: RESEND_API_KEY and NOTIFY_EMAIL.

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vela-crm-2ca57';
const FRESH_MINUTES = 15;

function field(doc, name) {
  const value = doc?.fields?.[name];
  if (!value) return '';
  return value.stringValue ?? value.integerValue ?? value.booleanValue ?? '';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = async function handler(req, res) {
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL);

  if (req.method === 'GET') {
    return res.status(200).json({ configured });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isReview = Boolean(req.body?.reviewId);
  const isContract = Boolean(req.body?.contractId);
  const recordId = String((isContract ? req.body?.contractId : isReview ? req.body?.reviewId : req.body?.responseId) || '').trim();
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(recordId) || !token) {
    return res.status(400).json({ error: 'Missing record or sign-in.' });
  }
  if (!configured) {
    return res.status(200).json({ sent: false, reason: 'Email notifications are not set up.' });
  }

  const collection = isContract ? 'contracts' : isReview ? 'reviews' : 'questionnaire_responses';
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${recordId}`;
  const docRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!docRes.ok) {
    return res.status(403).json({ error: 'Not allowed.' });
  }
  const doc = await docRes.json();

  const client = field(doc, 'client_name') || 'A client';
  const contact = field(doc, 'contact_name') || client;
  const title = field(doc, 'title') || (isContract ? `${field(doc, 'service') || 'Project'} contract` : isReview ? 'their work' : 'questionnaire');
  const project = field(doc, 'project_service');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'vela-studio.net';

  let when;
  let headline;
  let subject;
  let link;
  if (isContract) {
    if (field(doc, 'signed') !== true) {
      return res.status(200).json({ sent: false, reason: 'Nothing new to report.' });
    }
    const signer = doc?.fields?.client_signature?.mapValue?.fields;
    const who = field({ fields: signer }, 'name') || contact;
    when = Date.parse(field(doc, 'signed_at'));
    headline = `${who} signed the ${field(doc, 'service') || 'project'} contract`;
    subject = `${who} signed your contract`;
    link = `https://${host}/contracts/${recordId}`;
  } else if (isReview) {
    when = Date.parse(field(doc, 'client_activity_at'));
    const status = field(doc, 'status');
    const decided = field(doc, 'decided_at') && field(doc, 'decided_at') === field(doc, 'client_activity_at');
    if (decided && status === 'approved') {
      headline = `${contact} approved ${title.toLowerCase()}`;
      subject = `${contact} approved “${title}”`;
    } else if (decided && status === 'changes_requested') {
      headline = `${contact} asked for changes to ${title.toLowerCase()}`;
      subject = `${contact} asked for changes to “${title}”`;
    } else {
      headline = `${contact} left a comment on ${title.toLowerCase()}`;
      subject = `New comment from ${contact} on “${title}”`;
    }
    link = `https://${host}/reviews/${recordId}`;
  } else {
    if (field(doc, 'status') !== 'submitted') {
      return res.status(200).json({ sent: false, reason: 'Nothing new to report.' });
    }
    when = Date.parse(field(doc, 'submitted_at'));
    headline = `${contact} filled in their questionnaire`;
    subject = `${contact} submitted “${title}”`;
    link = `https://${host}/questionnaires/responses/${recordId}`;
  }
  if (!when || Date.now() - when > FRESH_MINUTES * 60 * 1000) {
    return res.status(200).json({ sent: false, reason: 'Nothing new to report.' });
  }

  const detail = `${title} for ${client}${project ? `, ${project}` : ''}.`;
  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#1B2B4B;max-width:520px;line-height:1.5">
      <p style="font-size:13px;color:#A9822F;margin:0 0 6px">Vela</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${escapeHtml(headline)}</h1>
      <p style="margin:0 0 18px;color:#56647E">${escapeHtml(detail)}</p>
      <p style="margin:0 0 24px"><a href="${link}" style="background:#21409A;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Open in Vela</a></p>
      <p style="font-size:12px;color:#8892A6;margin:0">You’re getting this because a client did something in your Vela portal.</p>
    </div>`;

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'Vela <onboarding@resend.dev>',
      to: [process.env.NOTIFY_EMAIL],
      subject,
      html,
      text: `${headline}. ${detail}\n\nOpen in Vela: ${link}`,
    }),
  });

  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '');
    console.error('Resend error', sendRes.status, detail.slice(0, 300));
    return res.status(502).json({ sent: false, error: 'The email service rejected the message.' });
  }
  return res.status(200).json({ sent: true });
};
