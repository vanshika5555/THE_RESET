import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OrderConfirm.css';

export default function OrderConfirm({ orderId, order: passedOrder }) {
  const { user } = useAuth();
  // A guest has no way to fetch their order back, so the placed order is
  // handed straight to this screen.
  const [order, setOrder]     = useState(passedOrder || null);
  const [loading, setLoading] = useState(!passedOrder);
  const [failed, setFailed]   = useState(false);

  useEffect(() => {
    if (passedOrder) return;              // already have everything
    if (!orderId) { setLoading(false); return; }
    let active = true;

    axios.get(`/api/orders/${orderId}`)
      .then(res => {
        if (!active) return;
        setOrder(res.data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });

    return () => { active = false; };
  }, [orderId, passedOrder]);

  const guestName = order?.guest?.name || order?.shippingAddress?.fullName || '';
  const firstName = (user?.name || guestName || '').split(' ')[0];
  const isGuest = order ? !order.user : !user;

  const addr = order?.shippingAddress;
  const addressLine = addr
    ? [addr.houseNo, addr.address, addr.landmark, addr.city, addr.state]
        .filter(Boolean).join(', ')
    : '';

  return (
    <div className="oc-page">
      <div className="oc-box">
        <div className="oc-icon">✓</div>
        <h1 className="oc-title">Order Confirmed</h1>
        <p className="oc-sub">
          Thank you{firstName ? `, ${firstName}` : ''}. We have received your order
          and will send it on its way shortly.
        </p>

        {loading && <p className="oc-loading">Loading your order details...</p>}

        {failed && (
          <div className="oc-warn">
            <p><strong>Your order was placed.</strong></p>
            <p>
              We just could not load the details on this screen. You can see the
              full order any time under{' '}
              <Link to="/orders" className="oc-inline-link">My Orders</Link>.
            </p>
          </div>
        )}

        {order && (
          <>
            <div className="oc-id">
              Order ID: <span>#{order._id.slice(-8).toUpperCase()}</span>
            </div>

            <div className="oc-items">
              {order.items.map((item, i) => (
                <div key={i} className="oc-item">
                  <div className="oc-item-img" style={{ background: item.color || '#f0f0f0' }}>
                    {item.image && <img src={item.image} alt={item.name} />}
                  </div>
                  <div className="oc-item-info">
                    <p className="oc-item-name">{item.name}</p>
                    <p className="oc-item-meta">Size: {item.size} · Qty: {item.qty}</p>
                    <p className="oc-item-price">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="oc-address">
              <p className="oc-address-label">Delivering to</p>
              <p>{addr.fullName}{addr.phone ? ` · +91 ${addr.phone}` : ''}</p>
              <p>{addressLine} - {addr.pincode}</p>
            </div>

            <div className="oc-breakdown">
              <div className="oc-line">
                <span>Subtotal</span>
                <span>₹{(order.subtotal || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="oc-line">
                <span>Delivery</span>
                <span>{order.delivery ? `₹${order.delivery.toLocaleString('en-IN')}` : 'FREE'}</span>
              </div>
            </div>

            <div className="oc-total">
              Order Total: <span>₹{(order.total || order.subtotal || 0).toLocaleString('en-IN')}</span>
            </div>

            <div className="oc-status">
              Status: <span className="oc-status-badge">{order.status}</span>
            </div>

            {/* What happens next — the thing first-time buyers actually want to know */}
            <div className="oc-next">
              <p className="oc-next-title">What happens next</p>
              <ol className="oc-steps">
                <li>
                  <span className="oc-step-dot oc-step-dot--done" />
                  <span>
                    <strong>Order placed</strong>
                    <em>We have your order and are getting it ready.</em>
                  </span>
                </li>
                <li>
                  <span className="oc-step-dot" />
                  <span>
                    <strong>Packed and dispatched</strong>
                    <em>Usually within 2 working days.</em>
                  </span>
                </li>
                <li>
                  <span className="oc-step-dot" />
                  <span>
                    <strong>On its way to you</strong>
                    <em>3–5 working days in metro cities, 5–8 elsewhere.</em>
                  </span>
                </li>
              </ol>
              <p className="oc-next-note">
                You can follow the status any time under{' '}
                <Link to="/orders" className="oc-inline-link">My Orders</Link>.
                Questions? See our <Link to="/help" className="oc-inline-link">Help page</Link>.
              </p>
            </div>
          </>
        )}

        {isGuest && order && (
          <div className="oc-guest-note">
            <p>
              <strong>Save your order number</strong> — #{order._id.slice(-8).toUpperCase()}.
              You ordered as a guest, so it will not appear in an account.
            </p>
            <p>
              <Link to="/login" className="oc-inline-link">Create an account</Link> with{' '}
              {order.guest?.email || 'your email'} to track future orders.
            </p>
          </div>
        )}

        <div className="oc-actions">
          {!isGuest && <Link to="/orders" className="oc-btn oc-btn--outline">View My Orders</Link>}
          <Link to="/" className="oc-btn oc-btn--fill">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}