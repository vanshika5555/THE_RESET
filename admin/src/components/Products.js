import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Products.css';

// Inline styles so the switch renders correctly no matter what the CSS file has.
const track = (on) => ({
  width: '42px',
  height: '24px',
  borderRadius: '999px',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  position: 'relative',
  background: on ? '#22c55e' : '#d4d4d4',
  transition: 'background .18s ease',
  flexShrink: 0,
});

const knob = (on) => ({
  position: 'absolute',
  top: '3px',
  left: on ? '21px' : '3px',
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  background: '#fff',
  transition: 'left .18s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,.25)',
});

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('All');
  const [saving, setSaving] = useState(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const res = await axios.get(`/api/products`);
    setProducts(res.data);
  };

  const toggleStock = async (product) => {
    const next = !product.inStock;
    setSaving(product._id);

    // update the screen straight away, then confirm with the server
    setProducts(list =>
      list.map(p => (p._id === product._id ? { ...p, inStock: next } : p))
    );

    try {
      await axios.put(`/api/products/${product._id}`, { inStock: next });
    } catch (err) {
      // put it back if the save failed
      setProducts(list =>
        list.map(p => (p._id === product._id ? { ...p, inStock: !next } : p))
      );
      alert('Could not update stock. Please try again.');
    }
    setSaving(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`/api/products/${id}`);
      fetchProducts();
    } catch (err) {
      alert('Could not delete this product.');
    }
  };

  const filtered = filter === 'All' ? products : products.filter(p => p.category === filter);

  return (
    <div className="products-page">
      <div className="products-header">
        <h1 className="products-title">Products</h1>
        <Link to="/products/add" className="products-add-btn">+ Add Product</Link>
      </div>

      <div className="products-tabs">
        {['All', 'Men', 'Women'].map(f => (
          <button
            key={f}
            className={`products-tab ${filter === f ? 'products-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f} {f === 'All' ? `(${products.length})` : `(${products.filter(p => p.category === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="products-empty">No products found.</div>
      ) : (
        <table className="products-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Sizes</th>
              <th>Tag</th>
              <th>In Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p._id}>
                <td className="products-name">{p.name}</td>
                <td><span className={`dash-badge dash-badge--${p.category.toLowerCase()}`}>{p.category}</span></td>
                <td>{p.price}</td>
                <td className="products-sizes">{p.sizes.join(', ')}</td>
                <td>{p.tag || '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.inStock}
                      aria-label={`${p.name} in stock`}
                      style={track(p.inStock)}
                      onClick={() => toggleStock(p)}
                      disabled={saving === p._id}
                    >
                      <span style={knob(p.inStock)} />
                    </button>
                    <span style={{ fontSize: '13px', color: p.inStock ? '#15803d' : '#999' }}>
                      {p.inStock ? 'In Stock' : 'Out'}
                    </span>
                  </div>
                </td>
                <td className="products-actions">
                  <Link to={`/products/edit/${p._id}`} className="action-btn action-btn--edit">Edit</Link>
                  <button className="action-btn action-btn--delete" onClick={() => handleDelete(p._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}