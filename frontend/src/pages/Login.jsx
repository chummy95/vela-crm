import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', studio_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, error: authError } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
      navigate('/');
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--navy)' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'40px', width:'400px', boxShadow:'0 24px 60px rgba(0,0,0,.25)' }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'28px', fontWeight:700, color:'var(--navy)', letterSpacing:'3px', marginBottom:'6px' }}>
          VEL<span style={{ color:'var(--gold)' }}>A</span>
        </div>
        <div style={{ fontSize:'13px', color:'var(--text-s)', marginBottom:'28px' }}>
          {mode === 'login' ? 'Welcome back' : 'Create your studio account'}
        </div>

        {(error || authError) && <div style={{ background:'var(--err-bg)', color:'var(--err)', padding:'10px 13px', borderRadius:'8px', fontSize:'13px', marginBottom:'16px' }}>{error || authError}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && <>
            <div className="fc"><div className="fc-label">Your Name</div><input className="fi" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
            <div className="fc"><div className="fc-label">Studio Name</div><input className="fi" value={form.studio_name} onChange={e=>setForm({...form,studio_name:e.target.value})} /></div>
          </>}
          <div className="fc"><div className="fc-label">Email</div><input className="fi" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></div>
          <div className="fc"><div className="fc-label">Password</div><input className="fi" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></div>
          <button className="btn bp" style={{ width:'100%', justifyContent:'center', padding:'11px', marginTop:'8px', fontSize:'14px' }} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop:'16px', textAlign:'center', fontSize:'13px', color:'var(--text-s)' }}>
          {mode === 'login' ? <>No account? <span style={{ color:'var(--navy)', fontWeight:600, cursor:'pointer' }} onClick={()=>setMode('register')}>Sign up</span></> : <>Have an account? <span style={{ color:'var(--navy)', fontWeight:600, cursor:'pointer' }} onClick={()=>setMode('login')}>Sign in</span></>}
        </div>

        <div style={{ marginTop:'16px', padding:'12px', background:'var(--card)', borderRadius:'8px', fontSize:'11.5px', color:'var(--text-s)' }}>
          This app now uses Firebase Auth and Firestore. Make sure your Firebase web config is set in <code>frontend/.env</code> or <code>frontend/.env.local</code>.
        </div>
      </div>
    </div>
  );
}
