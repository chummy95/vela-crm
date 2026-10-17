import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import ClientMark from '../components/ClientMark';
import ClientForm, { blankClient } from '../components/ClientForm';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI, invoicesAPI, projectsAPI } from '../utils/api';
import { formatMoney, isOverdue, parseAmount } from '../utils/format';

export default function Clients() {
  const { user } = useAuth();
  const currency = user?.currency || 'GBP';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [pageError, setPageError] = useState('');
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');
  const [createForm, setCreateForm] = useState(blankClient());
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([clientsAPI.list(), projectsAPI.list(), invoicesAPI.list()])
      .then(([clientRows, projectRows, invoiceRows]) => {
        setClients(clientRows);
        setProjects(projectRows);
        setInvoices(invoiceRows);
      })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  function openCreate() {
    setCreateError('');
    setCreateForm(blankClient());
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    if (searchParams.get('new')) setSearchParams({}, { replace: true });
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setCreateError('');
    try {
      const created = await clientsAPI.create(createForm);
      navigate(`/clients/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !q || [c.name, c.contact, c.email, c.location, c.industry].some((v) => String(v || '').toLowerCase().includes(q)))
      .map((c) => {
        const mine = invoices.filter((i) => i.client_id === c.id && i.status !== 'paid');
        return {
          ...c,
          active: projects.filter((p) => p.client_id === c.id && p.status === 'active').length,
          outstanding: mine.reduce((s, i) => s + parseAmount(i.amount), 0),
          overdue: mine.some(isOverdue),
        };
      })
      .sort((a, b) => (b.active - a.active) || String(a.name).localeCompare(String(b.name)));
  }, [clients, projects, invoices, query]);

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Clients</h1>
        <div className="tb-r">
          {clients.length > 0 && (
            <div className="search">
              <Icon name="search" />
              <input className="fi" type="search" placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search clients" />
            </div>
          )}
          <button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />Add client</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {pageError && <div className="form-error">{pageError}</div>}
          <div className="panel tbl-wrap">
            {rows.length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th className="hide-sm">Main contact</th>
                    <th className="hide-sm">Location</th>
                    <th className="r">Active projects</th>
                    <th className="r">Unpaid</th>
                    <th className="hide-sm">Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <ClientMark name={c.name} color={c.color} size={36} />
                          <div style={{ minWidth: 0 }}>
                            <a
                              href={`/clients/${c.id}`}
                              onClick={(e) => { e.preventDefault(); navigate(`/clients/${c.id}`); }}
                              className="serif"
                              style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}
                            >
                              {c.name}
                            </a>
                            <div className="muted" style={{ fontSize: 12.5 }}>{c.industry || 'No industry set'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hide-sm">
                        <div>{c.contact || <span className="faint">Not added</span>}</div>
                        {c.email && <div className="muted" style={{ fontSize: 12.5 }}>{c.email}</div>}
                      </td>
                      <td className="hide-sm">{c.location || <span className="faint">—</span>}</td>
                      <td className="r num">{c.active || <span className="faint">0</span>}</td>
                      <td className="r num">
                        {c.outstanding
                          ? <span style={{ color: c.overdue ? 'var(--err)' : 'var(--ink)' }}>{formatMoney(c.outstanding, currency)}</span>
                          : <span className="faint">—</span>}
                      </td>
                      <td className="hide-sm">
                        {c.portal_user_id ? <span className="pill" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>Has access</span> : <span className="faint">Not invited</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                {!loaded && 'Loading…'}
                {loaded && clients.length === 0 && (
                  <>
                    <b>Your client list is empty.</b> Add your first client to start projects, send proposals and give them a portal login.
                    <div style={{ marginTop: 14 }}><button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />Add client</button></div>
                  </>
                )}
                {loaded && clients.length > 0 && <>No clients match “{query}”.</>}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Add client"
        footer={
          <>
            <button className="btn bg" type="button" onClick={closeCreate}>Cancel</button>
            <button className="btn bp" type="submit" form="client-create" disabled={saving}>{saving ? 'Adding…' : 'Add client'}</button>
          </>
        }
      >
        <ClientForm id="client-create" value={createForm} onChange={setCreateForm} onSubmit={handleCreate} error={createError} />
      </Modal>
    </>
  );
}
