import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { clientsAPI, projectsAPI } from '../utils/api';
import { STAGES } from '../utils/constants';

function blankForm(clientId = '') {
  return {
    client_id: clientId,
    service: 'Brand Identity',
    value: '',
    start_date: '',
    timeline: '',
    budget: '',
    status: 'active',
  };
}

function stageKey(service) {
  const value = String(service || '').toLowerCase();
  if (value.includes('pack')) return 'packaging';
  if (value.includes('web')) return 'web';
  return 'brand';
}

function stageLabels(service) {
  return STAGES[stageKey(service)] || STAGES.brand;
}

export default function Projects() {
  const navigate = useNavigate();
  const params = useParams();
  const routeProjectId = (params['*'] || '').split('/')[0] || '';

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankForm());
  const [detailForm, setDetailForm] = useState(blankForm());
  const [fileForm, setFileForm] = useState({ name: '', file_type: '' });
  const [pageError, setPageError] = useState('');
  const [createError, setCreateError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [projectRows, clientRows] = await Promise.all([projectsAPI.list(), clientsAPI.list()]);
    setProjects(projectRows);
    setClients(clientRows);
    setCreateForm((current) => ({ ...current, client_id: current.client_id || clientRows[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch((err) => setPageError(err.message));
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === routeProjectId) || null,
    [projects, routeProjectId]
  );

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    setDetailForm({
      client_id: selectedProject.client_id || '',
      service: selectedProject.service || '',
      value: selectedProject.value || '',
      start_date: selectedProject.start_date || '',
      timeline: selectedProject.timeline || '',
      budget: selectedProject.budget || '',
      status: selectedProject.status || 'active',
    });
    setFileForm({ name: '', file_type: '' });
    setDetailError('');
  }, [selectedProject]);

  const selectedClient = clients.find((client) => client.id === detailForm.client_id);
  const currentStage = Number(selectedProject?.stage || 0);
  const labels = stageLabels(detailForm.service || selectedProject?.service);
  const currentStageLabel = labels[Math.min(currentStage, labels.length - 1)] || `Stage ${currentStage + 1}`;

  function openCreate() {
    setCreateForm(blankForm(clients[0]?.id || ''));
    setCreateError('');
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateError('');
  }

  function openProject(projectId) {
    navigate(`/projects/${projectId}`);
  }

  function closeProject() {
    navigate('/projects');
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await projectsAPI.create(createForm);
      setProjects((prev) => [created, ...prev]);
      closeCreate();
      openProject(created.id);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleDetailSave(event) {
    event.preventDefault();
    if (!selectedProject) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await projectsAPI.update(selectedProject.id, detailForm);
      setProjects((prev) => prev.map((project) => (project.id === updated.id ? { ...project, ...updated } : project)));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingDetail(false);
    }
  }

  async function updateStage(project, stage, onError) {
    if (!project) return;
    const labelsForProject = stageLabels(project.service);
    const nextStage = Math.max(0, Math.min(labelsForProject.length - 1, Number(stage)));
    try {
      await projectsAPI.advStage(project.id, nextStage);
      setProjects((prev) => prev.map((item) => (item.id === project.id ? { ...item, stage: nextStage } : item)));
    } catch (err) {
      onError?.(err.message);
    }
  }

  async function setStage(stage) {
    setDetailError('');
    return updateStage(selectedProject, stage, setDetailError);
  }

  async function markSignedOff() {
    if (!selectedProject) return;
    setDetailError('');
    try {
      await projectsAPI.signOff(selectedProject.id, currentStage);
      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedProject.id
            ? { ...project, signoffs: Array.from(new Set([...(project.signoffs || []), currentStage])) }
            : project
        )
      );
    } catch (err) {
      setDetailError(err.message);
    }
  }

  async function handleAddFile(event) {
    event.preventDefault();
    if (!selectedProject) return;
    setSavingFile(true);
    setDetailError('');
    try {
      const createdFile = await projectsAPI.addFile(selectedProject.id, {
        stage_index: currentStage,
        ...fileForm,
      });
      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedProject.id
            ? { ...project, files: [...(project.files || []), createdFile] }
            : project
        )
      );
      setFileForm({ name: '', file_type: '' });
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingFile(false);
    }
  }

  async function handleDelete() {
    if (!selectedProject) return;
    setDeleting(true);
    setDetailError('');
    try {
      await projectsAPI.remove(selectedProject.id);
      setProjects((prev) => prev.filter((project) => project.id !== selectedProject.id));
      closeProject();
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Projects</div>
        <div className="tb-r">
          <button className="btn bp bsm" onClick={openCreate}>+ New Project</button>
        </div>
      </div>
      <div className="content">
        {pageError && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{pageError}</div>}
        {!clients.length && (
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Create a client first</div>
            <div style={{ color: 'var(--text-s)', fontSize: 13 }}>
              Projects, invoices, proposals, contracts, messages, and events all link back to clients.
            </div>
          </div>
        )}
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
                <tr key={project.id} onClick={() => openProject(project.id)}>
                  <td><b>{project.client_name || 'Unknown client'}</b></td>
                  <td>{project.service}</td>
                  <td>{project.value || '—'}</td>
                  <td>{stageLabels(project.service)[Number(project.stage || 0)] || `Stage ${Number(project.stage || 0) + 1}`}</td>
                  <td><Pill status={project.status} /></td>
                  <td>
                    <button
                      className="btn bg bxs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPageError('');
                        updateStage(project, Number(project.stage || 0) + 1, setPageError);
                      }}
                    >
                      Advance
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No projects yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Create Project"
        footer={
          <>
            <button className="btn bg" type="button" onClick={closeCreate}>Cancel</button>
            <button className="btn bp" type="submit" form="project-create-form" disabled={savingCreate || !clients.length}>
              {savingCreate ? 'Saving…' : 'Save Project'}
            </button>
          </>
        }
      >
        <form id="project-create-form" onSubmit={handleCreate}>
          {createError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{createError}</div>}
          {!clients.length && (
            <div style={{ marginBottom: 12, color: 'var(--text-s)', fontSize: 13 }}>
              You need at least one client before you can create a project.
            </div>
          )}
          <div className="fc">
            <div className="fc-label">Client</div>
            <select className="fi fsel" value={createForm.client_id} onChange={(event) => setCreateForm({ ...createForm, client_id: event.target.value })} required>
              <option value="" disabled>Select a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Service</div><input className="fi" value={createForm.service} onChange={(event) => setCreateForm({ ...createForm, service: event.target.value })} required /></div>
            <div className="fc"><div className="fc-label">Value</div><input className="fi" value={createForm.value} onChange={(event) => setCreateForm({ ...createForm, value: event.target.value })} placeholder="4500" /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Start Date</div><input className="fi" type="date" value={createForm.start_date} onChange={(event) => setCreateForm({ ...createForm, start_date: event.target.value })} /></div>
            <div className="fc"><div className="fc-label">Timeline</div><input className="fi" value={createForm.timeline} onChange={(event) => setCreateForm({ ...createForm, timeline: event.target.value })} placeholder="6 weeks" /></div>
          </div>
          <div className="fc"><div className="fc-label">Budget Notes</div><textarea className="fi" value={createForm.budget} onChange={(event) => setCreateForm({ ...createForm, budget: event.target.value })} /></div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedProject)}
        onClose={closeProject}
        title={selectedProject ? `${selectedProject.client_name} · ${selectedProject.service}` : 'Project'}
        footer={
          <>
            <button className="btn bg" type="button" onClick={closeProject}>Close</button>
            <button className="btn bg" type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button className="btn bp" type="submit" form="project-detail-form" disabled={savingDetail}>
              {savingDetail ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        {selectedProject && (
          <>
            {detailError && <div style={{ marginBottom: 12, color: 'var(--err)' }}>{detailError}</div>}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-h">
                <div className="card-title">Project Workspace</div>
                <Pill status={detailForm.status} />
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                  <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{currentStage + 1}</div><div className="stat-label">Current Stage</div></div>
                  <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{(selectedProject.files || []).length}</div><div className="stat-label">Files Logged</div></div>
                  <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{(selectedProject.signoffs || []).length}</div><div className="stat-label">Signed-Off Stages</div></div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-s)', marginBottom: 8 }}>Current stage output</div>
                <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{currentStageLabel}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-s)' }}>
                    Move the project through its delivery stages, record deliverables, and mark completed approvals.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn bg" type="button" onClick={() => setStage(Math.max(0, currentStage - 1))} disabled={currentStage === 0}>Previous Stage</button>
                  <button className="btn bg" type="button" onClick={() => setStage(Math.min(labels.length - 1, currentStage + 1))} disabled={currentStage >= labels.length - 1}>Advance Stage</button>
                  <button className="btn bp" type="button" onClick={markSignedOff}>Sign Off Current Stage</button>
                </div>
              </div>
            </div>

            <form id="project-detail-form" onSubmit={handleDetailSave}>
              <div className="fc">
                <div className="fc-label">Client</div>
                <select className="fi fsel" value={detailForm.client_id} onChange={(event) => setDetailForm({ ...detailForm, client_id: event.target.value })} required>
                  <option value="" disabled>Select a client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Service</div><input className="fi" value={detailForm.service} onChange={(event) => setDetailForm({ ...detailForm, service: event.target.value })} required /></div>
                <div className="fc"><div className="fc-label">Value</div><input className="fi" value={detailForm.value} onChange={(event) => setDetailForm({ ...detailForm, value: event.target.value })} /></div>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Start Date</div><input className="fi" type="date" value={detailForm.start_date} onChange={(event) => setDetailForm({ ...detailForm, start_date: event.target.value })} /></div>
                <div className="fc"><div className="fc-label">Timeline</div><input className="fi" value={detailForm.timeline} onChange={(event) => setDetailForm({ ...detailForm, timeline: event.target.value })} /></div>
              </div>
              <div className="fi-row">
                <div className="fc"><div className="fc-label">Status</div>
                  <select className="fi fsel" value={detailForm.status} onChange={(event) => setDetailForm({ ...detailForm, status: event.target.value })}>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
                <div className="fc"><div className="fc-label">Brand Colour</div><input className="fi" value={selectedClient?.color || selectedProject.client_color || ''} readOnly /></div>
              </div>
              <div className="fc"><div className="fc-label">Budget Notes</div><textarea className="fi" value={detailForm.budget} onChange={(event) => setDetailForm({ ...detailForm, budget: event.target.value })} /></div>
            </form>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Stage Deliverables</div>
              <form onSubmit={handleAddFile}>
                <div className="fi-row">
                  <div className="fc"><div className="fc-label">Deliverable Name</div><input className="fi" value={fileForm.name} onChange={(event) => setFileForm({ ...fileForm, name: event.target.value })} placeholder="Brand Presentation PDF" /></div>
                  <div className="fc"><div className="fc-label">Type</div><input className="fi" value={fileForm.file_type} onChange={(event) => setFileForm({ ...fileForm, file_type: event.target.value })} placeholder="pdf, figma, zip" /></div>
                </div>
                <button className="btn bp" type="submit" disabled={savingFile}>{savingFile ? 'Adding…' : 'Add Deliverable'}</button>
              </form>

              <div style={{ marginTop: 14 }}>
                {(selectedProject.files || []).map((file) => (
                  <div key={file.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-s)' }}>
                      {stageLabels(selectedProject.service)[Number(file.stage_index || 0)] || `Stage ${Number(file.stage_index || 0) + 1}`}
                      {file.file_type ? ` · ${file.file_type}` : ''}
                    </div>
                  </div>
                ))}
                {!(selectedProject.files || []).length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No deliverables logged yet.</div>}
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
