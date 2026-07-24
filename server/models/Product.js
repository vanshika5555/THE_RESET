const mongoose = require('mongoose');

// How many of each size are on the shelf.
const stockSchema = new mongoose.Schema({
  size: { type: String, required: true },
  qty:  { type: Number, required: true, default: 0, min: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  price:       { type: String, required: true },
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
  color:       { type: String, default: '#f0f0f0' },
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