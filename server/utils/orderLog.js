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

// What a customer gets back: no internal note, no staff names, no internal lines.
function forCustomer(order) {
  if (!order) return order;
  const o = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  delete o.adminNote;
  o.history = (o.history || [])
    .filter((h) => PUBLIC_TYPES.has(h.type))
    .map(({ by, ...h }) => h); // eslint-disable-line no-unused-vars
  return o;
}

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

module.exports = { log, pushLog, entry, forCustomer, rupees, PUBLIC_TYPES };
