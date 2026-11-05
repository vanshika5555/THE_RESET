const mongoose = require('mongoose');

/**
 * An automatic offer — no code to type. "Buy 2, get 10% off", "₹300 off
 * when you spend ₹2,999". The best one that fits the bag is applied at
 * checkout (or the customer's discount code, if that saves more).
 */
const offerSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 60 },     // shown to shoppers
  condition: {
    type:  { type: String, enum: ['qty', 'spend'], required: true },          // pieces in the bag, or ₹ spent
    value: { type: Number, required: true, min: 1 },
  },
  reward: {
    type:  { type: String, enum: ['percent', 'amount'], required: true },
    value: { type: Number, required: true, min: 1 },
  },
  maxDiscount: { type: Number, default: 0 },                                   // cap for percent offers (0 = none)
  category:  { type: String, enum: ['', 'Men', 'Women'], default: '' },        // '' = everything
  startsAt:  { type: Date, default: null },
  endsAt:    { type: Date, default: null },
  active:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
