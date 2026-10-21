import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { inr, fmtDate, ErrorNote, Empty, FilterTabs } from './ui';
import './GiftCards.css';

/*
  Gift cards — what's been bought, what's still unused, and free ones the
  owner sends out (giveaways, apologies, thank-yous). Codes are never shown
  here; they only go to the recipient's email.
*/

const STATUS = {
  Active:   { label: 'Not used yet', tone: 'gc-tag--active' },
  Redeemed: { label: 'Added to account', tone: 'gc-tag--done' },
  Void:     { label: 'Cancelled', tone: 'gc-tag--void' },
  Awaiting: { label: 'Paying…', tone: '' },
};
const BLANK = { amount: '', toName: '', toEmail: '', message: '' };

export default function GiftCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = () => axios.get('/api/giftcards')
    .then((r) => setCards(r.data || []))
    .catch(() => setError('Could not load gift cards.'))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const sold = cards.filter((c) => c.paidOnline && c.status !== 'Void');
    const open = cards.filter((c) => c.status === 'Active');
    return {
      sold: sold.reduce((n, c) => n + c.amount, 0), soldCount: sold.length,
      open: open.reduce((n, c) => n + c.amount, 0), openCount: open.length,
    };
  }, [cards]);

  const shown = cards.filter((c) => filter === 'All'
    || (filter === 'Unused' && c.status === 'Active')
    || (filter === 'Used' && c.status === 'Redeemed')
    || (filter === 'Given' && !c.paidOnline && c.issuedBy));

  const issue = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNote('');
    try {
      const r = await axios.post('/api/giftcards/issue', { ...form, amount: Number(form.amount) });
      setNote(`${inr(r.data.amount)} gift card emailed to ${r.data.to.email}.`);
      setForm(BLANK);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the gift card.');
    }
    setBusy(false);
  };

  const resend = async (c) => {
    setError(''); setNote('');
    try {
      await axios.post(`/api/giftcards/${c._id}/resend`);
      setNote(`Sent again to ${c.to.email}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send it again.');
    }
  };

  const cancel = async (c) => {
    const refund = c.paidOnline ? ` ${inr(c.amount)} goes back to ${c.buyer?.name || 'the buyer'} through Razorpay.` : '';
    if (!window.confirm(`Cancel the ${inr(c.amount)} gift card for ${c.to.name}? The code stops working.${refund}`)) return;
    setError(''); setNote('');
    try {
      await axios.put(`/api/giftcards/${c._id}/void`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel it.');
    }
  };

  return (
    <div className="gc">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="gc-stats">
        <div><span className="gc-stat">{inr(totals.sold)}</span><span className="gc-stat-label">Sold online · {totals.soldCount}</span></div>
        <div><span className="gc-stat">{inr(totals.open)}</span><span className="gc-stat-label">Still to be used · {totals.openCount}</span></div>
      </div>

      <section className="panel gc-panel">
        <h2 className="panel-title">Send a gift card</h2>
        <p className="gc-text">Free from the shop — for a giveaway winner, a sorry, or a thank-you. It’s emailed with a code they add to their account as store credit.</p>
        <form className="gc-form" onSubmit={issue}>
          <label className="field">
            <span className="field-label">Amount (₹)</span>
            <input className="input" type="number" inputMode="numeric" min="500" max="20000" step="100" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="1000" />
          </label>
          <label className="field">
            <span className="field-label">Their name</span>
            <input className="input" maxLength={60} value={form.toName} onChange={(e) => setForm((f) => ({ ...f, toName: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">Their email</span>
            <input className="input" type="email" value={form.toEmail} onChange={(e) => setForm((f) => ({ ...f, toEmail: e.target.value }))} />
          </label>
          <label className="field gc-form-msg">
            <span className="field-label">Message <span className="gc-opt">optional</span></span>
            <input className="input" maxLength={300} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Thanks for being one of our first customers" />
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy || !form.amount || !form.toName || !form.toEmail}>
            {busy ? 'Sending…' : 'Send gift card'}
          </button>
        </form>
        {note && <p className="gc-ok" role="status">{note}</p>}
      </section>

      <FilterTabs
        items={[
          { value: 'All', label: 'All', count: cards.length },
          { value: 'Unused', label: 'Not used yet', count: cards.filter((c) => c.status === 'Active').length },
          { value: 'Used', label: 'Used', count: cards.filter((c) => c.status === 'Redeemed').length },
          { value: 'Given', label: 'Given by you', count: cards.filter((c) => !c.paidOnline && c.issuedBy).length },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <section className="panel">
        {loading ? <p className="gc-text gc-pad">Loading…</p> : shown.length === 0 ? (
          <Empty title="No gift cards yet" text="When someone buys one on the shop’s Gift cards page, it shows up here." />
        ) : shown.map((c) => (
          <div key={c._id} className="gc-row">
            <span className="gc-amount">{inr(c.amount)}</span>
            <span className="gc-who">
              <strong>{c.to?.name} <span>{c.to?.email}</span></strong>
              <span>
                {c.paidOnline ? `Bought by ${c.buyer?.name || 'a customer'}` : `Given by ${c.issuedBy || 'the shop'}`} · {fmtDate(c.createdAt)} · ····{c.last4}
                {c.redeemedBy && ` · used by ${c.redeemedBy.name}`}
              </span>
            </span>
            <span className={`gc-tag ${STATUS[c.status]?.tone || ''}`}>{STATUS[c.status]?.label || c.status}</span>
            <span className="gc-actions">
              {c.status === 'Active' && (
                <>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => resend(c)}>Send again</button>
                  <button type="button" className="btn btn--ghost btn--sm gc-cancel" onClick={() => cancel(c)}>Cancel</button>
                </>
              )}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
