const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const StockAlert = require('../models/StockAlert');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, adminOnly, teamOnly, isTeam } = require('../middleware/authMiddleware');
const { sendMailLater } = require('../utils/mailer');
const emails = require('../utils/emails');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 20 sign-ups per hour per IP is plenty for a real shopper.
const alertLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Too many requests. Please try again later.' }),
});

// Signed-in shoppers don't have to type their email; guests do.
async function optionalUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const d = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const u = await User.findById(d.id).select('email tokenVersion');
    return u && !d.purpose && (d.v || 0) === (u.tokenVersion || 0) ? u : null;
  } catch { return null; }
}

/**
 * POST /api/alerts — { product, size, email? }
 * Signs the shopper up for one sold-out size.
 */
router.post('/', alertLimiter, async (req, res) => {
  try {
    const productId = typeof req.body.product === 'string' ? req.body.product : '';
    const size = typeof req.body.size === 'string' ? req.body.size.trim().slice(0, 10) : '';
    const user = await optionalUser(req);
    const email = user ? user.email : (typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '');

    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });

    const product = await Product.findById(productId).select('name sizes');
    if (!product || !product.sizes.includes(size)) {
      return res.status(400).json({ message: 'That size is not available for this piece.' });
    }

    await StockAlert.updateOne(
      { product: product._id, size, email },
      { $set: { user: user ? user._id : null, notifiedAt: null } },
      { upsert: true }
    );

    res.status(201).json({ message: `We'll email ${email} as soon as size ${size} is back.` });
  } catch (err) {
    res.status(400).json({ message: 'Could not save that. Please try again.' });
  }
});

// GET /api/alerts/summary — what shoppers are waiting for (admin only).
// ?product=<id> narrows it to one product (used by the edit screen).
router.get('/summary', protect, teamOnly, async (req, res) => {
  try {
    const filter = { notifiedAt: null };
    if (req.query.product) {
      if (!mongoose.isValidObjectId(req.query.product)) return res.json([]);
      filter.product = req.query.product;
    }
    const rows = await StockAlert.find(filter).populate('product', 'name').lean();
    const map = {};
    rows.forEach(r => {
      if (!r.product) return;
      const key = `${r.product._id}|${r.size}`;
      map[key] = map[key] || { product: r.product._id, name: r.product.name, size: r.size, waiting: 0 };
      map[key].waiting += 1;
    });
    res.json(Object.values(map).sort((a, b) => b.waiting - a.waiting));
  } catch (err) {
    res.status(500).json({ message: 'Could not load alerts.' });
  }
});

/**
 * Called after the admin edits a product. Any size that went from none left
 * to some left emails everyone waiting for it, once.
 */
async function notifyRestocked(before, after) {
  try {
    if (!before || !after || after.inStock === false) return;
    const qty = (p, size) => {
      const e = (p.stock || []).find(s => s.size === size);
      return e ? e.qty : (p.inStock ? Infinity : 0);
    };
    const wasHidden = before.inStock === false;
    const sizes = (after.sizes || []).filter(s => qty(after, s) > 0 && (wasHidden || qty(before, s) <= 0));
    if (!sizes.length) return;

    const alerts = await StockAlert.find({ product: after._id, size: { $in: sizes }, notifiedAt: null });
    for (const a of alerts) {
      sendMailLater({ to: a.email, ...emails.backInStock({ product: after, size: a.size }) });
      a.notifiedAt = new Date();
      await a.save();
    }
  } catch (err) {
    console.error('Back-in-stock alerts failed:', err.message);
  }
}

module.exports = router;
module.exports.notifyRestocked = notifyRestocked;
