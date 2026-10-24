import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import InvoiceDocument from '../components/InvoiceDocument';
import { invoicesAPI, paymentsAPI, projectsAPI, studioProfileAPI } from '../utils/api';
import { formatDate, formatMoney, isOverdue, relativeDay } from '../utils/format';
import { DEFAULT_STUDIO_PROFILE, money, toNumber } from '../utils/invoices';
import { buildInvoicePdf, invoiceFileName } from '../utils/invoicePdf';
import PdfPreview from '../components/PdfPreview';

export default function PortalInvoices() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState(DEFAULT_STUDIO_PROFILE);
  const [stripe, setStripe] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    Promise.all([invoicesAPI.list(), projectsAPI.list(), studioProfileAPI.get().catch(() => DEFAULT_STUDIO_PROFILE)])
      .then(([rows, projectRows, profileRow]) => { setInvoices(rows); setProjects(projectRows); setProfile(profileRow); })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
    paymentsAPI.status().then((s) => setStripe(Boolean(s.stripe)));
  }, []);

  const selected = useMemo(() => invoices.find((i) => i.id === routeId) || null, [invoices, routeId]);

  // Back from Stripe: confirm the payment went through.
  const search = new URLSearchParams(location.search);
  const returned = search.get('paid') === '1';
  const sessionId = search.get('session_id') || '';
  useEffect(() => {
    if (!returned || !routeId) return;
    paymentsAPI.check([routeId], sessionId).then((paid) => setJustPaid(Boolean(paid[routeId]))).catch(() => {});
  }, [returned, routeId, sessionId]);

  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const rows = [...invoices].sort((a, b) => (a.status === 'paid') - (b.status === 'paid') || String(a.due_date).localeCompare(String(b.due_date)));
  const currency = invoices[0]?.currency || profile.currency || 'GBP';

  async function payByCard() {
    setPaying(true);
    setError('');
    try {
      const url = await paymentsAPI.checkout(selected.id);
      window.location.assign(url);
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  if (routeId) {
    if (!selected) {
      return (
        <>
          <div className="topbar"><nav className="tb-crumb"><Link to="/portal/invoices"><Icon name="back" size={16} />Invoices</Link></nav></div>
          <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? <>This invoice isn’t available. <Link to="/portal/invoices">See your invoices</Link></> : 'Loading…'}</div></div>
        </>
      );
    }
    const paid = selected.status === 'paid' || justPaid;
    const overdue = !paid && isOverdue(selected);
    const linked = projects.find((p) => p.id === selected.project_id);
    const cardPay = stripe && profile.card_payments;
    const payLink = selected.payment_link || profile.payment_link;
    const total = money(selected.amount, selected.currency || currency);
    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/portal/invoices"><Icon name="back" size={16} />Invoices</Link></nav>
          <div className="tb-r">
            <button className="btn bg" type="button" onClick={() => setPreviewOpen(true)}><Icon name="proposal" />View PDF</button>
          </div>
        </div>
        <div className="content">
          <div className="page">
            {error && <div className="form-error">{error}</div>}
            <header className="review-head" style={{ marginBottom: 22 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="muted" style={{ fontSize: 13.5 }}>{selected.number || 'Invoice'}{linked ? `, ${linked.service}` : ''}</div>
                <h1 className="h-display">{total}</h1>
                <div className="muted" style={{ fontSize: 13.5, marginTop: 4, color: overdue ? 'var(--err)' : undefined }}>
                  {paid ? 'Paid, thank you.' : selected.due_date ? `Due ${formatDate(selected.due_date, { day: 'numeric', month: 'long', year: 'numeric' })}${overdue ? ', overdue' : ''}` : 'Due on receipt'}
                </div>
              </div>
              <Pill status={paid ? 'paid' : overdue ? 'overdue' : selected.status} />
            </header>

            {justPaid && selected.status !== 'paid' && (
              <div className="decision approved" style={{ marginBottom: 20 }}>
                <div className="row-title" style={{ color: 'var(--ok)' }}><Icon name="check" size={16} /> Payment received. Thank you!</div>
                <div className="muted" style={{ fontSize: 13.5 }}>Your receipt is on its way by email.</div>
              </div>
            )}

            {!paid && (cardPay || payLink) && (
              <div className="pay-bar">
                <div>
                  <div className="row-title">Pay {total}</div>
                  <div className="row-sub">{cardPay ? 'Secure card payment with Stripe. Apple Pay and Google Pay work too.' : 'You’ll go to a secure payment page.'}</div>
                </div>
                {cardPay
                  ? <button className="btn bp" type="button" disabled={paying} onClick={payByCard}>{paying ? 'Opening Stripe…' : `Pay ${total}`}</button>
                  : <a className="btn bp" href={payLink} target="_blank" rel="noreferrer">Pay now</a>}
              </div>
            )}

            <InvoiceDocument invoice={paid && selected.status !== 'paid' ? { ...selected, status: 'paid', paid_at: new Date().toISOString() } : selected} profile={profile} />
            <PdfPreview
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
              title={selected.number ? `Invoice ${selected.number}` : 'Invoice'}
              build={() => buildInvoicePdf(paid && selected.status !== 'paid' ? { ...selected, status: 'paid', paid_at: new Date().toISOString() } : selected, profile)}
              fileName={invoiceFileName(selected, profile)}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Invoices</h1></div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          <div className="figures" style={{ marginBottom: 24 }}>
            <div className="figure"><div className="figure-val">{formatMoney(unpaid.reduce((s, i) => s + toNumber(i.amount), 0), currency)}</div><div className="figure-label">To pay</div></div>
            <div className="figure"><div className="figure-val">{formatMoney(invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + toNumber(i.amount), 0), currency)}</div><div className="figure-label">Paid so far</div></div>
          </div>
          <div className="panel tbl-wrap">
            {rows.length ? (
              <table className="tbl">
                <thead><tr><th>Invoice</th><th className="hide-sm">For</th><th className="r">Total</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((inv) => {
                    const overdue = isOverdue(inv);
                    return (
                      <tr key={inv.id} onClick={() => navigate(`/portal/invoices/${inv.id}`)}>
                        <td style={{ fontWeight: 500 }}>{inv.number || 'Invoice'}</td>
                        <td className="hide-sm muted">{inv.description || '—'}</td>
                        <td className="r num" style={{ fontWeight: 500 }}>{money(inv.amount, inv.currency || currency)}</td>
                        <td style={{ color: overdue ? 'var(--err)' : 'var(--text-2)' }}>{inv.due_date ? (inv.status === 'paid' ? formatDate(inv.due_date) : relativeDay(inv.due_date)) : '—'}</td>
                        <td><Pill status={overdue ? 'overdue' : inv.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'No invoices yet.' : 'Loading…'}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
