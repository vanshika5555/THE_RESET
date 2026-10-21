import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { fmtDate, FilterTabs, Empty, ErrorNote, Thumb, smallImage } from './ui';
import './Reviews.css';

/* What customers are saying — and a way to take down anything that breaks the rules. */
export default function Reviews() {
  const [tab, setTab] = useState('all');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    axios.get('/api/reviews/all', { params: tab === 'photos' ? { photos: 1 } : {} })
      .then((r) => setList(r.data || []))
      .catch(() => setError('Reviews could not be loaded.'))
      .finally(() => setLoading(false));
  }, [tab]);

  const removePhoto = async (review, url) => {
    if (!window.confirm('Remove this photo from the review?')) return;
    try {
      const r = await axios.put(`/api/reviews/${review._id}/remove-photo`, { url });
      setList((l) => l.map((x) => (x._id === review._id ? { ...x, photos: r.data.photos } : x)));
    } catch { setError('Could not remove the photo.'); }
  };

  const removeReview = async (review) => {
    if (!window.confirm(`Delete ${review.userName}'s review? This can't be undone.`)) return;
    try {
      await axios.delete(`/api/reviews/${review._id}`);
      setList((l) => l.filter((x) => x._id !== review._id));
    } catch { setError('Could not delete the review.'); }
  };

  return (
    <div className="rv">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>
      <div className="toolbar">
        <FilterTabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'All' }, { value: 'photos', label: 'With photos' }]} />
      </div>
      <div className="panel">
        {loading ? <div className="loading">Loading reviews…</div>
          : list.length === 0 ? <Empty title="No reviews here yet" text="Reviews appear as soon as customers post them." />
          : list.map((r) => (
            <article key={r._id} className="rv-item">
              <Thumb src={r.product?.image} size="md" />
              <div className="rv-body">
                <div className="rv-head">
                  <span className="rv-stars" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></span>
                  <strong>{r.userName}</strong>
                  {r.verified && <span className="rv-verified">Verified buyer</span>}
                  <span className="rv-date">{fmtDate(r.createdAt)}</span>
                </div>
                <p className="rv-product">{r.product?.name || 'Deleted product'}</p>
                <p className="rv-text">{r.review}</p>
                {r.photos?.length > 0 && (
                  <div className="rv-photos">
                    {r.photos.map((u) => (
                      <span key={u} className="rv-photo">
                        <a href={u} target="_blank" rel="noreferrer"><img src={smallImage(u)} alt="" /></a>
                        <button type="button" onClick={() => removePhoto(r, u)} aria-label="Remove photo">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="btn btn--ghost btn--sm rv-delete" onClick={() => removeReview(r)}>Delete</button>
            </article>
          ))}
      </div>
    </div>
  );
}
