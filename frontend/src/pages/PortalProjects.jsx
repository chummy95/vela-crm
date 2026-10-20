import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import { JourneyRail } from '../components/ProjectJourney';
import { projectsAPI, questionnairesAPI } from '../utils/api';
import { RESPONSE_STATUS, progress } from '../utils/questionnaires';
import { formatDate, stageLabel, stageLabels } from '../utils/format';

function isDone(p) {
  return p?.status === 'delivered' || p?.status === 'completed';
}

export default function PortalProjects() {
  const params = useParams();
  const routeId = (params['*'] || '').split('/')[0] || '';
  const [projects, setProjects] = useState([]);
  const [forms, setForms] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsAPI.list().then(setProjects).catch((err) => setError(err.message)).finally(() => setLoaded(true));
    questionnairesAPI.listResponses().then(setForms).catch(() => {});
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
    const labels = stageLabels(project.service);
    const current = Math.min(Number(project.stage || 0), labels.length - 1);
    const done = isDone(project);
    const signed = new Set((project.signoffs || []).map(Number));
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

            <section className="panel section" style={{ padding: '24px 24px 22px' }} aria-label="Project stages">
              <JourneyRail project={project} />
              <div style={{ marginTop: 24 }}>
                <div className="muted" style={{ fontSize: 13 }}>{done ? 'All done' : `Stage ${current + 1} of ${labels.length}`}</div>
                <div className="h-section">{done ? 'Your project has been delivered' : `We’re working on ${labels[current]}`}</div>
              </div>
            </section>

            <section className="section" aria-labelledby="st-h">
              <div className="section-h"><h2 id="st-h" className="h-section">Stages and files</h2></div>
              <ol className="panel rows" style={{ listStyle: 'none' }}>
                {labels.map((label, index) => {
                  const files = (project.files || []).filter((f) => Number(f.stage_index || 0) === index);
                  const stageForms = forms.filter((f) => f.project_id === project.id && Number(f.stage_index || 0) === index);
                  const state = done || index < current ? 'done' : index === current ? 'now' : 'next';
                  return (
                    <li key={label} className="row" style={{ cursor: 'default' }}>
                      <span className={`signal ${state === 'done' ? 'ok' : state === 'now' ? 'warn' : ''}`} style={state === 'next' ? { background: 'var(--line)' } : undefined} />
                      <span className="row-main">
                        <span className="row-title" style={{ display: 'block', color: state === 'next' ? 'var(--text-2)' : undefined }}>{index + 1}. {label}</span>
                        <span className="row-sub" style={{ display: 'block' }}>
                          {state === 'now' ? 'In progress' : state === 'done' ? 'Done' : 'Coming up'}{signed.has(index) ? ', approved by you' : ''}
                        </span>
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
                      </span>
                    </li>
                  );
                })}
              </ol>
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
