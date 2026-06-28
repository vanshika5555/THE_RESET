import React, { useState, useEffect } from 'react';
import ProfileReviews from '../components/ProfileReviews';
import { Link, useNavigate, Routes, Route, NavLink } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

// ─── Sub pages ───────────────────────────

function Overview({ user }) {
  return (
    <div className="prof-section">
      <h2 className="prof-section-title">My Profile</h2>
      <div className="prof-card">
        <div className="prof-avatar">
          <span>{user?.name?.charAt(0).toUpperCase()}</span>
        </div>
        <div className="prof-info">
          <div className="prof-info-row">
            <span className="prof-info-label">Full Name</span>
            <span className="prof-info-value">{user?.name}</span>
          </div>
          <div className="prof-info-row">
            <span className="prof-info-label">Email Address</span>
            <span className="prof-info-value">{user?.email}</span>
          </div>
          <div className="prof-info-row">
            <span className="prof-info-label">Account Type</span>
            <span className="prof-info-value prof-badge">{user?.role === 'admin' ? 'Admin' : 'Customer'}</span>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="prof-quick-links">
        <Link to="/profile/orders" className="prof-quick-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="2"/>
          </svg>
          <span>My Orders</span>
          <span className="prof-arrow">→</span>
        </Link>
        <Link to="/profile/addresses" className="prof-quick-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span>Saved Addresses</span>
          <span className="prof-arrow">→</span>
        </Link>
        <Link to="/profile/reviews" className="prof-quick-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>My Reviews</span>
          <span className="prof-arrow">→</span>
        </Link>
        <Link to="/profile/password" className="prof-quick-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Change Password</span>
          <span className="prof-arrow">→</span>
        </Link>
      </div>
    </div>
  );
}

