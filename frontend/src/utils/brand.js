// A studio's brand kit: colours and fonts used on every document sent to clients
// (invoices, proposals, contracts) on screen and in PDFs.

import { useEffect } from 'react';

// Google Fonts that work on screen and can be embedded in PDFs. `id` is the Fontsource id.
export const FONT_OPTIONS = [
  { family: 'Playfair Display', id: 'playfair-display', group: 'Serif', weights: [400, 700] },
  { family: 'Cormorant Garamond', id: 'cormorant-garamond', group: 'Serif', weights: [400, 700] },
  { family: 'Bodoni Moda', id: 'bodoni-moda', group: 'Serif', weights: [400, 700] },
  { family: 'DM Serif Display', id: 'dm-serif-display', group: 'Serif', weights: [400] },
  { family: 'Fraunces', id: 'fraunces', group: 'Serif', weights: [400, 700] },
  { family: 'Libre Baskerville', id: 'libre-baskerville', group: 'Serif', weights: [400, 700] },
  { family: 'EB Garamond', id: 'eb-garamond', group: 'Serif', weights: [400, 700] },
  { family: 'Lora', id: 'lora', group: 'Serif', weights: [400, 700] },
  { family: 'Gilda Display', id: 'gilda-display', group: 'Serif', weights: [400] },
  { family: 'Prata', id: 'prata', group: 'Serif', weights: [400] },
  { family: 'Marcellus', id: 'marcellus', group: 'Serif', weights: [400] },
  { family: 'Cinzel', id: 'cinzel', group: 'Serif', weights: [400, 700] },
  { family: 'Italiana', id: 'italiana', group: 'Display', weights: [400] },
  { family: 'Syne', id: 'syne', group: 'Display', weights: [400, 700] },
  { family: 'Inter', id: 'inter', group: 'Sans serif', weights: [400, 700] },
  { family: 'DM Sans', id: 'dm-sans', group: 'Sans serif', weights: [400, 700] },
  { family: 'Manrope', id: 'manrope', group: 'Sans serif', weights: [400, 700] },
  { family: 'Montserrat', id: 'montserrat', group: 'Sans serif', weights: [400, 700] },
  { family: 'Poppins', id: 'poppins', group: 'Sans serif', weights: [400, 700] },
  { family: 'Jost', id: 'jost', group: 'Sans serif', weights: [400, 700] },
  { family: 'Outfit', id: 'outfit', group: 'Sans serif', weights: [400, 700] },
  { family: 'Work Sans', id: 'work-sans', group: 'Sans serif', weights: [400, 700] },
  { family: 'Raleway', id: 'raleway', group: 'Sans serif', weights: [400, 700] },
  { family: 'Lato', id: 'lato', group: 'Sans serif', weights: [400, 700] },
  { family: 'Nunito Sans', id: 'nunito-sans', group: 'Sans serif', weights: [400, 700] },
  { family: 'Karla', id: 'karla', group: 'Sans serif', weights: [400, 700] },
  { family: 'Josefin Sans', id: 'josefin-sans', group: 'Sans serif', weights: [400, 700] },
  { family: 'Figtree', id: 'figtree', group: 'Sans serif', weights: [400, 700] },
  { family: 'Plus Jakarta Sans', id: 'plus-jakarta-sans', group: 'Sans serif', weights: [400, 700] },
  { family: 'Space Grotesk', id: 'space-grotesk', group: 'Sans serif', weights: [400, 700] },
  { family: 'Tajawal', id: 'tajawal', group: 'Arabic and Latin', weights: [400, 700] },
  { family: 'Cairo', id: 'cairo', group: 'Arabic and Latin', weights: [400, 700] },
  { family: 'IBM Plex Sans Arabic', id: 'ibm-plex-sans-arabic', group: 'Arabic and Latin', weights: [400, 700] },
  { family: 'Almarai', id: 'almarai', group: 'Arabic and Latin', weights: [400, 700] },
  { family: 'Amiri', id: 'amiri', group: 'Arabic and Latin', weights: [400, 700] },
];

export const FONT_GROUPS = ['Serif', 'Sans serif', 'Display', 'Arabic and Latin'];

export const DEFAULT_BRAND = {
  brand_primary: '#1B2B4B',
  brand_accent: '#A9822F',
  heading_font: '',
  body_font: '',
};

// Vela's own fonts, used when a studio hasn't picked any.
const VELA_HEADING = "'STIX Two Text', Georgia, serif";
const VELA_BODY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const CUSTOM = 'custom';

export function fontOption(family) {
  return FONT_OPTIONS.find((f) => f.family === family) || null;
}

export function isHex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

