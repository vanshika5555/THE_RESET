import React, { useState, useEffect } from 'react';
import ProfileReviews from '../components/ProfileReviews';
import AddressFields, { BLANK_ADDRESS, validateAddress } from '../components/AddressFields';
import '../components/AddressFields.css';
import { Link, useNavigate, useLocation, Routes, Route, NavLink } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { passwordProblem } from '../components/PasswordField';
import './Profile.css';
import { formatPrice } from '../utils/price';

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
  const navigate = useNavigate();
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
             <div
                key={order._id}
                className="prof-order-card prof-order-card--link"
                onClick={() => navigate(`/orders/${order._id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/orders/${order._id}`); }}
              >
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
                        {item.image && <img src={item.image} alt="" loading="lazy" />}
                      </div>
                      <div>
                        <p className="prof-order-name">{item.name}</p>
                        <p className="prof-order-meta">Size: {item.size} · Qty: {item.qty} · {formatPrice(item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="prof-order-footer">
                  <span>📍 {order.shippingAddress?.city}</span>
                  <span><strong>₹{(Number(order.total) || Number(order.subtotal) || 0).toLocaleString('en-IN')}</strong></span>
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
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK_ADDRESS);
  const [editId, setEditId]       = useState(null);

  useEffect(() => {
    axios.get('/api/auth/addresses')
      .then(res => { setAddresses(res.data || []); setLoading(false); })
      .catch(() => { setError('Could not load your addresses.'); setLoading(false); });
  }, []);

  const save = async () => {
    const errs = validateAddress(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = editId
        ? await axios.put(`/api/auth/addresses/${editId}`, form)
        : await axios.post('/api/auth/addresses', form);
      setAddresses(res.data || []);
      setForm(BLANK_ADDRESS);
      setEditId(null);
      setFieldErrors({});
      setShowForm(false);
    } catch (err) {
      setError(
        err.response
          ? (err.response.data?.message || 'Could not save the address.')
          : 'Cannot reach the server.'
      );
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this address?')) return;
    try {
      const res = await axios.delete(`/api/auth/addresses/${id}`);
      setAddresses(res.data || []);
    } catch {
      setError('Could not remove the address.');
    }
  };

  const edit = (addr) => {
    setForm({ ...BLANK_ADDRESS, ...addr });
    setEditId(addr._id);
    setShowForm(true);
    setError('');
    setFieldErrors({});
  };

  const startNew = () => {
    setForm(BLANK_ADDRESS);
    setEditId(null);
    setShowForm(true);
    setError('');
    setFieldErrors({});
  };

  const oneLine = (a) => [a.houseNo, a.address, a.landmark, a.city, a.state]
    .filter(Boolean).join(', ');

  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <h2 className="prof-section-title">Saved Addresses</h2>
        <button className="prof-add-btn" onClick={startNew}>+ Add New Address</button>
      </div>

      {error && <p style={{ color: '#b91c1c', fontSize: '14px' }}>{error}</p>}

      {showForm && (
        <div className="prof-addr-form">
          <AddressFields value={form} onChange={setForm} errors={fieldErrors} />
          <div className="prof-form-actions">
            <button className="prof-btn prof-btn--outline" onClick={() => { setShowForm(false); setError(''); setFieldErrors({}); }}>
              Cancel
            </button>
            <button className="prof-btn prof-btn--fill" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Address'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="prof-loading">Loading addresses...</div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="prof-empty">
          <p>No saved addresses yet.</p>
          <p style={{ fontSize: '14px', color: '#888' }}>
            Save one and it will be ready at checkout.
          </p>
        </div>
      ) : (
        <div className="prof-addr-list">
          {addresses.map((addr) => (
            <div key={addr._id} className="prof-addr-card">
              <div className="prof-addr-label-tag">{addr.label}</div>
              <p className="prof-addr-name">{addr.fullName} · +91 {addr.phone}</p>
              <p className="prof-addr-text">{oneLine(addr)} - {addr.pincode}</p>
              <div className="prof-addr-actions">
                <button onClick={() => edit(addr)}>Edit</button>
                <button onClick={() => remove(addr._id)} className="prof-addr-remove">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangePassword() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setError(''); };

  // The server hands back a fresh token for this device and signs every
  // other device out, so the new token has to be stored straight away.
  const keepSession = (data) => {
    if (data?.token) login({ ...user, ...data, token: data.token });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    const problem = passwordProblem(form.newPass);
    if (problem) { setError(problem); return; }
    if (form.newPass !== form.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await axios.put('/api/auth/changepassword', {
        currentPassword: form.current,
        newPassword: form.newPass,
      });
      keepSession(res.data);
      setMsg('Password changed. Any other device you were signed in on has been signed out.');
      setForm({ current: '', newPass: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.');
    }
    setLoading(false);
  };

  const signOutEverywhere = async () => {
    setMsg(''); setError('');
    setSigningOut(true);
    try {
      const res = await axios.post('/api/auth/logout-all');
      keepSession(res.data);
      setMsg('Signed out on every other device. You are still signed in here.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sign out other devices.');
    }
    setSigningOut(false);
  };

  return (
    <div className="prof-section">
      <h2 className="prof-section-title">Password &amp; security</h2>
      <div className="prof-password-form">
        {msg   && <div className="prof-success" role="status">{msg}</div>}
        {error && <div className="prof-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="prof-form-field prof-form-field--full">
            <label htmlFor="pw-current">Current Password</label>
            <input id="pw-current" type="password" autoComplete="current-password" value={form.current} onChange={set('current')} placeholder="••••••••" required />
          </div>
          <div className="prof-form-field prof-form-field--full">
            <label htmlFor="pw-new">New Password</label>
            <input id="pw-new" type="password" autoComplete="new-password" value={form.newPass} onChange={set('newPass')} placeholder="8+ characters, a letter and a number" required />
          </div>
          <div className="prof-form-field prof-form-field--full">
            <label htmlFor="pw-confirm">Confirm New Password</label>
            <input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat new password" required />
          </div>
          <div className="prof-form-actions">
            <button type="submit" className="prof-btn prof-btn--fill" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

        <div className="prof-security">
          <div>
            <p className="prof-security-title">Signed in somewhere you don't recognise?</p>
            <p className="prof-security-text">Sign out of every other phone and computer. You'll stay signed in here.</p>
          </div>
          <button type="button" className="prof-btn prof-btn--outline" onClick={signOutEverywhere} disabled={signingOut}>
            {signingOut ? 'Signing out...' : 'Sign out other devices'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Privacy: emails, my data, delete account ───
function Privacy() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    axios.get('/api/auth/preferences').then((res) => setPrefs(res.data)).catch(() => setPrefs({ shoppingEmails: true, newsletter: false }));
  }, []);

  const savePref = async (change) => {
    const before = prefs;
    setPrefs((p) => ({ ...p, ...change }));
    setSaving(true); setMsg(''); setError('');
    try {
      await axios.put('/api/auth/preferences', change);
      setMsg('Saved.');
    } catch {
      setPrefs(before);
      setError('Could not save that. Try again.');
    }
    setSaving(false);
  };

  const downloadData = async () => {
    setExporting(true); setError('');
    try {
      const res = await axios.get('/api/auth/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'the-reset-my-data.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Could not prepare your data. Try again.');
    }
    setExporting(false);
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    setDeleting(true); setDeleteError('');
    try {
      await axios.delete('/api/auth/account', { data: { password } });
      try {
        ['thereset_cart', 'thereset_wishlist', 'thereset_recent', 'thereset_pin'].forEach((k) => localStorage.removeItem(k));
      } catch { /* nothing to clear */ }
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete the account. Try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="prof-section">
      <h2 className="prof-section-title">Privacy &amp; emails</h2>
      {msg && <div className="prof-success" role="status">{msg}</div>}
      {error && <div className="prof-error" role="alert">{error}</div>}

      <div className="prof-privacy">
        <label className="prof-pref">
          <span>
            <span className="prof-security-title">Bag reminders &amp; price drops</span>
            <span className="prof-security-text">One email if you leave something in your bag, and when a wishlist piece gets cheaper.</span>
          </span>
          <input
            type="checkbox"
            className="prof-switch"
            checked={!!prefs?.shoppingEmails}
            disabled={!prefs || saving}
            onChange={(e) => savePref({ shoppingEmails: e.target.checked })}
          />
        </label>

        {prefs?.newsletter && (
          <div className="prof-security">
            <div>
              <p className="prof-security-title">Newsletter</p>
              <p className="prof-security-text">You get new drops and restocks by email.</p>
            </div>
            <button type="button" className="prof-btn prof-btn--outline" onClick={() => savePref({ newsletter: false })} disabled={saving}>
              Unsubscribe
            </button>
          </div>
        )}

        <p className="prof-privacy-note">Order, delivery and password emails always arrive — they're about things you asked for.</p>

        <div className="prof-security">
          <div>
            <p className="prof-security-title">Download your data</p>
            <p className="prof-security-text">Your account, addresses, orders, reviews and returns, as one file.</p>
          </div>
          <button type="button" className="prof-btn prof-btn--outline" onClick={downloadData} disabled={exporting}>
            {exporting ? 'Preparing…' : 'Download'}
          </button>
        </div>

        <div className="prof-security prof-danger">
          <div>
            <p className="prof-security-title">Delete your account</p>
            <p className="prof-security-text">
              Removes your account, addresses, wishlist and reviews for good. Past orders are kept for tax records,
              no longer linked to you.
            </p>
          </div>
          {!confirming && (
            <button type="button" className="prof-btn prof-btn--danger" onClick={() => setConfirming(true)}>
              Delete account
            </button>
          )}
        </div>

        {confirming && (
          <form className="prof-delete" onSubmit={deleteAccount}>
            <p className="prof-delete-warn">This can't be undone. Enter your password to confirm.</p>
            {deleteError && <div className="prof-error" role="alert">{deleteError}</div>}
            <div className="prof-form-field prof-form-field--full">
              <label htmlFor="del-pw">Password</label>
              <input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="prof-form-actions">
              <button type="button" className="prof-btn prof-btn--outline" onClick={() => { setConfirming(false); setPassword(''); setDeleteError(''); }}>
                Keep my account
              </button>
              <button type="submit" className="prof-btn prof-btn--danger-fill" disabled={deleting || !password}>
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Profile Layout ───────────────────
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.notice;

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const navItems = [
    { to: '/profile', label: 'Overview', icon: '👤' },
    { to: '/profile/orders', label: 'My Orders', icon: '📦' },
    { to: '/profile/addresses', label: 'Addresses', icon: '📍' },
    { to: '/profile/reviews', label: 'Reviews', icon: '⭐' },
    { to: '/profile/password', label: 'Security', icon: '🔒' },
    { to: '/profile/privacy', label: 'Privacy', icon: '🛡️' },
  ];

  return (
    <div className="prof-layout">
      {/* Sidebar */}
      <aside className="prof-sidebar">
        <div className="prof-sidebar-top">
          <div className="prof-sidebar-avatar">{user.name?.charAt(0).toUpperCase()}</div>
          <div className="prof-sidebar-who">
            <p className="prof-sidebar-name">{user.name}</p>
            <p className="prof-sidebar-email">{user.email}</p>
          </div>
        </div>
        <nav className="prof-nav" aria-label="Account">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/profile'}
              className={({ isActive }) => `prof-nav-link ${isActive ? 'prof-nav-link--active' : ''}`}
            >
              <span className="prof-nav-icon" aria-hidden="true">{item.icon}</span>
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
        {notice && <div className="prof-success prof-notice" role="status">{notice}</div>}
        <Routes>
          <Route index element={<Overview user={user} />} />
          <Route path="orders" element={<Orders user={user} />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="reviews" element={<ProfileReviews />} />
          <Route path="password" element={<ChangePassword />} />
          <Route path="privacy" element={<Privacy />} />
        </Routes>
      </main>
    </div>
  );
}