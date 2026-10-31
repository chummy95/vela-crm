import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { authAPI, USER_ROLES } from '../utils/api';
import { takeReturn } from '../utils/returnTo';

export default function PortalLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const result = await login(form, { expectedRole: USER_ROLES.CLIENT });
      navigate(takeReturn('client') || result.redirectTo || '/portal');
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setLoading(true);
    setError('');
    setNotice('');

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
    <AuthLayout
      eyebrow="Client portal"
      title="Your project, in one place"
      intro="Sign in with the email and password your studio gave you."
      footer={<>Run the studio? <button type="button" className="auth-link" onClick={() => navigate('/login')}>Studio sign in</button></>}
    >
      {(error || authError) && <div className="form-error" role="alert">{error || authError}</div>}
      {notice && <div className="notice ok" role="status" style={{ marginBottom: 14 }}>{notice}</div>}
      <form onSubmit={handleSubmit}>
        <div className="fc"><label className="fc-label" htmlFor="portal-email">Email</label><input id="portal-email" className="fi" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="fc">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label className="fc-label" htmlFor="portal-pass">Password</label>
            <button type="button" className="auth-link" style={{ fontSize: 12.5 }} onClick={handleResetPassword} disabled={loading}>Forgot password?</button>
          </div>
          <input id="portal-pass" className="fi" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        <button className="btn bp" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 6, fontSize: 14 }} disabled={loading}>
          {loading ? 'Please wait…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
