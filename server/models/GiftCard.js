const mongoose = require('mongoose');

/**
 * A gift card: bought online (or issued by the owner), emailed to someone,
 * and redeemed once into that person's store credit.
 *
 * The code itself is never sent back by the API except to the recipient's
 * email. It's kept (hidden) so the owner can resend the email, and looked
 * up by its hash so a database read can't be used to guess codes.
 */
const giftCardSchema = new mongoose.Schema({
  amount:   { type: Number, required: true, min: 1 },
  code:     { type: String, select: false },              // RESETXXXXXXXXXXXX, no dashes
  codeHash: { type: String, index: true, sparse: true },
  last4:    { type: String, default: '' },

  status:   { type: String, enum: ['Awaiting', 'Active', 'Redeemed', 'Void'], default: 'Awaiting', index: true },

  to:       { name: { type: String, default: '', maxlength: 60 }, email: { type: String, default: '', lowercase: true, trim: true } },
  fromName: { type: String, default: '', maxlength: 60 },
  message:  { type: String, default: '', maxlength: 300 },

  // Bought online…
  buyer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  razorpayOrderId:   { type: String, default: '', index: true },
  razorpayPaymentId: { type: String, default: '' },
  refundId:          { type: String, default: '' },
  paidAt:   { type: Date, default: null },
  // …or given by the shop.
  issuedBy: { type: String, default: '' },

  sentAt:     { type: Date, default: null },
  redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  redeemedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('GiftCard', giftCardSchema);
