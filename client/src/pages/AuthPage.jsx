import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField, { passwordProblem } from '../components/PasswordField';
import usePageMeta from '../hooks/usePageMeta';
import './AuthPage.css';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  usePageMeta({ title: mode === 'login' ? 'Sign in' : 'Create account' });

  // Redirect back to where they came from after login
  const from = location.state?.from || '/';

  const switchTo = (m) => { setMode(m); setError(''); };

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      const problem = passwordProblem(form.password);
      if (problem) { setError(problem); return; }
    }

    setLoading(true);
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login'
        ? { email: form.email.trim(), password: form.password }
        : { name: form.name.trim(), email: form.email.trim(), password: form.password };

      const res = await axios.post(url, payload);
      // Admin accounts with 2-step verification sign in from the admin panel.
      if (res.data.twoFactorRequired) {
        setError('This account uses 2-step verification. Sign in from the admin panel.');
        setLoading(false);
        return;
      }
      login(res.data);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot reach the server. Please try again in a moment.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-box">

        <div className="auth-brand">THE RESET</div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => switchTo('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
            onClick={() => switchTo('signup')}
          >
            Create Account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate={false}>
          {error && <div className="auth-error" role="alert">{error}</div>}

          {mode === 'signup' && (
            <div className="auth-field">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              placeholder="your@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <PasswordField
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? '••••••••' : 'At least 8 characters'}
            value={form.password}
            onChange={handleChange}
            required
            hint={mode === 'signup' ? '8 or more characters, with a letter and a number.' : null}
          />

          {mode === 'login' && (
            <Link to="/forgot-password" state={{ email: form.email }} className="auth-forgot">
              Forgot password?
            </Link>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="auth-switch-btn"
            onClick={() => switchTo(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

      </div>
    </div>
  );
}
