import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminOrders.css';

const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

const STATUS_COLORS = {
  Pending:   '#f59e0b',
  Confirmed: '#3b82f6',
  Shipped:   '#8b5cf6',
  Delivered: '#22c55e',
  Cancelled: '#ef4444',
};

// Hardcoded admin token for now — replace with real login later
const ADMIN_TOKEN = localStorage.getItem('theresetAdminToken') || '';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/orders', {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
      });
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`http://localhost:5000/api/orders/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
      );
      fetchOrders();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const filtered = filter === 'All' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="ao-page">
      <div className="ao-header">
        <h1 className="ao-title">Orders</h1>
        <p className="ao-count">{orders.length} total orders</p>
      </div>

      {/* Filter tabs */}
      <div className="ao-tabs">
        {['All', ...STATUSES].map(s => (
          <button
            key={s}
            className={`ao-tab ${filter === s ? 'ao-tab--active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s} ({s === 'All' ? orders.length : orders.filter(o => o.status === s).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="ao-loading">Loading orders...</p>
      ) : filtered.length === 0 ? (
        <div className="ao-empty">No orders found.</div>
      ) : (
        <div className="ao-list">
          {filtered.map(order => (
            <div key={order._id} className="ao-card">
              <div className="ao-card-header">
                <div className="ao-order-meta">
                  <span className="ao-order-id">#{order._id.slice(-8).toUpperCase()}</span>
                  <span className="ao-order-date">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="ao-customer">
                  <span className="ao-customer-name">{order.user?.name || 'Unknown'}</span>
                  <span className="ao-customer-email">{order.user?.email || ''}</span>
                </div>
                <div className="ao-status-control">
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order._id, e.target.value)}
                    className="ao-status-select"
                    style={{ borderColor: STATUS_COLORS[order.status] }}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="ao-items">
                {order.items.map((item, i) => (
                  <div key={i} className="ao-item">
                    <div className="ao-item-img" style={{ background: item.color || '#f0f0f0' }}>
                      {item.image && <img src={item.image} alt={item.name} />}
                    </div>
                    <div className="ao-item-info">
                      <p className="ao-item-name">{item.name}</p>
                      <p className="ao-item-meta">Size: {item.size} · Qty: {item.qty} · {item.price}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ao-card-footer">
                <div className="ao-address">
                  📍 {order.shippingAddress?.fullName}, {order.shippingAddress?.address}, {order.shippingAddress?.city} - {order.shippingAddress?.pincode}
                </div>
                <div className="ao-total">₹{order.subtotal?.toLocaleString('en-IN')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}