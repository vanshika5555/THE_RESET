import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './NotifyMe.css';

/**
 * Shown when a shopper picks a sold-out size.
 * Signed in: one tap. Guest: type an email.
 */
export default function NotifyMe({ productId, size }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await axios.post('/api/alerts', { product: productId, size, email: user ? undefined : email.trim() });
      setDone(res.data?.message || `We'll email you when size ${size} is back.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that. Please try again.');
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="nm nm--done" role="status">
        <span className="nm-dot" aria-hidden="true" />
        {done}
      </div>
    );
  }

  return (
    <form className="nm" onSubmit={submit}>
      <p className="nm-title">Size {size} is sold out</p>
      <p className="nm-text">Get one email the moment it's back. Nothing else.</p>
      <div className="nm-row">
        {!user && (
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="your@email.com"
            aria-label="Your email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
          />
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : user ? `Email me when ${size} is back` : 'Notify me'}
        </button>
      </div>
      {error && <p className="nm-error" role="alert">{error}</p>}
    </form>
  );
}
