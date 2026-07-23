import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './RelatedProducts.css';

export default function RelatedProducts({ product }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!product) return;
    let active = true;

    axios.get(`/api/products?category=${product.category}`)
      .then(res => {
        if (!active) return;
        const all = (res.data || []).filter(p => p._id !== product._id);

        // Closest matches first: same subcategory, then same season, then the rest.
        const score = (p) => {
          let s = 0;
          if (p.subcategory === product.subcategory) s += 2;
          if (p.season === product.season) s += 1;
          return s;
        };

        const sorted = all
          .map(p => ({ p, s: score(p) }))
          .sort((a, b) => b.s - a.s)
          .map(x => x.p)
          .slice(0, 4);

        setItems(sorted);
      })
      .catch(() => setItems([]));

    return () => { active = false; };
  }, [product]);

  if (items.length === 0) return null;

  return (
    <section className="rp-section">
      <h2 className="rp-title">You May Also Like</h2>

      <div className="rp-grid">
        {items.map(p => {
          const img = (p.images && p.images.length) ? p.images[0] : p.image;
          return (
            <Link key={p._id} to={`/product/${p._id}`} className="rp-card">
              <div className="rp-img" style={{ background: p.color || '#f0f0f0' }}>
                {img
                  ? <img src={img} alt={p.name} />
                  : <span className="rp-img-empty">No image</span>}
                {!p.inStock && <span className="rp-oos">Out of stock</span>}
              </div>
              <p className="rp-sub">{p.subcategory}</p>
              <p className="rp-name">{p.name}</p>
              <p className="rp-price">{p.price}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}