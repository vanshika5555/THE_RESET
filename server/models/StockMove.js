const mongoose = require('mongoose');

/**
 * One change to one size's stock: an order taking it, a cancel putting it
 * back, or someone on the team editing the count. Shown as "Stock history"
 * in the product editor. Kept for a year.
 */
const stockMoveSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  size:    { type: String, required: true },
  change:  { type: Number, required: true },          // −1 sold, +3 restocked
  after:   { type: Number, default: null },           // how many were left afterwards
  // order = sold · cancel = order cancelled · unpaid = online payment never came · edit = changed in the admin
  reason:  { type: String, enum: ['order', 'cancel', 'unpaid', 'edit', 'new'], required: true },
  order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  by: {
    type: new mongoose.Schema({
      id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' },
      role: { type: String, default: 'user' },
    }, { _id: false }),
    default: null,
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

stockMoveSchema.index({ product: 1, createdAt: -1 });
stockMoveSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('StockMove', stockMoveSchema);
