const Product = require('../models/Product');
const StockMove = require('../models/StockMove');

const who = (user) => (user && user._id
  ? { id: user._id, name: String(user.name || '').slice(0, 60), role: user.role || 'user' }
  : null);

/**
 * A record for the product's stock history.
 * why: { reason, order?, by? (a user) }
 */
const moveDoc = (productId, size, change, after, why) => ({
  product: productId, size, change, after,
  reason: why.reason, order: why.order || null, by: who(why.by),
});

// Writes history rows; never lets a logging problem break a sale.
function recordMoves(docs) {
  const list = (docs || []).filter((d) => d && d.change);
  if (!list.length) return Promise.resolve();
  return StockMove.insertMany(list, { ordered: false }).catch((err) => console.error('Stock history:', err.message));
}

/**
 * Change the stock of one size — safely when many orders arrive at once.
 *
 * Read the product, work out the new count, and write it back only if
 * nobody else changed the product in between (the `__v` version check).
 * If someone did, read again and retry. So two people buying the last piece
 * at the same moment cannot both get it.
 *
 * delta < 0 takes stock, delta > 0 returns it.
 * why (optional) adds a line to the stock history. With why.defer (an array)
 * the line is collected there instead of saved — the caller saves it once
 * the order really exists, so a checkout that falls through leaves no trace.
 * Returns true when done, false when there is not enough left.
 */
async function adjustStock(productId, size, delta, why) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const product = await Product.findById(productId).select('stock __v').lean();
    if (!product) return delta > 0;

    const entry = (product.stock || []).find(s => s.size === size);
    if (!entry) return true;                         // size not tracked (older products)
    if (entry.qty + delta < 0) return false;         // not enough left

    const stock = product.stock.map(s =>
      s.size === size ? { size: s.size, qty: s.qty + delta } : { size: s.size, qty: s.qty }
    );
    const r = await Product.updateOne(
      { _id: productId, __v: product.__v },
      { $set: { stock }, $inc: { __v: 1 } }
    );
    if (r.modifiedCount === 1) {
      if (why) {
        const doc = moveDoc(productId, size, delta, entry.qty + delta, why);
        if (Array.isArray(why.defer)) why.defer.push(doc);
        else recordMoves([doc]);
      }
      return true;
    }
  }
  return false;   // extremely busy — treat as unavailable rather than oversell
}

const reserve = (item, why) => adjustStock(item.product, item.size, -item.qty, why);

async function restock(items, why) {
  for (const item of items) await adjustStock(item.product, item.size, item.qty, why);
}

/**
 * After the team saves a product: one history line per size whose count changed.
 * before is null for a brand-new product.
 */
function recordEdit(before, after, user) {
  const qty = (p, size) => {
    const e = ((p && p.stock) || []).find((s) => s.size === size);
    return e ? e.qty : 0;
  };
  const docs = ((after && after.stock) || []).map((s) => {
    const change = s.qty - qty(before, s.size);
    return change ? moveDoc(after._id, s.size, change, s.qty, { reason: before ? 'edit' : 'new', by: user }) : null;
  });
  return recordMoves(docs);
}

module.exports = { adjustStock, reserve, restock, recordMoves, recordEdit };
