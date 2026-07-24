import React, { useState, useEffect } from "react";
import axios from "axios";
import { useWishlist } from "../context/WishlistContext";
import { useNavigate, Link } from "react-router-dom";
import "../components/CollectionPage.css";
import StarRating from "../components/StarRating";
import CardGallery from "../components/CardGallery";
import { parsePrice } from "../utils/price";
import Loading from "../components/Loading";
import usePageMeta from '../hooks/usePageMeta';


const SEASONS = ['All', 'Summer', 'Winter', 'Monsoon', 'All Season'];

// Everything that differs between the Men and Women pages lives here.
const CATEGORY_CONFIG = {
  Men: {
    subtitle: 'Sharp silhouettes. Quiet authority.',
    subcategories: {
      Summer:       ['Shirts', 'T-Shirts', 'Shorts', 'Linen Trousers', 'Polo Shirts'],
      Winter:       ['Jackets', 'Sweaters', 'Hoodies', 'Woollen Trousers', 'Coats'],
      Monsoon:      ['Raincoats', 'Quick-Dry Shirts', 'Cargo Pants', 'Windbreakers'],
      'All Season': ['Formal Shirts', 'Trousers', 'Blazers', 'Denim', 'Chinos'],
    },
  },
  Women: {
    subtitle: 'Refined essentials. Intentional design.',
    subcategories: {
      Summer:       ['Tops', 'Dresses', 'Skirts', 'Co-ords', 'Shorts'],
      Winter:       ['Coats', 'Sweaters', 'Turtlenecks', 'Woollen Dresses', 'Shrugs'],
      Monsoon:      ['Maxis', 'Wrap Dresses', 'Trench Coats', 'Palazzo'],
      'All Season': ['Blazers', 'Trousers', 'Jumpsuits', 'Ethnic Wear', 'Denim'],
    },
  },
};

const PRICE_RANGES = [
  { label: 'All Prices', min: 0, max: Infinity },
  { label: 'Under ₹1,000', min: 0, max: 1000 },
  { label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { label: '₹2,000 – ₹3,500', min: 2000, max: 3500 },
  { label: '₹3,500 – ₹5,000', min: 3500, max: 5000 },
  { label: 'Above ₹5,000', min: 5000, max: Infinity },
];

const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
];

const getPrice = parsePrice;

// Is anything left of this piece, in any size?
const isSoldOut = (p) => {
  if (!p.inStock) return true;
  if (!p.stock || p.stock.length === 0) return false;   // not tracked yet
  const sizes = p.sizes || [];
  return sizes.every(size => {
    const entry = p.stock.find(s => s.size === size);
    return !entry || entry.qty <= 0;
  });
};


