import React, { useEffect, useRef } from 'react';

// The Vela constellation ("the Sails") drawing itself on a night sky, behind the sign-in panel.
// Brightest stars by right ascension (hours) and declination (degrees), joined in the IAU outline.
const STARS = [
  { ra: 8.159, dec: -47.34, mag: 1.8 },
  { ra: 8.745, dec: -54.71, mag: 2.0 },
  { ra: 9.368, dec: -55.01, mag: 2.5 },
  { ra: 9.948, dec: -54.57, mag: 3.5 },
  { ra: 10.779, dec: -49.42, mag: 2.7 },
  { ra: 10.246, dec: -42.12, mag: 3.8 },
  { ra: 9.511, dec: -40.47, mag: 3.6 },
  { ra: 9.133, dec: -43.43, mag: 2.2 },
];
const LINES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]];

const ease = (x) => 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;

function makeField(count) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: count }, () => ({
    x: rnd(), y: rnd(), r: rnd() * 1.1 + 0.2, phase: rnd() * 6.28, speed: 0.6 + rnd() * 1.6, delay: rnd(),
  }));
}

export default function VelaSky() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const field = makeField(240);
    const ras = STARS.map((s) => s.ra);
    const decs = STARS.map((s) => s.dec);
    const minRa = Math.min(...ras), maxRa = Math.max(...ras), minDec = Math.min(...decs), maxDec = Math.max(...decs);
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const header = window.matchMedia('(max-width: 860px)');
    let w = 0, h = 0, raf = 0;
    const start = performance.now();

    const size = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      // Background stars, twinkling, drifting slightly with the mouse.
      ctx.fillStyle = '#F5F0E8';
      for (const s of field) {
        const fade = ease((t - s.delay * 1.2) / 1.2);
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        ctx.globalAlpha = fade * twinkle * (0.25 + s.r * 0.45);
        ctx.beginPath();
        ctx.arc(s.x * w - mouse.x * 14 * (0.4 + s.r), s.y * h - mouse.y * 10 * (0.4 + s.r), s.r, 0, 6.283);
        ctx.fill();
      }
      // The constellation, east on the left as it appears in the sky. On phones and tablets, where the
      // sky is a header above the form, only the starfield shows.
      if (header.matches) { ctx.globalAlpha = 1; return; }
      const bw = Math.min(w * 0.72, 440), bh = bw * 0.62;
      const ox = (w - bw) / 2 - mouse.x * 26, oy = h * 0.5 - bh / 2 - 10 - mouse.y * 18;
      const pts = STARS.map((s) => ({
        x: ox + (1 - (s.ra - minRa) / (maxRa - minRa)) * bw,
        y: oy + (1 - (s.dec - minDec) / (maxDec - minDec)) * bh,
        mag: s.mag,
      }));
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#D9C08A';
      LINES.forEach(([a, b], i) => {
        const k = ease((t - 2 - i * 0.22) / 0.6);
        if (k <= 0) return;
        const A = pts[a], B = pts[b];
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(A.x + (B.x - A.x) * k, A.y + (B.y - A.y) * k); ctx.stroke();
      });
      pts.forEach((p, i) => {
        const k = ease((t - 0.8 - i * 0.16) / 0.7);
        if (k <= 0) return;
        const r = (4.4 - p.mag) * 1.25 + 0.8;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 7);
        glow.addColorStop(0, 'rgba(245,240,232,0.55)');
        glow.addColorStop(1, 'rgba(245,240,232,0)');
        ctx.globalAlpha = k * (0.85 + 0.15 * Math.sin(t * 1.4 + i));
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, r * 7, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(p.x, p.y, r * k, 0, 6.283); ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    const loop = (now) => {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      draw((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      const rect = host.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left) / rect.width - 0.5;
      mouse.ty = (e.clientY - rect.top) / rect.height - 0.5;
    };
    const onLeave = () => { mouse.tx = 0; mouse.ty = 0; };
    // Pause when the tab is hidden.
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(loop);
    };

    size();
    const observer = new ResizeObserver(() => { size(); if (reduce) draw(60); });
    observer.observe(host);
    if (reduce) draw(60);
    else {
      raf = requestAnimationFrame(loop);
      host.addEventListener('pointermove', onMove);
      host.addEventListener('pointerleave', onLeave);
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="vela-sky" aria-hidden="true" />;
}
