import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import { JourneyRail } from '../components/ProjectJourney';
import ProjectSteps from '../components/ProjectSteps';
import { invoicesAPI, projectsAPI, questionnairesAPI, reviewsAPI } from '../utils/api';
import { RESPONSE_STATUS, progress } from '../utils/questionnaires';
import { formatDate, stageLabel, stageLabels } from '../utils/format';
import { getWorkflow, stageSteps } from '../utils/workflow';

function isDone(p) {
  return p?.status === 'delivered' || p?.status === 'completed';
}

export default function PortalProjects() {
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const [projects, setProjects] = useState([]);
  const [forms, setForms] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsAPI.list().then(setProjects).catch((err) => setError(err.message)).finally(() => setLoaded(true));
    questionnairesAPI.listResponses().then(setForms).catch(() => {});
    reviewsAPI.list().then(setReviews).catch(() => {});
    invoicesAPI.list().then(setInvoices).catch(() => {});
  }, []);

  const project = useMemo(() => projects.find((p) => p.id === routeId) || null, [projects, routeId]);

  if (routeId) {
    if (!project) {
      return (
        <>
          <div className="topbar"><nav className="tb-crumb"><Link to="/portal/projects"><Icon name="back" size={16} />Projects</Link></nav></div>
          <div className="content"><div className="page panel empty" style={{ padding: 40 }}>{loaded ? <>This project isn’t available. <Link to="/portal/projects">See your projects</Link></> : 'Loading…'}</div></div>
        </>
      );
    }
    const labels = stageLabels(project);
    const current = Math.min(Number(project.stage || 0), labels.length - 1);
    const done = isDone(project);
    const ctx = { reviews, responses: forms, invoices };
    const stepIds = new Set(getWorkflow(project).flatMap((st) => st.steps.map((x) => x.id)));
    const needsYou = stageSteps(project, current, ctx).filter((x) => !x.locked && ((x.state === 'waiting' && x.step.type !== 'files') || (x.step.type === 'files' && x.review)));
    return (
      <>
        <div className="topbar"><nav className="tb-crumb" aria-label="Breadcrumb"><Link to="/portal/projects"><Icon name="back" size={16} />Projects</Link></nav></div>
        <div className="content">
          <div className="page">
            <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="muted" style={{ fontSize: 13.5 }}>{project.timeline ? `${project.timeline} project` : 'Your project'}{project.start_date ? `, started ${formatDate(project.start_date, { day: 'numeric', month: 'long' })}` : ''}</div>
                <h1 className="h-display">{project.service}</h1>
              </div>
              <Pill status={done ? 'delivered' : 'active'} label={done ? 'Delivered' : 'In progress'} />
            </header>

            {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}

            <section className="panel section" style={{ padding: '24px 24px 20px' }} aria-label="Where we are">
              <JourneyRail project={project} />
              <div style={{ marginTop: 24 }}>
                <div className="muted" style={{ fontSize: 13 }}>{done ? 'All done' : `Stage ${current + 1} of ${labels.length}`}</div>
                <h2 className="h-section">{done ? 'Your project has been delivered' : labels[current]}</h2>
                {!done && <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{needsYou.length ? `${needsYou.length === 1 ? 'One thing needs' : `${needsYou.length} things need`} your attention below.` : 'Nothing needs you right now. We’ll let you know when there’s something to look at.'}</div>}
              </div>
              <div style={{ marginTop: 12 }}>
                <ProjectSteps project={project} stageIndex={current} ctx={ctx} viewer="client" studioName="Your designer" />
              </div>
            </section>

            <section className="section" aria-labelledby="st-h">
              <div className="section-h"><h2 id="st-h" className="h-section">All stages</h2></div>
              <div className="panel" style={{ padding: '6px 24px' }}>
                {labels.map((label, index) => {
                  const files = (project.files || []).filter((f) => Number(f.stage_index || 0) === index);
                  const stageForms = forms.filter((f) => f.project_id === project.id && Number(f.stage_index || 0) === index && !stepIds.has(f.step_id) && !stageSteps(project, index, ctx).some((x) => x.response?.id === f.id));
                  const state = done || index < current ? 'done' : index === current ? 'now' : 'next';
                  return (
                    <div key={`${label}-${index}`} style={{ padding: '16px 0', borderTop: index ? '1px solid var(--line-soft)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`signal ${state === 'done' ? 'ok' : state === 'now' ? 'warn' : ''}`} style={{ marginTop: 0, ...(state === 'next' ? { background: 'var(--line)' } : {}) }} />
                        <span className="row-title" style={{ color: state === 'next' ? 'var(--text-2)' : undefined }}>{index + 1}. {label}</span>
                        <span className="faint" style={{ fontSize: 13, marginLeft: 'auto' }}>{state === 'now' ? 'In progress' : state === 'done' ? 'Done' : 'Coming up'}</span>
                      </div>
                      {index !== current && <div style={{ paddingLeft: 18 }}><ProjectSteps project={project} stageIndex={index} ctx={ctx} viewer="client" studioName="Your designer" /></div>}
                      {stageForms.map((f) => {
                        const pr = progress(f.questions, f.answers);
                        return (
                          <Link key={f.id} to={`/portal/questionnaires/${f.id}`} className="stage-form">
                            <Icon name="clipboard" size={16} />
                            <span className="row-main">
                              <span style={{ display: 'block', fontWeight: 500, color: 'var(--ink)' }}>{f.title}</span>
                              <span className="row-sub" style={{ display: 'block' }}>
                                {f.status === 'submitted' ? 'Sent to the studio' : f.status === 'in_progress' ? `${pr.done} of ${pr.total} answered` : 'Waiting for your answers'}
                              </span>
                            </span>
                            <Pill status={RESPONSE_STATUS[f.status]?.pill || 'pending'} label={f.status === 'submitted' ? 'Sent' : f.status === 'in_progress' ? 'Continue' : 'Start'} />
                          </Link>
                        );
                      })}
                      {files.length > 0 && (
                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {files.map((f) => <span key={f.id} className="pill" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }}>{f.name}{f.file_type ? ` (${f.file_type})` : ''}</span>)}
                        </span>
                      )}
                      {index === current && <div className="faint" style={{ fontSize: 13, marginTop: 6, paddingLeft: 18 }}>Steps for this stage are shown above.</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar"><h1 className="tb-title">Projects</h1></div>
      <div className="content">
        <div className="page">
          {error && <div className="form-error">{error}</div>}
          <div className="panel">
            {projects.length ? (
              <div className="journeys">
                {projects.map((p) => (
                  <Link key={p.id} className="journey tight" to={`/portal/projects/${p.id}`}>
                    <span style={{ minWidth: 0 }}>
                      <span className="journey-name" style={{ display: 'block' }}>{p.service}</span>
                      <span className="journey-service">{isDone(p) ? 'Delivered' : `Now in ${stageLabel(p)}`}</span>
                    </span>
                    <JourneyRail project={p} />
                    <span className="journey-meta"><span className="journey-when">{p.timeline || ''}</span></span>
                  </Link>
                ))}
              </div>
            ) : <div className="empty" style={{ padding: 40 }}>{loaded ? 'Your studio hasn’t shared a project here yet.' : 'Loading…'}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
