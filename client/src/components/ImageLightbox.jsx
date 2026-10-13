import React, { useState, useEffect, useRef } from 'react';
import './ImageLightbox.css';

/**
 * Full-screen image viewer for the product gallery.
 *
 * Click (or tap) to zoom in where you pointed. With a mouse the image then
 * follows the cursor; on a phone you drag a finger to look around.
 * Arrow keys and swipe move between photos (swipe only when not zoomed).
 */
export default function ImageLightbox({ images, startIndex = 0, alt, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const touchStart = useRef(null);

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

  const pointAt = (el, clientX, clientY) => {
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  // Zoomed: the finger moves the view around the photo.
  const handleTouchMove = (e) => {
    if (!zoomed) return;
    const t = e.touches[0];
    setOrigin(pointAt(e.currentTarget, t.clientX, t.clientY));
  };

  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = touchStart.current.x - t.clientX;
    const dy = touchStart.current.y - t.clientY;
    touchStart.current = null;
    if (zoomed || total < 2) return;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? 1 : -1);
  };

  const toggleZoom = (e) => {
    e.stopPropagation();
    if (!zoomed) setOrigin(pointAt(e.currentTarget, e.clientX, e.clientY));
    setZoomed(z => !z);
  };

  return (
    <div className="lb-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button className="lb-close" onClick={onClose} aria-label="Close">
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

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
        onClick={toggleZoom}
        onMouseMove={handleMove}
        onMouseLeave={(e) => { if (e.nativeEvent.pointerType !== 'touch') setZoomed(false); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
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
        <span className="lb-hint-mouse">{zoomed ? 'Click to zoom out' : 'Click the photo to zoom in'}</span>
        <span className="lb-hint-touch">
          {zoomed ? 'Drag to look around · tap to zoom out' : 'Tap to zoom · swipe for more'}
        </span>
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