// Saves a public enquiry form submission and emails the studio about it.
//
// The submission is written to Firestore exactly as the browser would (without signing in, so the
// same security rules apply), and only after it's saved does the studio get an email. That way an
// email always matches a real enquiry in the studio's inbox.

const { FIRESTORE, readDoc, renderEmail, sendEmail, siteUrl, studioSettings } = require('./_notify');

const enc = (s) => ({ stringValue: String(s) });

function cleanData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data)
      .map(([k, v]) => [String(k).trim().slice(0, 80), String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, 5000)])
      .filter(([k, v]) => k && v)
      .slice(0, 80)
  );
}

function slug(label, index) {
  const base = String(label || `field_${index + 1}`).trim().toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || `field_${index + 1}`;
}

function pick(data, patterns, maxLength = 160) {
  for (const pattern of patterns) {
    const key = Object.keys(data).find((k) => pattern.test(k) && data[k].length <= maxLength && !(patterns.isName && /business|brand|company/.test(k)));
    if (key) return data[key];
  }
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const userId = String(req.body?.userId || '').trim();
  const data = cleanData(req.body?.data);
  if (!/^[A-Za-z0-9]{10,128}$/.test(userId)) return res.status(400).json({ error: 'This form link isn’t complete.' });
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Please complete the form before submitting.' });

  const submittedAt = new Date().toISOString();
  const saveRes = await fetch(`${FIRESTORE}/form_submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        user_id: enc(userId),
        data: { mapValue: { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) } },
        submitted_at: enc(submittedAt),
      },
    }),
  });
  if (!saveRes.ok) {
    console.error('enquiry save failed', saveRes.status, (await saveRes.text().catch(() => '')).slice(0, 200));
    return res.status(saveRes.status === 403 ? 404 : 502).json({ error: saveRes.status === 403 ? 'This form isn’t available.' : 'Couldn’t send your enquiry. Please try again.' });
  }
  const saved = await saveRes.json();
  const id = saved.name?.split('/').pop();

  // Email the studio (best effort; the enquiry is already safely in their inbox).
  try {
    const settings = await studioSettings(req, userId);
    if (settings?.email && settings.enquiry_emails !== false) {
      const config = (await readDoc(`form_configs/${userId}`)) || {};
      const labels = new Map((config.fields || []).map((f, i) => [slug(f.label, i), f.label]));
      const nameKeys = [/^(your_)?(full_)?name$/, /^(your_)?(first_)?name/, /(^|_)name$/];
      nameKeys.isName = true;
      const name = pick(data, nameKeys);
      const business = pick(data, [/(business|brand|company)_name/, /^(your_)?(business|brand|company)$/]);
      const email = pick(data, [/e_?mail/]);
      const rows = Object.entries(data).map(([k, v]) => [labels.get(k) || k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), v]);
      const who = name || business || 'Someone new';
      const { html, text } = renderEmail({
        eyebrow: 'New enquiry',
        headline: `${who}${business && name ? ` from ${business}` : ''} sent an enquiry`,
        lines: ['Here’s what they told you. Reply to this email to answer them directly.'],
        rows,
        button: { label: 'Open in Vela', href: `${siteUrl(req)}/forms` },
        footer: 'You’re getting this because someone sent your Vela enquiry form. Turn these emails off in Settings.',
      });
      await sendEmail({ to: settings.email, subject: `New enquiry from ${who}`, html, text, replyTo: email });
    }
  } catch (error) {
    console.error('enquiry email failed', error?.message);
  }
  return res.status(200).json({ id, submitted_at: submittedAt });
};
