import React, { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import './AddedToast.css';
import { cdn } from '../utils/img';

/**
 * "Added to bag" pop-up. Shows what went in and offers the bag,
 * then gets out of the way after a few seconds.
 */
export default function AddedToast() {
  const { justAdded, setJustAdded, setCartOpen, cartCount } = useCart();

  useEffect(() => {
    if (!justAdded) return undefined;
    const t = setTimeout(() => setJustAdded(null), 4500);
    return () => clearTimeout(t);
  }, [justAdded, setJustAdded]);

  if (!justAdded) return null;
  const { product, size } = justAdded;
  const img = (product.images && product.images[0]) || product.image;

  return (
    <div className="at" role="status" aria-live="polite" key={justAdded.at}>
      <div className="at-img" style={{ background: product.color || '#f2f2f1' }}>
        {img && <img src={cdn(img, 120)} alt="" />}
      </div>
      <div className="at-text">
        <p className="at-title">Added to bag</p>
        <p className="at-meta">{product.name} · Size {size}</p>
      </div>
      <button
        type="button"
        className="at-btn"
        onClick={() => { setJustAdded(null); setCartOpen(true); }}
      >
        View bag ({cartCount})
      </button>
      <button type="button" className="at-close" aria-label="Dismiss" onClick={() => setJustAdded(null)}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
