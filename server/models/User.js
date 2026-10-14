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
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },

  // Bumped whenever the password changes (or "sign out everywhere" is used).
  // Every login token carries the number it was issued with, so raising it
  // instantly invalidates all older tokens on every device.
  tokenVersion: { type: Number, default: 0 },

  // Password reset: only a SHA-256 hash of the emailed token is stored, so a
  // leaked database cannot be used to reset anyone's password.
  resetPasswordHash:    { type: String, default: null, select: false },
  resetPasswordExpires: { type: Date,   default: null, select: false },
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