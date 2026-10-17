import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { messagesAPI } from '../utils/api';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function PortalMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    messagesAPI.thread(user?.client_id).then(setMessages).catch((err) => setError(err.message)).finally(() => setLoaded(true));
  }, [user?.client_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function handleSend(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const sent = await messagesAPI.send(user?.client_id, draft.trim());
      setMessages((current) => [...current, sent]);
      setDraft('');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend(event);
    }
  }

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Messages</h1></div>
      <div className="content chat-content">
        {error && <div className="form-error">{error}</div>}
        <section className="panel chat-thread" style={{ flex: 1, minHeight: 480, maxWidth: 860, width: '100%' }} aria-label="Conversation with the studio">
          <header className="card-h">
            <div>
              <div className="card-title">The studio</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Questions, feedback and updates about your project</div>
            </div>
          </header>
          <div className="chat-scroll">
            {loaded && !messages.length && <div className="empty">No messages yet. Say hello, or ask anything about your project.</div>}
            {messages.map((m) => {
              const mine = !m.outbound;
              return (
                <div key={m.id} className={`bubble-row${mine ? ' out' : ''}`}>
                  <div className="bubble">
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                    <div className="bubble-time">{mine ? 'You' : 'Studio'}, {formatTime(m.sent_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form onSubmit={handleSend} className="chat-compose">
            <label className="sr-only" htmlFor="portal-draft">Message</label>
            <textarea id="portal-draft" className="fi" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} placeholder="Write a message" disabled={sending} style={{ minHeight: 44, resize: 'none' }} />
            <button className="btn bp" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</button>
          </form>
        </section>
      </div>
    </>
  );
}
