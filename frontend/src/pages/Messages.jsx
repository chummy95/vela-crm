import React, { useEffect, useMemo, useState } from 'react';
import { clientsAPI, invoicesAPI, messagesAPI, projectsAPI } from '../utils/api';
import Pill from '../components/Pill';

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

export default function Messages() {
  const [threads, setThreads] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    Promise.all([messagesAPI.list(), clientsAPI.list(), projectsAPI.list(), invoicesAPI.list()])
      .then(([threadRows, clientRows, projectRows, invoiceRows]) => {
        setThreads(threadRows);
        setClients(clientRows);
        setProjects(projectRows);
        setInvoices(invoiceRows);
        setSelectedClientId((current) => current || threadRows[0]?.client_id || clientRows[0]?.id || '');
        setError('');
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    messagesAPI
      .thread(selectedClientId)
      .then((messageRows) => {
        setMessages(messageRows);
        setError('');
      })
      .catch((threadError) => setError(threadError.message))
      .finally(() => setLoadingMessages(false));
  }, [selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const selectedProjects = useMemo(
    () => projects.filter((project) => project.client_id === selectedClientId),
    [projects, selectedClientId]
  );
  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.client_id === selectedClientId),
    [invoices, selectedClientId]
  );

  const visibleThreads = useMemo(() => {
    const latestByClient = new Map(threads.map((thread) => [thread.client_id, thread]));
    return clients
      .map((client) => {
        const thread = latestByClient.get(client.id);
        return {
          client_id: client.id,
          client_name: client.name,
          color: client.color || '#1B2B4B',
          latest_message: thread?.latest_message || '',
          latest_at: thread?.latest_at || '',
          active_projects: selectedClientId === client.id
            ? selectedProjects.filter((project) => project.status === 'active').length
            : projects.filter((project) => project.client_id === client.id && project.status === 'active').length,
          open_invoices: selectedClientId === client.id
            ? selectedInvoices.filter((invoice) => invoice.status !== 'paid').length
            : invoices.filter((invoice) => invoice.client_id === client.id && invoice.status !== 'paid').length,
        };
      })
      .sort((left, right) => {
        if (left.latest_at && right.latest_at) return new Date(right.latest_at).getTime() - new Date(left.latest_at).getTime();
        if (left.latest_at) return -1;
        if (right.latest_at) return 1;
        return left.client_name.localeCompare(right.client_name);
      });
  }, [clients, invoices, projects, selectedClientId, selectedInvoices, selectedProjects, threads]);

  async function send(event) {
    event.preventDefault();
    if (!selectedClientId || !draft.trim()) return;
    try {
      setSending(true);
      const sent = await messagesAPI.send(selectedClientId, draft.trim());
      const client = clients.find((item) => item.id === selectedClientId);
      setMessages((prev) => [...prev, sent]);
      setThreads((prev) => [
        {
          client_id: selectedClientId,
          client_name: client?.name || sent.client_name || 'Unknown client',
          color: client?.color || sent.color || '#1B2B4B',
          latest_message: sent.text,
          latest_at: sent.sent_at,
        },
        ...prev.filter((thread) => thread.client_id !== selectedClientId),
      ]);
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
      <div className="content" style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 14 }}>
        <div className="card">
          <div className="card-h">
            <div className="card-title">Conversation List</div>
            <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{visibleThreads.length} clients</div>
          </div>
          <div style={{ padding: 10 }}>
            {!visibleThreads.length && (
              <div style={{ padding: 12, color: 'var(--text-s)', fontSize: 13 }}>
                Add a client first to start a conversation history.
              </div>
            )}
            {visibleThreads.map((thread) => (
              <button
                key={thread.client_id}
                className="btn bg"
                type="button"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  marginBottom: 8,
                  borderColor: selectedClientId === thread.client_id ? 'var(--navy)' : 'var(--border)',
                  padding: 12,
                }}
                onClick={() => setSelectedClientId(thread.client_id)}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{thread.client_name || 'Unknown client'}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-s)' }}>{formatTime(thread.latest_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-s)', marginBottom: 6 }}>
                    {thread.latest_message || 'No messages yet. Send the first update.'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Pill status={thread.active_projects ? 'active' : 'completed'} label={`${thread.active_projects} active projects`} />
                    <Pill status={thread.open_invoices ? 'unpaid' : 'paid'} label={`${thread.open_invoices} open invoices`} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 14, minWidth: 0 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-s)', textTransform: 'uppercase', marginBottom: 4 }}>Client</div>
                <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{selectedClient?.name || 'No client selected'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-s)', textTransform: 'uppercase', marginBottom: 4 }}>Contact</div>
                <div style={{ color: 'var(--text)' }}>{selectedClient?.contact || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-s)', textTransform: 'uppercase', marginBottom: 4 }}>Active Projects</div>
                <div style={{ color: 'var(--text)' }}>{selectedProjects.filter((project) => project.status === 'active').length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-s)', textTransform: 'uppercase', marginBottom: 4 }}>Open Invoices</div>
                <div style={{ color: 'var(--text)' }}>{selectedInvoices.filter((invoice) => invoice.status !== 'paid').length}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-h">
              <div className="card-title">Conversation Output</div>
              {selectedClient && <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{selectedClient.email || 'No email on file'}</div>}
            </div>
            <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
              {error && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{error}</div>}
              {!selectedClient && <div style={{ color: 'var(--text-s)' }}>Choose a client to see or send messages.</div>}
              {selectedClient && loadingMessages && <div style={{ color: 'var(--text-s)' }}>Loading messages…</div>}
              {selectedClient && !loadingMessages && !messages.length && (
                <div style={{ color: 'var(--text-s)' }}>
                  No messages yet for this client. Send a first project update, invoice reminder, or onboarding note below.
                </div>
              )}
              {messages.map((message) => (
                <div key={message.id} style={{ marginBottom: 12, textAlign: message.outbound ? 'right' : 'left' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      background: message.outbound ? 'var(--navy)' : 'var(--navy-pale)',
                      color: message.outbound ? '#fff' : 'var(--text)',
                      padding: '10px 12px',
                      borderRadius: 10,
                      maxWidth: '75%',
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{message.text}</div>
                    <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.8 }}>{formatTime(message.sent_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={send} style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <input
                className="fi"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={selectedClient ? `Write an update for ${selectedClient.name}…` : 'Select a client first'}
                disabled={!selectedClient || sending}
              />
              <button className="btn bp" type="submit" disabled={!selectedClient || sending || !draft.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
