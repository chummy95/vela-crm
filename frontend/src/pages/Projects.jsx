import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, projectsAPI } from '../utils/api';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ client_id: '', service: 'Brand Identity', value: '', start_date: '', timeline: '', budget: '' });

  async function load() {
    const [projectRows, clientRows] = await Promise.all([projectsAPI.list(), clientsAPI.list()]);
    setProjects(projectRows);
    setClients(clientRows);
    setForm((current) => ({ ...current, client_id: current.client_id || clientRows[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e?.preventDefault();
    try {
      const created = await projectsAPI.create(form);
      setProjects((prev) => [created, ...prev]);
      setModal(false);
      setError('');
      setForm({ client_id: clients[0]?.id || '', service: 'Brand Identity', value: '', start_date: '', timeline: '', budget: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function advance(project) {
    try {
      const nextStage = Number(project.stage || 0) + 1;
      await projectsAPI.advStage(project.id, nextStage);
      setProjects((prev) => prev.map((item) => (item.id === project.id ? { ...item, stage: nextStage } : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Projects</div>
        <div className="tb-r">
          <button className="btn bp bsm" onClick={() => setModal(true)}>+ New Project</button>
        </div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h">
            <div className="card-title">Live Projects</div>
            <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{projects.length} total</div>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Client</th><th>Service</th><th>Value</th><th>Stage</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td><b>{project.client_name || 'Unknown client'}</b></td>
                  <td>{project.service}</td>
                  <td>{project.value || '—'}</td>
                  <td>Stage {Number(project.stage || 0) + 1}</td>
                  <td><Pill status={project.status} /></td>
                  <td><button className="btn bg bxs" onClick={() => advance(project)}>Advance</button></td>
                </tr>
              ))}
              {projects.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No projects yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Create Project"
        footer={<><button className="btn bg" onClick={() => setModal(false)}>Cancel</button><button className="btn bp" onClick={handleCreate}>Save Project</button></>}
      >
        <form onSubmit={handleCreate}>
          <div className="fc">
            <div className="fc-label">Client</div>
            <select className="fi fsel" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
              <option value="" disabled>Select a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Service</div><input className="fi" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Value</div><input className="fi" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Start Date</div><input className="fi" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div className="fc"><div className="fc-label">Timeline</div><input className="fi" value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} /></div>
          </div>
          <div className="fc"><div className="fc-label">Budget Notes</div><input className="fi" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
        </form>
      </Modal>
    </>
  );
}
