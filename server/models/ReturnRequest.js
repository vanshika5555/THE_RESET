const mongoose = require('mongoose');

/**
 * A customer's request to return or exchange pieces from a delivered order.
 *
 * Requested → Approved → Received → Refunded (return) / Exchanged (exchange)
 *           ↘ Rejected
 */
const lineSchema = new mongoose.Schema({
  orderItem:    { type: mongoose.Schema.Types.ObjectId, required: true }, // the line in the order
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:         String,
  image:        String,
  price:        String,
  size:         String,
  qty:          { type: Number, required: true, min: 1 },
  exchangeSize: { type: String, default: '' },
}, { _id: false });

const returnSchema = new mongoose.Schema({
  order:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:   { type: String, enum: ['return', 'exchange'], required: true },
  items:  { type: [lineSchema], required: true },
  reason: { type: String, required: true },
  note:   { type: String, default: '' },
  status: {
    type: String,
    enum: ['Requested', 'Approved', 'Rejected', 'Received', 'Refunded', 'Exchanged'],
    default: 'Requested',
  },
  // Shown to the customer (e.g. pickup date, why it was rejected).
  shopMessage: { type: String, default: '' },
  restocked:   { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ReturnRequest', returnSchema);
