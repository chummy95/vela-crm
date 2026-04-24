import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { projectsAPI, invoicesAPI } from '../utils/api';
import Pill from '../components/Pill';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    projectsAPI.list().then(setProjects).catch(console.error);
    invoicesAPI.list().then(setInvoices).catch(console.error);
  }, []);

  const unpaidTotal = invoices.filter(i => i.status === 'unpaid').length;
  const activeProjects = projects.filter(p => p.status === 'active').length;

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Good morning, {user?.name?.split(' ')[0] || 'Mayaa'} ✨</div>
        <div className="tb-r">
          <button className="btn bg bsm" onClick={() => navigate('/projects')}>+ New Project</button>
          <button className="btn bp bsm" onClick={() => navigate('/invoices')}>+ Invoice</button>
        </div>
      </div>
      <div className="content">
        <div className="stat-grid">
          <div className="stat-card" onClick={() => navigate('/invoices')}>
            <div className="stat-val">{unpaidTotal}</div>
            <div className="stat-label">Unpaid Invoices</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/projects')}>
            <div className="stat-val">{activeProjects}</div>
            <div className="stat-label">Active Projects</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/proposals')}>
            <div className="stat-val">Proposals</div>
            <div className="stat-label">Manage Proposals</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/clients')}>
            <div className="stat-label">View All Clients →</div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div className="card-title">Active Projects</div>
            <button className="btn bg bsm" onClick={() => navigate('/projects')}>View All</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Service</th><th>Stage</th><th>Status</th></tr></thead>
            <tbody>
              {projects.slice(0,5).map(p => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                  <td><b>{p.client_name}</b></td>
                  <td>{p.service}</td>
                  <td>Stage {p.stage + 1}</td>
                  <td><Pill status={p.status} /></td>
                </tr>
              ))}
              {projects.length === 0 && <tr><td colSpan="4" style={{ color:'var(--text-s)', textAlign:'center', padding:'24px' }}>No projects yet — create your first one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
