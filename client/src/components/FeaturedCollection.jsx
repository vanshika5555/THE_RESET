import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useCallback } from "react";
import { getProducts } from "../utils/fetchCache";
import "./FeaturedCollection.css";
import { cdn } from "../utils/img";
import Price from './Price';

// Sold out pieces are left out — there is no point featuring what cannot be bought.
const isSoldOut = (p) => {
  if (!p.inStock) return true;
  if (!p.stock || p.stock.length === 0) return false;
  return (p.sizes || []).every(size => {
    const entry = p.stock.find(s => s.size === size);
    return !entry || entry.qty <= 0;
  });
};

export default function FeaturedCollection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cardW, setCardW] = useState(220);
  const timerRef = useRef(null);
  const startX = useRef(null);
  const navigate = useNavigate();

  // Real pieces from the shop, newest first.
  useEffect(() => {
    getProducts()
      .then(data => {
        const live = (data || [])
          .filter(p => !isSoldOut(p))
          .slice(0, 9)
          .map(p => ({
            id: p._id,
            name: p.name,
            category: p.category,
            price: p.price,
            mrp: p.mrp,
            color: p.color || '#f0f0f0',
            tag: p.tag || null,
            img: (p.images && p.images[0]) || p.image,
          }))
          .filter(p => p.img);          // a card with no photo looks broken
        setProducts(live);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Responsive card width
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480)       setCardW(Math.min(190, Math.round(w * 0.46)));
      else if (w < 768)  setCardW(190);
      else               setCardW(220);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const next = useCallback(() => {
    setActive((p) => (products.length ? (p + 1) % products.length : 0));
  }, [products.length]);

  useEffect(() => {
    if (paused || products.length < 2) return;
    timerRef.current = setInterval(next, 2800);
    return () => clearInterval(timerRef.current);
  }, [paused, next, products.length]);

  const goTo = (i) => {
    setActive(i);
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  };

  const onDragStart = (e) => {
    startX.current = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    setPaused(true);
  };

  const onDragEnd = (e) => {
    const endX = e.type === "touchend" ? e.changedTouches[0].clientX : e.clientX;
    const diff = startX.current - endX;
    if (Math.abs(diff) > 40 && products.length > 1) {
      if (diff > 0) setActive((p) => (p + 1) % products.length);
      else          setActive((p) => (p - 1 + products.length) % products.length);
    }
    setTimeout(() => setPaused(false), 6000);
  };

  const gap = cardW * 0.72;

  // Nothing to feature — hide the section rather than show an empty stage.
  if (!loading && products.length === 0) return null;

  return (
    <section className="fc-section">
      <div className="fc-header">
        <h2 className="fc-title">Picked for now</h2>
      </div>

      {loading ? (
        <div className="fc-loading">Loading the collection...</div>
      ) : (
        <>
          <div
            className="fc-track"
            onMouseDown={onDragStart}
            onMouseUp={onDragEnd}
            onTouchStart={onDragStart}
            onTouchEnd={onDragEnd}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {products.map((p, i) => {
              // Work out how far this card sits from the front one, wrapping
              // around the ends so the carousel is a loop rather than a line.
              const offset   = i - active;
              const wrapped  = ((offset + products.length) % products.length);
              const dir      = wrapped > products.length / 2
                ? wrapped - products.length
                : wrapped;

              const isActive = dir === 0;
              const absDir   = Math.abs(dir);

              // Two cards either side of the front one, and nothing beyond.
              const VISIBLE  = 2;
              const shown    = absDir <= VISIBLE;

              const scale    = isActive ? 1 : Math.max(0.7, 1 - absDir * 0.13);
              const zIndex   = 10 - absDir;
              const tx       = dir * gap;
              const opacity  = !shown ? 0 : isActive ? 1 : Math.max(0.4, 1 - absDir * 0.26);

              return (
                <div
                  key={p.id}
                  className={`fc-card ${isActive ? "fc-card--active" : ""}`}
                  style={{
                    transform: `translateX(${tx}px) scale(${scale})`,
                    zIndex,
                    opacity,
                    width:  isActive ? cardW + 20 : cardW,
                    height: isActive ? (cardW + 20) * 1.75 : cardW * 1.6,
                    background: p.color,
                    pointerEvents: shown ? 'auto' : 'none',
                  }}
                  // Clicking the front card opens it; clicking a side card brings it forward.
                  onClick={() => (isActive ? navigate(`/product/${p.id}`) : goTo(i))}
                >
                  {p.tag && <span className="fc-card-tag">{p.tag}</span>}

                  <div className="fc-card-img">
                    <img src={cdn(p.img, 500)} alt={p.name} className="fc-card-photo" loading="lazy" draggable="false" />
                  </div>

                  {isActive && (
                    <div className="fc-card-info">
                      <p className="fc-card-category">{p.category}</p>
                      <p className="fc-card-name">{p.name}</p>
                      <p className="fc-card-price"><Price value={p.price} mrp={p.mrp} /></p>
                      <button
                        className="fc-card-btn"
                        aria-label={`View ${p.name}`}
                        onClick={(e) => { e.stopPropagation(); navigate(`/product/${p.id}`); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {products.length > 1 && (
            <div className="fc-dots">
              {products.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Show item ${i + 1}`}
                  className={`fc-dot ${i === active ? "fc-dot--active" : ""}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="fc-footer">
        <Link to="/men" className="fc-view-all">See the full collection</Link>
      </div>
    </section>
  );
}