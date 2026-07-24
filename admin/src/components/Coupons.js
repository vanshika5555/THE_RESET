import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Coupons.css';

// Numbers are kept as text while the form is open so the boxes can be
// cleared and retyped. They are converted on save.
const BLANK = {
  code: '', description: '', type: 'percent', value: '10',
  minOrder: '0', maxDiscount: '0', usageLimit: '0', expiresAt: '', active: true,
};

// digits only, and an empty box is allowed while typing
const digits = (v) => v.replace(/[^0-9]/g, '');
const num = (v) => Number(String(v).trim() || 0);

const fmt = (n) => '₹' + (n || 0).toLocaleString('en-IN');

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    axios.get('/api/coupons')
      .then(res => { setCoupons(res.data || []); setLoading(false); })
      .catch(() => { setError('Could not load discount codes.'); setLoading(false); });
  };

  useEffect(load, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.code.trim()) { setError('Give the code a name.'); return; }

    const value = num(form.value);
    if (value <= 0) { setError('Enter a discount amount above zero.'); return; }
    if (form.type === 'percent' && value > 100) { setError('A percentage cannot be over 100.'); return; }

    setSaving(true);
    setError('');
    const payload = {
      ...form,
      code: form.code.toUpperCase().trim(),
      value,
      minOrder: num(form.minOrder),
      maxDiscount: num(form.maxDiscount),
      usageLimit: num(form.usageLimit),
      expiresAt: form.expiresAt || null,
    };

    try {
      if (editId) await axios.put(`/api/coupons/${editId}`, payload);
      else        await axios.post('/api/coupons', payload);
      setForm(BLANK);
      setEditId(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this code.');
    }
    setSaving(false);
  };

  const edit = (c) => {
    setForm({
      code: c.code, description: c.description || '', type: c.type,
      value: String(c.value ?? ''),
      minOrder: String(c.minOrder ?? 0),
      maxDiscount: String(c.maxDiscount ?? 0),
      usageLimit: String(c.usageLimit ?? 0),
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      active: c.active,
    });
    setEditId(c._id);
    setShowForm(true);
    setError('');
  };

  const toggleActive = async (c) => {
    setCoupons(list => list.map(x => (x._id === c._id ? { ...x, active: !c.active } : x)));
    try {
      await axios.put(`/api/coupons/${c._id}`, { active: !c.active });
    } catch {
      setCoupons(list => list.map(x => (x._id === c._id ? { ...x, active: c.active } : x)));
      setError('Could not update that code.');
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete the code ${c.code}?`)) return;
    try {
      await axios.delete(`/api/coupons/${c._id}`);
      load();
    } catch {
      setError('Could not delete that code.');
    }
  };

  const describe = (c) => {
    const off = c.type === 'percent' ? `${c.value}% off` : `${fmt(c.value)} off`;
    const bits = [off];
    if (c.minOrder > 0) bits.push(`on orders over ${fmt(c.minOrder)}`);
    if (c.type === 'percent' && c.maxDiscount > 0) bits.push(`up to ${fmt(c.maxDiscount)}`);
    return bits.join(' ');
  };

  const isExpired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date();

  if (loading) return <div className="cp-loading">Loading discount codes...</div>;

  return (
    <div className="cp-page">
      <div className="cp-header">
        <h1 className="cp-title">Discount Codes</h1>
        <button
          className="cp-add-btn"
          onClick={() => { setForm(BLANK); setEditId(null); setShowForm(true); setError(''); }}
        >
          + New Code
        </button>
      </div>

      {error && <div className="cp-error">{error}</div>}

      {showForm && (
        <div className="cp-form">
          <div className="cp-form-grid">
            <div className="cp-field">
              <label>Code *</label>
              <input
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                disabled={!!editId}
              />
              <span className="cp-hint">What the customer types at checkout</span>
            </div>

            <div className="cp-field">
              <label>Description</label>
              <input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="First order discount"
              />
            </div>

            <div className="cp-field">
              <label>Type *</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="percent">Percentage off</option>
                <option value="flat">Flat amount off</option>
              </select>
            </div>

            <div className="cp-field">
              <label>{form.type === 'percent' ? 'Percentage *' : 'Amount off (₹) *'}</label>
              <input
                type="text" inputMode="numeric"
                value={form.value}
                onChange={(e) => set('value', digits(e.target.value))}
                onFocus={(e) => e.target.select()}
                placeholder={form.type === 'percent' ? 'e.g. 10' : 'e.g. 500'}
              />
            </div>

            <div className="cp-field">
              <label>Minimum order (₹)</label>
              <input
                type="text" inputMode="numeric"
                value={form.minOrder}
                onChange={(e) => set('minOrder', digits(e.target.value))}
                onFocus={(e) => e.target.select()}
                placeholder="0"
              />
              <span className="cp-hint">0 means no minimum</span>
            </div>

            {form.type === 'percent' && (
              <div className="cp-field">
                <label>Maximum discount (₹)</label>
                <input
                  type="text" inputMode="numeric"
                  value={form.maxDiscount}
                  onChange={(e) => set('maxDiscount', digits(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                />
                <span className="cp-hint">Caps a percentage code. 0 means no cap</span>
              </div>
            )}

            <div className="cp-field">
              <label>Usage limit</label>
              <input
                type="text" inputMode="numeric"
                value={form.usageLimit}
                onChange={(e) => set('usageLimit', digits(e.target.value))}
                onFocus={(e) => e.target.select()}
                placeholder="0"
              />
              <span className="cp-hint">0 means unlimited</span>
            </div>

            <div className="cp-field">
              <label>Expires on</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => set('expiresAt', e.target.value)}
              />
              <span className="cp-hint">Leave empty for no expiry</span>
            </div>
          </div>

          <div className="cp-form-actions">
            <button className="cp-btn cp-btn--outline" onClick={() => { setShowForm(false); setError(''); }}>
              Cancel
            </button>
            <button className="cp-btn cp-btn--fill" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Code'}
            </button>
          </div>
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="cp-empty">
          <p>No discount codes yet.</p>
          <p className="cp-empty-hint">
            Create one to run a sale or offer first-time customers a discount.
          </p>
        </div>
      ) : (
        <div className="cp-list">
          {coupons.map(c => (
            <div key={c._id} className={`cp-card ${!c.active || isExpired(c) ? 'cp-card--off' : ''}`}>
              <div className="cp-card-main">
                <div className="cp-code-row">
                  <span className="cp-code">{c.code}</span>
                  {isExpired(c) && <span className="cp-badge cp-badge--warn">Expired</span>}
                  {!c.active && <span className="cp-badge">Paused</span>}
                </div>
                <p className="cp-desc">{describe(c)}</p>
                {c.description && <p className="cp-note">{c.description}</p>}

                <p className="cp-meta">
                  Used {c.usedCount}
                  {c.usageLimit > 0 ? ` of ${c.usageLimit}` : ' times'}
                  {c.expiresAt && ` · expires ${new Date(c.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>

              <div className="cp-card-actions">
                <button onClick={() => toggleActive(c)} className="cp-link">
                  {c.active ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => edit(c)} className="cp-link">Edit</button>
                <button onClick={() => remove(c)} className="cp-link cp-link--danger">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}