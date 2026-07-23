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

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items:    { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true },
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