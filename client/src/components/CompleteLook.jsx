import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cachedGet } from '../utils/fetchCache';
import { cdn } from '../utils/img';
import Price from './Price';
import QuickAdd from './QuickAdd';
import './RelatedProducts.css';
import './CompleteLook.css';

/*
  "Wear it with" — pieces that finish the outfit: the shop's own picks,
  then what other customers bought together, then a top for a bottom (or
  the reverse). Each card has the + to add a size without leaving the page.
*/
export default function CompleteLook({ productId }) {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setItems([]);
    cachedGet(`/api/products/${productId}/pairs`)
      .then((d) => { if (active) setItems(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { active = false; };
  }, [productId]);

  if (!items.length) return null;
  const boughtTogether = items.some((p) => p.pairSource === 'bought');

  return (
    <section className="rp-section cl-section" aria-labelledby="cl-title">
      <div className="cl-head">
        <h2 className="rp-title" id="cl-title">Wear it with</h2>
        {boughtTogether && <p className="cl-sub">Often bought together</p>}
      </div>
      <div className="rp-grid">
        {items.map((p) => {
          const img = (p.images && p.images.length) ? p.images[0] : p.image;
          const open = () => navigate(`/product/${p._id}`);
          return (
            <div
              key={p._id}
              className="rp-card cl-card"
              role="link"
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
            >
              <div className="rp-img" style={{ background: p.color || '#f0f0f0' }}>
                {img
                  ? <img src={cdn(img, 500)} alt={p.name} loading="lazy" decoding="async" />
                  : <span className="rp-img-empty">No image</span>}
                <QuickAdd product={p} />
              </div>
              <p className="rp-sub">{p.subcategory}</p>
              <p className="rp-name">{p.name}{p.colorName ? ` — ${p.colorName}` : ''}</p>
              <p className="rp-price"><Price value={p.price} mrp={p.mrp} /></p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
