// The contract as a PDF, with both signatures and the signature record, in the studio's brand.
import { contractClauses, AGREEMENT_TEXT } from './contracts';
import { fillClause, inlineRuns, parseClause, placeholderValues } from './contractTemplate';
import { hexToRgb, onColor, pdfTextColor, registerPdfFonts } from './brand';
import { coverTitle } from '../components/Documents';

const MUTED = [86, 100, 126];

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

  pdf.setProperties({ title: `${contract.service || 'Contract'}, ${contract.client_name || ''}`.trim(), creator: 'Vela' });

  // Cover page: the studio's main colour, light logo (or name), the title and both parties.
  const ON = hexToRgb(onColor(profile.brand_primary || '#1B2B4B'));
  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, 210, 297, 'F');
  if (profile.logo_light) {
    const size = await imageSize(profile.logo_light);
    if (size) {
      const scale = Math.min(55 / size.w, 26 / size.h);
      pdf.addImage(profile.logo_light, 'PNG', right - size.w * scale, 22, size.w * scale, size.h * scale, undefined, 'FAST');
    }
  } else {
    setText({ size: 18, heading: true, bold: true, color: ON });
    pdf.splitTextToSize(studioName, 70).forEach((line, i) => pdf.text(line, right, 32 + i * 8, { align: 'right' }));
  }
  setText({ size: 40, heading: true, color: ON });
  const titleLines = pdf.splitTextToSize(coverTitle(contract, profile).toUpperCase(), 140);
  const titleTop = 222 - titleLines.length * 16.5;
  titleLines.forEach((line, i) => pdf.text(line, M, titleTop + i * 16.5));
  const designer = profile.legal_name || profile.business_name || '';
  const person = contract.client_contact || contract.client_name || '';
  const cover = [
    { x: M, label: 'Created by:', lines: [designer && `Contractor : ${designer}`, profile.business_name && `Company : ${profile.business_name}`] },
    { x: 118, label: 'Created for:', lines: [person && `Client : ${person}`, contract.client_name && `Company : ${contract.client_name}`] },
  ];
  cover.forEach((col) => {
    setText({ size: 10, bold: true, color: ON });
    pdf.text(col.label, col.x, 252);
    setText({ size: 10, color: ON });
    col.lines.filter(Boolean).forEach((line, i) => pdf.text(line.toUpperCase(), col.x, 260 + i * 5.5, { maxWidth: 70 }));
  });

  pdf.addPage();
  y = 26;

  // Sections: title on the left, terms on the right (as in a printed contract).
  const values = placeholderValues(contract, profile, currency);
  const leftW = 46;
  const bodyX = M + leftW + 6;
  const bodyW = right - bodyX;
  const lineH = 4.9;

  // Writes one line of inline runs (bold and blanks) at x, wrapping words to width.
  const writeRuns = (text, x, w, opts = {}) => {
    const runs = inlineRuns(text).map((r) => ({ ...r, text: r.missing ? '__________' : r.text }));
    let cx = x;
    const newLine = () => { y += lineH; ensure(lineH); cx = x; };
    runs.forEach((run) => {
      setText({ size: opts.size || 10, bold: run.bold || opts.bold, heading: opts.heading, color: opts.color });
      run.text.split(/(\s+)/).forEach((word) => {
        if (!word) return;
        const wordW = pdf.getTextWidth(word);
        if (cx + wordW > x + w && cx > x && word.trim()) newLine();
        if (cx === x && !word.trim()) return;
        pdf.text(word, cx, y);
        cx += wordW;
      });
    });
    y += lineH;
  };

  contractClauses(contract).forEach((clause, i) => {
    ensure(18);
    const top = y;
    // Title, wrapped in the left column.
    setText({ size: 13, heading: true, bold: true, color: PRIMARY });
    const titleLines = pdf.splitTextToSize(`${i + 1}. ${clause.title || ''}`, leftW);
    titleLines.forEach((line, j) => pdf.text(line, M, top + j * 6));
    const titleBottom = top + titleLines.length * 6;

    parseClause(fillClause(clause.body, values)).forEach((block, bi) => {
      if (block.type === 'sub') {
        if (bi > 0) y += 2;
        ensure(lineH * 2);
        writeRuns(block.text, bodyX, bodyW, { bold: true, color: PRIMARY, heading: true });
      } else if (block.type === 'list') {
        block.items.forEach((item) => {
          ensure(lineH);
          setText({ size: 10 });
          pdf.text('•', bodyX, y);
          writeRuns(item, bodyX + 4, bodyW - 4);
        });
        y += 2;
      } else {
        block.lines.forEach((line) => { ensure(lineH); writeRuns(line, bodyX, bodyW); });
        y += 2.5;
      }
    });
    y = Math.max(y, titleBottom) + 6;
  });

  // Signatures
  ensure(52);
  y += 6;
  const colW = (width - 14) / 2;
  const blocks = [
    { x: M, party: 'Client’s signature', who: contract.client_name, sig: contract.client_signature, note: contract.signed && !contract.client_signature ? 'Signed outside Vela' : '' },
    { x: M + colW + 14, party: 'Designer’s signature', who: studioName, sig: contract.studio_signature },
  ];
  const sigTop = y;
  for (const b of blocks) {
    setText({ size: 10.5, bold: true, heading: true, color: PRIMARY });
    pdf.text(b.party, b.x, sigTop);
    if (b.sig?.image) {
      const size = await imageSize(b.sig.image);
      if (size) {
        const scale = Math.min(colW / size.w, 20 / size.h);
        pdf.addImage(b.sig.image, 'PNG', b.x, sigTop + 3, size.w * scale, size.h * scale, undefined, 'FAST');
      }
    }
    pdf.setDrawColor(...PRIMARY);
    pdf.line(b.x, sigTop + 25, b.x + colW, sigTop + 25);
    let by = sigTop + 30;
    if (b.sig) {
      setText({ size: 10, bold: true });
      pdf.text(`${b.sig.name}${b.sig.title ? `, ${b.sig.title}` : ''}`, b.x, by, { maxWidth: colW });
    } else if (b.who) {
      setText({ size: 10 });
      pdf.text(b.who, b.x, by, { maxWidth: colW });
    }
    by += 5;
    setText({ size: 9, color: MUTED });
    pdf.text(`Date: ${b.sig ? stamp(b.sig.signed_at) : b.note || ''}`, b.x, by, { maxWidth: colW });
  }
  y = sigTop + 42;

  // Signature record
  if (contract.client_signature) {
    const s = contract.client_signature;
    const lines = [
      `Signed electronically by ${s.name}${s.email ? ` (${s.email})` : ''}, who ${s.method === 'typed' ? 'typed' : 'drew'} their signature on ${stamp(s.signed_at)} after agreeing: "${s.agreement || AGREEMENT_TEXT}"`,
      contract.studio_signature ? `${contract.studio_signature.name} signed for ${studioName} on ${stamp(contract.studio_signature.signed_at)}.` : '',
      contract.signed_hash ? `Document fingerprint (SHA-256): ${contract.signed_hash}` : '',
    ].filter(Boolean);
    setText({ size: 8.5, color: MUTED });
    const wrapped = lines.flatMap((l) => pdf.splitTextToSize(l, width - 10));
    const boxH = wrapped.length * 4.2 + 8;
    if (y + boxH > 280) { pdf.addPage(); y = 24; }
    pdf.setFillColor(249, 247, 244);
    setText({ size: 8.5, color: MUTED });
    pdf.rect(M, y - 2, width, boxH, 'F');
    wrapped.forEach((l, i) => pdf.text(l, M + 5, y + 4 + i * 4.2));
  }

  // Footer on every page after the cover.
  const pages = pdf.getNumberOfPages();
  for (let p = 2; p <= pages; p += 1) {
    pdf.setPage(p);
    setText({ size: 7.5, color: MUTED });
    pdf.text(`${studioName} Project Contract`, M, 287);
    pdf.text(`${p - 1} / ${pages - 1}`, right, 287, { align: 'right' });
  }
  return pdf;
}

export async function downloadContractPdf(contract, profile, currency) {
  const pdf = await buildContractPdf(contract, profile, currency);
  pdf.save(contractFileName(contract, profile));
}
