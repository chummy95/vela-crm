import React, { useEffect, useMemo, useState } from 'react';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import { ContractDocument, coverTitle as coverTitleOf } from '../components/Documents';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, contractsAPI, studioProfileAPI } from '../utils/api';
import { DEFAULT_CLAUSES } from '../utils/constants';
import ClauseEditor from '../components/ClauseEditor';
import ContractTemplate from './ContractTemplate';
import { contractClauses } from '../utils/contracts';
import { formatDate, formatMoney } from '../utils/format';
import SignaturePad from '../components/SignaturePad';
import { signedLabel } from '../utils/contracts';
import { buildContractPdf, contractFileName } from '../utils/contractPdf';
import PdfPreview from '../components/PdfPreview';

const FILTERS = [
  { key: 'unsigned', label: 'Awaiting signature' },
  { key: 'signed', label: 'Signed' },
  { key: 'all', label: 'All' },
];

export const COVER_TITLES = [
  'Brand Identity Design Services Contract',
  'Brand Strategy and Identity Contract',
  'Packaging Design Services Contract',
  'Website Design Services Contract',
  'Brand and Website Design Contract',
  'Design Services Contract',
];

function templateClauses(brand) {
  return Array.isArray(brand?.contract_clauses) && brand.contract_clauses.length ? brand.contract_clauses : DEFAULT_CLAUSES;
}

function blankContract(client, brand) {
  return {
    client_id: client?.id || '', client_name: client?.name || '', client_email: client?.email || '', client_contact: client?.contact || '', client_address: '',
    cover_title: brand?.contract_cover_title || '',
    service: '', value: '', start_date: '', end_date: '', duration: '', date: new Date().toISOString().slice(0, 10), clauses: templateClauses(brand),
  };
}


function contractToForm(c) {
  return {
    client_id: c.client_id || '', client_name: c.client_name || '', client_email: c.client_email || '', client_contact: c.client_contact || '', client_address: c.client_address || '',
    cover_title: c.cover_title || '',
    service: c.service || '', value: c.value || '', start_date: c.start_date || '', end_date: c.end_date || '', duration: c.duration || '', date: c.date || '',
    clauses: contractClauses(c), signed: Boolean(c.signed),
  };
}

function Field({ id, label, children }) {
  return <div className="fc"><label className="fc-label" htmlFor={id}>{label}</label>{children}</div>;
}

