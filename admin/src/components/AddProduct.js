import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { sizesFor, guessFitType } from '../utils/sizeOptions';
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



const SEASONS = ['Summer', 'Winter', 'Monsoon', 'All Season'];

export default function AddProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', price: '', description: '', category: 'Men', season: 'All Season',
    subcategory: '', fitType: 'Top', tag: '', color: '#f0f0f0', inStock: true, sizes: [], stock: [], image: '', images: [''],
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
      setForm(f => ({
        ...f, category: value, season: 'All Season', subcategory: '',
        sizes: [], stock: [],
      }));
      return;
    }
    if (name === 'fitType') {
      // different fit means a different set of sizes
      setForm(f => ({ ...f, fitType: value, sizes: [], stock: [] }));
      return;
    }
    if (name === 'season') {
      setForm(f => ({ ...f, season: value, subcategory: '' }));
      return;
    }
    if (name === 'subcategory') {
      const guessed = guessFitType(value);
      setForm(f => (
        guessed === f.fitType
          ? { ...f, subcategory: value }
          : { ...f, subcategory: value, fitType: guessed, sizes: [], stock: [] }
      ));
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


  const stockFor = (size) => {
    const entry = (form.stock || []).find(s => s.size === size);
    return entry ? entry.qty : 0;
  };

  const setStock = (size, value) => {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    setForm(f => {
      const list = [...(f.stock || [])];
      const i = list.findIndex(s => s.size === size);
      if (i === -1) list.push({ size, qty });
      else list[i] = { size, qty };
      return { ...f, stock: list };
    });
  };

  const totalStock = () =>
    (form.stock || [])
      .filter(s => (form.sizes || []).includes(s.size))
      .reduce((sum, s) => sum + (Number(s.qty) || 0), 0);

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
      const stock = (form.sizes || []).map(size => ({ size, qty: stockFor(size) }));
      await axios.post(`/api/products`, { ...form, images: gallery, image: gallery[0] || '', stock });
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
            <label>Worn on *</label>
            <select name="fitType" value={form.fitType || 'Top'} onChange={handleChange}>
              <option value="Top">Upper body (shirts, jackets, dresses)</option>
              <option value="Bottom">Lower body (trousers, skirts, shorts)</option>
            </select>
            <span className="pf-hint">Sets which size chart customers see</span>
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
          <label>Sizes * <span className="pf-hint">(click to select, then set how many you have)</span></label>
          <div className="pf-sizes">
            {sizesFor(form.category, form.fitType).map(s => (
              <button
                type="button" key={s}
                className={`pf-size-btn ${form.sizes.includes(s) ? 'pf-size-btn--active' : ''}`}
                onClick={() => toggleSize(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {form.sizes.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#666', margin: '0 0 10px' }}>
                Stock per size
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {form.sizes.map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '7px', border: '1px solid #eee', borderRadius: '4px', padding: '7px 10px' }}>
                    <span style={{ fontSize: '13px', minWidth: '26px' }}>{s}</span>
                    <input
                      type="number"
                      min="0"
                      value={stockFor(s)}
                      onChange={(e) => setStock(s, e.target.value)}
                      style={{ width: '64px', padding: '6px 8px', font: 'inherit', fontSize: '13px', border: '1px solid #ddd', borderRadius: '3px' }}
                    />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#999', margin: '9px 0 0' }}>
                A size with 0 left cannot be ordered. Total in stock: {totalStock()}
              </p>
            </div>
          )}
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