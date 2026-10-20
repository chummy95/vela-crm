import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { questionnairesAPI } from '../utils/api';

const AlertsContext = createContext({ responses: [], unseen: [], loaded: false });

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

// Watches questionnaire responses live. When a client submits one while Vela is open,
// it shows a pop-up (and a desktop notification if allowed), and keeps a count for the menu.
export function QuestionnaireAlertsProvider({ children }) {
  const [responses, setResponses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState([]);
  const known = useRef(null);

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

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = unseen.length ? `(${unseen.length}) ${base}` : base;
  }, [unseen.length]);

  function dismiss(key) {
    setToasts((current) => current.filter((t) => t.key !== key));
  }

  return (
    <AlertsContext.Provider value={{ responses, unseen, loaded }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(({ key, response: r }) => (
          <div key={key} className="toast" role="status">
            <span className="toast-ico"><Icon name="bell" size={18} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="row-title">{r.contact_name || r.client_name} submitted their questionnaire</div>
              <div className="row-sub">{r.title}</div>
              <Link to={`/questionnaires/responses/${r.id}`} onClick={() => dismiss(key)} style={{ fontSize: 13, fontWeight: 500 }}>Read answers</Link>
            </div>
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
