import React, { useState, useEffect, useRef } from 'react';
import './ImageLightbox.css';

/**
 * Full-screen image viewer for the product gallery.
 *
 * Click to zoom in; the image then follows the cursor so you can inspect
 * fabric and stitching. Arrow keys and swipe move between photos.
 */
export default function ImageLightbox({ images, startIndex = 0, alt, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const touchX = useRef(null);

  const total = images.length;

  const go = (dir) => {
    setZoomed(false);
    setIndex(i => (i + dir + total) % total);
  };

  // keyboard, and stop the page behind from scrolling
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft')  go(-1);
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // move the zoom point with the cursor
  const handleMove = (e) => {
    if (!zoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  const handleTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchX.current === null || total < 2) return;
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 45) go(diff > 0 ? 1 : -1);
    touchX.current = null;
  };

  return (
    <div className="lb-backdrop" onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="Close">✕</button>

      {total > 1 && (
        <span className="lb-counter">{index + 1} / {total}</span>
      )}

      {total > 1 && (
        <>
          <button
            className="lb-nav lb-nav--prev"
            aria-label="Previous image"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
          >‹</button>
          <button
            className="lb-nav lb-nav--next"
            aria-label="Next image"
            onClick={(e) => { e.stopPropagation(); go(1); }}
          >›</button>
        </>
      )}

      <div
        className={`lb-stage ${zoomed ? 'lb-stage--zoomed' : ''}`}
        onClick={(e) => { e.stopPropagation(); setZoomed(z => !z); }}
        onMouseMove={handleMove}
        onMouseLeave={() => setZoomed(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={images[index]}
          alt={alt}
          className="lb-img"
          style={zoomed ? {
            transform: 'scale(2.2)',
            transformOrigin: `${origin.x}% ${origin.y}%`,
          } : undefined}
          draggable={false}
        />
      </div>

      <p className="lb-hint">
        {zoomed ? 'Click to zoom out' : 'Click the photo to zoom in'}
      </p>

      {total > 1 && (
        <div className="lb-thumbs" onClick={(e) => e.stopPropagation()}>
          {images.map((src, i) => (
            <button
              key={i}
              className={`lb-thumb ${i === index ? 'lb-thumb--on' : ''}`}
              onClick={() => { setZoomed(false); setIndex(i); }}
              aria-label={`View image ${i + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}