export default function Contracts() {
  const brand = useStudioProfile();
  const navigate = useNavigate();
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const { user } = useAuth();
  const currency = user?.currency || 'GBP';

  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [pageError, setPageError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankContract());
  const [createError, setCreateError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);

  const [form, setForm] = useState(blankContract());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [detailError, setDetailError] = useState('');
  const [confirmSign, setConfirmSign] = useState(false);
  const [studioSignOpen, setStudioSignOpen] = useState(false);
  const [studioSig, setStudioSig] = useState({ name: '', image: '' });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailNote, setEmailNote] = useState('');

  useEffect(() => {
    Promise.all([contractsAPI.list(), clientsAPI.list()])
      .then(([rows, clientRows]) => { setContracts(rows); setClients(clientRows); })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
    // Signatures arrive live while this page is open.
    return contractsAPI.subscribe((rows) => {
      setContracts((prev) => prev.map((c) => {
        const live = rows.find((r) => r.id === c.id);
        return live && (live.signed !== c.signed || live.client_signature?.signed_at !== c.client_signature?.signed_at) ? { ...c, ...live } : c;
      }));
    }, () => {});
  }, []);

  const selected = useMemo(() => contracts.find((c) => c.id === routeId) || null, [contracts, routeId]);
  useEffect(() => { setEmailNote(''); }, [routeId]);

  useEffect(() => {
    if (!selected) return;
    setForm(contractToForm(selected));
    setDirty(false);
    setSavedAt('');
    setDetailError('');
    setConfirmSign(false);
    setConfirmDelete(false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    unsigned: contracts.filter((c) => !c.signed).length,
    signed: contracts.filter((c) => c.signed).length,
    all: contracts.length,
  }), [contracts]);

  const rows = useMemo(
    () => contracts.filter((c) => (filter === 'all' ? true : filter === 'signed' ? c.signed : !c.signed)),
    [contracts, filter]
  );

  const colorFor = (clientId) => clients.find((c) => c.id === clientId)?.color;

  function edit(key) {
    return (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setDirty(true); };
  }

  function pickClient(setter, markDirty) {
    return (e) => {
      const client = clients.find((c) => c.id === e.target.value);
      setter((f) => ({ ...f, client_id: e.target.value, client_name: client?.name || '', client_email: client?.email || f.client_email, client_contact: client?.contact || f.client_contact || '' }));
      if (markDirty) setDirty(true);
    };
  }

  async function openCreate() {
    const latest = await studioProfileAPI.get().catch(() => brand);
    setCreateForm(blankContract(clients[0], latest));
    setCreateError('');
    setCreateOpen(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await contractsAPI.create(createForm);
      setContracts((prev) => [created, ...prev]);
      setCreateOpen(false);
      navigate(`/contracts/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function save() {
    setSaving(true);
    setDetailError('');
    try {
      const updated = await contractsAPI.update(selected.id, form);
      setContracts((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...(updated || form) } : c)));
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function markSigned() {
    if (!confirmSign) { setConfirmSign(true); return; }
    setSaving(true);
    try {
      if (dirty) await contractsAPI.update(selected.id, form);
      await contractsAPI.sign(selected.id);
      setContracts((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...form, signed: true } : c)));
      setForm((f) => ({ ...f, signed: true }));
      setDirty(false);
      setConfirmSign(false);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveStudioSignature() {
    setSaving(true);
    setDetailError('');
    try {
      if (dirty) await contractsAPI.update(selected.id, form);
      const { studio_signature } = await contractsAPI.signAsStudio(selected.id, studioSig);
      setContracts((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...form, studio_signature } : c)));
      setDirty(false);
      setStudioSignOpen(false);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeStudioSignature() {
    setSaving(true);
    try {
      await contractsAPI.removeStudioSignature(selected.id);
      setContracts((prev) => prev.map((c) => (c.id === selected.id ? { ...c, studio_signature: null } : c)));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function emailClient() {
    setEmailing(true);
    setDetailError('');
    setEmailNote('');
    try {
      const result = await contractsAPI.emailToClient(selected.id);
      setContracts((prev) => prev.map((c) => (c.id === selected.id ? { ...c, emailed_at: result.emailed_at } : c)));
      setEmailNote(`Emailed to ${result.emailed_to || selected.client_name}.`);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setEmailing(false);
    }
  }

  const previewContract = () => ({ ...selected, ...form, studio_signature: selected.studio_signature });

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await contractsAPI.remove(selected.id);
      setContracts((prev) => prev.filter((c) => c.id !== selected.id));
      navigate('/contracts');
    } catch (err) {
      setDetailError(err.message);
      setDeleting(false);
    }
  }

  /* ── Contract template ─────────────────────────────────────── */
  if (routeId === 'template') return <ContractTemplate />;

  /* ── Contract editor ──────────────────────────────────────── */
  if (routeId) {
    if (loaded && !selected) {
      return (
        <>
          <div className="topbar"><nav className="tb-crumb"><Link to="/contracts"><Icon name="back" size={16} />Contracts</Link></nav></div>
          <div className="content"><div className="page panel empty" style={{ padding: 40 }}><b>This contract doesn’t exist any more.</b> <Link to="/contracts">Back to contracts</Link></div></div>
        </>
      );
    }
    if (!selected) return <div className="content"><div className="muted">Loading…</div></div>;
    const signed = form.signed;

    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/contracts"><Icon name="back" size={16} />Contracts</Link></nav>
          <div className="tb-r">
            <span className="faint" style={{ fontSize: 12.5 }}>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt}` : ''}</span>
            {!signed && (
              <>
                {confirmSign && <button className="btn bq" type="button" onClick={() => setConfirmSign(false)}>Not yet</button>}
                <button className="btn bq" type="button" disabled={saving} onClick={markSigned}>{confirmSign ? 'Confirm: signed on paper or elsewhere' : 'Signed outside Vela?'}</button>
              </>
            )}
            <button className="btn bg" type="button" onClick={() => setPreviewOpen(true)}><Icon name="proposal" />View PDF</button>
            {!selected.studio_signature && !selected.client_signature && (
              <button className="btn bg" type="button" disabled={saving} onClick={() => { setStudioSig({ name: user?.name || '', image: '' }); setStudioSignOpen(true); }}><Icon name="edit" />Add your signature</button>
            )}
            <button className="btn bp" type="button" disabled={saving || !dirty || signed} onClick={save}>Save</button>
          </div>
        </div>
        <div className="content">
          <div className="page">
            {detailError && <div className="form-error">{detailError}</div>}
            {signed && (
              <div className="notice ok" style={{ marginBottom: 16 }}>
                {selected.client_signature
                  ? `${selected.client_signature.name} accepted and signed this contract on ${new Date(selected.client_signature.signed_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. It’s now read-only.`
                  : 'This contract is marked as signed, so it’s now read-only.'}
              </div>
            )}
            {!signed && (
              <div className="locked-note" style={{ marginBottom: 16 }}>
                <Icon name="contract" size={16} />
                <span style={{ flex: 1 }}>
                  {selected.client_id
                    ? <>{selected.client_name} can read, accept and sign this in their client portal. {selected.studio_signature ? `You signed it as ${selected.studio_signature.name}.` : 'Add your own signature first so it’s ready to go.'}</>
                    : 'Link a client so they can sign this in their portal.'}
                </span>
                {selected.studio_signature && <button type="button" className="auth-link" style={{ fontSize: 13 }} disabled={saving} onClick={removeStudioSignature}>Remove my signature</button>}
              </div>
            )}
            {!signed && selected.client_id && (
              <div className="email-bar">
                <Icon name="mail" size={16} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {emailNote || (selected.emailed_at
                    ? `Emailed to ${selected.client_name} on ${new Date(selected.emailed_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`
                    : `Send ${selected.client_name} an email with a link to review and sign.`)}
                  {dirty && <span className="faint"> Save your changes first.</span>}
                </span>
                <button className="btn bg bsm" type="button" disabled={emailing || saving || dirty} onClick={emailClient}>
                  {emailing ? 'Sending…' : selected.emailed_at || emailNote ? 'Email again' : 'Email to client'}
                </button>
              </div>
            )}
            <div className="editor-split">
              <form className="panel" style={{ padding: 22 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
                <fieldset disabled={signed} style={{ border: 'none', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h1 className="h-section">Contract details</h1>
                    <Pill status={signed ? 'signed' : 'unsigned'} label={signedLabel(selected)} />
                  </div>
                  <Field id="ct-client" label="Client">
                    <select id="ct-client" className="fi fsel" value={form.client_id} onChange={pickClient(setForm, true)}>
                      <option value="">No client linked</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <div className="fi-row">
                    <Field id="ct-contact" label="Client name (person signing)"><input id="ct-contact" className="fi" value={form.client_contact} onChange={edit('client_contact')} /></Field>
                    <Field id="ct-email" label="Client email"><input id="ct-email" className="fi" type="email" value={form.client_email} onChange={edit('client_email')} /></Field>
                  </div>
                  <Field id="ct-addr" label="Client address"><input id="ct-addr" className="fi" value={form.client_address} onChange={edit('client_address')} placeholder="City, country" /></Field>
                  <div className="fi-row">
                    <Field id="ct-service" label="Project"><input id="ct-service" className="fi" value={form.service} onChange={edit('service')} placeholder="Brand identity revamp for …" required /></Field>
                    <Field id="ct-value" label="Project value"><input id="ct-value" className="fi" inputMode="decimal" value={form.value} onChange={edit('value')} /></Field>
                  </div>
                  <Field id="ct-cover" label="Cover title">
                    <input id="ct-cover" className="fi" list="cover-titles" value={form.cover_title} onChange={edit('cover_title')} placeholder={brand.contract_cover_title || 'Design Services Contract'} />
                    <datalist id="cover-titles">
                      {COVER_TITLES.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  </Field>
                  <div className="fi-row three">
                    <Field id="ct-date" label="Contract date"><input id="ct-date" className="fi" type="date" value={form.date} onChange={edit('date')} /></Field>
                    <Field id="ct-start" label="Start date"><input id="ct-start" className="fi" type="date" value={form.start_date} onChange={edit('start_date')} /></Field>
                    <Field id="ct-end" label="End date"><input id="ct-end" className="fi" type="date" value={form.end_date} onChange={edit('end_date')} /></Field>
                  </div>

                  <h2 className="card-title" style={{ margin: '22px 0 4px' }}>Sections</h2>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                    Highlighted blanks in the preview still need filling in. Details above, and your name, address and phone from <Link to="/settings">Settings</Link>, fill in automatically.
                  </p>
                  <ClauseEditor clauses={form.clauses} disabled={signed} onChange={(clauses) => { setForm((f) => ({ ...f, clauses })); setDirty(true); }} />
                  {!signed && (
                    <p style={{ marginTop: 12, fontSize: 13 }}>
                      <button
                        type="button"
                        className="auth-link"
                        onClick={async () => {
                          if (!window.confirm('Replace these sections with your contract template? Edits you made to this contract’s sections will be lost.')) return;
                          const latest = await studioProfileAPI.get().catch(() => brand);
                          setForm((f) => ({ ...f, clauses: templateClauses(latest) }));
                          setDirty(true);
                        }}
                      >
                        Replace sections with my contract template
                      </button>
                    </p>
                  )}
                </fieldset>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn bd" type="button" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : confirmDelete ? 'Yes, delete contract' : 'Delete contract'}
                  </button>
                  {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button>}
                </div>
              </form>

              <ContractDocument contract={{ ...selected, ...form }} studioName={user?.studio_name} currency={currency} brand={brand} />
            </div>
          </div>
        </div>
        <PdfPreview
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={`${coverTitleOf(previewContract(), brand)}${selected.client_name ? `, ${selected.client_name}` : ''}`}
          build={() => buildContractPdf(previewContract(), brand, currency)}
          fileName={contractFileName(previewContract(), brand)}
        />
        <Modal
          open={studioSignOpen}
          onClose={() => setStudioSignOpen(false)}
          title="Add your signature"
          footer={
            <>
              <button className="btn bg" type="button" onClick={() => setStudioSignOpen(false)}>Cancel</button>
              <button className="btn bp" type="button" disabled={saving || !studioSig.image || studioSig.name.trim().length < 2} onClick={saveStudioSignature}>{saving ? 'Signing…' : 'Sign'}</button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>Your signature goes on the studio’s side of this contract. {form.client_name || 'The client'} then signs theirs in the portal.</p>
          <div className="fc">
            <label className="fc-label" htmlFor="ss-name">Your name</label>
            <input id="ss-name" className="fi" value={studioSig.name} onChange={(e) => setStudioSig((s) => ({ ...s, name: e.target.value }))} />
          </div>
          {studioSignOpen && <SignaturePad name={studioSig.name} onChange={(image) => setStudioSig((s) => ({ ...s, image }))} />}
        </Modal>
      </>
    );
  }

  /* ── Contract list ────────────────────────────────────────── */
  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Contracts</h1>
        <div className="tb-r">
          <div className="segmented" role="tablist" aria-label="Filter contracts">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                {f.label} <span className="faint">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <button className="btn bg" type="button" onClick={() => navigate('/contracts/template')}><Icon name="edit" />Template</button>
          <button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />New contract</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {pageError && <div className="form-error">{pageError}</div>}
          <div className="panel tbl-wrap">
            {rows.length ? (
              <table className="tbl">
                <thead><tr><th>Client</th><th>Service</th><th className="r">Value</th><th className="hide-sm">Dated</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/contracts/${c.id}`)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ClientMark name={c.client_name || '?'} color={colorFor(c.client_id)} size={28} />
                          <span style={{ fontWeight: 500 }}>{c.client_name || 'No client linked'}</span>
                        </div>
                      </td>
                      <td>{c.service || '—'}</td>
                      <td className="r num" style={{ fontWeight: 500 }}>{c.value ? formatMoney(c.value, currency) : '—'}</td>
                      <td className="hide-sm muted">{formatDate(c.date || c.created_at)}</td>
                      <td><Pill status={c.signed ? 'signed' : 'unsigned'} label={signedLabel(c)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                {!loaded && 'Loading…'}
                {loaded && contracts.length === 0 && (
                  <><b>No contracts yet.</b> Once a proposal is approved, create a contract from your standard clauses and track when it’s signed.
                    <div style={{ marginTop: 14 }}><button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />New contract</button></div></>
                )}
                {loaded && contracts.length > 0 && (filter === 'signed' ? 'No signed contracts yet.' : 'Every contract is signed.')}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New contract"
        footer={
          <>
            <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn bp" type="submit" form="contract-create" disabled={savingCreate}>{savingCreate ? 'Creating…' : 'Create and open'}</button>
          </>
        }
      >
        <form id="contract-create" onSubmit={handleCreate}>
          {createError && <div className="form-error">{createError}</div>}
          <Field id="ctc-client" label="Client">
            <select id="ctc-client" className="fi fsel" value={createForm.client_id} onChange={pickClient(setCreateForm, false)}>
              <option value="">No client linked</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="fi-row">
            <Field id="ctc-service" label="Project"><input id="ctc-service" className="fi" value={createForm.service} onChange={(e) => setCreateForm({ ...createForm, service: e.target.value })} placeholder="Brand identity revamp for …" required autoFocus /></Field>
            <Field id="ctc-value" label="Project value"><input id="ctc-value" className="fi" inputMode="decimal" value={createForm.value} onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })} placeholder="4500" /></Field>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>It starts from your <Link to="/contracts/template" onClick={() => setCreateOpen(false)}>contract template</Link>. You can adjust anything in the editor.</p>
        </form>
      </Modal>
    </>
  );
}
