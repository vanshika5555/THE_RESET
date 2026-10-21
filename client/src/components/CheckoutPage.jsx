import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cartSubtotal, deliveryCharge, amountToFreeDelivery, formatPrice } from '../utils/price';
import { payWithRazorpay } from '../utils/razorpay';
import AddressFields, { BLANK_ADDRESS, validateAddress } from './AddressFields';
import './AddressFields.css';
import './CheckoutPage.css';

export default function CheckoutPage({ cart, onOrderSuccess }) {
  const { user } = useAuth();
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
  const [summaryOpen, setSummaryOpen] = useState(false);   // phone: collapsed by default
  const [gift, setGift] = useState({ isGift: false, to: '', message: '' });
  const [deliveryNote, setDeliveryNote] = useState('');
  // Cash on delivery terms come from the server (fee, upper limit).
  const [cod, setCod] = useState({ fee: 0, max: 10000 });
  const [onlineOn, setOnlineOn] = useState(false);       // Razorpay switched on at the server?
  const [payMethod, setPayMethod] = useState('cod');
  useEffect(() => {
    axios.get('/api/orders/payment-options')
      .then((res) => {
        if (res.data?.cod) setCod({ fee: Number(res.data.cod.fee) || 0, max: Number(res.data.cod.max) || 10000 });
        if (res.data?.online?.available) { setOnlineOn(true); setPayMethod('online'); }
      })
      .catch(() => {});
  }, []);

  const subtotal = cartSubtotal(cart);
  const discount = coupon ? coupon.discount : 0;
  const afterDiscount = subtotal - discount;
  const delivery = deliveryCharge(afterDiscount);
  const codFee = payMethod === 'cod' ? cod.fee : 0;
  const total = afterDiscount + delivery + codFee;
  const overCod = payMethod === 'cod' && total > cod.max;
  const toFree = amountToFreeDelivery(afterDiscount);
  const itemCount = cart.reduce((n, i) => n + i.qty, 0);


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
          paymentMethod: payMethod,
          gift: gift.isGift ? gift : { isGift: false },
          deliveryNote,
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

      // Paying online: open Razorpay, then confirm the payment with the server.
      if (res.data.razorpay) {
        const placed = res.data;
        try {
          const paid = await payWithRazorpay({
            razorpay: placed.razorpay,
            description: `Order #${String(placed._id).slice(-8).toUpperCase()}`,
            prefill: { name: address.fullName, email: user?.email || guestEmail.trim(), contact: address.phone },
          });
          const done = await axios.post(`/api/orders/${placed._id}/pay`, paid);
          onOrderSuccess(done.data);
        } catch (payErr) {
          if (payErr && payErr.dismissed) {
            axios.post(`/api/orders/${placed._id}/abandon`).catch(() => {});
            setError('Payment cancelled — nothing was charged. Your bag is just as you left it.');
          } else {
            setError(payErr?.response?.data?.message || payErr?.message || 'The payment didn’t go through. Try again, or choose cash on delivery.');
          }
          setStep(2);
          setLoading(false);
        }
        return;
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
          <p>Placing your order...</p>
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
                className="co-btn co-btn--sticky"
                onClick={() => {
                  if (checkAddress()) { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                  else window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
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
                  <button type="button" onClick={() => setStep(1)}>Change</button>
                </div>
                <p><strong>{address.fullName}</strong> — +91 {address.phone}</p>
                <p>{address.address}, {address.city} - {address.pincode}</p>
              </div>

              {/* Gift + courier note */}
              <div className={`co-extra ${gift.isGift ? 'co-extra--on' : ''}`}>
                <label className="co-gift-toggle">
                  <input
                    type="checkbox"
                    checked={gift.isGift}
                    onChange={(e) => setGift((g) => ({ ...g, isGift: e.target.checked }))}
                  />
                  <span className="co-gift-text">
                    <strong>Send it as a gift</strong>
                    <span>We add your note and leave the prices off the packing slip. Free.</span>
                  </span>
                </label>
                {gift.isGift && (
                  <div className="co-gift-fields">
                    <p className="co-gift-cod">
                      {payMethod === 'cod'
                        ? `Heads up: with cash on delivery, the person receiving it pays the courier ${formatPrice(total)}.${onlineOn ? ' Pay online so it arrives already paid.' : ''}`
                        : 'Paid online — it arrives with nothing to pay.'}
                    </p>
                    <label className="co-field">
                      <span>To</span>
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="Their name"
                        value={gift.to}
                        onChange={(e) => setGift((g) => ({ ...g, to: e.target.value }))}
                      />
                    </label>
                    <label className="co-field">
                      <span>Note <em>{250 - gift.message.length} left</em></span>
                      <textarea
                        rows={3}
                        maxLength={250}
                        placeholder="Happy birthday — this one's very you."
                        value={gift.message}
                        onChange={(e) => setGift((g) => ({ ...g, message: e.target.value }))}
                      />
                    </label>
                  </div>
                )}
              </div>

              <label className="co-field co-note">
                <span>Delivery instructions <em>optional</em></span>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Leave with the guard, call before coming"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                />
              </label>

              {/* Payment method */}
              <div className="co-payment-methods" role="radiogroup" aria-label="Payment method">
                <button
                  type="button"
                  role="radio"
                  aria-checked={payMethod === 'online'}
                  aria-disabled={!onlineOn}
                  disabled={!onlineOn}
                  className={`co-payment-option ${payMethod === 'online' ? 'co-payment-option--selected' : ''} ${!onlineOn ? 'co-payment-option--off' : ''}`}
                  onClick={() => onlineOn && setPayMethod('online')}
                >
                  <div className={`co-radio-dot ${payMethod === 'online' ? '' : 'co-radio-dot--empty'}`} />
                  <div>
                    <p className="co-payment-label">UPI / cards / net banking</p>
                    <p className="co-payment-sub">{onlineOn ? 'Pay now securely with Razorpay' : 'Coming soon'}</p>
                  </div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={payMethod === 'cod'}
                  className={`co-payment-option ${payMethod === 'cod' ? 'co-payment-option--selected' : ''}`}
                  onClick={() => setPayMethod('cod')}
                >
                  <div className={`co-radio-dot ${payMethod === 'cod' ? '' : 'co-radio-dot--empty'}`} />
                  <div>
                    <p className="co-payment-label">Cash on delivery</p>
                    <p className="co-payment-sub">
                      Pay in cash or by UPI when it arrives
                      {cod.fee > 0 ? ` · ${formatPrice(cod.fee)} COD fee` : ' · no extra fee'}
                    </p>
                  </div>
                </button>
              </div>

              {overCod && (
                <p className="co-cod-limit" role="alert">
                  Cash on delivery is available on orders up to {formatPrice(cod.max)}.
                  {onlineOn ? ' Pay online instead, or remove something from your bag.' : ' Remove something from your bag to continue.'}
                </p>
              )}

              <button className="co-btn co-btn--place co-btn--sticky" onClick={handlePlaceOrder} disabled={loading || overCod}>
                {payMethod === 'online' ? `Pay ${formatPrice(total)}` : `Place order · Pay ${formatPrice(total)} on delivery`}
              </button>
              <p className="co-disclaimer">By placing this order you agree to our Terms & Conditions</p>
            </div>
          )}
        </div>

        {/* Right — Order summary */}
        <div className={`co-right ${summaryOpen ? 'co-right--open' : ''}`}>
          {/* Phone: the summary folds into one line at the top */}
          <button
            type="button"
            className="co-summary-toggle"
            onClick={() => setSummaryOpen(o => !o)}
            aria-expanded={summaryOpen}
          >
            <span className="co-summary-toggle-label">
              {summaryOpen ? 'Hide' : 'Show'} order summary
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </span>
            <span className="co-summary-toggle-total">₹{total.toLocaleString('en-IN')}</span>
          </button>

          <div className="co-summary-body">
          <h3 className="co-summary-title">Order Summary ({itemCount} item{itemCount !== 1 ? 's' : ''})</h3>
          <div className="co-items">
            {cart.map((item, i) => (
              <div key={i} className="co-item">
                <div className="co-item-img" style={{ background: item.color || '#f0f0f0' }}>
                  {(item.image || (item.images && item.images[0])) && <img src={item.image || item.images[0]} alt="" />}
                </div>
                <div className="co-item-info">
                  <p className="co-item-name">{item.name}</p>
                  <p className="co-item-meta">{item.colorName ? `${item.colorName} · ` : ''}Size: {item.size} · Qty: {item.qty}</p>
                  <p className="co-item-price">{formatPrice(item.price)}</p>
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
                    aria-label="Discount code"
                    autoCapitalize="characters"
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

            {codFee > 0 && (
              <div className="co-total-row">
                <span>Cash on delivery fee</span>
                <span>₹{codFee.toLocaleString('en-IN')}</span>
              </div>
            )}

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
    </div>
  );
}