import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Shows the exact PDF that will download, page by page, with Download and Print.
// `build` returns a jsPDF document; pages are drawn with pdf.js so it works on phones too.
export default function PdfPreview({ open, onClose, title, build, fileName }) {
  const [state, setState] = useState({ status: 'idle', pages: 0, error: '' });
  const pagesRef = useRef(null);
  const docRef = useRef(null);
  const urlRef = useRef('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    setState({ status: 'loading', pages: 0, error: '' });

    (async () => {
      try {
        const pdf = await build();
        if (cancelled) return;
        docRef.current = pdf;
        const blob = pdf.output('blob');
        urlRef.current = URL.createObjectURL(blob);
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const data = new Uint8Array(await blob.arrayBuffer());
        const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        if (cancelled) return;
        setState({ status: 'ready', pages: doc.numPages, error: '' });
        // Draw each page at the width of the viewer, sharp on high-density screens.
        await new Promise((r) => requestAnimationFrame(r));
        const holder = pagesRef.current;
        if (!holder) return;
        const width = Math.min(holder.clientWidth || 760, 900);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= doc.numPages; n += 1) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`);
          holder.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) setState({ status: 'error', pages: 0, error: err?.message || 'Couldn’t create the PDF.' });
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', handler);
      if (pagesRef.current) pagesRef.current.innerHTML = '';
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
      docRef.current = null;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  function download() {
    docRef.current?.save(fileName);
  }

  function print() {
    if (!urlRef.current) return;
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.src = urlRef.current;
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.open(urlRef.current, '_blank', 'noopener'); }
      setTimeout(() => frame.remove(), 60000);
    };
    document.body.appendChild(frame);
  }

  const ready = state.status === 'ready';
  return (
    <div className="pdfv" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pdfv-bar">
        <div className="pdfv-title">
          <span className="row-title" style={{ color: '#fff' }}>{title}</span>
          {ready && <span className="pdfv-sub">{state.pages} {state.pages === 1 ? 'page' : 'pages'}</span>}
        </div>
        <div className="pdfv-actions">
          <button className="btn bg bsm pdfv-btn" type="button" disabled={!ready} onClick={print}><Icon name="print" size={15} /><span className="hide-sm">Print</span></button>
          <button className="btn bp bsm" type="button" disabled={!ready} onClick={download}><Icon name="download" size={15} />Download</button>
          <button className="mc pdfv-close" type="button" onClick={onClose} aria-label="Close preview"><Icon name="close" size={18} /></button>
        </div>
      </div>
      <div className="pdfv-body" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {state.status === 'loading' && <div className="pdfv-msg">Preparing your PDF…</div>}
        {state.status === 'error' && <div className="pdfv-msg">{state.error}</div>}
        <div ref={pagesRef} className="pdfv-pages" />
      </div>
    </div>
  );
}
