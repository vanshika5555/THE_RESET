import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ProductReviews.css';

function Stars({ value, size = 15 }) {
  return (
    <span className="pr-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: size, color: n <= value ? '#111' : '#d4d4d4' }}>★</span>
      ))}
    </span>
  );
}

export default function ProductReviews({ productId }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [hover, setHover]   = useState(0);
  const [text, setText]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    axios.get(`/api/reviews/product/${productId}`)
      .then(res => { setReviews(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    setShowForm(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // If this person already reviewed, load their words into the form.
  const mine = user ? reviews.find(r => (r.user?._id || r.user) === user._id) : null;

  const openForm = () => {
    setRating(mine ? mine.rating : 0);
    setText(mine ? mine.review : '');
    setError('');
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!rating)      { setError('Please pick a star rating.'); return; }
    if (!text.trim()) { setError('Please write a short review.'); return; }

    setSaving(true);
    setError('');
    try {
      await axios.post('/api/reviews', {
        product: productId,
        rating,
        review: text.trim(),
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(
        err.response
          ? (err.response.data?.message || 'Could not save your review.')
          : 'Cannot reach the server.'
      );
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete your review?')) return;
    try {
      await axios.delete(`/api/reviews/${id}`);
      load();
    } catch {
      alert('Could not delete the review.');
    }
  };

  const count = reviews.length;
  const avg = count
    ? (reviews.reduce((s, r) => s + r.rating, 0) / count).toFixed(1)
    : 0;

  return (
    <section className="pr-section">
      <div className="pr-head">
        <h2 className="pr-title">Reviews</h2>
        {count > 0 && (
          <div className="pr-summary">
            <Stars value={Math.round(avg)} />
            <span className="pr-avg">{avg}</span>
            <span className="pr-count">({count} review{count !== 1 ? 's' : ''})</span>
          </div>
        )}
      </div>

      {/* write / edit */}
      {!user ? (
        <p className="pr-login-note">
          <Link to="/login" className="pr-login-link">Sign in</Link> to write a review.
        </p>
      ) : showForm ? (
        <form className="pr-form" onSubmit={submit}>
          <div className="pr-rate-row">
            <span className="pr-rate-label">Your rating</span>
            <span className="pr-rate-stars">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  type="button"
                  key={n}
                  className="pr-star-btn"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                  <span style={{ color: n <= (hover || rating) ? '#111' : '#d4d4d4' }}>★</span>
                </button>
              ))}
            </span>
          </div>

          <textarea
            className="pr-textarea"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="How was the fit, fabric and quality?"
          />

          {error && <p className="pr-error">{error}</p>}

          <div className="pr-form-actions">
            <button type="submit" className="pr-submit" disabled={saving}>
              {saving ? 'Saving...' : mine ? 'Update Review' : 'Post Review'}
            </button>
            <button type="button" className="pr-cancel" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="pr-write-btn" onClick={openForm}>
          {mine ? 'Edit your review' : 'Write a review'}
        </button>
      )}

      {/* list */}
      {loading ? (
        <p className="pr-empty">Loading reviews...</p>
      ) : count === 0 ? (
        <p className="pr-empty">No reviews yet. Be the first to review this piece.</p>
      ) : (
        <ul className="pr-list">
          {reviews.map(r => {
            const isMine = user && (r.user?._id || r.user) === user._id;
            return (
              <li key={r._id} className="pr-item">
                <div className="pr-item-head">
                  <Stars value={r.rating} size={13} />
                  <span className="pr-name">
                    {r.userName || r.user?.name || 'Customer'}
                    {isMine && <span className="pr-you">you</span>}
                  </span>
                  {r.verified && (
                    <span className="pr-verified" title="Bought and received this piece">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                      Verified buyer
                    </span>
                  )}
                  <span className="pr-date">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="pr-text">{r.review}</p>
                {isMine && (
                  <button type="button" className="pr-delete" onClick={() => remove(r._id)}>
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}