/**
 * The order's activity log — what happened to it, when, and who did it.
 *
 * Every change the shop makes (confirm, ship, tracking, refund, note) and
 * everything the customer or Razorpay does is added as one line. The shop
 * sees all of it with names; the customer sees their own timeline without
 * staff names or internal notes.
 */

// Lines the customer may see on their order page.
const PUBLIC_TYPES = new Set(['placed', 'paid', 'status', 'shipment', 'cancelled', 'refund', 'return']);

const who = (user) => (user && user._id
  ? { id: user._id, name: String(user.name || '').slice(0, 60), role: user.role || 'user' }
  : null);

function entry(type, text, user) {
  return { at: new Date(), type, text: String(text || '').slice(0, 200), by: who(user) };
}

// Add a line to an order document that is about to be saved.
function log(order, type, text, user) {
  if (!Array.isArray(order.history)) order.history = [];
  order.history.push(entry(type, text, user));
}

// Add a line straight to the database (for orders changed with updateOne).
function pushLog(Order, orderId, type, text, user) {
  return Order.updateOne({ _id: orderId }, { $push: { history: entry(type, text, user) } }).catch(() => {});
}

// The log is written in the shop's words; the customer reads it in theirs.
const CUSTOMER_WORDS = [
  [/^Marked Pending/, 'Back to processing'],
  [/^Marked Confirmed/, 'Order confirmed'],
  [/^Marked Shipped/, 'Shipped'],
  [/^Marked Delivered/, 'Delivered'],
  [/cash collected$/, 'paid in cash'],
  [/^Tracking added/, 'Tracking number added'],
  [/^Tracking changed/, 'Tracking number updated'],
  [/^Order cancelled by the shop$/, 'Order cancelled by THE RESET'],
  [/^Cancelled by the customer$/, 'You cancelled the order'],
  [/^Online payment wasn’t completed, so the order was cancelled$/, 'Payment wasn’t completed, so the order was cancelled'],
  [/^(Return|Exchange) requested · (\d+ pieces?) · .*$/, (m, kind, n) => `You asked for ${kind === 'Exchange' ? 'an exchange' : 'a return'} · ${n}`],
  [/received back at the shop$/, 'received by us'],
  [/^(Return|Exchange) declined$/, '$1 request declined'],
];
const customerText = (text) => CUSTOMER_WORDS.reduce((t, [re, to]) => t.replace(re, to), String(text || ''));

// What a customer gets back: no internal note, no staff names, no internal lines.
function forCustomer(order) {
  if (!order) return order;
  const o = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  delete o.adminNote;
  o.history = (o.history || [])
    .filter((h) => PUBLIC_TYPES.has(h.type))
    .map(({ by, ...h }) => ({ ...h, text: customerText(h.text) })); // eslint-disable-line no-unused-vars
  return o;
}

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

module.exports = { log, pushLog, entry, forCustomer, customerText, rupees, PUBLIC_TYPES };
