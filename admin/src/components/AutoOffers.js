import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { inr, fmtDate, Switch, ErrorNote } from './ui';
import './AutoOffers.css';

/*
  Automatic offers — no code to type. The best one that fits the bag comes
  off at checkout, unless the shopper's discount code saves more. The bag
  also nudges: "Add 1 more piece for Buy 2, get 10% off".
*/
const BLANK = { name: '', condType: 'qty', condValue: '2', rewardType: 'percent', rewardValue: '10', maxDiscount: '', category: '', endsAt: '' };

const describe = (o) => {
  const when = o.condition.type === 'qty' ? `${o.condition.value}+ pieces` : `${inr(o.condition.value)}+ spend`;
  const off = o.reward.type === 'percent' ? `${o.reward.value}% off${o.maxDiscount ? ` (up to ${inr(o.maxDiscount)})` : ''}` : `${inr(o.reward.value)} off`;
  return `${when} → ${off}${o.category ? ` · ${o.category} only` : ''}${o.endsAt ? ` · until ${fmtDate(o.endsAt)}` : ''}`;
};

export default function AutoOffers() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);       // null = closed
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => axios.get('/api/offers').then((r) => setList(r.data || [])).catch(() => setError('Offers could not be loaded.'));
  useEffect(() => { load(); }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Suggest a name from the rule until they type their own.
  const suggested = form ? (form.condType === 'qty'
    ? `Buy ${form.condValue || 'N'}, get ${form.rewardType === 'percent' ? `${form.rewardValue || 'X'}%` : `₹${form.rewardValue || 'X'}`} off`
    : `${form.rewardType === 'percent' ? `${form.rewardValue || 'X'}%` : `₹${form.rewardValue || 'X'}`} off ₹${Number(form.condValue || 0).toLocaleString('en-IN')}+`) : '';

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await axios.post('/api/offers', {
        name: form.name.trim() || suggested,
        condition: { type: form.condType, value: form.condValue },
        reward: { type: form.rewardType, value: form.rewardValue },
        maxDiscount: form.maxDiscount, category: form.category,
        endsAt: form.endsAt ? `${form.endsAt}T23:59:59+05:30` : null,
      });
      setForm(null); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the offer.');
    }
    setBusy(false);
  };
  const toggle = async (o) => {
    setList((l) => l.map((x) => (x._id === o._id ? { ...x, active: !x.active } : x)));
    try { await axios.put(`/api/offers/${o._id}`, { active: !o.active }); } catch { setError('Could not change it.'); load(); }
  };
  const remove = async (o) => {
    if (!window.confirm(`Delete the offer “${o.name}”?`)) return;
    try { await axios.delete(`/api/offers/${o._id}`); setList((l) => l.filter((x) => x._id !== o._id)); } catch { setError('Could not delete it.'); }
  };

  return (
    <section className="panel ao">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>
      <div className="ao-head">
        <div>
          <h2 className="panel-title">Automatic offers</h2>
          <p className="ao-text">No code needed — the best one that fits comes off at checkout (or the shopper’s code, if that saves more).</p>
        </div>
        {!form && <button type="button" className="btn btn--secondary btn--sm" onClick={() => setForm(BLANK)}>New offer</button>}
      </div>

      {form && (
        <form className="ao-form" onSubmit={save}>
          <div className="ao-rule">
            <label className="field">
              <span className="field-label">When the bag has</span>
              <div className="ao-pair">
                <input className="input" inputMode="numeric" value={form.condValue} onChange={(e) => set('condValue', e.target.value.replace(/\D/g, ''))} aria-label="Amount" />
                <select className="select" value={form.condType} onChange={(e) => set('condType', e.target.value)}>
                  <option value="qty">pieces or more</option>
                  <option value="spend">₹ or more</option>
                </select>
              </div>
            </label>
            <label className="field">
              <span className="field-label">Take off</span>
              <div className="ao-pair">
                <input className="input" inputMode="numeric" value={form.rewardValue} onChange={(e) => set('rewardValue', e.target.value.replace(/\D/g, ''))} aria-label="Discount" />
                <select className="select" value={form.rewardType} onChange={(e) => set('rewardType', e.target.value)}>
                  <option value="percent">% off</option>
                  <option value="amount">₹ off</option>
                </select>
              </div>
            </label>
          </div>
          <div className="ao-rule">
            <label className="field">
              <span className="field-label">On</span>
              <select className="select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Everything</option>
                <option value="Men">Men only</option>
                <option value="Women">Women only</option>
              </select>
            </label>
            {form.rewardType === 'percent' && (
              <label className="field">
                <span className="field-label">Most it can take off (₹) <span className="ao-opt">optional</span></span>
                <input className="input" inputMode="numeric" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value.replace(/\D/g, ''))} placeholder="No limit" />
              </label>
            )}
            <label className="field">
              <span className="field-label">Ends <span className="ao-opt">optional</span></span>
              <input className="input" type="date" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Name shoppers see</span>
            <input className="input" maxLength={60} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={suggested} />
          </label>
          <div className="ao-actions">
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>{busy ? 'Saving…' : 'Start offer'}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {list.length > 0 ? (
        <ul className="ao-list">
          {list.map((o) => {
            const ended = o.endsAt && new Date(o.endsAt) < new Date();
            return (
              <li key={o._id} className={`ao-row ${!o.active || ended ? 'ao-row--off' : ''}`}>
                <span className="ao-row-main">
                  <strong>{o.name}</strong>
                  <span>{describe(o)}{ended ? ' · ended' : ''}</span>
                </span>
                <Switch on={o.active && !ended} disabled={ended} onChange={() => toggle(o)} label={`${o.name} on or off`} />
                <button type="button" className="btn btn--ghost btn--sm ao-del" onClick={() => remove(o)}>Delete</button>
              </li>
            );
          })}
        </ul>
      ) : !form && <p className="ao-text ao-empty">No offers running. Try “Buy 2, get 10% off” to lift average order size.</p>}
    </section>
  );
}
