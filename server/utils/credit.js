/**
 * Store credit.
 *
 * A customer's balance (User.credit) grows when a return is refunded as
 * credit or the owner adds some by hand, and is spent at checkout. Every
 * change goes through here so the balance can never go below zero and each
 * one is written to the statement (CreditLog).
 */
const User = require('../models/User');
const Order = require('../models/Order');
const CreditLog = require('../models/CreditLog');

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

// What the customer still pays for an order after their credit.
const amountDue = (order) => Math.max(0, round((Number(order.total) || Number(order.subtotal) || 0) - (Number(order.payment?.credit) || 0)));

async function balanceOf(userId) {
  const u = await User.findById(userId).select('credit').lean();
  return round(u?.credit || 0);
}

// Take credit off — only if there's enough at this very moment.
async function spend(userId, amount) {
  amount = round(amount);
  if (amount <= 0) return true;
  const r = await User.updateOne({ _id: userId, credit: { $gte: amount } }, { $inc: { credit: -amount } });
  return r.modifiedCount === 1;
}

async function log(userId, amount, kind, note, { order = null, by = '' } = {}) {
  const balance = await balanceOf(userId);
  return CreditLog.create({ user: userId, amount: round(amount), balance, kind, note: String(note || '').slice(0, 200), order, by });
}

// Put credit on — refunds, cancelled orders, the owner's goodwill.
async function add(userId, amount, kind, note, refs = {}) {
  amount = round(amount);
  if (!amount) return balanceOf(userId);
  if (amount < 0) {
    // Owner taking credit away: never below zero.
    const ok = await spend(userId, -amount);
    if (!ok) throw Object.assign(new Error('They don’t have that much credit.'), { status: 400 });
  } else {
    await User.updateOne({ _id: userId }, { $inc: { credit: amount } });
  }
  await log(userId, amount, kind, note, refs);
  return balanceOf(userId);
}

// Writes the statement line for credit spent on an order (taken off by spend()).
const logSpent = (userId, amount, orderId) =>
  log(userId, -round(amount), 'spent', `Order #${String(orderId).slice(-8).toUpperCase()}`, { order: orderId });

/**
 * A cancelled order gives back the credit it used — once, however many
 * times this is called.
 */
async function giveBack(order, note = 'Order cancelled') {
  const amount = round(order?.payment?.credit);
  if (!amount || !order.user) return 0;
  const r = await Order.updateOne(
    { _id: order._id, 'payment.credit': { $gt: 0 }, 'payment.creditBack': { $ne: true } },
    { $set: { 'payment.creditBack': true } }
  );
  if (!r.modifiedCount) return 0;
  await add(order.user._id || order.user, amount, 'returned', `${note} · #${String(order._id).slice(-8).toUpperCase()}`, { order: order._id });
  return amount;
}

/**
 * Splits a return's refund between credit and money, in the same share
 * the order was paid: an order paid half by credit gets half back as credit.
 * Asked for store credit? All of it is credit.
 */
function splitRefund(order, amount, wantsCredit) {
  amount = round(amount);
  if (wantsCredit || order.payment?.method === 'credit') return { credit: amount, money: 0 };
  const total = Number(order.total) || Number(order.subtotal) || 0;
  const usedCredit = Number(order.payment?.credit) || 0;
  const credit = total > 0 && usedCredit > 0 ? round(Math.min(amount, (amount * usedCredit) / total)) : 0;
  return { credit, money: round(amount - credit) };
}

module.exports = { amountDue, balanceOf, spend, logSpent, add, giveBack, splitRefund, round };
