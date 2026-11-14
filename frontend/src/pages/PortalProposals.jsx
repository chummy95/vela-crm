import React, { useEffect, useMemo, useState } from 'react';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import { ProposalDocument } from '../components/Documents';
import PdfDocumentView from '../components/PdfDocumentView';
import { proposalsAPI } from '../utils/api';
import { formatDate, formatMoney } from '../utils/format';

export default function PortalProposals() {
  const brand = useStudioProfile();
  const navigate = useNavigate();
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const [proposals, setProposals] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Drafts stay private to the studio until they're sent.
    proposalsAPI.list().then((rows) => setProposals(rows.filter((p) => (p.status || 'draft') !== 'draft'))).catch((err) => setError(err.message)).finally(() => setLoaded(true));
  }, []);

  const selected = useMemo(() => proposals.find((p) => p.id === routeId) || null, [proposals, routeId]);

  if (routeId) {
    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/portal/proposals"><Icon name="back" size={16} />Proposals</Link></nav>
          {selected && <div className="tb-r"><button className="btn bg" type="button" onClick={() => navigate('/portal/messages')}><Icon name="message" />Ask a question</button></div>}
        </div>
        <div className="content">
          <div className="page" style={{ maxWidth: 820 }}>
            {selected && (selected.files || [])[0] && (
              <header style={{ marginBottom: 18 }}>
                <div className="muted" style={{ fontSize: 13.5 }}>{brand?.business_name ? `From ${brand.business_name}` : 'Proposal'}{selected.sent_at ? `, ${formatDate(selected.sent_at, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</div>
                <h1 className="h-display" style={{ fontSize: 30 }}>{selected.service || 'Your proposal'}</h1>
                {selected.note && <p className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap', maxWidth: '62ch' }}>{selected.note}</p>}
              </header>
            )}
            {selected
              ? ((selected.files || [])[0]
                ? <PdfDocumentView proposalId={selected.id} file={selected.files[0]} />
                : <ProposalDocument proposal={selected} brand={brand} />)
              : <div className="panel empty" style={{ padding: 40 }}>{loaded ? 'This proposal isn’t available.' : 'Loading…'}</div>}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Proposals</h1></div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          <div className="panel tbl-wrap">
            {proposals.length ? (
              <table className="tbl">
                <thead><tr><th>Proposal</th><th className="r">Investment</th><th className="hide-sm">Date</th><th>Status</th></tr></thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.id} onClick={() => navigate(`/portal/proposals/${p.id}`)}>
                      <td style={{ fontWeight: 500 }}>{p.service || 'Proposal'}</td>
                      <td className="r num">{p.value ? formatMoney(p.value) : '—'}</td>
                      <td className="hide-sm muted">{formatDate(p.date || p.created_at)}</td>
                      <td><Pill status={p.status || 'draft'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'No proposals shared yet.' : 'Loading…'}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
