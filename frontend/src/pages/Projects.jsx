import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Icon from '../components/Icon';
import ClientMark from '../components/ClientMark';
import { JourneyRail } from '../components/ProjectJourney';
import SendQuestionnaire from '../components/SendQuestionnaire';
import ProjectSteps from '../components/ProjectSteps';
import ReviewComposer from '../components/ReviewComposer';
import { EditStepsModal, FinalInvoiceModal } from '../components/StepModals';
import { useAuth } from '../hooks/useAuth';
import { useQuestionnaireAlerts } from '../hooks/useQuestionnaireAlerts';
import { RESPONSE_STATUS, STARTERS, progress } from '../utils/questionnaires';
import { clientsAPI, invoicesAPI, projectsAPI, questionnairesAPI } from '../utils/api';
import { formatDate, formatMoney, stageLabels } from '../utils/format';
import { getWorkflow, stageComplete, stageSteps } from '../utils/workflow';

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
  const { responses, reviews } = useQuestionnaireAlerts();
  const [sendDefaults, setSendDefaults] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [viewStage, setViewStage] = useState(null);
  const [composer, setComposer] = useState(null);
  const [invoiceStep, setInvoiceStep] = useState(null);
  const [editSteps, setEditSteps] = useState(false);

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

  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    Promise.all([projectsAPI.list(), clientsAPI.list(), invoicesAPI.list().catch(() => [])])
      .then(([projectRows, clientRows, invoiceRows]) => {
        setProjects(projectRows);
        setClients(clientRows);
        setInvoices(invoiceRows);
      })
      .catch((err) => setPageError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  const project = useMemo(() => projects.find((p) => p.id === routeProjectId) || null, [projects, routeProjectId]);
  const client = useMemo(() => clients.find((c) => c.id === project?.client_id) || null, [clients, project]);

  useEffect(() => {
    setDetailError('');
    setViewStage(null);
  }, [routeProjectId]);

  useEffect(() => {
    const onPaid = (e) => setInvoices((prev) => prev.map((i) => (i.id === e.detail.id ? { ...i, ...e.detail.changes } : i)));
    window.addEventListener('vela:invoice-paid', onPaid);
    return () => window.removeEventListener('vela:invoice-paid', onPaid);
  }, []);

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
    const labels = stageLabels(project);
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

  // Questionnaire steps: use the matching starter questionnaire, creating it the first time.
  async function sendStepQuestionnaire(stageIndex, step) {
    setDetailError('');
    let templateId = '';
    try {
      if (step.template && STARTERS[step.template]) {
        const starter = STARTERS[step.template]();
        const templates = await questionnairesAPI.listTemplates();
        const match = templates.find((t) => t.title === starter.title);
        templateId = match ? match.id : (await questionnairesAPI.createTemplate(starter)).id;
      }
    } catch (err) {
      setDetailError(err.message);
      return;
    }
    setSendDefaults({ template_id: templateId, client_id: project.client_id, project_id: project.id, stage_index: stageIndex, step_id: step.id });
  }

  async function markInvoicePaid(invoice) {
    setBusy(true);
    setDetailError('');
    try {
      await invoicesAPI.updateStatus(invoice.id, 'paid');
      setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? { ...i, status: 'paid' } : i)));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setBusy(false);
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

    const labels = stageLabels(project);
    const current = Math.min(Number(project.stage || 0), labels.length - 1);
    const done = isDone(project);
    const atLast = current >= labels.length - 1;
    const ctx = { reviews, responses, invoices };
    const shown = viewStage ?? current;
    const shownComplete = stageComplete(project, shown, ctx);
    const currentComplete = stageComplete(project, current, ctx);
    const stepIds = new Set(getWorkflow(project).flatMap((st) => st.steps.map((x) => x.id)));
    const looseForms = responses.filter((r) => r.project_id === project.id && !stepIds.has(r.step_id) && !stageSteps(project, Number(r.stage_index || 0), ctx).some((x) => x.response?.id === r.id));
    const stepActions = {
      share: (step, kind, round) => setComposer({ step, kind, round, stageIndex: shown }),
      sendQuestionnaire: (step) => sendStepQuestionnaire(shown, step),
      invoice: (step) => setInvoiceStep(step),
      markPaid: (step, invoice) => markInvoicePaid(invoice),
    };

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
              <div className="stage-steps-h" style={{ marginTop: 26 }}>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {shown === current ? (done ? 'Project complete' : `Stage ${current + 1} of ${labels.length}, in progress`) : `Stage ${shown + 1} of ${labels.length}, ${shown < current || done ? 'done' : 'coming up'}`}
                  </div>
                  <h2 className="h-section">{labels[shown]}</h2>
                </div>
                <div className="tb-r">
                  {shown !== current && <button className="btn bq bsm" type="button" onClick={() => setViewStage(null)}>Back to current stage</button>}
                  <button className="btn bq bsm" type="button" onClick={() => setEditSteps(true)}><Icon name="edit" size={15} />Edit steps</button>
                </div>
              </div>
              <ProjectSteps project={project} stageIndex={shown} ctx={ctx} currency={currency} actions={stepActions} disabled={busy || shown > current} />
              {shown === current && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div className="muted" style={{ fontSize: 13.5 }}>
                    {done ? 'Every stage is delivered.' : currentComplete ? (atLast ? 'Every step is done. You can close the project.' : `Every step is done. Ready to move on to ${labels[current + 1]}.`) : 'Move on once every step above is done, or whenever you’re ready.'}
                  </div>
                  <div className="tb-r">
                    {done ? (
                      <button className="btn bg" type="button" disabled={busy} onClick={() => setStatus('active')}>Reopen project</button>
                    ) : (
                      <>
                        <button className="btn bq" type="button" disabled={busy || current === 0} onClick={() => moveTo(current - 1)}>Back a stage</button>
                        {atLast
                          ? <button className={`btn ${currentComplete ? 'bp' : 'bg'}`} type="button" disabled={busy} onClick={() => setStatus('delivered')}>Mark project delivered</button>
                          : <button className={`btn ${currentComplete ? 'bp' : 'bg'}`} type="button" disabled={busy} onClick={() => moveTo(current + 1)}>Move to {labels[current + 1]}</button>}
                      </>
                    )}
                  </div>
                </div>
              )}
              {shown !== current && shownComplete && <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>All steps in this stage are done.</div>}
            </section>

            <div className="split section">
              <section aria-labelledby="stages-h">
                <div className="section-h"><h2 id="stages-h" className="h-section">All stages</h2></div>
                <ol className="panel rows" style={{ listStyle: 'none' }}>
                  {labels.map((label, index) => {
                    const files = (project.files || []).filter((f) => Number(f.stage_index || 0) === index);
                    const forms = looseForms.filter((r) => Number(r.stage_index || 0) === index);
                    const steps = stageSteps(project, index, ctx);
                    const doneCount = steps.filter((x) => x.state === 'done').length;
                    const state = done || index < current ? 'done' : index === current ? 'now' : 'next';
                    return (
                      <li key={`${label}-${index}`} className="row" style={{ alignItems: 'flex-start', background: index === shown ? 'var(--paper)' : undefined }} onClick={() => setViewStage(index === current ? null : index)}>
                        <span className={`signal ${state === 'done' ? 'ok' : state === 'now' ? 'warn' : ''}`} style={state === 'next' ? { background: 'var(--line)' } : undefined} />
                        <span className="row-main">
                          <button type="button" className="row-title" style={{ display: 'block', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: state === 'next' ? 'var(--text-2)' : undefined }}>
                            {index + 1}. {label}
                          </button>
                          <span className="row-sub" style={{ display: 'block' }}>
                            {state === 'now' ? 'In progress, ' : state === 'next' ? 'Upcoming, ' : doneCount === steps.length ? 'Done, ' : ''}
                            {steps.length ? `${doneCount} of ${steps.length} steps done` : ''}
                          </span>
                          <span className="row-sub" style={{ display: 'block', color: 'var(--text-3)' }}>{steps.map((x) => x.step.label).join(' · ')}</span>
                          {forms.map((r) => {
                            const pr = progress(r.questions, r.answers);
                            const isNew = r.status === 'submitted' && !r.seen_by_studio;
                            return (
                              <Link key={r.id} to={`/questionnaires/responses/${r.id}`} className="stage-form" onClick={(e) => e.stopPropagation()}>
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
                        <Icon name="forward" size={16} className="ico muted" />
                      </li>
                    );
                  })}
                </ol>
              </section>

              <aside className="panel" aria-label="Notes and extras">
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 6 }}>Notes</h2>
                  {project.budget
                    ? <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{project.budget}</p>
                    : <p className="muted" style={{ fontSize: 13 }}>No notes yet. <button type="button" className="auth-link" onClick={openEdit}>Add notes</button> for scope or budget details.</p>}
                </div>
                <div className="aside-block">
                  <h2 className="card-title" style={{ marginBottom: 4 }}>Something extra?</h2>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Send a one-off questionnaire, or add a step to any stage.</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn bg bsm" type="button" onClick={() => setSendDefaults({ client_id: project.client_id, project_id: project.id, stage_index: current })}><Icon name="clipboard" size={15} />Send questionnaire</button>
                    <button className="btn bg bsm" type="button" onClick={() => setEditSteps(true)}><Icon name="plus" size={15} />Add a step</button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <SendQuestionnaire open={sendDefaults !== null} onClose={() => setSendDefaults(null)} defaults={sendDefaults || {}} />
        <ReviewComposer
          open={Boolean(composer)}
          onClose={() => setComposer(null)}
          onSent={(sent) => navigate(`/reviews/${sent.id}`)}
          project={project}
          stageIndex={composer?.stageIndex ?? current}
          step={composer?.step}
          kind={composer?.kind}
          round={composer?.round}
        />
        <FinalInvoiceModal
          open={Boolean(invoiceStep)}
          onClose={() => setInvoiceStep(null)}
          project={project}
          step={invoiceStep}
          invoices={invoices}
          currency={currency}
          onSaved={({ workflow, invoice, created }) => {
            patchProject(project.id, { workflow });
            if (created) setInvoices((prev) => [invoice, ...prev]);
          }}
        />
        <EditStepsModal open={editSteps} onClose={() => setEditSteps(false)} project={project} onSaved={(workflow) => patchProject(project.id, { workflow })} />
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
                  const total = stageLabels(p).length;
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
