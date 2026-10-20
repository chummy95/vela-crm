// Invoice maths and helpers shared by the studio, the client portal and the PDF.

export const CURRENCIES = ['GBP', 'SAR', 'AED', 'USD', 'EUR'];

export function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Line items, falling back to the single description/amount older invoices have.
export function invoiceItems(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items.filter((i) => i && (i.description || toNumber(i.unit_price))) : [];
  if (items.length) return items.map((i) => ({ description: String(i.description || ''), quantity: toNumber(i.quantity) || 1, unit_price: toNumber(i.unit_price) }));
  if (invoice?.subtotal !== undefined && invoice?.subtotal !== '') {
    return [{ description: invoice.description || 'Services', quantity: 1, unit_price: toNumber(invoice.subtotal) }];
  }
  return [{ description: invoice?.description || 'Services', quantity: 1, unit_price: toNumber(invoice?.amount) }];
}

export function invoiceTotals(invoice) {
  const items = invoiceItems(invoice);
  const subtotal = round2(items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0));
  const rate = toNumber(invoice?.vat_rate);
  const vat = round2((subtotal * rate) / 100);
  return { items, subtotal, rate, vat, total: round2(subtotal + vat) };
}

export function money(value, currency = 'GBP') {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(value));
  } catch {
    return `${currency} ${toNumber(value).toFixed(2)}`;
  }
}

export function formatInvoiceNumber(prefix, n) {
  return `${prefix ?? 'INV-'}${String(Math.max(1, Number(n) || 1)).padStart(4, '0')}`;
}

export function invoiceTitle(invoice) {
  return invoice?.number ? `Invoice ${invoice.number}` : 'Invoice';
}

export const DEFAULT_STUDIO_PROFILE = {
  business_name: '',
  logo: '',
  address: '',
  email: '',
  phone: '',
  website: '',
  company_number: '',
  vat_number: '',
  currency: 'GBP',
  vat_rate: '0',
  vat_label: 'VAT',
  invoice_prefix: 'INV-',
  next_invoice_number: 1,
  payment_terms_days: 14,
  bank_details: '',
  invoice_notes: '',
  payment_link: '',
  card_payments: false,
};

// Turn an uploaded image into a small PNG data URL for the logo (kept in the database, used in PDFs).
export function resizeLogo(file, maxW = 600, maxH = 240) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(file.type)) { reject(new Error('Use a PNG, JPG, SVG or WebP image.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Couldn’t read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Couldn’t read that image.'));
      img.onload = () => {
        const w = img.naturalWidth || maxW;
        const h = img.naturalHeight || maxH;
        const scale = Math.min(1, maxW / w, maxH / h);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/png');
        if (url.length > 280000) { reject(new Error('That logo is too detailed. Try a smaller PNG.')); return; }
        resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
