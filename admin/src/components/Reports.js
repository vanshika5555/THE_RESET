import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { inr, fmtShort, plural, FilterTabs, Empty, ErrorNote, Thumb } from './ui';
import './Reports.css';

/*
  Sales reports, worked out in the browser from the orders and products the
  admin can already see. Cancelled orders never count as sales.
*/

const DAY = 24 * 60 * 60 * 1000;
const RANGES = [
  { value: '7',   label: '7 days',   days: 7 },
  { value: '30',  label: '30 days',  days: 30 },
  { value: '90',  label: '90 days',  days: 90 },
  { value: 'all', label: 'All time', days: null },
];

const toNum = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0);
const orderTotal = (o) => Number(o.total) || Number(o.subtotal) || 0;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

// Group into days, weeks or months so the chart never has more than ~45 bars.
function bucketsFor(fromT, toT) {
  const span = (toT - fromT) / DAY;
  const unit = span <= 45 ? 'day' : span <= 200 ? 'week' : 'month';
  const out = [];
  let t = startOfDay(fromT);
  if (unit === 'week') { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); t = d.getTime(); }
  if (unit === 'month') { const d = new Date(t); d.setDate(1); t = d.getTime(); }
  while (t <= toT) {
    const d = new Date(t);
    let next;
    if (unit === 'day') next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    else if (unit === 'week') next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime();
    else next = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    out.push({ start: t, end: next, sales: 0, orders: 0 });
    t = next;
  }
  return { unit, buckets: out };
}

const bucketLabel = (b, unit) => (unit === 'month'
  ? new Date(b.start).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  : fmtShort(b.start));

