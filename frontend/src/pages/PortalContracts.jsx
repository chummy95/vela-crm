import React, { useEffect, useMemo, useState } from 'react';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import { ContractDocument } from '../components/Documents';
import SignaturePad from '../components/SignaturePad';
import { useAuth } from '../hooks/useAuth';
import { contractsAPI } from '../utils/api';
import { formatDate, formatMoney } from '../utils/format';
import { AGREEMENT_TEXT, contractFingerprint, signedLabel } from '../utils/contracts';
import { downloadContractPdf } from '../utils/contractPdf';

// Accept and sign: agree to the terms, add your name and signature.
function SignPanel({ contract, onSigned }) {
  const { user } = useAuth();
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState('');
  const [signature, setSignature] = useState({ image: '', method: 'drawn' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ready = agree && name.trim().length > 1 && signature.image;

  async function sign(event) {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      const fingerprint = await contractFingerprint(contract);
      const updated = await contractsAPI.signAsClient(contract.id, { name, title, image: signature.image, method: signature.method, fingerprint, agreement: AGREEMENT_TEXT });
      onSigned(updated);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form id="sign" className="sign-panel" onSubmit={sign} aria-labelledby="sign-h">
      <h2 id="sign-h" className="h-section">Accept and sign</h2>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Read the agreement above. When you’re happy, confirm below and add your signature. You’ll be able to download a signed copy.</p>
      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
      <label className="sign-agree">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{AGREEMENT_TEXT.replace('this agreement', `this agreement with ${contract.client_name ? `${contract.client_name} as the Client` : 'me as the Client'}`)}</span>
      </label>
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor="sg-name">Full name</label>
          <input id="sg-name" className="fi" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor="sg-title">Role <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input id="sg-title" className="fi" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Founder" />
        </div>
      </div>
      <SignaturePad name={name} onChange={(image, method) => setSignature({ image, method: method || 'drawn' })} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
        <span className="faint" style={{ fontSize: 12.5 }}>{ready ? 'Ready to sign.' : !agree ? 'Tick the box to accept the terms.' : !signature.image ? 'Add your signature.' : 'Type your full name.'}</span>
        <button className="btn bp" type="submit" disabled={!ready || saving}>{saving ? 'Signing…' : 'Accept and sign'}</button>
      </div>
    </form>
  );
}

export default function PortalContracts() {
  const brand = useStudioProfile();
  const navigate = useNavigate();
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const [contracts, setContracts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    contractsAPI.list().then(setContracts).catch((err) => setError(err.message)).finally(() => setLoaded(true));
  }, []);

  const selected = useMemo(() => contracts.find((c) => c.id === routeId) || null, [contracts, routeId]);
  const [downloading, setDownloading] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  async function download() {
    setDownloading(true);
    try { await downloadContractPdf(selected, brand, brand.currency); } catch (err) { setError(err.message || 'Couldn’t create the PDF.'); } finally { setDownloading(false); }
  }

  if (routeId) {
    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/portal/contracts"><Icon name="back" size={16} />Contracts</Link></nav>
          {selected && (
            <div className="tb-r">
              <Pill status={selected.signed ? 'signed' : 'unsigned'} label={signedLabel(selected)} />
              <button className="btn bg" type="button" disabled={downloading} onClick={download}><Icon name="download" />{downloading ? 'Preparing…' : selected.signed ? 'Download signed copy' : 'Download PDF'}</button>
              {!selected.signed && <a className="btn bp" href="#sign" onClick={(e) => { e.preventDefault(); document.getElementById('sign')?.scrollIntoView({ behavior: 'smooth' }); }}>Review and sign</a>}
            </div>
          )}
        </div>
        <div className="content">
          <div className="page" style={{ maxWidth: 820 }}>
            {error && <div className="form-error">{error}</div>}
            {justSigned && (
              <div className="decision approved" style={{ marginBottom: 20 }}>
                <div className="row-title" style={{ color: 'var(--ok)' }}><Icon name="check" size={16} /> Signed. Thank you!</div>
                <div className="muted" style={{ fontSize: 13.5 }}>The studio has been told. You can download your signed copy any time.</div>
              </div>
            )}
            {selected ? <ContractDocument contract={selected} brand={brand} /> : <div className="panel empty" style={{ padding: 40 }}>{loaded ? 'This contract isn’t available.' : 'Loading…'}</div>}
            {selected && !selected.signed && (
              <SignPanel
                contract={selected}
                onSigned={(updated) => {
                  setContracts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
                  setJustSigned(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  document.querySelector('.content')?.scrollTo?.({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Contracts</h1></div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          <div className="panel tbl-wrap">
            {contracts.length ? (
              <table className="tbl">
                <thead><tr><th>Agreement</th><th className="r">Value</th><th className="hide-sm">Dated</th><th>Status</th></tr></thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/portal/contracts/${c.id}`)}>
                      <td style={{ fontWeight: 500 }}>{c.service || 'Contract'}</td>
                      <td className="r num">{c.value ? formatMoney(c.value) : '—'}</td>
                      <td className="hide-sm muted">{formatDate(c.date || c.created_at)}</td>
                      <td><Pill status={c.signed ? 'signed' : 'unsigned'} label={signedLabel(c)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'No contracts shared yet.' : 'Loading…'}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
