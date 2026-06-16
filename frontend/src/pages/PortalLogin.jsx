import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { USER_ROLES } from '../utils/api';

export default function PortalLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(form, { expectedRole: USER_ROLES.CLIENT });
      navigate(result.redirectTo || '/portal');
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--navy), #314976)' }}>
      <div style={{ background: '#fff', borderRadius: '18px', padding: '40px', width: '420px', boxShadow: '0 24px 60px rgba(0,0,0,.22)' }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '28px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '2px', marginBottom: '8px' }}>
          Client Portal
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-s)', marginBottom: '28px' }}>
          Sign in to review your project progress, invoices, documents, and messages.
        </div>

        {(error || authError) && (
          <div style={{ background: 'var(--err-bg)', color: 'var(--err)', padding: '10px 13px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error || authError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="fc">
            <div className="fc-label">Email</div>
            <input className="fi" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </div>
          <div className="fc">
            <div className="fc-label">Password</div>
            <input className="fi" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </div>
          <button className="btn bp" style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '8px', fontSize: '14px' }} disabled={loading}>
            {loading ? 'Please wait…' : 'Enter Portal'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-s)' }}>
          Studio owner? <span style={{ color: 'var(--navy)', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/login')}>Return to studio login</span>
        </div>
      </div>
    </div>
  );
}
