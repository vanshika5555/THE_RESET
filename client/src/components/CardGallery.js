import React, { useState } from 'react';

// Arrow buttons drawn with inline styles so they work regardless of stylesheet load order.
const navBase = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255,255,255,.9)',
  color: '#111',
  fontSize: '17px',
  lineHeight: '30px',
  textAlign: 'center',
  cursor: 'pointer',
  padding: 0,
  zIndex: 3,
  boxShadow: '0 1px 4px rgba(0,0,0,.18)',
};

const dotsWrap = {
  position: 'absolute',
  bottom: '10px',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: '5px',
  zIndex: 3,
};

export default function CardGallery({ product }) {
  const [i, setI] = useState(0);

  const gallery = (product.images && product.images.length)
    ? product.images
    : (product.image ? [product.image] : []);

  if (!gallery.length) return null;

  const go = (e, dir) => {
    e.stopPropagation();
    e.preventDefault();
    setI(prev => (prev + dir + gallery.length) % gallery.length);
  };

  return (
    <>
      <img src={gallery[i]} alt={product.name} className="cp-card-photo" />

      {gallery.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            style={{ ...navBase, left: '10px' }}
            onClick={(e) => go(e, -1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next image"
            style={{ ...navBase, right: '10px' }}
            onClick={(e) => go(e, 1)}
          >
            ›
          </button>

          <div style={dotsWrap}>
            {gallery.map((_, idx) => (
              <span
                key={idx}
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: idx === i ? '#111' : 'rgba(0,0,0,.28)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}