import React, { useEffect, useRef, useState } from 'react';
import { cachedGet } from '../utils/fetchCache';
import './StarRating.css';

/**
 * Small star summary under a product card.
 *
 * A grid of 30 products used to fire 30 review requests the moment the page
 * opened. Now each card only asks once it scrolls into view, and repeat
 * visits reuse the answer.
 */
export default function StarRating({ productId }) {
  const [summary, setSummary] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!productId || !ref.current) return undefined;
    let active = true;

    const load = () =>
      cachedGet(`/api/reviews/summary/${productId}`)
        .then((data) => { if (active) setSummary(data); })
        .catch(() => {});

    if (!('IntersectionObserver' in window)) { load(); return () => { active = false; }; }

    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '200px' });
    io.observe(ref.current);

    return () => { active = false; io.disconnect(); };
  }, [productId]);

  const has = summary && summary.count > 0;

  return (
    <div ref={ref} className="sr-wrap" aria-hidden={!has}>
      {has && (
        <>
          <div className="sr-stars" aria-label={`Rated ${summary.avg} out of 5`}>
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                className={s <= Math.round(summary.avg) ? 'sr-star--filled' : 'sr-star--empty'}
              >★</span>
            ))}
          </div>
          <span className="sr-avg">{summary.avg}</span>
          <span className="sr-count">({summary.count})</span>
        </>
      )}
    </div>
  );
}
