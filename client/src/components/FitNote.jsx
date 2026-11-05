import React, { useEffect, useState } from 'react';
import { cachedGet } from '../utils/fetchCache';
import { VERDICT, fitPosition } from '../utils/fit';
import './FitNote.css';

/** "True to size — most buyers say…", from what reviewers said about the fit. */
export default function FitNote({ productId, onGuide }) {
  const [fit, setFit] = useState(null);
  useEffect(() => {
    let active = true;
    setFit(null);
    cachedGet(`/api/reviews/summary/${productId}`).then((d) => { if (active) setFit(d?.fit || null); }).catch(() => {});
    return () => { active = false; };
  }, [productId]);

  if (!fit || !fit.verdict) return null;
  const v = VERDICT[fit.verdict];
  const pos = fitPosition(fit);

  return (
    <div className="fn" aria-label={`Fit: ${v.title}. ${v.advice} Based on ${fit.votes} reviews.`}>
      <p className="fn-line">
        <strong>{v.title}</strong> · {v.advice}{' '}
        <span className="fn-n">({fit.votes} review{fit.votes === 1 ? '' : 's'})</span>
        {fit.verdict === 'mixed' && onGuide && (
          <> <button type="button" className="fn-guide" onClick={onGuide}>Size guide</button></>
        )}
      </p>
      <div className="fn-scale" aria-hidden="true">
        <span className="fn-track"><span className="fn-dot" style={{ left: `${pos}%` }} /></span>
        <span className="fn-ends"><span>Runs small</span><span>True to size</span><span>Runs large</span></span>
      </div>
    </div>
  );
}
