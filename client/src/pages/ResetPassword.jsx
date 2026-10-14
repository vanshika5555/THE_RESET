import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField, { passwordProblem } from '../components/PasswordField';
import usePageMeta from '../hooks/usePageMeta';
import './AuthPage.css';

export default function ResetPassword() {
  const { token } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  usePageMeta({ title: 'Choose a new password' });

  const change = (e) => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(form.password);
    if (problem) { setError(problem); return; }
    if (form.password !== form.confirm) { setError('The two passwords do not match.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/reset-password', { token, password: form.password });
      login(res.data);                       // signed straight in
      navigate('/profile', { replace: true, state: { notice: 'Password updated. You are signed in.' } });
    } catch (err) {
      const msg = err.response?.data?.message || 'Cannot reach the server. Please try again in a moment.';
      if (/expired|not valid|already used/i.test(msg)) setExpired(true);
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">THE RESET</div>

        {expired ? (
          <div className="auth-done">
            <h1 className="auth-heading">This link has expired</h1>
            <p className="auth-lead">Reset links work once and only for 30 minutes. Request a fresh one — it takes a few seconds.</p>
            <Link to="/forgot-password" className="auth-submit auth-submit--link">Send a new link</Link>
          </div>
        ) : (
          <>
            <h1 className="auth-heading">Choose a new password</h1>
            <p className="auth-lead">You'll be signed in straight away, and signed out on every other device.</p>

            <form className="auth-form" onSubmit={submit}>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <PasswordField
                label="New password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={change}
                required
                autoFocus
                hint="8 or more characters, with a letter and a number."
              />
              <PasswordField
                label="Repeat new password"
                name="confirm"
                id="confirm"
                autoComplete="new-password"
                value={form.confirm}
                onChange={change}
                required
              />
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save and sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
