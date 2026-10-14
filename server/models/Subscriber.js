const mongoose = require('mongoose');

// Newsletter sign-ups. Each gets a one-use first-order code.
const subscriberSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  code:         { type: String, default: '' },
  unsubscribed: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Subscriber', subscriberSchema);
