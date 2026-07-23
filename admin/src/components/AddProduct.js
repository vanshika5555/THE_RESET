import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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

export default function AddProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', price: '', description: '', category: 'Men', season: 'All Season',
    subcategory: '', tag: '', color: '#f0f0f0', inStock: true, sizes: [], image: '', images: [''],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const subcategories = CATEGORIES[form.category][form.season] || [];

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


  const updateImage = (i, value) => {
    setForm(f => {
      const list = [...(f.images || [''])];
      list[i] = value;
      return { ...f, images: list };
    });
  };

  const addImageField = () => {
    setForm(f => ({ ...f, images: [...(f.images || []), ''] }));
  };

  const removeImage = (i) => {
    setForm(f => {
      const list = (f.images || []).filter((_, idx) => idx !== i);
      return { ...f, images: list.length ? list : [''] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.subcategory || form.sizes.length === 0) {
      setError('Name, price, subcategory and at least one size are required.'); return;
    }
    const priceNum = parseInt((form.price || '').replace(/[^0-9]/g, ''), 10);
    if (!priceNum || priceNum < 1) {
      setError('Please enter a valid price.'); return;
    }
    if (priceNum > 1000000) {
      setError('That price looks wrong (over ₹10,00,000). Please check it.'); return;
    }
    setLoading(true);
    try {
      const gallery = (form.images || []).map(u => u.trim()).filter(Boolean);
      await axios.post(`/api/products`, { ...form, images: gallery, image: gallery[0] || '' });
      navigate('/products');
    } catch (err) {
      const msg = err.response
        ? (err.response.data?.message || `Server error (${err.response.status}).`)
        : 'Cannot reach the server. Is the backend running?';
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="pf-page">
      <div className="pf-header">
        <h1 className="pf-title">Add Product</h1>
      </div>

      <form className="pf-form" onSubmit={handleSubmit}>
        {error && <div className="pf-error">{error}</div>}

        <div className="pf-grid">
          <div className="pf-field">
            <label>Product Name *</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Clean Fit Oxford" />
          </div>

          <div className="pf-field">
            <label>Price *</label>
            <div className="pf-price-wrap">
              <span className="pf-rupee">₹</span>
              <input
                name="price"
                value={form.price.replace('₹', '').replace(/,/g, '')}
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
            <select name="season" value={form.season} onChange={handleChange}>
              {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="pf-field">
            <label>Subcategory *</label>
            <select name="subcategory" value={form.subcategory} onChange={handleChange}>
              <option value="">— Select subcategory —</option>
              {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="pf-field">
            <label>Tag</label>
            <input name="tag" value={form.tag} onChange={handleChange} placeholder="e.g. New, Bestseller" />
          </div>

          <div className="pf-field">
            <label>Color (placeholder)</label>
            <div className="pf-color-row">
              <input type="color" name="color" value={form.color} onChange={handleChange} className="pf-color-input" />
              <span>{form.color}</span>
            </div>
          </div>

          <div className="pf-field pf-field--full">
            <label>Images <span className="pf-hint">(first one is the main photo)</span></label>
            {(form.images || ['']).map((url, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  value={url}
                  onChange={(e) => updateImage(i, e.target.value)}
                  placeholder="https://..."
                  style={{ flex: 1 }}
                />
                {url && (
                  <img
                    src={url}
                    alt=""
                    style={{ width: '40px', height: '48px', objectFit: 'cover', border: '1px solid #eee' }}
                    onError={(e) => { e.target.style.visibility = 'hidden'; }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  style={{ padding: '0 12px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', borderRadius: '4px' }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addImageField}
              style={{ padding: '8px 14px', border: '1px dashed #bbb', background: '#fafafa', cursor: 'pointer', borderRadius: '4px', font: 'inherit', fontSize: '13px' }}
            >
              + Add another image
            </button>
          </div>
        </div>

        {/* Season + Subcategory breadcrumb */}
        {form.subcategory && (
          <div className="pf-breadcrumb">
            {form.category} → {form.season} → {form.subcategory}
          </div>
        )}


        <div className="pf-field pf-field--full">
          <label>Description</label>
          <textarea
            name="description"
            value={form.description || ''}
            onChange={handleChange}
            rows={4}
            placeholder="Fabric, fit, styling notes..."
            style={{ width: '100%', padding: '12px', font: 'inherit', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
          />
        </div>

        <div className="pf-field pf-field--full">
          <label>Materials &amp; Wash Care</label>
          <textarea
            name="materials"
            value={form.materials || ''}
            onChange={handleChange}
            rows={3}
            placeholder="100% cotton. Machine wash cold..."
            style={{ width: '100%', padding: '12px', font: 'inherit', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
          />
        </div>

        <div className="pf-field pf-field--full">
          <label>Delivery &amp; Returns</label>
          <textarea
            name="delivery"
            value={form.delivery || ''}
            onChange={handleChange}
            rows={3}
            placeholder="Ships in 3-5 working days. 14 day returns."
            style={{ width: '100%', padding: '12px', font: 'inherit', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
          />
        </div>

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
            {loading ? 'Saving...' : 'Add Product'}
          </button>
        </div>
      </form>
    </div>
  );
}