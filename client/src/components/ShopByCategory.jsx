import React, { useState, useEffect } from 'react';
import { getProducts } from '../utils/fetchCache';
import { useNavigate } from 'react-router-dom';
import './ShopByCategory.css';
import { cdn } from '../utils/img';

const isSoldOut = (p) => {
  if (!p.inStock) return true;
  if (!p.stock || p.stock.length === 0) return false;
  return (p.sizes || []).every(size => {
    const entry = p.stock.find(s => s.size === size);
    return !entry || entry.qty <= 0;
  });
};

export default function ShopByCategory() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getProducts()
      .then(data => {
        const live = (data || []).filter(p => !isSoldOut(p));

        // Group what is actually in stock by subcategory.
        const map = new Map();
        live.forEach(p => {
          const key = `${p.category}|${p.subcategory}`;
          if (!map.has(key)) {
            map.set(key, {
              category: p.category,
              subcategory: p.subcategory,
              count: 0,
              image: null,
              color: p.color || '#f0f0f0',
            });
          }
          const entry = map.get(key);
          entry.count += 1;
          if (!entry.image) {
            entry.image = (p.images && p.images[0]) || p.image || null;
          }
        });

        // Biggest groups first — those are the ones worth showing.
        const sorted = [...map.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);

        setGroups(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const open = (g) => {
    const base = g.category === 'Women' ? '/women' : '/men';
    navigate(`${base}?sub=${encodeURIComponent(g.subcategory)}`);
  };

  if (loading || groups.length === 0) return null;

  return (
    <section className="sbc-section">
      <div className="sbc-head">
        <h2 className="sbc-title">Shop by category</h2>
      </div>

      <div className="sbc-grid">
        {groups.map(g => (
          <button
            key={`${g.category}-${g.subcategory}`}
            className="sbc-tile"
            onClick={() => open(g)}
            style={{ background: g.color }}
          >
            {g.image && <img src={cdn(g.image, 700)} alt={g.subcategory} className="sbc-img" loading="lazy" />}
            <span className="sbc-veil" />
            <span className="sbc-label">
              <span className="sbc-cat">{g.category}</span>
              <span className="sbc-name">{g.subcategory}</span>
              <span className="sbc-count">
                {g.count} {g.count === 1 ? 'piece' : 'pieces'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}