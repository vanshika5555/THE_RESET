import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './StockHistory.css';

/*
  Every change to this product's stock, newest first: orders taking pieces,
  cancels putting them back, and edits by the team — with how many were left.
*/

const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

function why(m) {
  const order = m.order ? <Link to={`/orders?order=${m.order}`}>#{m.orderNo.slice(-6)}</Link> : null;
  const name = m.by?.name ? m.by.name.split(' ')[0] : '';
  switch (m.reason) {
    case 'order':  return <>Sold · order {order}</>;
    case 'cancel': return <>Order {order} cancelled{m.by && m.by.role !== 'user' && name ? ` by ${name}` : m.by ? ' by the customer' : ''}</>;
    case 'unpaid': return <>Order {order} not paid · put back</>;
    case 'new':    return <>Added{name ? ` by ${name}` : ''}</>;
    default:       return <>Edited{name ? ` by ${name}` : ''}</>;
  }
}

export default function StockHistory({ productId }) {
  const [rows, setRows] = useState(null);
  const [all, setAll] = useState(false);
  const [size, setSize] = useState('');

  useEffect(() => {
    if (!productId) return;
    axios.get(`/api/products/${productId}/stock-history`).then((r) => setRows(r.data || [])).catch(() => setRows([]));
  }, [productId]);

  if (!rows) return <p className="sh-empty">Loading…</p>;
  if (!rows.length) return <p className="sh-empty">No changes recorded yet. Sales, cancels and edits will show here.</p>;

  const sizes = [...new Set(rows.map((r) => r.size))];
  const list = rows.filter((r) => !size || r.size === size);
  const shown = all ? list : list.slice(0, 8);
  // Sold in 30 days, less what came back from cancelled orders.
  const recent = rows.filter((r) => Date.now() - new Date(r.at) < 30 * 864e5);
  const sold30 = Math.max(0, recent.reduce((n, r) => (r.reason === 'order' ? n - r.change : r.reason === 'cancel' || r.reason === 'unpaid' ? n - r.change : n), 0));

  return (
    <div className="sh">
      <div className="sh-top">
        <p className="sh-sum"><strong>{sold30}</strong> sold in the last 30 days</p>
        {sizes.length > 1 && (
          <div className="sh-sizes" role="group" aria-label="Show one size">
            <button type="button" className={!size ? 'is-on' : ''} onClick={() => setSize('')}>All</button>
            {sizes.map((s) => (
              <button key={s} type="button" className={size === s ? 'is-on' : ''} onClick={() => setSize(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
      <ul className="sh-list">
        {shown.map((m) => (
          <li key={m._id}>
            <span className={`sh-change ${m.change > 0 ? 'is-up' : 'is-down'}`}>{m.change > 0 ? `+${m.change}` : `−${-m.change}`}</span>
            <span className="sh-what">
              <span className="sh-why">Size {m.size} · {why(m)}</span>
              <span className="sh-when">{when(m.at)}</span>
            </span>
            {m.after != null && <span className="sh-after">{m.after} left</span>}
          </li>
        ))}
      </ul>
      {list.length > 8 && (
        <button type="button" className="sh-more" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${list.length}`}</button>
      )}
    </div>
  );
}
