import React, { useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import './AuthPage.css';

export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  usePageMeta({ title: 'Forgot password' });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(res.data?.message || 'Check your inbox for a reset link.');
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot reach the server. Please try again in a moment.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">THE RESET</div>

        {sent ? (
          <div className="auth-done">
            <div className="auth-done-icon" aria-hidden="true">✉</div>
            <h1 className="auth-heading">Check your email</h1>
            <p className="auth-lead">{sent}</p>
            <p className="auth-lead auth-lead--small">The link works once and expires in 30 minutes.</p>
            <button type="button" className="auth-switch-btn" onClick={() => setSent('')}>
              Use a different email
            </button>
            <Link to="/login" className="auth-submit auth-submit--link">Back to sign in</Link>
          </div>
        ) : (
          <>
            <h1 className="auth-heading">Forgot your password?</h1>
            <p className="auth-lead">Enter the email you shop with and we'll send you a link to choose a new one.</p>

            <form className="auth-form" onSubmit={submit}>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <div className="auth-field">
                <label htmlFor="fp-email">Email Address</label>
                <input
                  id="fp-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p className="auth-switch">
              Remembered it? <Link to="/login" className="auth-switch-btn">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
