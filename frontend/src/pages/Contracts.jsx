import React, { useEffect, useMemo, useState } from 'react';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import { ContractDocument } from '../components/Documents';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, contractsAPI } from '../utils/api';
import { DEFAULT_CLAUSES } from '../utils/constants';
import { formatDate, formatMoney } from '../utils/format';

const FILTERS = [
  { key: 'unsigned', label: 'Awaiting signature' },
  { key: 'signed', label: 'Signed' },
  { key: 'all', label: 'All' },
];

function blankContract(client) {
  return {
    client_id: client?.id || '', client_name: client?.name || '', client_email: client?.email || '', client_address: '',
    service: '', value: '', start_date: '', duration: '', date: new Date().toISOString().slice(0, 10), clauses: DEFAULT_CLAUSES,
  };
}

function contractToForm(c) {
  return {
    client_id: c.client_id || '', client_name: c.client_name || '', client_email: c.client_email || '', client_address: c.client_address || '',
    service: c.service || '', value: c.value || '', start_date: c.start_date || '', duration: c.duration || '', date: c.date || '',
    clauses: Array.isArray(c.clauses) && c.clauses.length ? c.clauses : DEFAULT_CLAUSES, signed: Boolean(c.signed),
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([contractsAPI.list(), clientsAPI.list()])
      .then(([rows, clientRows]) => { setContracts(rows); setClients(clientRows); })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const selected = useMemo(() => contracts.find((c) => c.id === routeId) || null, [contracts, routeId]);

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

  function editClause(index, body) {
    setForm((f) => ({ ...f, clauses: f.clauses.map((c, i) => (i === index ? { ...c, body } : c)) }));
    setDirty(true);
  }

  function pickClient(setter, markDirty) {
    return (e) => {
      const client = clients.find((c) => c.id === e.target.value);
      setter((f) => ({ ...f, client_id: e.target.value, client_name: client?.name || '', client_email: client?.email || f.client_email }));
      if (markDirty) setDirty(true);
    };
  }

  function openCreate() {
    setCreateForm(blankContract(clients[0]));
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
                <button className="btn bg" type="button" disabled={saving} onClick={markSigned}><Icon name="check" />{confirmSign ? 'Confirm: client has signed' : 'Mark as signed'}</button>
              </>
            )}
            <button className="btn bp" type="button" disabled={saving || !dirty || signed} onClick={save}>Save</button>
          </div>
        </div>
        <div className="content">
          <div className="page">
            {detailError && <div className="form-error">{detailError}</div>}
            {signed && <div className="notice ok" style={{ marginBottom: 16 }}>This contract is signed, so it’s now read-only.</div>}
            <div className="editor-split">
              <form className="panel" style={{ padding: 22 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
                <fieldset disabled={signed} style={{ border: 'none', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h1 className="h-section">Contract details</h1>
                    <Pill status={signed ? 'signed' : 'unsigned'} label={signed ? 'Signed' : 'Awaiting signature'} />
                  </div>
                  <Field id="ct-client" label="Client">
                    <select id="ct-client" className="fi fsel" value={form.client_id} onChange={pickClient(setForm, true)}>
                      <option value="">No client linked</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <div className="fi-row">
                    <Field id="ct-email" label="Client email"><input id="ct-email" className="fi" type="email" value={form.client_email} onChange={edit('client_email')} /></Field>
                    <Field id="ct-addr" label="Client address"><input id="ct-addr" className="fi" value={form.client_address} onChange={edit('client_address')} /></Field>
                  </div>
                  <div className="fi-row">
                    <Field id="ct-service" label="Service"><input id="ct-service" className="fi" value={form.service} onChange={edit('service')} required /></Field>
                    <Field id="ct-value" label="Project value"><input id="ct-value" className="fi" inputMode="decimal" value={form.value} onChange={edit('value')} /></Field>
                  </div>
                  <div className="fi-row">
                    <Field id="ct-start" label="Start date"><input id="ct-start" className="fi" type="date" value={form.start_date} onChange={edit('start_date')} /></Field>
                    <Field id="ct-dur" label="Duration"><input id="ct-dur" className="fi" value={form.duration} onChange={edit('duration')} placeholder="8 weeks" /></Field>
                  </div>
                  <Field id="ct-date" label="Contract date"><input id="ct-date" className="fi" type="date" value={form.date} onChange={edit('date')} /></Field>

                  <h2 className="card-title" style={{ margin: '22px 0 4px' }}>Clauses</h2>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>The service and value you enter above fill in automatically.</p>
                  {form.clauses.map((clause, index) => (
                    <Field key={clause.id || index} id={`clause-${index}`} label={`${index + 1}. ${clause.title}`}>
                      <textarea id={`clause-${index}`} className="fi" value={clause.body} onChange={(e) => editClause(index, e.target.value)} />
                    </Field>
                  ))}
                </fieldset>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn bd" type="button" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : confirmDelete ? 'Yes, delete contract' : 'Delete contract'}
                  </button>
                  {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button>}
                </div>
              </form>

              <ContractDocument contract={form} studioName={user?.studio_name} currency={currency} brand={brand} />
            </div>
          </div>
        </div>
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
                      <td><Pill status={c.signed ? 'signed' : 'unsigned'} label={c.signed ? 'Signed' : 'Awaiting signature'} /></td>
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
            <Field id="ctc-service" label="Service"><input id="ctc-service" className="fi" value={createForm.service} onChange={(e) => setCreateForm({ ...createForm, service: e.target.value })} placeholder="Brand Identity" required autoFocus /></Field>
            <Field id="ctc-value" label="Project value"><input id="ctc-value" className="fi" inputMode="decimal" value={createForm.value} onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })} placeholder="4500" /></Field>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>It starts with your standard clauses. You can adjust them in the editor.</p>
        </form>
      </Modal>
    </>
  );
}
