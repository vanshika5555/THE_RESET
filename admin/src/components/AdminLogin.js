import React, { useState } from 'react';
import axios from 'axios';

const wrap = {
  minHeight: '100vh', display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: '#111', fontFamily: 'inherit',
};
const card = {
  background: '#fff', padding: '40px', width: '100%', maxWidth: '380px',
  borderRadius: '6px', boxShadow: '0 10px 40px rgba(0,0,0,.3)',
};
const label = {
  display: 'block', fontSize: '11px', letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#666', marginBottom: '6px',
};
const input = {
  width: '100%', padding: '12px', marginBottom: '18px', font: 'inherit',
  border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box',
};
const button = {
  width: '100%', padding: '13px', background: '#111', color: '#fff',
  border: 'none', borderRadius: '4px', font: 'inherit', letterSpacing: '.06em',
  textTransform: 'uppercase', cursor: 'pointer',
};
const errBox = {
  background: '#fef2f2', color: '#b91c1c', padding: '12px',
  borderRadius: '4px', marginBottom: '18px', fontSize: '14px',
};

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.role !== 'admin') {
        setError('That account is not an admin.');
        setLoading(false);
        return;
      }
      onLogin(res.data.token, res.data.name);
    } catch (err) {
      const msg = err.response
        ? (err.response.data?.message || `Server error (${err.response.status}).`)
        : 'Cannot reach the server. Is the backend running?';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <form style={card} onSubmit={handleSubmit}>
        <h1 style={{ margin: '0 0 4px', fontSize: '22px', letterSpacing: '.1em' }}>THE RESET</h1>
        <p style={{ margin: '0 0 28px', fontSize: '12px', letterSpacing: '.1em', color: '#888', textTransform: 'uppercase' }}>
          Admin Access
        </p>

        {error && <div style={errBox}>{error}</div>}

        <label style={label} htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          style={input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />

        <label style={label} htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          style={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button style={button} type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}