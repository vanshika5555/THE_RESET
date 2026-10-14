import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { sizesFor, guessFitType } from '../utils/sizeOptions';
import { Switch, Thumb, ErrorNote } from './ui';
import PhotoDrop from './PhotoDrop';
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

export const BLANK_PRODUCT = {
  name: '', price: '', mrp: '', description: '', category: 'Men', season: 'All Season',
  subcategory: '', fitType: 'Top', tag: '', color: '#ececea', inStock: true,
  sizes: [], stock: [], image: '', images: [''], materials: '', delivery: '',
};

// Prices are numbers now (2990); older products may still hold text ("₹2,990").
const priceDigits = (p) => (typeof p === 'number'
  ? (p > 0 ? String(Math.round(p)) : '')
  : String(p ?? '').replace(/\.\d*$/, '').replace(/[^0-9]/g, ''));

function Card({ title, hint, order, children }) {
  return (
    <section className={`pf-card pf-o${order}`}>
      <div className="pf-card-head">
        <h2 className="pf-card-title">{title}</h2>
        {hint && <p className="pf-card-hint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/*
  The whole product editor. AddProduct and EditProduct only differ in
  where the starting values come from and which request saves them.
*/
export default function ProductForm({ initial, onSave, saveLabel }) {
  const navigate = useNavigate();
  const [form, setForm]       = useState(() => ({
    ...BLANK_PRODUCT,
    ...initial,
    images: initial?.images?.length ? initial.images : (initial?.image ? [initial.image] : ['']),
  }));
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);
  // Editing: how many shoppers asked to be told when each size is back.
  const [waiting, setWaiting] = useState({});
  useEffect(() => {
    if (!initial?._id) return;
    axios.get('/api/alerts/summary', { params: { product: initial._id } })
      .then((res) => {
        const map = {};
        (res.data || []).forEach((w) => { map[w.size] = w.waiting; });
        setWaiting(map);
      })
      .catch(() => {});
  }, [initial?._id]);
  const waitingTotal = Object.values(waiting).reduce((n, v) => n + v, 0);

  const listed = CATEGORIES[form.category]?.[form.season] || [];
  // Older products may carry a subcategory outside this season's list — keep it selectable.
  const subcategories = form.subcategory && !listed.includes(form.subcategory)
    ? [form.subcategory, ...listed]
    : listed;
  const sizeOptions = sizesFor(form.category, form.fitType);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setPrice = (key, value) => set(key, value.replace(/[^0-9]/g, '').slice(0, 7));

  const setCategory = (value) =>
    setForm((f) => ({ ...f, category: value, season: 'All Season', subcategory: '', sizes: [], stock: [] }));

  const setFit = (value) =>
    setForm((f) => ({ ...f, fitType: value, sizes: [], stock: [] }));

  const setSubcategory = (value) => {
    const guessed = guessFitType(value);
    setForm((f) => (guessed === f.fitType
      ? { ...f, subcategory: value }
      : { ...f, subcategory: value, fitType: guessed, sizes: [], stock: [] }));
  };

  // Keep sizes in chart order (S, M, L…) however they were tapped.
  const toggleSize = (size) =>
    setForm((f) => {
      if (f.sizes.includes(size)) return { ...f, sizes: f.sizes.filter((s) => s !== size) };
      const rank = (s) => { const i = sizeOptions.indexOf(s); return i === -1 ? 999 : i; };
      return { ...f, sizes: [...f.sizes, size].sort((a, b) => rank(a) - rank(b)) };
    });

  const stockFor = (size) => {
    const entry = (form.stock || []).find((s) => s.size === size);
    return entry ? entry.qty : 0;
  };

  const setStock = (size, value) => {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    setForm((f) => {
      const list = [...(f.stock || [])];
      const i = list.findIndex((s) => s.size === size);
      if (i === -1) list.push({ size, qty }); else list[i] = { size, qty };
      return { ...f, stock: list };
    });
  };

  const totalStock = (form.sizes || []).reduce((n, s) => n + (Number(stockFor(s)) || 0), 0);

  const updateImage = (i, value) => setForm((f) => {
    const list = [...(f.images || [''])];
    list[i] = value;
    return { ...f, images: list };
  });
  const addImage = () => setForm((f) => ({ ...f, images: [...(f.images || []), ''] }));
  // An uploaded photo fills the first empty link box, or is added at the end.
  const addUploaded = (url) => setForm((f) => {
    const list = [...(f.images || [])];
    const empty = list.findIndex((u) => !u.trim());
    if (empty === -1) list.push(url); else list[empty] = url;
    return { ...f, images: list };
  });
  const removeImage = (i) => setForm((f) => {
    const list = (f.images || []).filter((_, idx) => idx !== i);
    return { ...f, images: list.length ? list : [''] };
  });
  const makeMain = (i) => setForm((f) => {
    const list = [...f.images];
    const [pick] = list.splice(i, 1);
    return { ...f, images: [pick, ...list] };
  });

  const fail = (msg) => {
    setError(msg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = [];
    if (!form.name.trim()) missing.push('a name');
    if (!priceDigits(form.price)) missing.push('a price');
    if (!form.subcategory) missing.push('a subcategory');
    if (form.sizes.length === 0) missing.push('at least one size');
    if (missing.length) {
      fail(`Add ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} before saving.`);
      return;
    }
    const priceNum = parseInt(priceDigits(form.price), 10);
    if (priceNum > 1000000) { fail('That price is over ₹10,00,000. Check it for an extra zero.'); return; }
    const mrpNum = parseInt(priceDigits(form.mrp), 10) || 0;
    if (mrpNum && mrpNum <= priceNum) {
      fail('The original price must be higher than the selling price — or leave it empty if this piece is not on sale.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const gallery = (form.images || []).map((u) => u.trim()).filter(Boolean);
      const stock = (form.sizes || []).map((size) => ({ size, qty: stockFor(size) }));
      await onSave({ ...form, name: form.name.trim(), price: priceNum, mrp: mrpNum, images: gallery, image: gallery[0] || '', stock });
      navigate('/products');
    } catch (err) {
      fail(err.response
        ? (err.response.data?.message || `The server refused the product (error ${err.response.status}).`)
        : 'Cannot reach the server. Check that it is running.');
      setSaving(false);
    }
  };

  const gallery = (form.images || []).filter((u) => u.trim());

  return (
    <form className="pf" onSubmit={handleSubmit} noValidate>
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="pf-layout">
        {/* ── Main column ── */}
        <div className="pf-main">
          <Card order={1} title="Basics">
            <div className="form-grid">
              <div className="field span-2">
                <label className="field-label" htmlFor="pf-name">Product name <span className="req">*</span></label>
                <input id="pf-name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Oversized Graphic Hoodie" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="pf-price">Price <span className="req">*</span></label>
                <div className="input-group">
                  <span className="input-addon">₹</span>
                  <input id="pf-price" className="input" inputMode="numeric" value={priceDigits(form.price)} onChange={(e) => setPrice('price', e.target.value)} placeholder="2990" />
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="pf-mrp">Original price <span className="field-opt">for a sale</span></label>
                <div className="input-group">
                  <span className="input-addon">₹</span>
                  <input id="pf-mrp" className="input" inputMode="numeric" value={priceDigits(form.mrp)} onChange={(e) => setPrice('mrp', e.target.value)} placeholder="Leave empty if not on sale" />
                </div>
                {priceDigits(form.mrp) && Number(priceDigits(form.mrp)) > Number(priceDigits(form.price)) && Number(priceDigits(form.price)) > 0 && (
                  <span className="pf-sale-note">
                    Shows as {Math.round((1 - Number(priceDigits(form.price)) / Number(priceDigits(form.mrp))) * 100)}% off
                  </span>
                )}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="pf-tag">Tag</label>
                <input id="pf-tag" className="input" value={form.tag || ''} onChange={(e) => set('tag', e.target.value)} placeholder="e.g. New, Bestseller" />
              </div>
              <div className="field span-2">
                <label className="field-label" htmlFor="pf-desc">Description</label>
                <textarea id="pf-desc" className="textarea" rows={4} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Fabric, fit and how to style it" />
              </div>
            </div>
          </Card>

          <Card order={3} title="Photos" hint="Upload photos or paste links. The first photo is the one shoppers see first.">
            <PhotoDrop onUploaded={addUploaded} />

            {gallery.length > 0 && (
              <div className="pf-gallery">
                {gallery.map((url, i) => (
                  <div key={url + i} className={`pf-shot ${i === 0 ? 'pf-shot--main' : ''}`}>
                    <Thumb src={url} color={form.color} size="lg" />
                    <span className="pf-shot-label">{i === 0 ? 'Main photo' : `Photo ${i + 1}`}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pf-urls">
              {(form.images || ['']).map((url, i) => (
                <div key={i} className="pf-url">
                  <input
                    className="input"
                    value={url}
                    onChange={(e) => updateImage(i, e.target.value)}
                    placeholder="https://…"
                    aria-label={`Photo ${i + 1} link`}
                  />
                  {i > 0 && url.trim() && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => makeMain(i)}>Make main</button>
                  )}
                  <button type="button" className="icon-btn" onClick={() => removeImage(i)} aria-label={`Remove photo ${i + 1}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn--secondary pf-add-photo" onClick={addImage}>Paste another link</button>

            <div className="pf-colour">
              <input type="color" value={form.color || '#ececea'} onChange={(e) => set('color', e.target.value)} aria-label="Background colour" />
              <span>
                <strong>Background colour</strong>
                <span>Shown behind the photo while it loads.</span>
              </span>
            </div>
          </Card>

          <Card order={4} title="Sizes and stock" hint="Pick the sizes you sell, then enter how many of each you have.">
            <div className="pf-sizes" role="group" aria-label="Sizes">
              {sizeOptions.map((s) => (
                <button
                  type="button"
                  key={s}
                  aria-pressed={form.sizes.includes(s)}
                  className={`pf-size ${form.sizes.includes(s) ? 'pf-size--on' : ''}`}
                  onClick={() => toggleSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            {form.sizes.length > 0 ? (
              <>
                <div className="pf-stock">
                  {form.sizes.map((s) => (
                    <div key={s} className="pf-stock-cell">
                      <label className={`pf-stock-box ${Number(stockFor(s)) === 0 ? 'pf-stock-box--zero' : ''}`}>
                        <span className="pf-stock-size">{s}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockFor(s)}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setStock(s, e.target.value.replace(/[^0-9]/g, ''))}
                          aria-label={`Stock for size ${s}`}
                        />
                      </label>
                      {waiting[s] > 0 && (
                        <span className="pf-stock-wait">{waiting[s]} waiting</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="pf-stock-total">
                  <strong>{totalStock}</strong> in stock in total. A size at 0 can’t be ordered.
                </p>
                {waitingTotal > 0 && (
                  <p className="pf-stock-waitnote">
                    {waitingTotal === 1 ? '1 shopper is' : `${waitingTotal} shoppers are`} waiting for a restock.
                    Add stock to their size and save — they’re emailed automatically.
                  </p>
                )}
              </>
            ) : (
              <p className="pf-empty">No sizes picked yet.</p>
            )}
          </Card>

          <Card order={5} title="Care and delivery" hint="Shown on the product page.">
            <div className="form-grid">
              <div className="field span-2">
                <label className="field-label" htmlFor="pf-mat">Materials and wash care</label>
                <textarea id="pf-mat" className="textarea" rows={3} value={form.materials || ''} onChange={(e) => set('materials', e.target.value)} placeholder="100% cotton. Machine wash cold." />
              </div>
              <div className="field span-2">
                <label className="field-label" htmlFor="pf-del">Delivery and returns</label>
                <textarea id="pf-del" className="textarea" rows={3} value={form.delivery || ''} onChange={(e) => set('delivery', e.target.value)} placeholder="Ships in 3–5 working days. 14-day returns." />
              </div>
            </div>
          </Card>
        </div>

        {/* ── Side column ── */}
        <aside className="pf-side">
          <Card order={6} title="In the shop">
            <div className="pf-visible">
              <span>
                <strong>{form.inStock ? 'Listed' : 'Hidden'}</strong>
                <span>{form.inStock ? 'Customers can see and buy it.' : 'Customers can’t see it.'}</span>
              </span>
              <Switch on={form.inStock} onChange={() => set('inStock', !form.inStock)} label="Show in the shop" />
            </div>
          </Card>

          <Card order={2} title="Where it’s listed">
            <div className="field">
              <span className="field-label">Department <span className="req">*</span></span>
              <div className="pf-seg" role="radiogroup" aria-label="Department">
                {['Men', 'Women'].map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={form.category === c} className={`pf-seg-opt ${form.category === c ? 'pf-seg-opt--on' : ''}`} onClick={() => setCategory(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="pf-season">Season <span className="req">*</span></label>
              <select id="pf-season" className="select" value={form.season || 'All Season'} onChange={(e) => setForm((f) => ({ ...f, season: e.target.value, subcategory: '' }))}>
                {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="pf-sub">Subcategory <span className="req">*</span></label>
              <select id="pf-sub" className="select" value={form.subcategory || ''} onChange={(e) => setSubcategory(e.target.value)}>
                <option value="">Choose one</option>
                {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="pf-fit">Worn on</label>
              <select id="pf-fit" className="select" value={form.fitType || 'Top'} onChange={(e) => setFit(e.target.value)}>
                <option value="Top">Upper body</option>
                <option value="Bottom">Lower body</option>
              </select>
              <span className="field-hint">Decides which size chart shoppers see. Changing it clears the sizes.</span>
            </div>

            {form.subcategory && (
              <p className="pf-path">{form.category} › {form.season} › {form.subcategory}</p>
            )}
          </Card>
        </aside>
      </div>

      {/* ── Sticky save bar ── */}
      <div className="pf-bar">
        <span className="pf-bar-name only-desktop">{form.name.trim() || 'Untitled product'}</span>
        <button type="button" className="btn btn--secondary btn--lg only-desktop" onClick={() => navigate('/products')}>Cancel</button>
        <button type="submit" className="btn btn--primary btn--lg pf-save" disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </form>
  );
}
