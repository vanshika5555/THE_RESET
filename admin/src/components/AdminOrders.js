import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminOrders.css';

const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

const STATUS_COLORS = {
  Pending:   '#f59e0b',
  Confirmed: '#3b82f6',
  Shipped:   '#8b5cf6',
  Delivered: '#22c55e',
  Cancelled: '#ef4444',
};

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');

const fullAddress = (a) =>
  [a?.houseNo, a?.address, a?.landmark, a?.city, a?.state]
    .filter(Boolean).join(', ');

export default function AdminOrders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('All');
  const [search, setSearch]   = useState('');
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(null);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`/api/orders`);
      setOrders(res.data);
      setError('');
    } catch {
      setError('Could not load orders. Check the backend is running.');
    }
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    const previous = orders.find(o => o._id === id)?.status;
    setOrders(list => list.map(o => (o._id === id ? { ...o, status } : o)));
    setError('');
    try {
      await axios.put(`/api/orders/${id}/status`, { status });
    } catch (err) {
      setOrders(list => list.map(o => (o._id === id ? { ...o, status: previous } : o)));
      setError(err.response?.data?.message || 'Could not update that order.');
    }
  };

  // Everything a courier needs, ready to paste into a label.
  const copyAddress = (order) => {
    const a = order.shippingAddress || {};
    const text = [
      a.fullName,
      fullAddress(a),
      `${a.pincode || ''}`,
      `Phone: ${a.phone || ''}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(order._id);
        setTimeout(() => setCopied(null), 1800);
      })
      .catch(() => setError('Could not copy — select the address manually.'));
  };

  // A simple packing slip in a new window, ready to print.
  const printSlip = (order) => {
    const a = order.shippingAddress || {};
    const rows = order.items.map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.size || '-'}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">${i.price || ''}</td>
      </tr>`).join('');

    const html = `
      <html>
        <head>
          <title>Packing Slip #${order._id.slice(-8).toUpperCase()}</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; color: #111; }
            h1 { font-size: 20px; letter-spacing: .1em; margin: 0 0 4px; }
            .sub { color: #777; font-size: 13px; margin-bottom: 26px; }
            .box { border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; }
            .label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #888; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
                 color: #888; border-bottom: 1px solid #ddd; padding: 8px 6px; }
            td { padding: 9px 6px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
            .totals { margin-left: auto; width: 260px; font-size: 14px; }
            .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
            .totals .grand { border-top: 1px solid #ddd; margin-top: 6px; padding-top: 10px; font-weight: 700; }
            .foot { margin-top: 30px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <h1>THE RESET</h1>
          <p class="sub">
            Packing slip · Order #${order._id.slice(-8).toUpperCase()} ·
            ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div class="box">
            <div class="label">Deliver to</div>
            <div><strong>${a.fullName || ''}</strong></div>
            <div>${fullAddress(a)}</div>
            <div>${a.pincode || ''}</div>
            <div>Phone: ${a.phone || '—'}</div>
          </div>

          <table>
            <thead>
              <tr><th>Item</th><th>Size</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="totals">
            <div><span>Subtotal</span><span>${inr(order.subtotal)}</span></div>
            ${order.discount ? `<div><span>Discount ${order.couponCode ? '(' + order.couponCode + ')' : ''}</span><span>− ${inr(order.discount)}</span></div>` : ''}
            <div><span>Delivery</span><span>${order.delivery ? inr(order.delivery) : 'FREE'}</span></div>
            <div class="grand"><span>Total</span><span>${inr(order.total || order.subtotal)}</span></div>
          </div>

          <p class="foot">Thank you for shopping with THE RESET.</p>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>`;

    const w = window.open('', '_blank', 'width=760,height=900');
    if (!w) {
      setError('Your browser blocked the print window. Allow pop-ups for this site.');
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const byStatus = filter === 'All' ? orders : orders.filter(o => o.status === filter);

  const filtered = search.trim()
    ? byStatus.filter(o => {
        const q = search.toLowerCase();
        const a = o.shippingAddress || {};
        return (
          o._id.toLowerCase().includes(q) ||
          (o.user?.name || '').toLowerCase().includes(q) ||
          (o.user?.email || '').toLowerCase().includes(q) ||
          (a.phone || '').includes(q) ||
          (a.pincode || '').includes(q) ||
          (a.city || '').toLowerCase().includes(q)
        );
      })
    : byStatus;

  const revenue = orders
    .filter(o => o.status !== 'Cancelled')
    .reduce((s, o) => s + (o.total || o.subtotal || 0), 0);

  return (
    <div className="ao-page">
      <div className="ao-header">
        <div>
          <h1 className="ao-title">Orders</h1>
          <p className="ao-count">
            {orders.length} orders · {inr(revenue)} revenue
          </p>
        </div>
      </div>

      {error && <div className="ao-error">{error}</div>}

      <div className="ao-tabs">
        {['All', ...STATUSES].map(s => (
          <button
            key={s}
            className={`ao-tab ${filter === s ? 'ao-tab--active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s} ({s === 'All' ? orders.length : orders.filter(o => o.status === s).length})
          </button>
        ))}
      </div>

      <input
        className="ao-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by order ID, name, email, phone, pincode or city..."
      />

      {loading ? (
        <p className="ao-loading">Loading orders...</p>
      ) : filtered.length === 0 ? (
        <div className="ao-empty">
          {orders.length === 0 ? 'No orders yet.' : 'No orders match that search.'}
        </div>
      ) : (
        <div className="ao-list">
          {filtered.map(order => {
            const a = order.shippingAddress || {};
            return (
              <div key={order._id} className="ao-card">
                <div className="ao-card-header">
                  <div className="ao-order-meta">
                    <span className="ao-order-id">#{order._id.slice(-8).toUpperCase()}</span>
                    <span className="ao-order-date">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="ao-customer">
                    <span className="ao-customer-name">{order.user?.name || 'Unknown'}</span>
                    <span className="ao-customer-email">{order.user?.email || ''}</span>
                  </div>
                  <div className="ao-status-control">
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order._id, e.target.value)}
                      className="ao-status-select"
                      style={{ borderColor: STATUS_COLORS[order.status] }}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ao-items">
                  {order.items.map((item, i) => (
                    <div key={i} className="ao-item">
                      <div className="ao-item-img" style={{ background: item.color || '#f0f0f0' }}>
                        {item.image && <img src={item.image} alt={item.name} />}
                      </div>
                      <div className="ao-item-info">
                        <p className="ao-item-name">{item.name}</p>
                        <p className="ao-item-meta">Size: {item.size} · Qty: {item.qty} · {item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* everything needed to actually send the parcel */}
                <div className="ao-ship">
                  <div className="ao-ship-block">
                    <p className="ao-ship-label">Deliver to</p>
                    <p className="ao-ship-name">{a.fullName}</p>
                    <p className="ao-ship-line">{fullAddress(a)}</p>
                    <p className="ao-ship-line">{a.pincode}</p>
                    <p className="ao-ship-phone">
                      <a href={`tel:${a.phone}`}>+91 {a.phone}</a>
                    </p>
                  </div>

                  <div className="ao-ship-actions">
                    <button className="ao-mini-btn" onClick={() => copyAddress(order)}>
                      {copied === order._id ? 'Copied ✓' : 'Copy address'}
                    </button>
                    <button className="ao-mini-btn" onClick={() => printSlip(order)}>
                      Packing slip
                    </button>
                  </div>
                </div>

                <div className="ao-card-footer">
                  <div className="ao-money">
                    <span>Subtotal {inr(order.subtotal)}</span>
                    {order.discount > 0 && (
                      <span className="ao-money-discount">
                        − {inr(order.discount)}{order.couponCode ? ` (${order.couponCode})` : ''}
                      </span>
                    )}
                    <span>Delivery {order.delivery ? inr(order.delivery) : 'FREE'}</span>
                  </div>
                  <div className="ao-total">{inr(order.total || order.subtotal)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}