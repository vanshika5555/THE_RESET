import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  inr, fmtDate, fmtShort, fmtLong, shortId, plural,
  STATUSES, NEXT_STEP,
  StatusBadge, StatusRail, SearchInput, FilterTabs, Empty, ErrorNote,
  Thumb, Chevron, Drawer, Section,
} from './ui';
import './AdminOrders.css';

const fullAddress = (a) =>
  [a?.houseNo, a?.address, a?.landmark, a?.city, a?.state].filter(Boolean).join(', ');

const itemCount = (o) => (o.items || []).reduce((n, i) => n + (Number(i.qty) || 1), 0);
const orderTotal = (o) => Number(o.total) || Number(o.subtotal) || 0;
const customerName = (o) => o.shippingAddress?.fullName || o.user?.name || 'Unknown customer';

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [copied, setCopied]   = useState(false);
  const [noteDraft, setNoteDraft] = useState(null);   // null = not editing
  const [savingNote, setSavingNote] = useState(false);

  const filter  = params.get('status') || 'All';
  const openId  = params.get('order');

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: key === 'status' });
  };

  useEffect(() => {
    axios.get('/api/orders')
      .then((res) => { setOrders(res.data || []); setError(''); })
      .catch(() => setError('Orders could not be loaded. Check that the server is running.'))
      .finally(() => setLoading(false));
  }, []);

  // Reset panel-only state whenever a different order opens.
  useEffect(() => { setNoteDraft(null); setCopied(false); }, [openId]);

  const closePanel = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('order');
    setParams(next);
  }, [params, setParams]);

  const updateStatus = async (id, status) => {
    const previous = orders.find((o) => o._id === id)?.status;
    setOrders((list) => list.map((o) => (o._id === id ? { ...o, status } : o)));
    setError('');
    try {
      await axios.put(`/api/orders/${id}/status`, { status });
    } catch (err) {
      setOrders((list) => list.map((o) => (o._id === id ? { ...o, status: previous } : o)));
      setError(err.response?.data?.message || `The order could not be moved to ${status}. Try again.`);
    }
  };

  const cancelOrder = (o) => {
    if (window.confirm(`Cancel order ${shortId(o._id)} for ${customerName(o)}? The customer will see it as cancelled.`)) {
      updateStatus(o._id, 'Cancelled');
    }
  };

  // Everything a courier needs, ready to paste into a label.
  const copyAddress = (order) => {
    const a = order.shippingAddress || {};
    const text = [a.fullName, fullAddress(a), a.pincode, `Phone: ${a.phone || ''}`]
      .filter(Boolean).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })
      .catch(() => setError('The address could not be copied. Select it and copy it by hand.'));
  };

  const saveNote = async (order) => {
    setSavingNote(true);
    try {
      await axios.put(`/api/orders/${order._id}/note`, { note: noteDraft ?? '' });
      setOrders((list) => list.map((o) => (o._id === order._id ? { ...o, adminNote: noteDraft ?? '' } : o)));
      setNoteDraft(null);
    } catch {
      setError('The note was not saved. Try again.');
    }
    setSavingNote(false);
  };

  // A simple packing slip in a new window, ready to print.
  const printSlip = (order) => {
    const a = order.shippingAddress || {};
    const rows = order.items.map((i) => `
      <tr>
        <td>${i.name}</td>
        <td>${i.size || '-'}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">${i.price || ''}</td>
      </tr>`).join('');

    const html = `
      <html>
        <head>
          <title>Packing slip ${shortId(order._id)}</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; color: #111; }
            h1 { font-size: 20px; letter-spacing: .2em; margin: 0 0 4px; }
            .sub { color: #555; font-size: 13px; margin-bottom: 26px; }
            .box { border: 1px solid #ccc; padding: 16px; margin-bottom: 20px; border-radius: 6px; }
            .label { font-size: 12px; color: #555; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
            th { text-align: left; font-size: 12px; color: #555; border-bottom: 1px solid #ccc; padding: 8px 6px; }
            td { padding: 9px 6px; border-bottom: 1px solid #eee; font-size: 14px; }
            .totals { margin-left: auto; width: 260px; font-size: 14px; }
            .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
            .totals .grand { border-top: 1px solid #ccc; margin-top: 6px; padding-top: 10px; font-weight: 700; }
            .foot { margin-top: 30px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <h1>THE RESET</h1>
          <p class="sub">Packing slip · Order ${shortId(order._id)} · ${fmtDate(order.createdAt)}</p>
          <div class="box">
            <div class="label">Deliver to</div>
            <div><strong>${a.fullName || ''}</strong></div>
            <div>${fullAddress(a)}</div>
            <div>${a.pincode || ''}</div>
            <div>Phone: ${a.phone || '—'}</div>
          </div>
          <table>
            <thead><tr><th>Item</th><th>Size</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal</span><span>${inr(order.subtotal)}</span></div>
            ${order.discount ? `<div><span>Discount ${order.couponCode ? '(' + order.couponCode + ')' : ''}</span><span>− ${inr(order.discount)}</span></div>` : ''}
            <div><span>Delivery</span><span>${order.delivery ? inr(order.delivery) : 'Free'}</span></div>
            <div class="grand"><span>Total</span><span>${inr(orderTotal(order))}</span></div>
          </div>
          <p class="foot">Thank you for shopping with THE RESET.</p>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>`;

    const w = window.open('', '_blank', 'width=760,height=900');
    if (!w) {
      setError('The browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  /* ── filtering ── */
  const counts = useMemo(() => {
    const c = { All: orders.length };
    STATUSES.forEach((s) => { c[s] = orders.filter((o) => o.status === s).length; });
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const byStatus = filter === 'All' ? orders : orders.filter((o) => o.status === filter);
    const q = search.trim().toLowerCase();
    const list = !q ? byStatus : byStatus.filter((o) => {
      const a = o.shippingAddress || {};
      return (
        o._id.toLowerCase().includes(q.replace('#', '')) ||
        (o.user?.name || '').toLowerCase().includes(q) ||
        (o.user?.email || '').toLowerCase().includes(q) ||
        (a.fullName || '').toLowerCase().includes(q) ||
        (a.phone || '').includes(q) ||
        (a.pincode || '').includes(q) ||
        (a.city || '').toLowerCase().includes(q)
      );
    });
    return [...list].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
  }, [orders, filter, search]);

  const open = orders.find((o) => o._id === openId) || null;

  const tabs = [
    { value: 'All', label: 'All', count: counts.All },
    { value: 'Pending', label: 'Pending', count: counts.Pending },
    { value: 'Confirmed', label: 'Confirmed', count: counts.Confirmed },
    { value: 'Shipped', label: 'Shipped', count: counts.Shipped },
    { value: 'Delivered', label: 'Delivered', count: counts.Delivered },
    { value: 'Cancelled', label: 'Cancelled', count: counts.Cancelled },
  ];

  const hint = {
    Pending: 'New orders. Check stock, then confirm them.',
    Confirmed: 'Confirmed orders waiting to be packed and handed to the courier.',
    Shipped: 'With the courier. Mark them delivered once they arrive.',
  }[filter];

  return (
    <div className="orders">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="toolbar">
        <div className="toolbar-grow">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, phone or pincode"
          />
        </div>
        <span className="orders-summary only-desktop">
          {plural(orders.length, 'order')} · {inr(orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + orderTotal(o), 0))} in sales
        </span>
      </div>

      <div className="orders-tabs">
        <FilterTabs items={tabs} value={filter} onChange={(v) => setParam('status', v === 'All' ? '' : v)} />
      </div>

      {hint && <p className="page-intro orders-hint">{hint}</p>}

      <div className="panel">
        {loading ? (
          <div className="loading">Loading orders…</div>
        ) : visible.length === 0 ? (
          <Empty
            title={orders.length === 0 ? 'No orders yet' : search ? 'No orders match your search' : `No ${filter.toLowerCase()} orders`}
            text={orders.length === 0
              ? 'Orders from the shop will appear here as soon as customers check out.'
              : search ? 'Try a phone number, pincode or the last digits of the order number.' : 'Nothing is waiting here right now.'}
          />
        ) : (
          <>
            <div className="list-head orow-grid only-desktop">
              <span>Customer</span>
              <span>Progress</span>
              <span>Placed</span>
              <span className="cell-right">Total</span>
              <span />
            </div>

            {visible.map((o) => (
              <button
                key={o._id}
                type="button"
                className={`row orow orow-grid ${openId === o._id ? 'row--active' : ''}`}
                onClick={() => setParam('order', o._id)}
              >
                <span className="cell orow-cust">
                  <span className="cell-main">{customerName(o)}</span>
                  <span className="cell-sub">
                    <span>{shortId(o._id)}</span>
                    <span>{plural(itemCount(o), 'item')}</span>
                    {o.shippingAddress?.city && <span>{o.shippingAddress.city}</span>}
                    <span className="only-mobile">{fmtShort(o.createdAt)}</span>
                  </span>
                </span>

                <span className="cell orow-status">
                  <StatusBadge status={o.status} />
                  <span className="orow-rail"><StatusRail status={o.status} /></span>
                </span>

                <span className="cell cell-muted orow-date only-desktop">{fmtDate(o.createdAt)}</span>

                <span className="cell cell-num orow-total">{inr(orderTotal(o))}</span>

                <span className="orow-chev only-desktop"><Chevron /></span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Order panel ── */}
      <Drawer
        open={!!open}
        onClose={closePanel}
        title={open ? `Order ${shortId(open._id)}` : ''}
        subtitle={open ? `Placed ${fmtLong(open.createdAt)}` : ''}
        footer={open && (NEXT_STEP[open.status] || !['Delivered', 'Cancelled'].includes(open.status)) && (
          <>
            {!['Delivered', 'Cancelled'].includes(open.status) && (
              <button type="button" className="btn btn--danger btn--lg od-cancel" onClick={() => cancelOrder(open)}>
                Cancel order
              </button>
            )}
            {NEXT_STEP[open.status] && (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => updateStatus(open._id, NEXT_STEP[open.status].to)}
              >
                {NEXT_STEP[open.status].label}
              </button>
            )}
          </>
        )}
      >
        {open && (() => {
          const a = open.shippingAddress || {};
          return (
            <>
              <Section
                title="Progress"
                aside={<StatusBadge status={open.status} />}
              >
                <StatusRail status={open.status} labelled />
                <div className="od-status-row">
                  <label className="od-status-label" htmlFor="od-status">Change status</label>
                  <select
                    id="od-status"
                    className="select od-status-select"
                    value={open.status}
                    onChange={(e) => updateStatus(open._id, e.target.value)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </Section>

              <Section title="Deliver to">
                <div className="od-address">
                  <p className="od-name">{a.fullName || customerName(open)}</p>
                  <p>{fullAddress(a)}</p>
                  <p>{a.pincode}</p>
                  {a.phone && <p className="od-phone">+91 {a.phone}</p>}
                </div>
                <div className="od-actions">
                  {a.phone && (
                    <a className="btn btn--secondary" href={`tel:${a.phone}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
                      Call
                    </a>
                  )}
                  <button type="button" className="btn btn--secondary" onClick={() => copyAddress(open)}>
                    {copied ? 'Copied' : 'Copy address'}
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={() => printSlip(open)}>
                    Print packing slip
                  </button>
                </div>
              </Section>

              <Section title={`Items (${itemCount(open)})`}>
                <ul className="od-items">
                  {open.items.map((it, i) => (
                    <li key={i} className="od-item">
                      <Thumb src={it.image} color={it.color} size="md" />
                      <span className="od-item-info">
                        <span className="od-item-name">{it.name}</span>
                        <span className="od-item-meta">Size {it.size || '—'} · Qty {it.qty}</span>
                      </span>
                      <span className="od-item-price">{it.price}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Payment">
                <dl className="kv">
                  <dt>Subtotal</dt><dd>{inr(open.subtotal)}</dd>
                  {open.discount > 0 && (
                    <>
                      <dt>Discount{open.couponCode ? ` (${open.couponCode})` : ''}</dt>
                      <dd className="kv-good">− {inr(open.discount)}</dd>
                    </>
                  )}
                  <dt>Delivery</dt><dd>{open.delivery ? inr(open.delivery) : 'Free'}</dd>
                  <dt className="kv-total">Total</dt><dd className="kv-total">{inr(orderTotal(open))}</dd>
                </dl>
              </Section>

              <Section title="Customer account">
                <div className="od-account">
                  <span className="od-account-name">{open.user?.name || 'Guest'}</span>
                  {open.user?.email && <span className="od-account-email">{open.user.email}</span>}
                </div>
                {open.user && (
                  <button type="button" className="btn btn--ghost btn--sm od-account-link" onClick={() => navigate(`/customers?q=${encodeURIComponent(open.user.email || open.user.name || '')}`)}>
                    See all their orders
                  </button>
                )}
              </Section>

              <Section title="Internal note">
                <p className="od-note-hint">Only you can see this. Customers never do.</p>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Packing reminders, calls with the customer, delivery instructions…"
                  value={noteDraft ?? open.adminNote ?? ''}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                {noteDraft !== null && noteDraft !== (open.adminNote ?? '') && (
                  <div className="od-note-actions">
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => saveNote(open)} disabled={savingNote}>
                      {savingNote ? 'Saving…' : 'Save note'}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNoteDraft(null)}>
                      Discard
                    </button>
                  </div>
                )}
              </Section>
            </>
          );
        })()}
      </Drawer>
    </div>
  );
}