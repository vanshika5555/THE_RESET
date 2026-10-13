import React, { useState } from 'react';
import axios from 'axios';
import './AdminLogin.css';

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.role !== 'admin') {
        setError('This account is a customer account. Sign in with an admin account.');
        setLoading(false);
        return;
      }
      onLogin(res.data.token, res.data.name);
    } catch (err) {
      const msg = err.response
        ? (err.response.data?.message || `The server returned an error (${err.response.status}).`)
        : 'Cannot reach the server. Start it with npm start in the server folder.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <span className="login-logo">THE RESET</span>
        <span className="login-sub">Shop admin</span>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Sign in</h1>
        <p className="login-text">Manage orders, products and discount codes.</p>

        {error && <div className="note-error" role="alert"><span>{error}</span></div>}

        <div className="field">
          <label className="field-label" htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="admin-password">Password</label>
          <div className="input-group">
            <input
              id="admin-password"
              className="input"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-show"
              onClick={() => setShow((s) => !s)}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}