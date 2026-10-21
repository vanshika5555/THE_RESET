const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:     { type: String, required: true },
  price:    { type: String, required: true },
  size:     { type: String, required: true },
  qty:      { type: Number, required: true, default: 1 },
  image:    { type: String },
  color:    { type: String },
});

// One line of the order's activity log (see utils/orderLog.js).
const historySchema = new mongoose.Schema({
  at:   { type: Date, default: Date.now },
  type: { type: String, required: true },
  text: { type: String, default: '' },
  // Who did it — empty for the system (Razorpay, the unpaid-order sweeper).
  by: {
    type: new mongoose.Schema({
      id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' },
      role: { type: String, default: 'user' },
    }, { _id: false }),
    default: null,
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // Signed-in customers have a user. Guests do not, so their contact
  // details are kept on the order itself.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  guest: {
    name:  { type: String, default: '' },
    email: { type: String, default: '' },
  },
  items:    { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  delivery: { type: Number, required: true, default: 0 },
  total:    { type: Number, required: true, default: 0 },
  // A private note for the shop's own use — packing reminders, customer
  // calls, delivery instructions. Never shown to the customer.
  adminNote: { type: String, default: '' },
  // When the order reached the customer — starts the 7-day return window.
  deliveredAt: { type: Date, default: null },
  // How the customer pays. Cash on delivery is "Pending" until the courier
  // hands the parcel over (the order is marked Delivered).
  payment: {
    method: { type: String, enum: ['cod', 'online'], default: 'cod' },
    // Awaiting = online order whose payment hasn't come through yet; it is
    // hidden from the shop's order list and cancelled if never paid.
    status: { type: String, enum: ['Pending', 'Awaiting', 'Paid', 'Refunded', 'Void'], default: 'Pending' },
    codFee: { type: Number, default: 0 },
    paidAt: { type: Date, default: null },
    razorpayOrderId:   { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    refundId:          { type: String, default: '' },
  },

  // Sent as a gift: a note goes in the parcel and the packing slip shows no prices.
  gift: {
    isGift:  { type: Boolean, default: false },
    to:      { type: String, default: '', maxlength: 60 },
    message: { type: String, default: '', maxlength: 250 },
  },
  // For the courier — "leave with the guard", "call before coming".
  deliveryNote: { type: String, default: '', maxlength: 200 },

  // Given the first time the invoice is opened (shipped orders only).
  invoice: {
    number: { type: String, default: '' },
    date:   { type: Date, default: null },
  },
  // Filled in when the order is handed to the courier.
  shipment: {
    courier:        { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    trackingUrl:    { type: String, default: '' },
    shippedAt:      { type: Date, default: null },
  },

  // What happened to the order, oldest first.
  history: { type: [historySchema], default: [] },

  status:   {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  shippingAddress: {
    fullName: String,
    phone:    String,
    houseNo:  String,
    address:  String,
    landmark: String,
    city:     String,
    state:    String,
    pincode:  String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);