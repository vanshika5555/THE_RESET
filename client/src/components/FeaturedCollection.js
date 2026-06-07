import React, { useState, useEffect, useRef, useCallback } from "react";
import "./FeaturedCollection.css";
import FC1 from "../assets/FC1.jpg";
import FC2 from "../assets/FC2.jpg";
import FC3 from "../assets/FC3.jpg";
import FC4 from "../assets/FC4.jpg";
import FC5 from "../assets/FC5.jpg";
import FC6 from "../assets/FC6.jpg";

const products = [
  { id: 1, name: "Structured Linen Shirt", category: "Men",   price: "₹3,490", color: "#e8e4dc", tag: null,        img: FC1 },
  { id: 2, name: "Relaxed Poplin Shirt",   category: "Men",   price: "₹2,990", color: "#d4cfc8", tag: null,        img: FC2 },
  { id: 3, name: "Clean Fit Oxford",       category: "Men",   price: "₹3,290", color: "#f5f3f0", tag: "NEW",       img: FC3 },
  { id: 4, name: "Slim Taper Trouser",     category: "Men",   price: "₹3,990", color: "#2a2a2a", tag: null,        img: FC4 },
  { id: 5, name: "Utility Cargo Pant",     category: "Men",   price: "₹4,290", color: "#c4bfb5", tag: null,        img: FC5 },
  { id: 6, name: "Tonal Knit Polo",        category: "Men",   price: "₹2,490", color: "#3d3d3d", tag: "BESTSELLER", img: FC6 },
];

export default function FeaturedCollection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cardW, setCardW] = useState(220);
  const timerRef = useRef(null);
  const startX = useRef(null);

  // Responsive card width
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480)       setCardW(130);
      else if (w < 768)  setCardW(165);
      else               setCardW(220);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Auto-advance every 2.8s
  const next = useCallback(() => {
    setActive((p) => (p + 1) % products.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 2800);
    return () => clearInterval(timerRef.current);
  }, [paused, next]);

  const goTo = (i) => {
    setActive(i);
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  };

  // Swipe
  const onDragStart = (e) => {
    startX.current = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    setPaused(true);
  };

  const onDragEnd = (e) => {
    const endX = e.type === "touchend" ? e.changedTouches[0].clientX : e.clientX;
    const diff = startX.current - endX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setActive((p) => (p + 1) % products.length);
      else          setActive((p) => (p - 1 + products.length) % products.length);
    }
    setTimeout(() => setPaused(false), 6000);
  };

  const gap = cardW * 0.78;

  return (
    <section className="fc-section">
      <div className="fc-header">
        <span className="fc-eyebrow">Hand-Picked For You</span>
        <h2 className="fc-title">FEATURED COLLECTION</h2>
      </div>

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
          const offset   = i - active;
          const wrapped  = ((offset + products.length) % products.length);
          const dir      = wrapped <= products.length / 2 ? wrapped : wrapped - products.length;
          const isActive = dir === 0;
          const absDir   = Math.abs(dir);
          const scale    = isActive ? 1 : Math.max(0.68, 1 - absDir * 0.1);
          const zIndex   = 10 - absDir;
          const tx       = dir * gap;
          const opacity  = absDir > 3 ? 0 : isActive ? 1 : Math.max(0.35, 1 - absDir * 0.22);
          const isLight  = ["#e8e4dc","#d4cfc8","#f5f3f0","#c4bfb5"].includes(p.color);

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
              }}
              onClick={() => goTo(i)}
            >
              {p.tag && <span className="fc-card-tag">{p.tag}</span>}

              <div className="fc-card-img">
                <img src={p.img} alt={p.name} className="fc-card-photo" />
              </div>

              {isActive && (
                <div className="fc-card-info">
                  <p className="fc-card-category">{p.category}</p>
                  <p className="fc-card-name">{p.name}</p>
                  <p className="fc-card-price">{p.price}</p>
                  <button className="fc-card-btn" onClick={(e) => e.stopPropagation()}>
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

      <div className="fc-dots">
        {products.map((_, i) => (
          <button key={i} className={`fc-dot ${i === active ? "fc-dot--active" : ""}`} onClick={() => goTo(i)} />
        ))}
      </div>

      <div className="fc-footer">
        <a href="#" className="fc-view-all">View All Collection →</a>
      </div>
    </section>
  );
}