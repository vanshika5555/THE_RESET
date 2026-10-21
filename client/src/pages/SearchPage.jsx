import React, { useState, useEffect } from 'react';
import { getProducts } from '../utils/fetchCache';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import CardGallery from '../components/CardGallery';
import QuickAdd from '../components/QuickAdd';
import { useWishlist } from '../context/WishlistContext';
import '../components/CollectionPage.css';
import usePageMeta from '../hooks/usePageMeta';
import Price from '../components/Price';
import ColourDots from '../components/ColourDots';
import { searchProducts, suggestWord, parseQuery, recentSearches, rememberSearch, clearRecentSearches } from '../utils/search';
import './SearchPage.css';

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
    getProducts()
      .then(data => { setProducts(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Men / Women chips: the same search, narrowed (or widened) to a department.
  const dept = params.get('in') || '';
  const { department: typedDept } = parseQuery(query);
  const found = searchProducts(products, query);
  const all = found.results;
  const results = dept && !typedDept ? all.filter((p) => p.category === dept) : all;
  const counts = { Men: all.filter((p) => p.category === 'Men').length, Women: all.filter((p) => p.category === 'Women').length };
  const didYouMean = !loading && query && !all.length ? suggestWord(products, query) : null;

  const [recent, setRecent] = useState(recentSearches);
  useEffect(() => {
    // Only searches that found things as typed — not misspellings.
    if (query && all.length && !found.corrected) { rememberSearch(query); setRecent(recentSearches()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, all.length > 0, found.corrected]);

  // Popular departments to offer when nothing is typed or nothing is found.
  const popular = [...new Set(products.map((p) => p.subcategory).filter(Boolean))].slice(0, 8);

  const go = (q) => setParams(q ? { q } : {});
  const submit = (e) => {
    e.preventDefault();
    go(input.trim());
  };
  const pickDept = (d) => {
    const next = { q: query };
    if (d) next.in = d;
    setParams(next, { replace: true });
  };

  return (
    <div className="cp-page">
      <div className="cp-hero">
        <h1 className="cp-hero-title">Search</h1>
      </div>

      <form
        onSubmit={submit}
        style={{ display: 'flex', gap: '10px', maxWidth: '572px', margin: '0 auto 28px', padding: '0 16px' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search for shirts, dresses, blazers..."
          autoFocus
          type="search"
          aria-label="Search the collection"
          style={{
            flex: 1, minWidth: 0, padding: '14px 16px', font: 'inherit', fontSize: '15px',
            border: '1px solid #ccc', borderRadius: 0, outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '14px 22px', flexShrink: 0, background: '#111', color: '#fff', border: 'none',
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
        <div className="sp-start">
          {recent.length > 0 && (
            <div className="sp-block">
              <div className="sp-block-head">
                <p className="sp-label">Recent</p>
                <button type="button" className="sp-clear" onClick={() => { clearRecentSearches(); setRecent([]); }}>Clear</button>
              </div>
              <div className="sp-chips">
                {recent.map((r) => <button key={r} type="button" className="sp-chip" onClick={() => go(r)}>{r}</button>)}
              </div>
            </div>
          )}
          {popular.length > 0 && (
            <div className="sp-block">
              <p className="sp-label">Popular</p>
              <div className="sp-chips">
                {popular.map((c) => <button key={c} type="button" className="sp-chip" onClick={() => go(c)}>{c}</button>)}
              </div>
            </div>
          )}
        </div>
      ) : all.length === 0 ? (
        <div className="cp-empty">
          <p style={{ marginBottom: '14px' }}>
            No results for &ldquo;{query}&rdquo;.
          </p>
          {didYouMean && (
            <p className="sp-dym">Did you mean <button type="button" onClick={() => go(didYouMean)}>{didYouMean}</button>?</p>
          )}
          <p style={{ fontSize: '14px', color: '#888' }}>
            Try a shorter word, or browse{' '}
            <Link to="/men" style={{ color: '#111' }}>Men</Link>{' '}or{' '}
            <Link to="/women" style={{ color: '#111' }}>Women</Link>.
          </p>
          {popular.length > 0 && (
            <div className="sp-chips sp-chips--center">
              {popular.map((c) => <button key={c} type="button" className="sp-chip" onClick={() => go(c)}>{c}</button>)}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="cp-toolbar sp-toolbar">
            <p className="cp-count">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              {found.corrected && <span className="sp-corrected"> · closest matches — check the spelling</span>}
            </p>
            {!typedDept && counts.Men > 0 && counts.Women > 0 && (
              <div className="sp-depts" role="tablist" aria-label="Department">
                {[['', 'All', all.length], ['Men', 'Men', counts.Men], ['Women', 'Women', counts.Women]].map(([v, l, n]) => (
                  <button key={l} type="button" role="tab" aria-selected={dept === v} className={`sp-dept ${dept === v ? 'is-on' : ''}`} onClick={() => pickDept(v)}>
                    {l} <span>{n}</span>
                  </button>
                ))}
              </div>
            )}
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
                <QuickAdd product={p} />
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
                  <p className="cp-card-price"><Price value={p.price} mrp={p.mrp} /></p>
                  <ColourDots product={p} all={products} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}