const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const ReturnRequest = require('../models/ReturnRequest');
const { protect, adminOnly, teamOnly, isTeam } = require('../middleware/authMiddleware');
const { adjustStock } = require('../utils/stock');
const { sendMailLater } = require('../utils/mailer');
const emails = require('../utils/emails');
const rzp = require('../utils/razorpay');
const { parsePrice } = require('../utils/price');
const { pushLog, rupees } = require('../utils/orderLog');
const credit = require('../utils/credit');

// "₹990 to name@okaxis + ₹500 as store credit"
function refundWords(rf = {}) {
  const amt = (n) => rupees(n);
  if (rf.method === 'credit') return `${amt(rf.amount)} as store credit`;
  const where = rf.method === 'upi' ? `by UPI${rf.reference ? ` · ref ${rf.reference}` : ''}` : 'to the original payment';
  const c = Number(rf.creditAmount) || 0;
  return c > 0 ? `${amt(rf.amount - c)} ${where} + ${amt(c)} as store credit` : `${amt(rf.amount)} ${where}`;
}

const pieces = (items) => {
  const n = items.reduce((t, i) => t + (Number(i.qty) || 0), 0);
  return `${n} piece${n === 1 ? '' : 's'}`;
};
const RETURN_WORDS = {
  Approved: 'approved', Rejected: 'declined', Received: 'received back at the shop', Exchanged: 'sent out in the new size',
};

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
      refundTo: order.payment?.method === 'credit' ? 'credit' : paidOnline(order) ? 'original' : 'upi',
      // Part of the order paid with store credit comes back as credit.
      creditShare: order.payment?.method === 'credit' ? 1
        : (Number(order.payment?.credit) || 0) / ((Number(order.total) || Number(order.subtotal)) || 1),
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
      const amount = refundFor(order, items);
      const wantsCredit = req.body.refundTo === 'credit' || order.payment?.method === 'credit';
      const { credit: creditAmount } = credit.splitRefund(order, amount, wantsCredit);
      if (wantsCredit) {
        refund = { amount, method: 'credit', creditAmount };
      } else if (paidOnline(order)) {
        refund = { amount, method: 'razorpay', creditAmount };
      } else {
        const upi = typeof req.body.refundUpi === 'string' ? req.body.refundUpi.trim() : '';
        if (!UPI_RE.test(upi)) return res.status(400).json({ message: 'Enter the UPI ID we should send your refund to, like name@okaxis.' });
        refund = { amount, method: 'upi', upi, creditAmount };
      }
    }

    const request = await ReturnRequest.create({ order: order._id, user: req.user._id, type, reason, note, items, refund });
    await pushLog(Order, order._id, 'return', `${type === 'exchange' ? 'Exchange' : 'Return'} requested · ${pieces(items)} · ${reason}`, req.user);
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
router.get('/', protect, teamOnly, async (req, res) => {
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
router.put('/:id', protect, teamOnly, async (req, res) => {
  try {
    const r = await ReturnRequest.findById(req.params.id).populate('user', 'name email');
    if (!r) return res.status(404).json({ message: 'Request not found' });

    const status = req.body.status;
    const statusBefore = r.status;
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
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only the owner can send refunds.' });
        const order = await Order.findById(r.order);
        const amount = r.refund?.amount || (order ? refundFor(order, r.items) : 0);
        const wantsCredit = r.refund?.method === 'credit';
        const split = order ? credit.splitRefund(order, amount, wantsCredit) : { credit: wantsCredit ? amount : 0, money: wantsCredit ? 0 : amount };
        let paid = {};
        if (split.money > 0) {
          if (order && paidOnline(order)) {
            try {
              const rf = await rzp.refund(order.payment.razorpayPaymentId, split.money);
              paid = { method: 'razorpay', reference: rf.id || '' };
            } catch (err) {
              return res.status(502).json({ message: `Razorpay refused the refund (${err.message}). Try again, or refund it from the Razorpay dashboard and then mark it with the reference.` });
            }
          } else {
            const ref = typeof req.body.reference === 'string' ? req.body.reference.trim().slice(0, 60) : '';
            if (!ref) {
              return res.status(400).json({ message: `Send ₹${split.money.toLocaleString('en-IN')} to ${r.refund?.upi || 'the customer'} first, then add the UPI reference number.` });
            }
            paid = { method: 'upi', reference: ref };
          }
        }
        if (split.credit > 0) {
          await credit.add(r.user?._id || r.user, split.credit, 'refund', `Return #${String(r._id).slice(-8).toUpperCase()}`, { order: r.order });
        }
        Object.assign(r.refund, {
          amount, creditAmount: split.credit, refundedAt: new Date(),
          method: split.money > 0 ? paid.method : 'credit', reference: paid.reference || '',
        });
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
    // Write it on the order's activity log too.
    if (r.status !== statusBefore) {
      const kind = r.type === 'exchange' ? 'Exchange' : 'Return';
      if (r.status === 'Refunded') {
        await pushLog(Order, r.order, 'refund', `Return refunded · ${refundWords(r.refund)}`, req.user);
      } else {
        await pushLog(Order, r.order, 'return', `${kind} ${RETURN_WORDS[r.status] || r.status.toLowerCase()}`, req.user);
      }
    }
    if (status) notify(r, r.user?.email, r.user?.name);
    res.json(r);
  } catch (err) {
    res.status(400).json({ message: 'Could not update the request.' });
  }
});

module.exports = router;
module.exports.refundWords = refundWords;
