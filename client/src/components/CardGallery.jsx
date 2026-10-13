import React, { useRef, useState } from 'react';
import './CardGallery.css';

/**
 * Photo carousel inside a product card.
 * Mouse: arrows on hover. Phone: swipe the photo left/right.
 * A swipe never opens the product; a tap still does.
 */
export default function CardGallery({ product }) {
  const [i, setI] = useState(0);
  const start = useRef(null);
  const swiped = useRef(false);

  const gallery = (product.images && product.images.length)
    ? product.images
    : (product.image ? [product.image] : []);

  if (!gallery.length) return null;

  const many = gallery.length > 1;
  const step = (dir) => setI(prev => (prev + dir + gallery.length) % gallery.length);

  const go = (e, dir) => {
    e.stopPropagation();
    e.preventDefault();
    step(dir);
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
  };

  const onTouchEnd = (e) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    // Mostly sideways and far enough to be deliberate
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swiped.current = true;
      step(dx < 0 ? 1 : -1);
    }
  };

  // Swallow the click that some browsers send after a swipe.
  const onClickCapture = (e) => {
    if (swiped.current) {
      swiped.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <>
      <img
        src={gallery[i]}
        alt={product.name}
        className="cp-card-photo cg-img"
        loading="lazy"
        draggable="false"
        onTouchStart={many ? onTouchStart : undefined}
        onTouchEnd={many ? onTouchEnd : undefined}
        onClickCapture={many ? onClickCapture : undefined}
      />

      {many && (
        <>
          <button type="button" aria-label="Previous image" className="cg-nav cg-nav--prev" onClick={(e) => go(e, -1)}>‹</button>
          <button type="button" aria-label="Next image" className="cg-nav cg-nav--next" onClick={(e) => go(e, 1)}>›</button>

          <div className="cg-dots" aria-hidden="true">
            {gallery.map((_, idx) => (
              <span key={idx} className={`cg-dot ${idx === i ? 'cg-dot--on' : ''}`} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
