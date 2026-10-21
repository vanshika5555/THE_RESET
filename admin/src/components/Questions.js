import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { fmtDate, FilterTabs, Empty, ErrorNote, Thumb, smallImage } from './ui';
import './Questions.css';

// Same shop address as the sidebar's "Open the shop".
const SITE_URL = import.meta.env.REACT_APP_SITE_URL || 'http://localhost:3001';

/*
  Shoppers' questions about products. Answer one and it's published on the
  product page for everyone, and the person who asked gets an email.
*/
const TABS = [
  { value: 'open', label: 'To answer' },
  { value: 'answered', label: 'Answered' },
  { value: 'hidden', label: 'Hidden' },
];

function QuestionCard({ q, onSaved, onError, onDelete }) {
  const [draft, setDraft] = useState(q.status === 'answered' ? null : '');
  const [busy, setBusy] = useState(false);
  const p = q.product || {};

  const save = async (body) => {
    setBusy(true);
    try {
      const r = await axios.put(`/api/questions/${q._id}`, body);
      onSaved(r.data);
      setDraft(r.data.status === 'answered' ? null : '');
    } catch (err) {
      onError(err.response?.data?.message || 'Could not save that.');
    }
    setBusy(false);
  };

  return (
    <article className="qa-card">
      <div className="qa-top">
        <Thumb src={smallImage(p.images?.[0] || p.image || '')} color={p.color} size="md" />
        <div className="qa-who">
          <a className="qa-product" href={`${SITE_URL}/product/${p._id}#questions`} target="_blank" rel="noreferrer">
            {p.name || 'A removed product'} ↗
          </a>
          <span className="qa-meta">{q.user?.name || q.name} · {q.user?.email} · {fmtDate(q.createdAt)}</span>
        </div>
      </div>
      <p className="qa-question">“{q.text}”</p>

      {draft === null ? (
        <>
          <div className="qa-answer">
            <span className="qa-answer-label">Your answer{q.answer?.by ? ` · ${q.answer.by}` : ''}</span>
            <p>{q.answer?.text}</p>
          </div>
          <div className="qa-actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDraft(q.answer?.text || '')}>Edit answer</button>
            {q.status === 'answered'
              ? <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => save({ status: 'hidden' })}>Hide from shop</button>
              : <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => save({ status: 'answered' })}>Show in shop</button>}
            <button type="button" className="btn btn--ghost btn--sm qa-delete" onClick={() => onDelete(q)}>Delete</button>
          </div>
        </>
      ) : (
        <form className="qa-form" onSubmit={(e) => { e.preventDefault(); save({ answer: draft }); }}>
          <textarea
            className="textarea"
            rows={3}
            maxLength={1000}
            placeholder="Answer as THE RESET — it shows on the product page for everyone."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="qa-actions">
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy || draft.trim().length < 2}>
              {busy ? 'Saving…' : q.status === 'answered' ? 'Save answer' : 'Answer & publish'}
            </button>
            {q.status === 'answered' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(null)}>Cancel</button>}
            {q.status === 'open' && <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => save({ status: 'hidden' })}>Hide</button>}
            <button type="button" className="btn btn--ghost btn--sm qa-delete" onClick={() => onDelete(q)}>Delete</button>
          </div>
        </form>
      )}
    </article>
  );
}

export default function Questions() {
  const [tab, setTab] = useState('open');
  const [list, setList] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    axios.get('/api/questions/all')
      .then((r) => {
        const all = r.data || [];
        setList(all);
        setCounts({ open: 0, answered: 0, hidden: 0, ...all.reduce((c, q) => ({ ...c, [q.status]: (c[q.status] || 0) + 1 }), {}) });
      })
      .catch(() => setError('Questions could not be loaded.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saved = (q) => {
    setList((l) => {
      const next = l.map((x) => (x._id === q._id ? q : x));
      setCounts({ open: 0, answered: 0, hidden: 0, ...next.reduce((c, x) => ({ ...c, [x.status]: (c[x.status] || 0) + 1 }), {}) });
      return next;
    });
  };
  const remove = async (q) => {
    if (!window.confirm('Delete this question for good?')) return;
    try {
      await axios.delete(`/api/questions/${q._id}`);
      setList((l) => {
        const next = l.filter((x) => x._id !== q._id);
        setCounts({ open: 0, answered: 0, hidden: 0, ...next.reduce((c, x) => ({ ...c, [x.status]: (c[x.status] || 0) + 1 }), {}) });
        return next;
      });
    } catch { setError('Could not delete it.'); }
  };

  const shown = list.filter((q) => q.status === tab);

  return (
    <div className="qa">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>
      <p className="page-intro">Answers are published on the product page for everyone, and the shopper who asked gets an email.</p>
      <FilterTabs items={TABS.map((t) => ({ ...t, count: counts[t.value] || 0 }))} value={tab} onChange={setTab} />
      {loading ? <p className="qa-loading">Loading…</p> : shown.length === 0 ? (
        <div className="panel">
          <Empty
            title={tab === 'open' ? 'All caught up' : tab === 'answered' ? 'Nothing answered yet' : 'Nothing hidden'}
            text={tab === 'open' ? 'New questions from shoppers appear here.' : ''}
          />
        </div>
      ) : (
        <div className="qa-list">
          {shown.map((q) => <QuestionCard key={q._id} q={q} onSaved={saved} onError={setError} onDelete={remove} />)}
        </div>
      )}
    </div>
  );
}
