import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { invoiceItems, invoiceTotals, money, CURRENCIES } from '../utils/invoices';

const isoIn = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

export function blankInvoiceForm(profile = {}, clientId = '') {
  return {
    client_id: clientId,
    project_id: '',
    items: [{ description: '', quantity: 1, unit_price: '' }],
    vat_rate: profile.vat_rate ?? '0',
    vat_label: profile.vat_label || 'VAT',
    currency: profile.currency || 'GBP',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: isoIn(Number(profile.payment_terms_days ?? 14)),
    notes: '',
    payment_link: '',
    bill_to: { name: '', contact: '', email: '', address: '', vat_number: '' },
  };
}

export function invoiceToForm(inv) {
  return {
    client_id: inv.client_id || '',
    project_id: inv.project_id || '',
    items: invoiceItems(inv).map((i) => ({ ...i, unit_price: String(i.unit_price) })),
    vat_rate: inv.vat_rate ?? '0',
    vat_label: inv.vat_label || 'VAT',
    currency: inv.currency || 'GBP',
    issue_date: inv.issue_date || String(inv.created_at || '').slice(0, 10),
    due_date: inv.due_date || '',
    notes: inv.notes || '',
    payment_link: inv.payment_link || '',
    bill_to: { name: inv.client_name || '', contact: '', email: '', address: '', vat_number: '', ...(inv.bill_to || {}) },
  };
}