export function hexToRgb(hex, fallback = [27, 43, 75]) {
  if (!isHex(hex)) return fallback;
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Mix a colour with white (amount 0..1 of white) for soft backgrounds.
export function tint(hex, amount = 0.92) {
  const [r, g, b] = hexToRgb(hex);
  const m = (c) => Math.round(c + (255 - c) * amount);
  return [m(r), m(g), m(b)];
}

const customFamily = (role) => `Studio ${role === 'heading' ? 'Heading' : 'Body'}`;

// The CSS font stack for a role, or '' when the studio hasn't chosen one (documents keep Vela's look).
function cssFamily(profile, role) {
  const value = profile?.[`${role}_font`];
  if (value === CUSTOM && profile?.[`${role}_font_data`]) return `'${customFamily(role)}', ${role === 'heading' ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif'}`;
  const option = fontOption(value);
  if (option) return `'${option.family}', ${option.group === 'Sans serif' ? 'Helvetica, Arial, sans-serif' : 'Georgia, serif'}`;
  return '';
}

export function fontStack(profile, role) {
  return cssFamily(profile, role) || (role === 'heading' ? VELA_HEADING : VELA_BODY);
}

// CSS variables for a document wrapper.
export function brandVars(profile = {}) {
  const primary = isHex(profile.brand_primary) ? profile.brand_primary : DEFAULT_BRAND.brand_primary;
  const accent = isHex(profile.brand_accent) ? profile.brand_accent : DEFAULT_BRAND.brand_accent;
  const vars = {
    '--doc-primary': primary,
    '--doc-accent': accent,
    '--doc-soft': `rgb(${tint(primary, 0.94).join(',')})`,
  };
  // With the studio's own colours, body text goes neutral so it doesn't clash with them.
  if (primary.toUpperCase() !== DEFAULT_BRAND.brand_primary) vars['--doc-text'] = '#2B2B2B';
  const heading = cssFamily(profile, 'heading');
  const body = cssFamily(profile, 'body');
  if (heading) vars['--doc-heading'] = heading;
  if (body) vars['--doc-body'] = body;
  return vars;
}

// Load the chosen fonts into the page (Google Fonts, or the studio's own uploaded files).
const loadedLinks = new Set();
const loadedFaces = new Set();

export function loadBrandFonts(profile = {}) {
  if (typeof document === 'undefined') return;
  const families = ['heading', 'body'].map((role) => fontOption(profile[`${role}_font`])).filter(Boolean);
  families.forEach((f) => {
    if (loadedLinks.has(f.family)) return;
    loadedLinks.add(f.family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${f.weights.join(';')}&display=swap`;
    document.head.appendChild(link);
  });
  ['heading', 'body'].forEach((role) => {
    const data = profile[`${role}_font_data`];
    if (profile[`${role}_font`] !== CUSTOM || !data || typeof FontFace === 'undefined') return;
    const key = `${role}:${data.length}:${data.slice(-32)}`;
    if (loadedFaces.has(key)) return;
    loadedFaces.add(key);
    const face = new FontFace(customFamily(role), `url(${data})`);
    face.load().then((f) => document.fonts.add(f)).catch(() => loadedFaces.delete(key));
  });
}

export function useBrandFonts(profile) {
  useEffect(() => { loadBrandFonts(profile || {}); }, [profile?.heading_font, profile?.body_font, profile?.heading_font_data, profile?.body_font_data]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Read an uploaded font file as a data URL; TTF files can also go into PDFs.
export function readFontFile(file, maxBytes = 600 * 1024) {
  return new Promise((resolve, reject) => {
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) { reject(new Error('Use a TTF, OTF, WOFF or WOFF2 font file.')); return; }
    if (file.size > maxBytes) { reject(new Error('That font file is over 600 KB. Try the TTF or WOFF2 of a single weight.')); return; }
    const mime = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }[ext];
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Couldn’t read that font file.'));
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1] || '';
      resolve({ data: `data:${mime};base64,${base64}`, name: file.name.replace(/\.[^.]+$/, '') });
    };
    reader.readAsDataURL(file);
  });
}

/* ── PDF fonts ─────────────────────────────────────────────── */

const pdfFontCache = new Map();

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function fetchTtf(id, weight) {
  const key = `${id}:${weight}`;
  if (!pdfFontCache.has(key)) {
    pdfFontCache.set(key, fetch(`https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/latin-${weight}-normal.ttf`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? bufferToBase64(b) : null))
      .catch(() => null));
  }
  return pdfFontCache.get(key);
}

const isTtfData = (data) => /^data:font\/ttf;base64,AAEAAA/.test(String(data || '')) || /^data:font\/ttf;base64,dHJ1ZQ/.test(String(data || ''));

// Registers the studio's fonts with a jsPDF document. Returns the family names to use,
// falling back to the closest built-in PDF font when a font can't be embedded.
export async function registerPdfFonts(pdf, profile = {}) {
  const result = {};
  for (const role of ['heading', 'body']) {
    const value = profile[`${role}_font`];
    const name = `brand-${role}`;
    let regular = null;
    let bold = null;
    if (value === CUSTOM && isTtfData(profile[`${role}_font_data`])) {
      regular = profile[`${role}_font_data`].split(',')[1];
    } else if (fontOption(value)) {
      const option = fontOption(value);
      regular = await fetchTtf(option.id, 400);
      if (option.weights.includes(700)) bold = await fetchTtf(option.id, 700);
    }
    if (regular) {
      try {
        pdf.addFileToVFS(`${name}-regular.ttf`, regular);
        pdf.addFont(`${name}-regular.ttf`, name, 'normal');
        pdf.addFileToVFS(`${name}-bold.ttf`, bold || regular);
        pdf.addFont(`${name}-bold.ttf`, name, 'bold');
        result[role] = name;
        continue;
      } catch {
        // Fall through to a built-in font.
      }
    }
    const option = fontOption(value);
    result[role] = option && (option.group === 'Serif') ? 'times' : 'helvetica';
  }
  return result;
}

export function pdfTextColor(profile = {}) {
  const primary = isHex(profile.brand_primary) ? profile.brand_primary.toUpperCase() : DEFAULT_BRAND.brand_primary;
  return primary === DEFAULT_BRAND.brand_primary ? [27, 43, 75] : [43, 43, 43];
}
