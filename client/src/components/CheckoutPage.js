import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './CheckoutPage.css';

export default function CheckoutPage({ cart, onOrderSuccess }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=address, 2=payment, 3=processing
  const [address, setAddress] = useState({
    fullName: user?.name || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = cart.reduce((sum, item) => {
    const num = parseInt((item.price || '0').replace(/[^0-9]/g, ''));
    return sum + num * item.qty;
  }, 0);

  const handleAddressChange = (e) => {
    setAddress(a => ({ ...a, [e.target.name]: e.target.value }));
    setError('');
  };

  const validateAddress = () => {
    const { fullName, phone, address: addr, city, pincode } = address;
    if (!fullName || !phone || !addr || !city || !pincode) {
      setError('Please fill all required fields.'); return false;
    }
    if (phone.length < 10) {
      setError('Please enter a valid phone number.'); return false;
    }
    if (pincode.length < 6) {
      setError('Please enter a valid pincode.'); return false;
    }
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
        'http://localhost:5000/api/orders',
        { items: orderItems, subtotal, shippingAddress: address },
        { headers: { Authorization: `Bearer ${user.token}` } }
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
              <div className="co-grid">
                <div className="co-field co-field--full">
                  <label>Full Name *</label>
                  <input name="fullName" value={address.fullName} onChange={handleAddressChange} placeholder="As on ID" />
                </div>
                <div className="co-field co-field--full">
                  <label>Phone Number *</label>
                  <input name="phone" value={address.phone} onChange={handleAddressChange} placeholder="10 digit mobile number" maxLength={10} />
                </div>
                <div className="co-field co-field--full">
                  <label>Address *</label>
                  <input name="address" value={address.address} onChange={handleAddressChange} placeholder="House No., Building, Street, Area" />
                </div>
                <div className="co-field">
                  <label>City *</label>
                  <input name="city" value={address.city} onChange={handleAddressChange} placeholder="City" />
                </div>
                <div className="co-field">
                  <label>State</label>
                  <input name="state" value={address.state} onChange={handleAddressChange} placeholder="State" />
                </div>
                <div className="co-field">
                  <label>Pincode *</label>
                  <input name="pincode" value={address.pincode} onChange={handleAddressChange} placeholder="6 digit pincode" maxLength={6} />
                </div>
              </div>
              <button
                className="co-btn"
                onClick={() => { if (validateAddress()) setStep(2); }}
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
                <p><strong>{address.fullName}</strong> — {address.phone}</p>
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