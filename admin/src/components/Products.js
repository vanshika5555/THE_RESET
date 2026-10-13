import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import StockInput from './StockInput';
import { Switch, SearchInput, FilterTabs, Empty, ErrorNote, Thumb, plural } from './ui';
import './Products.css';

const LOW = 5;

// Stock counted only for the sizes the product is actually sold in.
const trackedStock = (p) => (p.stock || []).filter((s) => (p.sizes || []).includes(s.size));
const totalStock = (p) => trackedStock(p).reduce((n, s) => n + (Number(s.qty) || 0), 0);
const needsStock = (p) => {
  const t = trackedStock(p);
  return t.length > 0 && t.some((s) => s.qty <= LOW);
};

function stockLine(p) {
  if (!p.inStock) return { text: 'Hidden from the shop', tone: 'muted' };
  const t = trackedStock(p);
  if (t.length === 0) return { text: 'Stock not tracked yet', tone: 'muted' };
  const total = totalStock(p);
  if (total === 0) return { text: 'Sold out', tone: 'bad' };
  if (t.some((s) => s.qty === 0)) return { text: `${total} in stock, some sizes sold out`, tone: 'warn' };
  if (t.some((s) => s.qty <= LOW)) return { text: `${total} in stock, running low`, tone: 'warn' };
  return { text: `${total} in stock`, tone: 'ok' };
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('All');
  const [query, setQuery]       = useState('');
  const [openId, setOpenId]     = useState(null);   // expanded card on a phone
  const [error, setError]       = useState('');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/api/products');
      setProducts(res.data || []);
    } catch {
      setError('Products could not be loaded. Check that the server is running.');
    }
    setLoading(false);
  };

  const qtyFor = (p, size) => {
    const entry = (p.stock || []).find((s) => s.size === size);
    return entry ? entry.qty : null;
  };

  const saveStock = async (product, size, qty) => {
    const next = (product.sizes || []).map((s) => {
      if (s === size) return { size: s, qty };
      const existing = (product.stock || []).find((e) => e.size === s);
      return { size: s, qty: existing ? existing.qty : 0 };
    });
    const previous = product.stock;

    setProducts((list) => list.map((p) => (p._id === product._id ? { ...p, stock: next } : p)));
    setError('');
    try {
      const res = await axios.put(`/api/products/${product._id}`, { stock: next });
      setProducts((list) => list.map((p) => (p._id === product._id ? res.data : p)));
    } catch (err) {
      setProducts((list) => list.map((p) => (p._id === product._id ? { ...p, stock: previous } : p)));
      setError(`Stock for ${product.name} (${size}) was not saved. Try again.`);
      throw err;
    }
  };

  const toggleListed = async (product) => {
    const next = !product.inStock;
    setProducts((list) => list.map((p) => (p._id === product._id ? { ...p, inStock: next } : p)));
    try {
      await axios.put(`/api/products/${product._id}`, { inStock: next });
    } catch {
      setProducts((list) => list.map((p) => (p._id === product._id ? { ...p, inStock: !next } : p)));
      setError(`${product.name} could not be ${next ? 'listed' : 'hidden'}. Try again.`);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete ${p.name}? This removes it from the shop for good.`)) return;
    try {
      await axios.delete(`/api/products/${p._id}`);
      setOpenId(null);
      fetchProducts();
    } catch {
      setError(`${p.name} could not be deleted. Try again.`);
    }
  };

  const counts = useMemo(() => ({
    All: products.length,
    Men: products.filter((p) => p.category === 'Men').length,
    Women: products.filter((p) => p.category === 'Women').length,
    Low: products.filter((p) => p.inStock && needsStock(p)).length,
    Hidden: products.filter((p) => !p.inStock).length,
  }), [products]);

  const visible = useMemo(() => {
    let list = products;
    if (filter === 'Men' || filter === 'Women') list = list.filter((p) => p.category === filter);
    if (filter === 'Low') list = list.filter((p) => p.inStock && needsStock(p));
    if (filter === 'Hidden') list = list.filter((p) => !p.inStock);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.subcategory || '').toLowerCase().includes(q) ||
        (p.tag || '').toLowerCase().includes(q));
    }
    return list;
  }, [products, filter, query]);

  const tabs = [
    { value: 'All', label: 'All', count: counts.All },
    { value: 'Men', label: 'Men', count: counts.Men },
    { value: 'Women', label: 'Women', count: counts.Women },
    { value: 'Low', label: 'Needs stock', count: counts.Low },
    { value: 'Hidden', label: 'Hidden', count: counts.Hidden },
  ];

  const sizeBoxes = (p) => (
    (p.sizes || []).length === 0
      ? <p className="pr-nosizes">No sizes set. Add them in Edit.</p>
      : (
        <div className="stock-grid">
          {(p.sizes || []).map((size) => (
            <StockInput key={size} size={size} qty={qtyFor(p, size)} onSave={(qty) => saveStock(p, size, qty)} />
          ))}
        </div>
      )
  );

  return (
    <div className="products">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="toolbar">
        <div className="toolbar-grow">
          <SearchInput value={query} onChange={setQuery} placeholder="Search products" />
        </div>
        <Link to="/products/add" className="btn btn--primary only-desktop">Add product</Link>
      </div>

      <div className="products-tabs">
        <FilterTabs items={tabs} value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <div className="panel"><div className="loading">Loading products…</div></div>
      ) : visible.length === 0 ? (
        <div className="panel">
          {products.length === 0 ? (
            <Empty
              title="No products yet"
              text="Add your first piece and it goes live in the shop straight away."
              action={<Link to="/products/add" className="btn btn--primary">Add product</Link>}
            />
          ) : (
            <Empty title="Nothing here" text="No products match this filter or search." />
          )}
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="panel only-desktop">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock by size</th>
                  <th>In the shop</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const line = stockLine(p);
                  return (
                    <tr key={p._id} className={p.inStock ? '' : 'ptable-row--hidden'}>
                      <td>
                        <div className="ptable-product">
                          <Thumb src={p.image} color={p.color} size="md" />
                          <div className="cell">
                            <span className="cell-main">{p.name}</span>
                            <span className="cell-sub">
                              <span>{p.category}</span>
                              {p.subcategory && <span>{p.subcategory}</span>}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="ptable-price">{p.price}</td>
                      <td>
                        {sizeBoxes(p)}
                        <p className={`pr-stock pr-stock--${line.tone}`}>{line.text}</p>
                      </td>
                      <td>
                        <div className="ptable-listed">
                          <Switch on={p.inStock} onChange={() => toggleListed(p)} label={`Show ${p.name} in the shop`} />
                          <span>{p.inStock ? 'Listed' : 'Hidden'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ptable-actions">
                          <Link to={`/products/edit/${p._id}`} className="btn btn--secondary btn--sm">Edit</Link>
                          <button type="button" className="icon-btn ptable-delete" onClick={() => handleDelete(p)} aria-label={`Delete ${p.name}`} title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="pr-hint">Type a number in a size box and press Enter to save it. A size at 0 can’t be ordered.</p>
          </div>

          {/* ── Phone cards: tap to manage ── */}
          <div className="pm-list only-mobile">
            {visible.map((p) => {
              const open = openId === p._id;
              const line = stockLine(p);
              return (
                <div key={p._id} className={`pm-card ${open ? 'pm-card--open' : ''}`}>
                  <button type="button" className="pm-row" onClick={() => setOpenId(open ? null : p._id)} aria-expanded={open}>
                    <Thumb src={p.image} color={p.color} size="lg" />
                    <span className="pm-info">
                      <span className="pm-name">{p.name}</span>
                      <span className="pm-meta">{p.price}<span>{p.category}</span>{p.subcategory && <span>{p.subcategory}</span>}</span>
                      <span className={`pr-stock pr-stock--${line.tone}`}>{line.text}</span>
                    </span>
                    <svg className="pm-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>

                  {open && (
                    <div className="pm-detail">
                      <p className="pm-label">Stock by size</p>
                      {sizeBoxes(p)}

                      <div className="pm-listed">
                        <span className="pm-listed-text">
                          <strong>{p.inStock ? 'Listed in the shop' : 'Hidden from the shop'}</strong>
                          <span>{p.inStock ? 'Customers can see and buy it' : 'Customers can’t see it'}</span>
                        </span>
                        <Switch on={p.inStock} onChange={() => toggleListed(p)} label={`Show ${p.name} in the shop`} />
                      </div>

                      <div className="pm-actions">
                        <Link to={`/products/edit/${p._id}`} className="btn btn--secondary btn--lg">Edit details</Link>
                        <button type="button" className="btn btn--danger btn--lg" onClick={() => handleDelete(p)}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="pm-count">{plural(visible.length, 'product')}</p>
          </div>
        </>
      )}

      <Link to="/products/add" className="pm-fab only-mobile" aria-label="Add product">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </Link>
    </div>
  );
}