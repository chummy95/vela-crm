import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import { projectsAPI } from '../utils/api';
import { STAGES } from '../utils/constants';

function stageLabels(service) {
  const normalized = String(service || '').toLowerCase();
  if (normalized.includes('pack')) return STAGES.packaging;
  if (normalized.includes('web')) return STAGES.web;
  return STAGES.brand;
}

export default function PortalProjects() {
  const navigate = useNavigate();
  const params = useParams();
  const routeProjectId = (params['*'] || '').split('/')[0] || '';
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsAPI.list().then(setProjects).catch((loadError) => setError(loadError.message));
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === routeProjectId) || null,
    [projects, routeProjectId]
  );

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Projects</div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding: 16, color: 'var(--err)' }}>{error}</div>}
        <div className="card">
          <div className="card-h">
            <div className="card-title">Shared Projects</div>
            <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{projects.length} total</div>
          </div>
          <table className="tbl">
            <thead><tr><th>Service</th><th>Timeline</th><th>Current Output</th><th>Status</th></tr></thead>
            <tbody>
              {projects.map((project) => {
                const labels = stageLabels(project.service);
                const stage = Number(project.stage || 0);
                return (
                  <tr key={project.id} onClick={() => navigate(`/portal/projects/${project.id}`)}>
                    <td><b>{project.service || '—'}</b></td>
                    <td>{project.timeline || '—'}</td>
                    <td>{labels[stage] || `Stage ${stage + 1}`}</td>
                    <td><Pill status={project.status} /></td>
                  </tr>
                );
              })}
              {!projects.length && <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-s)' }}>No projects are available in your portal yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedProject)}
        onClose={() => navigate('/portal/projects')}
        title={selectedProject ? selectedProject.service : 'Project'}
        footer={<button className="btn bp" type="button" onClick={() => navigate('/portal/projects')}>Close</button>}
      >
        {selectedProject && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedProject.value || '—'}</div><div className="stat-label">Project Value</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{selectedProject.start_date || '—'}</div><div className="stat-label">Start Date</div></div>
              <div className="stat-card"><div className="stat-val" style={{ fontSize: 20 }}>{Number(selectedProject.stage || 0) + 1}</div><div className="stat-label">Current Stage</div></div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-h">
                <div className="card-title">Current Output</div>
                <Pill status={selectedProject.status} />
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                  {stageLabels(selectedProject.service)[Number(selectedProject.stage || 0)] || 'Current stage'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-s)' }}>
                  {selectedProject.budget || 'The studio will use this space to keep your stage notes and progress aligned.'}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-h"><div className="card-title">Deliverables</div></div>
              <div style={{ padding: 18 }}>
                {(selectedProject.files || []).map((file) => (
                  <div key={file.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-s)' }}>
                      {stageLabels(selectedProject.service)[Number(file.stage_index || 0)] || `Stage ${Number(file.stage_index || 0) + 1}`}
                      {file.file_type ? ` · ${file.file_type}` : ''}
                    </div>
                  </div>
                ))}
                {!(selectedProject.files || []).length && <div style={{ color: 'var(--text-s)', fontSize: 13 }}>No deliverables have been posted yet.</div>}
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