const bucketTitle = (b, unit) => {
  if (unit === 'day') return new Date(b.start).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  if (unit === 'week') return `Week of ${fmtShort(b.start)}`;
  return new Date(b.start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

// "Nice" axis maximum: 1, 2 or 5 × a power of ten.
function niceMax(v) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const shortInr = (n) => (n >= 1e7 ? `₹${+(n / 1e7).toFixed(1)}Cr`
  : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L`
  : n >= 1e3 ? `₹${+(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : `₹${Math.round(n)}`);

function Change({ now, before }) {
  if (before === null) return null;
  if (!before) return now ? <span className="rp-change">New this period</span> : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="rp-change">No change</span>;
  return (
    <span className={`rp-change ${pct > 0 ? 'rp-change--up' : 'rp-change--down'}`}>
      <span aria-hidden="true">{pct > 0 ? '▲' : '▼'}</span> {pct > 0 ? 'Up' : 'Down'} {Math.abs(pct)}%
    </span>
  );
}

/* ── Sales chart: one series, bars from the baseline, hover/focus tooltip ── */
function SalesChart({ buckets, unit }) {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220, padL = 52, padR = 8, padT = 12, padB = 28;
  const plotW = width - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(...buckets.map((b) => b.sales), 0));
  // 2× maxima split into quarters, 1× and 5× into fifths — always round numbers.
  const lead = Math.round(max / 10 ** Math.floor(Math.log10(max)));
  const steps = lead === 2 ? 4 : 5;
  const ticks = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * max);
  const slot = plotW / buckets.length;
  const barW = Math.max(2, Math.min(28, slot - 2));          // 2px gap between bars
  const labelEvery = Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 64)));
  const y = (v) => padT + plotH - (v / max) * plotH;

  const h = hover !== null ? buckets[hover] : null;
  const tipLeft = h ? Math.min(Math.max(padL + slot * hover + slot / 2, 90), width - 90) : 0;

  return (
    <div className="rp-chart" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={H} role="img" aria-label="Sales over time. Use the table below for exact numbers.">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className={t === 0 ? 'rp-axis' : 'rp-grid'} />
            <text x={padL - 8} y={y(t) + 4} className="rp-tick" textAnchor="end">{shortInr(t)}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = padL + slot * i + (slot - barW) / 2;
          const top = y(b.sales);
          const hgt = padT + plotH - top;
          const r = Math.min(4, barW / 2, hgt);
          return (
            <g key={b.start}>
              {b.sales > 0 && (
                <path
                  className={`rp-bar ${hover === i ? 'rp-bar--on' : ''} ${hover !== null && hover !== i ? 'rp-bar--dim' : ''}`}
                  d={`M${x},${padT + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${padT + plotH} Z`}
                />
              )}
              {/* Hit area: the whole column, so thin bars are easy to hover or tap */}
              <rect
                x={padL + slot * i} y={padT} width={slot} height={plotH}
                fill="transparent" tabIndex={0}
                aria-label={`${bucketTitle(b, unit)}: ${inr(b.sales)}, ${plural(b.orders, 'order')}`}
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                onTouchStart={() => setHover(i)}
              />
              {i % labelEvery === 0 && (
                <text x={padL + slot * i + slot / 2} y={H - 8} className="rp-tick" textAnchor="middle">
                  {bucketLabel(b, unit)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="rp-tip" style={{ left: tipLeft }} role="status">
          <span className="rp-tip-title">{bucketTitle(h, unit)}</span>
          <span className="rp-tip-value">{inr(h.sales)}</span>
          <span className="rp-tip-sub">{plural(h.orders, 'order')}</span>
        </div>
      )}
    </div>
  );
}

// A labelled bar list: name · bar · value. Text stays in ink, the bar shows size.
function BarList({ rows, format = (v) => v, empty }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || !max) return <p className="rp-empty">{empty}</p>;
  return (
    <ul className="rp-bars">
      {rows.map((r) => (
        <li key={r.label} className="rp-bars-row">
          <span className="rp-bars-label">{r.label}</span>
          <span className="rp-bars-track" aria-hidden="true">
            <span className="rp-bars-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="rp-bars-value">{format(r.value)}{r.sub && <span className="rp-bars-sub">{r.sub}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

function downloadCsv(orders, label) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Order', 'Date', 'Status', 'Customer', 'Email', 'City', 'State', 'Pincode', 'Items', 'Subtotal', 'Discount', 'Coupon', 'Delivery', 'Total', 'Courier', 'Tracking'];
  const rows = orders.map((o) => {
    const a = o.shippingAddress || {};
    return [
      String(o._id).slice(-8).toUpperCase(),
      new Date(o.createdAt).toISOString().slice(0, 10),
      o.status,
      a.fullName || o.user?.name || '',
      o.user?.email || o.guest?.email || '',
      a.city, a.state, a.pincode,
      (o.items || []).map((i) => `${i.name} (${i.size}) x${i.qty}`).join('; '),
      o.subtotal, o.discount || 0, o.couponCode || '', o.delivery || 0, orderTotal(o),
      o.shipment?.courier || '', o.shipment?.trackingNumber || '',
    ].map(q).join(',');
  });
  const blob = new Blob(['﻿' + [head.map(q).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `the-reset-orders-${label}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports() {
  const [orders, setOrders]     = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [range, setRange]       = useState('30');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get('/api/orders').catch(() => { setError('Orders could not be loaded. Check that the server is running.'); return { data: [] }; }),
      axios.get('/api/products').catch(() => ({ data: [] })),
    ]).then(([o, p]) => {
      setOrders(Array.isArray(o.data) ? o.data : []);
      setProducts(Array.isArray(p.data) ? p.data : []);
      setLoading(false);
    });
  }, []);

  const r = useMemo(() => {
    const now = Date.now();
    const days = RANGES.find((x) => x.value === range)?.days;
    const firstOrder = orders.reduce((m, o) => Math.min(m, new Date(o.createdAt).getTime()), now);
    const from = days ? startOfDay(now - (days - 1) * DAY) : startOfDay(firstOrder);
    const prevFrom = days ? from - days * DAY : null;

    const inRange = orders.filter((o) => new Date(o.createdAt).getTime() >= from);
    const live = inRange.filter((o) => o.status !== 'Cancelled');
    const prevLive = prevFrom === null ? null : orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= prevFrom && t < from && o.status !== 'Cancelled';
    });

    const sales = live.reduce((s, o) => s + orderTotal(o), 0);
    const items = live.reduce((s, o) => s + (o.items || []).reduce((n, i) => n + (Number(i.qty) || 1), 0), 0);
    const prevSales = prevLive ? prevLive.reduce((s, o) => s + orderTotal(o), 0) : null;
    const prevItems = prevLive ? prevLive.reduce((s, o) => s + (o.items || []).reduce((n, i) => n + (Number(i.qty) || 1), 0), 0) : null;

    const { unit, buckets } = bucketsFor(from, now);
    live.forEach((o) => {
      const t = new Date(o.createdAt).getTime();
      const b = buckets.find((x) => t >= x.start && t < x.end);
      if (b) { b.sales += orderTotal(o); b.orders += 1; }
    });

    // Per product, department and size (item prices, before order discounts).
    const byId = Object.fromEntries(products.map((p) => [String(p._id), p]));
    const prod = {}, dept = {}, size = {};
    live.forEach((o) => (o.items || []).forEach((i) => {
      const qty = Number(i.qty) || 1;
      const rev = toNum(i.price) * qty;
      const id = String(i.product || i.name);
      const p = byId[id];
      prod[id] = prod[id] || { id, name: i.name, image: i.image || p?.image, color: i.color || p?.color, units: 0, revenue: 0, exists: !!p };
      prod[id].units += qty;
      prod[id].revenue += rev;
      const d = p?.category || 'Removed products';
      dept[d] = (dept[d] || 0) + rev;
      if (i.size) size[i.size] = (size[i.size] || 0) + qty;
    }));

    const coupons = {};
    live.filter((o) => o.couponCode).forEach((o) => {
      const c = o.couponCode.toUpperCase().startsWith('WELCOME-') ? 'WELCOME codes (newsletter)' : o.couponCode.toUpperCase();
      coupons[c] = coupons[c] || { code: c, uses: 0, given: 0, sales: 0 };
      coupons[c].uses += 1;
      coupons[c].given += Number(o.discount) || 0;
      coupons[c].sales += orderTotal(o);
    });

    return {
      days, from, inRange, live, sales, items, prevSales, prevItems,
      prevCount: prevLive ? prevLive.length : null,
      avg: live.length ? sales / live.length : 0,
      prevAvg: prevLive && prevLive.length ? prevSales / prevLive.length : (prevLive ? 0 : null),
      cancelled: inRange.length - live.length,
      unit, buckets,
      top: Object.values(prod).sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 8),
      dept: Object.entries(dept).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
      sizes: Object.entries(size)
        .sort((a, b) => (SIZE_ORDER.indexOf(a[0]) + 1 || 99) - (SIZE_ORDER.indexOf(b[0]) + 1 || 99) || a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([label, value]) => ({ label, value })),
      coupons: Object.values(coupons).sort((a, b) => b.uses - a.uses),
    };
  }, [orders, products, range]);

  if (loading) return <div className="loading">Loading reports…</div>;

  const rangeLabel = r.days ? `last ${r.days} days` : 'all time';
  const totalUnits = r.sizes.reduce((n, s) => n + s.value, 0);

  return (
    <div className="rp">
      <div className="rp-head">
        <FilterTabs items={RANGES} value={range} onChange={setRange} />
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => downloadCsv(r.inRange, r.days ? `last-${r.days}-days` : 'all-time')}
          disabled={!r.inRange.length}
        >
          Download orders (CSV)
        </button>
      </div>

      {error && <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>}

      {/* Headline numbers */}
      <div className="panel rp-stats">
        <div className="rp-stat">
          <span className="rp-stat-label">Sales</span>
          <span className="rp-stat-value">{inr(r.sales)}</span>
          <Change now={r.sales} before={r.prevSales} />
        </div>
        <div className="rp-stat">
          <span className="rp-stat-label">Orders</span>
          <span className="rp-stat-value">{r.live.length}</span>
          <Change now={r.live.length} before={r.prevCount} />
        </div>
        <div className="rp-stat">
          <span className="rp-stat-label">Average order</span>
          <span className="rp-stat-value">{inr(r.avg)}</span>
          <Change now={r.avg} before={r.prevAvg} />
        </div>
        <div className="rp-stat">
          <span className="rp-stat-label">Pieces sold</span>
          <span className="rp-stat-value">{r.items}</span>
          <Change now={r.items} before={r.prevItems} />
        </div>
      </div>
      {r.days && <p className="rp-compare">Up / down compares with the {r.days} days before.</p>}

      {/* Sales over time */}
      <section className="panel rp-panel">
        <div className="panel-head">
          <h2 className="panel-title">Sales, {rangeLabel}</h2>
          <button type="button" className="panel-link rp-linkbtn" onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Hide table' : 'Show as table'}
          </button>
        </div>
        {r.live.length === 0 ? (
          <Empty title="No sales in this period" text="Orders that aren't cancelled will show up here." />
        ) : (
          <>
            <SalesChart buckets={r.buckets} unit={r.unit} />
            <p className="rp-note">
              {r.unit === 'day' ? 'Each bar is one day' : r.unit === 'week' ? 'Each bar is one week' : 'Each bar is one month'}.
              {r.cancelled > 0 && ` ${plural(r.cancelled, 'cancelled order')} not counted.`}
            </p>
            {showTable && (
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead><tr><th>{r.unit === 'day' ? 'Day' : r.unit === 'week' ? 'Week' : 'Month'}</th><th>Orders</th><th>Sales</th></tr></thead>
                  <tbody>
                    {r.buckets.filter((b) => b.orders).map((b) => (
                      <tr key={b.start}><td>{bucketTitle(b, r.unit)}</td><td>{b.orders}</td><td>{inr(b.sales)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <div className="rp-cols">
        {/* Best sellers */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Best sellers</h2>
            <Link to="/products" className="panel-link">All products</Link>
          </div>
          {r.top.length === 0 ? (
            <Empty title="Nothing sold yet" text="Your best sellers will show up here." />
          ) : (
            <ol className="rp-top">
              {r.top.map((p, i) => {
                const body = (
                  <>
                    <span className="rp-rank">{i + 1}</span>
                    <Thumb src={p.image} color={p.color} size="sm" />
                    <span className="cell">
                      <span className="cell-main">{p.name}</span>
                      <span className="cell-sub"><span>{plural(p.units, 'piece')}</span></span>
                    </span>
                    <span className="cell-num">{inr(p.revenue)}</span>
                  </>
                );
                return (
                  <li key={p.id}>
                    {p.exists
                      ? <Link to={`/products/edit/${p.id}`} className="row rp-top-row">{body}</Link>
                      : <div className="row rp-top-row">{body}</div>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="rp-stack">
          <section className="panel rp-panel">
            <div className="panel-head"><h2 className="panel-title">Sales by department</h2></div>
            <BarList rows={r.dept} format={inr} empty="No sales in this period." />
          </section>

          <section className="panel rp-panel">
            <div className="panel-head">
              <h2 className="panel-title">Sizes sold</h2>
              <span className="rp-hint">Stock more of what sells</span>
            </div>
            <BarList
              rows={r.sizes.map((s) => ({ ...s, sub: ` · ${Math.round((s.value / (totalUnits || 1)) * 100)}%` }))}
              format={(v) => plural(v, 'piece')}
              empty="No pieces sold in this period."
            />
          </section>
        </div>
      </div>

      {/* Discount codes */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Discount codes used</h2>
          <Link to="/coupons" className="panel-link">Manage codes</Link>
        </div>
        {r.coupons.length === 0 ? (
          <Empty title="No codes used in this period" text="Orders placed with a discount code show up here." />
        ) : (
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead><tr><th>Code</th><th>Orders</th><th>Discount</th><th>Sales</th></tr></thead>
              <tbody>
                {r.coupons.map((c) => (
                  <tr key={c.code}><td className="rp-code">{c.code}</td><td>{c.uses}</td><td>{inr(c.given)}</td><td>{inr(c.sales)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
