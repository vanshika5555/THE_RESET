const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { parsePrice, formatINR } = require('../utils/price');
const { deliveryCharge } = require('../utils/shipping');
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
        name:  product.name,
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
    const total = afterDiscount + delivery;

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
      });
    } catch (err) {
      await restock(reserved);
      if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } });
      throw err;
    }

    notify(order, emails.orderPlaced);
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/orders/myorders — the signed-in customer's own orders
router.get('/myorders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders — every order (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find({})
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
      { status: 'Cancelled' },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: 'This order has already been processed.' });
    }

    await restock(order.items);
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