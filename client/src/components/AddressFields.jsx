import React, { useState } from 'react';

/**
 * Shared delivery-address fields, used by both the profile and checkout
 * so the two can never drift apart.
 *
 * Typing a 6 digit pincode looks up the city and state from India Post.
 * The lookup is done with fetch (not axios) on purpose: axios carries the
 * customer's login token on every request, and that must not be sent to
 * a third party.
 */

export const BLANK_ADDRESS = {
  label: 'Home',
  fullName: '',
  phone: '',
  houseNo: '',
  address: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
};

// Returns an object of { field: message }. Empty object means it is valid.
export function validateAddress(a) {
  const errors = {};

  if (!a.fullName || a.fullName.trim().length < 3) {
    errors.fullName = 'Please enter the full name of the person receiving the order.';
  }

  const phone = (a.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) {
    errors.phone = 'Enter a 10 digit mobile number.';
  } else if (!/^[6-9]/.test(phone)) {
    errors.phone = 'Indian mobile numbers start with 6, 7, 8 or 9.';
  }

  if (!a.houseNo || !a.houseNo.trim()) {
    errors.houseNo = 'Flat or house number is needed for delivery.';
  }

  if (!a.address || a.address.trim().length < 4) {
    errors.address = 'Enter the street, area or locality.';
  }

  const pin = (a.pincode || '').replace(/\D/g, '');
  if (pin.length !== 6) {
    errors.pincode = 'Enter a 6 digit pincode.';
  } else if (pin.startsWith('0')) {
    errors.pincode = 'A pincode cannot start with 0.';
  }

  if (!a.city || !a.city.trim()) errors.city = 'City is required.';
  if (!a.state || !a.state.trim()) errors.state = 'State is required.';

  return errors;
}

export default function AddressFields({ value, onChange, errors = {}, showLabelPicker = true }) {
  const [pinStatus, setPinStatus] = useState('');   // '', 'loading', 'found', 'notfound', 'failed'
  const [areas, setAreas] = useState([]);

  const set = (field, v) => onChange({ ...value, [field]: v });

  const handlePincode = async (raw) => {
    const pin = raw.replace(/\D/g, '').slice(0, 6);
    const next = { ...value, pincode: pin };

    // clear any previously looked-up area when the pincode changes
    if (pin.length < 6) {
      setPinStatus('');
      setAreas([]);
      onChange(next);
      return;
    }

    onChange(next);
    setPinStatus('loading');
    setAreas([]);

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : null;

      if (entry && entry.Status === 'Success' && entry.PostOffice?.length) {
        const offices = entry.PostOffice;
        setAreas(offices.map(o => o.Name));
        onChange({
          ...next,
          city: offices[0].District || '',
          state: offices[0].State || '',
        });
        setPinStatus('found');
      } else {
        setPinStatus('notfound');
      }
    } catch {
      // Offline, or the lookup service is down — they can still type it in.
      setPinStatus('failed');
    }
  };

  const err = (f) => errors[f]
    ? <span className="af-error">{errors[f]}</span>
    : null;

  return (
    <div className="af-wrap">
      {showLabelPicker && (
        <div className="af-labels">
          {['Home', 'Work', 'Other'].map(l => (
            <button
              type="button"
              key={l}
              className={`af-label-btn ${value.label === l ? 'af-label-btn--active' : ''}`}
              onClick={() => set('label', l)}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="af-grid">
        <div className="af-field af-field--full">
          <label>Full Name <span className="af-req">*</span></label>
          <input
            value={value.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder="Name of the person receiving the order"
          />
          {err('fullName')}
        </div>

        <div className="af-field">
          <label>Mobile Number <span className="af-req">*</span></label>
          <div className="af-phone">
            <span className="af-prefix">+91</span>
            <input
              value={value.phone}
              onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10 digit number"
              inputMode="numeric"
            />
          </div>
          <span className="af-hint">10 digits, no spaces or country code</span>
          {err('phone')}
        </div>

        <div className="af-field">
          <label>Pincode <span className="af-req">*</span></label>
          <input
            value={value.pincode}
            onChange={(e) => handlePincode(e.target.value)}
            placeholder="6 digit pincode"
            inputMode="numeric"
          />
          {pinStatus === 'loading'  && <span className="af-hint">Looking up your area...</span>}
          {pinStatus === 'found'    && <span className="af-ok">City and state filled in automatically</span>}
          {pinStatus === 'notfound' && <span className="af-warn">We could not find that pincode. Please check it, or type your city and state below.</span>}
          {pinStatus === 'failed'   && <span className="af-warn">Could not reach the pincode service. Please type your city and state below.</span>}
          {pinStatus === '' && <span className="af-hint">Enter 6 digits to fill city and state</span>}
          {err('pincode')}
        </div>

        <div className="af-field af-field--full">
          <label>Flat / House No. / Building <span className="af-req">*</span></label>
          <input
            value={value.houseNo}
            onChange={(e) => set('houseNo', e.target.value)}
            placeholder="e.g. Flat 402, Sunrise Apartments"
          />
          {err('houseNo')}
        </div>

        <div className="af-field af-field--full">
          <label>Street / Area / Locality <span className="af-req">*</span></label>
          <input
            value={value.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="e.g. 12th Main Road, Indiranagar"
            list={areas.length ? 'af-areas' : undefined}
          />
          {areas.length > 0 && (
            <datalist id="af-areas">
              {areas.map(a => <option key={a} value={a} />)}
            </datalist>
          )}
          {areas.length > 0 && (
            <span className="af-hint">Areas in this pincode are suggested as you type</span>
          )}
          {err('address')}
        </div>

        <div className="af-field af-field--full">
          <label>Landmark <span className="af-optional">optional</span></label>
          <input
            value={value.landmark}
            onChange={(e) => set('landmark', e.target.value)}
            placeholder="e.g. Opposite the metro station"
          />
          <span className="af-hint">Helps the delivery partner find you faster</span>
        </div>

        <div className="af-field">
          <label>City <span className="af-req">*</span></label>
          <input
            value={value.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="City"
          />
          {err('city')}
        </div>

        <div className="af-field">
          <label>State <span className="af-req">*</span></label>
          <input
            value={value.state}
            onChange={(e) => set('state', e.target.value)}
            placeholder="State"
          />
          {err('state')}
        </div>
      </div>
    </div>
  );
}