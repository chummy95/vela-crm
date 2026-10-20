import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import { clientsAPI, projectsAPI, questionnairesAPI } from '../utils/api';
import { stageLabels } from '../utils/format';

// Modal for sending a questionnaire to a client, optionally tied to a project stage.
export default function SendQuestionnaire({ open, onClose, onSent, defaults = {} }) {
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ template_id: '', client_id: '', project_id: '', stage_index: 0, step_id: '', note: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    Promise.all([questionnairesAPI.listTemplates(), clientsAPI.list(), projectsAPI.list()])
      .then(([t, c, p]) => {
        setTemplates(t);
        setClients(c);
        setProjects(p);
        const project = p.find((x) => x.id === defaults.project_id);
        setForm({
          template_id: defaults.template_id || t[0]?.id || '',
          client_id: defaults.client_id || project?.client_id || c[0]?.id || '',
          project_id: defaults.project_id || '',
          stage_index: defaults.stage_index ?? Number(project?.stage || 0),
          step_id: defaults.step_id || '',
          note: '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientProjects = useMemo(() => projects.filter((p) => p.client_id === form.client_id), [projects, form.client_id]);
  const project = projects.find((p) => p.id === form.project_id);
  const labels = project ? stageLabels(project) : [];
  const client = clients.find((c) => c.id === form.client_id);

  async function handleSend(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const sent = await questionnairesAPI.send(form);
      onSent?.(sent);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send a questionnaire"
      footer={
        <>
          <button className="btn bg" type="button" onClick={onClose}>Cancel</button>
          <button className="btn bp" type="submit" form="send-questionnaire" disabled={sending || !templates.length || !clients.length}>{sending ? 'Sending…' : 'Send to client'}</button>
        </>
      }
    >
      {loaded && !templates.length ? (
        <div className="empty" style={{ padding: 0 }}>You don’t have a questionnaire yet. <Link to="/questionnaires?tab=templates" onClick={onClose}>Create one</Link> first.</div>
      ) : loaded && !clients.length ? (
        <div className="empty" style={{ padding: 0 }}>Add a client first. <Link to="/clients?new=1" onClick={onClose}>Add client</Link></div>
      ) : (
        <form id="send-questionnaire" onSubmit={handleSend}>
          {error && <div className="form-error">{error}</div>}
          <div className="fc">
            <label className="fc-label" htmlFor="sq-template">Questionnaire</label>
            <select id="sq-template" className="fi fsel" value={form.template_id} onChange={set('template_id')} required>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="fi-row">
            <div className="fc">
              <label className="fc-label" htmlFor="sq-client">Client</label>
              <select id="sq-client" className="fi fsel" value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value, project_id: '', stage_index: 0, step_id: '' }))} required>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fc">
              <label className="fc-label" htmlFor="sq-project">Project</label>
              <select
                id="sq-project"
                className="fi fsel"
                value={form.project_id}
                onChange={(e) => {
                  const p = projects.find((x) => x.id === e.target.value);
                  setForm((f) => ({ ...f, project_id: e.target.value, stage_index: Number(p?.stage || 0), step_id: '' }));
                }}
              >
                <option value="">Not linked to a project</option>
                {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.service}</option>)}
              </select>
            </div>
          </div>
          {project && (
            <div className="fc">
              <label className="fc-label" htmlFor="sq-stage">Stage</label>
              <select id="sq-stage" className="fi fsel" value={form.stage_index} onChange={(e) => setForm((f) => ({ ...f, stage_index: Number(e.target.value), step_id: '' }))}>
                {labels.map((label, index) => <option key={label} value={index}>{index + 1}. {label}</option>)}
              </select>
            </div>
          )}
          <div className="fc" style={{ marginBottom: 6 }}>
            <label className="fc-label" htmlFor="sq-note">Note to {client?.contact || client?.name || 'the client'} <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea id="sq-note" className="fi" value={form.note} onChange={set('note')} placeholder="Shown at the top of the questionnaire. Leave blank to use the questionnaire’s own introduction." />
          </div>
          {client && !client.portal_user_id && (
            <p className="form-error" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              {client.name} doesn’t have a portal login yet, so they can’t open it. Create one from their <Link to={`/clients/${client.id}`} onClick={onClose}>client profile</Link>.
            </p>
          )}
          <p className="muted" style={{ fontSize: 13 }}>It appears in their client portal straight away. You’ll be notified when they submit it.</p>
        </form>
      )}
    </Modal>
  );
}
