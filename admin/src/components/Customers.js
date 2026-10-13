import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  inr, fmtDate, fmtShort, shortId, plural,
  StatusBadge, SearchInput, FilterTabs, Empty, ErrorNote, Chevron, Drawer, Section,
} from './ui';
import './Customers.css';

const orderTotal = (o) => Number(o.total) || Number(o.subtotal) || 0;

function Avatar({ name }) {
  return <span className="cu-avatar" aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>;
}

export default function Customers() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [users, setUsers]     = useState([]);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState(params.get('q') || '');
  const [filter, setFilter]   = useState('All');
  const [openId, setOpenId]   = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get('/api/auth/users').catch(() => { setError('Customers could not be loaded. Check that the server is running.'); return { data: [] }; }),
      axios.get('/api/orders').catch(() => ({ data: [] })),
    ]).then(([u, o]) => {
      setUsers(u.data || []);
      setOrders(o.data || []);
      setLoading(false);
    });
  }, []);

  // Per-customer summary from their orders
  const summaries = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      const mine = orders
        .filter((o) => (o.user?._id || o.user) === u._id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const live = mine.filter((o) => o.status !== 'Cancelled');
      map[u._id] = {
        orders: mine,
        count: mine.length,
        spent: live.reduce((s, o) => s + orderTotal(o), 0),
        last: mine[0] || null,
      };
    });
    return map;
  }, [users, orders]);

  const customers = users.filter((u) => u.role !== 'admin');
  const sum = (u) => summaries[u._id] || { orders: [], count: 0, spent: 0, last: null };

  const counts = {
    All: customers.length,
    Buyers: customers.filter((u) => sum(u).count > 0).length,
    Never: customers.filter((u) => sum(u).count === 0).length,
    Bag: customers.filter((u) => (u.cart || []).length > 0).length,
  };

  const visible = useMemo(() => {
    let list = customers;
    if (filter === 'Buyers') list = list.filter((u) => sum(u).count > 0);
    if (filter === 'Never')  list = list.filter((u) => sum(u).count === 0);
    if (filter === 'Bag')    list = list.filter((u) => (u.cart || []).length > 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    return [...list].sort((a, b) => sum(b).spent - sum(a).spent || new Date(b.createdAt) - new Date(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, filter, search, summaries]);

  const open = customers.find((u) => u._id === openId) || null;
  const os = open ? sum(open) : null;

  const tabs = [
    { value: 'All', label: 'All', count: counts.All },
    { value: 'Buyers', label: 'Have ordered', count: counts.Buyers },
    { value: 'Never', label: 'Not ordered yet', count: counts.Never },
    { value: 'Bag', label: 'Items in bag', count: counts.Bag },
  ];

  return (
    <div className="customers">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="toolbar">
        <div className="toolbar-grow">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email" />
        </div>
      </div>

      <div className="customers-tabs">
        <FilterTabs items={tabs} value={filter} onChange={setFilter} />
      </div>

      {filter === 'Bag' && (
        <p className="page-intro">These customers left something in their bag. A friendly nudge can turn it into an order.</p>
      )}

      <div className="panel">
        {loading ? (
          <div className="loading">Loading customers…</div>
        ) : visible.length === 0 ? (
          <Empty
            title={customers.length === 0 ? 'No customers yet' : 'No customers match'}
            text={customers.length === 0 ? 'People who create an account in the shop will appear here.' : 'Try another name or email.'}
          />
        ) : (
          <>
            <div className="list-head curow-grid only-desktop">
              <span>Customer</span>
              <span>Joined</span>
              <span className="cell-right">Orders</span>
              <span className="cell-right">Spent</span>
              <span>Last order</span>
              <span />
            </div>
            {visible.map((u) => {
              const s = sum(u);
              return (
                <button key={u._id} type="button" className={`row curow-grid ${openId === u._id ? 'row--active' : ''}`} onClick={() => setOpenId(u._id)}>
                  <span className="cell cu-who">
                    <Avatar name={u.name} />
                    <span className="cell">
                      <span className="cell-main">{u.name || 'No name'}</span>
                      <span className="cu-email">{u.email}</span>
                    </span>
                  </span>
                  <span className="cell cell-muted only-desktop">{fmtDate(u.createdAt)}</span>
                  <span className="cell cell-right only-desktop cu-num">{s.count}</span>
                  <span className="cell cell-right only-desktop cu-num">{inr(s.spent)}</span>
                  <span className="cell cell-muted only-desktop">{s.last ? fmtDate(s.last.createdAt) : 'Never'}</span>
                  <span className="only-desktop"><Chevron /></span>

                  <span className="cu-mobile-side only-mobile">
                    <span className="cu-num">{s.count ? inr(s.spent) : 'No orders'}</span>
                    {s.count > 0 && <span className="cu-mobile-count">{plural(s.count, 'order')}</span>}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>

      <p className="cu-privacy">
        Passwords are stored encrypted, so nobody can see them, including you. If a customer is locked out,
        they need a password reset from the shop.
      </p>

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.name || 'Customer'}
        subtitle={open?.email}
        footer={open?.email && (
          <a className="btn btn--secondary btn--lg" href={`mailto:${open.email}`}>Email {open.name ? open.name.split(' ')[0] : 'customer'}</a>
        )}
      >
        {open && (
          <>
            <Section>
              <div className="cu-stats">
                <div><span className="cu-stat-value">{os.count}</span><span className="cu-stat-label">{os.count === 1 ? 'Order' : 'Orders'}</span></div>
                <div><span className="cu-stat-value">{inr(os.spent)}</span><span className="cu-stat-label">Spent</span></div>
                <div><span className="cu-stat-value">{fmtShort(open.createdAt) || '—'}</span><span className="cu-stat-label">Joined</span></div>
              </div>
            </Section>

            <Section title={`In their bag (${(open.cart || []).length})`}>
              {(open.cart || []).length === 0 ? (
                <p className="cu-none">Their bag is empty.</p>
              ) : (
                <ul className="cu-list">
                  {open.cart.map((c, i) => (
                    <li key={i}>
                      <span>{c.name}</span>
                      <span className="cu-list-meta">{[c.size && `Size ${c.size}`, c.qty > 1 && `× ${c.qty}`].filter(Boolean).join(' ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Wishlist (${(open.wishlist || []).length})`}>
              {(open.wishlist || []).length === 0 ? (
                <p className="cu-none">Nothing saved.</p>
              ) : (
                <ul className="cu-list">
                  {open.wishlist.map((w, i) => <li key={i}><span>{w?.name || 'A product that was removed'}</span></li>)}
                </ul>
              )}
            </Section>

            <Section title="Recently looked at">
              {(open.viewed || []).length === 0 ? (
                <p className="cu-none">No visits recorded.</p>
              ) : (
                <ul className="cu-list">
                  {open.viewed.slice(0, 6).map((v, i) => (
                    <li key={i}>
                      <span>{v.product?.name || 'A product that was removed'}</span>
                      {v.count > 1 && <span className="cu-list-meta">{v.count} visits</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Orders (${os.count})`}>
              {os.count === 0 ? (
                <p className="cu-none">Signed up but hasn’t ordered yet.</p>
              ) : (
                <div className="cu-orders">
                  {os.orders.map((o) => (
                    <button key={o._id} type="button" className="cu-order" onClick={() => navigate(`/orders?order=${o._id}`)}>
                      <span className="cell">
                        <span className="cu-order-top">{shortId(o._id)}<span>{fmtDate(o.createdAt)}</span></span>
                        <span className="cu-order-items">{(o.items || []).map((it) => it.name).join(', ')}</span>
                      </span>
                      <span className="cu-order-side">
                        <span className="cu-num">{inr(orderTotal(o))}</span>
                        <StatusBadge status={o.status} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </Drawer>
    </div>
  );
}