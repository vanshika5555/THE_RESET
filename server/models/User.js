const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label:    { type: String, default: 'Home' },
  fullName: { type: String, required: true },
  phone:    { type: String, required: true },
  houseNo:  { type: String, default: '' },   // flat / house no. / building
  address:  { type: String, required: true },// street / area / locality
  landmark: { type: String, default: '' },
  city:     { type: String, required: true },
  state:    { type: String, default: '' },
  pincode:  { type: String, required: true },
}, { _id: true });

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },
  // user = shopper · staff = runs orders, returns and products · admin = the owner
  role:      { type: String, enum: ['user', 'staff', 'admin'], default: 'user' },

  // Bumped whenever the password changes (or "sign out everywhere" is used).
  // Every login token carries the number it was issued with, so raising it
  // instantly invalidates all older tokens on every device.
  tokenVersion: { type: Number, default: 0 },

  // Password reset: only a SHA-256 hash of the emailed token is stored, so a
  // leaked database cannot be used to reset anyone's password.
  resetPasswordHash:    { type: String, default: null, select: false },
  resetPasswordExpires: { type: Date,   default: null, select: false },

  // 2-step verification (admins): an authenticator-app code after the password.
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret:  { type: String, default: '', select: false },
  twoFactorPending: { type: String, default: '', select: false },   // during setup
  twoFactorLastStep: { type: Number, default: 0, select: false },   // stops a code being reused
  twoFactorBackup:  { type: [String], default: [], select: false }, // SHA-256 of one-use backup codes
  addresses: { type: [addressSchema], default: [] },

  // What this customer is currently interested in. Kept on the account so
  // it follows them between devices — and so the shop can see demand that
  // has not turned into an order yet.
  cart: {
    type: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name:    String,
      price:   String,
      image:   String,
      size:    String,
      qty:     { type: Number, default: 1 },
      _id:     false,
    }],
    default: [],
  },

  // "Still in your bag?" reminder: one email per bag, a day after it was last changed.
  cartUpdatedAt:      { type: Date, default: null },
  cartReminderSentAt: { type: Date, default: null },
  bagReminders:       { type: Boolean, default: true },   // turned off from the email's link
  dailyDigest:        { type: Boolean, default: true },   // team only: the morning email
  credit:             { type: Number, default: 0, min: 0 },   // store credit balance (₹)
  // Invite a friend: my code, who invited me, and whether that's been rewarded.
  referralCode:       { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  referredBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referralRewarded:   { type: Boolean, default: false },

  wishlist: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    default: [],
  },

  // Recently viewed, newest first, capped so it cannot grow forever.
  viewed: {
    type: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      at:      { type: Date, default: Date.now },
      count:   { type: Number, default: 1 },
      _id:     false,
    }],
    default: [],
  },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);