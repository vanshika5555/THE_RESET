const express = require('express');
const router = express.Router();
const GiftCard = require('../models/GiftCard');
const rzp = require('../utils/razorpay');
const credit = require('../utils/credit');
const gc = require('../utils/giftCards');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/security');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const cleanMessage = (v) => (typeof v === 'string' ? v.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 300) : '');

// What the shopper (or the owner) may see about a card — never the code.
const view = (c) => ({
  _id: c._id, amount: c.amount, status: c.status, last4: c.last4,
  to: c.to, fromName: c.fromName, message: c.message,
  createdAt: c.createdAt, paidAt: c.paidAt, sentAt: c.sentAt, redeemedAt: c.redeemedAt,
});

function checkFields(body) {
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < gc.MIN || amount > gc.MAX) {
    return { error: `Choose an amount between ₹${gc.MIN.toLocaleString('en-IN')} and ₹${gc.MAX.toLocaleString('en-IN')}.` };
  }
  const toName = clean(body.toName, 60);
  const toEmail = clean(body.toEmail, 120).toLowerCase();
  if (!toName) return { error: 'Who is it for? Add their name.' };
  if (!EMAIL_RE.test(toEmail)) return { error: 'Add the email address we should send the gift card to.' };
  return { amount, toName, toEmail, fromName: clean(body.fromName, 60), message: cleanMessage(body.message) };
}

// GET /api/giftcards/options — amounts and whether buying is switched on
router.get('/options', (req, res) => {
  res.json({ available: rzp.enabled(), min: gc.MIN, max: gc.MAX, presets: gc.PRESETS });
});

// POST /api/giftcards — start buying one: { amount, toName, toEmail, fromName, message }
router.post('/', protect, async (req, res) => {
  try {
    if (!rzp.enabled()) return res.status(400).json({ message: 'Gift cards can be bought once online payment is switched on.' });
    const f = checkFields(req.body || {});
    if (f.error) return res.status(400).json({ message: f.error });

    const card = await GiftCard.create(gc.withCode({
      amount: f.amount, to: { name: f.toName, email: f.toEmail },
      fromName: f.fromName || req.user.name || '', message: f.message, buyer: req.user._id,
    }));
    try {
      const ro = await rzp.createOrder({ amount: card.amount, receipt: `gc_${card._id}`, notes: { giftcard: String(card._id) } });
      card.razorpayOrderId = ro.id;
      await card.save();
      res.status(201).json({ ...view(card), razorpay: { key: rzp.keyId(), orderId: ro.id, amount: ro.amount, currency: 'INR' } });
    } catch (err) {
      await GiftCard.updateOne({ _id: card._id }, { status: 'Void' });
      res.status(502).json({ message: 'Online payment couldn’t start just now. Please try again.' });
    }
  } catch (err) {
    res.status(400).json({ message: 'Could not start the gift card. Please try again.' });
  }
});

// POST /api/giftcards/:id/pay — the Razorpay window reports success
router.post('/:id/pay', protect, async (req, res) => {
  try {
    const card = await GiftCard.findById(req.params.id);
    if (!card || String(card.buyer) !== String(req.user._id)) return res.status(404).json({ message: 'Gift card not found' });
    if (card.status === 'Active' || card.status === 'Redeemed') return res.json(view(card));
    const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = req.body || {};
    if (!pid || oid !== card.razorpayOrderId || !rzp.validCheckoutSignature(oid, pid, sig)) {
      return res.status(400).json({ message: 'We couldn’t confirm that payment. If money left your account, it will be refunded automatically.' });
    }
    if (card.status !== 'Awaiting') {
      try { await rzp.refund(pid); } catch { /* reported below */ }
      return res.status(409).json({ message: 'This gift card had expired before the payment arrived, so we’ve refunded it. Please start again.' });
    }
    res.json(view(await gc.activate(card, pid)));
  } catch (err) {
    res.status(500).json({ message: 'Could not confirm the payment. Check your email in a minute.' });
  }
});

// POST /api/giftcards/:id/abandon — the payment window was closed
router.post('/:id/abandon', protect, async (req, res) => {
  await GiftCard.updateOne({ _id: req.params.id, buyer: req.user._id, status: 'Awaiting' }, { status: 'Void' }).catch(() => {});
  res.json({ ok: true });
});

