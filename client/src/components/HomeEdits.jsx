import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cachedGet } from '../utils/fetchCache';
import { cdn } from '../utils/img';
import './HomeEdits.css';

// Home page: the edits the team chose to feature. Hidden when there are none.
export default function HomeEdits() {
  const [edits, setEdits] = useState([]);
  useEffect(() => {
    cachedGet('/api/collections?home=1').then((d) => setEdits(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  if (!edits.length) return null;
  return (
    <section className="he" aria-labelledby="he-title">
      <div className="he-head">
        <p className="he-eyebrow">Curated</p>
        <h2 id="he-title" className="he-title">The edits</h2>
      </div>
      <div className={`he-grid he-grid--${Math.min(edits.length, 3)}`}>
        {edits.slice(0, 6).map((e) => (
          <Link key={e._id} to={`/edit/${e.slug}`} className="he-card">
            <span className="he-img">{e.image && <img src={cdn(e.image, 900)} alt="" loading="lazy" />}</span>
            <span className="he-text">
              <span className="he-name">{e.title}</span>
              <span className="he-meta">{e.count} piece{e.count === 1 ? '' : 's'} · Shop the edit →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
