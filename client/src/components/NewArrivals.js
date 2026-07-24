import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import CardGallery from './CardGallery';
import { useWishlist } from '../context/WishlistContext';
import './NewArrivals.css';

const isSoldOut = (p) => {
  if (!p.inStock) return true;
  if (!p.stock || p.stock.length === 0) return false;
  return (p.sizes || []).every(size => {
    const entry = p.stock.find(s => s.size === size);
    return !entry || entry.qty <= 0;
  });
};

export default function NewArrivals() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('All');

  const navigate = useNavigate();
  const { toggleWishlist, isWished } = useWishlist();

  useEffect(() => {
    axios.get('/api/products')
      .then(res => { setProducts(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = (tab === 'All' ? products : products.filter(p => p.category === tab))
    .slice(0, 8);

  // Nothing to show yet — better to hide the whole section than show a gap.
  if (!loading && products.length === 0) return null;

  return (
    <section className="na-section">
      <div className="na-head">
        <div>
          <p className="na-eyebrow">Just In</p>
          <h2 className="na-title">New Arrivals</h2>
        </div>

        <div className="na-tabs">
          {['All', 'Men', 'Women'].map(t => (
            <button
              key={t}
              className={`na-tab ${tab === t ? 'na-tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="na-loading">Loading the collection...</div>
      ) : filtered.length === 0 ? (
        <div className="na-loading">Nothing here yet — check the other collection.</div>
      ) : (
        <div className="na-grid">
          {filtered.map(p => (
            <div key={p._id} className="na-card">
              <div
                className="na-card-img"
                style={{ background: p.color || '#f0f0f0', cursor: 'pointer' }}
                onClick={() => navigate(`/product/${p._id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${p._id}`); }}
              >
                <CardGallery product={p} />

                {isSoldOut(p) && <span className="na-soldout">Sold Out</span>}
                {p.tag && !isSoldOut(p) && <span className="na-tag">{p.tag}</span>}

                <button
                  className="na-wish"
                  aria-label="Save to wishlist"
                  onClick={(e) => { e.stopPropagation(); toggleWishlist(p); }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24"
                       fill={isWished(p._id) ? '#111' : 'none'} stroke="#111" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>

              <div className="na-card-info">
                <p className="na-card-sub">{p.subcategory}</p>
                <Link to={`/product/${p._id}`} className="na-card-link">
                  <p className="na-card-name">{p.name}</p>
                </Link>
                <p className="na-card-price">{p.price}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="na-actions">
        <Link to="/men" className="na-btn">Shop Men</Link>
        <Link to="/women" className="na-btn na-btn--fill">Shop Women</Link>
      </div>
    </section>
  );
}