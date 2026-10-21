import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './ProductReviews.css';
import './ProductQuestions.css';

/*
  Questions & answers on the product page. Anyone can read the answered
  ones; signed-in shoppers can ask, and see their own until we answer.
*/

const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const SHOW = 4;

export default function ProductQuestions({ productId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setAll(false); setSent(false);
    axios.get('/api/questions', { params: { product: productId } })
      .then((r) => { if (active) setList(r.data || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, user?._id]);

  const ask = async (e) => {
    e.preventDefault();
    setError('');
    if (text.trim().length < 8) { setError('Add a little more detail so we can answer properly.'); return; }
    setBusy(true);
    try {
      const r = await axios.post('/api/questions', { product: productId, text });
      setList((l) => [r.data, ...l]);
      setText(''); setOpen(false); setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send your question. Please try again.');
    }
    setBusy(false);
  };

  const answered = list.filter((q) => q.status === 'answered').length;
  const shown = all ? list : list.slice(0, SHOW);

  return (
    <section className="pr-section pq-section" id="questions" aria-labelledby="pq-title">
      <div className="pr-head">
        <h2 className="pr-title" id="pq-title">Questions</h2>
        {answered > 0 && <span className="pr-count">{answered} answered</span>}
      </div>

      {!user ? (
        <p className="pr-login-note">
          Fit, fabric, care? <Link to="/login" state={{ from: `${location.pathname}#questions` }} className="pr-login-link">Sign in</Link> to ask — we usually answer within a day.
        </p>
      ) : open ? (
        <form className="pq-form" onSubmit={ask}>
          <label className="pq-label" htmlFor="pq-text">Your question</label>
          <textarea
            id="pq-text"
            className="pr-textarea"
            rows={3}
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. I’m 5′6″ and usually wear M — would the M sit at the ankle?"
            autoFocus
          />
          <span className="pq-left">{300 - text.length} left</span>
          {error && <p className="pr-error" role="alert">{error}</p>}
          <div className="pr-form-actions">
            <button type="submit" className="pr-submit" disabled={busy}>{busy ? 'Sending…' : 'Send question'}</button>
            <button type="button" className="pr-cancel" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          {sent && <p className="pq-sent" role="status">Thanks — we’ll email you when it’s answered, and it’ll show here.</p>}
          <button type="button" className="pr-write-btn" onClick={() => { setOpen(true); setSent(false); }}>Ask a question</button>
        </>
      )}

      {loading ? null : list.length === 0 ? (
        <p className="pr-empty">No questions yet{user ? ' — ask the first one.' : '.'}</p>
      ) : (
        <ul className="pq-list">
          {shown.map((q) => (
            <li key={q._id} className="pq-item">
              <p className="pq-q"><span className="pq-mark" aria-hidden="true">Q</span><span>{q.text}</span></p>
              {q.answer ? (
                <div className="pq-a">
                  <span className="pq-mark pq-mark--a" aria-hidden="true">A</span>
                  <div>
                    <p className="pq-a-text">{q.answer.text}</p>
                    <p className="pq-meta">THE RESET · {when(q.answer.at)}</p>
                  </div>
                </div>
              ) : (
                <p className="pq-waiting">Waiting for our answer — only you can see this for now.</p>
              )}
              <p className="pq-meta pq-asker">Asked by {q.mine ? 'you' : q.name} · {when(q.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      {!all && list.length > SHOW && (
        <button type="button" className="pq-more" onClick={() => setAll(true)}>See all {list.length} questions</button>
      )}
    </section>
  );
}
