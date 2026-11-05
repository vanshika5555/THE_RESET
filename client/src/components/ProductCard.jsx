import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import CardGallery from './CardGallery';
import QuickAdd from './QuickAdd';
import Price from './Price';
import ColourDots from './ColourDots';
import { isUpcoming, dropBadge } from '../utils/drops';
import './CollectionPage.css';

const isSoldOut = (p) => {
  if (!p.inStock) return true;
  if (!p.stock || p.stock.length === 0) return false;
  return (p.sizes || []).every((size) => {
    const e = p.stock.find((s) => s.size === size);
    return !e || e.qty <= 0;
  });
};

/** The shop's product card (photo, quick add, wishlist, price, colours) — same look as collection pages. */
export default function ProductCard({ product: p, all = [] }) {
  const navigate = useNavigate();
  const { toggleWishlist, isWished } = useWishlist();
  const out = isSoldOut(p);
  const open = () => navigate(`/product/${p._id}`);
  return (
    <div className="cp-card">
      <div
        className="cp-card-img"
        style={{ background: p.color, cursor: 'pointer' }}
        onClick={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
      >
        <CardGallery product={p} />
        <QuickAdd product={p} />
        {out && <span className="cp-soldout">Sold Out</span>}
        {isUpcoming(p) ? <span className="cp-tag cp-tag--drop">{dropBadge(p.dropAt)}</span>
          : p.tag && !out && <span className="cp-tag">{p.tag}</span>}
        <button
          className={`cp-wish-btn ${isWished(p._id) ? 'cp-wish-btn--on' : ''}`}
          aria-label={isWished(p._id) ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
          aria-pressed={isWished(p._id)}
          onClick={(e) => { e.stopPropagation(); toggleWishlist(p); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWished(p._id) ? '#111' : 'none'} stroke="#111" strokeWidth="1.5" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <div className="cp-size-hover" aria-hidden="true">
          <p className="cp-size-hover-label">{out ? 'Sold Out' : 'View Product'}</p>
        </div>
      </div>
      <div className="cp-card-info">
        <p className="cp-card-sub">{p.subcategory}</p>
        <Link to={`/product/${p._id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <p className="cp-card-name">{p.name}</p>
        </Link>
        <p className="cp-card-price"><Price value={p.price} mrp={p.mrp} /></p>
        <ColourDots product={p} all={all} />
      </div>
    </div>
  );
}
