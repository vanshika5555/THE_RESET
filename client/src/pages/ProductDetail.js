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
import './ProductDetail.css';

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
  const [sizeWarning, setSizeWarning] = useState(false);

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
    navigate(user ? '/checkout' : '/login');
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

          <div className="pd-media" style={{ background: product.color || '#f0f0f0' }}>
            {mainImg
              ? <img src={mainImg} alt={product.name} className="pd-photo" />
              : <div className="pd-photo-empty">No image</div>}
            {product.tag && <span className="pd-tag">{product.tag}</span>}

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  style={{ ...pdNav, left: '12px' }}
                  onClick={() => step(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  style={{ ...pdNav, right: '12px' }}
                  onClick={() => step(1)}
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
            <p className="pd-sizes-label">Size</p>
            <div className="pd-sizes">
              {product.sizes.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`pd-size-btn ${chosenSize === s ? 'pd-size-btn--active' : ''}`}
                  onClick={() => pickSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {sizeWarning && (
            <p className="pd-warn">Please select a size first.</p>
          )}

          {!product.inStock && <p className="pd-oos">Currently out of stock.</p>}

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
    </div>
  );
}