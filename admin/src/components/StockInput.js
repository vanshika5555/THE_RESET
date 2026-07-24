import React, { useState, useEffect } from 'react';

/**
 * One editable stock box for a single size.
 *
 * Keeps what you type as plain text while you are typing, so the field can
 * be cleared and retyped normally. It only saves when you leave the box or
 * press Enter — not on every keystroke.
 */
export default function StockInput({ size, qty, onSave }) {
  const [text, setText] = useState(qty === null || qty === undefined ? '' : String(qty));
  const [status, setStatus] = useState('');   // '', 'saving', 'saved', 'error'

  // If the value changes from elsewhere (a reload), follow it —
  // but never while the person is mid-edit.
  useEffect(() => {
    if (status === '') {
      setText(qty === null || qty === undefined ? '' : String(qty));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty]);

  const commit = async () => {
    const trimmed = text.trim();

    // Empty box means "leave it as it was"
    if (trimmed === '') {
      setText(qty === null || qty === undefined ? '' : String(qty));
      return;
    }

    const next = Math.max(0, parseInt(trimmed, 10) || 0);
    setText(String(next));

    if (next === qty) return;      // nothing changed

    setStatus('saving');
    try {
      await onSave(next);
      setStatus('saved');
      setTimeout(() => setStatus(''), 1200);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(''), 2500);
    }
  };

  const isZero = qty === 0;

  return (
    <label
      className={`stock-chip ${isZero ? 'stock-chip--zero' : ''} ${status === 'error' ? 'stock-chip--error' : ''}`}
      title={`Stock for size ${size}`}
    >
      <span className="stock-chip-size">{size}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder="–"
        onChange={(e) => {
          // allow only digits, and allow an empty box while typing
          const v = e.target.value.replace(/[^0-9]/g, '');
          setText(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setText(qty === null || qty === undefined ? '' : String(qty));
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
      />
      {status === 'saving' && <span className="stock-chip-state">…</span>}
      {status === 'saved'  && <span className="stock-chip-state stock-chip-state--ok">✓</span>}
      {status === 'error'  && <span className="stock-chip-state stock-chip-state--bad">!</span>}
    </label>
  );
}