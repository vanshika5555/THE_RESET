import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddressFields, { BLANK_ADDRESS, validateAddress } from './AddressFields';
import './AddressEditor.css';

/**
 * "Change" on an order's delivery address — until it ships.
 * Pick a saved address or type a new one; the courier note can change too.
 */
export default function AddressEditor({ order, onSaved, onClose }) {
  const [form, setForm] = useState({ ...BLANK_ADDRESS, ...(order.shippingAddress || {}) });
  const [note, setNote] = useState(order.deliveryNote || '');
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/auth/addresses').then((r) => setSaved(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const use = (a) => {
    setForm({ ...BLANK_ADDRESS, ...a });
    setErrors({});
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const problems = validateAddress(form);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      const { data } = await axios.put(`/api/orders/${order._id}/address`, { shippingAddress: form, deliveryNote: note });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the address. Please try again.');
    }
    setBusy(false);
  };

  const same = (a) => ['houseNo', 'address', 'pincode', 'phone'].every((k) => String(a[k] || '') === String(form[k] || ''));

  return (
    <form className="ae" onSubmit={save} noValidate>
      {order.status === 'Confirmed' && (
        <p className="ae-warn">We’re getting this order ready. Change it now and we’ll pack it for the new address.</p>
      )}
      {saved.length > 0 && (
        <div className="ae-saved" role="group" aria-label="Your saved addresses">
          {saved.map((a) => (
            <button key={a._id} type="button" className={`ae-chip ${same(a) ? 'is-on' : ''}`} onClick={() => use(a)}>
              <strong>{a.label || 'Saved'}</strong>
              <span>{[a.houseNo, a.address, a.city].filter(Boolean).join(', ')}</span>
            </button>
          ))}
        </div>
      )}
      <AddressFields value={form} onChange={setForm} errors={errors} showLabelPicker={false} />
      <label className="ae-note">
        <span>Note for the courier <em>optional</em></span>
        <textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Leave with the guard, call before coming…" />
      </label>
      {error && <p className="ae-error" role="alert">{error}</p>}
      <div className="ae-actions">
        <button type="button" className="ae-btn ae-btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="ae-btn" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
      </div>
    </form>
  );
}
