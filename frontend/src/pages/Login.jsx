import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
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

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
  }

  return (
    <AuthLayout
      eyebrow="Studio"
      title={mode === 'login' ? 'Welcome back' : 'Create your studio'}
      intro={mode === 'login' ? 'Sign in to your studio.' : 'Set up your studio account. You can invite clients to their own portal later.'}
      footer={
        <>
          <div>
            {mode === 'login'
              ? <>New to Vela? <button type="button" className="auth-link" onClick={() => switchMode('register')}>Create a studio account</button></>
              : <>Already have an account? <button type="button" className="auth-link" onClick={() => switchMode('login')}>Sign in</button></>}
          </div>
          <div style={{ marginTop: 8 }}>Are you a client? <button type="button" className="auth-link" onClick={() => navigate('/portal/login')}>Go to the client portal</button></div>
        </>
      }
    >
      {(error || authError) && <div className="form-error" role="alert">{error || authError}</div>}
      {notice && <div className="notice ok" role="status" style={{ marginBottom: 14 }}>{notice}</div>}

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <>
            <div className="fc"><label className="fc-label" htmlFor="reg-name">Your name</label><input id="reg-name" className="fi" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="fc"><label className="fc-label" htmlFor="reg-studio">Studio name</label><input id="reg-studio" className="fi" autoComplete="organization" value={form.studio_name} onChange={(e) => setForm({ ...form, studio_name: e.target.value })} /></div>
          </>
        )}
        <div className="fc"><label className="fc-label" htmlFor="auth-email">Email</label><input id="auth-email" className="fi" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="fc">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label className="fc-label" htmlFor="auth-pass">Password</label>
            {mode === 'login' && <button type="button" className="auth-link" style={{ fontSize: 12.5 }} onClick={handleResetPassword} disabled={loading}>Forgot password?</button>}
          </div>
          <input id="auth-pass" className="fi" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={mode === 'register' ? 6 : undefined} />
          {mode === 'register' && <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>At least 6 characters.</div>}
        </div>
        <button className="btn bp" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 6, fontSize: 14 }} disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create studio account'}
        </button>
      </form>
    </AuthLayout>
  );
}
