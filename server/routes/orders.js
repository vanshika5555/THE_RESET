const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { parsePrice, formatINR } = require('../utils/price');
const { deliveryCharge, COD_MAX, COD_FEE } = require('../utils/shipping');
const rzp = require('../utils/razorpay');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { protect, adminOnly, teamOnly, isTeam } = require('../middleware/authMiddleware');
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
const { log, entry, forCustomer, rupees } = require('../utils/orderLog');
const credit = require('../utils/credit');

// "Delhivery · 123456" — or '' when there's no tracking number.
const trackingLine = (order) => (order.shipment?.trackingNumber
  ? [order.shipment.courier, order.shipment.trackingNumber].filter(Boolean).join(' · ')
  : '');

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

    // Store credit: covers the whole order, or part of it with the rest
    // paid as usual. The balance is read here and taken off further down.
    const base = afterDiscount + delivery;
    const balance = req.body.useCredit ? await credit.balanceOf(req.user._id) : 0;
    const coversAll = balance > 0 && balance >= base;

    let method = req.body.paymentMethod === 'online' ? 'online' : 'cod';
    if (coversAll) method = 'credit';
    if (method === 'online' && !rzp.enabled()) {
      return res.status(400).json({ message: 'Online payment isn’t available yet. Please choose cash on delivery.' });
    }
    const codFee = method === 'cod' ? COD_FEE : 0;
    const total = base + codFee;
    const creditUsed = credit.round(Math.min(balance, total));
    const due = credit.round(total - creditUsed);
    if (method === 'cod' && due > COD_MAX) {
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

    // Take the credit off now — only if it's all still there.
    if (creditUsed > 0 && !(await credit.spend(req.user._id, creditUsed))) {
      await restock(reserved);
      if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } });
      return res.status(409).json({ message: 'Your store credit has just changed. Please check the total and try again.' });
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
        payment: method === 'credit'
          ? { method: 'credit', status: 'Paid', codFee: 0, credit: creditUsed, paidAt: new Date() }
          : method === 'online'
            ? { method: 'online', status: 'Awaiting', codFee: 0, credit: creditUsed }
            : { method: 'cod', status: 'Pending', codFee, credit: creditUsed },
        gift: cleanGift(req.body.gift),
        deliveryNote: cleanText(req.body.deliveryNote, 200),
        history: [entry('placed', `Order placed · ${rupees(total)} · ${
          method === 'credit' ? 'paid with store credit'
            : `${creditUsed ? `${rupees(creditUsed)} store credit + ` : ''}${method === 'online' ? 'paying online' : 'cash on delivery'}`}`, req.user)],
      });
    } catch (err) {
      await restock(reserved);
      if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } });
      if (creditUsed > 0) await credit.add(req.user._id, creditUsed, 'returned', 'Order could not be placed');
      throw err;
    }
    if (creditUsed > 0) await credit.logSpent(req.user._id, creditUsed, order._id);

    if (method === 'online') {
      // Ask Razorpay for a payment order; the shopper pays in the Razorpay window.
      try {
        const ro = await rzp.createOrder({ amount: due, receipt: String(order._id), notes: { order: String(order._id) } });
        order.payment.razorpayOrderId = ro.id;
        await order.save();
        return res.status(201).json({
          ...forCustomer(order),
          razorpay: { key: rzp.keyId(), orderId: ro.id, amount: ro.amount, currency: 'INR' },
        });
      } catch (err) {
        await releaseOrder(order, 'Void');
        return res.status(502).json({ message: 'Online payment couldn’t start just now. Try again, or choose cash on delivery.' });
      }
    }

    notify(order, emails.orderPlaced);
    res.status(201).json(forCustomer(order));
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
    {
      $set: { status: 'Cancelled', 'payment.status': paymentStatus },
      $push: { history: entry('cancelled', 'Online payment wasn’t completed, so the order was cancelled', null) },
    }
  );
  if (!r.modifiedCount) return false;
  await restock(order.items);
  if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  await creditBack(order);
  return true;
}

// A cancelled order puts its store credit back, and says so on the order.
async function creditBack(order) {
  const back = await credit.giveBack(order, 'Order cancelled');
  if (back) {
    await Order.updateOne({ _id: order._id }, { $push: { history: entry('refund', `${rupees(back)} store credit given back`, null) } });
  }
  return back;
}

