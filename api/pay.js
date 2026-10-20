// Card payments for invoices through the studio's Stripe account.
//
// POST { action: 'checkout', invoiceId }  -> a Stripe Checkout page for the exact invoice total.
// POST { action: 'status', invoiceIds, sessionId? } -> which of those invoices Stripe says are paid.
//
// Every call carries the user's Firebase sign-in token, and the invoice is read from Firestore
// *as that user*, so the security rules decide who can pay or check it (the studio, or that
// client). Amounts always come from the stored invoice, never from the browser.
// Needs STRIPE_SECRET_KEY in Vercel (a restricted key with Checkout Sessions: write and
// PaymentIntents: read is enough).

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vela-crm-2ca57';
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

function value(fields, name) {
  const v = fields?.[name];
  if (!v) return '';
  return v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? '';
}

async function readDoc(path, token) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const doc = await res.json();
  return doc.fields || {};
}

function minorUnits(amount, currency) {
  const n = Number(String(amount).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return ZERO_DECIMAL.has(currency) ? Math.round(n) : Math.round(n * 100);
}

async function stripe(path, { method = 'GET', form } = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Stripe error');
    err.status = res.status;
    throw err;
  }
  return data;
}

function siteOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? `https://${host}` : 'https://vela-crm.vercel.app';
}

async function checkout(req, res, token) {
  const invoiceId = String(req.body?.invoiceId || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(invoiceId)) return res.status(400).json({ error: 'Missing invoice.' });
  const inv = await readDoc(`invoices/${invoiceId}`, token);
  if (!inv) return res.status(403).json({ error: 'Not allowed.' });
  if (value(inv, 'status') === 'paid') return res.status(409).json({ error: 'This invoice is already paid.' });

  const studioId = value(inv, 'user_id');
  const profile = (await readDoc(`studio_profiles/${studioId}`, token)) || {};
  if (value(profile, 'card_payments') !== true) return res.status(403).json({ error: 'Card payments aren’t switched on for this studio.' });

  const currency = String(value(inv, 'currency') || 'GBP').toLowerCase();
  const unitAmount = minorUnits(value(inv, 'amount'), currency);
  if (!unitAmount) return res.status(400).json({ error: 'This invoice has no amount to pay.' });

  const number = value(inv, 'number');
  const business = value(profile, 'business_name');
  const billEmail = value(inv.bill_to?.mapValue?.fields, 'email');
  const origin = siteOrigin(req);
  const form = {
    mode: 'payment',
    client_reference_id: invoiceId,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][unit_amount]': String(unitAmount),
    'line_items[0][price_data][product_data][name]': [number ? `Invoice ${number}` : 'Invoice', business].filter(Boolean).join(', '),
    'metadata[vela_invoice]': invoiceId,
    'payment_intent_data[metadata][vela_invoice]': invoiceId,
    'payment_intent_data[description]': [number ? `Invoice ${number}` : 'Invoice', value(inv, 'client_name')].filter(Boolean).join(' for '),
    success_url: `${origin}/portal/invoices/${invoiceId}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/portal/invoices/${invoiceId}`,
  };
  if (number) form['payment_intent_data[metadata][vela_number]'] = number;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billEmail)) form.customer_email = billEmail;

  const session = await stripe('checkout/sessions', { method: 'POST', form });
  return res.status(200).json({ url: session.url });
}

async function status(req, res, token) {
  const ids = (Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds : []).map(String).filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 50);
  if (!ids.length) return res.status(400).json({ error: 'Missing invoices.' });

  // Only invoices this user may see, with the total each must cover.
  const expected = {};
  await Promise.all(ids.map(async (id) => {
    const inv = await readDoc(`invoices/${id}`, token);
    if (!inv) return;
    const currency = String(value(inv, 'currency') || 'GBP').toLowerCase();
    expected[id] = { currency, amount: minorUnits(value(inv, 'amount'), currency) };
  }));

  const paid = {};
  const record = (id, pi) => {
    const want = expected[id];
    if (!want || paid[id]) return;
    if (pi.status !== 'succeeded' || pi.currency !== want.currency || Number(pi.amount_received) < want.amount) return;
    paid[id] = { paid_at: new Date(Number(pi.created) * 1000).toISOString(), payment_ref: pi.id };
  };

  // Straight back from Checkout: the session is the quickest proof.
  const sessionId = String(req.body?.sessionId || '');
  if (/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
    try {
      const session = await stripe(`checkout/sessions/${sessionId}?expand[]=payment_intent`);
      const id = session.metadata?.vela_invoice;
      if (id && session.payment_status === 'paid' && session.payment_intent) record(id, session.payment_intent);
    } catch {
      // Fall back to search below.
    }
  }

  // Stripe search can't mix AND with OR, so search by invoice in groups of ten and check status here.
  const pending = Object.keys(expected).filter((id) => !paid[id]);
  for (let i = 0; i < pending.length; i += 10) {
    const group = pending.slice(i, i + 10);
    const query = group.map((id) => `metadata['vela_invoice']:'${id}'`).join(' OR ');
    const result = await stripe(`payment_intents/search?limit=100&query=${encodeURIComponent(query)}`);
    (result.data || []).forEach((pi) => record(pi.metadata?.vela_invoice, pi));
  }
  return res.status(200).json({ paid });
}

module.exports = async function handler(req, res) {
  const configured = Boolean(process.env.STRIPE_SECRET_KEY);
  if (req.method === 'GET') return res.status(200).json({ stripe: configured });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!configured) return res.status(503).json({ error: 'Card payments aren’t set up yet.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Sign in again.' });
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.body?.action === 'checkout') return await checkout(req, res, token);
    if (req.body?.action === 'status') return await status(req, res, token);
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    console.error('pay error', error?.status, error?.message);
    return res.status(502).json({ error: error.status === 401 ? 'The Stripe key isn’t valid.' : 'Stripe couldn’t be reached. Try again in a moment.' });
  }
};

module.exports.minorUnits = minorUnits;
