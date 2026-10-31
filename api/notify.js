// Sends Vela's update emails. The browser calls this right after something happens, with the
// caller's Firebase sign-in token and the record's id. Nothing in the request is trusted: the
// record is read back from Firestore *as the caller* (so security rules decide whether they may
// see it), the event must have really just happened, and the recipient is looked up here.
//
// Client did something → the studio is emailed (its address from notify settings):
//   questionnaire_submitted, review_activity, contract_signed, client_message
// Studio shared something → the client is emailed (their portal email):
//   questionnaire_sent, review_shared, contract_sent, invoice_sent, studio_message

const {
  bearer, fresh, readDoc, renderEmail, sendEmail, signedInUser, siteUrl, studioSettings, throttled,
} = require('./_notify');

const EVENTS = {
  questionnaire_submitted: { collection: 'questionnaire_responses', to: 'studio' },
  review_activity: { collection: 'reviews', to: 'studio' },
  contract_signed: { collection: 'contracts', to: 'studio' },
  client_message: { collection: 'messages', to: 'studio' },
  questionnaire_sent: { collection: 'questionnaire_responses', to: 'client' },
  review_shared: { collection: 'reviews', to: 'client' },
  contract_sent: { collection: 'contracts', to: 'client' },
  invoice_sent: { collection: 'invoices', to: 'client' },
  studio_message: { collection: 'messages', to: 'client' },
};

const lower = (s) => String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1);

function money(amount, currency) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(n);
  } catch {
    return `${currency || ''} ${n.toFixed(2)}`.trim();
  }
}

