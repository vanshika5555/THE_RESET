import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getRecent } from '../utils/recent';
import { cdn } from '../utils/img';
import './RecentlyViewed.css';
import Price from './Price';

/** A row of the pieces this shopper looked at recently (this browser only). */
export default function RecentlyViewed({ excludeId }) {
  // Read once per product page — the list changes when you open a product.
  const items = useMemo(
    () => getRecent().filter(p => p._id !== excludeId).slice(0, 8),
    [excludeId]
  );

  if (items.length === 0) return null;

  return (
    <section className="rv" aria-labelledby="rv-title">
      <h2 id="rv-title" className="rv-title">Recently viewed</h2>
      <ul className="rv-row">
        {items.map(p => (
          <li key={p._id} className="rv-item">
            <Link to={`/product/${p._id}`} className="rv-link">
              <span className="rv-img" style={{ background: p.color || '#f2f2f1' }}>
                {p.image && <img src={cdn(p.image, 300)} alt="" loading="lazy" />}
              </span>
              <span className="rv-name">{p.name}</span>
              <span className="rv-price"><Price value={p.price} mrp={p.mrp} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
