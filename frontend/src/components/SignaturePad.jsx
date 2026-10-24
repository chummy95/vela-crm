import React, { useEffect, useRef, useState } from 'react';

const SCRIPT_FONT = 'Mrs Saint Delafield';
let fontRequested = false;

function loadScriptFont() {
  if (fontRequested || typeof document === 'undefined') return;
  fontRequested = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${SCRIPT_FONT.replace(/ /g, '+')}&display=swap`;
  document.head.appendChild(link);
}

const W = 560;
const H = 180;

// Draw a signature with a finger, pen or mouse, or type it. Reports a transparent PNG data URL ('' when empty).
export default function SignaturePad({ name = '', onChange, ink = '#1B2B4B', label = 'Signature' }) {
  const [mode, setMode] = useState('draw');
  const [typed, setTyped] = useState(name);
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  useEffect(() => { loadScriptFont(); }, []);
  useEffect(() => { if (mode === 'type' && !typed) setTyped(name); }, [mode, name]); // eslint-disable-line react-hooks/exhaustive-deps

  function ctx() {
    const canvas = canvasRef.current;
    const c = canvas.getContext('2d');
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = ink;
    c.fillStyle = ink;
    return c;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange('');
  }

  // Typed signatures are rendered onto the same canvas, so both kinds are saved the same way.
  useEffect(() => {
    if (mode !== 'type') return undefined;
    let cancelled = false;
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const c = ctx();
      c.clearRect(0, 0, canvas.width, canvas.height);
      const value = typed.trim();
      if (!value) { onChange(''); return; }
      try { await document.fonts.load(`64px '${SCRIPT_FONT}'`); } catch { /* falls back to cursive */ }
      if (cancelled) return;
      let size = 170;
      c.font = `${size}px '${SCRIPT_FONT}', 'Brush Script MT', cursive`;
      while (c.measureText(value).width > canvas.width - 60 && size > 48) {
        size -= 4;
        c.font = `${size}px '${SCRIPT_FONT}', 'Brush Script MT', cursive`;
      }
      c.textBaseline = 'middle';
      c.fillText(value, 30, canvas.height / 2 + 8);
      onChange(canvas.toDataURL('image/png'), 'typed');
    };
    draw();
    return () => { cancelled = true; };
  }, [mode, typed]); // eslint-disable-line react-hooks/exhaustive-deps

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W * 2, y: ((e.clientY - rect.top) / rect.height) * H * 2 };
  }

  function down(e) {
    if (mode !== 'draw') return;
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const c = ctx();
    c.beginPath();
    c.arc(last.current.x, last.current.y, 2.4, 0, Math.PI * 2);
    c.fill();
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const p = point(e);
    const c = ctx();
    const speed = Math.hypot(p.x - last.current.x, p.y - last.current.y);
    c.lineWidth = Math.max(2.6, 6 - speed / 12);
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    onChange(canvasRef.current.toDataURL('image/png'), 'drawn');
  }

  function switchMode(next) {
    if (next === mode) return;
    const canvas = canvasRef.current;
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange('');
    setMode(next);
  }

  return (
    <div className="sigpad">
      <div className="sigpad-head">
        <span className="fc-label" style={{ marginBottom: 0 }}>{label}</span>
        <div className="segmented" role="tablist" aria-label="How to sign">
          <button type="button" role="tab" aria-selected={mode === 'draw'} className={mode === 'draw' ? 'on' : ''} onClick={() => switchMode('draw')}>Draw</button>
          <button type="button" role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'on' : ''} onClick={() => switchMode('type')}>Type</button>
        </div>
      </div>
      {mode === 'type' && (
        <input className="fi" aria-label="Type your signature" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your full name" style={{ marginBottom: 8 }} />
      )}
      <div className={`sigpad-box${mode === 'draw' ? ' draw' : ''}`}>
        <canvas
          ref={canvasRef}
          width={W * 2}
          height={H * 2}
          aria-label={mode === 'draw' ? 'Draw your signature here' : 'Your typed signature'}
          role="img"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
        />
        <span className="sigpad-line" aria-hidden="true" />
        {mode === 'draw' && !hasInk && <span className="sigpad-hint" aria-hidden="true">Sign here</span>}
      </div>
      <div className="sigpad-foot">
        <span className="faint" style={{ fontSize: 12.5 }}>{mode === 'draw' ? 'Use your mouse, trackpad, finger or stylus.' : 'Your name in a signature style.'}</span>
        {(hasInk || (mode === 'type' && typed)) && <button type="button" className="auth-link" style={{ fontSize: 13 }} onClick={() => (mode === 'type' ? setTyped('') : clear())}>Clear</button>}
      </div>
    </div>
  );
}
