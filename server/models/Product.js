const mongoose = require('mongoose');

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
  tag:         { type: String, default: null },
  sizes:       { type: [String], required: true },
  image:       { type: String, default: null },   // primary image (kept for grids/cart)
  images:      { type: [String], default: [] },   // full gallery
  color:       { type: String, default: '#f0f0f0' },
  inStock:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);