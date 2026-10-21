import React, { useState } from 'react';
import { validPin, estimate } from '../utils/delivery';
import { FREE_DELIVERY_ABOVE, formatPrice } from '../utils/price';
import './DeliveryCheck.css';

const KEY = 'thereset_pin';
const readPin = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };

/** "Deliver to 110024 · Mon 27 Oct – Wed 29 Oct" on the product page. */
export default function DeliveryCheck() {
  const saved = readPin();
  const [pin, setPin] = useState(saved);
  const [checked, setChecked] = useState(validPin(saved) ? saved : '');
  const [error, setError] = useState('');

  const check = (e) => {
    e.preventDefault();
    const p = pin.trim();
    if (!validPin(p)) { setError('Enter a 6-digit pincode.'); return; }
    setError('');
    setChecked(p);
    try { localStorage.setItem(KEY, p); } catch { /* fine without it */ }
  };

  const est = checked ? estimate(checked) : null;

  return (
    <div className="dc">
      <div className="dc-head">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
        <span className="dc-title">Delivery</span>
      </div>

      {est ? (
        <div className="dc-result" aria-live="polite">
          <p className="dc-when">
            Arrives <strong>{est.label}</strong>
          </p>
          <p className="dc-to">
            to {checked}
            <button type="button" className="dc-change" onClick={() => { setChecked(''); setPin(''); }}>Change</button>
          </p>
        </div>
      ) : (
        <form className="dc-form" onSubmit={check} noValidate>
          <input
            className="dc-input"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="Enter pincode"
            aria-label="Pincode"
            aria-invalid={!!error}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          />
          <button type="submit" className="dc-btn">Check</button>
        </form>
      )}
      {error && <p className="dc-error" role="alert">{error}</p>}

      <ul className="dc-perks">
        <li>Free delivery over {formatPrice(FREE_DELIVERY_ABOVE)}</li>
        <li>7-day returns &amp; size exchanges</li>
      </ul>
    </div>
  );
}
