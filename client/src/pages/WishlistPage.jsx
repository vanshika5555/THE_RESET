import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import './WishlistPage.css';
import { cdn } from '../utils/img';
import Price from '../components/Price';

// Is this size still available? Pieces saved before stock tracking fall back
// to the simple in/out switch.
const sizeLeft = (p, size) => {
  if (p.inStock === false) return false;
  if (!p.stock || p.stock.length === 0) return true;
  const entry = p.stock.find(s => s.size === size);
  return !!entry && entry.qty > 0;
};

const photoOf = (p) => (p.images && p.images[0]) || p.image || '';

export default function WishlistPage() {
  const { wishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [selectedSizes, setSelectedSizes] = useState({});
  const [needSize, setNeedSize] = useState(null);   // product id missing a size

  const handleSizeSelect = (productId, size) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
    if (needSize === productId) setNeedSize(null);
  };

  const handleAddToCart = (product) => {
    const size = selectedSizes[product._id];
    if (!size) { setNeedSize(product._id); return; }
    setNeedSize(null);
    addToCart(product, size);
  };

  return (
    <div className="wl-page">
      <div className="wl-header">
        <h1 className="wl-title">Wishlist</h1>
        <p className="wl-count">{wishlist.length} item{wishlist.length !== 1 ? 's' : ''}</p>
      </div>

      {wishlist.length === 0 ? (
        <div className="wl-empty">
          <p>Your wishlist is empty.</p>
          <p className="wl-empty-hint">Tap the heart on any piece to save it here.</p>
          <div className="wl-empty-actions">
            <Link to="/men" className="wl-shop-btn">Shop Men</Link>
            <Link to="/women" className="wl-shop-btn wl-shop-btn--fill">Shop Women</Link>
          </div>
        </div>
      ) : (
        <div className="wl-grid">
          {wishlist.map(product => {
            const sizes = product.sizes || [];
            const allGone = sizes.length > 0 && sizes.every(s => !sizeLeft(product, s));
            return (
              <div key={product._id} className="wl-card">
                <div className="wl-card-img" style={{ background: product.color || '#f0f0f0' }}>
                  <Link to={`/product/${product._id}`} className="wl-photo-link" aria-label={`View ${product.name}`}>
                    {photoOf(product) && <img src={cdn(photoOf(product), 600)} alt="" className="wl-photo" loading="lazy" />}
                  </Link>
                  {allGone && <span className="wl-soldout">Sold Out</span>}
                  <button
                    className="wl-remove-btn"
                    onClick={() => toggleWishlist(product)}
                    aria-label={`Remove ${product.name} from wishlist`}
                    title="Remove from wishlist"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" stroke="#111" strokeWidth="1.5" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                </div>
                <div className="wl-card-info">
                  <Link to={`/product/${product._id}`} className="wl-card-name">{product.name}</Link>
                  <p className="wl-card-price"><Price value={product.price} mrp={product.mrp} /></p>

                  {!allGone && sizes.length > 0 && (
                    <div className="wl-sizes" role="group" aria-label="Choose a size">
                      {sizes.map(s => {
                        const left = sizeLeft(product, s);
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`wl-size-btn ${selectedSizes[product._id] === s ? 'wl-size-btn--active' : ''}`}
                            onClick={() => handleSizeSelect(product._id, s)}
                            disabled={!left}
                            aria-pressed={selectedSizes[product._id] === s}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {needSize === product._id && (
                    <p className="wl-warn" role="alert">Pick a size first.</p>
                  )}

                  <button
                    className="wl-add-btn"
                    onClick={() => handleAddToCart(product)}
                    disabled={allGone}
                  >
                    {allGone ? 'Sold Out' : 'Add to Bag'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
