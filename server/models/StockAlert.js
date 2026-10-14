const mongoose = require('mongoose');

/**
 * "Email me when this size is back."
 * One row per email + product + size. Once the email has gone out the row is
 * marked notified, so nobody gets the same alert twice.
 */
const stockAlertSchema = new mongoose.Schema({
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  size:       { type: String, required: true },
  email:      { type: String, required: true, lowercase: true, trim: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notifiedAt: { type: Date, default: null },
}, { timestamps: true });

stockAlertSchema.index({ product: 1, size: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('StockAlert', stockAlertSchema);