// ─── Orders ───────────────────────────────
const STATUS_COLORS = {
  Pending:   { bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
  Confirmed: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Shipped:   { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  Delivered: { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  Cancelled: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
};

function Orders({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/orders/myorders`, {
      headers: { Authorization: `Bearer ${user.token}` }
    }).then(res => { setOrders(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="prof-loading">Loading orders...</div>;

  return (
    <div className="prof-section">
      <h2 className="prof-section-title">My Orders</h2>
      {orders.length === 0 ? (
        <div className="prof-empty">
          <p>No orders yet.</p>
          <Link to="/" className="prof-empty-btn">Start Shopping →</Link>
        </div>
      ) : (
        <div className="prof-orders-list">
          {orders.map(order => {
            const s = STATUS_COLORS[order.status] || STATUS_COLORS.Pending;
            return (
              <div key={order._id} className="prof-order-card">
                <div className="prof-order-header">
                  <div>
                    <p className="prof-order-id">Order #{order._id.slice(-8).toUpperCase()}</p>
                    <p className="prof-order-date">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <span className="prof-status-badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {order.status}
                  </span>
                </div>
                <div className="prof-order-items">
                  {order.items.map((item, i) => (
                    <div key={i} className="prof-order-item">
                      <div className="prof-order-img" style={{ background: item.color || '#f0f0f0' }}>
                        {item.image && <img src={item.image} alt={item.name} />}
                      </div>
                      <div>
                        <p className="prof-order-name">{item.name}</p>
                        <p className="prof-order-meta">Size: {item.size} · Qty: {item.qty} · {item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="prof-order-footer">
                  <span>📍 {order.shippingAddress?.city}</span>
                  <span><strong>₹{order.subtotal?.toLocaleString('en-IN')}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Addresses ────────────────────────────
function Addresses() {
  const [addresses, setAddresses] = useState(
    JSON.parse(localStorage.getItem('theresetAddresses') || '[]')
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: 'Home', fullName: '', phone: '', address: '', city: '', state: '', pincode: '' });
  const [editIdx, setEditIdx] = useState(null);

  const save = () => {
    if (!form.fullName || !form.phone || !form.address || !form.city || !form.pincode) return;
    let updated;
    if (editIdx !== null) {
      updated = addresses.map((a, i) => i === editIdx ? form : a);
      setEditIdx(null);
    } else {
      updated = [...addresses, form];
    }
    setAddresses(updated);
    localStorage.setItem('theresetAddresses', JSON.stringify(updated));
    setForm({ label: 'Home', fullName: '', phone: '', address: '', city: '', state: '', pincode: '' });
    setShowForm(false);
  };

  const remove = (i) => {
    const updated = addresses.filter((_, idx) => idx !== i);
    setAddresses(updated);
    localStorage.setItem('theresetAddresses', JSON.stringify(updated));
  };

  const edit = (i) => {
    setForm(addresses[i]);
    setEditIdx(i);
    setShowForm(true);
  };

  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <h2 className="prof-section-title">Saved Addresses</h2>
        <button className="prof-add-btn" onClick={() => { setShowForm(true); setEditIdx(null); setForm({ label: 'Home', fullName: '', phone: '', address: '', city: '', state: '', pincode: '' }); }}>
          + Add New Address
        </button>
      </div>

      {showForm && (
        <div className="prof-addr-form">
          <div className="prof-addr-labels">
            {['Home', 'Work', 'Other'].map(l => (
              <button key={l} className={`prof-label-btn ${form.label === l ? 'prof-label-btn--active' : ''}`} onClick={() => setForm(f => ({ ...f, label: l }))}>{l}</button>
            ))}
          </div>
          <div className="prof-form-grid">
            <div className="prof-form-field prof-form-field--full">
              <label>Full Name *</label>
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="prof-form-field">
              <label>Phone *</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10 digit number" maxLength={10} />
            </div>
            <div className="prof-form-field">
              <label>Pincode *</label>
              <input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} placeholder="6 digit pincode" maxLength={6} />
            </div>
            <div className="prof-form-field prof-form-field--full">
              <label>Address *</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="House No., Street, Area" />
            </div>
            <div className="prof-form-field">
              <label>City *</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
            </div>
            <div className="prof-form-field">
              <label>State</label>
              <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State" />
            </div>
          </div>
          <div className="prof-form-actions">
            <button className="prof-btn prof-btn--outline" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="prof-btn prof-btn--fill" onClick={save}>{editIdx !== null ? 'Save Changes' : 'Add Address'}</button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="prof-empty"><p>No saved addresses yet.</p></div>
      ) : (
        <div className="prof-addr-list">
          {addresses.map((addr, i) => (
            <div key={i} className="prof-addr-card">
              <div className="prof-addr-label-tag">{addr.label}</div>
              <p className="prof-addr-name">{addr.fullName} · {addr.phone}</p>
              <p className="prof-addr-text">{addr.address}, {addr.city}{addr.state ? `, ${addr.state}` : ''} - {addr.pincode}</p>
              <div className="prof-addr-actions">
                <button onClick={() => edit(i)}>Edit</button>
                <button onClick={() => remove(i)} className="prof-addr-remove">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reviews ── (moved to ProfileReviews.js) ──────────────────────────────
// keeping stub for now
function Reviews({ user }) {
  const [reviews, setReviews] = useState(
    JSON.parse(localStorage.getItem(`theresetReviews_${user?._id}`) || '[]')
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product: '', rating: 5, review: '' });

  const saveReview = () => {
    if (!form.product || !form.review) return;
    const updated = [{ ...form, date: new Date().toISOString() }, ...reviews];
    setReviews(updated);
    localStorage.setItem(`theresetReviews_${user?._id}`, JSON.stringify(updated));
    setForm({ product: '', rating: 5, review: '' });
    setShowForm(false);
  };

  const removeReview = (i) => {
    const updated = reviews.filter((_, idx) => idx !== i);
    setReviews(updated);
    localStorage.setItem(`theresetReviews_${user?._id}`, JSON.stringify(updated));
  };

  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <h2 className="prof-section-title">My Reviews</h2>
        <button className="prof-add-btn" onClick={() => setShowForm(true)}>+ Write a Review</button>
      </div>

      {showForm && (
        <div className="prof-addr-form">
          <div className="prof-form-field prof-form-field--full">
            <label>Product Name</label>
            <input value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} placeholder="e.g. Clean Fit Oxford Shirt" />
          </div>
          <div className="prof-form-field">
            <label>Rating</label>
            <div className="prof-stars-input">
              {[1,2,3,4,5].map(star => (
                <button key={star} className={`prof-star-btn ${star <= form.rating ? 'prof-star-btn--active' : ''}`} onClick={() => setForm(f => ({ ...f, rating: star }))}>★</button>
              ))}
              <span className="prof-star-label">{form.rating}/5</span>
            </div>
          </div>
          <div className="prof-form-field prof-form-field--full">
            <label>Your Review</label>
            <textarea value={form.review} onChange={e => setForm(f => ({ ...f, review: e.target.value }))} placeholder="Share your experience..." rows={4} />
          </div>
          <div className="prof-form-actions">
            <button className="prof-btn prof-btn--outline" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="prof-btn prof-btn--fill" onClick={saveReview}>Submit Review</button>
          </div>
        </div>
      )}

      {reviews.length === 0 && !showForm ? (
        <div className="prof-empty"><p>You haven't written any reviews yet.</p></div>
      ) : (
        <div className="prof-reviews-list">
          {reviews.map((r, i) => (
            <div key={i} className="prof-review-card">
              <div className="prof-review-header">
                <div>
                  <p className="prof-review-product">{r.product}</p>
                  <div className="prof-stars">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={s <= r.rating ? 'prof-star--filled' : 'prof-star--empty'}>★</span>
                    ))}
                    <span className="prof-star-label">{r.rating}/5</span>
                  </div>
                </div>
                <div className="prof-review-meta">
                  <p className="prof-review-date">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <button className="prof-review-remove" onClick={() => removeReview(i)}>Delete</button>
                </div>
              </div>
              <p className="prof-review-text">{r.review}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Change Password ───────────────────────
function ChangePassword({ user }) {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (form.newPass.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (form.newPass !== form.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await axios.put(`/api/auth/changepassword`, {
        currentPassword: form.current,
        newPassword: form.newPass
      }, { headers: { Authorization: `Bearer ${user.token}` } });
      setMsg('Password changed successfully!');
      setForm({ current: '', newPass: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.');
    }
    setLoading(false);
  };

  return (
    <div className="prof-section">
      <h2 className="prof-section-title">Change Password</h2>
      <div className="prof-password-form">
        {msg   && <div className="prof-success">{msg}</div>}
        {error && <div className="prof-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="prof-form-field prof-form-field--full">
            <label>Current Password</label>
            <input type="password" value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} placeholder="••••••••" />
          </div>
          <div className="prof-form-field prof-form-field--full">
            <label>New Password</label>
            <input type="password" value={form.newPass} onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))} placeholder="At least 6 characters" />
          </div>
          <div className="prof-form-field prof-form-field--full">
            <label>Confirm New Password</label>
            <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
          </div>
          <div className="prof-form-actions">
            <button type="submit" className="prof-btn prof-btn--fill" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Profile Layout ───────────────────
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const navItems = [
    { to: '/profile', label: 'Overview', icon: '👤' },
    { to: '/profile/orders', label: 'My Orders', icon: '📦' },
    { to: '/profile/addresses', label: 'Addresses', icon: '📍' },
    { to: '/profile/reviews', label: 'Reviews', icon: '⭐' },
    { to: '/profile/password', label: 'Change Password', icon: '🔒' },
  ];

  return (
    <div className="prof-layout">
      {/* Sidebar */}
      <aside className="prof-sidebar">
        <div className="prof-sidebar-top">
          <div className="prof-sidebar-avatar">{user.name?.charAt(0).toUpperCase()}</div>
          <p className="prof-sidebar-name">{user.name}</p>
          <p className="prof-sidebar-email">{user.email}</p>
        </div>
        <nav className="prof-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/profile'}
              className={({ isActive }) => `prof-nav-link ${isActive ? 'prof-nav-link--active' : ''}`}
            >
              <span className="prof-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="prof-logout-btn" onClick={() => { logout(); navigate('/'); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </aside>

      {/* Content */}
      <main className="prof-content">
        <Routes>
          <Route index element={<Overview user={user} />} />
          <Route path="orders" element={<Orders user={user} />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="reviews" element={<ProfileReviews />} />
          <Route path="password" element={<ChangePassword user={user} />} />
        </Routes>
      </main>
    </div>
  );
}