import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { messagesAPI } from '../utils/api';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PortalMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    messagesAPI.thread(user?.client_id).then(setMessages).catch((loadError) => setError(loadError.message));
  }, [user?.client_id]);

  async function handleSend(event) {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }

    try {
      setSending(true);
      const sent = await messagesAPI.send(user?.client_id, draft.trim());
      setMessages((current) => [...current, sent]);
      setDraft('');
      setError('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Messages</div>
      </div>
      <div className="content">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
          <div className="card-h">
            <div className="card-title">Studio Conversation</div>
            <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{user?.client_name || user?.name || 'Client account'}</div>
          </div>
          <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
            {error && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{error}</div>}
            {!messages.length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No messages yet. Send your first note to the studio below.</div>}
            {messages.map((message) => (
              <div key={message.id} style={{ marginBottom: 12, textAlign: message.outbound ? 'left' : 'right' }}>
                <div
                  style={{
                    display: 'inline-block',
                    background: message.outbound ? 'var(--navy-pale)' : 'var(--navy)',
                    color: message.outbound ? 'var(--text)' : '#fff',
                    padding: '10px 12px',
                    borderRadius: 10,
                    maxWidth: '78%',
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{message.text}</div>
                  <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.8 }}>{formatTime(message.sent_at)}</div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
            <input className="fi" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Send a note to the studio…" disabled={sending} />
            <button className="btn bp" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</button>
          </form>
        </div>
      </div>
    </>
  );
}
