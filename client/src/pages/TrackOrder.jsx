import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import usePageMeta from '../hooks/usePageMeta';
import { cdn } from '../utils/img';
import './TrackOrder.css';

/*
  Track an order without signing in: the order number from the email plus
  the phone number it's being delivered to.
*/
const STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
const LABEL = { Pending: 'Placed', Confirmed: 'Confirmed', Shipped: 'Shipped', Delivered: 'Delivered' };
const LINE = { Confirmed: 'Order confirmed', Shipped: 'Shipped', Delivered: 'Delivered' };
const short = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

function stepDate(o, step) {
  if (step === 'Pending') return o.createdAt;
  const h = [...(o.history || [])].reverse().find((x) => x.type === 'status' && x.text.startsWith(LINE[step]));
  if (h) return h.at;
  if (step === 'Shipped') return o.shipment?.shippedAt;
  if (step === 'Delivered') return o.deliveredAt;
  return null;
}

export default function TrackOrder() {
  usePageMeta({ title: 'Track your order', description: 'Track a THE RESET order with your order number and phone number.' });
  const [params, setParams] = useSearchParams();
  const [order, setOrderNo] = useState(params.get('order') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const look = async (o = order, p = phone) => {
    setError(''); setBusy(true);
    try {
      const r = await axios.get('/api/orders/track', { params: { order: o.replace('#', '').trim(), phone: p.trim() } });
      setResult(r.data);
      setParams({ order: r.data.number }, { replace: true });   // the phone never goes in the address bar
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.message || 'Could not look that up just now. Please try again.');
    }
    setBusy(false);
  };

  useEffect(() => {
    if (params.get('order') && params.get('phone')) look(params.get('order'), params.get('phone'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e) => { e.preventDefault(); look(); };
  const cancelled = result?.status === 'Cancelled';
  const at = result ? STEPS.indexOf(result.status) : -1;

  return (
    <div className="tr">
      <h1 className="tr-title">Track your order</h1>
      <p className="tr-lede">Use the order number from your confirmation email and the phone number you gave for delivery.</p>

      <form className="tr-form" onSubmit={submit}>
        <label className="tr-field">
          <span>Order number</span>
          <input value={order} onChange={(e) => setOrderNo(e.target.value)} placeholder="e.g. E6F7A8B2" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        </label>
        <label className="tr-field">
          <span>Phone number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" inputMode="tel" autoComplete="tel-national" />
        </label>
        <button type="submit" className="tr-btn" disabled={busy}>{busy ? 'Looking…' : 'Track'}</button>
      </form>
      {error && <p className="tr-error" role="alert">{error}</p>}

      {result && (
        <section className="tr-result" aria-live="polite">
          <div className="tr-head">
            <div>
              <p className="tr-no">Order #{result.number}</p>
              <p className="tr-sub">{result.firstName ? `For ${result.firstName}` : ''}{result.city ? ` · ${result.city}` : ''} · placed {short(result.createdAt)}</p>
            </div>
            <span className={`tr-status tr-status--${result.status.toLowerCase()}`}>{cancelled ? 'Cancelled' : LABEL[result.status]}</span>
          </div>

          {!cancelled && (
            <ol className="tr-steps">
              {STEPS.map((s, i) => (
                <li key={s} className={i <= at ? 'is-done' : ''}>
                  <span className="tr-dot" aria-hidden="true" />
                  <span className="tr-step">{LABEL[s]}</span>
                  {i <= at && stepDate(result, s) && <span className="tr-date">{short(stepDate(result, s))}</span>}
                </li>
              ))}
            </ol>
          )}

          {result.shipment && (
            <div className="tr-ship">
              <span>{result.shipment.courier || 'Courier'} · <strong>{result.shipment.trackingNumber}</strong></span>
              {result.status === 'Shipped' && result.shipment.trackingUrl && (
                <a className="tr-btn tr-btn--sm" href={result.shipment.trackingUrl} target="_blank" rel="noreferrer">Track package ↗</a>
              )}
            </div>
          )}
          {result.payment?.due > 0 && (
            <p className="tr-cod">Cash on delivery — keep <strong>{inr(result.payment.due)}</strong> ready for the courier.</p>
          )}

          <ul className="tr-items">
            {result.items.map((it, i) => (
              <li key={i}>
                <span className="tr-img" style={{ background: it.color || '#f0f0f0' }}>{it.image && <img src={cdn(it.image, 120)} alt="" />}</span>
                <span>{it.name}<small>Size {it.size} · Qty {it.qty}</small></span>
              </li>
            ))}
          </ul>

          {result.history?.length > 0 && (
            <>
              <h2 className="tr-h2">Updates</h2>
              <ol className="tr-log">
                {[...result.history].reverse().map((h, i) => (
                  <li key={i}><span>{h.text}</span><time dateTime={h.at}>{when(h.at)}</time></li>
                ))}
              </ol>
            </>
          )}
          <p className="tr-more">Want returns, invoices and all your orders in one place? <Link to="/login" state={{ from: '/orders' }}>Sign in</Link>.</p>
        </section>
      )}
    </div>
  );
}
