import React, { useState, useEffect, useRef } from "react";
import { getProducts } from "../utils/fetchCache";
import { useWishlist } from "../context/WishlistContext";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import "../components/CollectionPage.css";
import CardGallery from "../components/CardGallery";
import QuickAdd from '../components/QuickAdd';
import { parsePrice } from "../utils/price";
import Loading from "../components/Loading";
import usePageMeta from '../hooks/usePageMeta';
import Price from '../components/Price';
import ColourDots from "../components/ColourDots";


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


// How many of a size are left. Products saved before stock tracking have no
// stock list, so they fall back to the in/out switch.
const sizeAvailable = (p, size) => {
  if (!p.inStock) return false;
  if (!(p.sizes || []).includes(size)) return false;
  if (!p.stock || p.stock.length === 0) return true;
  const entry = p.stock.find(s => s.size === size);
  return !!entry && entry.qty > 0;
};

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
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [activeSizes, setActiveSizes]     = useState([]);  // empty means any size
  const [activeColours, setActiveColours] = useState([]);  // lower-cased colour names; empty means any
  const [sort, setSort]                   = useState('newest');
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [sheetOpen, setSheetOpen]         = useState(false);   // phone: Filter & sort
  const priceRef = useRef(null);

  const { toggleWishlist, isWished }      = useWishlist();
  const navigate                          = useNavigate();

  useEffect(() => {
    setLoading(true);
    setLoadError(false);

    // A link like /men?sub=Blazers should open on that filter.
    const wanted = searchParams.get('sub');
    const season = Object.keys(config.subcategories)
      .find(s => (config.subcategories[s] || []).includes(wanted));

    if (wanted && season) {
      setActiveSeason(season);
      setActiveSub(wanted);
    } else {
      setActiveSeason('All');
      setActiveSub('All');
    }
    getProducts(category)
      .then(data => { setProducts(data || []); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, searchParams]);

  // Price menu closes on a click anywhere else.
  useEffect(() => {
    if (!showPriceDropdown) return undefined;
    const close = (e) => { if (priceRef.current && !priceRef.current.contains(e.target)) setShowPriceDropdown(false); };
    const esc = (e) => { if (e.key === 'Escape') setShowPriceDropdown(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [showPriceDropdown]);

  // Phone filter sheet: page behind stays still, Escape closes.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [sheetOpen]);

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

      // No size chosen means show everything. Otherwise the piece has to be
      // genuinely available in at least one of the chosen sizes.
      const sizeMatch = activeSizes.length === 0
        || activeSizes.some(sz => sizeAvailable(p, sz));

      const colourMatch = activeColours.length === 0
        || activeColours.includes((p.colorName || '').trim().toLowerCase());

      return seasonMatch && subMatch && priceMatch && sizeMatch && colourMatch;
    })
    .sort((a, b) => {
      if (sort === 'price_asc')  return getPrice(a.price) - getPrice(b.price);
      if (sort === 'price_desc') return getPrice(b.price) - getPrice(a.price);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // Only offer sizes that some piece in this collection actually comes in,
  // in the order the size list defines rather than alphabetically.
  const SIZE_ORDER = ['XS','S','M','L','XL','XXL','6','8','10','12','14','16','28','30','32','34','36','38'];
  const offeredSizes = SIZE_ORDER.filter(sz => products.some(p => (p.sizes || []).includes(sz)));

  // Colours on offer here, from the colour names set in the admin.
  const offeredColours = Object.values(products.reduce((acc, p) => {
    const name = (p.colorName || '').trim();
    if (!name) return acc;
    const key = name.toLowerCase();
    acc[key] = acc[key] || { key, name, swatch: p.swatch || p.color || '#ddd', count: 0 };
    acc[key].count += 1;
    return acc;
  }, {})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const showColours = offeredColours.length > 1;
  const toggleColour = (key) => setActiveColours(prev =>
    prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  const colourNames = activeColours.map(k => offeredColours.find(c => c.key === k)?.name || k);

  const toggleSize = (sz) => {
    setActiveSizes(prev =>
      prev.includes(sz) ? prev.filter(s => s !== sz) : [...prev, sz]
    );
  };

  const currentSubs = activeSeason !== 'All' ? (config.subcategories[activeSeason] || []) : [];

  // Keep the address bar honest when filters are changed on the page.
  const chooseSub = (sub) => {
    setActiveSub(sub);
    if (sub === 'All') setSearchParams({});
    else setSearchParams({ sub });
  };
  const activeRange = PRICE_RANGES[priceRange];

  // Filters that live in the phone sheet (season/category stay on the page).
  const sheetCount = activeSizes.length + activeColours.length + (priceRange !== 0 ? 1 : 0) + (sort !== 'newest' ? 1 : 0);
  const clearSheet = () => { setActiveSizes([]); setActiveColours([]); setPriceRange(0); setSort('newest'); };

  const colourChips = (
    <div className="cp-colour-chips">
      {offeredColours.map(c => (
        <button
          key={c.key}
          type="button"
          aria-pressed={activeColours.includes(c.key)}
          className={`cp-colour-chip ${activeColours.includes(c.key) ? 'cp-colour-chip--on' : ''}`}
          onClick={() => toggleColour(c.key)}
        >
          <span className="cp-colour-dot" style={{ '--sw': c.swatch }} aria-hidden="true" />
          {c.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="cp-page">
      <div className="cp-hero">
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
              onClick={() => chooseSub('All')}
            >All</button>
            {currentSubs.map(s => (
              <button
                key={s}
                className={`cp-filter-btn cp-filter-btn--sub ${activeSub === s ? 'cp-filter-btn--sub-active' : ''}`}
                onClick={() => chooseSub(s)}
              >{s}</button>
            ))}
          </div>
        )}

        {offeredSizes.length > 0 && (
          <div className="cp-size-filter cp-desktop-only">
            <span className="cp-size-filter-label">Size</span>
            {offeredSizes.map(sz => {
              const anyLeft = products.some(p => sizeAvailable(p, sz));
              return (
                <button
                  key={sz}
                  className={`cp-size-chip ${activeSizes.includes(sz) ? 'cp-size-chip--on' : ''} ${!anyLeft ? 'cp-size-chip--gone' : ''}`}
                  onClick={() => toggleSize(sz)}
                  disabled={!anyLeft}
                  title={anyLeft ? `Show pieces available in ${sz}` : `Nothing left in ${sz}`}
                >
                  {sz}
                </button>
              );
            })}
            {activeSizes.length > 0 && (
              <button className="cp-size-clear" onClick={() => setActiveSizes([])}>
                Clear
              </button>
            )}
          </div>
        )}

        {showColours && (
          <div className="cp-size-filter cp-colour-filter cp-desktop-only">
            <span className="cp-size-filter-label">Colour</span>
            {colourChips}
            {activeColours.length > 0 && (
              <button className="cp-size-clear" onClick={() => setActiveColours([])}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Toolbar — count + price filter + sort */}
      <div className="cp-toolbar">
        <p className="cp-count">
          {filtered.length} piece{filtered.length !== 1 ? 's' : ''}
          {activeSeason !== 'All' && <span className="cp-count-filter"> · {activeSeason}{activeSub !== 'All' ? ` · ${activeSub}` : ''}</span>}
          {priceRange !== 0 && <span className="cp-count-filter"> · {activeRange.label}</span>}
          {activeSizes.length > 0 && <span className="cp-count-filter"> · size {activeSizes.join(', ')}</span>}
          {colourNames.length > 0 && <span className="cp-count-filter"> · {colourNames.join(', ')}</span>}
        </p>

        {/* Phone: one button opens size, price and sort */}
        <button
          type="button"
          className={`cp-sheet-btn cp-mobile-only ${sheetCount ? 'cp-sheet-btn--on' : ''}`}
          onClick={() => setSheetOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          Filter &amp; sort
          {sheetCount > 0 && <span className="cp-sheet-count">{sheetCount}</span>}
        </button>

        <div className="cp-toolbar-right cp-desktop-only">
          {/* Price filter dropdown */}
          <div className="cp-dropdown-wrap" ref={priceRef}>
            <button
              aria-expanded={showPriceDropdown}
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
              <div className="cp-dropdown-menu" role="menu">
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
              aria-label="Sort by"
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

      {sheetOpen && (
        <div className="cp-sheet-root">
          <div className="cp-sheet-scrim" onClick={() => setSheetOpen(false)} />
          <div className="cp-sheet" role="dialog" aria-modal="true" aria-label="Filter and sort">
            <div className="cp-sheet-head">
              <span className="cp-sheet-title">Filter &amp; sort</span>
              <button type="button" className="cp-sheet-close" onClick={() => setSheetOpen(false)} aria-label="Close">
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="cp-sheet-body">
              <fieldset className="cp-sheet-group">
                <legend>Sort by</legend>
                {SORT_OPTIONS.map(o => (
                  <label key={o.value} className={`cp-sheet-option ${sort === o.value ? 'is-on' : ''}`}>
                    <input type="radio" name="cp-sort" checked={sort === o.value} onChange={() => setSort(o.value)} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </fieldset>

              {offeredSizes.length > 0 && (
                <fieldset className="cp-sheet-group">
                  <legend>Size</legend>
                  <div className="cp-sheet-sizes">
                    {offeredSizes.map(sz => {
                      const anyLeft = products.some(p => sizeAvailable(p, sz));
                      return (
                        <button
                          key={sz}
                          type="button"
                          aria-pressed={activeSizes.includes(sz)}
                          className={`cp-size-chip ${activeSizes.includes(sz) ? 'cp-size-chip--on' : ''} ${!anyLeft ? 'cp-size-chip--gone' : ''}`}
                          onClick={() => toggleSize(sz)}
                          disabled={!anyLeft}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {showColours && (
                <fieldset className="cp-sheet-group">
                  <legend>Colour</legend>
                  {colourChips}
                </fieldset>
              )}

              <fieldset className="cp-sheet-group">
                <legend>Price</legend>
                {PRICE_RANGES.map((r, i) => (
                  <label key={r.label} className={`cp-sheet-option ${priceRange === i ? 'is-on' : ''}`}>
                    <input type="radio" name="cp-price" checked={priceRange === i} onChange={() => setPriceRange(i)} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </fieldset>
            </div>

            <div className="cp-sheet-foot">
              <button type="button" className="cp-sheet-clear" onClick={clearSheet} disabled={!sheetCount}>Clear</button>
              <button type="button" className="cp-sheet-apply" onClick={() => setSheetOpen(false)}>
                Show {filtered.length} piece{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="cp-empty">
          <p>Nothing matches these filters.</p>
          {(activeSeason !== 'All' || sheetCount > 0) && (
            <button
              type="button"
              className="cp-empty-reset"
              onClick={() => { clearSheet(); handleSeasonClick('All'); setSearchParams({}); }}
            >
              Clear all filters
            </button>
          )}
        </div>
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
                <QuickAdd product={p} />
                {isSoldOut(p) && <span className="cp-soldout">Sold Out</span>}
                {p.tag && !isSoldOut(p) && <span className="cp-tag">{p.tag}</span>}
                {p.season && p.season !== 'All Season' && (
                  <span className="cp-season-tag">{p.season}</span>
                )}
                <button
                  className={`cp-wish-btn ${isWished(p._id) ? 'cp-wish-btn--on' : ''}`}
                  aria-label={isWished(p._id) ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
                  aria-pressed={isWished(p._id)}
                  onClick={(e) => { e.stopPropagation(); toggleWishlist(p); }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isWished(p._id) ? "#111" : "none"} stroke="#111" strokeWidth="1.5" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <div className="cp-size-hover" aria-hidden="true">
                  <p className="cp-size-hover-label">{isSoldOut(p) ? 'Sold Out' : 'View Product'}</p>
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
      )}
    </div>
  );
}