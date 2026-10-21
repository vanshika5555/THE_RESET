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
const KIND = { refund: 'Return refunded as credit', spent: 'Used at checkout', returned: 'Given back', adjust: 'From THE RESET', giftcard: 'Gift card added' };

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
