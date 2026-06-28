import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const StarInput = ({ rating, onChange }) => (
  <div className="prof-stars-input">
    {[1,2,3,4,5].map(star => (
      <button
        key={star} type="button"
        className={`prof-star-btn ${star <= rating ? 'prof-star-btn--active' : ''}`}
        onClick={() => onChange(star)}
      >★</button>
    ))}
    <span className="prof-star-label">{rating}/5</span>
  </div>
);

const StarDisplay = ({ rating }) => (
  <div className="prof-stars">
    {[1,2,3,4,5].map(s => (
      <span key={s} className={s <= rating ? 'prof-star--filled' : 'prof-star--empty'}>★</span>
    ))}
    <span className="prof-star-label">{rating}/5</span>
  </div>
);

export default function ProfileReviews() {
  const { user } = useAuth();
  const [reviews, setReviews]       = useState([]);
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ productId: '', productName: '', rating: 5, review: '' });
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  useEffect(() => {
    fetchReviews();
    fetchOrders();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`/api/reviews/myreviews`, { headers });
      setReviews(res.data);
    } catch {}
    setLoading(false);
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`/api/orders/myorders`, { headers });
      setOrders(res.data);
    } catch {}
  };

  // Flatten all ordered products for the dropdown
  const orderedProducts = [];
  orders.forEach(order => {
    order.items.forEach(item => {
      if (item.product && !orderedProducts.find(p => p._id === item.product)) {
        orderedProducts.push({ _id: item.product, name: item.name });
      }
    });
  });

  const handleProductSelect = (e) => {
    const selected = orderedProducts.find(p => p._id === e.target.value);
    setForm(f => ({ ...f, productId: e.target.value, productName: selected?.name || '' }));
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.productId || !form.review) { setError('Please select a product and write a review.'); return; }
    try {
      await axios.post(`/api/reviews`, {
        product: form.productId,
        rating:  form.rating,
        review:  form.review,
      }, { headers });
      setSuccess('Review submitted!');
      setForm({ productId: '', productName: '', rating: 5, review: '' });
      setShowForm(false);
      fetchReviews();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review.');
    }
  };

  const deleteReview = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await axios.delete(`/api/reviews/${id}`, { headers });
      fetchReviews();
    } catch {}
  };

  if (loading) return <div className="prof-loading">Loading reviews...</div>;

  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <h2 className="prof-section-title">My Reviews</h2>
        <button className="prof-add-btn" onClick={() => { setShowForm(true); setError(''); setSuccess(''); }}>
          + Write a Review
        </button>
      </div>

      {success && <div className="prof-success">{success}</div>}

      {showForm && (
        <div className="prof-addr-form">
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '18px', marginBottom: '20px', color: '#111' }}>
            Write a Review
          </h3>
          {error && <div className="prof-error">{error}</div>}
          <form onSubmit={submitReview}>
            <div className="prof-form-grid" style={{ gridTemplateColumns: '1fr' }}>

              {/* Product picker from orders */}
              <div className="prof-form-field">
                <label>Select Product *</label>
                {orderedProducts.length > 0 ? (
                  <select
                    value={form.productId}
                    onChange={handleProductSelect}
                    style={{ border: '1px solid #e0e0e0', padding: '10px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="">— Choose a product you ordered —</option>
                    {orderedProducts.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#aaa', padding: '10px 0' }}>
                    You need to order a product before reviewing it.
                  </p>
                )}
              </div>

              {/* Star rating */}
              <div className="prof-form-field">
                <label>Rating *</label>
                <StarInput rating={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} />
              </div>

              {/* Review text */}
              <div className="prof-form-field">
                <label>Your Review *</label>
                <textarea
                  value={form.review}
                  onChange={e => setForm(f => ({ ...f, review: e.target.value }))}
                  placeholder="Share your experience with this product..."
                  rows={4}
                />
              </div>

            </div>
            <div className="prof-form-actions">
              <button type="button" className="prof-btn prof-btn--outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="prof-btn prof-btn--fill">Submit Review</button>
            </div>
          </form>
        </div>
      )}

      {reviews.length === 0 && !showForm ? (
        <div className="prof-empty">
          <p>You haven't written any reviews yet.</p>
          <p style={{ fontSize: '12px', color: '#ccc' }}>Order a product first, then come back to review it.</p>
        </div>
      ) : (
        <div className="prof-reviews-list">
          {reviews.map((r) => (
            <div key={r._id} className="prof-review-card">
              <div className="prof-review-header">
                <div>
                  <p className="prof-review-product">{r.product?.name || 'Product'}</p>
                  <StarDisplay rating={r.rating} />
                </div>
                <div className="prof-review-meta">
                  <p className="prof-review-date">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <button className="prof-review-remove" onClick={() => deleteReview(r._id)}>Delete</button>
                </div>
              </div>
              <p className="prof-review-text">{r.review}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}