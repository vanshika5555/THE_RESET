import React, { useRef, useState } from 'react';
import './CardGallery.css';
import { cdn } from '../utils/img';

/**
 * Photos inside a product card.
 * Mouse: hovering shows the second photo (the back, or a detail).
 * Phone: swipe the photo left/right; dots show where you are.
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
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swiped.current = true;
      step(dx < 0 ? 1 : -1);
    }
  };

  // Swallow the click some browsers send after a swipe.
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
        src={cdn(gallery[i], 600)}
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
          {/* second photo, revealed on hover (mouse only) */}
          <img
            src={cdn(gallery[1], 600)}
            alt=""
            aria-hidden="true"
            className="cp-card-photo cg-img cg-hover"
            loading="lazy"
            draggable="false"
          />
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
