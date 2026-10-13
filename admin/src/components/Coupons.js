import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { inr, fmtDate, Badge, Switch, Empty, ErrorNote, Drawer } from './ui';
import './Coupons.css';

// Numbers stay text while the form is open so boxes can be cleared and retyped.
const BLANK = {
  code: '', description: '', type: 'percent', value: '10',
  minOrder: '', maxDiscount: '', usageLimit: '', expiresAt: '', active: true,
};

const digits = (v) => v.replace(/[^0-9]/g, '');
const num = (v) => Number(String(v ?? '').trim() || 0);
const today = () => new Date().toISOString().slice(0, 10);

const isExpired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date(new Date().toDateString());

function ruleText(c) {
  const off = c.type === 'percent' ? `${c.value}% off` : `${inr(c.value)} off`;
  const bits = [off];
  if (c.minOrder > 0) bits.push(`orders over ${inr(c.minOrder)}`);
  else bits.push('any order');
  let text = bits.join(' on ');
  if (c.type === 'percent' && c.maxDiscount > 0) text += `, up to ${inr(c.maxDiscount)}`;
  return text;
}

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm]       = useState(BLANK);
  const [editId, setEditId]   = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]   = useState(false);

  const load = () => {
    axios.get('/api/coupons')
      .then((res) => { setCoupons(res.data || []); })
      .catch(() => setError('Discount codes could not be loaded. Check that the server is running.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setForm(BLANK); setEditId(null); setFormError(''); setFormOpen(true); };

  const openEdit = (c) => {
    setForm({
      code: c.code,
      description: c.description || '',
      type: c.type,
      value: String(c.value ?? ''),
      minOrder: c.minOrder ? String(c.minOrder) : '',
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : '',
      usageLimit: c.usageLimit ? String(c.usageLimit) : '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      active: c.active,
    });
    setEditId(c._id);
    setFormError('');
    setFormOpen(true);
  };

  const save = async () => {
    const code = form.code.toUpperCase().trim();
    if (!code) { setFormError('Give the code a name, for example WELCOME10.'); return; }
    const value = num(form.value);
    if (value <= 0) { setFormError('Enter a discount above zero.'); return; }
    if (form.type === 'percent' && value > 100) { setFormError('A percentage can’t be more than 100.'); return; }
    if (form.expiresAt && form.expiresAt < today()) { setFormError('The expiry date has already passed. Pick a future date or leave it empty.'); return; }

    setSaving(true);
    setFormError('');
    const payload = {
      ...form,
      code,
      value,
      minOrder: num(form.minOrder),
      maxDiscount: form.type === 'percent' ? num(form.maxDiscount) : 0,
      usageLimit: num(form.usageLimit),
      expiresAt: form.expiresAt || null,
    };

    try {
      if (editId) await axios.put(`/api/coupons/${editId}`, payload);
      else        await axios.post('/api/coupons', payload);
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(
        err.response?.data?.message
        || (err.response ? `The server refused this code (error ${err.response.status}). The name may already be taken.` : 'Cannot reach the server. Check that it is running.')
      );
    }
    setSaving(false);
  };

  const toggleActive = async (c) => {
    setCoupons((list) => list.map((x) => (x._id === c._id ? { ...x, active: !c.active } : x)));
    try {
      await axios.put(`/api/coupons/${c._id}`, { active: !c.active });
    } catch {
      setCoupons((list) => list.map((x) => (x._id === c._id ? { ...x, active: c.active } : x)));
      setError(`${c.code} could not be ${c.active ? 'paused' : 'turned on'}. Try again.`);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.code}? Customers won’t be able to use it any more.`)) return;
    try {
      await axios.delete(`/api/coupons/${c._id}`);
      setFormOpen(false);
      load();
    } catch {
      setError(`${c.code} could not be deleted. Try again.`);
    }
  };

  const state = (c) => {
    if (isExpired(c)) return { tone: 'grey', label: 'Expired' };
    if (!c.active) return { tone: 'amber', label: 'Paused' };
    if (c.usageLimit > 0 && c.usedCount >= c.usageLimit) return { tone: 'grey', label: 'Used up' };
    return { tone: 'green', label: 'Active' };
  };

  return (
    <div className="coupons">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="toolbar">
        <p className="cp-intro toolbar-grow">Codes customers type at checkout to get money off.</p>
        <button type="button" className="btn btn--primary" onClick={openNew}>New discount code</button>
      </div>

      <div className="panel">
        {loading ? (
          <div className="loading">Loading discount codes…</div>
        ) : coupons.length === 0 ? (
          <Empty
            title="No discount codes yet"
            text="Create one to run a sale or give first-time customers a reason to buy."
            action={<button type="button" className="btn btn--primary" onClick={openNew}>New discount code</button>}
          />
        ) : coupons.map((c) => {
          const st = state(c);
          const usedPct = c.usageLimit > 0 ? Math.min(100, Math.round(((c.usedCount || 0) / c.usageLimit) * 100)) : 0;
          return (
            <div key={c._id} className={`cp-row ${st.label !== 'Active' ? 'cp-row--off' : ''}`}>
              <button type="button" className="cp-main" onClick={() => openEdit(c)}>
                <span className="cp-code-line">
                  <span className="cp-code">{c.code}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
                <span className="cp-rule">{ruleText(c)}</span>
                {c.description && <span className="cp-desc">{c.description}</span>}
              </button>

              <div className="cp-usage">
                <span className="cp-usage-text">
                  {c.usageLimit > 0 ? `${c.usedCount || 0} of ${c.usageLimit} used` : `Used ${c.usedCount || 0} ${(c.usedCount || 0) === 1 ? 'time' : 'times'}`}
                </span>
                {c.usageLimit > 0 && <span className="cp-bar"><span style={{ width: `${usedPct}%` }} /></span>}
                <span className="cp-expiry">{c.expiresAt ? `${isExpired(c) ? 'Expired' : 'Ends'} ${fmtDate(c.expiresAt)}` : 'No end date'}</span>
              </div>

              <div className="cp-controls">
                <Switch on={c.active} onChange={() => toggleActive(c)} label={`${c.code} active`} />
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEdit(c)}>Edit</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Create / edit panel ── */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editId ? `Edit ${form.code}` : 'New discount code'}
        subtitle={editId ? 'Changes apply to the next checkout.' : 'Customers type this code at checkout.'}
        footer={
          <>
            {editId && (
              <button type="button" className="btn btn--danger btn--lg cp-delete" onClick={() => remove(coupons.find((x) => x._id === editId))}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn--primary btn--lg" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Create code'}
            </button>
          </>
        }
      >
        <div className="cp-form">
          {formError && <div className="note-error" role="alert"><span>{formError}</span></div>}

          <div className="field">
            <label className="field-label" htmlFor="cp-code">Code <span className="req">*</span></label>
            <input
              id="cp-code"
              className="input cp-code-input"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="WELCOME10"
              disabled={!!editId}
              autoComplete="off"
            />
            <span className="field-hint">{editId ? 'A code’s name can’t be changed once it’s created.' : 'Capital letters and numbers, no spaces.'}</span>
          </div>

          <div className="field">
            <span className="field-label">Discount type</span>
            <div className="cp-type" role="radiogroup" aria-label="Discount type">
              {[
                ['percent', 'Percentage', 'e.g. 10% off'],
                ['flat', 'Fixed amount', 'e.g. ₹500 off'],
              ].map(([val, label, sub]) => (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={form.type === val}
                  className={`cp-type-opt ${form.type === val ? 'cp-type-opt--on' : ''}`}
                  onClick={() => set('type', val)}
                >
                  <strong>{label}</strong>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="cp-value">{form.type === 'percent' ? 'Percentage off' : 'Amount off'} <span className="req">*</span></label>
              <div className="input-group">
                {form.type === 'flat' && <span className="input-addon">₹</span>}
                <input id="cp-value" className="input" inputMode="numeric" value={form.value} onChange={(e) => set('value', digits(e.target.value))} placeholder={form.type === 'percent' ? '10' : '500'} />
                {form.type === 'percent' && <span className="input-addon input-addon--end">%</span>}
              </div>
            </div>

            {form.type === 'percent' ? (
              <div className="field">
                <label className="field-label" htmlFor="cp-max">Maximum discount</label>
                <div className="input-group">
                  <span className="input-addon">₹</span>
                  <input id="cp-max" className="input" inputMode="numeric" value={form.maxDiscount} onChange={(e) => set('maxDiscount', digits(e.target.value))} placeholder="No limit" />
                </div>
              </div>
            ) : <div className="only-desktop" />}

            <div className="field">
              <label className="field-label" htmlFor="cp-min">Minimum order</label>
              <div className="input-group">
                <span className="input-addon">₹</span>
                <input id="cp-min" className="input" inputMode="numeric" value={form.minOrder} onChange={(e) => set('minOrder', digits(e.target.value))} placeholder="No minimum" />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="cp-limit">Total uses allowed</label>
              <input id="cp-limit" className="input" inputMode="numeric" value={form.usageLimit} onChange={(e) => set('usageLimit', digits(e.target.value))} placeholder="Unlimited" />
            </div>

            <div className="field span-2">
              <label className="field-label" htmlFor="cp-exp">Ends on</label>
              <input id="cp-exp" className="input" type="date" min={today()} value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
              <span className="field-hint">Leave empty to keep the code running until you pause it.</span>
            </div>

            <div className="field span-2">
              <label className="field-label" htmlFor="cp-desc">Note for yourself</label>
              <input id="cp-desc" className="input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Instagram giveaway, Diwali sale" />
            </div>
          </div>

          {num(form.value) > 0 && (
            <div className="cp-preview">
              <span className="cp-preview-label">Customers will get</span>
              <span className="cp-preview-text">
                {ruleText({ ...form, value: num(form.value), minOrder: num(form.minOrder), maxDiscount: num(form.maxDiscount) })}
              </span>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}