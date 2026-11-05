import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { cdn } from '../utils/img';
import { isUpcoming, dropBadge } from '../utils/drops';
import Price from './Price';
import '../pages/WishlistPage.css';

// Is this size still available? Pieces saved before stock tracking fall back
// to the simple in/out switch.
const sizeLeft = (p, size) => {
  if (p.inStock === false) return false;
  if (!p.stock || p.stock.length === 0) return true;
  const entry = p.stock.find(s => s.size === size);
  return !!entry && entry.qty > 0;
};

const photoOf = (p) => (p.images && p.images[0]) || p.image || '';

/**
 * One saved piece: photo, price, pick a size, add to bag.
 * Your own wishlist passes onRemove (the filled heart); a shared one doesn't.
 */
export default function WishCard({ product, onRemove }) {
  const { addToCart } = useCart();
  const [size, setSize] = useState('');
  const [needSize, setNeedSize] = useState(false);
  const [added, setAdded] = useState(false);

  const sizes = product.sizes || [];
  const allGone = sizes.length > 0 && sizes.every(s => !sizeLeft(product, s));
  const upcoming = isUpcoming(product);

  const add = () => {
    if (!size) { setNeedSize(true); return; }
    setNeedSize(false);
    addToCart(product, size);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className="wl-card">
      <div className="wl-card-img" style={{ background: product.color || '#f0f0f0' }}>
        <Link to={`/product/${product._id}`} className="wl-photo-link" aria-label={`View ${product.name}`}>
          {photoOf(product) && <img src={cdn(photoOf(product), 600)} alt="" className="wl-photo" loading="lazy" />}
        </Link>
        {upcoming ? <span className="wl-soldout wl-soldout--drop">{dropBadge(product.dropAt)}</span>
          : allGone && <span className="wl-soldout">Sold Out</span>}
        {onRemove && (
          <button
            className="wl-remove-btn"
            onClick={() => onRemove(product)}
            aria-label={`Remove ${product.name} from wishlist`}
            title="Remove from wishlist"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" stroke="#111" strokeWidth="1.5" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        )}
      </div>
      <div className="wl-card-info">
        <Link to={`/product/${product._id}`} className="wl-card-name">{product.name}</Link>
        <p className="wl-card-price"><Price value={product.price} mrp={product.mrp} /></p>

        {!allGone && !upcoming && sizes.length > 0 && (
          <div className="wl-sizes" role="group" aria-label="Choose a size">
            {sizes.map(s => (
              <button
                key={s}
                type="button"
                className={`wl-size-btn ${size === s ? 'wl-size-btn--active' : ''}`}
                onClick={() => { setSize(s); setNeedSize(false); }}
                disabled={!sizeLeft(product, s)}
                aria-pressed={size === s}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {needSize && <p className="wl-warn" role="alert">Pick a size first.</p>}

        {upcoming ? (
          <Link to={`/product/${product._id}`} className="wl-add-btn wl-add-btn--link">Get notified</Link>
        ) : (
          <button className="wl-add-btn" onClick={add} disabled={allGone}>
            {allGone ? 'Sold Out' : added ? '✓ Added' : 'Add to Bag'}
          </button>
        )}
      </div>
    </div>
  );
}
