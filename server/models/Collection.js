const mongoose = require('mongoose');

/**
 * An "edit": a named, hand-picked set of pieces — "The Winter Edit",
 * "Wedding guest". Shown at /edit/<slug>, and on the home page if chosen.
 */
const collectionSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true, maxlength: 60 },
  slug:       { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  blurb:      { type: String, default: '', trim: true, maxlength: 300 },
  image:      { type: String, default: '' },          // cover; the first piece's photo when empty
  products:   { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  published:  { type: Boolean, default: false },
  showOnHome: { type: Boolean, default: false },
  position:   { type: Number, default: 0 },           // order on the home page, lowest first
}, { timestamps: true });

module.exports = mongoose.model('Collection', collectionSchema);
