import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cachedGet } from '../utils/fetchCache';
import useNow from '../hooks/useNow';
import { isUpcoming, dropWhen, timeLeft } from '../utils/drops';
import './NextDrop.css';

const pad = (n) => String(n).padStart(2, '0');

// Home page: the next drop, counting down. Hidden when nothing is coming.
export default function NextDrop() {
  const [drops, setDrops] = useState([]);
  useEffect(() => {
    cachedGet('/api/products/drops').then((d) => setDrops(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  const now = useNow(drops.length > 0);
  const next = drops.find((p) => isUpcoming(p, now));
  if (!next) return null;

  const { d, h, m, s } = timeLeft(new Date(next.dropAt).getTime() - now);
  const img = (next.images && next.images[0]) || next.image;
  return (
    <section className="nd" aria-label="Next drop">
      <Link to={`/product/${next._id}`} className="nd-inner">
        {img && <img className="nd-img" src={img} alt="" width="72" height="90" loading="lazy" />}
        <span className="nd-text">
          <span className="nd-eyebrow">Next drop · {dropWhen(next.dropAt)}</span>
          <span className="nd-name">{next.name}</span>
        </span>
        <span className="nd-clock" role="timer" aria-label={`${d} days ${h} hours ${m} minutes left`}>
          {d > 0 && <><strong>{d}</strong><small>d</small></>}
          <strong>{pad(h)}</strong><small>h</small>
          <strong>{pad(m)}</strong><small>m</small>
          <strong>{pad(s)}</strong><small>s</small>
        </span>
        <span className="nd-cta">Get notified →</span>
      </Link>
    </section>
  );
}
