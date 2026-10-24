// The contract as a PDF, with both signatures and the signature record, in the studio's brand.
import { clauseText } from '../components/Documents';
import { contractClauses, AGREEMENT_TEXT } from './contracts';
import { formatDate, formatMoney } from './format';
import { hexToRgb, pdfTextColor, registerPdfFonts } from './brand';

const MUTED = [86, 100, 126];
const LINE = [230, 224, 213];
const longDate = { day: 'numeric', month: 'long', year: 'numeric' };

function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function stamp(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

export function contractFileName(contract, profile = {}) {
  const clean = (v) => String(v || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${[clean(profile.business_name), clean(contract.service) || 'Contract', clean(contract.client_name), contract.signed ? 'signed' : ''].filter(Boolean).join('_')}.pdf`;
}

export async function buildContractPdf(contract, profile = {}, currency = 'GBP') {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const fonts = await registerPdfFonts(pdf, profile);
  const PRIMARY = hexToRgb(profile.brand_primary, [27, 43, 75]);
  const ACCENT = hexToRgb(profile.brand_accent, [169, 130, 47]);
  const TEXT = pdfTextColor(profile);
  const M = 22;
  const right = 210 - M;
  const width = right - M;
  const bottom = 272;
  const studioName = profile.business_name || 'the Studio';
  let y = 24;

  const setText = (opts = {}) => {
    pdf.setFont(opts.heading ? fonts.heading : fonts.body, opts.bold ? 'bold' : 'normal');
    pdf.setFontSize(opts.size || 10);
    pdf.setTextColor(...(opts.color || TEXT));
  };
  const ensure = (needed) => { if (y + needed > bottom) { pdf.addPage(); y = 24; } };
  const paragraph = (value, opts = {}) => {
    setText(opts);
    const lineH = (opts.size || 10) * 0.48;
    pdf.splitTextToSize(String(value), opts.width || width).forEach((line) => {
      ensure(lineH);
      pdf.text(line, opts.x || M, y);
      y += lineH;
    });
  };

  pdf.setProperties({ title: `${contract.service || 'Contract'}, ${contract.client_name || ''}`.trim(), creator: 'Vela' });

  if (profile.logo) {
    const size = await imageSize(profile.logo);
    if (size) {
      const scale = Math.min(50 / size.w, 18 / size.h);
      pdf.addImage(profile.logo, 'PNG', M, y - 6, size.w * scale, size.h * scale);
      y += size.h * scale + 6;
    }
  }
  paragraph(`Services agreement${contract.date ? `, ${formatDate(contract.date, longDate)}` : ''}`, { size: 9.5, color: ACCENT });
  y += 3;
  paragraph(contract.service || 'Contract', { size: 22, heading: true, bold: true, color: PRIMARY });
  y += 1;
  paragraph(`Between ${studioName} and ${contract.client_name || 'the Client'}${contract.client_address ? `, ${contract.client_address}` : ''}`, { size: 10, color: MUTED });
  const terms = [
    contract.start_date ? `Starting ${formatDate(contract.start_date, longDate)}` : '',
    contract.duration ? `for ${contract.duration}` : '',
  ].filter(Boolean).join(', ');
  if (terms || contract.value) {
    y += 2;
    paragraph(`${terms}${terms && contract.value ? '. ' : ''}${contract.value ? `Total value ${formatMoney(contract.value, currency)}.` : ''}`, { size: 10, color: MUTED });
  }
  y += 3;
  pdf.setDrawColor(...LINE);
  pdf.line(M, y, right, y);
  y += 9;

  contractClauses(contract).forEach((clause, i) => {
    ensure(16);
    paragraph(`${i + 1}. ${clause.title || ''}`, { size: 12, heading: true, bold: true, color: PRIMARY });
    y += 1.5;
    paragraph(clauseText(clause, contract, currency), { size: 10.5 });
    y += 6;
  });

  // Signatures
  ensure(52);
  y += 6;
  const colW = (width - 14) / 2;
  const blocks = [
    { x: M, party: `For ${studioName}`, sig: contract.studio_signature },
    { x: M + colW + 14, party: `For ${contract.client_name || 'the Client'}`, sig: contract.client_signature, note: contract.signed && !contract.client_signature ? 'Signed outside Vela' : '' },
  ];
  const sigTop = y;
  for (const b of blocks) {
    if (b.sig?.image) {
      const size = await imageSize(b.sig.image);
      if (size) {
        const scale = Math.min(colW / size.w, 22 / size.h);
        pdf.addImage(b.sig.image, 'PNG', b.x, sigTop, size.w * scale, size.h * scale);
      }
    }
    pdf.setDrawColor(...PRIMARY);
    pdf.line(b.x, sigTop + 24, b.x + colW, sigTop + 24);
    let by = sigTop + 29;
    if (b.sig) {
      setText({ size: 10, bold: true });
      pdf.text(`${b.sig.name}${b.sig.title ? `, ${b.sig.title}` : ''}`, b.x, by, { maxWidth: colW });
      by += 5;
    }
    setText({ size: 9, color: MUTED });
    pdf.text(b.party, b.x, by, { maxWidth: colW });
    by += 4.5;
    if (b.sig) pdf.text(stamp(b.sig.signed_at), b.x, by, { maxWidth: colW });
    else if (b.note) pdf.text(b.note, b.x, by, { maxWidth: colW });
  }
  y = sigTop + 44;

  // Signature record
  if (contract.client_signature) {
    const s = contract.client_signature;
    const lines = [
      `Signed electronically by ${s.name}${s.email ? ` (${s.email})` : ''}, who ${s.method === 'typed' ? 'typed' : 'drew'} their signature on ${stamp(s.signed_at)} after agreeing: "${s.agreement || AGREEMENT_TEXT}"`,
      contract.studio_signature ? `${contract.studio_signature.name} signed for ${studioName} on ${stamp(contract.studio_signature.signed_at)}.` : '',
      contract.signed_hash ? `Document fingerprint (SHA-256): ${contract.signed_hash}` : '',
    ].filter(Boolean);
    ensure(30);
    pdf.setFillColor(249, 247, 244);
    setText({ size: 8.5, color: MUTED });
    const wrapped = lines.flatMap((l) => pdf.splitTextToSize(l, width - 10));
    const boxH = wrapped.length * 4.2 + 8;
    pdf.rect(M, y - 2, width, boxH, 'F');
    wrapped.forEach((l, i) => pdf.text(l, M + 5, y + 4 + i * 4.2));
  }

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    pdf.setPage(p);
    setText({ size: 7.5, color: MUTED });
    pdf.text([studioName, contract.service, contract.client_name].filter(Boolean).join('  ·  '), M, 287);
    pdf.text(`${p} / ${pages}`, right, 287, { align: 'right' });
  }
  return pdf;
}

export async function downloadContractPdf(contract, profile, currency) {
  const pdf = await buildContractPdf(contract, profile, currency);
  pdf.save(contractFileName(contract, profile));
}
