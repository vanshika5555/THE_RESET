import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import usePageMeta from '../hooks/usePageMeta';
import { useAuth } from '../context/AuthContext';
import { payWithRazorpay } from '../utils/razorpay';
import './GiftCards.css';

/*
  Gift cards: pick an amount, say who it's for, pay online. The card is
  emailed to them with a code that becomes store credit on their account.
*/

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DRAFT_KEY = 'theresetGiftDraft';

const readDraft = () => {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || null; } catch { return null; }
};

export default function GiftCards() {
  usePageMeta({
    title: 'Gift cards',
    description: 'Send a THE RESET gift card by email — they choose what they love. Never expires.',
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  const [opts, setOpts] = useState({ available: false, min: 500, max: 20000, presets: [1000, 2000, 3000, 5000] });
  const [loaded, setLoaded] = useState(false);
  const draft = readDraft();
  const [amount, setAmount] = useState(draft?.amount || 2000);
  const [custom, setCustom] = useState(draft?.custom || '');
  const [toName, setToName] = useState(draft?.toName || '');
  const [toEmail, setToEmail] = useState(draft?.toEmail || '');
  const [fromName, setFromName] = useState(draft?.fromName || user?.name?.split(' ')[0] || '');
  const [message, setMessage] = useState(draft?.message || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);           // the card once paid
  const [mine, setMine] = useState([]);

  useEffect(() => {
    axios.get('/api/giftcards/options').then((r) => setOpts(r.data)).catch(() => {}).finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    axios.get('/api/giftcards/mine').then((r) => setMine(r.data || [])).catch(() => {});
  }, [user, sent]);

  const value = custom ? Math.round(Number(custom)) : amount;
  const valid = value >= opts.min && value <= opts.max;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!valid) { setError(`Choose an amount between ${inr(opts.min)} and ${inr(opts.max)}.`); return; }
    if (!toName.trim()) { setError('Who is it for? Add their name.'); return; }
    if (!EMAIL_RE.test(toEmail.trim())) { setError('Add the email address we should send it to.'); return; }

    // Buying needs an account — keep what they typed while they sign in.
    if (!user) {
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ amount, custom, toName, toEmail, fromName, message })); } catch { /* fine */ }
      navigate('/login', { state: { from: '/gift-cards' } });
      return;
    }

    setBusy(true);
    try {
      const { data: card } = await axios.post('/api/giftcards', { amount: value, toName, toEmail, fromName, message });
      try {
        const paid = await payWithRazorpay({
          razorpay: card.razorpay,
          description: `Gift card for ${toName.trim()}`,
          prefill: { name: user.name, email: user.email },
        });
        const done = await axios.post(`/api/giftcards/${card._id}/pay`, paid);
        try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* fine */ }
        setSent(done.data);
        window.scrollTo(0, 0);
      } catch (payErr) {
        if (payErr && payErr.dismissed) {
          axios.post(`/api/giftcards/${card._id}/abandon`).catch(() => {});
          setError('Payment cancelled — nothing was charged.');
        } else {
          setError(payErr?.response?.data?.message || payErr?.message || 'The payment didn’t go through. Please try again.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start the gift card. Please try again.');
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <div className="gcp">
        <div className="gcp-done">
          <p className="gcp-eyebrow">Gift card sent</p>
          <h1 className="gcp-title">On its way to {sent.to?.name}.</h1>
          <p className="gcp-lede">
            We’ve emailed your {inr(sent.amount)} gift card to {sent.to?.email}. They add it to their account with the code
            in the email and it comes off at checkout. A receipt is on its way to you too.
          </p>
          <div className="gcp-done-actions">
            <button type="button" className="gcp-btn" onClick={() => { setSent(null); setToName(''); setToEmail(''); setMessage(''); }}>Send another</button>
            <Link to="/" className="gcp-btn gcp-btn--ghost">Back to the shop</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gcp">
      <header className="gcp-head">
        <p className="gcp-eyebrow">Gift cards</p>
        <h1 className="gcp-title">Let them choose.</h1>
        <p className="gcp-lede">Sent by email in minutes. It becomes store credit on their account and never expires.</p>
      </header>

      <div className="gcp-grid">
        {/* Preview */}
        <div className="gcp-preview" aria-hidden="true">
          <div className="gcp-card">
            <span className="gcp-card-brand">THE RESET</span>
            <span className="gcp-card-amount">{valid ? inr(value) : '₹—'}</span>
            <span className="gcp-card-to">
              {toName.trim() ? `For ${toName.trim()}` : 'For someone good'}
              {fromName.trim() ? ` · from ${fromName.trim()}` : ''}
            </span>
          </div>
          {message.trim() && <p className="gcp-card-note">“{message.trim()}”</p>}
        </div>

        {/* Form */}
        <form className="gcp-form" onSubmit={submit} noValidate>
          {loaded && !opts.available && (
            <p className="gcp-off" role="status">Gift cards go on sale as soon as online payment is switched on. Check back soon.</p>
          )}

          <fieldset className="gcp-amounts">
            <legend>Amount</legend>
            <div className="gcp-chips" role="radiogroup" aria-label="Amount">
              {opts.presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={!custom && amount === p}
                  className={`gcp-chip ${!custom && amount === p ? 'is-on' : ''}`}
                  onClick={() => { setAmount(p); setCustom(''); }}
                >{inr(p)}</button>
              ))}
            </div>
            <label className="gcp-field gcp-custom">
              <span>Or another amount</span>
              <input
                type="number"
                inputMode="numeric"
                min={opts.min}
                max={opts.max}
                step="100"
                placeholder={`${inr(opts.min)} – ${inr(opts.max)}`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
          </fieldset>

          <div className="gcp-row">
            <label className="gcp-field">
              <span>Their name</span>
              <input type="text" maxLength={60} autoComplete="off" value={toName} onChange={(e) => setToName(e.target.value)} />
            </label>
            <label className="gcp-field">
              <span>Their email</span>
              <input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
            </label>
          </div>
          <label className="gcp-field">
            <span>From</span>
            <input type="text" maxLength={60} value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your name" />
          </label>
          <label className="gcp-field">
            <span>Message <em>optional</em></span>
            <textarea rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Happy birthday — get the black shirt." />
            <small>{300 - message.length} left</small>
          </label>

          {error && <p className="gcp-error" role="alert">{error}</p>}

          <button type="submit" className="gcp-btn gcp-btn--wide" disabled={busy || (loaded && !opts.available)}>
            {busy ? 'Opening payment…' : `Pay ${valid ? inr(value) : ''} · send by email`}
          </button>
          <p className="gcp-fine">Paid online. Gift cards can’t be paid on delivery or with store credit, and can’t be exchanged for cash.</p>
        </form>
      </div>

      {mine.length > 0 && (
        <section className="gcp-mine">
          <h2 className="gcp-mine-title">Gift cards you’ve sent</h2>
          <ul>
            {mine.map((c) => (
              <li key={c._id}>
                <span><strong>{inr(c.amount)}</strong> to {c.to?.name} <em>{c.to?.email}</em></span>
                <span className={`gcp-status gcp-status--${c.status.toLowerCase()}`}>
                  {c.status === 'Redeemed' ? 'Added to their account' : c.status === 'Active' ? 'Sent · not used yet' : 'Cancelled'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="gcp-have">Got a gift card? <Link to="/profile/credit">Add it to your account</Link>.</p>
    </div>
  );
}
