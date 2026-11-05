import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './SizeSwap.css';

const left = (p, size) => {
  if (!p || p.inStock === false) return 0;
  if (!p.stock || !p.stock.length) return Infinity;
  const e = p.stock.find((s) => s.size === size);
  return e ? e.qty : 0;
};

/**
 * "Change size" on one piece of an order that hasn't shipped.
 * Shows the sizes that are in stock right now; saving swaps them over.
 */
export default function SizeSwap({ orderId, item, onSaved, onClose }) {
  const [product, setProduct] = useState(null);
  const [pick, setPick] = useState(item.size);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/api/products/${item.product}`).then((r) => setProduct(r.data)).catch(() => setError('Could not load the sizes.'));
  }, [item.product]);

  const save = async () => {
    if (pick === item.size) { onClose(); return; }
    setBusy(true); setError('');
    try {
      const { data } = await axios.put(`/api/orders/${orderId}/items/${item._id}/size`, { size: pick });
      onSaved(data, `Changed to size ${pick}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the size. Please try again.');
      // Stock may have moved — fetch the latest.
      axios.get(`/api/products/${item.product}`).then((r) => setProduct(r.data)).catch(() => {});
    }
    setBusy(false);
  };

  return (
    <div className="ss" role="group" aria-label={`Choose a new size for ${item.name}`}>
      {!product ? (
        <p className="ss-note">{error || 'Loading sizes…'}</p>
      ) : (
        <>
          <div className="ss-sizes">
            {product.sizes.map((s) => {
              const gone = s !== item.size && left(product, s) < item.qty;
              return (
                <button
                  key={s}
                  type="button"
                  className={`ss-size ${pick === s ? 'is-on' : ''}`}
                  disabled={gone}
                  aria-pressed={pick === s}
                  aria-label={gone ? `${s}, sold out` : `Size ${s}`}
                  onClick={() => setPick(s)}
                >{s}</button>
              );
            })}
          </div>
          {error && <p className="ss-error" role="alert">{error}</p>}
          <div className="ss-actions">
            <button type="button" className="ss-btn" onClick={save} disabled={busy || pick === item.size}>{busy ? 'Saving…' : pick === item.size ? 'Pick a new size' : `Change to ${pick}`}</button>
            <button type="button" className="ss-link" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
