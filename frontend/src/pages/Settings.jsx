import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import InvoiceDocument from '../components/InvoiceDocument';
import { paymentsAPI, studioProfileAPI } from '../utils/api';
import { CURRENCIES, DEFAULT_STUDIO_PROFILE, formatInvoiceNumber, resizeLogo } from '../utils/invoices';
import { CUSTOM, DEFAULT_BRAND, FONT_GROUPS, FONT_OPTIONS, fontStack, isHex, loadBrandFonts, readFontFile } from '../utils/brand';

const SAMPLE = {
  number: '',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
  client_name: 'Your client',
  bill_to: { name: 'Your client', contact: 'Client contact', address: 'Their address', email: 'client@example.com' },
  items: [
    { description: 'Brand identity, 50% deposit', quantity: 1, unit_price: 2000 },
    { description: 'Packaging design, per SKU', quantity: 2, unit_price: 250 },
  ],
  status: 'unpaid',
};

function ColorField({ id, label, value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <div>
      <label className="fc-label" htmlFor={id}>{label}</label>
      <div className="color-field">
        <input type="color" aria-label={`${label} picker`} value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input
          id={id}
          className="fi"
          value={draft}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setDraft(v);
            if (isHex(v)) onChange(v.toUpperCase());
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
    </div>
  );
}

function FontField({ role, label, form, setForm, setError }) {
  const fileRef = useRef(null);
  const key = `${role}_font`;
  const value = form[key] || '';
  async function pick(file) {
    if (!file) return;
    setError('');
    try {
      const { data, name } = await readFontFile(file);
      setForm((f) => ({ ...f, [key]: CUSTOM, [`${key}_data`]: data, [`${key}_name`]: name }));
    } catch (err) {
      setError(err.message);
    }
  }
  const customReady = value === CUSTOM && form[`${key}_data`];
  return (
    <div className="font-pick">
      <label className="fc-label" htmlFor={`st-${role}-font`}>{label}</label>
      <select
        id={`st-${role}-font`}
        className="fi fsel"
        value={value}
        onChange={(e) => {
          if (e.target.value === CUSTOM && !form[`${key}_data`]) { fileRef.current?.click(); return; }
          setForm((f) => ({ ...f, [key]: e.target.value }));
        }}
      >
        <option value="">Vela default ({role === 'heading' ? 'STIX Two' : 'Helvetica Neue'})</option>
        {FONT_GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {FONT_OPTIONS.filter((f) => f.group === g).map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
          </optgroup>
        ))}
        <option value={CUSTOM}>{form[`${key}_name`] ? `Your font: ${form[`${key}_name`]}` : 'Upload your own font…'}</option>
      </select>
      <div className={`font-sample${role === 'body' ? ' body' : ''}`} style={{ fontFamily: fontStack(form, role) }}>
        {role === 'heading' ? 'Brand Identity Proposal' : 'Thank you for trusting the studio with your brand. Here’s what we’ll create together.'}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="auth-link" style={{ fontSize: 13 }} onClick={() => fileRef.current?.click()}>{customReady ? 'Replace font file' : 'Upload your own font'}</button>
        <span className="faint" style={{ fontSize: 12.5 }}>TTF works everywhere, including PDFs. OTF and WOFF show on screen only.</span>
      </div>
      <input ref={fileRef} type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div className="fc">
      <label className="fc-label" htmlFor={id}>{label}{hint && <span className="faint" style={{ fontWeight: 400 }}> {hint}</span>}</label>
      {children}
    </div>
  );
}

