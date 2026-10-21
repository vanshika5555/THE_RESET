import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './StoreCredit.css';

/*
  Profile → Store credit: the balance and every line in or out.
  Credit comes from returns refunded as credit (or a goodwill top-up from
  us) and comes off automatically at checkout.
*/

const inr = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')}`;
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const KIND = { refund: 'Return refunded as credit', spent: 'Used at checkout', returned: 'Given back', adjust: 'From THE RESET', giftcard: 'Gift card added', referral: 'Invite a friend' };

// "Give ₹200, get ₹200": the shopper's invite link, a share button and how it's going.
function InviteFriends() {
  const [ref, setRef] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { axios.get('/api/auth/referral').then((r) => setRef(r.data)).catch(() => {}); }, []);
  if (!ref?.on) return null;

  const message = `I shop at THE RESET — sign up with my link and we both get ${inr(ref.reward)} to spend: ${ref.link}`;
  const share = async () => {
    const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (touch && navigator.share) {
      try { await navigator.share({ title: 'THE RESET', text: message }); return; } catch { /* closed */ }
    }
    try { await navigator.clipboard.writeText(ref.link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* fine */ }
  };

  return (
    <section className="sc-invite" aria-labelledby="sc-invite-title">
      <h3 className="sc-head" id="sc-invite-title">Invite a friend</h3>
      <p className="sc-invite-lede">
        <strong>Give {inr(ref.reward)}, get {inr(ref.reward)}.</strong> When a friend signs up with your link and their first order
        {ref.min ? ` of ${inr(ref.min)}+` : ''} arrives, you both get {inr(ref.reward)} store credit.
      </p>
      <div className="sc-invite-row">
        <code className="sc-invite-link">{ref.link.replace(/^https?:\/\//, '')}</code>
        <button type="button" className="sc-invite-btn" onClick={share}>{copied ? 'Link copied' : 'Share link'}</button>
      </div>
      <a className="sc-invite-wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>
      {ref.joined > 0 && (
        <p className="sc-invite-stats">
          {ref.joined} friend{ref.joined === 1 ? '' : 's'} joined · {ref.rewarded} first order{ref.rewarded === 1 ? '' : 's'} arrived
          {ref.rewarded > 0 && ` · ${inr(ref.rewarded * ref.reward)} earned`}
        </p>
      )}
    </section>
  );
}

export default function StoreCredit() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Gift card: the email's button fills the code in (?redeem=…).
  const [code, setCode] = useState(params.get('redeem') || '');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState(null);   // { ok, text }

  const load = () => axios.get('/api/auth/credit')
    .then((r) => setData(r.data))
    .catch(() => setError('Could not load your store credit. Try again in a moment.'));
  useEffect(() => { load(); }, []);

  const redeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setRedeeming(true); setRedeemMsg(null);
    try {
      const r = await axios.post('/api/giftcards/redeem', { code });
      setRedeemMsg({ ok: true, text: `${inr(r.data.added)} added${r.data.fromName ? ` — a gift from ${r.data.fromName}` : ''}.` });
      setCode('');
      if (params.get('redeem')) { params.delete('redeem'); setParams(params, { replace: true }); }
      load();
    } catch (err) {
      setRedeemMsg({ ok: false, text: err.response?.data?.message || 'Could not add that gift card. Please try again.' });
    }
    setRedeeming(false);
  };

  if (error) return <div className="prof-section"><p className="sc-error">{error}</p></div>;
  if (!data) return <div className="prof-loading">Loading…</div>;

  return (
    <div className="prof-section">
      <h2 className="prof-section-title">Store credit</h2>

      <div className="sc-balance">
        <p className="sc-amount">{inr(data.balance)}</p>
        <p className="sc-sub">
          {data.balance > 0
            ? 'Comes off your next order automatically at checkout. It doesn’t expire.'
            : 'No credit right now. When you return something you can choose store credit — it’s ready the moment the pieces reach us.'}
        </p>
        {data.balance > 0 && <Link to="/" className="sc-btn">Start shopping</Link>}
      </div>

      <form className="sc-redeem" onSubmit={redeem}>
        <label htmlFor="sc-code">Have a gift card?</label>
        <div className="sc-redeem-row">
          <input
            id="sc-code"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="RESET-XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" disabled={redeeming || !code.trim()}>{redeeming ? 'Adding…' : 'Add'}</button>
        </div>
        {redeemMsg && <p className={`sc-redeem-msg ${redeemMsg.ok ? 'is-ok' : ''}`} role="status">{redeemMsg.text}</p>}
        <p className="sc-redeem-hint">Want to send one? <Link to="/gift-cards">Gift cards</Link></p>
      </form>

      <InviteFriends />

      {data.history.length > 0 && (
        <>
          <h3 className="sc-head">Statement</h3>
          <ul className="sc-list">
            {data.history.map((h) => (
              <li key={h._id} className="sc-row">
                <span className="sc-what">
                  <span className="sc-note">{h.kind === 'adjust' && h.note ? h.note : KIND[h.kind]}</span>
                  <span className="sc-meta">
                    {fmt(h.createdAt)}
                    {h.kind !== 'adjust' && h.note ? ` · ${h.note}` : ''}
                    {h.order && <> · <Link to={`/orders/${h.order}`}>View order</Link></>}
                  </span>
                </span>
                <span className="sc-nums">
                  <span className={`sc-amt ${h.amount > 0 ? 'sc-amt--in' : ''}`}>{h.amount > 0 ? '+' : '−'} {inr(Math.abs(h.amount))}</span>
                  <span className="sc-bal">Balance {inr(h.balance)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
