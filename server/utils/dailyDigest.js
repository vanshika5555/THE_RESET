/**
 * The morning email for the shop team.
 *
 * Once a day (9 am India time by default) everyone who runs the shop gets
 * one short email: what needs doing today (orders to confirm and ship,
 * returns waiting), sizes that are running out, and — for the owner only —
 * how yesterday's sales went. Nothing to report? Nothing is sent.
 *
 * Runs on Render by itself (like the bag reminders). Turn it off with
 * DAILY_DIGEST=off; change the hour with DIGEST_HOUR=8. Each person can
 * switch it off for themselves in Admin → Security.
 */
const Order = require('../models/Order');
const Product = require('../models/Product');
const ReturnRequest = require('../models/ReturnRequest');
const StockAlert = require('../models/StockAlert');
const User = require('../models/User');
const Counter = require('../models/Counter');
const { sendMail } = require('./mailer');
const { layout, inr, esc } = require('./emails');

const IST = 5.5 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const LOW = 5;            // 1–5 left counts as running low (same as the dashboard)
const MAX_STOCK_ROWS = 8;

const ADMIN_URL = () => (process.env.ADMIN_URL || 'https://the-reset-admin.vercel.app').replace(/\/$/, '');

// Midnight in India, as a real moment in time.
function istMidnight(now = new Date()) {
  const d = new Date(now.getTime() + IST);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - IST);
}
// 20261021 — one number per Indian calendar day.
const dayKey = (now = new Date()) => Number(new Date(now.getTime() + IST).toISOString().slice(0, 10).replace(/-/g, ''));
const istHour = (now = new Date()) => new Date(now.getTime() + IST).getUTCHours();
const dayName = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

async function gather(now = new Date()) {
  const today = istMidnight(now);
  const yesterday = new Date(today.getTime() - DAY);
  const live = { 'payment.status': { $ne: 'Awaiting' } };

  const [pending, toShip, onTheRoad, yOrders, returnsNew, returnsBack, products, waitingRows] = await Promise.all([
    Order.find({ ...live, status: 'Pending' }).select('createdAt payment total').lean(),
    Order.countDocuments({ status: 'Confirmed' }),
    Order.find({ status: 'Shipped', 'payment.method': 'cod', 'payment.status': 'Pending' }).select('total subtotal payment.credit').lean(),
    Order.find({ ...live, createdAt: { $gte: yesterday, $lt: today }, status: { $ne: 'Cancelled' } })
      .select('total subtotal items').lean(),
    ReturnRequest.countDocuments({ status: 'Requested' }),
    ReturnRequest.countDocuments({ status: 'Received' }),
    Product.find({ inStock: { $ne: false } }).select('name stock').lean(),
    StockAlert.find({ notifiedAt: null }).select('product size').lean(),
  ]);

  const waiting = {};
  waitingRows.forEach((w) => { const k = `${w.product}|${w.size}`; waiting[k] = (waiting[k] || 0) + 1; });

  const stock = [];
  products.forEach((p) => (p.stock || []).forEach((s) => {
    if (s.qty <= LOW) stock.push({ name: p.name, size: s.size, qty: s.qty, waiting: waiting[`${p._id}|${s.size}`] || 0 });
  }));
  // Most-wanted first, then sold out, then fewest left.
  stock.sort((a, b) => b.waiting - a.waiting || a.qty - b.qty || a.name.localeCompare(b.name));

  const oldest = pending.reduce((o, x) => (!o || x.createdAt < o ? x.createdAt : o), null);
  const amount = (o) => Number(o.total) || Number(o.subtotal) || 0;

  return {
    date: today,
    toConfirm: pending.length,
    oldestPendingHours: oldest ? Math.floor((now - new Date(oldest)) / 3600000) : 0,
    toShip,
    returnsNew,
    returnsBack,
    cashOnTheRoad: { orders: onTheRoad.length, amount: onTheRoad.reduce((n, o) => n + Math.max(0, amount(o) - (Number(o.payment?.credit) || 0)), 0) },
    sales: {
      orders: yOrders.length,
      amount: yOrders.reduce((n, o) => n + amount(o), 0),
      pieces: yOrders.reduce((n, o) => n + (o.items || []).reduce((m, i) => m + (Number(i.qty) || 1), 0), 0),
    },
    stock: stock.slice(0, MAX_STOCK_ROWS),
    stockMore: Math.max(0, stock.length - MAX_STOCK_ROWS),
    soldOut: stock.filter((s) => s.qty === 0).length,
  };
}

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// Is there anything worth an email?
const worthSending = (d, owner) => d.toConfirm || d.toShip || d.returnsNew || d.returnsBack
  || d.stock.length || (owner && d.sales.orders);

