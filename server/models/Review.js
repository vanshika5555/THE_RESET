const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:  { type: String, required: true },
  product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  review:    { type: String, required: true, maxlength: 2000 },
  // True when the reviewer has a delivered order containing this piece.
  verified:  { type: Boolean, default: false },
  // Up to 3 photos from verified buyers (Cloudinary links, checked on save).
  photos:    { type: [String], default: [] },
}, { timestamps: true });

// One review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);