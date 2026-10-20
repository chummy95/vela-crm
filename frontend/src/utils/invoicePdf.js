// Builds the invoice as a real PDF (selectable text, A4) and downloads it.
import { invoiceTotals, money } from './invoices';
import { formatDate } from './format';

const INK = [27, 43, 75];
const MUTED = [86, 100, 126];
const LINE = [230, 224, 213];
const BRASS = [169, 130, 47];
const OK = [47, 115, 80];
const longDate = { day: 'numeric', month: 'long', year: 'numeric' };
const lines = (value) => String(value || '').split('\n').map((x) => x.trim()).filter(Boolean);

function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function invoiceFileName(invoice, profile = {}) {
  const who = String(invoice.client_name || 'client').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const studio = String(profile.business_name || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${[studio, invoice.number || 'Invoice', who].filter(Boolean).join('_')}.pdf`;
}

export async function buildInvoicePdf(invoice, profile = {}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 18;
  const right = W - M;
  const currency = invoice.currency || profile.currency || 'GBP';
  const label = invoice.vat_label || profile.vat_label || 'VAT';
  const { items, subtotal, rate, vat, total } = invoiceTotals(invoice);
  const paid = invoice.status === 'paid';
  const billTo = invoice.bill_to || { name: invoice.client_name };

  pdf.setProperties({ title: `${invoice.number ? `Invoice ${invoice.number}` : 'Invoice'}${profile.business_name ? `, ${profile.business_name}` : ''}`, creator: 'Vela' });
  const text = (value, x, y, opts = {}) => {
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    pdf.setFontSize(opts.size || 9.5);
    pdf.setTextColor(...(opts.color || INK));
    pdf.text(String(value), x, y, { align: opts.align || 'left', maxWidth: opts.maxWidth });
  };

  // Header: logo (or name) on the left, title and dates on the right.
  let y = 20;
  if (profile.logo) {
    const size = await imageSize(profile.logo);
    if (size) {
      const maxW = 60;
      const maxH = 22;
      const scale = Math.min(maxW / size.w, maxH / size.h);
      pdf.addImage(profile.logo, 'PNG', M, y - 4, size.w * scale, size.h * scale);
    }
  } else {
    text(profile.business_name || 'Invoice', M, y + 6, { size: 16, bold: true });
  }
  text('INVOICE', right, y + 2, { size: 20, bold: true, align: 'right' });
  const meta = [
    invoice.number ? ['Number', invoice.number] : null,
    ['Issued', formatDate(invoice.issue_date || invoice.created_at, longDate) || '—'],
    paid ? ['Paid', formatDate(invoice.paid_at, longDate) || 'Yes'] : ['Due', formatDate(invoice.due_date, longDate) || 'On receipt'],
  ].filter(Boolean);
  let my = y + 10;
  meta.forEach(([k, v]) => {
    text(k, right - 42, my, { color: MUTED, align: 'right' });
    text(v, right, my, { bold: true, align: 'right' });
    my += 5;
  });

  // From / Bill to
  y = Math.max(my, 44) + 8;
  pdf.setDrawColor(...LINE);
  pdf.line(M, y - 4, right, y - 4);
  const col2 = 112;
  text('FROM', M, y + 2, { size: 7.5, bold: true, color: BRASS });
  text('BILL TO', col2, y + 2, { size: 7.5, bold: true, color: BRASS });
  const fromLines = [
    ...lines(profile.address), profile.email, profile.phone, profile.website,
    profile.company_number ? `Company no. ${profile.company_number}` : '',
    profile.vat_number ? `${label} no. ${profile.vat_number}` : '',
  ].filter(Boolean);
  const toLines = [billTo.contact, ...lines(billTo.address), billTo.email, billTo.vat_number ? `${label} no. ${billTo.vat_number}` : ''].filter(Boolean);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  const wrapAll = (arr, width) => arr.flatMap((l) => pdf.splitTextToSize(String(l), width));
  const fromWrapped = wrapAll(fromLines, 85);
  const toWrapped = wrapAll(toLines, 78);
  text(profile.business_name || '—', M, y + 8, { bold: true, size: 10.5 });
  text(billTo.name || invoice.client_name || '—', col2, y + 8, { bold: true, size: 10.5 });
  fromWrapped.forEach((l, i) => text(l, M, y + 13.5 + i * 4.6, { color: MUTED }));
  toWrapped.forEach((l, i) => text(l, col2, y + 13.5 + i * 4.6, { color: MUTED }));
  y += 16 + Math.max(fromWrapped.length, toWrapped.length) * 4.6 + 6;

  // Items table
  const cQty = 128;
  const cUnit = 158;
  pdf.setFillColor(249, 247, 244);
  pdf.rect(M, y - 5, right - M, 8, 'F');
  text('Description', M + 2, y, { size: 8.5, bold: true, color: MUTED });
  text('Qty', cQty, y, { size: 8.5, bold: true, color: MUTED, align: 'right' });
  text('Unit price', cUnit, y, { size: 8.5, bold: true, color: MUTED, align: 'right' });
  text('Amount', right - 2, y, { size: 8.5, bold: true, color: MUTED, align: 'right' });
  y += 9;
  items.forEach((item) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    const wrapped = pdf.splitTextToSize(item.description || '—', cQty - M - 18);
    if (y + wrapped.length * 4.6 > 250) { pdf.addPage(); y = 24; }
    pdf.setTextColor(...INK);
    pdf.text(wrapped, M + 2, y);
    text(String(item.quantity), cQty, y, { align: 'right' });
    text(money(item.unit_price, currency), cUnit, y, { align: 'right' });
    text(money(item.quantity * item.unit_price, currency), right - 2, y, { align: 'right' });
    y += wrapped.length * 4.6 + 3;
    pdf.setDrawColor(...LINE);
    pdf.line(M, y - 2, right, y - 2);
    y += 3;
  });

  // Totals
  y += 2;
  const tl = 128;
  text('Subtotal', tl, y, { color: MUTED });
  text(money(subtotal, currency), right - 2, y, { align: 'right' });
  y += 6;
  text(`${label} (${rate}%)`, tl, y, { color: MUTED });
  text(money(vat, currency), right - 2, y, { align: 'right' });
  y += 4;
  pdf.setDrawColor(...INK);
  pdf.line(tl, y, right, y);
  y += 7;
  text(paid ? 'Total paid' : 'Total due', tl, y, { bold: true, size: 11 });
  text(money(total, currency), right - 2, y, { bold: true, size: 13, align: 'right' });
  if (paid) {
    pdf.setDrawColor(...OK);
    pdf.setLineWidth(0.6);
    pdf.roundedRect(M, y - 9, 30, 11, 2, 2);
    text('PAID', M + 15, y - 1.5, { bold: true, size: 13, color: OK, align: 'center' });
    pdf.setLineWidth(0.2);
  }

  // Payment details and notes
  y += 14;
  const bank = lines(profile.bank_details);
  const notes = invoice.notes || profile.invoice_notes;
  const link = invoice.payment_link || profile.payment_link;
  if (y > 240) { pdf.addPage(); y = 24; }
  if (bank.length || (!paid && link)) {
    text('PAYMENT', M, y, { size: 7.5, bold: true, color: BRASS });
    y += 5.5;
    bank.forEach((l) => { text(l, M, y, { color: MUTED }); y += 4.6; });
    if (bank.length && invoice.number) { text(`Reference: ${invoice.number}`, M, y, { color: MUTED }); y += 4.6; }
    if (!paid && link) {
      y += 1.5;
      text('Pay online: ', M, y, { color: MUTED });
      pdf.setTextColor(33, 64, 154);
      pdf.textWithLink(link.replace(/^https?:\/\//, ''), M + pdf.getTextWidth('Pay online: '), y, { url: link });
      y += 4.6;
    }
    y += 4;
  }
  if (notes) {
    text('NOTES', M, y, { size: 7.5, bold: true, color: BRASS });
    y += 5.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...MUTED);
    pdf.text(pdf.splitTextToSize(notes, right - M), M, y);
  }

  // Footer
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    pdf.setPage(p);
    pdf.setDrawColor(...LINE);
    pdf.line(M, 284, right, 284);
    text([profile.business_name, profile.website, profile.email].filter(Boolean).join('  ·  '), M, 289, { size: 7.5, color: MUTED });
    if (pages > 1) text(`${p} / ${pages}`, right, 289, { size: 7.5, color: MUTED, align: 'right' });
  }
  return pdf;
}

export async function downloadInvoicePdf(invoice, profile) {
  const pdf = await buildInvoicePdf(invoice, profile);
  pdf.save(invoiceFileName(invoice, profile));
}