export default function CollectionPage({ category = 'Men' }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Men;

  usePageMeta({
    title: `${category}'s Collection`,
    description: `Shop ${category.toLowerCase()}'s clothing at THE RESET. ${config.subtitle}`,
  });
  const [products, setProducts]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(false);
  const [activeSeason, setActiveSeason]   = useState('All');
  const [activeSub, setActiveSub]         = useState('All');
  const [priceRange, setPriceRange]       = useState(0); // index of PRICE_RANGES
  const [sort, setSort]                   = useState('newest');
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);

  const { toggleWishlist, isWished }      = useWishlist();
  const navigate                          = useNavigate();

  useEffect(() => {
    setLoading(true);
    setActiveSeason('All');
    setActiveSub('All');
    setLoadError(false);
    axios.get(`/api/products?category=${category}`)
      .then(res => { setProducts(res.data); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, [category]);

  const handleSeasonClick = (season) => {
    setActiveSeason(season);
    setActiveSub('All');
  };

  // Filter + sort
  const filtered = products
    .filter(p => {
      const seasonMatch = activeSeason === 'All' || p.season === activeSeason;
      const subMatch    = activeSub === 'All' || p.subcategory === activeSub;
      const price       = getPrice(p.price);
      const range       = PRICE_RANGES[priceRange];
      const priceMatch  = price >= range.min && price < range.max;
      return seasonMatch && subMatch && priceMatch;
    })
    .sort((a, b) => {
      if (sort === 'price_asc')  return getPrice(a.price) - getPrice(b.price);
      if (sort === 'price_desc') return getPrice(b.price) - getPrice(a.price);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const currentSubs = activeSeason !== 'All' ? (config.subcategories[activeSeason] || []) : [];
  const activeRange = PRICE_RANGES[priceRange];

  return (
    <div className="cp-page">
      <div className="cp-hero">
        <p className="cp-hero-eyebrow">THE RESET</p>
        <h1 className="cp-hero-title">{category}</h1>
        <p className="cp-hero-sub">{config.subtitle}</p>
      </div>

      {/* Season filter */}
      <div className="cp-filters">
        <div className="cp-filter-row">
          {SEASONS.map(s => (
            <button
              key={s}
              className={`cp-filter-btn ${activeSeason === s ? 'cp-filter-btn--active' : ''}`}
              onClick={() => handleSeasonClick(s)}
            >
              {s === 'All' ? 'All Seasons' : s}
            </button>
          ))}
        </div>

        {currentSubs.length > 0 && (
          <div className="cp-filter-row cp-filter-row--sub">
            <button
              className={`cp-filter-btn cp-filter-btn--sub ${activeSub === 'All' ? 'cp-filter-btn--sub-active' : ''}`}
              onClick={() => setActiveSub('All')}
            >All</button>
            {currentSubs.map(s => (
              <button
                key={s}
                className={`cp-filter-btn cp-filter-btn--sub ${activeSub === s ? 'cp-filter-btn--sub-active' : ''}`}
                onClick={() => setActiveSub(s)}
              >{s}</button>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar — count + price filter + sort */}
      <div className="cp-toolbar">
        <p className="cp-count">
          {filtered.length} piece{filtered.length !== 1 ? 's' : ''}
          {activeSeason !== 'All' && <span className="cp-count-filter"> · {activeSeason}{activeSub !== 'All' ? ` · ${activeSub}` : ''}</span>}
          {priceRange !== 0 && <span className="cp-count-filter"> · {activeRange.label}</span>}
        </p>

        <div className="cp-toolbar-right">
          {/* Price filter dropdown */}
          <div className="cp-dropdown-wrap">
            <button
              className={`cp-dropdown-btn ${priceRange !== 0 ? 'cp-dropdown-btn--active' : ''}`}
              onClick={() => setShowPriceDropdown(p => !p)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              {priceRange === 0 ? 'Price' : activeRange.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showPriceDropdown && (
              <div className="cp-dropdown-menu">
                {PRICE_RANGES.map((r, i) => (
                  <button
                    key={i}
                    className={`cp-dropdown-item ${priceRange === i ? 'cp-dropdown-item--active' : ''}`}
                    onClick={() => { setPriceRange(i); setShowPriceDropdown(false); }}
                  >
                    {r.label}
                    {priceRange === i && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="cp-dropdown-wrap">
            <select
              className="cp-sort-select"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading label="Loading collection..." />
      ) : loadError ? (
        <div className="cp-empty">
          <p>We could not load the collection just now.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '14px', padding: '11px 22px', background: '#111', color: '#fff',
                     border: 'none', font: 'inherit', fontSize: '13px', letterSpacing: '.08em',
                     textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="cp-empty">No products found in this category.</div>
      ) : (
        <div className="cp-grid">
          {filtered.map((p) => (
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
                {isSoldOut(p) && <span className="cp-soldout">Sold Out</span>}
                {p.tag && !isSoldOut(p) && <span className="cp-tag">{p.tag}</span>}
                {p.season && p.season !== 'All Season' && (
                  <span className="cp-season-tag">{p.season}</span>
                )}
                <button className="cp-wish-btn" onClick={(e) => { e.stopPropagation(); toggleWishlist(p); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isWished(p._id) ? "#111" : "none"} stroke="#111" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <div className="cp-size-hover">
                  <p className="cp-size-hover-label">{isSoldOut(p) ? 'Sold Out' : 'View Product'}</p>
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
      )}
    </div>
  );
}