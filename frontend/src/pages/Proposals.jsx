import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import { ProposalDocument } from '../components/Documents';
import PdfDocumentView from '../components/PdfDocumentView';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, proposalsAPI } from '../utils/api';
import { formatDate, formatMoney, parseAmount } from '../utils/format';

const FILTERS = [
  { key: 'draft', label: 'Drafts' },
  { key: 'sent', label: 'Sent' },
  { key: 'approved', label: 'Approved' },
  { key: 'all', label: 'All' },
];

const NEXT_STATUS = { draft: { status: 'sent', label: 'Mark as sent' }, sent: { status: 'approved', label: 'Mark approved' } };

const isPdf = (file) => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));

function fileSize(bytes) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function blankProposal(client) {
  return {
    client_id: client?.id || '', client_name: client?.name || '', service: '', date: new Date().toISOString().slice(0, 10), value: '',
    intro: '', overview: '', packages: '', deliverables: '', timeline: '', terms: '', process: '', status: 'draft',
  };
}

function toLines(value) {
  return Array.isArray(value) ? value.join('\n') : String(value || '');
}

function toItems(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function proposalToForm(p) {
  return {
    client_id: p.client_id || '', client_name: p.client_name || '', service: p.service || '', date: p.date || '', value: p.value || '',
    intro: p.intro || '', overview: p.overview || '', packages: toLines(p.packages), deliverables: toLines(p.deliverables),
    timeline: toLines(p.timeline), terms: p.terms || '', process: p.process || '', status: p.status || 'draft',
  };
}

function formToPayload(form) {
  return { ...form, packages: toItems(form.packages), deliverables: toItems(form.deliverables), timeline: toItems(form.timeline) };
}

function Field({ id, label, hint, children }) {
  return (
    <div className="fc">
      <label className="fc-label" htmlFor={id}>{label}{hint && <span className="faint" style={{ fontWeight: 400 }}> {hint}</span>}</label>
      {children}
    </div>
  );
}

export default function Proposals() {
  const brand = useStudioProfile();
  const navigate = useNavigate();
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const { user } = useAuth();
  const currency = user?.currency || 'GBP';

  const [proposals, setProposals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [pageError, setPageError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankProposal());
  const [createError, setCreateError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);

  const [form, setForm] = useState(blankProposal());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [detailError, setDetailError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileRef = useRef(null);
  const [createFile, setCreateFile] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([proposalsAPI.list(), clientsAPI.list()])
      .then(([rows, clientRows]) => { setProposals(rows); setClients(clientRows); })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const selected = useMemo(() => proposals.find((p) => p.id === routeId) || null, [proposals, routeId]);

  useEffect(() => {
    if (!selected) return;
    setForm(proposalToForm(selected));
    setDirty(false);
    setSavedAt('');
    setDetailError('');
    setConfirmDelete(false);
    setNotice('');
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    draft: proposals.filter((p) => (p.status || 'draft') === 'draft').length,
    sent: proposals.filter((p) => p.status === 'sent').length,
    approved: proposals.filter((p) => p.status === 'approved').length,
    all: proposals.length,
  }), [proposals]);

  const rows = useMemo(
    () => proposals.filter((p) => filter === 'all' || (p.status || 'draft') === filter),
    [proposals, filter]
  );

  const colorFor = (clientId) => clients.find((c) => c.id === clientId)?.color;

  function edit(key) {
    return (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setDirty(true); };
  }

  function openCreate() {
    setCreateFile(null);
    setCreateForm(blankProposal(clients[0]));
    setCreateError('');
    setCreateOpen(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      if (createFile && !isPdf(createFile)) throw new Error('Upload your proposal as a PDF.');
      let created = await proposalsAPI.create(formToPayload(createForm));
      if (createFile) {
        try {
          created = { ...created, ...(await proposalsAPI.attachDocument(created.id, createFile)) };
        } catch (err) {
          setProposals((prev) => [created, ...prev]);
          setCreateOpen(false);
          navigate(`/proposals/${created.id}`);
          setDetailError(`The proposal was created, but the document didn’t upload: ${err.message}`);
          return;
        }
      }
      setProposals((prev) => [created, ...prev]);
      setCreateOpen(false);
      setCreateFile(null);
      navigate(`/proposals/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function save(overrides = {}) {
    setSaving(true);
    setDetailError('');
    try {
      const next = { ...form, ...overrides };
      const updated = await proposalsAPI.update(selected.id, formToPayload(next));
      setProposals((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...(updated || formToPayload(next)) } : p)));
      setForm(next);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(proposal, status) {
    try {
      const updated = await proposalsAPI.update(proposal.id, { ...proposal, status });
      setProposals((prev) => prev.map((p) => (p.id === proposal.id ? { ...p, ...(updated || {}), status } : p)));
    } catch (err) {
      setPageError(err.message);
    }
  }

  async function attach(file) {
    if (!file) return;
    if (!isPdf(file)) { setDetailError('Upload your proposal as a PDF.'); return; }
    setDetailError('');
    setUploading(1);
    try {
      const updated = await proposalsAPI.attachDocument(selected.id, file, { onProgress: (pct) => setUploading(Math.max(1, Math.round(pct))) });
      setProposals((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...updated } : p)));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setUploading(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function detach() {
    setDetailError('');
    try {
      const updated = await proposalsAPI.removeDocument(selected.id);
      setProposals((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...updated, files: [] } : p)));
    } catch (err) {
      setDetailError(err.message);
    }
  }

  async function sendToClient() {
    setSending(true);
    setSendError('');
    try {
      if (dirty) await proposalsAPI.update(selected.id, formToPayload(form));
      const updated = await proposalsAPI.send(selected.id, { note: sendNote });
      setProposals((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...updated } : p)));
      setForm((f) => ({ ...f, status: 'sent' }));
      setDirty(false);
      setSendOpen(false);
      setNotice(updated.emailed?.sent
        ? `Sent. ${selected.client_name} can see it in their portal, and we emailed them a link${updated.emailed.to ? ` at ${updated.emailed.to}` : ''}.`
        : `Marked as sent, but no email went out: ${updated.emailed?.reason || updated.emailed?.error || 'the email couldn’t be sent.'}`);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await proposalsAPI.remove(selected.id);
      setProposals((prev) => prev.filter((p) => p.id !== selected.id));
      navigate('/proposals');
    } catch (err) {
      setDetailError(err.message);
      setDeleting(false);
    }
  }

  function onClientChange(setter) {
    return (e) => {
      const client = clients.find((c) => c.id === e.target.value);
      setter((f) => ({ ...f, client_id: e.target.value, client_name: client?.name || '' }));
      if (setter === setForm) setDirty(true);
    };
  }

  /* ── Proposal editor ──────────────────────────────────────── */
  if (routeId) {
    if (loaded && !selected) {
      return (
        <>
          <div className="topbar"><nav className="tb-crumb"><Link to="/proposals"><Icon name="back" size={16} />Proposals</Link></nav></div>
          <div className="content"><div className="page panel empty" style={{ padding: 40 }}><b>This proposal doesn’t exist any more.</b> <Link to="/proposals">Back to proposals</Link></div></div>
        </>
      );
    }
    if (!selected) return <div className="content"><div className="muted">Loading…</div></div>;

    const next = NEXT_STATUS[form.status || 'draft'];
    const documentFile = (selected.files || [])[0] || null;
    const status = form.status || 'draft';
    const client = clients.find((c) => c.id === form.client_id);

    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/proposals"><Icon name="back" size={16} />Proposals</Link></nav>
          <div className="tb-r">
            <span className="faint" style={{ fontSize: 12.5 }}>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt}` : ''}</span>
            {status === 'sent' && next && <button className="btn bg" type="button" disabled={saving} onClick={() => save({ status: next.status })}>{next.label}</button>}
            <button className={status === 'draft' ? 'btn bg' : 'btn bp'} type="button" disabled={saving || !dirty} onClick={() => save()}>Save</button>
            {status !== 'approved' && (
              <button className={status === 'draft' ? 'btn bp' : 'btn bg'} type="button" disabled={saving || uploading > 0} onClick={() => { setSendNote(''); setSendError(''); setSendOpen(true); }}>
                <Icon name="send" />{status === 'draft' ? 'Send to client' : 'Send again'}
              </button>
            )}
          </div>
        </div>
        <div className="content">
          <div className="page">
            {detailError && <div className="form-error">{detailError}</div>}
            {notice && <div className="notice ok" role="status" style={{ marginBottom: 16 }}>{notice}</div>}
            <div className="editor-split">
              <form className="panel" style={{ padding: 22 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h1 className="h-section">Proposal details</h1>
                  <Pill status={form.status || 'draft'} />
                </div>
                <Field id="pp-client" label="Client">
                  <select id="pp-client" className="fi fsel" value={form.client_id} onChange={onClientChange(setForm)}>
                    <option value="">No client linked</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <div className="fi-row">
                  <Field id="pp-service" label="Service"><input id="pp-service" className="fi" value={form.service} onChange={edit('service')} required /></Field>
                  <Field id="pp-value" label="Quoted value"><input id="pp-value" className="fi" inputMode="decimal" value={form.value} onChange={edit('value')} /></Field>
                </div>
                <div className="fi-row">
                  <Field id="pp-date" label="Date"><input id="pp-date" className="fi" type="date" value={form.date} onChange={edit('date')} /></Field>
                  <Field id="pp-status" label="Status">
                    <select id="pp-status" className="fi fsel" value={form.status} onChange={edit('status')}>
                      <option value="draft">Draft</option><option value="sent">Sent</option><option value="approved">Approved</option>
                    </select>
                  </Field>
                </div>
                <div className="fc">
                  <span className="fc-label">Your proposal document</span>
                  {documentFile ? (
                    <div className="doc-file">
                      <span className="ico-pdf" aria-hidden="true">PDF</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="row-title" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{documentFile.name}</span>
                        <span className="row-sub" style={{ display: 'block' }}>{[fileSize(documentFile.size), documentFile.uploaded_at ? `uploaded ${formatDate(documentFile.uploaded_at)}` : ''].filter(Boolean).join(', ')}</span>
                      </span>
                      <button className="btn bg bxs" type="button" disabled={uploading > 0} onClick={() => fileRef.current?.click()}>{uploading ? `${uploading}%` : 'Replace'}</button>
                      <button className="btn bq bxs" type="button" disabled={uploading > 0} onClick={detach}>Remove</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`doc-drop${dragOver ? ' over' : ''}`}
                      disabled={uploading > 0}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); attach(e.dataTransfer.files?.[0]); }}
                    >
                      <Icon name="plus" size={18} />
                      <span>{uploading ? `Uploading… ${uploading}%` : 'Upload your proposal (PDF)'}</span>
                      <span className="faint" style={{ fontSize: 12.5, fontWeight: 400 }}>Already designed your proposal? Upload it and send it from here. Or write it in Vela below.</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => attach(e.target.files?.[0])} />
                </div>
                {documentFile ? (
                  <p className="muted" style={{ fontSize: 13, margin: '4px 0 16px' }}>Your client sees this document. Remove it if you’d rather write the proposal in Vela.</p>
                ) : (
                  <>
                    <Field id="pp-intro" label="Opening note"><textarea id="pp-intro" className="fi" value={form.intro} onChange={edit('intro')} placeholder="A short, personal hello to the client" /></Field>
                    <Field id="pp-overview" label="Project overview"><textarea id="pp-overview" className="fi" value={form.overview} onChange={edit('overview')} /></Field>
                    <Field id="pp-packages" label="Packages" hint="one per line"><textarea id="pp-packages" className="fi" value={form.packages} onChange={edit('packages')} /></Field>
                    <Field id="pp-deliv" label="Deliverables" hint="one per line"><textarea id="pp-deliv" className="fi" value={form.deliverables} onChange={edit('deliverables')} /></Field>
                    <Field id="pp-timeline" label="Timeline" hint="one per line"><textarea id="pp-timeline" className="fi" value={form.timeline} onChange={edit('timeline')} /></Field>
                    <Field id="pp-process" label="How we’ll work"><textarea id="pp-process" className="fi" value={form.process} onChange={edit('process')} /></Field>
                    <Field id="pp-terms" label="Terms"><textarea id="pp-terms" className="fi" value={form.terms} onChange={edit('terms')} /></Field>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn bd" type="button" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : confirmDelete ? 'Yes, delete proposal' : 'Delete proposal'}
                  </button>
                  {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button>}
                </div>
              </form>

              {documentFile
                ? <PdfDocumentView proposalId={selected.id} file={documentFile} />
                : <ProposalDocument proposal={form} studioName={user?.studio_name} currency={currency} brand={brand} emptyHint="Fill in the details on the left and the proposal takes shape here." />}
            </div>
          </div>
        </div>

        <Modal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          title={status === 'draft' ? 'Send this proposal' : 'Send the proposal again'}
          footer={
            <>
              <button className="btn bg" type="button" onClick={() => setSendOpen(false)}>Cancel</button>
              <button className="btn bp" type="button" disabled={sending || !form.client_id} onClick={sendToClient}><Icon name="send" />{sending ? 'Sending…' : 'Send'}</button>
            </>
          }
        >
          {sendError && <div className="form-error">{sendError}</div>}
          {!form.client_id ? (
            <p className="muted">Choose a client for this proposal first, then send it.</p>
          ) : (
            <>
              <p style={{ marginBottom: 12 }}>
                {client?.name || form.client_name} will see {documentFile ? <b>{documentFile.name}</b> : 'this proposal'} in their portal
                {client?.portal_user_id ? <>, and we’ll email them a link at <b>{client.portal_email}</b>.</> : '.'}
              </p>
              {!client?.portal_user_id && (
                <div className="notice" style={{ marginBottom: 12 }}>
                  {client?.name || 'This client'} doesn’t have portal access yet, so no email will go out. <Link to={`/clients/${form.client_id}`}>Give them access</Link> first if you’d like them to get it by email.
                </div>
              )}
              {!documentFile && !form.overview && !form.intro && !form.packages && (
                <div className="notice" style={{ marginBottom: 12 }}>This proposal is still empty. Upload your document or write it in Vela before sending.</div>
              )}
              <div className="fc" style={{ marginBottom: 0 }}>
                <label className="fc-label" htmlFor="pp-send-note">A short message <span className="faint" style={{ fontWeight: 400 }}>optional, shown in the email</span></label>
                <textarea id="pp-send-note" className="fi" rows={3} value={sendNote} onChange={(e) => setSendNote(e.target.value)} placeholder={`Hi ${(client?.contact || '').split(' ')[0] || 'there'}, here’s the proposal we talked about. Let me know if you have any questions.`} />
              </div>
            </>
          )}
        </Modal>
      </>
    );
  }

  /* ── Proposal list ────────────────────────────────────────── */
  const outValue = proposals.filter((p) => p.status === 'sent').reduce((s, p) => s + parseAmount(p.value), 0);
  const wonValue = proposals.filter((p) => p.status === 'approved').reduce((s, p) => s + parseAmount(p.value), 0);

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Proposals</h1>
        <div className="tb-r">
          <div className="segmented" role="tablist" aria-label="Filter proposals">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                {f.label} <span className="faint">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />New proposal</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {pageError && <div className="form-error">{pageError}</div>}
          <div className="figures" style={{ marginBottom: 24 }}>
            <div className="figure"><div className="figure-val">{formatMoney(outValue, currency)}</div><div className="figure-label">Waiting on a decision</div></div>
            <div className="figure"><div className="figure-val">{formatMoney(wonValue, currency)}</div><div className="figure-label">Approved</div></div>
            <div className="figure"><div className="figure-val">{counts.draft}</div><div className="figure-label">{counts.draft === 1 ? 'Draft in progress' : 'Drafts in progress'}</div></div>
          </div>
          <div className="panel tbl-wrap">
            {rows.length ? (
              <table className="tbl">
                <thead><tr><th>Client</th><th>Service</th><th className="r">Value</th><th className="hide-sm">Date</th><th>Status</th><th className="r"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {rows.map((p) => {
                    const next = NEXT_STATUS[p.status || 'draft'];
                    return (
                      <tr key={p.id} onClick={() => navigate(`/proposals/${p.id}`)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ClientMark name={p.client_name || '?'} color={colorFor(p.client_id)} size={28} />
                            <span style={{ fontWeight: 500 }}>{p.client_name || 'No client linked'}</span>
                          </div>
                        </td>
                        <td>{p.service || '—'}{(p.files || []).length > 0 && <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>PDF</span>}</td>
                        <td className="r num" style={{ fontWeight: 500 }}>{p.value ? formatMoney(p.value, currency) : '—'}</td>
                        <td className="hide-sm muted">{formatDate(p.date || p.created_at)}</td>
                        <td><Pill status={p.status || 'draft'} /></td>
                        <td className="r">{next && <button className="btn bg bxs" type="button" onClick={(e) => { e.stopPropagation(); quickStatus(p, next.status); }}>{next.label}</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                {!loaded && 'Loading…'}
                {loaded && proposals.length === 0 && (
                  <><b>No proposals yet.</b> Write one for a new enquiry and Vela will lay it out as a document you can review before sending.
                    <div style={{ marginTop: 14 }}><button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />New proposal</button></div></>
                )}
                {loaded && proposals.length > 0 && 'No proposals with this status.'}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New proposal"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="proposal-create" disabled={savingCreate}>{savingCreate ? (createFile ? 'Uploading…' : 'Creating…') : 'Create and open'}</button>
          </>
        }
      >
        <form id="proposal-create" onSubmit={handleCreate}>
          {createError && <div className="form-error">{createError}</div>}
          <Field id="ppc-client" label="Client">
            <select id="ppc-client" className="fi fsel" value={createForm.client_id} onChange={onClientChange(setCreateForm)}>
              <option value="">No client linked</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="fi-row">
            <Field id="ppc-service" label="Service"><input id="ppc-service" className="fi" value={createForm.service} onChange={(e) => setCreateForm({ ...createForm, service: e.target.value })} placeholder="Brand Identity" required autoFocus /></Field>
            <Field id="ppc-value" label="Quoted value"><input id="ppc-value" className="fi" inputMode="decimal" value={createForm.value} onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })} placeholder="4500" /></Field>
          </div>
          <Field id="ppc-file" label="Proposal document" hint="optional, PDF">
            <input id="ppc-file" className="fi" type="file" accept="application/pdf,.pdf" onChange={(e) => setCreateFile(e.target.files?.[0] || null)} />
          </Field>
          <p className="muted" style={{ fontSize: 13 }}>Upload the proposal you’ve already designed, or leave this empty and write it in Vela, with a live preview beside it.</p>
        </form>
      </Modal>
    </>
  );
}
