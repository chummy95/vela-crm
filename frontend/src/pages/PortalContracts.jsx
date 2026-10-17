import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import { ContractDocument } from '../components/Documents';
import { contractsAPI } from '../utils/api';
import { formatDate, formatMoney } from '../utils/format';

export default function PortalContracts() {
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

  if (routeId) {
    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/portal/contracts"><Icon name="back" size={16} />Contracts</Link></nav>
          {selected && <div className="tb-r"><Pill status={selected.signed ? 'signed' : 'unsigned'} label={selected.signed ? 'Signed' : 'Awaiting signature'} /></div>}
        </div>
        <div className="content">
          <div className="page" style={{ maxWidth: 820 }}>
            {selected ? <ContractDocument contract={selected} /> : <div className="panel empty" style={{ padding: 40 }}>{loaded ? 'This contract isn’t available.' : 'Loading…'}</div>}
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
                      <td><Pill status={c.signed ? 'signed' : 'unsigned'} label={c.signed ? 'Signed' : 'Awaiting signature'} /></td>
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
