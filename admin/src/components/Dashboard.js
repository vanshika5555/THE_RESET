import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/products')
      .then(res => setProducts(res.data))
      .catch(err => console.error(err));
  }, []);

  const men    = products.filter(p => p.category === 'Men').length;
  const women  = products.filter(p => p.category === 'Women').length;
  const inStock = products.filter(p => p.inStock).length;

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h1 className="dash-title">Dashboard</h1>
        <Link to="/products/add" className="dash-add-btn">+ Add Product</Link>
      </div>

      {/* Stats */}
      <div className="dash-stats">
        <div className="stat-card">
          <p className="stat-label">Total Products</p>
          <p className="stat-num">{products.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Men's</p>
          <p className="stat-num">{men}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Women's</p>
          <p className="stat-num">{women}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">In Stock</p>
          <p className="stat-num">{inStock}</p>
        </div>
      </div>

      {/* Recent products */}
      <div className="dash-section">
        <h2 className="dash-section-title">Recent Products</h2>
        {products.length === 0 ? (
          <div className="dash-empty">
            <p>No products yet.</p>
            <Link to="/products/add" className="dash-add-btn">Add your first product →</Link>
          </div>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Tag</th>
                <th>In Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 8).map(p => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td><span className={`dash-badge dash-badge--${p.category.toLowerCase()}`}>{p.category}</span></td>
                  <td>{p.price}</td>
                  <td>{p.tag || '—'}</td>
                  <td>{p.inStock ? '✓' : '✗'}</td>
                  <td><Link to={`/products/edit/${p._id}`} className="dash-edit-link">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}