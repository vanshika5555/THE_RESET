const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { parsePrice, formatINR } = require('../utils/price');
const { deliveryCharge, COD_MAX, COD_FEE } = require('../utils/shipping');
const rzp = require('../utils/razorpay');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendMailLater } = require('../utils/mailer');
const emails = require('../utils/emails');

const ADDRESS_FIELDS = ['fullName', 'phone', 'houseNo', 'address', 'landmark', 'city', 'state', 'pincode'];
const cleanAddress = (a = {}) => Object.fromEntries(
  ADDRESS_FIELDS.map(k => [k, typeof a[k] === 'string' ? a[k].trim().slice(0, 200) : ''])
);

const { reserve, restock } = require('../utils/stock');

// Free text from the checkout: trimmed, single-spaced lines, length-capped.
const cleanText = (v, max) => (typeof v === 'string'
  ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
  : '');
const cleanGift = (g) => (g && g.isGift
  ? { isGift: true, to: cleanText(g.to, 60).replace(/\n/g, ' '), message: cleanText(g.message, 250) }
  : { isGift: false, to: '', message: '' });
const { buildShipment } = require('../utils/couriers');
const { ensureInvoiceNumber, renderInvoice } = require('../utils/invoice');

// Email the customer about their order. Never blocks or fails the request.
async function notify(order, template) {
  try {
    const user = order.user && order.user.email
      ? order.user
      : await User.findById(order.user).select('name email');
    if (!user) return;
    const msg = template({ name: user.name, order });
    if (msg) sendMailLater({ to: user.email, ...msg });
  } catch { /* email is best-effort */ }
}

// GET /api/orders/payment-options — what checkout can offer (public)
router.get('/payment-options', (req, res) => {
  res.json({
    cod: { available: true, fee: COD_FEE, max: COD_MAX },
    online: { available: rzp.enabled() },
  });
});

/**
 * POST /api/orders — place an order.
 *
 * The browser tells us WHAT was ordered. It does not get to tell us what
 * it costs: every price and the final total are read from the database,
 * so a tampered request cannot buy a jacket for one rupee.
 */
router.post('/', protect, async (req, res) => {
  const { items, shippingAddress, couponCode } = req.body;

  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    if (!shippingAddress || !shippingAddress.pincode || !shippingAddress.phone) {
      return res.status(400).json({ message: 'A complete delivery address is required' });
    }

    const verifiedItems = [];
    let subtotal = 0;

    for (const line of items) {
      const qty = Math.floor(Number(line.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
        return res.status(400).json({ message: `Invalid quantity for ${line.name || 'an item'}` });
      }

      const productId = line.product || line._id;
      const product = productId ? await Product.findById(productId) : null;
      if (!product) {
        return res.status(400).json({ message: `${line.name || 'An item'} is no longer available` });
      }
      if (!product.inStock) {
        return res.status(400).json({ message: `${product.name} is out of stock` });
      }
      if (line.size && !product.sizes.includes(line.size)) {
        return res.status(400).json({ message: `${product.name} is not available in size ${line.size}` });
      }

      const available = product.qtyForSize(line.size);
      if (available <= 0) {
        return res.status(400).json({
          message: `${product.name} (size ${line.size}) has just sold out`,
        });
      }
      if (available < qty) {
        return res.status(400).json({
          message: `Only ${available} left of ${product.name} in size ${line.size}`,
        });
      }

      // Prices come from the database, never from the request.
      const unitPrice = parsePrice(product.price);
      subtotal += unitPrice * qty;

      verifiedItems.push({
        product: product._id,
        name:  product.colorName ? `${product.name} — ${product.colorName}` : product.name,
        price: formatINR(unitPrice),     // frozen as text on the order, e.g. "₹2,990"
        image: (product.images && product.images[0]) || product.image,
        color: product.color,
        size:  line.size,
        qty,
      });
    }

    // Any discount is worked out here too — the browser's figure is ignored.
    let discount = 0;
    let appliedCode = '';
    let coupon = null;

    if (couponCode) {
      coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase().trim() });
      if (!coupon) {
        return res.status(400).json({ message: 'That discount code was not recognised.' });
      }
      const result = coupon.check(subtotal);
      if (!result.ok) {
        return res.status(400).json({ message: result.reason });
      }
      discount = result.discount;
      appliedCode = coupon.code;
    }

    const afterDiscount = subtotal - discount;
    const delivery = deliveryCharge(afterDiscount);

    const method = req.body.paymentMethod === 'online' ? 'online' : 'cod';
    if (method === 'online' && !rzp.enabled()) {
      return res.status(400).json({ message: 'Online payment isn’t available yet. Please choose cash on delivery.' });
    }
    const codFee = method === 'cod' ? COD_FEE : 0;
    const total = afterDiscount + delivery + codFee;
    if (method === 'cod' && total > COD_MAX) {
      return res.status(400).json({
        message: `Cash on delivery is available on orders up to ₹${COD_MAX.toLocaleString('en-IN')}. Remove something from your bag, or contact us to arrange payment.`,
      });
    }

    // Reserve stock line by line; if any line has just sold out, put back
    // what was already taken and tell the customer exactly which piece.
    const reserved = [];
    for (const item of verifiedItems) {
      if (await reserve(item)) {
        reserved.push(item);
      } else {
        await restock(reserved);
        return res.status(409).json({
          message: `${item.name} (size ${item.size}) just sold out. Please update your bag.`,
        });
      }
    }

    // Count the code's use the same way — only if it still has uses left.
    if (coupon) {
      const filter = coupon.usageLimit > 0
        ? { _id: coupon._id, usedCount: { $lt: coupon.usageLimit } }
        : { _id: coupon._id };
      const r = await Coupon.updateOne(filter, { $inc: { usedCount: 1 } });
      if (r.modifiedCount !== 1) {
        await restock(reserved);
        return res.status(409).json({ message: 'That discount code has just been fully claimed.' });
      }
    }

    let order;
    try {
      order = await Order.create({
        user: req.user._id,
        items: verifiedItems,
        subtotal,
        discount,
        couponCode: appliedCode,
        delivery,
        total,
        shippingAddress: cleanAddress(shippingAddress),
        payment: method === 'online'
          ? { method: 'online', status: 'Awaiting', codFee: 0 }
          : { method: 'cod', status: 'Pending', codFee },
        gift: cleanGift(req.body.gift),
        deliveryNote: cleanText(req.body.deliveryNote, 200),
      });
    } catch (err) {
      await restock(reserved);
      if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } });
      throw err;
    }

    if (method === 'online') {
      // Ask Razorpay for a payment order; the shopper pays in the Razorpay window.
      try {
        const ro = await rzp.createOrder({ amount: total, receipt: String(order._id), notes: { order: String(order._id) } });
        order.payment.razorpayOrderId = ro.id;
        await order.save();
        return res.status(201).json({
          ...order.toObject(),
          razorpay: { key: rzp.keyId(), orderId: ro.id, amount: ro.amount, currency: 'INR' },
        });
      } catch (err) {
        await releaseOrder(order, 'Void');
        return res.status(502).json({ message: 'Online payment couldn’t start just now. Try again, or choose cash on delivery.' });
      }
    }

    notify(order, emails.orderPlaced);
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * Cancels an online order that was never paid and puts everything back:
 * the stock and the discount code's use. Safe to call twice.
 */
