const mongoose = require('mongoose');

/**
 * Store credit — every rupee in or out of a customer's balance, one row each.
 * The balance itself lives on the user (User.credit); this is the statement.
 */
const creditLogSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount:  { type: Number, required: true },          // + added, − spent
  balance: { type: Number, required: true },          // after this line
  kind:    { type: String, enum: ['refund', 'spent', 'returned', 'adjust', 'giftcard', 'referral'], required: true },
  note:    { type: String, default: '', maxlength: 200 },
  order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  // Who added it by hand (owner adjustments); empty for automatic lines.
  by:      { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('CreditLog', creditLogSchema);
