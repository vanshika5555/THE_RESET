import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import './WishlistPage.css';

export default function WishlistPage() {
  const { wishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [selectedSizes, setSelectedSizes] = React.useState({});

  const handleSizeSelect = (productId, size) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
  };

  const handleAddToCart = (product) => {
    const size = selectedSizes[product._id];
    if (!size) { alert('Please select a size'); return; }
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
          <Link to="/" className="wl-shop-btn">Start Shopping →</Link>
        </div>
      ) : (
        <div className="wl-grid">
          {wishlist.map(product => (
            <div key={product._id} className="wl-card">
              <div className="wl-card-img" style={{ background: product.color || '#f0f0f0' }}>
                {product.image && <img src={product.image} alt={product.name} className="wl-photo" />}
                <button className="wl-remove-btn" onClick={() => toggleWishlist(product)} title="Remove from wishlist">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#111" stroke="#111" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>
              <div className="wl-card-info">
                <p className="wl-card-name">{product.name}</p>
                <p className="wl-card-price">{product.price}</p>
                <div className="wl-sizes">
                  {product.sizes.map(s => (
                    <button
                      key={s}
                      className={`wl-size-btn ${selectedSizes[product._id] === s ? 'wl-size-btn--active' : ''}`}
                      onClick={() => handleSizeSelect(product._id, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button className="wl-add-btn" onClick={() => handleAddToCart(product)}>
                  Add to Bag
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}