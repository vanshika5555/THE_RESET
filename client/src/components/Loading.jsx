import React, { useState, useEffect } from 'react';

/**
 * A loading message that admits when something is taking a while.
 *
 * The API sleeps on the free hosting plan, so the first request of the
 * day can take the better part of a minute. Saying nothing for that long
 * looks broken, so after a few seconds we explain what is happening.
 */
export default function Loading({ label = 'Loading...' }) {
  const [slow, setSlow] = useState(false);
  const [verySlow, setVerySlow] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setSlow(true), 3000);
    const b = setTimeout(() => setVerySlow(true), 9000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  return (
    <div style={{
      padding: '80px 24px',
      textAlign: 'center',
      color: '#666',
      fontSize: '15px',
      letterSpacing: '.03em',
    }}>
      <div style={{
        width: '26px',
        height: '26px',
        margin: '0 auto 18px',
        border: '2px solid #e5e5e5',
        borderTopColor: '#111',
        borderRadius: '50%',
        animation: 'theresetSpin .8s linear infinite',
      }} />

      <p style={{ margin: 0 }}>{label}</p>

      {slow && !verySlow && (
        <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#999' }}>
          Just waking the store up — one moment.
        </p>
      )}

      {verySlow && (
        <p style={{ margin: '10px auto 0', fontSize: '13px', color: '#999', maxWidth: '340px', lineHeight: 1.6 }}>
          This is taking longer than usual. The store sleeps when it is quiet,
          so the first visit can take up to a minute. Thanks for waiting.
        </p>
      )}

      <style>{`
        @keyframes theresetSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}