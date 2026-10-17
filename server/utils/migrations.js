const mongoose = require('mongoose');
const { parsePrice } = require('./price');

/**
 * One-off data fixes that run every time the server starts. Each one only
 * touches documents that still need it, so running again does nothing.
 */

// Product prices used to be text ("₹2,990"); they are numbers now.
async function pricesToNumbers() {
  const products = mongoose.connection.collection('products');
  const old = await products.find({ price: { $type: 'string' } }).project({ price: 1, mrp: 1 }).toArray();
  for (const p of old) {
    const set = { price: parsePrice(p.price) };
    if (typeof p.mrp === 'string') set.mrp = parsePrice(p.mrp);
    await products.updateOne({ _id: p._id }, { $set: set });
  }
  if (old.length) console.log(`Converted ${old.length} product price${old.length === 1 ? '' : 's'} from text to numbers.`);
}

/**
 * The very first version of checkout trusted the subtotal the browser sent,
 * and some of those early orders saved nonsense totals (text prices glued
 * together into numbers like 3,85,25,10,69,490). Rebuild any order whose
 * subtotal doesn't match its own items, and fill in a missing total.
 */
async function fixOrderTotals() {
  const orders = mongoose.connection.collection('orders');
  const all = await orders.find({}).project({ items: 1, subtotal: 1, total: 1, discount: 1, delivery: 1 }).toArray();
  let fixed = 0;
  for (const o of all) {
    const items = Array.isArray(o.items) ? o.items : [];
    if (!items.length) continue;
    const sum = Math.round(items.reduce((n, i) => n + parsePrice(i.price) * (Number(i.qty) || 1), 0) * 100) / 100;
    const discount = Math.min(Number(o.discount) || 0, sum);
    const delivery = Number(o.delivery) || 0;
    const subtotal = Number(o.subtotal);
    const total = Number(o.total);
    const badSubtotal = !Number.isFinite(subtotal) || Math.abs(subtotal - sum) > 1;
    const badTotal = !Number.isFinite(total) || total <= 0 || total > sum + delivery + 1;
    if (!badSubtotal && !badTotal) continue;
    await orders.updateOne({ _id: o._id }, {
      $set: { subtotal: sum, total: Math.max(0, Math.round((sum - discount + delivery) * 100) / 100) },
    });
    fixed += 1;
  }
  if (fixed) console.log(`Fixed the totals on ${fixed} early order${fixed === 1 ? '' : 's'}.`);
}

async function runMigrations() {
  for (const step of [pricesToNumbers, fixOrderTotals]) {
    try {
      await step();
    } catch (err) {
      console.error(`Startup data fix "${step.name}" failed (the server keeps running):`, err.message);
    }
  }
}

module.exports = { runMigrations };
