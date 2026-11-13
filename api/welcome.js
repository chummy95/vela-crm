// Runs once when a studio creates its Vela account: sends them the welcome email (from Mayaa,
// replies go to her) and tells Vela's owner about the new sign-up. The browser calls this right
// after registering; the server checks the account is new and only ever sends once per studio.

const {
  OWNER_EMAILS, OWNER_REPLY_TO, bearer, firstTime, fresh, listStudios, recordStudio, renderEmail, sendEmail, signedInUser, siteUrl,
} = require('./_notify');

function riyadhTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Asia/Riyadh', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }) + ' (Riyadh)';
  } catch {
    return iso;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const caller = await signedInUser(bearer(req)).catch(() => null);
  if (!caller || caller.profile?.role !== 'studio') return res.status(401).json({ error: 'Sign in again.' });
  if (!fresh(caller.profile?.created_at, 60)) return res.status(200).json({ sent: false, reason: 'Not a new account.' });

  try {
    if (!(await firstTime(req, `welcome_${caller.uid}`))) return res.status(200).json({ sent: false, reason: 'Already welcomed.' });
    await recordStudio(req, caller, { last_seen: new Date().toISOString() });

    const base = siteUrl(req);
    const first = String(caller.profile?.name || '').trim().split(/\s+/)[0] || 'there';

    // 1. Welcome email to the new studio.
    const welcome = renderEmail({
      preheader: 'Your studio is ready. Here’s how to make it yours in 10 minutes.',
      headline: 'Welcome to Vela',
      lines: [
        `Hi ${first},`,
        'I’m so glad you’re here. I built Vela because I needed one calm place to run my own studio, from the first enquiry to the final handover. Now it’s yours too.',
        'Three steps to get set up:',
      ],
      steps: [
        ['Add your brand', 'Upload your logo, colours and fonts in Settings. Vela puts them on every contract, invoice, form and email your clients see.'],
        ['Share your enquiry form', 'Build your own form under Enquiries, then add the link to your website or Instagram bio. New enquiries land straight in your inbox.'],
        ['Invite your first client', 'Add a client and give them portal access. They can sign contracts, pay invoices, fill in questionnaires and approve your work in one place.'],
      ],
      button: { label: 'Open your studio', href: `${base}/` },
      after: ['If you have a question or an idea, just reply to this email. It comes straight to me.'],
      signoff: ['With love,', 'Mayaa', 'Founder, Vela'],
      footer: 'You’re receiving this because you created a studio account at vela-studio.net.',
    });
    const welcomeResult = await sendEmail({
      to: caller.email,
      subject: `Welcome to Vela, ${first} ✦`,
      html: welcome.html,
      text: welcome.text,
      fromLabel: 'Mayaa from Vela',
      replyTo: OWNER_REPLY_TO,
    });

    // 2. Tell the owner (skip when the owner signs up a test account with her own address).
    const studios = await listStudios(req).catch(() => []);
    const signedUp = caller.profile?.created_at || new Date().toISOString();
    const alert = renderEmail({
      eyebrow: 'New sign-up ✦',
      headline: `${caller.profile?.name || 'Someone'} just created a studio on Vela`,
      rows: [
        ['Studio', caller.profile?.studio_name || '—'],
        ['Email', caller.email || '—'],
        ['Signed up', riyadhTime(signedUp)],
        ['Studios on Vela so far', String(studios.length || 1)],
      ],
      button: { label: 'Open the owner page', href: `${base}/owner` },
      footer: 'You’re getting this because you own Vela.',
    });
    for (const owner of OWNER_EMAILS) {
      if (owner === String(caller.email).toLowerCase()) continue;
      await sendEmail({
        to: owner,
        subject: `New studio on Vela: ${caller.profile?.studio_name || caller.profile?.name || caller.email}`,
        html: alert.html,
        text: alert.text,
        replyTo: caller.email,
      });
    }
    return res.status(200).json({ sent: welcomeResult.sent });
  } catch (error) {
    console.error('welcome error', error?.message);
    return res.status(500).json({ sent: false, error: 'Couldn’t send the welcome email.' });
  }
};