async function releaseOrder(order, paymentStatus = 'Void') {
  const r = await Order.updateOne(
    { _id: order._id, 'payment.status': 'Awaiting' },
    { $set: { status: 'Cancelled', 'payment.status': paymentStatus } }
  );
  if (!r.modifiedCount) return false;
  await restock(order.items);
  if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  return true;
}

// Marks an online order paid (once) and sends the confirmation email.
async function markPaid(order, paymentId) {
  const r = await Order.updateOne(
    { _id: order._id, 'payment.status': 'Awaiting' },
    { $set: { 'payment.status': 'Paid', 'payment.paidAt': new Date(), 'payment.razorpayPaymentId': paymentId } }
  );
  const fresh = await Order.findById(order._id);
  if (r.modifiedCount) notify(fresh, emails.orderPlaced);
  return fresh;
}

// POST /api/orders/:id/pay — the Razorpay window reports a successful payment
router.post('/:id/pay', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.user) !== String(req.user._id)) return res.status(404).json({ message: 'Order not found' });
    if (order.payment?.method !== 'online') return res.status(400).json({ message: 'This order is paid on delivery.' });
    if (order.payment.status === 'Paid') return res.json(order);

    const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = req.body || {};
    if (!pid || oid !== order.payment.razorpayOrderId || !rzp.validCheckoutSignature(oid, pid, sig)) {
      return res.status(400).json({ message: 'We couldn’t confirm that payment. If money left your account, it will be refunded automatically.' });
    }
    if (order.payment.status !== 'Awaiting') {
      // Paid after the order had already timed out — give the money back.
      try { await rzp.refund(pid); } catch { /* reported below */ }
      return res.status(409).json({ message: 'This order had expired before the payment arrived, so we’ve refunded it. Please place the order again.' });
    }
    res.json(await markPaid(order, pid));
  } catch (err) {
    res.status(500).json({ message: 'Could not confirm the payment. Check My Orders in a minute.' });
  }
});

// POST /api/orders/:id/abandon — the shopper closed the payment window
router.post('/:id/abandon', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.user) !== String(req.user._id)) return res.status(404).json({ message: 'Order not found' });
    await releaseOrder(order, 'Void');
    res.json({ released: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not release the order.' });
  }
});

