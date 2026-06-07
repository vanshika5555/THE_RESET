import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Products.css';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const res = await axios.get('http://localhost:5000/api/products');
    setProducts(res.data);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await axios.delete(`http://localhost:5000/api/products/${id}`);
    fetchProducts();
  };

  const filtered = filter === 'All' ? products : products.filter(p => p.category === filter);

  return (
    <div className="products-page">
      <div className="products-header">
        <h1 className="products-title">Products</h1>
        <Link to="/products/add" className="products-add-btn">+ Add Product</Link>
      </div>

      {/* Filter tabs */}
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

      {/* Table */}
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
                  <span className={`stock-dot ${p.inStock ? 'stock-dot--in' : 'stock-dot--out'}`} />
                  {p.inStock ? 'In Stock' : 'Out'}
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