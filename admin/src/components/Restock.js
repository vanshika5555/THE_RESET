import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { plural, FilterTabs, Empty, ErrorNote, Thumb } from './ui';
import { plan, daysText } from '../utils/restock';
import './Restock.css';

/*
  Restock plan: which sizes to reorder, and how many, from how fast each one
  sold recently. Also the slow movers — stock that hasn't sold at all.
*/

const PERIODS = [30, 60, 90];
const COVERS = [30, 45, 60];
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40'];
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(String(s).toUpperCase()); return i === -1 ? 99 : i; };
const RANK = { out: 0, soon: 1, ok: 2, slow: 3, empty: 4 };

function downloadCsv(rows, cover) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Product', 'Department', 'Type', 'Size', 'Left now', 'Sold', 'Waiting shoppers', `Order (for ${cover} days)`];
  const lines = rows.map((r) => [r.name, r.category, r.subcategory, r.size, r.left, r.sold, r.waiting, r.order].map(q).join(','));
  const blob = new Blob(['﻿' + [head.map(q).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `the-reset-restock-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const pick = (key, fallback, list) => {
  try { const v = Number(localStorage.getItem(key)); return list.includes(v) ? v : fallback; } catch { return fallback; }
};
const keep = (key, v) => { try { localStorage.setItem(key, String(v)); } catch { /* fine */ } };

export default function Restock() {
  const [days, setDays] = useState(() => pick('theresetRestockDays', 30, PERIODS));
  const [cover, setCover] = useState(() => pick('theresetRestockCover', 30, COVERS));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('order');

  useEffect(() => {
    setData(null); setError('');
    axios.get('/api/products/restock', { params: { days } })
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the restock plan.'));
  }, [days]);

  const planned = useMemo(() => (data?.rows || []).map((r) => plan(r, cover)), [data, cover]);

  const groups = useMemo(() => {
    const want = planned.filter((p) => (tab === 'order' ? p.order > 0 : tab === 'slow' ? p.status === 'slow' : true));
    const byProduct = new Map();
    for (const p of want) {
      const g = byProduct.get(String(p.product)) || { id: String(p.product), name: p.name, image: p.image, color: p.color, sub: `${p.category} · ${p.subcategory}`, upcoming: p.upcoming, sizes: [] };
      g.sizes.push(p);
      byProduct.set(g.id, g);
    }
    const list = [...byProduct.values()];
    list.forEach((g) => {
      g.sizes.sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
      g.rank = Math.min(...g.sizes.map((s) => RANK[s.status]));
      g.soonest = Math.min(...g.sizes.map((s) => (s.status === 'out' ? -1 : s.daysLeft ?? 9999)));
      g.order = g.sizes.reduce((n, s) => n + s.order, 0);
      g.left = g.sizes.reduce((n, s) => n + s.left, 0);
      g.sold = g.sizes.reduce((n, s) => n + s.sold, 0);
    });
    if (tab === 'slow') list.sort((a, b) => b.left - a.left);
    else list.sort((a, b) => a.rank - b.rank || a.soonest - b.soonest || b.sold - a.sold);
    return list;
  }, [planned, tab]);

  const toOrder = planned.filter((p) => p.order > 0);
  const slow = planned.filter((p) => p.status === 'slow');
  const pieces = toOrder.reduce((n, p) => n + p.order, 0);
  const slowPieces = slow.reduce((n, p) => n + p.left, 0);
  const outCount = planned.filter((p) => p.status === 'out').length;

  const tabs = [
    { value: 'order', label: 'To reorder', count: toOrder.length },
    { value: 'slow', label: 'Not selling', count: slow.length },
    { value: 'all', label: 'All sizes', count: planned.length },
  ];

  return (
    <div className="rs">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="rs-controls">
        <label className="rs-pick">
          <span>Based on sales from the last</span>
          <select className="select" value={days} onChange={(e) => { const v = Number(e.target.value); setDays(v); keep('theresetRestockDays', v); }}>
            {PERIODS.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
        <label className="rs-pick">
          <span>Order enough to last</span>
          <select className="select" value={cover} onChange={(e) => { const v = Number(e.target.value); setCover(v); keep('theresetRestockCover', v); }}>
            {COVERS.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
        <button type="button" className="btn btn--secondary rs-csv" disabled={!toOrder.length} onClick={() => downloadCsv(toOrder, cover)}>
          Download order list
        </button>
      </div>

      {data && (
        <div className="rs-summary">
          <div className="rs-stat">
            <span className="rs-stat-num">{pieces}</span>
            <span className="rs-stat-label">{pieces === 1 ? 'piece' : 'pieces'} to order across {plural(toOrder.length, 'size')}</span>
          </div>
          <div className="rs-stat">
            <span className="rs-stat-num">{outCount}</span>
            <span className="rs-stat-label">{outCount === 1 ? 'size' : 'sizes'} sold out that people still want</span>
          </div>
          <div className="rs-stat">
            <span className="rs-stat-num">{slowPieces}</span>
            <span className="rs-stat-label">{slowPieces === 1 ? 'piece' : 'pieces'} with no sale in {days} days</span>
          </div>
        </div>
      )}

      <div className="rs-tabs"><FilterTabs items={tabs} value={tab} onChange={setTab} /></div>

      {!data && !error ? (
        <div className="panel"><div className="loading">Working out the plan…</div></div>
      ) : groups.length === 0 ? (
        <div className="panel">
          <Empty
            title={tab === 'order' ? 'Nothing to reorder' : tab === 'slow' ? 'Everything is selling' : 'No stock tracked yet'}
            text={tab === 'order' ? `Every size has enough for the next ${cover} days at the current pace.` : tab === 'slow' ? `Every size in stock sold at least once in the last ${days} days.` : 'Add stock counts to your products and they appear here.'}
          />
        </div>
      ) : (
        <div className="rs-list">
          {groups.map((g) => (
            <section key={g.id} className="panel rs-card">
              <Link to={`/products/edit/${g.id}`} className="rs-head">
                <Thumb src={g.image} color={g.color} size="sm" />
                <span className="rs-head-text">
                  <span className="rs-name">{g.name}</span>
                  <span className="rs-sub">{g.sub}{g.upcoming ? ' · upcoming drop' : ''}</span>
                </span>
                {tab !== 'slow' && g.order > 0 && <span className="rs-head-order">Order {g.order}</span>}
              </Link>
              <table className="rs-table">
                <thead>
                  <tr>
                    <th scope="col">Size</th>
                    <th scope="col">Left</th>
                    <th scope="col">Sold</th>
                    <th scope="col">Runs out in</th>
                    <th scope="col" className="rs-col-order">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {g.sizes.map((s) => (
                    <tr key={s.size}>
                      <td className="rs-size">{s.size}</td>
                      <td className="rs-num">{s.left}</td>
                      <td className="rs-num">{s.sold}</td>
                      <td>
                        <span className={`rs-days rs-days--${s.status}`}>{s.status === 'slow' ? `No sales` : daysText(s)}</span>
                        {s.waiting > 0 && <span className="rs-wait">{plural(s.waiting, 'shopper')} waiting</span>}
                      </td>
                      <td className="rs-num rs-col-order"><strong>{s.order || '—'}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {data && (
        <p className="rs-fine">
          Sold counts every order from the last {days} days except cancelled and unpaid ones; pieces added more recently are judged on the days they’ve been in the shop (at least a week).
          Order = enough for {cover} days at that pace, less what’s left.
        </p>
      )}
    </div>
  );
}
