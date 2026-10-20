import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import { JourneyRail } from '../components/ProjectJourney';
import SendQuestionnaire from '../components/SendQuestionnaire';
import { useAuth } from '../hooks/useAuth';
import { useQuestionnaireAlerts } from '../hooks/useQuestionnaireAlerts';
import { RESPONSE_STATUS, progress } from '../utils/questionnaires';
import { clientsAPI, projectsAPI } from '../utils/api';
import { formatDate, formatMoney, stageLabels } from '../utils/format';

const SERVICES = ['Brand Identity', 'Packaging Design', 'Web Design'];
const FILTERS = [
  { key: 'active', label: 'In progress' },
  { key: 'done', label: 'Delivered' },
  { key: 'all', label: 'All' },
];

function blankForm(clientId = '') {
  return { client_id: clientId, service: 'Brand Identity', value: '', start_date: '', timeline: '', budget: '', status: 'active' };
}

function projectToForm(p) {
  return {
    client_id: p?.client_id || '',
    service: p?.service || '',
    value: p?.value || '',
    start_date: p?.start_date || '',
    timeline: p?.timeline || '',
    budget: p?.budget || '',
    status: p?.status || 'active',
  };
}

function isDone(p) {
  return p?.status === 'delivered' || p?.status === 'completed';
}

