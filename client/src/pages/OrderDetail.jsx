import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import usePageMeta from '../hooks/usePageMeta';
import './OrderDetail.css';
import { cdn } from '../utils/img';
import ReturnPanel from '../components/ReturnPanel';
import openInvoice from '../utils/openInvoice';
import { formatPrice } from '../utils/price';

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

// The journey an order moves through, in order.
const STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [awbCopied, setAwbCopied] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  usePageMeta({ title: 'Order details' });

  useEffect(() => {
    let active = true;
    axios.get(`/api/orders/${id}`)
      .then(res => { if (active) { setOrder(res.data); setLoading(false); } })
      .catch(err => {
        if (!active) return;
        setError(
          err.response?.status === 403 ? 'This order is not on your account.'
          : err.response?.status === 404 ? 'We could not find that order.'
          : 'Could not load this order.'
        );
        setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  const cancelOrder = async () => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setCancelling(true);
    try {
      const res = await axios.put(`/api/orders/${id}/cancel`);
      setOrder(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel this order.');
    }
    setCancelling(false);
  };

  if (loading) return <div className="od-state">Loading your order...</div>;

  if (error) {
    return (
      <div className="od-state">
        <p className="od-error">{error}</p>
        <Link to="/orders" className="od-back-link">← Back to my orders</Link>
      </div>
    );
  }

  const a = order.shippingAddress || {};
  const isCancelled = order.status === 'Cancelled';
  const shipment = ['Shipped', 'Delivered'].includes(order.status) && order.shipment?.trackingNumber
    ? order.shipment : null;
  const copyAwb = () => {
    navigator.clipboard?.writeText(shipment.trackingNumber)
      .then(() => { setAwbCopied(true); setTimeout(() => setAwbCopied(false), 1600); })
      .catch(() => {});
  };
  const currentStep = STEPS.indexOf(order.status);
  const addressLine = [a.houseNo, a.address, a.landmark, a.city, a.state]
    .filter(Boolean).join(', ');

  return (
    <div className="od-page">
      <button className="od-back" onClick={() => navigate('/orders')}>
        ← All orders
      </button>

      <div className="od-head">
        <div>
          <h1 className="od-title">Order #{order._id.slice(-8).toUpperCase()}</h1>
          <p className="od-date">Placed on {fmtDate(order.createdAt)}</p>
        </div>
        <span className={`od-status od-status--${order.status.toLowerCase()}`}>
          {order.status}
        </span>
      </div>

      {/* progress — hidden once cancelled, since the journey stopped */}
      {!isCancelled && (
        <div className="od-track">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`od-step ${i <= currentStep ? 'od-step--done' : ''} ${i === currentStep ? 'od-step--current' : ''}`}
            >
              <span className="od-step-dot" />
              <span className="od-step-label">{step}</span>
            </div>
          ))}
        </div>
      )}

      {isCancelled && (
        <div className="od-cancelled-banner">This order was cancelled.</div>
      )}

      <div className="od-columns">
        <div className="od-main">
          <h2 className="od-section-title">Items</h2>
          <div className="od-items">
            {order.items.map((item, i) => (
              <div key={i} className="od-item">
                <Link to={`/product/${item.product || item._id}`} className="od-item-img"
                      style={{ background: item.color || '#f0f0f0' }}>
                  {item.image && <img src={cdn(item.image, 200)} alt="" />}
                </Link>
                <div className="od-item-info">
                  <Link to={`/product/${item.product || item._id}`} className="od-item-name">
                    {item.name}
                  </Link>
                  <p className="od-item-meta">Size {item.size} · Qty {item.qty}</p>
                  <p className="od-item-price">{formatPrice(item.price)}</p>
                </div>
              </div>
            ))}
          </div>

          <ReturnPanel orderId={order._id} delivered={order.status === 'Delivered'} />
        </div>

        <aside className="od-side">
          {shipment && (
            <div className="od-box od-ship">
              <h2 className="od-section-title">
                {order.status === 'Delivered' ? 'Delivered by' : 'On its way'}
              </h2>
              <div className="od-ship-row">
                <span className="od-ship-label">Courier</span>
                <span className="od-ship-value">{shipment.courier}</span>
              </div>
              <div className="od-ship-row">
                <span className="od-ship-label">Tracking number</span>
                <button type="button" className="od-ship-awb" onClick={copyAwb} title="Copy tracking number">
                  {shipment.trackingNumber}
                  <span className="od-ship-copy">{awbCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              {shipment.shippedAt && (
                <div className="od-ship-row">
                  <span className="od-ship-label">Shipped</span>
                  <span className="od-ship-value">{fmtDate(shipment.shippedAt)}</span>
                </div>
              )}
              {order.status === 'Shipped' && shipment.trackingUrl && (
                <a className="od-track-btn" href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                  Track package ↗
                </a>
              )}
            </div>
          )}

          {order.gift?.isGift && (
            <div className="od-box od-gift">
              <h2 className="od-section-title">Sent as a gift</h2>
              {order.gift.to && <p className="od-addr-name">To {order.gift.to}</p>}
              {order.gift.message
                ? <p className="od-gift-msg">“{order.gift.message}”</p>
                : <p className="od-addr-line">No note added.</p>}
              <p className="od-addr-line">The packing slip has no prices on it.</p>
            </div>
          )}

          <div className="od-box">
            <h2 className="od-section-title">Delivery Address</h2>
            <p className="od-addr-name">{a.fullName}</p>
            <p className="od-addr-line">{addressLine}</p>
            <p className="od-addr-line">{a.pincode}</p>
            {a.phone && <p className="od-addr-line">+91 {a.phone}</p>}
            {order.deliveryNote && <p className="od-addr-line od-delnote">Note for the courier: {order.deliveryNote}</p>}
          </div>

          <div className="od-box">
            <h2 className="od-section-title">Summary</h2>
            <div className="od-sum-row">
              <span>Subtotal</span><span>{inr(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="od-sum-row od-sum-row--discount">
                <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                <span>− {inr(order.discount)}</span>
              </div>
            )}
            <div className="od-sum-row">
              <span>Delivery</span>
              <span>{order.delivery ? inr(order.delivery) : 'FREE'}</span>
            </div>
            {order.payment?.codFee > 0 && (
              <div className="od-sum-row">
                <span>Cash on delivery fee</span><span>{inr(order.payment.codFee)}</span>
              </div>
            )}
            <div className="od-sum-row od-sum-row--total">
              <span>Total</span><span>{inr(order.total || order.subtotal)}</span>
            </div>
            <p className={`od-pay od-pay--${(order.payment?.status || 'Pending').toLowerCase()}`}>
              {order.payment?.method === 'online'
                ? 'Paid online'
                : order.payment?.status === 'Paid' ? 'Paid in cash on delivery'
                : order.payment?.status === 'Void' || order.status === 'Cancelled' ? 'Cash on delivery — nothing to pay'
                : `Cash on delivery — pay ${inr(order.total || order.subtotal)} when it arrives`}
            </p>
          </div>

          {['Shipped', 'Delivered'].includes(order.status) && (
            <>
              <button
                type="button"
                className="od-invoice-btn"
                onClick={() => {
                  setInvoiceError('');
                  openInvoice(order._id).catch((e) => setInvoiceError(e.message));
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                </svg>
                Download invoice
              </button>
              {invoiceError && <p className="od-invoice-error" role="alert">{invoiceError}</p>}
            </>
          )}

          {order.status === 'Pending' && (
            <button className="od-cancel" onClick={cancelOrder} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}

          <p className="od-help-note">
            Need help with this order?{' '}
            <Link to="/help#contact" className="od-inline-link">Contact us</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}