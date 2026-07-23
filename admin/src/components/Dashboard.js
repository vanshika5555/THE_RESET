import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const STATUS_COLORS = {
  Pending:   '#f59e0b',
  Confirmed: '#3b82f6',
  Shipped:   '#8b5cf6',
  Delivered: '#22c55e',
  Cancelled: '#ef4444',
};

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/products').catch(() => ({ data: [] })),
      axios.get('/api/orders').catch(() => ({ data: [] })),
    ]).then(([p, o]) => {
      setProducts(p.data || []);
      setOrders(o.data || []);
      setLoading(false);
    });
  }, []);

  const pending    = orders.filter(o => o.status === 'Pending');
  const active     = orders.filter(o => o.status !== 'Cancelled');
  const revenue    = active.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const outOfStock = products.filter(p => !p.inStock);

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  if (loading) return <div className="dash-loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h1 className="dash-title">Dashboard</h1>
        <Link to="/products/add" className="dash-add-btn">+ Add Product</Link>
      </div>

      {/* Numbers you can act on */}
      <div className="dash-stats">
        <Link to="/orders" className={`stat-card ${pending.length ? 'stat-card--alert' : ''}`}>
          <p className="stat-label">Pending Orders</p>
          <p className="stat-num">{pending.length}</p>
          <p className="stat-hint">{pending.length ? 'Needs action' : 'All caught up'}</p>
        </Link>

        <div className="stat-card">
          <p className="stat-label">Revenue</p>
          <p className="stat-num stat-num--sm">{inr(revenue)}</p>
          <p className="stat-hint">{active.length} order{active.length !== 1 ? 's' : ''}</p>
        </div>

        <Link to="/products" className="stat-card">
          <p className="stat-label">Products</p>
          <p className="stat-num">{products.length}</p>
          <p className="stat-hint">
            {products.filter(p => p.category === 'Men').length} men ·{' '}
            {products.filter(p => p.category === 'Women').length} women
          </p>
        </Link>

        <Link to="/products" className={`stat-card ${outOfStock.length ? 'stat-card--alert' : ''}`}>
          <p className="stat-label">Out of Stock</p>
          <p className="stat-num">{outOfStock.length}</p>
          <p className="stat-hint">{outOfStock.length ? 'Restock or hide' : 'Nothing to fix'}</p>
        </Link>
      </div>

      {/* Recent orders — the actual daily job */}
      <div className="dash-section">
        <div className="dash-section-head">
          <h2 className="dash-section-title">Recent Orders</h2>
          {orders.length > 0 && <Link to="/orders" className="dash-see-all">View all →</Link>}
        </div>

        {recentOrders.length === 0 ? (
          <div className="dash-empty">
            <p>No orders yet.</p>
          </div>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(o => (
                <tr key={o._id}>
                  <td className="dash-mono">#{o._id.slice(-6).toUpperCase()}</td>
                  <td>{o.user?.name || 'Unknown'}</td>
                  <td>{o.items?.length || 0}</td>
                  <td>{inr(o.subtotal)}</td>
                  <td>
                    <span
                      className="dash-status"
                      style={{ color: STATUS_COLORS[o.status], borderColor: STATUS_COLORS[o.status] }}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="dash-muted">
                    {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      {/* All products at a glance */}
      <div className="dash-section">
        <div className="dash-section-head">
          <h2 className="dash-section-title">All Products ({products.length})</h2>
          <Link to="/products" className="dash-see-all">Manage →</Link>
        </div>

        {products.length === 0 ? (
          <div className="dash-empty">
            <p>No products yet.</p>
          </div>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Sizes</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>
                    <span className={`dash-badge dash-badge--${p.category.toLowerCase()}`}>
                      {p.category}
                    </span>
                  </td>
                  <td>{p.price}</td>
                  <td className="dash-muted">{(p.sizes || []).join(', ') || '—'}</td>
                  <td>
                    <span
                      className="dash-status"
                      style={{
                        color: p.inStock ? '#15803d' : '#b45309',
                        borderColor: p.inStock ? '#86efac' : '#f4c9a0',
                      }}
                    >
                      {p.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/products/edit/${p._id}`} className="dash-edit-link">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Only appears when something is wrong */}
      {outOfStock.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-head">
            <h2 className="dash-section-title">Needs Attention</h2>
          </div>
          <div className="dash-alert-list">
            {outOfStock.slice(0, 6).map(p => (
              <Link key={p._id} to={`/products/edit/${p._id}`} className="dash-alert-row">
                <span className="dash-alert-name">{p.name}</span>
                <span className="dash-alert-meta">{p.category} · {p.subcategory}</span>
                <span className="dash-alert-tag">Out of stock</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}