import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './StarRating.css';

export default function StarRating({ productId }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!productId) return;
    axios.get(`/api/reviews/summary/${productId}`)
      .then(res => setSummary(res.data))
      .catch(() => {});
  }, [productId]);

  if (!summary || summary.count === 0) return null;

  return (
    <div className="sr-wrap">
      <div className="sr-stars">
        {[1,2,3,4,5].map(s => (
          <span
            key={s}
            className={s <= Math.round(summary.avg) ? 'sr-star--filled' : 'sr-star--empty'}
          >★</span>
        ))}
      </div>
      <span className="sr-avg">{summary.avg}</span>
      <span className="sr-count">({summary.count})</span>
    </div>
  );
}