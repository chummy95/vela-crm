import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { clientsAPI, invoicesAPI, messagesAPI, projectsAPI } from '../utils/api';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import { relativeDay } from '../utils/format';

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
  const [searchParams] = useSearchParams();
  const requestedClientId = searchParams.get('client') || '';
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
        setSelectedClientId((current) => current || requestedClientId || threadRows[0]?.client_id || clientRows[0]?.id || '');
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

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(event);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Messages</h1>
        {selectedClient && (
          <div className="tb-r">
            <Link className="btn bg" to={`/clients/${selectedClient.id}`}><Icon name="users" />{selectedClient.name}’s profile</Link>
          </div>
        )}
      </div>
      <div className="content chat-content">
        {error && <div className="form-error">{error}</div>}
        <div className="chat">
          <nav className="panel chat-list" aria-label="Conversations">
            {!visibleThreads.length && <div className="empty">Add a client first, then you can message them here and in their portal.</div>}
            <ul className="rows">
              {visibleThreads.map((thread) => (
                <li key={thread.client_id}>
                  <button
                    type="button"
                    className="row"
                    onClick={() => setSelectedClientId(thread.client_id)}
                    aria-current={selectedClientId === thread.client_id}
                    style={{ width: '100%', border: 'none', textAlign: 'left', background: selectedClientId === thread.client_id ? 'var(--info-bg)' : 'transparent', alignItems: 'center' }}
                  >
                    <ClientMark name={thread.client_name} color={thread.color} size={36} />
                    <span className="row-main">
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span className="row-title">{thread.client_name || 'Unknown client'}</span>
                        <span className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{thread.latest_at ? relativeDay(thread.latest_at) : ''}</span>
                      </span>
                      <span className="row-sub" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {thread.latest_message || 'No messages yet'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="panel chat-thread" aria-label={selectedClient ? `Conversation with ${selectedClient.name}` : 'Conversation'}>
            <header className="card-h">
              {selectedClient ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <ClientMark name={selectedClient.name} color={selectedClient.color} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title">{selectedClient.name}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {[selectedClient.contact, selectedClient.portal_user_id ? 'sees these messages in their portal' : 'no portal login yet'].filter(Boolean).join(', ')}
                    </div>
                  </div>
                </div>
              ) : <div className="card-title">Messages</div>}
              {selectedClient && (
                <div className="muted hide-sm" style={{ fontSize: 12.5, textAlign: 'right' }}>
                  {(() => {
                    const a = selectedProjects.filter((p) => p.status === 'active').length;
                    const u = selectedInvoices.filter((i) => i.status !== 'paid').length;
                    return `${a} active ${a === 1 ? 'project' : 'projects'}, ${u} unpaid ${u === 1 ? 'invoice' : 'invoices'}`;
                  })()}
                </div>
              )}
            </header>
            <div className="chat-scroll">
              {!selectedClient && <div className="empty">Choose a client to see your conversation.</div>}
              {selectedClient && loadingMessages && <div className="empty">Loading messages…</div>}
              {selectedClient && !loadingMessages && !messages.length && (
                <div className="empty">No messages with {selectedClient.name} yet. Send a project update or a quick hello below.</div>
              )}
              {messages.map((message) => (
                <div key={message.id} className={`bubble-row${message.outbound ? ' out' : ''}`}>
                  <div className="bubble">
                    <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
                    <div className="bubble-time">{message.outbound ? 'You' : (selectedClient?.contact || selectedClient?.name)}, {formatTime(message.sent_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={send} className="chat-compose">
              <label className="sr-only" htmlFor="chat-draft">Message</label>
              <textarea
                id="chat-draft"
                className="fi"
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={selectedClient ? `Message ${selectedClient.contact || selectedClient.name}` : 'Choose a client first'}
                disabled={!selectedClient || sending}
                style={{ minHeight: 44, resize: 'none' }}
              />
              <button className="btn bp" type="submit" disabled={!selectedClient || sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