function build(d, { name, owner }) {
  const todo = [];
  if (d.toConfirm) {
    todo.push({
      n: d.toConfirm, label: `${d.toConfirm === 1 ? 'order' : 'orders'} to confirm`,
      note: d.oldestPendingHours >= 24 ? `oldest waiting ${Math.floor(d.oldestPendingHours / 24)} day${d.oldestPendingHours >= 48 ? 's' : ''}` : '',
      href: `${ADMIN_URL()}/orders?status=Pending`,
    });
  }
  if (d.toShip) todo.push({ n: d.toShip, label: `${d.toShip === 1 ? 'order' : 'orders'} to pack and ship`, href: `${ADMIN_URL()}/orders?status=Confirmed` });
  if (d.returnsNew) todo.push({ n: d.returnsNew, label: `return ${d.returnsNew === 1 ? 'request' : 'requests'} to answer`, href: `${ADMIN_URL()}/returns` });
  if (d.returnsBack) {
    todo.push({
      n: d.returnsBack, label: `${d.returnsBack === 1 ? 'return' : 'returns'} received — refund or exchange`,
      note: owner ? '' : 'refunds are sent by the owner', href: `${ADMIN_URL()}/returns`,
    });
  }

  const subjectBits = [];
  if (d.toConfirm) subjectBits.push(`${d.toConfirm} to confirm`);
  if (d.toShip) subjectBits.push(`${d.toShip} to ship`);
  if (d.returnsNew + d.returnsBack) subjectBits.push(plural(d.returnsNew + d.returnsBack, 'return'));
  const subject = subjectBits.length ? `Today: ${subjectBits.join(', ')}` : 'Today: all caught up';

  const cell = 'font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#444;padding:10px 0;border-bottom:1px solid #eee';
  const h2 = (t) => `<p style="margin:26px 0 6px;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#999">${t}</p>`;

  const todoHtml = todo.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${todo.map((t) => `
        <tr>
          <td style="${cell};width:44px;font:700 22px/1 Helvetica,Arial,sans-serif;color:#111">${t.n}</td>
          <td style="${cell}"><a href="${esc(t.href)}" style="color:#111;text-decoration:none">${esc(t.label)}</a>${t.note ? `<br><span style="font-size:12.5px;color:#b45309">${esc(t.note)}</span>` : ''}</td>
          <td style="${cell};text-align:right"><a href="${esc(t.href)}" style="color:#111;font-size:13px">Open →</a></td>
        </tr>`).join('')}</table>`
    : '<p style="margin:0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#444">Nothing waiting — every order and return is up to date.</p>';

  const cashHtml = d.cashOnTheRoad.orders
    ? `<p style="margin:10px 0 0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#666">${inr(d.cashOnTheRoad.amount)} in cash still to be collected by couriers on ${plural(d.cashOnTheRoad.orders, 'parcel')}.</p>`
    : '';

  const salesHtml = owner
    ? `${h2('Yesterday')}<p style="margin:0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#444">${d.sales.orders
      ? `<strong style="font-size:20px;color:#111">${inr(d.sales.amount)}</strong> from ${plural(d.sales.orders, 'order')} · ${plural(d.sales.pieces, 'piece')}`
      : 'No orders came in yesterday.'}
       <a href="${ADMIN_URL()}/reports" style="color:#111;font-size:13px;margin-left:6px">Reports →</a></p>`
    : '';

  const stockHtml = d.stock.length
    ? `${h2('Running out')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.stock.map((s) => `
        <tr>
          <td style="${cell}">${esc(s.name)} <span style="color:#999">· ${esc(s.size)}</span></td>
          <td style="${cell};text-align:right;white-space:nowrap">${s.qty === 0
            ? '<strong style="color:#b42318">Sold out</strong>'
            : `${s.qty} left`}${s.waiting ? `<br><span style="font-size:12.5px;color:#1d4ed8">${plural(s.waiting, 'shopper')} waiting</span>` : ''}</td>
        </tr>`).join('')}</table>
       ${d.stockMore ? `<p style="margin:8px 0 0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#666">…and ${plural(d.stockMore, 'more size')}.</p>` : ''}`
    : '';

  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const html = layout({
    preheader: subject,
    heading: `Good morning, ${esc(first)}.`,
    body: `<span style="color:#999;font-size:13px">${esc(dayName(d.date))}</span>
      ${h2('To do today')}${todoHtml}${cashHtml}${salesHtml}${stockHtml}`,
    cta: { href: ADMIN_URL(), label: 'Open the admin' },
    footer: `You get this because you're on THE RESET team. Turn it off in <a href="${ADMIN_URL()}/security" style="color:#666">Admin → Security</a>.`,
  });

  const text = [
    `Good morning, ${first}.`, '',
    'To do today:',
    ...(todo.length ? todo.map((t) => `- ${t.n} ${t.label}${t.note ? ` (${t.note})` : ''}: ${t.href}`) : ['- Nothing waiting.']),
    ...(owner ? ['', `Yesterday: ${d.sales.orders ? `${inr(d.sales.amount)} from ${plural(d.sales.orders, 'order')}` : 'no orders'}`] : []),
    ...(d.stock.length ? ['', 'Running out:', ...d.stock.map((s) => `- ${s.name} · ${s.size}: ${s.qty ? `${s.qty} left` : 'sold out'}${s.waiting ? ` (${s.waiting} waiting)` : ''}`)] : []),
    '', ADMIN_URL(),
  ].join('\n');

  return { subject, html, text };
}

