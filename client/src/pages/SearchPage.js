import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import CardGallery from '../components/CardGallery';
import StarRating from '../components/StarRating';
import { useWishlist } from '../context/WishlistContext';
import '../components/CollectionPage.css';
import usePageMeta from '../hooks/usePageMeta';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').trim();
  const [input, setInput] = useState(query);

  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);

  const navigate = useNavigate();
  const { toggleWishlist, isWished } = useWishlist();

  usePageMeta({
    title: query ? `Search: ${query}` : 'Search',
    description: 'Search the THE RESET collection by name, style or season.',
  });

  useEffect(() => { setInput(query); }, [query]);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/products')
      .then(res => { setProducts(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const results = terms.length === 0 ? [] : products.filter(p => {
    const haystack = [
      p.name,
      p.subcategory,
      p.category,
      p.season,
      p.tag,
      p.description,
    ].filter(Boolean).join(' ').toLowerCase();
    return terms.every(t => haystack.includes(t));
  });

  const submit = (e) => {
    e.preventDefault();
    setParams(input.trim() ? { q: input.trim() } : {});
  };

  return (
    <div className="cp-page">
      <div className="cp-hero">
        <p className="cp-hero-eyebrow">THE RESET</p>
        <h1 className="cp-hero-title">Search</h1>
      </div>

      <form
        onSubmit={submit}
        style={{ display: 'flex', gap: '10px', maxWidth: '540px', margin: '0 auto 34px' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search for shirts, dresses, blazers..."
          autoFocus
          style={{
            flex: 1, padding: '14px 16px', font: 'inherit', fontSize: '15px',
            border: '1px solid #ccc', borderRadius: 0, outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '14px 26px', background: '#111', color: '#fff', border: 'none',
            font: 'inherit', fontSize: '13px', letterSpacing: '.1em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="cp-loading">Loading...</div>
      ) : !query ? (
        <div className="cp-empty">Type something above to search the collection.</div>
      ) : results.length === 0 ? (
        <div className="cp-empty">
          <p style={{ marginBottom: '14px' }}>
            No results for &ldquo;{query}&rdquo;.
          </p>
          <p style={{ fontSize: '14px', color: '#888' }}>
            Try a shorter word, or browse{' '}
            <Link to="/men" style={{ color: '#111' }}>Men</Link>{' '}or{' '}
            <Link to="/women" style={{ color: '#111' }}>Women</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="cp-toolbar">
            <p className="cp-count">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </p>
          </div>

          <div className="cp-grid">
            {results.map((p) => (
              <div key={p._id} className="cp-card">
                <div
                  className="cp-card-img"
                  style={{ background: p.color, cursor: 'pointer' }}
                  onClick={() => navigate(`/product/${p._id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${p._id}`); }}
                >
                  <CardGallery product={p} />
                  {p.tag && <span className="cp-tag">{p.tag}</span>}
                  {p.season && p.season !== 'All Season' && (
                    <span className="cp-season-tag">{p.season}</span>
                  )}
                  <button
                    className="cp-wish-btn"
                    onClick={(e) => { e.stopPropagation(); toggleWishlist(p); }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isWished(p._id) ? "#111" : "none"} stroke="#111" strokeWidth="1.5">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                  <div className="cp-size-hover">
                    <p className="cp-size-hover-label">View Product</p>
                  </div>
                </div>
                <div className="cp-card-info">
                  <p className="cp-card-sub">{p.subcategory}</p>
                  <Link to={`/product/${p._id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <p className="cp-card-name">{p.name}</p>
                  </Link>
                  <p className="cp-card-price">{p.price}</p>
                  <StarRating productId={p._id} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}