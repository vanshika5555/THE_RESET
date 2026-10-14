import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MyOrders.css';
import { formatPrice } from '../utils/price';

const STATUS_COLORS = {
  Pending:   { bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
  Confirmed: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Shipped:   { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  Delivered: { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  Cancelled: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
};

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    axios.get(`/api/orders/myorders`)
      .then(res => { setOrders(res.data); setLoading(false); })
      .catch(() => { setError('Could not load your orders.'); setLoading(false); });
  }, [user, navigate]);


  const cancelOrder = async (orderId) => {
    const sure = window.confirm(
      'Cancel this order? This cannot be undone.'
    );
    if (!sure) return;

    setCancelling(orderId);
    setError('');
    try {
      const res = await axios.put(`/api/orders/${orderId}/cancel`);
      setOrders(list => list.map(o => (o._id === orderId ? res.data : o)));
    } catch (err) {
      setError(
        err.response
          ? (err.response.data?.message || 'Could not cancel this order.')
          : 'Cannot reach the server.'
      );
    }
    setCancelling(null);
  };

  if (loading) return <div className="mo-loading">Loading your orders...</div>;

  return (
    <div className="mo-page">
      <div className="mo-header">
        <h1 className="mo-title">My Orders</h1>
        <p className="mo-sub">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
      </div>

      {error && <div className="mo-error">{error}</div>}

      {orders.length === 0 ? (
        <div className="mo-empty">
          <p>You haven't placed any orders yet.</p>
          <Link to="/" className="mo-shop-btn">Start Shopping →</Link>
        </div>
      ) : (
        <div className="mo-list">
          {orders.map(order => {
            const s = STATUS_COLORS[order.status] || STATUS_COLORS.Pending;
            return (
              <div key={order._id} className="mo-card">
                <div className="mo-card-header">
                  <div>
                    <p className="mo-order-id">Order #{order._id.slice(-8).toUpperCase()}</p>
                    <p className="mo-date">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <span className="mo-status" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {order.status}
                  </span>
                </div>

                <div className="mo-items">
                  {order.items.map((item, i) => (
                    <div key={i} className="mo-item">
                      <div className="mo-item-img" style={{ background: item.color || '#f0f0f0' }}>
                        {item.image && <img src={item.image} alt="" loading="lazy" />}
                      </div>
                      <div className="mo-item-info">
                        <p className="mo-item-name">{item.name}</p>
                        <p className="mo-item-meta">Size: {item.size} · Qty: {item.qty}</p>
                        <p className="mo-item-price">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mo-card-footer">
                  <div className="mo-address">
                    <span>Delivering to: </span>
                    {order.shippingAddress?.fullName}, {order.shippingAddress?.city}
                  </div>
                  <div className="mo-total">
                    Total: <strong>₹{(Number(order.total) || Number(order.subtotal) || 0).toLocaleString('en-IN')}</strong>
                    {order.delivery > 0 && (
                      <span className="mo-delivery-note"> (incl. ₹{order.delivery} delivery)</span>
                    )}
                  </div>
                </div>

                <div className="mo-card-actions">
                  <Link to={`/orders/${order._id}`} className="mo-view-link">
                    View details →
                  </Link>
                  {order.status === 'Pending' ? (
                    <>
                      <span className="mo-action-note">
                        You can cancel while the order is still being prepared.
                      </span>
                      <button
                        className="mo-cancel-btn"
                        onClick={() => cancelOrder(order._id)}
                        disabled={cancelling === order._id}
                      >
                        {cancelling === order._id ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    </>
                  ) : order.status === 'Cancelled' ? (
                    <span className="mo-action-note">This order was cancelled.</span>
                  ) : order.status === 'Delivered' ? (
                    <span className="mo-action-note">Delivered. Need help? See our <Link to="/help#returns" className="mo-inline-link">returns page</Link>.</span>
                  ) : order.status === 'Shipped' && order.shipment?.trackingUrl ? (
                    <>
                      <span className="mo-action-note">
                        With {order.shipment.courier || 'the courier'} · {order.shipment.trackingNumber}
                      </span>
                      <a className="mo-track-btn" href={order.shipment.trackingUrl} target="_blank" rel="noreferrer">
                        Track package ↗
                      </a>
                    </>
                  ) : (
                    <span className="mo-action-note">
                      Already on its way — <Link to="/help#contact" className="mo-inline-link">contact us</Link> if you need to make a change.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}