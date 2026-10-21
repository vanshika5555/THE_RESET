const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const ReturnRequest = require('../models/ReturnRequest');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { adjustStock } = require('../utils/stock');
const { sendMailLater } = require('../utils/mailer');
const emails = require('../utils/emails');
const rzp = require('../utils/razorpay');
const { parsePrice } = require('../utils/price');

const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/;
const paidOnline = (order) => order.payment && order.payment.method === 'online' && order.payment.razorpayPaymentId;

// What these pieces cost after their share of the order's discount.
function refundFor(order, lines) {
  const value = lines.reduce((n, l) => n + parsePrice(l.price) * l.qty, 0);
  const share = order.subtotal ? (value / order.subtotal) * (Number(order.discount) || 0) : 0;
  return Math.max(0, Math.round((value - share) * 100) / 100);
}

const WINDOW_DAYS = 7;   // matches the Help page
const REASONS = ['Too small', 'Too big', 'Not as pictured', 'Quality issue', 'Arrived damaged', 'Wrong item sent', 'Changed my mind'];

// Where each status may go next.
const NEXT = {
  Requested: ['Approved', 'Rejected'],
  Approved:  ['Received', 'Rejected'],
  Received:  ['Refunded', 'Exchanged'],
  Rejected:  [],
  Refunded:  [],
  Exchanged: [],
};

const deliveredOn = (order) => order.deliveredAt || (order.status === 'Delivered' ? order.updatedAt : null);

function windowLeft(order) {
  const d = deliveredOn(order);
  if (!d) return -1;
  const ms = new Date(d).getTime() + WINDOW_DAYS * 864e5 - Date.now();
  return Math.ceil(ms / 864e5);
}

// How many of each order line are already in an open or finished request.
async function alreadyRequested(orderId) {
  const prior = await ReturnRequest.find({ order: orderId, status: { $ne: 'Rejected' } }).lean();
  const used = {};
  prior.forEach(r => r.items.forEach(i => { used[String(i.orderItem)] = (used[String(i.orderItem)] || 0) + i.qty; }));
  return used;
}

async function notify(request, userEmail, userName) {
  try {
    const msg = emails.returnUpdate({ name: userName, request });
    if (msg && userEmail) sendMailLater({ to: userEmail, ...msg });
  } catch { /* best effort */ }
}

// GET /api/returns/options/:orderId — can this order be returned, and what's left
router.get('/options/:orderId', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order || String(order.user) !== String(req.user._id)) return res.status(404).json({ message: 'Order not found' });

    const daysLeft = windowLeft(order);
    const used = await alreadyRequested(order._id);
    const products = await Product.find({ _id: { $in: order.items.map(i => i.product) } }).select('sizes').lean();
    const sizesOf = Object.fromEntries(products.map(p => [String(p._id), p.sizes || []]));

    res.json({
      eligible: order.status === 'Delivered' && daysLeft > 0,
      // Paid online → refunds go back automatically; cash → we ask for a UPI ID.
      refundTo: paidOnline(order) ? 'original' : 'upi',
      daysLeft: Math.max(0, daysLeft),
      reasons: REASONS,
      items: order.items.map(i => ({
        orderItem: i._id,
        name: i.name, image: i.image, price: i.price, size: i.size,
        qty: i.qty,
        available: Math.max(0, i.qty - (used[String(i._id)] || 0)),
        sizes: sizesOf[String(i.product)] || [],
      })),
    });
  } catch (err) {
    res.status(400).json({ message: 'Could not load return options.' });
  }
});

