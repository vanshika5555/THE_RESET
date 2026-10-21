import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { cdn } from '../utils/img';
import './ReturnPanel.css';

const STEPS = {
  return:   ['Requested', 'Approved', 'Received', 'Refunded'],
  exchange: ['Requested', 'Approved', 'Received', 'Exchanged'],
};

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Returns & exchanges for one delivered order:
 * shows any requests already made, and the form to start a new one.
 */
// "₹990 to name@okaxis + ₹500 as store credit"
function refundWords(rf = {}) {
  const r = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')}`;
  if (rf.method === 'credit') return `${r(rf.amount)} as store credit`;
  const where = rf.method === 'upi' ? `to ${rf.upi}` : 'to your original payment';
  const c = Number(rf.creditAmount) || 0;
  return c > 0 ? `${r(rf.amount - c)} ${where} + ${r(c)} as store credit` : `${r(rf.amount)} ${where}`;
}

export default function ReturnPanel({ orderId, delivered }) {
  const [requests, setRequests] = useState([]);
  const [options, setOptions] = useState(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('exchange');
  const [picked, setPicked] = useState({});         // orderItem -> { qty, exchangeSize }
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [upi, setUpi] = useState('');               // where cash-order refunds go
  const [refundTo, setRefundTo] = useState('money');  // money back, or store credit
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(() => {
    axios.get(`/api/returns/mine?order=${orderId}`).then(r => setRequests(r.data || [])).catch(() => {});
    if (delivered) axios.get(`/api/returns/options/${orderId}`).then(r => setOptions(r.data)).catch(() => {});
  }, [orderId, delivered]);

  useEffect(load, [load]);

  const toggle = (it) => setPicked(p => {
    const next = { ...p };
    if (next[it.orderItem]) delete next[it.orderItem];
    else next[it.orderItem] = { qty: 1, exchangeSize: '' };
    return next;
  });
  const setLine = (id, patch) => setPicked(p => ({ ...p, [id]: { ...p[id], ...patch } }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const items = Object.entries(picked).map(([orderItem, v]) => ({ orderItem, ...v }));
    if (!items.length) { setError('Pick at least one piece.'); return; }
    if (type === 'exchange' && items.some(i => !i.exchangeSize)) { setError('Pick the new size for each piece.'); return; }
    if (!reason) { setError('Choose a reason.'); return; }
    const asCredit = options?.refundTo === 'credit' || refundTo === 'credit';
    const needsUpi = type === 'return' && options?.refundTo === 'upi' && !asCredit;
    if (needsUpi && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/.test(upi.trim())) {
      setError('Enter the UPI ID for your refund, like name@okaxis.'); return;
    }

    setSending(true);
    try {
      await axios.post('/api/returns', {
        orderId, type, reason, note, items,
        refundTo: type === 'return' && asCredit ? 'credit' : undefined,
        refundUpi: needsUpi ? upi.trim() : undefined,
      });
      setOpen(false); setPicked({}); setReason(''); setNote(''); setSent(true);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the request. Please try again.');
    }
    setSending(false);
  };

  const anyLeft = options?.items?.some(i => i.available > 0);
  const canStart = options?.eligible && anyLeft;

  if (!requests.length && !delivered) return null;

  return (
    <section className="rp" aria-labelledby="rp-title">
      <h2 id="rp-title" className="od-section-title">Returns &amp; exchanges</h2>

      {sent && <p className="rp-sent" role="status">Request sent. We'll reply by email within 1 working day.</p>}

      {requests.map(r => {
        const steps = STEPS[r.type];
        const at = steps.indexOf(r.status);
        return (
          <div key={r._id} className={`rp-card ${r.status === 'Rejected' ? 'rp-card--rejected' : ''}`}>
            <div className="rp-card-head">
              <strong>{r.type === 'exchange' ? 'Exchange' : 'Return'} · {fmt(r.createdAt)}</strong>
              <span className="rp-status">{r.status}</span>
            </div>
            <ul className="rp-lines">
              {r.items.map((i, k) => (
                <li key={k}>
                  {i.name} — size {i.size}{i.exchangeSize ? ` → ${i.exchangeSize}` : ''} × {i.qty}
                </li>
              ))}
            </ul>
            {r.status !== 'Rejected' && (
              <ol className="rp-steps" aria-label="Progress">
                {steps.map((s, k) => (
                  <li key={s} className={k <= at ? 'is-done' : ''}>{s}</li>
                ))}
              </ol>
            )}
            {r.type === 'return' && r.refund?.amount > 0 && r.status !== 'Rejected' && (
              <p className="rp-refund">
                {r.status === 'Refunded'
                  ? `${refundWords(r.refund)} refunded${r.refund.reference ? ` · ref ${r.refund.reference}` : ''}`
                  : `Refund: ${refundWords(r.refund)}, once the pieces reach us`}
              </p>
            )}
            {r.shopMessage && <p className="rp-msg"><strong>From us:</strong> {r.shopMessage}</p>}
          </div>
        );
      })}

      {delivered && options && !canStart && !requests.length && (
        <p className="rp-closed">
          {options.eligible ? 'Every piece in this order already has a request.' : 'The 7-day return window for this order has closed.'}
        </p>
      )}

      {canStart && !open && (
        <div className="rp-start">
          <button type="button" className="rp-btn" onClick={() => { setOpen(true); setSent(false); }}>
            Return or exchange
          </button>
          <span>{options.daysLeft} day{options.daysLeft === 1 ? '' : 's'} left to ask</span>
        </div>
      )}

      {open && (
        <form className="rp-form" onSubmit={submit}>
          <div className="rp-seg" role="radiogroup" aria-label="What would you like?">
            {[['exchange', 'Exchange for another size'], ['return', 'Return for a refund']].map(([v, l]) => (
              <button
                type="button"
                key={v}
                role="radio"
                aria-checked={type === v}
                className={type === v ? 'is-on' : ''}
                onClick={() => setType(v)}
              >{l}</button>
            ))}
          </div>

          <fieldset className="rp-items">
            <legend>Which pieces?</legend>
            {options.items.map(it => {
              const on = !!picked[it.orderItem];
              const gone = it.available <= 0;
              return (
                <div key={it.orderItem} className={`rp-item ${on ? 'is-on' : ''} ${gone ? 'is-gone' : ''}`}>
                  <label className="rp-item-main">
                    <input type="checkbox" checked={on} disabled={gone} onChange={() => toggle(it)} />
                    <span className="rp-item-img">{it.image && <img src={cdn(it.image, 120)} alt="" />}</span>
                    <span className="rp-item-text">
                      <span className="rp-item-name">{it.name}</span>
                      <span className="rp-item-meta">Size {it.size}{gone ? ' · already requested' : ''}</span>
                    </span>
                  </label>
                  {on && (
                    <div className="rp-item-opts">
                      {it.available > 1 && (
                        <label>Qty
                          <select value={picked[it.orderItem].qty} onChange={e => setLine(it.orderItem, { qty: Number(e.target.value) })}>
                            {Array.from({ length: it.available }, (_, k) => k + 1).map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                      )}
                      {type === 'exchange' && (
                        <label>New size
                          <select
                            value={picked[it.orderItem].exchangeSize}
                            onChange={e => setLine(it.orderItem, { exchangeSize: e.target.value })}
                            required
                          >
                            <option value="">Choose</option>
                            {it.sizes.filter(s => s !== it.size).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          <label className="rp-field">Reason
            <select value={reason} onChange={e => setReason(e.target.value)} required>
              <option value="">Choose a reason</option>
              {options.reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label className="rp-field">Anything else? <span>(optional)</span>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Fits well on the shoulders but the sleeves are long" />
          </label>

          {type === 'return' && options?.refundTo !== 'credit' && (
            <div className="rp-seg rp-seg--refund" role="radiogroup" aria-label="How would you like your money back?">
              {[['money', options?.refundTo === 'upi' ? 'Refund by UPI' : 'Refund to my payment'], ['credit', 'Store credit — instant']].map(([v, l]) => (
                <button type="button" key={v} role="radio" aria-checked={refundTo === v} className={refundTo === v ? 'is-on' : ''} onClick={() => setRefundTo(v)}>{l}</button>
              ))}
            </div>
          )}
          {type === 'return' && (options?.refundTo === 'credit' || refundTo === 'credit') && (
            <p className="rp-hint">The amount goes onto your store credit the moment the pieces reach us — it comes off at checkout on your next order.</p>
          )}
          {type === 'return' && refundTo === 'money' && options?.creditShare > 0 && options?.refundTo !== 'credit' && (
            <p className="rp-hint">Part of this order was paid with store credit, so that share comes back as credit.</p>
          )}

          {type === 'return' && options?.refundTo === 'upi' && refundTo === 'money' && (
            <label className="rp-field">UPI ID for your refund
              <input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={upi}
                onChange={e => setUpi(e.target.value)}
                placeholder="name@okaxis"
              />
              <span className="rp-hint">You paid cash, so we send the money back by UPI as soon as the pieces reach us.</span>
            </label>
          )}
          {type === 'return' && options?.refundTo === 'original' && refundTo === 'money' && (
            <p className="rp-hint">The refund goes back to the card or UPI account you paid with.</p>
          )}

          <p className="rp-policy">Pieces must be unworn and unwashed, with tags on. We'll arrange the pickup.</p>
          {error && <p className="rp-error" role="alert">{error}</p>}

          <div className="rp-actions">
            <button type="button" className="rp-btn rp-btn--ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="rp-btn" disabled={sending}>{sending ? 'Sending…' : 'Send request'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
