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

async function runMigrations() {
  try {
    await pricesToNumbers();
  } catch (err) {
    console.error('Startup data fix failed (the server keeps running):', err.message);
  }
}

module.exports = { runMigrations };
