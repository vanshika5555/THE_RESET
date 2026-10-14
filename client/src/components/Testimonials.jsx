import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Testimonials.css';

function Stars({ value }) {
  return (
    <span className="tm-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= value ? 'tm-star tm-star--on' : 'tm-star'}>★</span>
      ))}
    </span>
  );
}

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export default function Testimonials() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/reviews/recent')
      .then(res => { setReviews(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Nothing genuine to show — say nothing rather than invent praise.
  if (loading || reviews.length === 0) return null;

  const average = (
    reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
  ).toFixed(1);

  return (
    <section className="tm-section">
      <div className="tm-head">
        <h2 className="tm-title">What people are saying</h2>
        <p className="tm-summary">
          <Stars value={Math.round(average)} />
          <span className="tm-avg">{average} average</span>
          <span className="tm-sep">·</span>
          <span className="tm-count">from real orders</span>
        </p>
      </div>

      <div className="tm-grid">
        {reviews.map(r => (
          <figure key={r._id} className="tm-card">
            <Stars value={r.rating} />

            <blockquote className="tm-quote">“{r.review}”</blockquote>

            <figcaption className="tm-by">
              <span className="tm-avatar">{initials(r.userName)}</span>
              <span className="tm-by-text">
                <span className="tm-name">{r.userName}</span>
                {r.product && (
                  <Link to={`/product/${r.product._id}`} className="tm-product">
                    on {r.product.name}
                  </Link>
                )}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}