import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/* ───────────── formatting ───────────── */

// Accepts numbers or older price text like "₹2,990".
const toNumber = (n) => (typeof n === 'number' ? n : Number(String(n ?? '').replace(/[^0-9.]/g, '')));
export const inr = (n) => '₹' + Math.round(toNumber(n) || 0).toLocaleString('en-IN');

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fmtShort = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

export const fmtLong = (d) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : '';

export const shortId = (id = '') => '#' + id.slice(-6).toUpperCase();

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ───────────── order status ───────────── */

export const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

export const STATUS_TONE = {
  Pending: 'amber',
  Confirmed: 'blue',
  Shipped: 'violet',
  Delivered: 'green',
  Cancelled: 'red',
};

// What the shop does next with an order in each status.
export const NEXT_STEP = {
  Pending:   { to: 'Confirmed', label: 'Confirm order' },
  Confirmed: { to: 'Shipped',   label: 'Mark as shipped' },
  Shipped:   { to: 'Delivered', label: 'Mark as delivered' },
};

const RAIL_STEPS = ['Placed', 'Confirmed', 'Shipped', 'Delivered'];
const RAIL_INDEX = { Pending: 0, Confirmed: 1, Shipped: 2, Delivered: 3 };

export function Badge({ tone = 'grey', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'grey'}>{status}</Badge>;
}

/*
  Four-step progress bar for an order. Compact in lists, labelled in the
  order panel. Cancelled orders show an empty rail.
*/
export function StatusRail({ status, labelled = false }) {
  const cancelled = status === 'Cancelled';
  const at = cancelled ? -1 : (RAIL_INDEX[status] ?? 0);
  const tone = STATUS_TONE[status] || 'grey';

  return (
    <div
      className={`rail rail--${tone} ${labelled ? 'rail--labelled' : ''} ${cancelled ? 'rail--cancelled' : ''}`}
      role="img"
      aria-label={cancelled ? 'Order cancelled' : `Step ${at + 1} of 4: ${RAIL_STEPS[at]}`}
    >
      {RAIL_STEPS.map((step, i) => (
        <div key={step} className={`rail-step ${i <= at ? 'rail-step--done' : ''}`}>
          <span className="rail-bar" />
          {labelled && <span className="rail-label">{step}</span>}
        </div>
      ))}
    </div>
  );
}

/* ───────────── controls ───────────── */

export function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      disabled={disabled}
      className={`switch ${on ? 'switch--on' : ''}`}
      onClick={onChange}
    >
      <span className="switch-knob" />
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </label>
  );
}

/* Filter chips: [{ value, label, count }] */
export function FilterTabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`tab ${value === t.value ? 'tab--active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, text, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ children, onClose }) {
  if (!children) return null;
  return (
    <div className="note-error" role="alert">
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </div>
  );
}

/*
  Thumbnails are at most ~100px wide, so never download the full-size photo.
  Pinterest serves smaller copies at /236x/ — swap the size segment in.
*/
// Small copies for thumbnails: Cloudinary resizes on the fly; Pinterest has fixed sizes.
export const smallImage = (url = '') => {
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url) && !/\/upload\/[a-z]_/.test(url)) {
    return url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_240,c_limit/');
  }
  return url.replace(/(i\.pinimg\.com\/)(originals|\d+x(\d+)?)\//, '$1236x/');
};

export function Thumb({ src, color, size = 'md' }) {
  return (
    <span className={`thumb thumb--${size}`} style={{ background: color || '#ececea' }}>
      {src && (
        <img
          src={smallImage(src)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(e) => {
            // If the small copy doesn't exist, fall back to the original once.
            const img = e.currentTarget;
            if (img.dataset.fallback !== '1' && img.src !== src) { img.dataset.fallback = '1'; img.src = src; }
            else img.style.display = 'none';
          }}
        />
      )}
    </span>
  );
}

export const Chevron = ({ dir = 'right' }) => (
  <svg className={`chev chev--${dir}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

/* ───────────── side panel ─────────────
   Slides in from the right on desktop; full screen on a phone. */

export function Drawer({ open, onClose, title, subtitle, children, footer, wide }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current && panelRef.current.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="drawer-root">
      <div className="drawer-scrim" onClick={onClose} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={`drawer ${wide ? 'drawer--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="drawer-head">
          <button type="button" className="icon-btn drawer-back" onClick={onClose} aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="drawer-titles">
            <h2 className="drawer-title">{title}</h2>
            {subtitle && <p className="drawer-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn drawer-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

/* A labelled block inside a drawer. */
export function Section({ title, aside, children }) {
  return (
    <section className="dsec">
      {(title || aside) && (
        <div className="dsec-head">
          {title && <h3 className="dsec-title">{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
