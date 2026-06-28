import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MyOrders.css';

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

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    axios.get(`/api/orders/myorders`, {
      headers: { Authorization: `Bearer ${user.token}` }
    }).then(res => { setOrders(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, navigate]);

  if (loading) return <div className="mo-loading">Loading your orders...</div>;

  return (
    <div className="mo-page">
      <div className="mo-header">
        <h1 className="mo-title">My Orders</h1>
        <p className="mo-sub">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
      </div>

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
                        {item.image && <img src={item.image} alt={item.name} />}
                      </div>
                      <div className="mo-item-info">
                        <p className="mo-item-name">{item.name}</p>
                        <p className="mo-item-meta">Size: {item.size} · Qty: {item.qty}</p>
                        <p className="mo-item-price">{item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mo-card-footer">
                  <div className="mo-address">
                    <span>Delivering to: </span>
                    {order.shippingAddress.fullName}, {order.shippingAddress.city}
                  </div>
                  <div className="mo-total">
                    Total: <strong>₹{order.subtotal.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}