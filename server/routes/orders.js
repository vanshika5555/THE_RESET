const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { parsePrice } = require('../utils/price');
const { deliveryCharge } = require('../utils/shipping');
const Coupon = require('../models/Coupon');
const { protect, adminOnly } = require('../middleware/authMiddleware');

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
        price: product.price,
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

    const order = await Order.create({
      user: req.user._id,
      items: verifiedItems,
      subtotal,
      discount,
      couponCode: appliedCode,
      delivery,
      total,
      shippingAddress,
    });

    // count the redemption once the order exists
    if (coupon) {
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
    }

    // Take the sold pieces off the shelf.
    for (const item of verifiedItems) {
      await Product.updateOne(
        { _id: item.product, 'stock.size': item.size },
        { $inc: { 'stock.$.qty': -item.qty } }
      );
    }

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

    const wasCancelled = order.status === 'Cancelled';
    order.status = req.body.status;
    const updated = await order.save();

    // Restock if an admin cancels an order that was not already cancelled.
    if (!wasCancelled && req.body.status === 'Cancelled') {
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product, 'stock.size': item.size },
          { $inc: { 'stock.$.qty': item.qty } }
        );
      }
    }

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

    order.status = 'Cancelled';
    const updated = await order.save();

    // Put the pieces back on the shelf.
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product, 'stock.size': item.size },
        { $inc: { 'stock.$.qty': item.qty } }
      );
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
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