import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cartSubtotal, deliveryCharge, amountToFreeDelivery, FREE_DELIVERY_ABOVE } from '../utils/price';
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
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null);       // { code, discount, description }
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [guestEmail, setGuestEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const subtotal = cartSubtotal(cart);
  const discount = coupon ? coupon.discount : 0;
  const afterDiscount = subtotal - discount;
  const delivery = deliveryCharge(afterDiscount);
  const total = afterDiscount + delivery;
  const toFree = amountToFreeDelivery(afterDiscount);


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
    setFieldErrors({});
    setAddress({ ...BLANK_ADDRESS, ...addr });
  };

  const useNewAddress = () => {
    setSelectedId(null);
    setShowNewForm(true);
    setError('');
    setAddress({ ...BLANK_ADDRESS, fullName: user?.name || '' });
    setFieldErrors({});
  };


  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;

    setCheckingCoupon(true);
    setCouponError('');
    try {
      const res = await axios.post('/api/coupons/check', { code, subtotal });
      setCoupon(res.data);
      setCouponInput('');
    } catch (err) {
      setCoupon(null);
      setCouponError(
        err.response
          ? (err.response.data?.message || 'Could not apply that code.')
          : 'Cannot reach the server.'
      );
    }
    setCheckingCoupon(false);
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponError('');
  };

  const checkAddress = () => {
    // Guests need an email so we can reach them about the order.
    if (!user) {
      const email = guestEmail.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('Please enter a valid email address.');
        setError('We need an email to send your order confirmation.');
        return false;
      }
      setEmailError('');
    }

    const errs = validateAddress(address);
    setFieldErrors(errs);

    if (Object.keys(errs).length > 0) {
      // A saved address can be missing details we did not used to ask for,
      // such as a house number. Open the form so it can actually be fixed —
      // otherwise the fields are hidden and there is nothing to correct.
      if (selectedId && !showNewForm) {
        setShowNewForm(true);
        setError('This saved address is missing a few details. Please complete the highlighted fields — we will save the changes with your order.');
      } else {
        setError('Please fix the highlighted fields before continuing.');
      }
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

      // The server recalculates the total from the database, so we only
      // send what was ordered — not what we think it costs.
      const res = await axios.post(
        `/api/orders`,
        {
          items: orderItems,
          shippingAddress: address,
          couponCode: coupon ? coupon.code : '',
          guestEmail: user ? '' : guestEmail.trim(),
          guestName: user ? '' : address.fullName,
        }
      );

      // Keep their address book current. This must never block the order,
      // so a failure here is deliberately swallowed.
      if (user && showNewForm && saveAddress) {
        try {
          if (selectedId) {
            await axios.put(`/api/auth/addresses/${selectedId}`, address);
          } else {
            await axios.post('/api/auth/addresses', { ...address, label: address.label || 'Home' });
          }
        } catch {
          // the order is already placed — nothing to do here
        }
      }

      onOrderSuccess(res.data);
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
              {!user && (
                <div className="co-guest">
                  <div className="co-guest-head">
                    <h3 className="co-section-title">Your Email</h3>
                    <Link to="/login" className="co-guest-signin">Sign in instead</Link>
                  </div>
                  <input
                    className="co-guest-input"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => { setGuestEmail(e.target.value); setEmailError(''); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {emailError
                    ? <p className="co-guest-error">{emailError}</p>
                    : <p className="co-guest-hint">
                        We will send your order confirmation here. No account needed.
                      </p>}
                </div>
              )}

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
                      {Object.keys(validateAddress(a)).length > 0 && (
                        <span className="co-saved-incomplete">Needs a few more details</span>
                      )}
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

                <label className="co-save-addr">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                  />
                  <span>
                    {selectedId
                      ? 'Update this address in my account'
                      : 'Save this address for next time'}
                  </span>
                </label>
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
                Place Order — ₹{total.toLocaleString('en-IN')}
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
          <div className="co-coupon">
            {coupon ? (
              <div className="co-coupon-applied">
                <div>
                  <span className="co-coupon-code">{coupon.code}</span>
                  {coupon.description && (
                    <span className="co-coupon-desc">{coupon.description}</span>
                  )}
                </div>
                <button type="button" onClick={removeCoupon} className="co-coupon-remove">
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="co-coupon-row">
                  <input
                    className="co-coupon-input"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(); }}
                    placeholder="Discount code"
                  />
                  <button
                    type="button"
                    className="co-coupon-apply"
                    onClick={applyCoupon}
                    disabled={checkingCoupon || !couponInput.trim()}
                  >
                    {checkingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
                {couponError && <p className="co-coupon-error">{couponError}</p>}
              </>
            )}
          </div>

          <div className="co-totals">
            <div className="co-total-row">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {discount > 0 && (
              <div className="co-total-row co-total-row--discount">
                <span>Discount ({coupon.code})</span>
                <span>− ₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="co-total-row">
              <span>Delivery</span>
              {delivery === 0
                ? <span className="co-free">FREE</span>
                : <span>₹{delivery.toLocaleString('en-IN')}</span>}
            </div>

            {toFree > 0 && (
              <p className="co-free-nudge">
                Add ₹{toFree.toLocaleString('en-IN')} more for free delivery
              </p>
            )}

            <div className="co-total-row co-total-row--final">
              <span>Total</span>
              <span>₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}