// Only one server may send today's email, even if two are running.
async function claimToday(now = new Date()) {
  const key = dayKey(now);
  try {
    const r = await Counter.updateOne({ _id: 'daily-digest', seq: { $lt: key } }, { $set: { seq: key } }, { upsert: true });
    return Boolean(r.modifiedCount || r.upsertedCount);
  } catch (err) {
    if (err.code === 11000) return false;   // already sent today
    throw err;
  }
}

async function sendDigest(now = new Date()) {
  const team = await User.find({ role: { $in: ['admin', 'staff'] }, dailyDigest: { $ne: false } }).select('name email role').lean();
  if (!team.length) return 0;
  const data = await gather(now);
  let sent = 0;
  for (const person of team) {
    const owner = person.role === 'admin';
    if (!worthSending(data, owner)) continue;
    try {
      await sendMail({ to: person.email, ...build(data, { name: person.name, owner }) });
      sent += 1;
    } catch (err) {
      console.error('Morning email failed:', err.message);
    }
  }
  return sent;
}

function startDailyDigest() {
  const flag = (process.env.DAILY_DIGEST || '').toLowerCase();
  const on = flag === 'on' || (process.env.RENDER && flag !== 'off');
  if (!on) return;
  const hour = Math.min(23, Math.max(0, Number(process.env.DIGEST_HOUR) || 9));
  const tick = async () => {
    try {
      if (istHour() < hour) return;
      if (await claimToday()) {
        const n = await sendDigest();
        console.log(`Morning email sent to ${n} team member${n === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      console.error('Morning email:', err.message);
    }
  };
  setTimeout(tick, 2 * 60 * 1000);
  setInterval(tick, 10 * 60 * 1000).unref();
}

module.exports = { gather, build, worthSending, sendDigest, claimToday, startDailyDigest, istMidnight, dayKey };
