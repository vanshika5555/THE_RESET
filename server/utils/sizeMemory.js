/**
 * "Your size" — what a customer has actually kept, per kind of fit.
 *
 * Delivered pieces count for their size; pieces sent back don't, and an
 * exchange counts for the new size. With nothing kept yet, a return marked
 * "Too big" or "Too small" points one size the other way.
 */
const Order = require('../models/Order');
const Product = require('../models/Product');
const ReturnRequest = require('../models/ReturnRequest');

const LETTERS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
// "an L", "an XS", "a 32", "an 8"
const article = (size) => (/^[A-Z]/.test(size) || /^(8|11|18)/.test(size) ? 'an' : 'a');
const norm = (s) => String(s || '').trim().toUpperCase().replace(/^XXXL$/, '3XL');

// Size order, for "one size smaller/bigger": letters by the list, numbers by value.
function neighbour(size, step) {
  const s = norm(size);
  const i = LETTERS.indexOf(s);
  if (i >= 0) return LETTERS[i + step] || null;
  const n = Number(s);
  if (Number.isFinite(n)) return String(n + step * 2);   // waist sizes go in 2s
  return null;
}

/**
 * Works it out from plain lists, so it can be tested without a database.
 * lines: [{ fit, size, qty, at }] kept;  backs: [{ fit, size, qty, exchangeSize, reason, at }]
 */
function decide(lines, backs) {
  const out = {};
  for (const fit of ['Top', 'Bottom']) {
    const kept = {};
    const latest = {};
    const add = (size, qty, at) => {
      const s = norm(size);
      if (!s) return;
      kept[s] = (kept[s] || 0) + qty;
      if (!latest[s] || at > latest[s]) latest[s] = at;
    };
    lines.filter((l) => l.fit === fit).forEach((l) => add(l.size, l.qty, l.at));
    const hints = [];
    backs.filter((b) => b.fit === fit).forEach((b) => {
      add(b.size, -b.qty, 0);
      if (b.exchangeSize) add(b.exchangeSize, b.qty, b.at);
      if (b.reason === 'Too big' || b.reason === 'Too small') hints.push(b);
    });

    const best = Object.entries(kept)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || (latest[b[0]] || 0) - (latest[a[0]] || 0))[0];
    const word = fit === 'Top' ? ['top', 'tops'] : ['bottom', 'bottoms'];
    if (best) {
      out[fit] = { size: best[0], basis: 'kept', count: best[1], note: `You’ve kept ${best[1]} ${best[1] === 1 ? word[0] : word[1]} in ${best[0]}` };
      continue;
    }
    const h = hints.sort((a, b) => b.at - a.at)[0];
    if (h) {
      const size = neighbour(h.size, h.reason === 'Too big' ? -1 : 1);
      if (size) out[fit] = { size, basis: 'returned', note: `You sent back ${article(norm(h.size))} ${norm(h.size)} for being ${h.reason.toLowerCase()}` };
    }
  }
  return out;
}

async function sizesFor(userId) {
  const orders = await Order.find({ user: userId, status: 'Delivered' }).select('items deliveredAt createdAt').lean();
  if (!orders.length) return {};
  const returns = await ReturnRequest.find({ user: userId, status: { $ne: 'Rejected' } }).select('items type reason createdAt').lean();
  const ids = new Set();
  orders.forEach((o) => o.items.forEach((i) => ids.add(String(i.product))));
  returns.forEach((r) => r.items.forEach((i) => ids.add(String(i.product))));
  const products = await Product.find({ _id: { $in: [...ids] } }).select('fitType').lean();
  const fitOf = Object.fromEntries(products.map((p) => [String(p._id), p.fitType || 'Top']));

  const lines = [];
  orders.forEach((o) => o.items.forEach((i) => lines.push({
    fit: fitOf[String(i.product)] || 'Top', size: i.size, qty: Number(i.qty) || 1, at: new Date(o.deliveredAt || o.createdAt).getTime(),
  })));
  const backs = [];
  returns.forEach((r) => r.items.forEach((i) => backs.push({
    fit: fitOf[String(i.product)] || 'Top', size: i.size, qty: Number(i.qty) || 1,
    exchangeSize: r.type === 'exchange' ? i.exchangeSize : '', reason: r.reason, at: new Date(r.createdAt).getTime(),
  })));
  return decide(lines, backs);
}

module.exports = { sizesFor, decide, neighbour };
