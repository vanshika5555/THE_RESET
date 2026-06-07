import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import './ProductForm.css';

const CATEGORIES = {
  Men: {
    Summer:       ['Shirts', 'T-Shirts', 'Shorts', 'Linen Trousers', 'Polo Shirts'],
    Winter:       ['Jackets', 'Sweaters', 'Hoodies', 'Woollen Trousers', 'Coats'],
    Monsoon:      ['Raincoats', 'Quick-Dry Shirts', 'Cargo Pants', 'Windbreakers'],
    'All Season': ['Formal Shirts', 'Trousers', 'Blazers', 'Denim', 'Chinos'],
  },
  Women: {
    Summer:       ['Tops', 'Dresses', 'Skirts', 'Co-ords', 'Shorts'],
    Winter:       ['Coats', 'Sweaters', 'Turtlenecks', 'Woollen Dresses', 'Shrugs'],
    Monsoon:      ['Maxis', 'Wrap Dresses', 'Trench Coats', 'Palazzo'],
    'All Season': ['Blazers', 'Trousers', 'Jumpsuits', 'Ethnic Wear', 'Denim'],
  },
};

const SIZE_OPTIONS = {
  Men:   ['XS','S','M','L','XL','XXL','28','30','32','34','36','38'],
  Women: ['XS','S','M','L','XL','XXL','6','8','10','12','14','16'],
};

const SEASONS = ['Summer', 'Winter', 'Monsoon', 'All Season'];

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/products/${id}`)
      .then(res => setForm(res.data))
      .catch(() => setError('Product not found.'));
  }, [id]);

  const subcategories = form ? (CATEGORIES[form.category]?.[form.season] || []) : [];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'price') {
      const num = value.replace(/[^0-9]/g, '');
      setForm(f => ({ ...f, price: num ? '₹' + Number(num).toLocaleString('en-IN') : '' }));
      return;
    }
    if (name === 'category') {
      setForm(f => ({ ...f, category: value, season: 'All Season', subcategory: '' }));
      return;
    }
    if (name === 'season') {
      setForm(f => ({ ...f, season: value, subcategory: '' }));
      return;
    }
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleSize = (size) => {
    setForm(f => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter(s => s !== size) : [...f.sizes, size],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.subcategory || form.sizes.length === 0) {
      setError('Name, price, subcategory and at least one size are required.'); return;
    }
    setLoading(true);
    try {
      await axios.put(`http://localhost:5000/api/products/${id}`, form);
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    }
    setLoading(false);
  };

  if (!form) return <div className="pf-loading">Loading...</div>;

  return (
    <div className="pf-page">
      <div className="pf-header">
        <h1 className="pf-title">Edit Product</h1>
      </div>

      <form className="pf-form" onSubmit={handleSubmit}>
        {error && <div className="pf-error">{error}</div>}

        <div className="pf-grid">
          <div className="pf-field">
            <label>Product Name *</label>
            <input name="name" value={form.name} onChange={handleChange} />
          </div>

          <div className="pf-field">
            <label>Price *</label>
            <div className="pf-price-wrap">
              <span className="pf-rupee">₹</span>
              <input
                name="price"
                value={(form.price || '').replace('₹', '').replace(/,/g, '')}
                onChange={handleChange}
                placeholder="2990"
                type="number"
              />
            </div>
          </div>

          <div className="pf-field">
            <label>Category *</label>
            <select name="category" value={form.category} onChange={handleChange}>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
            </select>
          </div>

          <div className="pf-field">
            <label>Season *</label>
            <select name="season" value={form.season || 'All Season'} onChange={handleChange}>
              {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="pf-field">
            <label>Subcategory *</label>
            <select name="subcategory" value={form.subcategory || ''} onChange={handleChange}>
              <option value="">— Select subcategory —</option>
              {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="pf-field">
            <label>Tag</label>
            <input name="tag" value={form.tag || ''} onChange={handleChange} placeholder="e.g. New, Bestseller" />
          </div>

          <div className="pf-field">
            <label>Color</label>
            <div className="pf-color-row">
              <input type="color" name="color" value={form.color || '#f0f0f0'} onChange={handleChange} className="pf-color-input" />
              <span>{form.color}</span>
            </div>
          </div>

          <div className="pf-field">
            <label>Image URL</label>
            <input name="image" value={form.image || ''} onChange={handleChange} placeholder="https://..." />
          </div>
        </div>

        {form.subcategory && (
          <div className="pf-breadcrumb">
            {form.category} → {form.season} → {form.subcategory}
          </div>
        )}

        <div className="pf-field pf-field--full">
          <label>Sizes * <span className="pf-hint">(click to select)</span></label>
          <div className="pf-sizes">
            {SIZE_OPTIONS[form.category].map(s => (
              <button
                type="button" key={s}
                className={`pf-size-btn ${form.sizes.includes(s) ? 'pf-size-btn--active' : ''}`}
                onClick={() => toggleSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="pf-field pf-field--full pf-checkbox">
          <input type="checkbox" name="inStock" checked={form.inStock} onChange={handleChange} id="instock" />
          <label htmlFor="instock">In Stock</label>
        </div>

        <div className="pf-actions">
          <button type="button" className="pf-btn pf-btn--outline" onClick={() => navigate('/products')}>Cancel</button>
          <button type="submit" className="pf-btn pf-btn--fill" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}