import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { invoicesAPI, paymentsAPI, questionnairesAPI, reviewsAPI } from '../utils/api';
import { money } from '../utils/invoices';

const AlertsContext = createContext({ responses: [], unseen: [], reviews: [], reviewUnseen: [], loaded: false });

export function reviewNeedsLook(r) {
  return Boolean(r.client_activity_at) && (!r.studio_seen_at || r.client_activity_at > r.studio_seen_at);
}

export function reviewActivityText(r) {
  const who = r.contact_name || r.client_name;
  const decided = r.decided_at && r.decided_at === r.client_activity_at;
  if (decided && r.status === 'approved') return `${who} approved ${r.title.toLowerCase()}`;
  if (decided && r.status === 'changes_requested') return `${who} asked for changes to ${r.title.toLowerCase()}`;
  return `${who} commented on ${r.title.toLowerCase()}`;
}

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

// Watches questionnaire responses live. When a client submits one while Vela is open,
// it shows a pop-up (and a desktop notification if allowed), and keeps a count for the menu.
export function QuestionnaireAlertsProvider({ children }) {
  const [responses, setResponses] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState([]);
  const known = useRef(null);
  const knownReviews = useRef(null);

  // Card payments made through Stripe: mark those invoices paid (this also unlocks final files).
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const { stripe } = await paymentsAPI.status();
        if (!stripe || cancelled) return;
        const unpaid = (await invoicesAPI.list()).filter((i) => i.status !== 'paid');
        if (!unpaid.length) return;
        const paid = await paymentsAPI.check(unpaid.map((i) => i.id));
        for (const inv of unpaid) {
          const hit = paid[inv.id];
          if (!hit || cancelled) continue;
          const changes = { status: 'paid', paid_at: hit.paid_at, payment_method: 'Stripe', payment_ref: hit.payment_ref || '' };
          await invoicesAPI.updateStatus(inv.id, 'paid', changes);
          window.dispatchEvent(new CustomEvent('vela:invoice-paid', { detail: { id: inv.id, changes } }));
          setToasts((current) => [...current, { key: `pay:${inv.id}`, payment: { ...inv, ...changes } }].slice(-3));
        }
      } catch {
        // Try again on the next check.
      }
    }
    sync();
    const timer = setInterval(sync, 3 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const stop = reviewsAPI.subscribe((rows) => {
      const active = rows.filter(reviewNeedsLook);
      if (knownReviews.current) {
        const fresh = active.filter((r) => !knownReviews.current.has(`${r.id}:${r.client_activity_at}`));
        if (fresh.length) {
          setToasts((current) => [...current, ...fresh.map((r) => ({ key: `rv:${r.id}:${r.client_activity_at}`, review: r }))].slice(-3));
          fresh.forEach((r) => {
            if (canNotify() && Notification.permission === 'granted') {
              try {
                const n = new Notification(reviewActivityText(r), { body: `${r.client_name}${r.stage_label ? `, ${r.stage_label}` : ''}`, tag: `rv-${r.id}` });
                n.onclick = () => { window.focus(); window.location.assign(`/reviews/${r.id}`); };
              } catch {
                // The in-page pop-up still shows.
              }
            }
          });
        }
      }
      knownReviews.current = new Set(active.map((r) => `${r.id}:${r.client_activity_at}`));
      setReviews(rows);
    }, () => {});
    return stop;
  }, []);

  useEffect(() => {
    const stop = questionnairesAPI.subscribeResponses(
      (rows) => {
        const submitted = rows.filter((r) => r.status === 'submitted' && !r.seen_by_studio);
        if (known.current) {
          const fresh = submitted.filter((r) => !known.current.has(`${r.id}:${r.submitted_at}`));
          if (fresh.length) {
            setToasts((current) => [...current, ...fresh.map((r) => ({ key: `${r.id}:${r.submitted_at}`, response: r }))].slice(-3));
            fresh.forEach((r) => {
              if (canNotify() && Notification.permission === 'granted') {
                try {
                  const n = new Notification(`${r.contact_name || r.client_name} submitted a questionnaire`, {
                    body: `${r.title} for ${r.client_name}`,
                    tag: r.id,
                  });
                  n.onclick = () => { window.focus(); window.location.assign(`/questionnaires/responses/${r.id}`); };
                } catch {
                  // Some browsers only allow notifications from a service worker; the in-page pop-up still shows.
                }
              }
            });
          }
        }
        known.current = new Set(submitted.map((r) => `${r.id}:${r.submitted_at}`));
        setResponses(rows);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return stop;
  }, []);

  const unseen = useMemo(() => responses.filter((r) => r.status === 'submitted' && !r.seen_by_studio), [responses]);
  const reviewUnseen = useMemo(() => reviews.filter(reviewNeedsLook), [reviews]);
  const total = unseen.length + reviewUnseen.length;

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = total ? `(${total}) ${base}` : base;
  }, [total]);

  function dismiss(key) {
    setToasts((current) => current.filter((t) => t.key !== key));
  }

  return (
    <AlertsContext.Provider value={{ responses, unseen, reviews, reviewUnseen, loaded }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(({ key, response: r, review, payment }) => (
          <div key={key} className="toast" role="status">
            <span className="toast-ico"><Icon name={payment ? 'receipt' : review ? (review.status === 'approved' ? 'check' : 'message') : 'bell'} size={18} /></span>
            {payment ? (
              <div style={{ minWidth: 0 }}>
                <div className="row-title">{payment.client_name} paid {money(payment.amount, payment.currency || 'GBP')}</div>
                <div className="row-sub">{payment.number || 'Invoice'}, by card through Stripe</div>
                <Link to={`/invoices/${payment.id}`} onClick={() => dismiss(key)} style={{ fontSize: 13, fontWeight: 500 }}>Open</Link>
              </div>
            ) : review ? (
              <div style={{ minWidth: 0 }}>
                <div className="row-title">{reviewActivityText(review)}</div>
                <div className="row-sub">{review.client_name}{review.stage_label ? `, ${review.stage_label}` : ''}</div>
                <Link to={`/reviews/${review.id}`} onClick={() => dismiss(key)} style={{ fontSize: 13, fontWeight: 500 }}>Open</Link>
              </div>
            ) : (
              <div style={{ minWidth: 0 }}>
                <div className="row-title">{r.contact_name || r.client_name} submitted their questionnaire</div>
                <div className="row-sub">{r.title}</div>
                <Link to={`/questionnaires/responses/${r.id}`} onClick={() => dismiss(key)} style={{ fontSize: 13, fontWeight: 500 }}>Read answers</Link>
              </div>
            )}
            <button type="button" className="mc" aria-label="Dismiss" onClick={() => dismiss(key)}><Icon name="close" size={16} /></button>
          </div>
        ))}
      </div>
    </AlertsContext.Provider>
  );
}

export function useQuestionnaireAlerts() {
  return useContext(AlertsContext);
}

export function desktopAlertsState() {
  if (!canNotify()) return 'unsupported';
  return Notification.permission;
}

export async function enableDesktopAlerts() {
  if (!canNotify()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}