// GET /api/giftcards/mine — cards I've bought
router.get('/mine', protect, async (req, res) => {
  const list = await GiftCard.find({ buyer: req.user._id, status: { $ne: 'Awaiting' } }).sort({ createdAt: -1 }).limit(50);
  res.json(list.filter((c) => c.status !== 'Void' || c.paidAt).map(view));
});

// POST /api/giftcards/redeem — { code } → onto my store credit
router.post('/redeem', protect, authLimiter, async (req, res) => {
  try {
    const raw = typeof req.body?.code === 'string' ? req.body.code : '';
    if (gc.normalise(raw).length !== 17) return res.status(400).json({ message: 'That doesn’t look like a gift card code. It’s 12 letters and numbers after RESET.' });
    const codeHash = gc.hash(raw);
    const r = await GiftCard.updateOne(
      { codeHash, status: 'Active' },
      { $set: { status: 'Redeemed', redeemedBy: req.user._id, redeemedAt: new Date() } }
    );
    const card = await GiftCard.findOne({ codeHash });
    if (!r.modifiedCount) {
      const why = !card ? 'We don’t recognise that code. Check it against the email and try again.'
        : card.status === 'Redeemed' ? 'This gift card has already been added to an account.'
        : 'This gift card isn’t active.';
      return res.status(400).json({ message: why });
    }
    const balance = await credit.add(req.user._id, card.amount, 'giftcard',
      `Gift card ····${card.last4}${card.fromName ? ` from ${card.fromName}` : ''}`);
    res.json({ added: card.amount, balance, fromName: card.fromName, message: card.message });
  } catch (err) {
    res.status(500).json({ message: 'Could not add the gift card just now. Please try again.' });
  }
});

/* ───────────── Owner ───────────── */

// GET /api/giftcards — every card
router.get('/', protect, adminOnly, async (req, res) => {
  const list = await GiftCard.find({ $or: [{ status: { $ne: 'Awaiting' } }, { createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } }] })
    .populate('buyer', 'name email').populate('redeemedBy', 'name email').sort({ createdAt: -1 }).limit(300);
  res.json(list.map((c) => ({
    ...view(c), buyer: c.buyer, redeemedBy: c.redeemedBy, issuedBy: c.issuedBy, paidOnline: Boolean(c.razorpayPaymentId),
  })));
});

// POST /api/giftcards/issue — a free card from the shop (giveaways, apologies)
router.post('/issue', protect, adminOnly, async (req, res) => {
  try {
    const f = checkFields(req.body || {});
    if (f.error) return res.status(400).json({ message: f.error });
    const card = await GiftCard.create(gc.withCode({
      amount: f.amount, to: { name: f.toName, email: f.toEmail },
      fromName: f.fromName || 'THE RESET', message: f.message, status: 'Active', issuedBy: req.user.name || 'Owner',
    }));
    await gc.sendCard(card._id);
    res.status(201).json(view(await GiftCard.findById(card._id)));
  } catch (err) {
    res.status(500).json({ message: 'Could not issue the gift card.' });
  }
});

// POST /api/giftcards/:id/resend — email it again (wrong inbox, lost email)
router.post('/:id/resend', protect, adminOnly, async (req, res) => {
  const ok = await gc.sendCard(req.params.id).catch(() => false);
  if (!ok) return res.status(400).json({ message: 'Only active gift cards can be sent again.' });
  res.json({ ok: true });
});

// PUT /api/giftcards/:id/void — cancel an unused card (refunds it if bought online)
router.put('/:id/void', protect, adminOnly, async (req, res) => {
  try {
    // Switch it off first, so it can't be redeemed while the refund goes through.
    const r = await GiftCard.updateOne({ _id: req.params.id, status: 'Active' }, { status: 'Void' });
    if (!r.modifiedCount) return res.status(400).json({ message: 'Only an active, unused gift card can be cancelled.' });
    const card = await GiftCard.findById(req.params.id);
    if (card.razorpayPaymentId) {
      try {
        const rf = await rzp.refund(card.razorpayPaymentId);
        await GiftCard.updateOne({ _id: card._id }, { refundId: rf.id || '' });
      } catch (err) {
        await GiftCard.updateOne({ _id: card._id, status: 'Void' }, { status: 'Active' });
        return res.status(502).json({ message: `The refund didn’t go through (${err.message}), so the card is still active.` });
      }
    }
    res.json(view(await GiftCard.findById(card._id)));
  } catch (err) {
    res.status(500).json({ message: 'Could not cancel the gift card.' });
  }
});

module.exports = router;