function longDate(value) {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Email to the studio about something a client did.
function studioEmail(event, doc, base) {
  const client = doc.client_name || 'A client';
  const contact = doc.contact_name || doc.client_contact || client;
  if (event === 'contract_signed') {
    const who = doc.client_signature?.name || contact;
    return {
      ok: doc.signed === true && fresh(doc.signed_at),
      subject: `${who} signed your contract`,
      eyebrow: 'Contract signed',
      headline: `${who} signed the ${lower(doc.service) || 'project'} contract`,
      lines: [`${client} has accepted and signed. A signed copy is saved in Vela.`],
      button: { label: 'Open the contract', href: `${base}/contracts/${doc.id}` },
    };
  }
  if (event === 'questionnaire_submitted') {
    return {
      ok: doc.status === 'submitted' && fresh(doc.submitted_at),
      subject: `${contact} submitted “${doc.title || 'your questionnaire'}”`,
      eyebrow: 'Questionnaire',
      headline: `${contact} filled in their questionnaire`,
      lines: [`${doc.title || 'Questionnaire'} for ${client}${doc.project_service ? `, ${doc.project_service}` : ''}.`],
      button: { label: 'Read the answers', href: `${base}/questionnaires/responses/${doc.id}` },
    };
  }
  if (event === 'review_activity') {
    const title = doc.title || 'your work';
    const decided = doc.decided_at && doc.decided_at === doc.client_activity_at;
    const approved = decided && doc.status === 'approved';
    const changes = decided && doc.status === 'changes_requested';
    return {
      ok: fresh(doc.client_activity_at),
      subject: approved ? `${contact} approved “${title}”` : changes ? `${contact} asked for changes to “${title}”` : `New comment from ${contact} on “${title}”`,
      eyebrow: approved ? 'Approved' : changes ? 'Changes requested' : 'New comment',
      headline: approved ? `${contact} approved ${lower(title)}` : changes ? `${contact} asked for changes to ${lower(title)}` : `${contact} left a comment on ${lower(title)}`,
      lines: [doc.decision_note && decided ? `“${doc.decision_note}”` : '', `${client}${doc.project_service ? `, ${doc.project_service}` : ''}.`],
      button: { label: 'Open in Vela', href: `${base}/reviews/${doc.id}` },
    };
  }
  if (event === 'client_message') {
    return {
      ok: doc.sender_role === 'client' && fresh(doc.sent_at, 10),
      throttle: `msg_studio_${doc.client_id}`,
      subject: `New message from ${client}`,
      eyebrow: 'Message',
      headline: `${client} sent you a message`,
      lines: [`“${String(doc.text || '').slice(0, 600)}”`],
      button: { label: 'Reply in Vela', href: `${base}/messages` },
    };
  }
  return { ok: false };
}

// Email to a client about something the studio shared. `studio` is the studio's name.
function clientEmail(event, doc, base, studio) {
  if (event === 'contract_sent') {
    return {
      ok: !doc.signed && fresh(doc.emailed_at),
      subject: `Your contract from ${studio} is ready to sign`,
      eyebrow: 'Contract',
      headline: `Your ${lower(doc.service) || 'project'} contract is ready`,
      lines: [`${studio} has shared your contract. Read it through and sign online when you’re ready.`],
      button: { label: 'Review and sign', href: `${base}/portal/contracts/${doc.id}` },
    };
  }
  if (event === 'invoice_sent') {
    return {
      ok: doc.status !== 'paid' && fresh(doc.emailed_at),
      subject: `Invoice ${doc.number || ''} from ${studio}`.replace(/\s+/g, ' '),
      eyebrow: 'Invoice',
      headline: `${money(doc.amount, doc.currency)} due${doc.due_date ? ` by ${longDate(doc.due_date)}` : ''}`,
      lines: [`${studio} sent you invoice ${doc.number || ''}${doc.description ? ` for ${lower(doc.description)}` : ''}.`],
      button: { label: 'View and pay', href: `${base}/portal/invoices/${doc.id}` },
    };
  }
  if (event === 'review_shared') {
    const delivery = doc.kind === 'delivery';
    return {
      ok: fresh(doc.sent_at),
      subject: delivery ? `Your final files from ${studio}` : `${studio} shared “${doc.title || 'new work'}” for your review`,
      eyebrow: delivery ? 'Final files' : 'Ready for review',
      headline: delivery ? 'Your final files are ready' : `${doc.title || 'New work'} is ready for you`,
      lines: [doc.note ? `“${String(doc.note).slice(0, 600)}”` : '', delivery ? 'Download everything from your portal.' : 'Take a look, leave comments, then approve or ask for changes.'],
      button: { label: delivery ? 'Get your files' : 'Review the work', href: `${base}/portal/reviews/${doc.id}` },
    };
  }
  if (event === 'questionnaire_sent') {
    return {
      ok: doc.status === 'sent' && fresh(doc.sent_at),
      subject: `${studio} sent you “${doc.title || 'a questionnaire'}”`,
      eyebrow: 'Questionnaire',
      headline: `A few questions from ${studio}`,
      lines: [doc.description ? String(doc.description).slice(0, 600) : '', 'Your answers save as you go, so you can come back to it.'],
      button: { label: 'Start the questionnaire', href: `${base}/portal/questionnaires/${doc.id}` },
    };
  }
  if (event === 'studio_message') {
    return {
      ok: doc.sender_role === 'studio' && fresh(doc.sent_at, 10),
      throttle: `msg_client_${doc.client_id}`,
      subject: `New message from ${studio}`,
      eyebrow: 'Message',
      headline: `${studio} sent you a message`,
      lines: [`“${String(doc.text || '').slice(0, 600)}”`],
      button: { label: 'Reply in your portal', href: `${base}/portal/messages` },
    };
  }
  return { ok: false };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const event = String(req.body?.event || '');
  const id = String(req.body?.id || '').trim();
  const spec = EVENTS[event];
  const token = bearer(req);
  if (!spec || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || !token) {
    return res.status(400).json({ error: 'Missing event, record or sign-in.' });
  }
  try {
    const doc = await readDoc(`${spec.collection}/${id}`, token);
    if (!doc) return res.status(403).json({ error: 'Not allowed.' });
    const base = siteUrl(req);
    const settings = await studioSettings(req, doc.user_id);

    if (spec.to === 'studio') {
      const mail = studioEmail(event, doc, base);
      if (!mail.ok) return res.status(200).json({ sent: false, reason: 'Nothing new to report.' });
      if (!settings?.email || settings.studio_emails === false) return res.status(200).json({ sent: false, reason: 'The studio has these emails turned off.' });
      if (mail.throttle && await throttled(req, mail.throttle, 20)) return res.status(200).json({ sent: false, reason: 'Already emailed recently.' });
      const client = doc.client_id ? await readDoc(`clients/${doc.client_id}`, token) : null;
      const { html, text } = renderEmail({ ...mail, footer: 'You’re getting this because a client did something in your Vela portal. Turn these emails off in Settings.' });
      const result = await sendEmail({ to: settings.email, subject: mail.subject, html, text, replyTo: client?.portal_email || client?.email });
      return res.status(200).json(result);
    }

    // Studio → client: only the studio that owns the record may trigger it.
    const caller = await signedInUser(token);
    if (!caller || caller.uid !== doc.user_id) return res.status(403).json({ error: 'Not allowed.' });
    if (settings && settings.client_emails === false) return res.status(200).json({ sent: false, reason: 'Client emails are turned off in Settings.' });
    const client = doc.client_id ? await readDoc(`clients/${doc.client_id}`, token) : null;
    if (!client?.portal_user_id || !client.portal_email) return res.status(200).json({ sent: false, reason: 'This client doesn’t have portal access yet. Give them access on their client page first.' });
    const profile = (await readDoc(`studio_profiles/${doc.user_id}`, token)) || {};
    const studio = profile.business_name || caller.profile?.studio_name || settings?.name || 'Your designer';
    const mail = clientEmail(event, doc, base, studio);
    if (!mail.ok) return res.status(200).json({ sent: false, reason: 'Nothing new to send.' });
    if (mail.throttle && await throttled(req, mail.throttle, 20)) return res.status(200).json({ sent: false, reason: 'Already emailed recently.' });
    const { html, text } = renderEmail({
      ...mail,
      brand: { name: studio, primary: profile.brand_primary, accent: profile.brand_accent },
      footer: `${studio} uses Vela to manage your project. Reply to this email to reach them directly.`,
    });
    const result = await sendEmail({
      to: client.portal_email,
      subject: mail.subject,
      html,
      text,
      fromName: studio,
      replyTo: profile.email || settings?.email || caller.email,
    });
    return res.status(200).json({ ...result, to: result.sent ? client.portal_email : undefined });
  } catch (error) {
    console.error('notify error', event, error?.message);
    return res.status(500).json({ sent: false, error: 'Couldn’t send the email.' });
  }
};
