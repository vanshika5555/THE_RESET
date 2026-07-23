import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cartSubtotal } from '../utils/price';
import AddressFields, { BLANK_ADDRESS, validateAddress } from './AddressFields';
import './AddressFields.css';
import './CheckoutPage.css';

export default function CheckoutPage({ cart, onOrderSuccess }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=address, 2=payment, 3=processing
  const [address, setAddress] = useState({ ...BLANK_ADDRESS, fullName: user?.name || '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const subtotal = cartSubtotal(cart);


  // Pull in whatever the customer has already saved so they
  // don't have to type it all again.
  useEffect(() => {
    if (!user) return;
    axios.get('/api/auth/addresses')
      .then(res => {
        const list = res.data || [];
        setSaved(list);
        if (list.length > 0) {
          const first = list[0];
          setSelectedId(first._id);
          setAddress({ ...BLANK_ADDRESS, ...first });
        } else {
          setShowNewForm(true);
        }
      })
      .catch(() => setShowNewForm(true));
  }, [user]);

  const chooseSaved = (addr) => {
    setSelectedId(addr._id);
    setShowNewForm(false);
    setError('');
    setAddress({ ...BLANK_ADDRESS, ...addr });
  };

  const useNewAddress = () => {
    setSelectedId(null);
    setShowNewForm(true);
    setError('');
    setAddress({ ...BLANK_ADDRESS, fullName: user?.name || '' });
    setFieldErrors({});
  };

  const checkAddress = () => {
    const errs = validateAddress(address);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please fix the highlighted fields before continuing.');
      return false;
    }
    setError('');
    return true;
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setStep(3);
    try {
      // Simulate payment processing
      await new Promise(r => setTimeout(r, 2000));

      const orderItems = cart.map(item => ({
        product: item._id,
        name:    item.name,
        price:   item.price,
        size:    item.size,
        qty:     item.qty,
        image:   item.image || '',
        color:   item.color || '#f0f0f0',
      }));

      const res = await axios.post(
        `/api/orders`,
        { items: orderItems, subtotal, shippingAddress: address }
      );

      onOrderSuccess(res.data._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Order failed. Try again.');
      setStep(2);
    }
    setLoading(false);
  };

  if (step === 3) {
    return (
      <div className="co-page">
        <div className="co-processing">
          <div className="co-spinner" />
          <p>Processing your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="co-page">
      <div className="co-container">

        {/* Left — Form */}
        <div className="co-left">
          <h2 className="co-title">Checkout</h2>

          {/* Step indicators */}
          <div className="co-steps">
            <div className={`co-step ${step >= 1 ? 'co-step--active' : ''}`}>
              <span>1</span> Delivery Address
            </div>
            <div className="co-step-line" />
            <div className={`co-step ${step >= 2 ? 'co-step--active' : ''}`}>
              <span>2</span> Payment
            </div>
          </div>

          {error && <div className="co-error">{error}</div>}

          {/* Step 1 — Address */}
          {step === 1 && (
            <div className="co-section">
              <h3 className="co-section-title">Delivery Address</h3>

              {saved.length > 0 && (
                <div className="co-saved">
                  {saved.map(a => (
                    <button
                      type="button"
                      key={a._id}
                      className={`co-saved-card ${selectedId === a._id ? 'co-saved-card--active' : ''}`}
                      onClick={() => chooseSaved(a)}
                    >
                      <span className="co-saved-label">{a.label}</span>
                      <span className="co-saved-name">{a.fullName} · {a.phone}</span>
                      <span className="co-saved-text">
                        {[a.houseNo, a.address, a.landmark, a.city, a.state].filter(Boolean).join(', ')} - {a.pincode}
                      </span>
                    </button>
                  ))}

                  <button
                    type="button"
                    className={`co-saved-card co-saved-card--new ${showNewForm ? 'co-saved-card--active' : ''}`}
                    onClick={useNewAddress}
                  >
                    + Deliver to a new address
                  </button>
                </div>
              )}

              <div style={{ display: saved.length > 0 && !showNewForm ? 'none' : undefined }}>
                <AddressFields
                  value={address}
                  onChange={setAddress}
                  errors={fieldErrors}
                  showLabelPicker={false}
                />
              </div>
              <button
                className="co-btn"
                onClick={() => { if (checkAddress()) setStep(2); }}
              >
                Continue to Payment
              </button>
            </div>
          )}

          {/* Step 2 — Payment */}
          {step === 2 && (
            <div className="co-section">
              <h3 className="co-section-title">Payment</h3>

              {/* Delivery address summary */}
              <div className="co-address-summary">
                <div className="co-address-summary-header">
                  <span>Delivering to</span>
                  <button onClick={() => setStep(1)}>Change</button>
                </div>
                <p><strong>{address.fullName}</strong> — +91 {address.phone}</p>
                <p>{address.address}, {address.city} - {address.pincode}</p>
              </div>

              {/* Payment method — fake UPI */}
              <div className="co-payment-methods">
                <div className="co-payment-option co-payment-option--selected">
                  <div className="co-radio-dot" />
                  <div>
                    <p className="co-payment-label">UPI / Net Banking / Cards</p>
                    <p className="co-payment-sub">Simulated payment — no real charge</p>
                  </div>
                </div>
                <div className="co-payment-option">
                  <div className="co-radio-dot co-radio-dot--empty" />
                  <div>
                    <p className="co-payment-label">Cash on Delivery</p>
                    <p className="co-payment-sub">Pay when your order arrives</p>
                  </div>
                </div>
              </div>

              <button className="co-btn co-btn--place" onClick={handlePlaceOrder} disabled={loading}>
                Place Order — ₹{subtotal.toLocaleString('en-IN')}
              </button>
              <p className="co-disclaimer">By placing this order you agree to our Terms & Conditions</p>
            </div>
          )}
        </div>

        {/* Right — Order summary */}
        <div className="co-right">
          <h3 className="co-summary-title">Order Summary ({cart.length} items)</h3>
          <div className="co-items">
            {cart.map((item, i) => (
              <div key={i} className="co-item">
                <div className="co-item-img" style={{ background: item.color || '#f0f0f0' }}>
                  {item.image && <img src={item.image} alt={item.name} />}
                </div>
                <div className="co-item-info">
                  <p className="co-item-name">{item.name}</p>
                  <p className="co-item-meta">Size: {item.size} · Qty: {item.qty}</p>
                  <p className="co-item-price">{item.price}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="co-totals">
            <div className="co-total-row">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="co-total-row">
              <span>Delivery</span>
              <span className="co-free">FREE</span>
            </div>
            <div className="co-total-row co-total-row--final">
              <span>Total</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}