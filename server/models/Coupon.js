const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  description: { type: String, default: '' },

  // 'percent' takes a share off, 'flat' takes a fixed amount off
  type:   { type: String, enum: ['percent', 'flat'], required: true },
  value:  { type: Number, required: true, min: 0 },

  // optional guard rails
  minOrder:  { type: Number, default: 0 },      // bag must reach this
  maxDiscount: { type: Number, default: 0 },    // cap for percent codes (0 = no cap)
  expiresAt: { type: Date, default: null },
  usageLimit: { type: Number, default: 0 },     // 0 = unlimited
  usedCount:  { type: Number, default: 0 },

  active: { type: Boolean, default: true },
}, { timestamps: true });

/**
 * Can this code be used on a bag of `subtotal`?
 * Returns { ok: true, discount } or { ok: false, reason }.
 */
couponSchema.methods.check = function (subtotal) {
  if (!this.active) {
    return { ok: false, reason: 'This code is no longer active.' };
  }
  if (this.expiresAt && this.expiresAt < new Date()) {
    return { ok: false, reason: 'This code has expired.' };
  }
  if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) {
    return { ok: false, reason: 'This code has been fully claimed.' };
  }
  if (this.minOrder > 0 && subtotal < this.minOrder) {
    return {
      ok: false,
      reason: `Spend ₹${this.minOrder.toLocaleString('en-IN')} to use this code.`,
    };
  }

  let discount = this.type === 'percent'
    ? Math.round((subtotal * this.value) / 100)
    : this.value;

  if (this.type === 'percent' && this.maxDiscount > 0) {
    discount = Math.min(discount, this.maxDiscount);
  }

  // never discount more than the bag is worth
  discount = Math.min(discount, subtotal);

  if (discount <= 0) {
    return { ok: false, reason: 'This code gives no discount on this order.' };
  }

  return { ok: true, discount };
};

module.exports = mongoose.model('Coupon', couponSchema);