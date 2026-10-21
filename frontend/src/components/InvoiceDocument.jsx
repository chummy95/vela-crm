import React from 'react';
import { invoiceTotals, money } from '../utils/invoices';
import { formatDate } from '../utils/format';
import { brandVars, useBrandFonts } from '../utils/brand';

const longDate = { day: 'numeric', month: 'long', year: 'numeric' };
const lines = (value) => String(value || '').split('\n').map((x) => x.trim()).filter(Boolean);

// The invoice as the client sees it, with the studio's logo and details. Matches the PDF.
export default function InvoiceDocument({ invoice, profile = {} }) {
  const currency = invoice.currency || profile.currency || 'GBP';
  const { items, subtotal, rate, vat, total } = invoiceTotals(invoice);
  const label = invoice.vat_label || profile.vat_label || 'VAT';
  const billTo = invoice.bill_to || { name: invoice.client_name };
  const paid = invoice.status === 'paid';
  const notes = invoice.notes || profile.invoice_notes;
  useBrandFonts(profile);

  return (
    <article className="inv-doc" style={brandVars(profile)} aria-label={invoice.number ? `Invoice ${invoice.number}` : 'Invoice'}>
      {paid && <div className="inv-paid" aria-label="Paid">Paid</div>}
      <header className="inv-head">
        <div className="inv-brand">
          {profile.logo
            ? <img src={profile.logo} alt={profile.business_name || 'Studio logo'} />
            : <div className="inv-brand-name">{profile.business_name || 'Your studio'}</div>}
        </div>
        <div className="inv-meta">
          <div className="inv-title">Invoice</div>
          <dl>
            {invoice.number && <><dt>Number</dt><dd>{invoice.number}</dd></>}
            <dt>Issued</dt><dd>{formatDate(invoice.issue_date || invoice.created_at, longDate) || '—'}</dd>
            <dt>{paid ? 'Paid' : 'Due'}</dt><dd>{paid ? (formatDate(invoice.paid_at, longDate) || 'Yes') : (formatDate(invoice.due_date, longDate) || 'On receipt')}</dd>
          </dl>
        </div>
      </header>

      <div className="inv-parties">
        <div>
          <div className="inv-label">From</div>
          <div className="inv-strong">{profile.business_name || '—'}</div>
          {lines(profile.address).map((l) => <div key={l}>{l}</div>)}
          {profile.email && <div>{profile.email}</div>}
          {profile.phone && <div>{profile.phone}</div>}
          {profile.website && <div>{profile.website}</div>}
          {profile.company_number && <div>Company no. {profile.company_number}</div>}
          {profile.vat_number && <div>{label} no. {profile.vat_number}</div>}
        </div>
        <div>
          <div className="inv-label">Bill to</div>
          <div className="inv-strong">{billTo.name || invoice.client_name}</div>
          {billTo.contact && <div>{billTo.contact}</div>}
          {lines(billTo.address).map((l) => <div key={l}>{l}</div>)}
          {billTo.email && <div>{billTo.email}</div>}
          {billTo.vat_number && <div>{label} no. {billTo.vat_number}</div>}
        </div>
      </div>

      <table className="inv-items">
        <thead>
          <tr><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Amount</th></tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>{item.description || '—'}</td>
              <td className="r num">{item.quantity}</td>
              <td className="r num">{money(item.unit_price, currency)}</td>
              <td className="r num">{money(item.quantity * item.unit_price, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-totals">
        <div><span>Subtotal</span><span className="num">{money(subtotal, currency)}</span></div>
        <div><span>{label} ({rate}%)</span><span className="num">{money(vat, currency)}</span></div>
        <div className="inv-total"><span>Total {paid ? 'paid' : 'due'}</span><span className="num">{money(total, currency)}</span></div>
      </div>

      {(profile.bank_details || notes) && (
        <footer className="inv-foot">
          {profile.bank_details && (
            <div>
              <div className="inv-label">Bank transfer</div>
              {lines(profile.bank_details).map((l) => <div key={l}>{l}</div>)}
              {invoice.number && <div className="faint">Reference: {invoice.number}</div>}
            </div>
          )}
          {notes && (
            <div>
              <div className="inv-label">Notes</div>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{notes}</p>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
