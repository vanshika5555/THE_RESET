import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ProductReviews from '../components/ProductReviews';
import RelatedProducts from '../components/RelatedProducts';
import RecentlyViewed from '../components/RecentlyViewed';
import NotifyMe from '../components/NotifyMe';
import { addRecent } from '../utils/recent';
import Loading from '../components/Loading';
import SizeGuide from '../components/SizeGuide';
import ImageLightbox from '../components/ImageLightbox';
import './ProductDetail.css';
import { cdn } from '../utils/img';
import usePageMeta from '../hooks/usePageMeta';
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

  const { addToCart, setCartOpen, setJustAdded } = useCart();
  const { toggleWishlist, isWished } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setActiveImg(0);
    setChosenSize('');
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

    // Note the visit for signed-in customers. Fire and forget — this must
    // never slow down or break the page.
    if (axios.defaults.headers.common.Authorization) {
      axios.post(`/api/products/${id}/view`).catch(() => {});
    }

    return () => { active = false; };
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

          <button
            type="button"
            className="pd-wish-btn"
            onClick={() => toggleWishlist(product)}
          >
            {isWished(product._id) ? '♥ Saved to Wishlist' : '♡ Add to Wishlist'}
          </button>

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