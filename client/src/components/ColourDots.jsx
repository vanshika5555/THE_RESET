import React from 'react';
import './ColourDots.css';

/**
 * Small colour dots under a product card when the same style comes in
 * other colours — "● ● ● +2". Read-only: the card itself is the link.
 * `all` is the product list the page already has, so no extra request.
 */
export default function ColourDots({ product, all }) {
  if (!product?.styleGroup || !Array.isArray(all)) return null;
  const family = all.filter(
    (p) => p.styleGroup === product.styleGroup && (p.inStock !== false || p._id === product._id)
  );
  if (family.length < 2) return null;

  // This card's own colour first, then the rest in the shop's order.
  const ordered = [product, ...family.filter((p) => p._id !== product._id)];
  const shown = ordered.slice(0, 4);
  const more = ordered.length - shown.length;
  const names = ordered.map((p) => p.colorName).filter(Boolean);

  return (
    <p className="cdots" aria-label={`${ordered.length} colours${names.length ? `: ${names.join(', ')}` : ''}`}>
      {shown.map((p, i) => (
        <span
          key={p._id}
          className={`cdot ${i === 0 ? 'cdot--on' : ''}`}
          style={{ '--sw': p.swatch || p.color || '#ddd' }}
          aria-hidden="true"
        />
      ))}
      {more > 0 && <span className="cdots-more" aria-hidden="true">+{more}</span>}
    </p>
  );
}
