const mongoose = require('mongoose');
const { parsePrice } = require('../utils/price');

// How many of each size are on the shelf.
const stockSchema = new mongoose.Schema({
  size: { type: String, required: true },
  qty:  { type: Number, required: true, default: 0, min: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  // Selling price in rupees, as a number. Text like "₹2,990" is accepted
  // and converted, so an older admin build can still save.
  price:       { type: Number, required: true, min: 0, set: parsePrice },
  // Optional original price. When higher than price, the shop shows it
  // struck through with the % off.
  mrp:         { type: Number, default: 0, min: 0, set: parsePrice },
  description: { type: String, default: '' },
  materials:   { type: String, default: '' },
  delivery:    { type: String, default: '' },
  category:    { type: String, required: true, enum: ['Men', 'Women'] },
  season:      {
    type: String,
    required: true,
    enum: ['Summer', 'Winter', 'Monsoon', 'All Season'],
    default: 'All Season'
  },
  subcategory: { type: String, required: true },
  // Decides which size chart the shop shows, and which sizes the admin offers.
  fitType:     { type: String, enum: ['Top', 'Bottom'], default: 'Top' },
  tag:         { type: String, default: null },
  sizes:       { type: [String], required: true },   // which sizes this piece comes in
  stock:       { type: [stockSchema], default: [] }, // how many of each are left
  image:       { type: String, default: null },
  images:      { type: [String], default: [] },
  color:       { type: String, default: '#f0f0f0' },   // shown behind the photo while it loads
  // Colours: the same style in other colours is a separate product sharing a styleGroup.
  colorName:   { type: String, default: '', trim: true, maxlength: 30 },   // e.g. "Black"
  swatch:      { type: String, default: '', match: [/^(#[0-9a-fA-F]{6})?$/, 'Swatch must be a colour like #1a1a1a'] },
  styleGroup:  { type: String, default: '', index: true },
  inStock:     { type: Boolean, default: true },     // master switch — hide it regardless of counts
}, { timestamps: true });

// How many are left in a given size.
productSchema.methods.qtyForSize = function (size) {
  const entry = this.stock.find(s => s.size === size);
  // If no stock has been recorded yet, fall back to the in/out switch so
  // products created before stock tracking keep working.
  if (!entry) return this.inStock ? Infinity : 0;
  return entry.qty;
};

module.exports = mongoose.model('Product', productSchema);