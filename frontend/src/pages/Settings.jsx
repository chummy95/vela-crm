import React, { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import InvoiceDocument from '../components/InvoiceDocument';
import { paymentsAPI, studioProfileAPI } from '../utils/api';
import { CURRENCIES, DEFAULT_STUDIO_PROFILE, formatInvoiceNumber, resizeLogo } from '../utils/invoices';

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
  const [form, setForm] = useState(DEFAULT_STUDIO_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [stripe, setStripe] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    studioProfileAPI.get().then((p) => setForm({ ...DEFAULT_STUDIO_PROFILE, ...p })).catch((err) => setError(err.message)).finally(() => setLoaded(true));
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
      setForm({ ...DEFAULT_STUDIO_PROFILE, ...updated });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

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
              <section className="panel settings-sec" aria-labelledby="s-biz">
                <h2 id="s-biz" className="card-title">Business details</h2>
                <p className="muted settings-lede">Shown on your invoices and in the client portal.</p>
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
