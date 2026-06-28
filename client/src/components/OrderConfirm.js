import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OrderConfirm.css';

export default function OrderConfirm({ orderId }) {
  const { user } = useAuth();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    axios.get(`/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${user.token}` }
    }).then(res => setOrder(res.data));
  }, [orderId, user]);

  return (
    <div className="oc-page">
      <div className="oc-box">
        <div className="oc-icon">✓</div>
        <h1 className="oc-title">Order Confirmed!</h1>
        <p className="oc-sub">Thank you, {user?.name?.split(' ')[0]}. Your order has been placed successfully.</p>

        {order && (
          <>
            <div className="oc-id">Order ID: <span>#{order._id.slice(-8).toUpperCase()}</span></div>

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
              <p>{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.address}, {order.shippingAddress.city} - {order.shippingAddress.pincode}</p>
            </div>

            <div className="oc-total">
              Total Paid: <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="oc-status">
              Status: <span className="oc-status-badge">{order.status}</span>
            </div>
          </>
        )}

        <div className="oc-actions">
          <Link to="/orders" className="oc-btn oc-btn--outline">View My Orders</Link>
          <Link to="/" className="oc-btn oc-btn--fill">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}