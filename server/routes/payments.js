const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const rzp = require('../utils/razorpay');
const { releaseOrder, markPaid } = require('./orders');

/**
 * Razorpay webhook — Razorpay tells the server directly when a payment is
 * captured, so an order still gets marked paid if the shopper's phone lost
 * signal or the tab closed right after paying.
 *
 * Set it up in Razorpay → Settings → Webhooks:
 *   URL     https://the-reset-api.onrender.com/api/payments/razorpay/webhook
 *   Secret  any long random text — put the same in RAZORPAY_WEBHOOK_SECRET
 *   Events  payment.captured, order.paid
 *
 * Mounted with a raw body parser (see server.js) because the signature is
 * checked against the exact bytes Razorpay sent.
 */
router.post('/razorpay/webhook', express.raw({ type: '*/*', limit: '200kb' }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!rzp.validWebhookSignature(raw, req.get('x-razorpay-signature'))) {
    return res.status(400).json({ message: 'Bad signature' });
  }
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ message: 'Bad body' }); }

  try {
    const payment = event?.payload?.payment?.entity;
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && payment?.order_id) {
      const order = await Order.findOne({ 'payment.razorpayOrderId': payment.order_id });
      if (order) {
        if (order.payment.status === 'Awaiting') {
          await markPaid(order, payment.id);
        } else if (order.payment.status === 'Void' && order.status === 'Cancelled') {
          // Paid after the order had expired — send the money back.
          try {
            const rf = await rzp.refund(payment.id);
            await Order.updateOne({ _id: order._id }, { $set: { 'payment.status': 'Refunded', 'payment.razorpayPaymentId': payment.id, 'payment.refundId': rf.id || '' } });
          } catch (err) {
            console.error(`Late payment refund failed for ${order._id}:`, err.message);
          }
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Razorpay webhook:', err.message);
    res.status(500).json({ message: 'Webhook failed' });   // Razorpay retries
  }
});

/**
 * Unpaid online orders hold stock. Every few minutes, any that are over half
 * an hour old are checked with Razorpay once more: paid → confirmed,
 * otherwise cancelled and the stock goes back on sale.
 */
const EXPIRE_AFTER = 30 * 60 * 1000;

async function sweepUnpaid() {
  if (!rzp.enabled()) return;
  const stale = await Order.find({
    'payment.status': 'Awaiting',
    createdAt: { $lte: new Date(Date.now() - EXPIRE_AFTER) },
  }).limit(50);
  for (const order of stale) {
    try {
      let captured = null;
      if (order.payment.razorpayOrderId) {
        const list = await rzp.orderPayments(order.payment.razorpayOrderId);
        captured = (list.items || []).find((p) => p.status === 'captured');
      }
      if (captured) await markPaid(order, captured.id);
      else await releaseOrder(order, 'Void');
    } catch (err) {
      console.error(`Could not check payment for ${order._id}:`, err.message);
    }
  }
}

function startPaymentSweeper() {
  if (!rzp.enabled()) return;
  setInterval(() => sweepUnpaid().catch(() => {}), 5 * 60 * 1000).unref();
  setTimeout(() => sweepUnpaid().catch(() => {}), 30 * 1000).unref();
}

module.exports = router;
module.exports.sweepUnpaid = sweepUnpaid;
module.exports.startPaymentSweeper = startPaymentSweeper;
