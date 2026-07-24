import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ProductReviews from '../components/ProductReviews';
import RelatedProducts from '../components/RelatedProducts';
import Loading from '../components/Loading';
import SizeGuide from '../components/SizeGuide';
import ImageLightbox from '../components/ImageLightbox';
import './ProductDetail.css';
import usePageMeta from '../hooks/usePageMeta';

const pdNav = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255,255,255,.92)',
  color: '#111',
  fontSize: '22px',
  lineHeight: '40px',
  textAlign: 'center',
  cursor: 'pointer',
  padding: 0,
  zIndex: 3,
  boxShadow: '0 2px 8px rgba(0,0,0,.18)',
};

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  if (!children) return null;
  return (
    <div className="pd-acc">
      <button type="button" className="pd-acc-head" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span className={`pd-acc-chev ${open ? 'pd-acc-chev--open' : ''}`}>⌄</span>
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

  usePageMeta({
    title: product ? product.name : 'Loading product',
    description: product
      ? (product.description
          ? product.description.slice(0, 155)
          : `${product.name} — ${product.subcategory} for ${product.category.toLowerCase()}. ${product.price} at THE RESET.`)
      : undefined,
    image: product ? ((product.images && product.images[0]) || product.image) : undefined,
  });

  const { addToCart, setCartOpen } = useCart();
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

  const handleAdd = () => {
    if (!chosenSize) {
      setSizeWarning(true);
      return;
    }
    setSizeWarning(false);
    addToCart(product, chosenSize);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const handleBuyNow = () => {
    if (!chosenSize) {
      setSizeWarning(true);
      return;
    }
    setSizeWarning(false);
    addToCart(product, chosenSize);
    setCartOpen(false);
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
                  <img src={url} alt={`${product.name} view ${i + 1}`} />
                </button>
              ))}
            </div>
          )}

          <div
            className="pd-media"
            style={{ background: product.color || '#f0f0f0', cursor: mainImg ? 'zoom-in' : 'default' }}
            onClick={() => mainImg && setZoomOpen(true)}
            role={mainImg ? 'button' : undefined}
            tabIndex={mainImg ? 0 : undefined}
            onKeyDown={(e) => { if (mainImg && e.key === 'Enter') setZoomOpen(true); }}
          >
            {mainImg
              ? <img src={mainImg} alt={product.name} className="pd-photo" />
              : <div className="pd-photo-empty">No image</div>}

            {mainImg && <span className="pd-zoom-hint">Click to zoom</span>}
            {product.tag && <span className="pd-tag">{product.tag}</span>}

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  style={{ ...pdNav, left: '12px' }}
                  onClick={(e) => { e.stopPropagation(); step(-1); }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  style={{ ...pdNav, right: '12px' }}
                  onClick={(e) => { e.stopPropagation(); step(1); }}
                >
                  ›
                </button>
                <span style={{
                  position: 'absolute', bottom: '12px', right: '14px',
                  background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: '12px',
                  padding: '3px 9px', borderRadius: '11px', zIndex: 3,
                }}>
                  {activeImg + 1} / {gallery.length}
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
          <p className="pd-price">{product.price}</p>
          <p className="pd-tax">MRP inclusive of all taxes</p>

          <StarRating productId={product._id} />

          {product.description && (
            <p className="pd-desc-text">{product.description}</p>
          )}

          <div className="pd-sizes-block">
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
                  disabled={qtyFor(s) <= 0}
                  title={qtyFor(s) <= 0 ? 'Sold out in this size' : undefined}
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

          {sizeWarning && (
            <p className="pd-warn">Please select a size first.</p>
          )}

          {(!product.inStock || product.sizes.every(s => qtyFor(s) <= 0)) && (
            <p className="pd-oos">Currently sold out.</p>
          )}

          <button
            type="button"
            className="pd-add-btn"
            onClick={handleAdd}
            disabled={!product.inStock}
          >
            {added ? '✓ Added to Bag' : 'Add to Bag'}
          </button>

          <button
            type="button"
            className="pd-buy-btn"
            onClick={handleBuyNow}
            disabled={!product.inStock}
          >
            Buy Now
          </button>

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
            <Accordion title="Details">
              {product.description
                ? <p className="pd-acc-text">{product.description}</p>
                : null}
            </Accordion>
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