function ProjectFields({ id, value, onChange, onSubmit, clients, error, showStatus }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <form id={id} onSubmit={onSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="fc">
        <label className="fc-label" htmlFor={`${id}-client`}>Client</label>
        <select id={`${id}-client`} className="fi fsel" value={value.client_id} onChange={set('client_id')} required>
          <option value="" disabled>Choose a client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-service`}>Service</label>
          <input id={`${id}-service`} className="fi" list="vela-services" value={value.service} onChange={set('service')} required />
          <datalist id="vela-services">{SERVICES.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-value`}>Project value</label>
          <input id={`${id}-value`} className="fi" inputMode="decimal" value={value.value} onChange={set('value')} placeholder="4500" />
        </div>
      </div>
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-start`}>Start date</label>
          <input id={`${id}-start`} className="fi" type="date" value={value.start_date} onChange={set('start_date')} />
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-timeline`}>Timeline</label>
          <input id={`${id}-timeline`} className="fi" value={value.timeline} onChange={set('timeline')} placeholder="6 weeks" />
        </div>
      </div>
      {showStatus && (
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-status`}>Status</label>
          <select id={`${id}-status`} className="fi fsel" value={value.status} onChange={set('status')}>
            <option value="active">In progress</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}
      <div className="fc" style={{ marginBottom: 0 }}>
        <label className="fc-label" htmlFor={`${id}-notes`}>Notes</label>
        <textarea id={`${id}-notes`} className="fi" value={value.budget} onChange={set('budget')} placeholder="Budget, scope or anything to remember" />
      </div>
    </form>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const params = useParams();
  const routeProjectId = (params['*'] || '').split('/')[0] || '';
  const { user } = useAuth();
  const currency = user?.currency || 'GBP';
  const { responses } = useQuestionnaireAlerts();
  const [sendStage, setSendStage] = useState(null);

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('active');
  const [pageError, setPageError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankForm());
  const [createError, setCreateError] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(blankForm());
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [fileForm, setFileForm] = useState({ name: '', file_type: '' });
  const [savingFile, setSavingFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    Promise.all([projectsAPI.list(), clientsAPI.list()])
      .then(([projectRows, clientRows]) => {
        setProjects(projectRows);
        setClients(clientRows);
      })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const project = useMemo(() => projects.find((p) => p.id === routeProjectId) || null, [projects, routeProjectId]);
  const client = useMemo(() => clients.find((c) => c.id === project?.client_id) || null, [clients, project]);

  useEffect(() => {
    setDetailError('');
    setFileForm({ name: '', file_type: '' });
  }, [routeProjectId]);

  const visible = useMemo(() => {
    const rows = projects.filter((p) => (filter === 'all' ? true : filter === 'done' ? isDone(p) : !isDone(p)));
    return rows;
  }, [projects, filter]);

  const counts = useMemo(() => ({
    active: projects.filter((p) => !isDone(p)).length,
    done: projects.filter(isDone).length,
    all: projects.length,
  }), [projects]);

  function patchProject(projectId, changes) {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...changes } : p)));
  }

  function openCreate() {
    setCreateForm(blankForm(clients[0]?.id || ''));
    setCreateError('');
    setCreateOpen(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSavingCreate(true);
    setCreateError('');
    try {
      const created = await projectsAPI.create(createForm);
      setProjects((prev) => [created, ...prev]);
      setCreateOpen(false);
      navigate(`/projects/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSavingCreate(false);
    }
  }

  function openEdit() {
    setEditForm(projectToForm(project));
    setEditError('');
    setConfirmDelete(false);
    setEditOpen(true);
  }

  async function handleEdit(event) {
    event.preventDefault();
    setSavingEdit(true);
    setEditError('');
    try {
      const updated = await projectsAPI.update(project.id, editForm);
      patchProject(project.id, updated || editForm);
      setEditOpen(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await projectsAPI.remove(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setEditOpen(false);
      navigate('/projects');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function moveTo(stage) {
    const labels = stageLabels(project.service);
    const next = Math.max(0, Math.min(labels.length - 1, stage));
    setBusy(true);
    setDetailError('');
    try {
      await projectsAPI.advStage(project.id, next);
      patchProject(project.id, { stage: next });
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOffCurrent() {
    const current = Number(project.stage || 0);
    setBusy(true);
    setDetailError('');
    try {
      await projectsAPI.signOff(project.id, current);
      patchProject(project.id, { signoffs: Array.from(new Set([...(project.signoffs || []), current])) });
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status) {
    setBusy(true);
    setDetailError('');
    try {
      await projectsAPI.update(project.id, { status });
      patchProject(project.id, { status });
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddFile(event) {
    event.preventDefault();
    setSavingFile(true);
    setDetailError('');
    try {
      const file = await projectsAPI.addFile(project.id, { stage_index: Number(project.stage || 0), ...fileForm });
      patchProject(project.id, { files: [...(project.files || []), file] });
      setFileForm({ name: '', file_type: '' });
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setSavingFile(false);
    }
  }

  const createModal = (
    <Modal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      title="Start a project"
      footer={
        <>
          <button className="btn bg" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className="btn bp" type="submit" form="project-create" disabled={savingCreate || !clients.length}>
            {savingCreate ? 'Starting…' : 'Start project'}
          </button>
        </>
      }
    >
      {!clients.length ? (
        <div className="empty" style={{ padding: 0 }}>
          Projects belong to a client. <Link to="/clients?new=1">Add your first client</Link>, then come back to start the project.
        </div>
      ) : (
        <ProjectFields id="project-create" value={createForm} onChange={setCreateForm} onSubmit={handleCreate} clients={clients} error={createError} />
      )}
    </Modal>
  );

  /* ── Project page ─────────────────────────────────────────── */
  if (routeProjectId) {
    if (loaded && !project) {
      return (
        <>
          <div className="topbar"><nav className="tb-crumb"><Link to="/projects"><Icon name="back" size={16} />Projects</Link></nav></div>
          <div className="content"><div className="page panel empty" style={{ padding: 40 }}><b>This project doesn’t exist any more.</b> <Link to="/projects">Back to all projects</Link></div></div>
        </>
      );
    }
    if (!project) {
      return <div className="content"><div className="muted">Loading…</div></div>;
    }

    const labels = stageLabels(project.service);
    const current = Math.min(Number(project.stage || 0), labels.length - 1);
    const done = isDone(project);
    const signed = new Set((project.signoffs || []).map(Number));
    const atLast = current >= labels.length - 1;
    const projectForms = responses.filter((r) => r.project_id === project.id);

    return (
      <>
        <div className="topbar">
          <nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/projects"><Icon name="back" size={16} />Projects</Link></nav>
          <div className="tb-r">
            {client && <button className="btn bg" type="button" onClick={() => navigate(`/clients/${client.id}`)}><Icon name="users" />Client profile</button>}
            <button className="btn bg" type="button" onClick={openEdit}><Icon name="edit" />Edit details</button>
          </div>
        </div>
        <div className="content">
          <div className="page">
            <header className="profile-head">
              <ClientMark name={project.client_name} color={client?.color || project.client_color} size={60} />
              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 14 }}>{project.client_name}</div>
                <h1 className="h-display">{project.service}</h1>
              </div>
              <div style={{ marginLeft: 'auto' }}><Pill status={done ? 'delivered' : 'active'} label={done ? 'Delivered' : 'In progress'} /></div>
            </header>

            <div className="figures" style={{ marginTop: 24 }}>
              <div className="figure"><div className="figure-val">{project.value ? formatMoney(project.value, currency) : '—'}</div><div className="figure-label">Project value</div></div>
              <div className="figure"><div className="figure-val" style={{ fontSize: 22 }}>{project.start_date ? formatDate(project.start_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div><div className="figure-label">Started</div></div>
              <div className="figure"><div className="figure-val" style={{ fontSize: 22 }}>{project.timeline || '—'}</div><div className="figure-label">Timeline</div></div>
              <div className="figure"><div className="figure-val">{done ? labels.length : current + 1}<span className="faint" style={{ fontSize: 18 }}> / {labels.length}</span></div><div className="figure-label">Stages</div></div>
            </div>

            {detailError && <div className="form-error" style={{ marginTop: 20 }}>{detailError}</div>}

            <section className="panel section" style={{ padding: '24px 24px 20px' }} aria-label="Stage journey">
              <JourneyRail project={project} />
              <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>{done ? 'Project complete' : `Stage ${current + 1} of ${labels.length}`}</div>
                  <div className="h-section">{done ? 'All stages delivered' : labels[current]}</div>
                  {!done && signed.has(current) && <div style={{ fontSize: 13, color: 'var(--ok)', marginTop: 2 }}>Signed off by the client</div>}
                </div>
                <div className="tb-r">
                  {!done && <button className="btn bg" type="button" onClick={() => setSendStage(current)}><Icon name="clipboard" />Send questionnaire</button>}
                  {done ? (
                    <button className="btn bg" type="button" disabled={busy} onClick={() => setStatus('active')}>Reopen project</button>
                  ) : (
                    <>
                      <button className="btn bq" type="button" disabled={busy || current === 0} onClick={() => moveTo(current - 1)}>Back a stage</button>
                      {!signed.has(current) && <button className="btn bg" type="button" disabled={busy} onClick={signOffCurrent}><Icon name="check" />Mark signed off</button>}
                      {atLast
                        ? <button className="btn bp" type="button" disabled={busy} onClick={() => setStatus('delivered')}>Mark project delivered</button>
                        : <button className="btn bp" type="button" disabled={busy} onClick={() => moveTo(current + 1)}>Move to {labels[current + 1]}</button>}
                    </>
                  )}
                </div>
              </div>
            </section>

            <div className="split section">
              <section aria-labelledby="stages-h">
                <div className="section-h"><h2 id="stages-h" className="h-section">Stages and deliverables</h2></div>
                <ol className="panel rows" style={{ listStyle: 'none' }}>
                  {labels.map((label, index) => {
                    const files = (project.files || []).filter((f) => Number(f.stage_index || 0) === index);
                    const forms = projectForms.filter((r) => Number(r.stage_index || 0) === index);
                    const state = done || index < current ? 'done' : index === current ? 'now' : 'next';
                    return (
                      <li key={label} className="row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                        <span className={`signal ${state === 'done' ? 'ok' : state === 'now' ? 'warn' : ''}`} style={state === 'next' ? { background: 'var(--line)' } : undefined} />
                        <span className="row-main">
                          <span className="row-title" style={{ display: 'block', color: state === 'next' ? 'var(--text-2)' : undefined }}>
                            {index + 1}. {label}
                          </span>
                          <span className="row-sub" style={{ display: 'block' }}>
                            {state === 'now' ? 'In progress' : state === 'done' ? 'Done' : 'Upcoming'}
                            {signed.has(index) ? ', signed off' : ''}
                          </span>
                          {forms.map((r) => {
                            const pr = progress(r.questions, r.answers);
                            const isNew = r.status === 'submitted' && !r.seen_by_studio;
                            return (
                              <Link key={r.id} to={`/questionnaires/responses/${r.id}`} className="stage-form">
                                <Icon name="clipboard" size={16} />
                                <span className="row-main">
                                  <span style={{ display: 'block', fontWeight: 500, color: 'var(--ink)' }}>{r.title}</span>
                                  <span className="row-sub" style={{ display: 'block' }}>
                                    {r.status === 'submitted' ? `Submitted ${formatDate(r.submitted_at)}` : r.status === 'in_progress' ? `In progress, ${pr.done} of ${pr.total} answered` : 'Sent, not started yet'}
                                  </span>
                                </span>
                                {isNew ? <span className="ni-badge">New</span> : <Pill status={RESPONSE_STATUS[r.status]?.pill || 'pending'} label={RESPONSE_STATUS[r.status]?.label} />}
                              </Link>
                            );
                          })}
                          {files.length > 0 && (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              {files.map((f) => (
                                <span key={f.id} className="pill" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }}>
                                  {f.name}{f.file_type ? ` (${f.file_type})` : ''}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <aside className="panel" aria-label="Log a deliverable and notes">
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 4 }}>Log a deliverable</h2>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Adds it to {done ? 'the final stage' : labels[current]}.</p>
                  <form onSubmit={handleAddFile}>
                    <div className="fc">
                      <label className="fc-label" htmlFor="file-name">Name</label>
                      <input id="file-name" className="fi" value={fileForm.name} onChange={(e) => setFileForm({ ...fileForm, name: e.target.value })} placeholder="Brand presentation" required />
                    </div>
                    <div className="fc">
                      <label className="fc-label" htmlFor="file-type">Type</label>
                      <input id="file-type" className="fi" value={fileForm.file_type} onChange={(e) => setFileForm({ ...fileForm, file_type: e.target.value })} placeholder="PDF, Figma link, ZIP" />
                    </div>
                    <button className="btn bg bsm" type="submit" disabled={savingFile}><Icon name="plus" />{savingFile ? 'Adding…' : 'Add deliverable'}</button>
                  </form>
                </div>
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 6 }}>Notes</h2>
                  {project.budget
                    ? <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{project.budget}</p>
                    : <p className="muted" style={{ fontSize: 13 }}>No notes yet. <button type="button" className="auth-link" onClick={openEdit}>Add notes</button> for scope or budget details.</p>}
                </div>
              </aside>
            </div>
          </div>
        </div>

        <SendQuestionnaire
          open={sendStage !== null}
          onClose={() => setSendStage(null)}
          defaults={{ client_id: project.client_id, project_id: project.id, stage_index: sendStage ?? current }}
        />
        <Modal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title="Edit project details"
          footer={
            <>
              <button className="btn bd spacer" type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : confirmDelete ? 'Yes, delete this project' : 'Delete project'}
              </button>
              {confirmDelete && <button className="btn bq" type="button" onClick={() => setConfirmDelete(false)}>Keep project</button>}
              <button className="btn bg" type="button" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="btn bp" type="submit" form="project-edit" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</button>
            </>
          }
        >
          {confirmDelete && <div className="form-error">Deleting this project removes its stages and deliverables. This can’t be undone.</div>}
          <ProjectFields id="project-edit" value={editForm} onChange={setEditForm} onSubmit={handleEdit} clients={clients} error={editError} showStatus />
        </Modal>
        {createModal}
      </>
    );
  }

  /* ── Project list ─────────────────────────────────────────── */
  return (
    <>
      <div className="topbar">
        <h1 className="tb-title">Projects</h1>
        <div className="tb-r">
          <div className="segmented" role="tablist" aria-label="Filter projects">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                {f.label} <span className="faint">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />Start a project</button>
        </div>
      </div>
      <div className="content">
        <div className="page">
          {pageError && <div className="form-error">{pageError}</div>}
          <div className="panel">
            {visible.length ? (
              <div className="journeys">
                {visible.map((p) => {
                  const total = stageLabels(p.service).length;
                  const done = isDone(p);
                  return (
                    <Link key={p.id} className="journey" to={`/projects/${p.id}`}>
                      <span className="journey-who">
                        <ClientMark name={p.client_name} color={clients.find((c) => c.id === p.client_id)?.color || p.client_color} size={36} />
                        <span style={{ minWidth: 0 }}>
                          <span className="journey-name" style={{ display: 'block' }}>{p.client_name || 'Untitled client'}</span>
                          <span className="journey-service">{p.service}</span>
                        </span>
                      </span>
                      <JourneyRail project={p} />
                      <span className="journey-meta">
                        <span className="journey-value" style={{ display: 'block' }}>{p.value ? formatMoney(p.value, currency) : '—'}</span>
                        <span className="journey-when">{done ? 'Delivered' : `Stage ${Math.min(Number(p.stage || 0) + 1, total)} of ${total}`}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                {!loaded && 'Loading…'}
                {loaded && projects.length === 0 && (
                  <>
                    <b>No projects yet.</b> Start one when a client signs, and Vela will track it stage by stage.
                    <div style={{ marginTop: 14 }}><button className="btn bp" type="button" onClick={openCreate}><Icon name="plus" />Start a project</button></div>
                  </>
                )}
                {loaded && projects.length > 0 && (filter === 'done' ? 'No delivered projects yet.' : 'Nothing in progress right now.')}
              </div>
            )}
          </div>
        </div>
      </div>
      {createModal}
    </>
  );
}
