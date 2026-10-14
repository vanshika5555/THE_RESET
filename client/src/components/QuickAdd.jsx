import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import './QuickAdd.css';

const left = (p, size) => {
  if (p.inStock === false) return 0;
  if (!p.stock || p.stock.length === 0) return Infinity;
  const e = p.stock.find(s => s.size === size);
  return e ? e.qty : 0;
};

/**
 * "+" on a product card: pick a size and drop it in the bag
 * without leaving the grid. Sits inside the card's image box.
 */
export default function QuickAdd({ product }) {
  const { addToCart } = useCart();
  const [open, setOpen] = useState(false);
  const sizes = product.sizes || [];

  if (!sizes.length || sizes.every(s => left(product, s) <= 0)) return null;

  // Nothing in here may bubble up and open the product page.
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };

  if (!open) {
    return (
      <button
        type="button"
        className="qa-open"
        aria-label={`Quick add ${product.name}`}
        onClick={(e) => { stop(e); setOpen(true); }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    );
  }

  return (
    <div className="qa-panel" onClick={stop} role="group" aria-label={`Choose a size for ${product.name}`}>
      <div className="qa-head">
        <span>Add to bag</span>
        <button type="button" className="qa-close" aria-label="Close" onClick={(e) => { stop(e); setOpen(false); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="qa-sizes">
        {sizes.map(s => {
          const gone = left(product, s) <= 0;
          return (
            <button
              type="button"
              key={s}
              className="qa-size"
              disabled={gone}
              aria-label={gone ? `${s}, sold out` : `Add size ${s}`}
              onClick={(e) => { stop(e); addToCart(product, s); setOpen(false); }}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
