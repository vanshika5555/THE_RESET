import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Customers.css';

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Customers() {
  const [users, setUsers]     = useState([]);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(null);   // expanded customer id
  const [search, setSearch]   = useState('');

  useEffect(() => {
    Promise.all([
      axios.get('/api/auth/users').catch(() => ({ data: [] })),
      axios.get('/api/orders').catch(() => ({ data: [] })),
    ]).then(([u, o]) => {
      setUsers(u.data || []);
      setOrders(o.data || []);
      setLoading(false);
    });
  }, []);

  // Build a per-customer summary from their orders
  const summary = (userId) => {
    const mine = orders.filter(o => (o.user?._id || o.user) === userId);
    const active = mine.filter(o => o.status !== 'Cancelled');
    return {
      orders: mine,
      count: mine.length,
      spent: active.reduce((s, o) => s + (o.subtotal || 0), 0),
      last: mine.length
        ? mine.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b))
        : null,
    };
  };

  const customers = users.filter(u => u.role !== 'admin');

  const filtered = search.trim()
    ? customers.filter(u => {
        const q = search.toLowerCase();
        return (u.name || '').toLowerCase().includes(q) ||
               (u.email || '').toLowerCase().includes(q);
      })
    : customers;

  const withOrders = customers.filter(u => summary(u._id).count > 0).length;

  if (loading) return <div className="cu-loading">Loading customers...</div>;

  return (
    <div className="cu-page">
      <div className="cu-header">
        <h1 className="cu-title">Customers</h1>
      </div>

      <div className="cu-stats">
        <div className="cu-stat">
          <p className="cu-stat-label">Registered</p>
          <p className="cu-stat-num">{customers.length}</p>
        </div>
        <div className="cu-stat">
          <p className="cu-stat-label">Have Ordered</p>
          <p className="cu-stat-num">{withOrders}</p>
        </div>
        <div className="cu-stat">
          <p className="cu-stat-label">Never Ordered</p>
          <p className="cu-stat-num">{customers.length - withOrders}</p>
        </div>
      </div>

      <input
        className="cu-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email..."
      />

      {filtered.length === 0 ? (
        <div className="cu-empty">
          {customers.length === 0 ? 'No customers have signed up yet.' : 'No customers match that search.'}
        </div>
      ) : (
        <div className="cu-list">
          {filtered.map(u => {
            const s = summary(u._id);
            const isOpen = open === u._id;

            return (
              <div key={u._id} className={`cu-card ${isOpen ? 'cu-card--open' : ''}`}>
                <button
                  type="button"
                  className="cu-row"
                  onClick={() => setOpen(isOpen ? null : u._id)}
                >
                  <span className="cu-avatar">{(u.name || '?').charAt(0).toUpperCase()}</span>

                  <span className="cu-identity">
                    <span className="cu-name">{u.name}</span>
                    <span className="cu-email">{u.email}</span>
                  </span>

                  <span className="cu-col">
                    <span className="cu-col-label">Joined</span>
                    <span className="cu-col-value">{fmtDate(u.createdAt)}</span>
                  </span>

                  <span className="cu-col">
                    <span className="cu-col-label">Orders</span>
                    <span className="cu-col-value">{s.count}</span>
                  </span>

                  <span className="cu-col">
                    <span className="cu-col-label">Spent</span>
                    <span className="cu-col-value">{inr(s.spent)}</span>
                  </span>

                  <span className={`cu-chev ${isOpen ? 'cu-chev--open' : ''}`}>⌄</span>
                </button>

                {isOpen && (
                  <div className="cu-detail">
                    {s.count === 0 ? (
                      <p className="cu-no-orders">This customer has signed up but not ordered yet.</p>
                    ) : (
                      <>
                        <p className="cu-detail-head">
                          Order history ({s.count}) · last on {fmtDate(s.last.createdAt)}
                        </p>

                        {s.orders
                          .slice()
                          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                          .map(o => (
                            <div key={o._id} className="cu-order">
                              <div className="cu-order-head">
                                <span className="cu-order-id">#{o._id.slice(-6).toUpperCase()}</span>
                                <span className="cu-order-status">{o.status}</span>
                                <span className="cu-order-date">{fmtDate(o.createdAt)}</span>
                                <span className="cu-order-total">{inr(o.subtotal)}</span>
                              </div>

                              <div className="cu-items">
                                {(o.items || []).map((it, i) => (
                                  <span key={i} className="cu-item">
                                    {it.name}
                                    <span className="cu-item-meta"> · {it.size} · x{it.qty}</span>
                                  </span>
                                ))}
                              </div>

                              {o.shippingAddress && (
                                <p className="cu-address">
                                  {o.shippingAddress.city} — {o.shippingAddress.pincode}
                                </p>
                              )}
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="cu-note">
        Passwords are stored encrypted and cannot be viewed by anyone, including you.
        If a customer is locked out, ask them to register a new account or add a
        password-reset flow.
      </p>
    </div>
  );
}