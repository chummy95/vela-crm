import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import ClauseEditor from '../components/ClauseEditor';
import { ContractDocument } from '../components/Documents';
import { studioProfileAPI } from '../utils/api';
import { DESIGN_CONTRACT_TEMPLATE } from '../utils/contractTemplate';

const SAMPLE = {
  client_name: 'Fawzy Hotel', client_contact: 'Client name', client_email: 'client@example.com', client_address: 'Ibadan, Nigeria',
  service: 'Brand identity revamp for Fawzy Hotel', value: '700',
  date: new Date().toISOString().slice(0, 10),
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10),
};

// The studio's standard contract: every new contract starts from it.
export default function ContractTemplate() {
  const [profile, setProfile] = useState(null);
  const [clauses, setClauses] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    studioProfileAPI.get(undefined, { fresh: true })
      .then((p) => {
        setProfile(p);
        setClauses(Array.isArray(p.contract_clauses) && p.contract_clauses.length ? p.contract_clauses : DESIGN_CONTRACT_TEMPLATE);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const updated = await studioProfileAPI.save({ contract_clauses: clauses });
      setProfile(updated);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    setClauses(DESIGN_CONTRACT_TEMPLATE);
    setDirty(true);
    setSaved(false);
    setConfirmReset(false);
  }

  const missingDetails = profile && (!profile.address || !profile.phone || !profile.legal_name);

  return (
    <>
      <div className="topbar">
        <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/contracts"><Icon name="back" size={16} />Contracts</Link></nav>
        <div className="tb-r">
          <span className="faint" style={{ fontSize: 12.5 }}>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : saved ? 'Saved' : ''}</span>
          {confirmReset && <button className="btn bq" type="button" onClick={() => setConfirmReset(false)}>Keep mine</button>}
          <button className="btn bq" type="button" onClick={reset}>{confirmReset ? 'Yes, start again from the standard template' : 'Restore standard template'}</button>
          <button className="btn bp" type="button" disabled={saving || !dirty} onClick={save}>Save template</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          {missingDetails && (
            <div className="locked-note" style={{ marginBottom: 16 }}>
              <Icon name="contract" size={16} />
              <span>Your name, address and phone fill in the Parties section. Add any that are missing in <Link to="/settings">Settings</Link>.</span>
            </div>
          )}
          <div className="editor-split">
            <section className="panel" style={{ padding: 22 }} aria-labelledby="tpl-h">
              <h1 id="tpl-h" className="h-section">Contract template</h1>
              <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 16px' }}>
                Every new contract starts from this. Changes here don’t affect contracts you’ve already created.
              </p>
              {profile
                ? <ClauseEditor clauses={clauses} onChange={(next) => { setClauses(next); setDirty(true); setSaved(false); }} />
                : <p className="muted">Loading…</p>}
            </section>
            {profile && <ContractDocument contract={{ ...SAMPLE, clauses }} brand={profile} />}
          </div>
        </div>
      </div>
    </>
  );
}
