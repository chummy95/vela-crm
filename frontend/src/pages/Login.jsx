import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../hooks/useAuth';
import { authAPI, USER_ROLES } from '../utils/api';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', studio_name: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, error: authError } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(''); setNotice('');
    try {
      if (mode === 'login') {
        const result = await login({ email: form.email, password: form.password }, { expectedRole: USER_ROLES.STUDIO });
        navigate(result.redirectTo || '/');
      } else {
        const result = await register(form);
        navigate(result.redirectTo || '/');
      }
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const result = await authAPI.resetPassword(form.email);
      setNotice(result.message);
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--navy)' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'40px', width:'400px', boxShadow:'0 24px 60px rgba(0,0,0,.25)' }}>
        <BrandLogo variant="blueTagline" width={126} alt="Vela CRM" style={{ margin:'0 auto 14px' }} />
        <div style={{ fontSize:'13px', color:'var(--text-s)', marginBottom:'28px' }}>
          {mode === 'login' ? 'Welcome back' : 'Create your studio account'}
        </div>

        {(error || authError) && <div style={{ background:'var(--err-bg)', color:'var(--err)', padding:'10px 13px', borderRadius:'8px', fontSize:'13px', marginBottom:'16px' }}>{error || authError}</div>}
        {notice && <div style={{ background:'rgba(41, 128, 90, 0.12)', color:'#236241', padding:'10px 13px', borderRadius:'8px', fontSize:'13px', marginBottom:'16px' }}>{notice}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && <>
            <div className="fc"><div className="fc-label">Your Name</div><input className="fi" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
            <div className="fc"><div className="fc-label">Studio Name</div><input className="fi" value={form.studio_name} onChange={e=>setForm({...form,studio_name:e.target.value})} /></div>
          </>}
          <div className="fc"><div className="fc-label">Email</div><input className="fi" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></div>
          <div className="fc"><div className="fc-label">Password</div><input className="fi" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></div>
          {mode === 'login' && (
            <div style={{ marginTop:'-4px', marginBottom:'14px', textAlign:'right' }}>
              <button
                type="button"
                onClick={handleResetPassword}
                style={{ background:'none', border:'none', padding:0, color:'var(--navy)', fontSize:'12px', fontWeight:600, cursor:'pointer' }}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}
          <button className="btn bp" style={{ width:'100%', justifyContent:'center', padding:'11px', marginTop:'8px', fontSize:'14px' }} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop:'16px', textAlign:'center', fontSize:'13px', color:'var(--text-s)' }}>
          {mode === 'login' ? <>No account? <span style={{ color:'var(--navy)', fontWeight:600, cursor:'pointer' }} onClick={()=>{ setMode('register'); setError(''); setNotice(''); }}>Sign up</span></> : <>Have an account? <span style={{ color:'var(--navy)', fontWeight:600, cursor:'pointer' }} onClick={()=>{ setMode('login'); setError(''); setNotice(''); }}>Sign in</span></>}
        </div>

        <div style={{ marginTop:'12px', textAlign:'center', fontSize:'12px', color:'var(--text-s)' }}>
          Client access? <span style={{ color:'var(--navy)', fontWeight:600, cursor:'pointer' }} onClick={() => navigate('/portal/login')}>Open client portal</span>
        </div>

        <div style={{ marginTop:'16px', padding:'12px', background:'var(--card)', borderRadius:'8px', fontSize:'11.5px', color:'var(--text-s)' }}>
          Studio owners sign in here. Client portal accounts use a separate login linked to the same Firebase project.
        </div>
      </div>
    </div>
  );
}