// Business details and invoice settings: logo, address, VAT, bank details and online payments.
export default function Settings() {
  const [form, setForm] = useState({ ...DEFAULT_STUDIO_PROFILE, ...DEFAULT_BRAND });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [stripe, setStripe] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    studioProfileAPI.get(undefined, { fresh: true }).then((p) => setForm({ ...DEFAULT_STUDIO_PROFILE, ...DEFAULT_BRAND, ...p })).catch((err) => setError(err.message)).finally(() => setLoaded(true));
    paymentsAPI.status().then((s) => setStripe(Boolean(s.stripe)));
  }, []);

  const set = (key) => (e) => { setSaved(false); setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })); };

  async function pickLogo(file) {
    if (!file) return;
    setError('');
    try {
      const logo = await resizeLogo(file);
      setSaved(false);
      setForm((f) => ({ ...f, logo }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await studioProfileAPI.save(form);
      setForm({ ...DEFAULT_STUDIO_PROFILE, ...DEFAULT_BRAND, ...updated });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { loadBrandFonts(form); }, [form.heading_font, form.body_font, form.heading_font_data, form.body_font_data]); // eslint-disable-line react-hooks/exhaustive-deps
  const setBrand = (patch) => { setSaved(false); setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) })); };

  const preview = { ...SAMPLE, number: formatInvoiceNumber(form.invoice_prefix, form.next_invoice_number), vat_rate: form.vat_rate, vat_label: form.vat_label, currency: form.currency };

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Settings</h1>
        <div className="tb-r">
          {saved && <span className="muted" style={{ fontSize: 13.5 }}><Icon name="check" size={15} /> Saved</span>}
          <button className="btn bp" type="submit" form="settings-form" disabled={saving || !loaded}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          <div className="settings-split">
            <form id="settings-form" onSubmit={save}>
              <section className="panel settings-sec" aria-labelledby="s-brand">
                <h2 id="s-brand" className="card-title">Brand</h2>
                <p className="muted settings-lede">Your logo, colours and fonts on every invoice, proposal and contract your clients see.</p>
                <div className="logo-row">
                  <div className="logo-box">{form.logo ? <img src={form.logo} alt="Your logo" /> : <span className="faint">No logo yet</span>}</div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn bg bsm" onClick={() => fileRef.current?.click()}><Icon name="plus" size={15} />{form.logo ? 'Replace logo' : 'Upload logo'}</button>
                      {form.logo && <button type="button" className="btn bq bsm" onClick={() => { setSaved(false); setForm((f) => ({ ...f, logo: '' })); }}>Remove</button>}
                    </div>
                    <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>PNG with a transparent background works best.</div>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
                  </div>
                </div>
                <div className="color-row">
                  <ColorField id="st-primary" label="Main colour" value={form.brand_primary} onChange={(v) => setBrand({ brand_primary: v })} />
                  <ColorField id="st-accent" label="Accent colour" value={form.brand_accent} onChange={(v) => setBrand({ brand_accent: v })} />
                </div>
                <p className="faint" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 16 }}>The main colour is used for titles and totals, the accent for small labels and details. Dark main colours read best.</p>
                <FontField role="heading" label="Heading font" form={form} setForm={setBrand} setError={setError} />
                <FontField role="body" label="Body font" form={form} setForm={setBrand} setError={setError} />
              </section>

              <section className="panel settings-sec" aria-labelledby="s-biz">
                <h2 id="s-biz" className="card-title">Business details</h2>
                <p className="muted settings-lede">Shown on your invoices and in the client portal.</p>
                <Field id="st-legal" label="Your full name" hint="(as it appears on contracts)"><input id="st-legal" className="fi" value={form.legal_name || ''} onChange={set('legal_name')} placeholder="Your legal name" /></Field>
                <Field id="st-name" label="Business name"><input id="st-name" className="fi" value={form.business_name} onChange={set('business_name')} placeholder="Creative Mayaa Studio" /></Field>
                <Field id="st-address" label="Address"><textarea id="st-address" className="fi" rows={3} value={form.address} onChange={set('address')} placeholder={'Street\nCity, postcode\nCountry'} /></Field>
                <div className="fi-row">
                  <Field id="st-email" label="Email"><input id="st-email" className="fi" type="email" value={form.email} onChange={set('email')} /></Field>
                  <Field id="st-phone" label="Phone"><input id="st-phone" className="fi" value={form.phone} onChange={set('phone')} /></Field>
                </div>
                <div className="fi-row">
                  <Field id="st-web" label="Website"><input id="st-web" className="fi" value={form.website} onChange={set('website')} placeholder="yourstudio.com" /></Field>
                  <Field id="st-co" label="Company number" hint="(optional)"><input id="st-co" className="fi" value={form.company_number} onChange={set('company_number')} /></Field>
                </div>
                <Field id="st-vatno" label="VAT / tax registration number" hint="(leave blank if not registered)"><input id="st-vatno" className="fi" value={form.vat_number} onChange={set('vat_number')} placeholder="GB 123 4567 89" /></Field>
              </section>

              <section className="panel settings-sec" aria-labelledby="s-inv">
                <h2 id="s-inv" className="card-title">Invoices</h2>
                <p className="muted settings-lede">Defaults for new invoices. You can change them on each invoice.</p>
                <div className="fi-row three">
                  <Field id="st-cur" label="Currency">
                    <select id="st-cur" className="fi fsel" value={form.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                  </Field>
                  <Field id="st-vatlabel" label="Tax name"><input id="st-vatlabel" className="fi" value={form.vat_label} onChange={set('vat_label')} placeholder="VAT" /></Field>
                  <Field id="st-vatrate" label="Rate %"><input id="st-vatrate" className="fi" inputMode="decimal" value={form.vat_rate} onChange={set('vat_rate')} placeholder="20" /></Field>
                </div>
                <p className="faint" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 14 }}>For example 20% VAT in the UK, 15% in Saudi Arabia, 5% in the UAE. Use 0 if you don’t charge it.</p>
                <div className="fi-row three">
                  <Field id="st-prefix" label="Number prefix"><input id="st-prefix" className="fi" value={form.invoice_prefix} onChange={set('invoice_prefix')} placeholder="INV-" /></Field>
                  <Field id="st-next" label="Next number"><input id="st-next" className="fi" inputMode="numeric" value={form.next_invoice_number} onChange={set('next_invoice_number')} /></Field>
                  <Field id="st-terms" label="Due after (days)"><input id="st-terms" className="fi" inputMode="numeric" value={form.payment_terms_days} onChange={set('payment_terms_days')} /></Field>
                </div>
                <Field id="st-bank" label="Bank details" hint="(for bank transfers)"><textarea id="st-bank" className="fi" rows={3} value={form.bank_details} onChange={set('bank_details')} placeholder={'Account name\nIBAN or sort code and account number\nBank'} /></Field>
                <Field id="st-notes" label="Note on every invoice" hint="(optional)"><textarea id="st-notes" className="fi" rows={2} value={form.invoice_notes} onChange={set('invoice_notes')} placeholder="Thank you for your business." /></Field>
              </section>

              <section className="panel settings-sec" aria-labelledby="s-ct">
                <h2 id="s-ct" className="card-title">Contract template</h2>
                <p className="muted settings-lede">The sections every new contract starts with. Your name, address, email and phone above fill in the Parties section.</p>
                <p style={{ marginBottom: 16 }}><Link className="btn bg bsm" to="/contracts/template"><Icon name="edit" size={15} />Edit contract template</Link></p>
              </section>

              <section className="panel settings-sec" aria-labelledby="s-pay">
                <h2 id="s-pay" className="card-title">Online payments</h2>
                <p className="muted settings-lede">Clients see a Pay button on their invoices in the portal.</p>
                <label className={`toggle-row${stripe === false ? ' off' : ''}`}>
                  <input type="checkbox" checked={Boolean(form.card_payments)} onChange={set('card_payments')} disabled={stripe === false} />
                  <span>
                    <span className="row-title" style={{ display: 'block' }}>Card payments with Stripe</span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {stripe === false
                        ? 'Stripe isn’t connected yet. Once it is, clients pay the exact invoice amount and Vela marks it paid by itself.'
                        : 'Clients pay the exact invoice amount by card or Apple Pay, and Vela marks the invoice paid by itself.'}
                    </span>
                  </span>
                </label>
                <Field id="st-link" label="Payment link" hint="(optional)">
                  <input id="st-link" className="fi" value={form.payment_link} onChange={set('payment_link')} placeholder="https://buy.stripe.com/…" />
                </Field>
                <p className="faint" style={{ fontSize: 12.5, marginTop: -4 }}>
                  A Stripe payment link, PayPal.me or any other page where clients can pay. Used when card payments are off, and printed on the PDF. You can also set a different link on a single invoice.
                </p>
              </section>
            </form>

            <aside className="settings-preview" aria-label="Invoice preview">
              <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Preview</div>
              <InvoiceDocument invoice={preview} profile={form} />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
