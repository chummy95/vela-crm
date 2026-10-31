import { useEffect, useState } from 'react';
import { studioProfileAPI } from '../utils/api';
import { appThemeVars, contrast, isHex, loadBrandFonts } from '../utils/brand';

// Dresses the studio app and the client portal in the studio's brand: colours and fonts from
// Settings, and the studio's logo in the sidebar. Remembers the colours in this browser so the
// next visit opens in the right look straight away. Signing out puts Vela's own look back.
const CACHE = 'vela-theme-';
let applied = [];

function apply(vars) {
  const root = document.documentElement;
  applied.forEach((key) => { if (!(key in vars)) root.style.removeProperty(key); });
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  applied = Object.keys(vars);
}

export function clearStudioTheme() {
  apply({});
}

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(CACHE + key) || 'null'); } catch { return null; }
}

function writeCache(key, value) {
  try { localStorage.setItem(CACHE + key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

// Does this logo actually show up on the sidebar colour? (A cream logo on cream, or a dark logo
// on a dark sidebar, would be invisible.) Samples the image's pixels in a small canvas.
export function visibleOn(dataUrl, bgHex) {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve(false); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const w = 80;
        const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let seen = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 80) continue;
          const hex = `#${[data[i], data[i + 1], data[i + 2]].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          if (contrast(hex, bgHex) >= 2.2) seen += 1;
        }
        resolve(seen >= (w * h) * 0.01);
      } catch {
        resolve(true);
      }
    };
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

// The logo that reads on the sidebar: the light logo first, then the main one, else none.
async function sidebarLogo(profile, vars) {
  const side = vars['--ink'] || '#1B2B4B';
  for (const candidate of [profile.logo_light, profile.logo]) {
    if (candidate && await visibleOn(candidate, side)) return candidate;
  }
  return '';
}

export function useStudioTheme(cacheKey) {
  const [version, setVersion] = useState(0);
  const [brand, setBrand] = useState(() => {
    const cached = cacheKey ? readCache(cacheKey) : null;
    if (cached?.vars) apply(cached.vars);
    return cached ? { name: cached.name || '', logo: '', branded: Boolean(cached.branded) } : { name: '', logo: '', branded: false };
  });

  useEffect(() => {
    if (!cacheKey) return undefined;
    let active = true;
    studioProfileAPI.get(undefined, { fresh: version > 0 })
      .then((profile) => {
        if (!active) return;
        const vars = appThemeVars(profile);
        apply(vars);
        loadBrandFonts(profile);
        const branded = Object.keys(vars).length > 0;
        const name = profile.business_name || '';
        setBrand({ name, logo: '', branded });
        writeCache(cacheKey, { vars, name, branded, primary: isHex(profile.brand_primary) ? profile.brand_primary : '' });
        if (branded) sidebarLogo(profile, vars).then((logo) => { if (active && logo) setBrand({ name, logo, branded }); });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [cacheKey, version]);

  // Settings tells us when the brand changes, so the app updates without a reload.
  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener('vela-brand-updated', onChange);
    return () => window.removeEventListener('vela-brand-updated', onChange);
  }, []);

  // Back to Vela's look when this layout goes away (signing out).
  useEffect(() => () => clearStudioTheme(), []);

  return brand;
}
