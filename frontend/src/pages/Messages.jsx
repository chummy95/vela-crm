import React, { useEffect, useState } from 'react';
import { clientsAPI, messagesAPI } from '../utils/api';

export default function Messages() {
  const [threads, setThreads] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([messagesAPI.list(), clientsAPI.list()])
      .then(([threadRows, clientRows]) => {
        setThreads(threadRows);
        setClients(clientRows);
        setSelectedClientId(threadRows[0]?.client_id || clientRows[0]?.id || '');
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    messagesAPI.thread(selectedClientId).then(setMessages).catch((err) => setError(err.message));
  }, [selectedClientId]);

  async function send() {
    if (!selectedClientId || !draft.trim()) return;
    try {
      const sent = await messagesAPI.send(selectedClientId, draft.trim());
      setMessages((prev) => [...prev, sent]);
      if (!threads.find((thread) => thread.client_id === selectedClientId)) {
        const client = clients.find((item) => item.id === selectedClientId);
        setThreads((prev) => [...prev, { client_id: selectedClientId, client_name: client?.name, color: client?.color }]);
      }
      setDraft('');
    } catch (err) {
      setError(err.message);
    }
  }

  const visibleThreads = threads.length ? threads : clients.map((client) => ({ client_id: client.id, client_name: client.name, color: client.color }));

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Messages</div>
      </div>
      <div className="content" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
        <div className="card">
          <div className="card-h"><div className="card-title">Clients</div></div>
          <div style={{ padding: 10 }}>
            {visibleThreads.map((thread) => (
              <button
                key={thread.client_id}
                className="btn bg"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  marginBottom: 8,
                  borderColor: selectedClientId === thread.client_id ? 'var(--navy)' : 'var(--border)',
                }}
                onClick={() => setSelectedClientId(thread.client_id)}
              >
                {thread.client_name || 'Unknown client'}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-h"><div className="card-title">Conversation</div></div>
          <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
            {error && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{error}</div>}
            {messages.map((message) => (
              <div key={message.id} style={{ marginBottom: 10, textAlign: message.outbound ? 'right' : 'left' }}>
                <div style={{ display: 'inline-block', background: message.outbound ? 'var(--navy)' : 'var(--navy-pale)', color: message.outbound ? '#fff' : 'var(--text)', padding: '10px 12px', borderRadius: 10, maxWidth: '70%' }}>
                  {message.text}
                </div>
              </div>
            ))}
            {!messages.length && <div style={{ color: 'var(--text-s)' }}>Select a client to start messaging.</div>}
          </div>
          <div style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
            <input className="fi" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message..." />
            <button className="btn bp" onClick={send}>Send</button>
          </div>
        </div>
      </div>
    </>
  );
}
