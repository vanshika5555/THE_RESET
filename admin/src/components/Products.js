import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import StockInput from './StockInput';
import './Products.css';

const track = (on) => ({
  width: '42px', height: '24px', borderRadius: '999px', border: 'none',
  padding: 0, cursor: 'pointer', position: 'relative',
  background: on ? '#22c55e' : '#d4d4d4',
  transition: 'background .18s ease', flexShrink: 0,
});

const knob = (on) => ({
  position: 'absolute', top: '3px', left: on ? '21px' : '3px',
  width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
  transition: 'left .18s ease', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
});

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`/api/products`);
      setProducts(res.data);
    } catch {
      setError('Could not load products.');
    }
  };

  // How many are left in a size (products from before stock tracking have none)
  const qtyFor = (p, size) => {
    const entry = (p.stock || []).find(s => s.size === size);
    return entry ? entry.qty : null;
  };

  const totalStock = (p) =>
    (p.stock || [])
      .filter(s => (p.sizes || []).includes(s.size))
      .reduce((sum, s) => sum + (Number(s.qty) || 0), 0);

  const saveStock = async (product, size, qty) => {
    // rebuild the whole stock list with this one size changed
    const next = (product.sizes || []).map(s => {
      if (s === size) return { size: s, qty };
      const existing = (product.stock || []).find(e => e.size === s);
      return { size: s, qty: existing ? existing.qty : 0 };
    });

    const previous = product.stock;

    // show it straight away
    setProducts(list =>
      list.map(p => (p._id === product._id ? { ...p, stock: next } : p))
    );
    setError('');

    try {
      const res = await axios.put(`/api/products/${product._id}`, { stock: next });
      // trust the server's version of the product
      setProducts(list =>
        list.map(p => (p._id === product._id ? res.data : p))
      );
    } catch (err) {
      // put it back and let the input show the failure
      setProducts(list =>
        list.map(p => (p._id === product._id ? { ...p, stock: previous } : p))
      );
      setError('Could not save stock. Check the backend is running.');
      throw err;
    }
  };

  const toggleStock = async (product) => {
    const next = !product.inStock;
    setProducts(list =>
      list.map(p => (p._id === product._id ? { ...p, inStock: next } : p))
    );
    try {
      await axios.put(`/api/products/${product._id}`, { inStock: next });
    } catch {
      setProducts(list =>
        list.map(p => (p._id === product._id ? { ...p, inStock: !next } : p))
      );
      setError('Could not update this product.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`/api/products/${id}`);
      fetchProducts();
    } catch {
      setError('Could not delete this product.');
    }
  };

  const filtered = filter === 'All' ? products : products.filter(p => p.category === filter);

  return (
    <div className="products-page">
      <div className="products-header">
        <h1 className="products-title">Products</h1>
        <Link to="/products/add" className="products-add-btn">+ Add Product</Link>
      </div>

      {error && <div className="products-error">{error}</div>}

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
              <th>Stock by size</th>
              <th>Listed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const tracked = (p.stock || []).length > 0;
              const total = totalStock(p);

              return (
                <tr key={p._id}>
                  <td className="products-name">{p.name}</td>
                  <td>
                    <span className={`dash-badge dash-badge--${p.category.toLowerCase()}`}>
                      {p.category}
                    </span>
                  </td>
                  <td>{p.price}</td>

                  <td>
                    <div className="stock-grid">
                      {(p.sizes || []).map(size => {
                        return (
                          <StockInput
                            key={size}
                            size={size}
                            qty={qtyFor(p, size)}
                            onSave={(qty) => saveStock(p, size, qty)}
                          />
                        );
                      })}
                    </div>
                    <p className="stock-total">
                      {tracked
                        ? `${total} in stock`
                        : 'Not tracked yet — type numbers to start'}
                    </p>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.inStock}
                        aria-label={`${p.name} listed on the shop`}
                        style={track(p.inStock)}
                        onClick={() => toggleStock(p)}
                      >
                        <span style={knob(p.inStock)} />
                      </button>
                      <span style={{ fontSize: '13px', color: p.inStock ? '#15803d' : '#999' }}>
                        {p.inStock ? 'Listed' : 'Hidden'}
                      </span>
                    </div>
                  </td>

                  <td className="products-actions">
                    <Link to={`/products/edit/${p._id}`} className="action-btn action-btn--edit">Edit</Link>
                    <button className="action-btn action-btn--delete" onClick={() => handleDelete(p._id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="products-hint">
        Type in a size box and press Enter (or click away) to save.
        A size at 0 cannot be ordered. The Listed switch hides the whole product
        from the shop regardless of stock.
      </p>
    </div>
  );
}