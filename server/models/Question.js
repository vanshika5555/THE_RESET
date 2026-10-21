const mongoose = require('mongoose');

/**
 * A shopper's question about a product ("Is the linen see-through?"),
 * answered by the shop and shown on the product page for everyone.
 */
const questionSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:     { type: String, default: '' },                 // first name, as shown
  text:     { type: String, required: true, maxlength: 300 },
  answer: {
    text: { type: String, default: '', maxlength: 1000 },
    by:   { type: String, default: '' },                   // team member's name (shown as "THE RESET")
    at:   { type: Date, default: null },
  },
  // open = waiting for the shop; answered = shown on the product page; hidden = not shown.
  status:   { type: String, enum: ['open', 'answered', 'hidden'], default: 'open', index: true },
  helpful:  { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
