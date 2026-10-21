import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  inr, fmtShort, shortId, plural,
  StatusBadge, Thumb, Chevron, Empty,
} from './ui';
import './Dashboard.css';

// A size is "low" when it can still be ordered but only just — 1 to 5 left.
const LOW_THRESHOLD = 5;

const orderTotal = (o) => Number(o.total) || Number(o.subtotal) || 0;
const customerName = (o) => o.shippingAddress?.fullName || o.user?.name || 'Unknown customer';

/*
  A trimmed copy of what the dashboard shows, kept in this browser only.
  No addresses, emails or phone numbers are stored. Cleared on log out.
*/
export const DASH_CACHE_KEY = 'theresetDashCache';

function readCache() {
  try {
    const raw = localStorage.getItem(DASH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(products, orders) {
  try {
    localStorage.setItem(DASH_CACHE_KEY, JSON.stringify({
      products: (products || []).map((p) => ({
        _id: p._id, name: p.name, inStock: p.inStock, stock: p.stock, sizes: p.sizes,
        category: p.category, subcategory: p.subcategory, image: p.image, color: p.color,
      })),
      orders: (orders || []).map((o) => ({
        _id: o._id, status: o.status, createdAt: o.createdAt, total: o.total, subtotal: o.subtotal,
        user: { name: o.user?.name },
        shippingAddress: { fullName: o.shippingAddress?.fullName },
      })),
    }));
  } catch { /* storage full or blocked — the dashboard still works without it */ }
}

const BellIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

function stockProblem(p) {
  const tracked = (p.stock || []).filter((s) => (p.sizes || []).includes(s.size));
  if (tracked.length === 0) return null;
  const total = tracked.reduce((n, s) => n + (Number(s.qty) || 0), 0);
  if (total === 0) return { level: 'out', text: 'Sold out in every size' };
  const out = tracked.filter((s) => s.qty === 0).map((s) => s.size);
  const low = tracked.filter((s) => s.qty > 0 && s.qty <= LOW_THRESHOLD);
  if (!out.length && !low.length) return null;
  const parts = [];
  if (out.length) parts.push(`${out.join(', ')} sold out`);
  if (low.length) parts.push(low.map((s) => `${s.size}: ${s.qty} left`).join(', '));
  return { level: out.length ? 'some-out' : 'low', text: parts.join(' · ') };
}

export default function Dashboard({ name }) {
  // Show the last numbers instantly (saved from the previous visit), then
  // refresh them in the background. No blank screen, nothing jumps.
  const cached = readCache();
  const [products, setProducts] = useState(cached?.products || []);
  const [orders, setOrders]     = useState(cached?.orders || []);
  const [loading, setLoading]   = useState(!cached);
  const [failed, setFailed]     = useState(false);
  // Shoppers who asked "notify me" on a sold-out size: [{ product, name, size, waiting }]
  const [waiting, setWaiting]   = useState([]);
  const [questions, setQuestions] = useState(0);   // shoppers' questions waiting for an answer

  useEffect(() => {
    let ok = true;
    Promise.all([
      axios.get('/api/products').catch(() => { ok = false; return { data: null }; }),
      axios.get('/api/orders').catch(() => { ok = false; return { data: null }; }),
    ]).then(([p, o]) => {
      if (p.data) setProducts(p.data);
      if (o.data) setOrders(o.data);
      setFailed(!ok);
      setLoading(false);
      if (ok) writeCache(p.data, o.data);
    });
    // Extra, not essential: if this fails the dashboard simply doesn't show it.
    axios.get('/api/questions/count')
      .then((res) => setQuestions(Number(res.data?.open) || 0))
      .catch(() => {});
    axios.get('/api/alerts/summary')
      .then((res) => setWaiting(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const isOwner = (() => { try { return (localStorage.getItem('theresetAdminRole') || 'admin') === 'admin'; } catch { return true; } })();
  const hello = (
    <div className="dash-hello">
      <div>
        <p className="dash-greet">{greeting()}{name ? `, ${name}` : ''}</p>
        <p className="dash-date">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
      <Link to="/products/add" className="btn btn--primary only-desktop">Add product</Link>
      {/* Phones have no sidebar: the owner's other pages are reached from here. */}
      <span className="dash-more only-mobile">
        {isOwner && <Link to="/gift-cards" className="panel-link">Gift cards</Link>}
        {isOwner && <Link to="/team" className="panel-link">Team</Link>}
        <Link to="/security" className="panel-link">Security</Link>
      </span>
    </div>
  );

  // The greeting paints straight away; grey placeholders hold the space for the numbers.
  if (loading) {
    return (
      <div className="dash" aria-busy="true">
        {hello}
        <div className={`dash-tasks ${tasks.length === 4 ? 'dash-tasks--4' : ''}`}>
          {[0, 1, 2].map((i) => <div key={i} className="skel skel--task" />)}
        </div>
        <div className="skel skel--sales" />
        <div className="dash-cols">
          <div className="skel skel--panel" />
          <div className="skel skel--panel" />
        </div>
      </div>
    );
  }

  const pending   = orders.filter((o) => o.status === 'Pending');
  const toShip    = orders.filter((o) => o.status === 'Confirmed');
  const live      = orders.filter((o) => o.status !== 'Cancelled');
  const revenue   = live.reduce((s, o) => s + orderTotal(o), 0);
  const weekAgo   = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const lastWeek  = live.filter((o) => new Date(o.createdAt).getTime() >= weekAgo);
  const weekSales = lastWeek.reduce((s, o) => s + orderTotal(o), 0);
  const avgOrder  = live.length ? revenue / live.length : 0;

  // Who is waiting for what, per product: { id: [{ size, waiting }] }
  const waitingBy = {};
  waiting.forEach((w) => {
    const id = String(w.product);
    (waitingBy[id] = waitingBy[id] || []).push({ size: w.size, waiting: w.waiting });
  });
  const waitingFor = (p) => waitingBy[String(p._id)] || [];
  const waitTotal = (p) => waitingFor(p).reduce((n, w) => n + w.waiting, 0);
  const shoppersWaiting = waiting.reduce((n, w) => n + w.waiting, 0);

  // Products running low, plus any product shoppers are waiting on.
  // Most-wanted first, then sold out, then low.
  const levelRank = { out: 0, 'some-out': 1, low: 2 };
  const stockAlerts = products
    .filter((p) => p.inStock || waitTotal(p) > 0)
    .map((p) => ({ product: p, problem: stockProblem(p), wait: waitingFor(p), waitN: waitTotal(p) }))
    .filter((x) => x.problem || x.waitN > 0)
    .sort((a, b) =>
      (b.waitN - a.waitN) ||
      ((levelRank[a.problem?.level] ?? 3) - (levelRank[b.problem?.level] ?? 3)));
  const hidden = products.filter((p) => !p.inStock).length;

  const oldest = (list) =>
    list.length ? list.reduce((a, b) => (new Date(a.createdAt) < new Date(b.createdAt) ? a : b)) : null;

  const recent = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  const tasks = [
    {
      key: 'confirm',
      to: '/orders?status=Pending',
      count: pending.length,
      label: 'Orders to confirm',
      detail: pending.length ? `Oldest waiting since ${fmtShort(oldest(pending).createdAt)}` : 'No new orders waiting',
      tone: 'amber',
    },
    {
      key: 'ship',
      to: '/orders?status=Confirmed',
      count: toShip.length,
      label: 'Orders to pack and ship',
      detail: toShip.length ? `Oldest confirmed on ${fmtShort(oldest(toShip).createdAt)}` : 'Nothing to pack right now',
      tone: 'blue',
    },
    {
      key: 'stock',
      to: '/products',
      count: stockAlerts.length,
      label: 'Products running out',
      detail: shoppersWaiting
        ? `${plural(shoppersWaiting, 'shopper')} waiting for a restock`
        : stockAlerts.length ? 'Restock or hide them from the shop' : 'Every listed product has stock',
      tone: 'red',
    },
  ];
  // Only shown when there's something to answer.
  if (questions > 0) {
    tasks.push({
      key: 'questions', to: '/questions', count: questions, label: 'Questions to answer',
      detail: 'Shoppers asking about fit, fabric or care', tone: 'violet',
    });
  }

  return (
    <div className="dash">
      {hello}

      {failed && (
        <div className="note-error" role="alert">
          <span>Some data could not be loaded. Check that the server is running, then refresh.</span>
        </div>
      )}

      {/* What needs doing */}
      <div className={`dash-tasks ${tasks.length === 4 ? 'dash-tasks--4' : ''}`}>
        {tasks.map((t) => (
          <Link key={t.key} to={t.to} className={`task ${t.count ? `task--${t.tone}` : 'task--clear'}`}>
            <span className="task-count">{t.count}</span>
            <span className="task-text">
              <span className="task-label">{t.label}</span>
              <span className="task-detail">{t.detail}</span>
            </span>
            <Chevron />
          </Link>
        ))}
      </div>

      {/* Sales */}
      <div className="panel dash-sales">
        <div className="sale">
          <span className="sale-label">Total sales</span>
          <span className="sale-value">{inr(revenue)}</span>
          <span className="sale-sub">{plural(live.length, 'order')}, cancellations excluded</span>
        </div>
        <div className="sale">
          <span className="sale-label">Last 7 days</span>
          <span className="sale-value">{inr(weekSales)}</span>
          <span className="sale-sub">{plural(lastWeek.length, 'order')}</span>
        </div>
        <div className="sale">
          <span className="sale-label">Average order</span>
          <span className="sale-value">{inr(avgOrder)}</span>
          <span className="sale-sub">{plural(products.length, 'product')} in the catalogue</span>
        </div>
        <div className="dash-sales-head">
          <h2 className="panel-title">Sales</h2>
          <Link to="/reports" className="panel-link">See reports →</Link>
        </div>
      </div>

      <div className="dash-cols">
        {/* Recent orders */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Latest orders</h2>
            {orders.length > 0 && <Link to="/orders" className="panel-link">All orders</Link>}
          </div>
          {recent.length === 0 ? (
            <Empty title="No orders yet" text="New orders from the shop will show up here." />
          ) : recent.map((o) => (
            <Link key={o._id} to={`/orders?order=${o._id}`} className="row dash-orow">
              <span className="cell">
                <span className="cell-main">{customerName(o)}</span>
                <span className="cell-sub">
                  <span>{shortId(o._id)}</span>
                  <span>{fmtShort(o.createdAt)}</span>
                </span>
              </span>
              <span className="dash-orow-side">
                <span className="cell-num">{inr(orderTotal(o))}</span>
                <StatusBadge status={o.status} />
              </span>
            </Link>
          ))}
        </section>

        {/* Stock */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Stock to check</h2>
            <Link to="/products" className="panel-link">All products</Link>
          </div>
          {stockAlerts.length === 0 ? (
            <Empty
              title="Stock looks healthy"
              text={hidden ? `${plural(hidden, 'product')} hidden from the shop.` : 'No listed product is low or sold out.'}
            />
          ) : (
            <>
              {stockAlerts.slice(0, 7).map(({ product: p, problem, wait, waitN }) => (
                <Link key={p._id} to={`/products/edit/${p._id}`} className="row dash-srow">
                  <Thumb src={p.image} color={p.color} size="sm" />
                  <span className="cell">
                    <span className="cell-main">{p.name}</span>
                    {problem && (
                      <span className={`dash-stock dash-stock--${problem.level}`}>{problem.text}</span>
                    )}
                    {waitN > 0 && (
                      <span className="dash-wait">
                        <BellIcon />
                        {plural(waitN, 'shopper')} waiting
                        <span className="dash-wait-sizes">
                          {wait.map((w) => `${w.size}${w.waiting > 1 ? ` ×${w.waiting}` : ''}`).join(' · ')}
                        </span>
                      </span>
                    )}
                    {!p.inStock && <span className="dash-stock dash-stock--hidden">Hidden from the shop</span>}
                  </span>
                  <Chevron />
                </Link>
              ))}
              {shoppersWaiting > 0 && (
                <p className="dash-hidden">
                  Waiting shoppers are emailed automatically when you add stock to their size.
                </p>
              )}
              {hidden > 0 && (
                <p className="dash-hidden">{plural(hidden, 'product')} hidden from the shop.</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
