import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { DROP, dropWhen, timeLeft } from '../utils/drops';
import './DropPanel.css';

const pad = (n) => String(n).padStart(2, '0');

/**
 * In place of Add to Bag while a piece is still to drop: when it goes live,
 * a countdown, and one email the moment it does.
 */
export default function DropPanel({ product, now }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const left = timeLeft(new Date(product.dropAt).getTime() - now);
  const cells = [
    ...(left.d > 0 ? [[left.d, left.d === 1 ? 'Day' : 'Days']] : []),
    [pad(left.h), 'Hrs'], [pad(left.m), 'Min'], [pad(left.s), 'Sec'],
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await axios.post('/api/alerts', { product: product._id, size: DROP, email: user ? undefined : email.trim() });
      setDone(res.data?.message || 'Done — we’ll email you the moment it drops.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that. Please try again.');
    }
    setBusy(false);
  };

  return (
    <section className="dp" aria-label="Upcoming drop">
      <p className="dp-eyebrow">The drop</p>
      <p className="dp-when">Goes live {dropWhen(product.dropAt)}</p>
      <div className="dp-clock" role="timer" aria-live="off" aria-label={`${left.d} days ${left.h} hours ${left.m} minutes left`}>
        {cells.map(([n, label]) => (
          <span key={label} className="dp-cell"><strong>{n}</strong><small>{label}</small></span>
        ))}
      </div>

      {done ? (
        <p className="dp-done" role="status"><span aria-hidden="true">✓</span> {done}</p>
      ) : (
        <form className="dp-form" onSubmit={submit}>
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
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Email me when it drops'}</button>
        </form>
      )}
      {error && <p className="dp-error" role="alert">{error}</p>}
      <p className="dp-fine">One email when it goes live. Sizes are limited and go first come, first served.</p>
    </section>
  );
}