// Marks an online order paid (once) and sends the confirmation email.
async function markPaid(order, paymentId) {
  const r = await Order.updateOne(
    { _id: order._id, 'payment.status': 'Awaiting' },
    {
      $set: { 'payment.status': 'Paid', 'payment.paidAt': new Date(), 'payment.razorpayPaymentId': paymentId },
      $push: { history: entry('paid', `Paid online · ${rupees(credit.amountDue(order))}`, null) },
    }
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
    if (order.payment.status === 'Paid') return res.json(forCustomer(order));

    const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = req.body || {};
    if (!pid || oid !== order.payment.razorpayOrderId || !rzp.validCheckoutSignature(oid, pid, sig)) {
      return res.status(400).json({ message: 'We couldn’t confirm that payment. If money left your account, it will be refunded automatically.' });
    }
    if (order.payment.status !== 'Awaiting') {
      // Paid after the order had already timed out — give the money back.
      try { await rzp.refund(pid); } catch { /* reported below */ }
      return res.status(409).json({ message: 'This order had expired before the payment arrived, so we’ve refunded it. Please place the order again.' });
    }
    res.json(forCustomer(await markPaid(order, pid)));
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
    res.json(orders.map(forCustomer));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders — every order (admin only)
router.get('/', protect, teamOnly, async (req, res) => {
  try {
    const orders = await Order.find({ 'payment.status': { $ne: 'Awaiting' } })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Moves one order to a new status — confirming, shipping (optionally with
 * tracking), delivering or cancelling — with everything that goes with it:
 * cash marked collected, stock and credit put back, refunds, the activity
 * log and the customer's email. Used for single orders and in bulk.
 */
async function changeStatus(orderId, status, user, shipmentInput) {
  const allowed = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
  const req = { body: { status, shipment: shipmentInput }, user };
  const fail = (code, message) => ({ code, body: { message } });
  try {
    if (!allowed.includes(req.body.status)) return fail(400, 'Unknown order status');
    const order = await Order.findById(orderId);
    if (!order) return fail(404, 'Order not found');

    const previous = order.status;
    if (previous === 'Cancelled' && req.body.status !== 'Cancelled') {
      return fail(400, 'A cancelled order cannot be reopened — its stock has already gone back on sale.');
    }
    // Shipping can carry the courier and tracking number in the same request.
    const trackingBefore = trackingLine(order);
    if (req.body.shipment !== undefined) {
      const { shipment, error } = buildShipment(req.body.shipment);
      if (error) return fail(400, error);
      if (shipment) Object.assign(order.shipment, shipment);
    }
    const trackingNow = trackingLine(order);
    order.status = req.body.status;
    if (req.body.status === 'Shipped' && !order.shipment.shippedAt) order.shipment.shippedAt = new Date();
    if (req.body.status === 'Delivered' && !order.deliveredAt) order.deliveredAt = new Date();
    // Cash is collected when the parcel is handed over.
    let cashCollected = false;
    if (order.payment && order.payment.method === 'cod') {
      if (req.body.status === 'Delivered' && order.payment.status === 'Pending') {
        cashCollected = true;
        order.payment.status = 'Paid';
        order.payment.paidAt = new Date();
      }
      if (req.body.status === 'Cancelled' && order.payment.status === 'Pending') order.payment.status = 'Void';
    }
    // Paid entirely with store credit: cancelling gives it all back as credit.
    if (previous !== 'Cancelled' && req.body.status === 'Cancelled' && order.payment?.method === 'credit') {
      order.payment.status = 'Refunded';
    }
    // Cancelling an order that was paid online sends the money back first —
    // that's the owner's call, not staff's.
    if (previous !== 'Cancelled' && req.body.status === 'Cancelled'
        && order.payment?.method === 'online' && order.payment.status === 'Paid') {
      if (req.user.role !== 'admin') {
        return fail(403, 'This order was paid online — cancelling it refunds the customer, so only the owner can do it.');
      }
      try {
        const rf = await rzp.refund(order.payment.razorpayPaymentId);
        order.payment.status = 'Refunded';
        order.payment.refundId = rf.id || '';
      } catch (err) {
        return fail(502, `The refund didn’t go through (${err.message}), so the order wasn’t cancelled. Try again, or refund it from the Razorpay dashboard first.`);
      }
    }

    // Activity log
    if (trackingNow && trackingNow !== trackingBefore) log(order, 'shipment', `Tracking added · ${trackingNow}`, req.user);
    if (previous !== req.body.status) {
      if (req.body.status === 'Cancelled') {
        log(order, 'cancelled', 'Order cancelled by the shop', req.user);
        if (order.payment?.status === 'Refunded' && order.payment.refundId) {
          log(order, 'refund', `${rupees(credit.amountDue(order))} refunded to the original payment`, req.user);
        }
      } else {
        log(order, 'status', `Marked ${req.body.status}${cashCollected ? ` · ${rupees(credit.amountDue(order))} cash collected` : ''}`, req.user);
      }
    }
    const updated = await order.save();

    if (previous !== 'Cancelled' && req.body.status === 'Cancelled') {
      await restock(order.items);
      if (await creditBack(updated)) updated.history = (await Order.findById(updated._id).select('history')).history;
    }
    if (previous !== req.body.status) {
      notify(updated, emails.orderStatus);
    }
    // A friend's first order arriving pays out "invite a friend" credit.
    if (previous !== 'Delivered' && req.body.status === 'Delivered') {
      require('../utils/referrals').rewardIfDue(updated);
    }

    return { code: 200, body: updated };
  } catch (err) {
    return fail(400, err.message);
  }
}



// PUT /api/orders/:id/status — move an order along (admin only)
router.put('/:id/status', protect, teamOnly, async (req, res) => {
  const r = await changeStatus(req.params.id, req.body.status, req.user, req.body.shipment);
  res.status(r.code).json(r.body);
});

// POST /api/orders/bulk-status — { ids: [...], status } several at once.
// Only forward moves (confirm, ship, deliver) — cancelling stays one by one.
router.post('/bulk-status', protect, teamOnly, async (req, res) => {
  const { ids, status } = req.body || {};
  if (!['Confirmed', 'Shipped', 'Delivered'].includes(status)) {
    return res.status(400).json({ message: 'In bulk, orders can be confirmed, shipped or delivered.' });
  }
  const list = Array.isArray(ids) ? [...new Set(ids.map(String))].filter((id) => /^[a-f0-9]{24}$/i.test(id)).slice(0, 200) : [];
  if (!list.length) return res.status(400).json({ message: 'Pick at least one order.' });
  const done = [];
  const failed = [];
  for (const id of list) {
    const r = await changeStatus(id, status, req.user);
    if (r.code === 200) done.push(r.body);
    else failed.push({ id, message: r.body.message });
  }
  res.json({ done, failed });
});

/**
 * PUT /api/orders/:id/shipment — add or correct tracking details (admin only).
 * No email goes out; the customer sees the change on their order page.
 */
router.put('/:id/shipment', protect, teamOnly, async (req, res) => {
  try {
    const { shipment, error } = buildShipment(req.body);
    if (error) return res.status(400).json({ message: error });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'This order was cancelled.' });
    }
    const before = trackingLine(order);
    if (shipment) Object.assign(order.shipment, shipment);
    else Object.assign(order.shipment, { courier: '', trackingNumber: '', trackingUrl: '' });
    const now = trackingLine(order);
    if (now !== before) {
      log(order, 'shipment', now ? `${before ? 'Tracking changed' : 'Tracking added'} · ${now}` : 'Tracking removed', req.user);
    }
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
      {
        $set: order.payment?.method === 'cod' && order.payment.status === 'Pending'
          ? { status: 'Cancelled', 'payment.status': 'Void' }
          : order.payment?.method === 'credit'
            ? { status: 'Cancelled', 'payment.status': 'Refunded' }
            : { status: 'Cancelled' },
        $push: { history: entry('cancelled', 'Cancelled by the customer', req.user) },
      },
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
        log(updated, 'refund', `${rupees(credit.amountDue(updated))} refunded to the original payment`, null);
        await updated.save();
      } catch (err) {
        console.error(`Refund failed for order ${updated._id}:`, err.message);
      }
    }
    if (await creditBack(updated)) updated.history = (await Order.findById(updated._id).select('history')).history;
    notify(updated, emails.orderStatus);
    res.json(forCustomer(updated));
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
    const isAdmin = isTeam(req.user);
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
    const isAdmin = isTeam(req.user);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    // The internal note and staff names stay with the shop.
    res.json(isAdmin ? order : forCustomer(order));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/orders/:id/note — save the shop's private note on an order (admin only)
router.put('/:id/note', protect, teamOnly, async (req, res) => {
  try {
    const note = String(req.body.note ?? '').slice(0, 2000);
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (note !== (order.adminNote || '')) {
      log(order, 'note', note.trim() ? (order.adminNote ? 'Internal note edited' : 'Internal note added') : 'Internal note cleared', req.user);
      order.adminNote = note;
      await order.save();
    }
    res.json({ adminNote: order.adminNote, history: order.history });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
module.exports.releaseOrder = releaseOrder;
module.exports.markPaid = markPaid;
