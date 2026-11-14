import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { filesAPI } from '../utils/api';

// Shows an uploaded PDF (kept in private storage) page by page, inline, with a download button.
// Gets a short-lived link for the file, draws it with pdf.js, and falls back to the browser's
// own PDF viewer if the pages can't be drawn.
export default function PdfDocumentView({ proposalId, file, title }) {
  const pagesRef = useRef(null);
  const [state, setState] = useState({ status: 'loading', pages: 0, link: '', error: '' });

  useEffect(() => {
    if (!file?.url) return undefined;
    let cancelled = false;
    const holder = pagesRef.current;
    setState({ status: 'loading', pages: 0, link: '', error: '' });
    (async () => {
      let link = '';
      try {
        const links = await filesAPI.links('', [file.url], { proposalId });
        link = links[file.url] || '';
        if (!link) throw new Error('This document isn’t available right now.');
        if (cancelled) return;
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const doc = await pdfjs.getDocument({ url: link, isEvalSupported: false }).promise;
        if (cancelled) return;
        setState({ status: 'ready', pages: doc.numPages, link, error: '' });
        await new Promise((r) => requestAnimationFrame(r));
        if (!holder) return;
        holder.innerHTML = '';
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
        if (cancelled) return;
        // If drawing failed but we have a link, let the browser show the PDF itself.
        setState({ status: link ? 'fallback' : 'error', pages: 0, link, error: err?.message || 'Couldn’t open this document.' });
      }
    })();
    return () => { cancelled = true; if (holder) holder.innerHTML = ''; };
  }, [proposalId, file?.url]);

  const download = async () => {
    try {
      const links = await filesAPI.links('', [file.url], { proposalId });
      const href = links[file.url];
      if (href) window.open(href, '_blank', 'noopener');
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    }
  };

  return (
    <section className="pdfdoc" aria-label={title || file?.name || 'Proposal document'}>
      <div className="pdfdoc-bar">
        <div style={{ minWidth: 0 }}>
          <div className="row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name || 'Proposal.pdf'}</div>
          <div className="row-sub">{state.status === 'ready' ? `${state.pages} ${state.pages === 1 ? 'page' : 'pages'}` : state.status === 'loading' ? 'Opening…' : 'PDF'}</div>
        </div>
        <button className="btn bg bsm" type="button" onClick={download}><Icon name="download" size={15} />Download</button>
      </div>
      {state.status === 'loading' && <div className="pdfdoc-msg">Opening the document…</div>}
      {state.status === 'error' && <div className="pdfdoc-msg">{state.error}</div>}
      {state.status === 'fallback' && (
        <iframe className="pdfdoc-frame" title={file?.name || 'Proposal'} src={state.link} />
      )}
      <div ref={pagesRef} className="pdfdoc-pages" />
    </section>
  );
}