// GET /api/orders/myorders — the signed-in customer's own orders
router.get('/myorders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id, 'payment.status': { $ne: 'Awaiting' } }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders — every order (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find({ 'payment.status': { $ne: 'Awaiting' } })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/orders/:id/status — move an order along (admin only)
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  const allowed = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
  try {
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ message: 'Unknown order status' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const previous = order.status;
    if (previous === 'Cancelled' && req.body.status !== 'Cancelled') {
      return res.status(400).json({ message: 'A cancelled order cannot be reopened — its stock has already gone back on sale.' });
    }
    // Shipping can carry the courier and tracking number in the same request.
    if (req.body.shipment !== undefined) {
      const { shipment, error } = buildShipment(req.body.shipment);
      if (error) return res.status(400).json({ message: error });
      if (shipment) Object.assign(order.shipment, shipment);
    }
    order.status = req.body.status;
    if (req.body.status === 'Shipped' && !order.shipment.shippedAt) order.shipment.shippedAt = new Date();
    if (req.body.status === 'Delivered' && !order.deliveredAt) order.deliveredAt = new Date();
    // Cash is collected when the parcel is handed over.
    if (order.payment && order.payment.method === 'cod') {
      if (req.body.status === 'Delivered' && order.payment.status === 'Pending') {
        order.payment.status = 'Paid';
        order.payment.paidAt = new Date();
      }
      if (req.body.status === 'Cancelled' && order.payment.status === 'Pending') order.payment.status = 'Void';
    }
    // Cancelling an order that was paid online sends the money back first.
    if (previous !== 'Cancelled' && req.body.status === 'Cancelled'
        && order.payment?.method === 'online' && order.payment.status === 'Paid') {
      try {
        const rf = await rzp.refund(order.payment.razorpayPaymentId);
        order.payment.status = 'Refunded';
        order.payment.refundId = rf.id || '';
      } catch (err) {
        return res.status(502).json({ message: `The refund didn’t go through (${err.message}), so the order wasn’t cancelled. Try again, or refund it from the Razorpay dashboard first.` });
      }
    }
    const updated = await order.save();

    if (previous !== 'Cancelled' && req.body.status === 'Cancelled') {
      await restock(order.items);
    }
    if (previous !== req.body.status) {
      notify(updated, emails.orderStatus);
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * PUT /api/orders/:id/shipment — add or correct tracking details (admin only).
 * No email goes out; the customer sees the change on their order page.
 */
router.put('/:id/shipment', protect, adminOnly, async (req, res) => {
  try {
    const { shipment, error } = buildShipment(req.body);
    if (error) return res.status(400).json({ message: error });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'This order was cancelled.' });
    }
    if (shipment) Object.assign(order.shipment, shipment);
    else Object.assign(order.shipment, { courier: '', trackingNumber: '', trackingUrl: '' });
    const updated = await order.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * PUT /api/orders/:id/cancel — a customer cancels their own order.
 * Only while it is still Pending; once it is packed, they need to contact us.
 */
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not your order' });
    }
    if (order.status !== 'Pending') {
      return res.status(400).json({
        message: 'This order has already been processed. Please contact us to cancel it.',
      });
    }

    // Only flip it if it is still Pending at the moment of writing, so a
    // double-tap cannot put the stock back twice.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: 'Pending' },
      order.payment?.method === 'cod' && order.payment.status === 'Pending'
        ? { status: 'Cancelled', 'payment.status': 'Void' }
        : { status: 'Cancelled' },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: 'This order has already been processed.' });
    }

    await restock(order.items);
    // Paid online? Refund straight away.
    if (updated.payment?.method === 'online' && updated.payment.status === 'Paid') {
      try {
        const rf = await rzp.refund(updated.payment.razorpayPaymentId);
        updated.payment.status = 'Refunded';
        updated.payment.refundId = rf.id || '';
        await updated.save();
      } catch (err) {
        console.error(`Refund failed for order ${updated._id}:`, err.message);
      }
    }
    notify(updated, emails.orderStatus);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/orders/:id/invoice — the invoice as a printable page.
 * Only for orders that have shipped. The owner or an admin may open it.
 */
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    let order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const ownerId = order.user?._id || order.user;
    const isAdmin = req.user.role === 'admin';
    if (String(ownerId) !== String(req.user._id) && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }
    if (!['Shipped', 'Delivered'].includes(order.status)) {
      return res.status(400).json({ message: 'The invoice is ready once your order ships.' });
    }

    order = await ensureInvoiceNumber(order);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'private, no-store');
    res.send(renderInvoice(order));
  } catch (err) {
    res.status(500).json({ message: 'Could not make the invoice. Try again.' });
  }
});

// GET /api/orders/:id — one order. Only its owner, or an admin, may see it.
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const ownerId = order.user?._id || order.user;
    const isOwner = String(ownerId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/orders/:id/note — save the shop's private note on an order (admin only)
router.put('/:id/note', protect, adminOnly, async (req, res) => {
  try {
    const note = String(req.body.note ?? '').slice(0, 2000);
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { adminNote: note },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Order not found' });
    res.json({ adminNote: updated.adminNote });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
module.exports.releaseOrder = releaseOrder;
module.exports.markPaid = markPaid;
