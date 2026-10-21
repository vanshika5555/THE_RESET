import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import mySizes from '../utils/mySizes';
import StarRating from '../components/StarRating';
import ProductReviews from '../components/ProductReviews';
import RelatedProducts from '../components/RelatedProducts';
import CompleteLook from '../components/CompleteLook';
import RecentlyViewed from '../components/RecentlyViewed';
import NotifyMe from '../components/NotifyMe';
import DeliveryCheck from '../components/DeliveryCheck';
import { addRecent } from '../utils/recent';
import Loading from '../components/Loading';
import SizeGuide from '../components/SizeGuide';
import ImageLightbox from '../components/ImageLightbox';
import './ProductDetail.css';
import { cdn } from '../utils/img';
import usePageMeta from '../hooks/usePageMeta';
import useJsonLd from '../hooks/useJsonLd';
import { cachedGet } from '../utils/fetchCache';
import Price from '../components/Price';
import { formatPrice } from '../utils/price';

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  if (!children) return null;
  return (
    <div className="pd-acc">
      <button type="button" className="pd-acc-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{title}</span>
        <span className={`pd-acc-chev ${open ? 'pd-acc-chev--open' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && <div className="pd-acc-body">{children}</div>}
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chosenSize, setChosenSize] = useState('');
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [sizeWarning, setSizeWarning] = useState(false);
  const [showBar, setShowBar] = useState(false);   // phone: sticky Add to Bag
  const [copied, setCopied] = useState(false);     // "Link copied" after Share
  const [colours, setColours] = useState([]);      // this style in every colour
  const [rating, setRating] = useState(null);      // { avg, count } for search results
  const location = useLocation();
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const actionsRef = useRef(null);
  const sizesRef = useRef(null);
  const touch = useRef(null);

  usePageMeta({
    title: product ? product.name : 'Loading product',
    description: product
      ? (product.description
          ? product.description.slice(0, 155)
          : `${product.name} — ${product.subcategory} for ${product.category.toLowerCase()}. ${formatPrice(product.price)} at THE RESET.`)
      : undefined,
    image: product ? ((product.images && product.images[0]) || product.image) : undefined,
  });

  // What Google shows under the link: price, stock, rating, breadcrumbs.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const absolute = (u) => (!u ? undefined : u.startsWith('http') ? u : origin + u);
  const totalLeft = product
    ? ((product.stock || []).length
      ? (product.stock || []).filter((s) => (product.sizes || []).includes(s.size)).reduce((n, s) => n + (s.qty || 0), 0)
      : (product.inStock === false ? 0 : 1))
    : 0;
  useJsonLd('ld-product', product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.colorName ? `${product.name} — ${product.colorName}` : product.name,
    description: product.description || `${product.subcategory} for ${String(product.category).toLowerCase()}`,
    image: ((product.images && product.images.length) ? product.images : [product.image]).filter(Boolean).map(absolute),
    sku: String(product._id),
    brand: { '@type': 'Brand', name: 'THE RESET' },
    category: `${product.category} > ${product.subcategory}`,
    ...(product.colorName ? { color: product.colorName } : {}),
    offers: {
      '@type': 'Offer',
      url: `${origin}/product/${product._id}`,
      priceCurrency: 'INR',
      price: Number(product.price) || 0,
      availability: product.inStock !== false && totalLeft > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(rating && rating.count > 0 ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.avg, reviewCount: rating.count, bestRating: 5, worstRating: 1 },
    } : {}),
  } : null);
  useJsonLd('ld-breadcrumbs', product ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: product.category, item: `${origin}/${String(product.category).toLowerCase()}` },
      { '@type': 'ListItem', position: 3, name: product.subcategory, item: `${origin}/${String(product.category).toLowerCase()}?sub=${encodeURIComponent(product.subcategory)}` },
      { '@type': 'ListItem', position: 4, name: product.name, item: `${origin}/product/${product._id}` },
    ],
  } : null);

  const { addToCart, setCartOpen, setJustAdded } = useCart();
  const { toggleWishlist, isWished } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();

  // "Your size": what this customer has kept before, in this kind of fit.
  const [usual, setUsual] = useState({});
  useEffect(() => {
    let active = true;
    mySizes(user?._id).then((d) => { if (active) setUsual(d); });
    return () => { active = false; };
  }, [user?._id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setActiveImg(0);
    // Switching colour keeps the size you'd picked.
    setChosenSize(location.state?.size || '');
    setSizeWarning(false);
    setAdded(false);
    axios.get(`/api/products/${id}`)
      .then(res => {
        if (!active) return;
        setProduct(res.data);
        addRecent(res.data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('Sorry, we could not find that product.');
        setLoading(false);
      });

    setRating(null);
    cachedGet(`/api/reviews/summary/${id}`)
      .then((r) => { if (active) setRating(r); })
      .catch(() => {});

    axios.get(`/api/products/${id}/colours`)
      .then(res => { if (active) setColours(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (active) setColours([]); });

    // Note the visit for signed-in customers. Fire and forget — this must
    // never slow down or break the page.
    if (axios.defaults.headers.common.Authorization) {
      axios.post(`/api/products/${id}/view`).catch(() => {});
    }

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Phone: once the real buttons scroll off the top, a bar takes over at the bottom.
  useEffect(() => {
    if (!product) return undefined;
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = actionsRef.current;
      if (el) setShowBar(el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [product, loading]);

  // Same as qtyFor below, but safe to call from the handlers.
  const qtyLeft = (size) => {
    if (!product) return 0;
    if (!product.stock || product.stock.length === 0) return product.inStock ? Infinity : 0;
    const entry = product.stock.find(s => s.size === size);
    return entry ? entry.qty : 0;
  };

  const askForSize = () => {
    setSizeWarning(true);
    if (sizesRef.current) {
      sizesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleAdd = () => {
    if (!chosenSize || qtyLeft(chosenSize) <= 0) {
      askForSize();
      return;
    }
    setSizeWarning(false);
    addToCart(product, chosenSize);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const handleBuyNow = () => {
    if (!chosenSize || qtyLeft(chosenSize) <= 0) {
      askForSize();
      return;
    }
    setSizeWarning(false);
    addToCart(product, chosenSize);
    setCartOpen(false);
    setJustAdded(null);        // going straight to checkout — no pop-up needed
    // The item is already in the bag, so after signing in they land on
    // checkout with it waiting — not back at the start.
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  const pickSize = (s) => {
    setChosenSize(s);
    setSizeWarning(false);
  };

  // Phones open the share sheet (WhatsApp, Instagram, Messages…);
  // computers copy the link. Either way the link unfurls into a card
  // with this product's photo and price (see server/routes/share.js).
  const shareProduct = async () => {
    const url = `${window.location.origin}/product/${product._id}`;
    const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (touch && navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} | THE RESET`,
          text: `${product.name} — ${formatPrice(product.price)}`,
          url,
        });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // they closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      ta.remove();
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  };

  if (loading) return <Loading label="Loading product..." />;
  if (error)   return <div className="pd-state">{error}</div>;
  if (!product) return null;

  // Build the gallery: use the images array, fall back to the single image.
  const gallery = (product.images && product.images.length)
    ? product.images
    : (product.image ? [product.image] : []);

  // How many are left in a size. Products created before stock tracking
  // have no stock list, so they fall back to the in/out switch.
  const qtyFor = (size) => {
    if (!product.stock || product.stock.length === 0) {
      return product.inStock ? Infinity : 0;
    }
    const entry = product.stock.find(s => s.size === size);
    return entry ? entry.qty : 0;
  };

  const step = (dir) => {
    setActiveImg(prev => {
      const total = gallery.length || 1;
      return (prev + dir + total) % total;
    });
  };


  // Swipe the main photo on a phone.
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, moved: false };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (gallery.length > 1 && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      touch.current.moved = true;
      step(dx < 0 ? 1 : -1);
    }
  };
  const openZoom = () => {
    if (touch.current && touch.current.moved) { touch.current = null; return; }
    touch.current = null;
    if (mainImg) setZoomOpen(true);
  };

  const soldOut = !product.inStock || product.sizes.every(s => qtyFor(s) <= 0);
  // A sold-out size can still be picked — it opens "Notify me" instead.
  const chosenGone = !!chosenSize && qtyFor(chosenSize) <= 0;
  const mainImg = gallery[activeImg] || gallery[0];
  const backTo = product.category === 'Women' ? '/women' : '/men';

  return (
    <div className="pd-page">
      <div className="pd-layout">

        {/* LEFT: thumbnail strip + main image */}
        <div className="pd-gallery">
          {gallery.length > 1 && (
            <div className="pd-thumbs">
              {gallery.map((url, i) => (
                <button
                  type="button"
                  key={i}
                  className={`pd-thumb ${i === activeImg ? 'pd-thumb--active' : ''}`}
                  onClick={() => setActiveImg(i)}
                  onMouseEnter={() => setActiveImg(i)}
                >
                  <img src={cdn(url, 120)} alt={`${product.name} view ${i + 1}`} />
                </button>
              ))}
            </div>
          )}

          <div
            className="pd-media"
            style={{ background: product.color || '#f0f0f0', cursor: mainImg ? 'zoom-in' : 'default' }}
            onClick={openZoom}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            role={mainImg ? 'button' : undefined}
            aria-label={mainImg ? 'Open full-screen photos' : undefined}
            tabIndex={mainImg ? 0 : undefined}
            onKeyDown={(e) => { if (mainImg && e.key === 'Enter') setZoomOpen(true); }}
          >
            {mainImg
              ? <img src={cdn(mainImg, 900)} alt={product.name} className="pd-photo" draggable="false" />
              : <div className="pd-photo-empty">No image</div>}

            {mainImg && (
              <span className="pd-zoom-hint">
                <span className="pd-hint-mouse">Click</span><span className="pd-hint-touch">Tap</span> to zoom
              </span>
            )}
            {product.tag && <span className="pd-tag">{product.tag}</span>}

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  className="pd-nav pd-nav--prev"
                  onClick={(e) => { e.stopPropagation(); step(-1); }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  className="pd-nav pd-nav--next"
                  onClick={(e) => { e.stopPropagation(); step(1); }}
                >
                  ›
                </button>
                <span className="pd-counter">{activeImg + 1} / {gallery.length}</span>
                <span className="pd-dots" aria-hidden="true">
                  {gallery.map((_, i) => (
                    <span key={i} className={`pd-dot ${i === activeImg ? 'pd-dot--on' : ''}`} />
                  ))}
                </span>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: product info */}
        <div className="pd-info">
          <nav className="pd-crumbs">
            <Link to="/" className="pd-crumb-link">Home</Link>
            <span className="pd-crumb-sep">/</span>
            <Link to={backTo} className="pd-crumb-link">{product.category}</Link>
            <span className="pd-crumb-sep">/</span>
            <span className="pd-crumb-current">{product.subcategory}</span>
          </nav>

          <h1 className="pd-name">{product.name}</h1>
          <p className="pd-price"><Price value={product.price} mrp={product.mrp} /></p>
          <p className="pd-tax">MRP inclusive of all taxes</p>

          <StarRating productId={product._id} />

          {product.description && (
            <p className="pd-desc-text">{product.description}</p>
          )}

          {colours.length > 1 && (
            <div className="pd-colours">
              <p className="pd-sizes-label">
                Colour{product.colorName && <span className="pd-colour-name">: {product.colorName}</span>}
              </p>
              <div className="pd-swatches" role="list">
                {colours.map((c) => {
                  const current = String(c._id) === String(product._id);
                  const left = (c.stock || []).filter((s) => (c.sizes || []).includes(s.size)).reduce((n, s) => n + (s.qty || 0), 0);
                  const soldOut = c.inStock === false || ((c.stock || []).length > 0 && left === 0);
                  const label = `${c.colorName || c.name}${soldOut ? ' (sold out)' : ''}`;
                  return (
                    <Link
                      key={c._id}
                      role="listitem"
                      to={`/product/${c._id}`}
                      replace
                      state={{ size: chosenSize }}
                      className={`pd-swatch ${current ? 'pd-swatch--on' : ''} ${soldOut ? 'pd-swatch--out' : ''}`}
                      style={{ '--sw': c.swatch || c.color || '#ddd' }}
                      aria-label={label}
                      aria-current={current ? 'true' : undefined}
                      title={label}
                      onClick={(e) => { if (current) e.preventDefault(); }}
                    >
                      <span className="pd-swatch-fill" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pd-sizes-block" ref={sizesRef}>
            <div className="pd-sizes-head">
              <p className="pd-sizes-label">Size</p>
              <button
                type="button"
                className="pd-size-guide-btn"
                onClick={() => setGuideOpen(true)}
              >
                Size Guide
              </button>
            </div>
            <div className="pd-sizes">
              {product.sizes.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`pd-size-btn ${chosenSize === s ? 'pd-size-btn--active' : ''} ${qtyFor(s) <= 0 ? 'pd-size-btn--gone' : ''}`}
                  onClick={() => pickSize(s)}
                  aria-pressed={chosenSize === s}
                  aria-label={qtyFor(s) <= 0 ? `${s}, sold out — get notified` : `Size ${s}`}
                  title={qtyFor(s) <= 0 ? 'Sold out — tap to get notified' : undefined}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const mine = usual[product.fitType || 'Top'];
            if (!mine || !product.sizes.includes(mine.size)) return null;
            const gone = qtyFor(mine.size) <= 0;
            return (
              <p className={`pd-your-size ${chosenSize === mine.size ? 'is-picked' : ''}`}>
                <span>
                  Your size: <strong>{mine.size}</strong>
                  <span className="pd-your-size-why"> · {mine.note}{gone ? ` · sold out in ${mine.size} right now` : ''}</span>
                </span>
                {chosenSize !== mine.size && (
                  <button type="button" onClick={() => pickSize(mine.size)}>{gone ? 'Get notified' : `Choose ${mine.size}`}</button>
                )}
              </p>
            );
          })()}

          {chosenSize && qtyFor(chosenSize) !== Infinity && qtyFor(chosenSize) > 0 && qtyFor(chosenSize) <= 3 && (
            <p className="pd-low-stock">
              Only {qtyFor(chosenSize)} left in size {chosenSize}
            </p>
          )}

          {chosenGone && <NotifyMe key={chosenSize} productId={product._id} size={chosenSize} />}

          {sizeWarning && !chosenGone && (
            <p className="pd-warn">Please select a size first.</p>
          )}

          {soldOut && !chosenGone && (
            <p className="pd-oos">Sold out right now. Pick your size to hear when it's back.</p>
          )}

          <div className="pd-actions" ref={actionsRef}>
            <button
              type="button"
              className="pd-add-btn"
              onClick={handleAdd}
              disabled={soldOut || chosenGone}
            >
              {soldOut ? 'Sold Out' : chosenGone ? `Sold out in ${chosenSize}` : added ? '✓ Added to Bag' : 'Add to Bag'}
            </button>

            <button
              type="button"
              className="pd-buy-btn"
              onClick={handleBuyNow}
              disabled={soldOut || chosenGone}
            >
              Buy Now
            </button>
          </div>

          {added && (
            <div className="pd-added-row">
              <button type="button" className="pd-link-btn" onClick={() => setCartOpen(true)}>
                View Bag
              </button>
              <span className="pd-added-sep">·</span>
              <Link to={backTo} className="pd-link-btn">Continue Shopping</Link>
            </div>
          )}

          <div className="pd-row2">
            <button
              type="button"
              className="pd-wish-btn"
              onClick={() => toggleWishlist(product)}
            >
              {isWished(product._id) ? '♥ Saved to Wishlist' : '♡ Add to Wishlist'}
            </button>
            <button
              type="button"
              className={`pd-share-btn ${copied ? 'pd-share-btn--done' : ''}`}
              onClick={shareProduct}
              aria-label="Share this product"
            >
              {copied ? (
                <>✓ <span>Link copied</span></>
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v12" /><path d="M7.5 7.5 12 3l4.5 4.5" />
                    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  </svg>
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">{copied ? 'Link copied' : ''}</span>

          <DeliveryCheck />

          <div className="pd-accordions">
            <Accordion title="Materials &amp; Wash Care">
              {product.materials
                ? <p className="pd-acc-text">{product.materials}</p>
                : null}
            </Accordion>
            <Accordion title="Delivery &amp; Returns">
              {product.delivery
                ? <p className="pd-acc-text">{product.delivery}</p>
                : null}
            </Accordion>
          </div>

          <p className="pd-meta">{product.season} · {product.category}</p>
        </div>
      </div>

      <CompleteLook productId={product._id} />

      <ProductReviews productId={product._id} />

      <RelatedProducts product={product} />

      <RecentlyViewed excludeId={product._id} />

      {/* Phone: Add to Bag stays in reach after scrolling down */}
      {!soldOut && (
        <div className={`pd-bar ${showBar ? 'pd-bar--show' : ''}`} aria-hidden={!showBar}>
          <div className="pd-bar-text">
            <span className="pd-bar-name">{product.name}</span>
            <span className="pd-bar-meta">
              {formatPrice(product.price)}{chosenSize ? ` · Size ${chosenSize}` : ''}
            </span>
          </div>
          <button
            type="button"
            className="pd-bar-btn"
            onClick={handleAdd}
            tabIndex={showBar ? 0 : -1}
          >
            {added ? '✓ Added' : chosenSize && !chosenGone ? 'Add to Bag' : 'Select Size'}
          </button>
        </div>
      )}

      {zoomOpen && gallery.length > 0 && (
        <ImageLightbox
          images={gallery}
          startIndex={activeImg}
          alt={product.name}
          onClose={() => setZoomOpen(false)}
        />
      )}

      {guideOpen && (
        <SizeGuide
          category={product.category}
          fitType={product.fitType}
          sizes={product.sizes}
          availableSizes={product.sizes.filter(s => qtyFor(s) > 0)}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </div>
  );
}