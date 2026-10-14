const Product = require('../models/Product');

/**
 * Change the stock of one size — safely when many orders arrive at once.
 *
 * Read the product, work out the new count, and write it back only if
 * nobody else changed the product in between (the `__v` version check).
 * If someone did, read again and retry. So two people buying the last piece
 * at the same moment cannot both get it.
 *
 * delta < 0 takes stock, delta > 0 returns it.
 * Returns true when done, false when there is not enough left.
 */
async function adjustStock(productId, size, delta) {
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
    if (r.modifiedCount === 1) return true;
  }
  return false;   // extremely busy — treat as unavailable rather than oversell
}

const reserve = (item) => adjustStock(item.product, item.size, -item.qty);

async function restock(items) {
  for (const item of items) await adjustStock(item.product, item.size, item.qty);
}

module.exports = { adjustStock, reserve, restock };
