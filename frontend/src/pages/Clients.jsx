import React, { useEffect, useState } from 'react';
import { clientsAPI } from '../utils/api';
import Modal from '../components/Modal';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name:'', contact:'', email:'', location:'', industry:'Beauty & Wellness', color:'#1B2B4B' });

  useEffect(() => { clientsAPI.list().then(setClients).catch((err) => setError(err.message)); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const c = await clientsAPI.create(form);
      setClients(prev => [c, ...prev]);
      setModal(false);
      setError('');
      setForm({ name:'', contact:'', email:'', location:'', industry:'Beauty & Wellness', color:'#1B2B4B' });
    } catch (err) {
      setError(err.message);
    }
  }

  const INDUSTRIES = ['Beauty & Wellness','Fashion & Lifestyle','Hospitality','Interiors','Other'];

  return (
    <>
      <div className="topbar">
        <div className="tb-title">Clients</div>
        <div className="tb-r"><button className="btn bp bsm" onClick={() => setModal(true)}>+ Add Client</button></div>
      </div>
      <div className="content">
        {error && <div className="card" style={{ padding:'16px', color:'var(--err)' }}>{error}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px' }}>
          {clients.map(c => (
            <div key={c.id} className="card" style={{ cursor:'pointer' }}>
              <div style={{ height:'72px', background:c.color||'var(--navy)', padding:'16px 18px' }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'17px', fontWeight:700, color:'#fff' }}>{c.name}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,.6)', marginTop:'2px' }}>{c.industry} · {c.location}</div>
              </div>
              <div style={{ padding:'14px 18px' }}>
                <div style={{ fontSize:'13px', fontWeight:600, color:'var(--navy)' }}>{c.contact}</div>
                <div style={{ fontSize:'11.5px', color:'var(--text-s)', marginTop:'2px' }}>{c.email}</div>
              </div>
            </div>
          ))}
          {clients.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-s)', padding:'40px' }}>No clients yet.</div>}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Client"
        footer={<><button className="btn bg" onClick={() => setModal(false)}>Cancel</button><button className="btn bp" onClick={handleCreate}>Add Client</button></>}>
        <form onSubmit={handleCreate}>
          <div className="fc"><div className="fc-label">Brand Name</div><input className="fi" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Contact Name</div><input className="fi" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} /></div>
            <div className="fc"><div className="fc-label">Email</div><input className="fi" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          </div>
          <div className="fi-row">
            <div className="fc"><div className="fc-label">Location</div><input className="fi" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} /></div>
            <div className="fc"><div className="fc-label">Industry</div>
              <select className="fi fsel" value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})}>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div className="fc"><div className="fc-label">Brand Colour</div><input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})} style={{ width:'40px', height:'32px', borderRadius:'6px', border:'1.5px solid var(--border)', cursor:'pointer' }} /></div>
        </form>
      </Modal>
    </>
  );
}