// Create or edit an invoice: client, line items, VAT, dates and where to pay.
export default function InvoiceEditor({ open, onClose, onSave, initial, clients, projects, invoices = [], title, saveLabel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (open) { setForm(initial); setError(''); setShowMore(Boolean(initial?.payment_link || initial?.notes)); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => invoiceTotals(form || {}), [form]);
  if (!form) return null;
  const clientProjects = projects.filter((p) => p.client_id === form.client_id);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBill = (key) => (e) => setForm((f) => ({ ...f, bill_to: { ...f.bill_to, [key]: e.target.value } }));
  const setItem = (i, key) => (e) => setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [key]: e.target.value } : it)) }));

  function chooseClient(clientId) {
    const client = clients.find((c) => c.id === clientId);
    // Reuse the billing address from this client's last invoice, if there is one.
    const last = invoices.find((i) => i.client_id === clientId && i.bill_to);
    setForm((f) => ({
      ...f,
      client_id: clientId,
      project_id: '',
      bill_to: {
        name: client?.name || '',
        contact: client?.contact || '',
        email: client?.email || '',
        address: last?.bill_to?.address || '',
        vat_number: last?.bill_to?.vat_number || '',
      },
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.client_id) { setError('Choose a client.'); return; }
    if (!totals.total) { setError('Add at least one line with a price.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <span className="spacer muted" style={{ fontSize: 13.5 }}>Total <b style={{ color: 'var(--ink)', fontSize: 15 }}>{money(totals.total, form.currency)}</b></span>
          <button className="btn bg" type="button" onClick={onClose}>Cancel</button>
          <button className="btn bp" type="submit" form="invoice-editor" disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
        </>
      }
    >
      <form id="invoice-editor" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <div className="fi-row">
          <div className="fc">
            <label className="fc-label" htmlFor="ie-client">Client</label>
            <select id="ie-client" className="fi fsel" value={form.client_id} onChange={(e) => chooseClient(e.target.value)} required>
              <option value="" disabled>Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="fc">
            <label className="fc-label" htmlFor="ie-project">Project</label>
            <select id="ie-project" className="fi fsel" value={form.project_id} onChange={set('project_id')}>
              <option value="">Not linked to a project</option>
              {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.service}</option>)}
            </select>
          </div>
        </div>

        <div className="fi-row">
          <div className="fc">
            <label className="fc-label" htmlFor="ie-address">Billing address</label>
            <textarea id="ie-address" className="fi" rows={2} value={form.bill_to.address} onChange={setBill('address')} placeholder={'Street, city\nCountry'} />
          </div>
          <div className="fc">
            <label className="fc-label" htmlFor="ie-cvat">Client’s VAT / tax number <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></label>
            <input id="ie-cvat" className="fi" value={form.bill_to.vat_number} onChange={setBill('vat_number')} />
          </div>
        </div>

        <div className="fc-label" style={{ marginBottom: 6 }}>Items</div>
        <div className="ie-items">
          <div className="ie-row ie-headrow" aria-hidden="true"><span>Description</span><span>Qty</span><span>Unit price</span><span className="r">Amount</span><span /></div>
          {form.items.map((item, i) => (
            <div key={i} className="ie-row">
              <input className="fi" aria-label={`Item ${i + 1} description`} value={item.description} onChange={setItem(i, 'description')} placeholder="Brand identity, final balance" />
              <input className="fi" aria-label={`Item ${i + 1} quantity`} inputMode="decimal" value={item.quantity} onChange={setItem(i, 'quantity')} />
              <input className="fi" aria-label={`Item ${i + 1} unit price`} inputMode="decimal" value={item.unit_price} onChange={setItem(i, 'unit_price')} placeholder="0.00" />
              <span className="r num ie-amount">{money((Number(item.quantity) || 0) * (Number(String(item.unit_price).replace(/[^0-9.-]/g, '')) || 0), form.currency)}</span>
              <button type="button" className="mc" aria-label={`Remove item ${i + 1}`} disabled={form.items.length === 1} onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}><Icon name="close" size={15} /></button>
            </div>
          ))}
          <button type="button" className="btn bq bsm" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: '' }] }))}><Icon name="plus" size={15} />Add a line</button>
        </div>

        <div className="ie-sum">
          <div className="fi-row three" style={{ flex: 1 }}>
            <div className="fc">
              <label className="fc-label" htmlFor="ie-cur">Currency</label>
              <select id="ie-cur" className="fi fsel" value={form.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div className="fc">
              <label className="fc-label" htmlFor="ie-vatlabel">Tax name</label>
              <input id="ie-vatlabel" className="fi" value={form.vat_label} onChange={set('vat_label')} />
            </div>
            <div className="fc">
              <label className="fc-label" htmlFor="ie-vat">Rate %</label>
              <input id="ie-vat" className="fi" inputMode="decimal" value={form.vat_rate} onChange={set('vat_rate')} />
            </div>
          </div>
          <dl className="ie-totals">
            <dt>Subtotal</dt><dd>{money(totals.subtotal, form.currency)}</dd>
            <dt>{form.vat_label || 'VAT'} ({totals.rate}%)</dt><dd>{money(totals.vat, form.currency)}</dd>
            <dt className="strong">Total</dt><dd className="strong">{money(totals.total, form.currency)}</dd>
          </dl>
        </div>

        <div className="fi-row">
          <div className="fc">
            <label className="fc-label" htmlFor="ie-issue">Issue date</label>
            <input id="ie-issue" className="fi" type="date" value={form.issue_date} onChange={set('issue_date')} />
          </div>
          <div className="fc">
            <label className="fc-label" htmlFor="ie-due">Due date</label>
            <input id="ie-due" className="fi" type="date" value={form.due_date} onChange={set('due_date')} />
          </div>
        </div>

        {!showMore ? (
          <button type="button" className="auth-link" style={{ fontSize: 13.5 }} onClick={() => setShowMore(true)}>Add a note or a different payment link</button>
        ) : (
          <>
            <div className="fc">
              <label className="fc-label" htmlFor="ie-notes">Note on this invoice <span className="faint" style={{ fontWeight: 400 }}>(replaces your usual note)</span></label>
              <textarea id="ie-notes" className="fi" rows={2} value={form.notes} onChange={set('notes')} />
            </div>
            <div className="fc" style={{ marginBottom: 0 }}>
              <label className="fc-label" htmlFor="ie-link">Payment link for this invoice <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></label>
              <input id="ie-link" className="fi" value={form.payment_link} onChange={set('payment_link')} placeholder="https://buy.stripe.com/…" />
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