// POST /api/returns — { orderId, type, reason, note, items: [{ orderItem, qty, exchangeSize }] }
router.post('/', protect, async (req, res) => {
  try {
    const { orderId, type } = req.body;
    const reason = typeof req.body.reason === 'string' ? req.body.reason : '';
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
    const lines = Array.isArray(req.body.items) ? req.body.items : [];

    if (!['return', 'exchange'].includes(type)) return res.status(400).json({ message: 'Choose return or exchange.' });
    if (!REASONS.includes(reason)) return res.status(400).json({ message: 'Choose a reason.' });
    if (!lines.length) return res.status(400).json({ message: 'Pick at least one piece.' });

    const order = await Order.findById(orderId);
    if (!order || String(order.user) !== String(req.user._id)) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Delivered') return res.status(400).json({ message: 'Returns open once the order is delivered.' });
    if (windowLeft(order) <= 0) {
      return res.status(400).json({ message: `The ${WINDOW_DAYS}-day return window for this order has closed. Contact us if something is wrong.` });
    }

    const used = await alreadyRequested(order._id);
    const items = [];
    for (const l of lines) {
      const it = order.items.id(l.orderItem);
      const qty = Math.floor(Number(l.qty));
      if (!it || !(qty >= 1)) return res.status(400).json({ message: 'One of the pieces is not in this order.' });
      const left = it.qty - (used[String(it._id)] || 0);
      if (qty > left) return res.status(400).json({ message: `${it.name}: only ${left} left to return.` });

      let exchangeSize = '';
      if (type === 'exchange') {
        exchangeSize = typeof l.exchangeSize === 'string' ? l.exchangeSize : '';
        const p = await Product.findById(it.product).select('sizes');
        if (!p || !p.sizes.includes(exchangeSize)) return res.status(400).json({ message: `Pick the new size for ${it.name}.` });
        if (exchangeSize === it.size) return res.status(400).json({ message: `${it.name}: pick a different size to exchange for.` });
      }
      items.push({ orderItem: it._id, product: it.product, name: it.name, image: it.image, price: it.price, size: it.size, qty, exchangeSize });
    }

    let refund;
    if (type === 'return') {
      if (paidOnline(order)) {
        refund = { amount: refundFor(order, items), method: 'razorpay' };
      } else {
        const upi = typeof req.body.refundUpi === 'string' ? req.body.refundUpi.trim() : '';
        if (!UPI_RE.test(upi)) return res.status(400).json({ message: 'Enter the UPI ID we should send your refund to, like name@okaxis.' });
        refund = { amount: refundFor(order, items), method: 'upi', upi };
      }
    }

    const request = await ReturnRequest.create({ order: order._id, user: req.user._id, type, reason, note, items, refund });
    notify(request, req.user.email, req.user.name);
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ message: 'Could not send the request. Please try again.' });
  }
});

// GET /api/returns/mine?order=<id> — this customer's requests
router.get('/mine', protect, async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (typeof req.query.order === 'string') filter.order = req.query.order;
    res.json(await ReturnRequest.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ message: 'Could not load your requests.' });
  }
});

// GET /api/returns — every request (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const list = await ReturnRequest.find({})
      .populate('user', 'name email')
      .populate('order', 'total createdAt shippingAddress')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Could not load returns.' });
  }
});

// PUT /api/returns/:id — { status, shopMessage } (admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const r = await ReturnRequest.findById(req.params.id).populate('user', 'name email');
    if (!r) return res.status(404).json({ message: 'Request not found' });

    const status = req.body.status;
    if (typeof req.body.shopMessage === 'string') r.shopMessage = req.body.shopMessage.slice(0, 1000);

    if (status && status !== r.status) {
      if (!(NEXT[r.status] || []).includes(status)) {
        return res.status(400).json({ message: `A request that is ${r.status} cannot move to ${status}.` });
      }
      if (status === 'Exchanged' && r.type !== 'exchange') return res.status(400).json({ message: 'This is a return, not an exchange.' });
      if (status === 'Refunded' && r.type !== 'return') return res.status(400).json({ message: 'This is an exchange, not a return.' });

      // Money back: online payments are refunded through Razorpay; cash orders
      // need the UPI transfer's reference so there's a record of it.
      if (status === 'Refunded') {
        const order = await Order.findById(r.order);
        const amount = r.refund?.amount || (order ? refundFor(order, r.items) : 0);
        if (order && paidOnline(order)) {
          try {
            const rf = await rzp.refund(order.payment.razorpayPaymentId, amount);
            Object.assign(r.refund, { amount, method: 'razorpay', reference: rf.id || '', refundedAt: new Date() });
          } catch (err) {
            return res.status(502).json({ message: `Razorpay refused the refund (${err.message}). Try again, or refund it from the Razorpay dashboard and then mark it with the reference.` });
          }
        } else {
          const ref = typeof req.body.reference === 'string' ? req.body.reference.trim().slice(0, 60) : '';
          if (!ref) {
            return res.status(400).json({ message: `Send ₹${amount.toLocaleString('en-IN')} to ${r.refund?.upi || 'the customer'} first, then add the UPI reference number.` });
          }
          Object.assign(r.refund, { amount, method: 'upi', reference: ref, refundedAt: new Date() });
        }
      }

      // Exchange: the new size goes out — make sure it is there before saying so.
      if (status === 'Exchanged') {
        const taken = [];
        for (const i of r.items) {
          if (await adjustStock(i.product, i.exchangeSize, -i.qty)) taken.push(i);
          else {
            for (const t of taken) await adjustStock(t.product, t.exchangeSize, t.qty);
            return res.status(409).json({ message: `${i.name} in size ${i.exchangeSize} is out of stock. Restock it first, or refund instead.` });
          }
        }
      }
      // The pieces are back on the shelf once received.
      if (status === 'Received' && !r.restocked) {
        for (const i of r.items) await adjustStock(i.product, i.size, i.qty);
        r.restocked = true;
      }
      r.status = status;
    }

    await r.save();
    if (status) notify(r, r.user?.email, r.user?.name);
    res.json(r);
  } catch (err) {
    res.status(400).json({ message: 'Could not update the request.' });
  }
});

module.exports = router;
