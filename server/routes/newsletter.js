const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const Coupon = require('../models/Coupon');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendMailLater, SHOP_URL } = require('../utils/mailer');
const emails = require('../utils/emails');

// The first-order offer. Change it here.
const OFFER = { percent: 10, minOrder: 999, maxOff: 500, days: 30 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Too many sign-ups from this device. Try again later.' }),
});

// Unsubscribe links are signed, so nobody can unsubscribe someone else.
const sig = (email) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`unsub:${email}`).digest('hex').slice(0, 32);
const unsubLink = (email) => {
  const api = (process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
  return `${api}/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&t=${sig(email)}`;
};

async function newCode(email) {
  for (let i = 0; i < 5; i++) {
    const code = `WELCOME-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    try {
      await Coupon.create({
        code,
        description: `First-order code for ${email}`,
        type: 'percent',
        value: OFFER.percent,
        minOrder: OFFER.minOrder,
        maxDiscount: OFFER.maxOff,
        usageLimit: 1,
        expiresAt: new Date(Date.now() + OFFER.days * 864e5),
        active: true,
      });
      return code;
    } catch (err) {
      if (err.code !== 11000) throw err;   // code clash — try another
    }
  }
  throw new Error('Could not create a code');
}

// POST /api/newsletter — { email }
router.post('/', limiter, async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });

  try {
    let sub = await Subscriber.findOne({ email });
    let code = sub?.code;

    // Reuse their code if it still works; otherwise issue a fresh one.
    const existing = code ? await Coupon.findOne({ code }) : null;
    const stillGood = existing && existing.active && existing.usedCount < 1 && (!existing.expiresAt || existing.expiresAt > new Date());
    if (!stillGood) {
      if (existing && existing.usedCount >= 1) {
        // Already used their welcome code — subscribe again, but no second discount.
        await Subscriber.updateOne({ email }, { unsubscribed: false });
        return res.json({ message: "You're subscribed. Your welcome code has already been used — watch your inbox for the next drop." });
      }
      code = await newCode(email);
    }

    sub = await Subscriber.findOneAndUpdate(
      { email },
      { $set: { code, unsubscribed: false } },
      { upsert: true, new: true }
    );

    sendMailLater({ to: email, ...emails.welcomeCode({ code, ...OFFER, unsubscribe: unsubLink(email) }) });
    res.status(201).json({ message: `Check your inbox — your ${OFFER.percent}% off code is on its way.` });
  } catch (err) {
    res.status(400).json({ message: 'Could not sign you up just now. Please try again.' });
  }
});

// GET /api/newsletter/unsubscribe?e=&t= — one click from the email
router.get('/unsubscribe', async (req, res) => {
  const email = typeof req.query.e === 'string' ? req.query.e.toLowerCase() : '';
  const ok = email && typeof req.query.t === 'string' && req.query.t === sig(email);
  if (ok) await Subscriber.updateOne({ email }, { unsubscribed: true });
  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font:16px/1.6 Helvetica,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#111">
<h1 style="font-size:24px">${ok ? "You're unsubscribed" : 'This link is not valid'}</h1>
<p>${ok ? "You won't get any more newsletter emails from THE RESET. Order emails still arrive as normal." : 'Use the unsubscribe link from the email itself.'}</p>
<p><a href="${SHOP_URL()}" style="color:#111">Back to the shop</a></p></body>`);
});

// GET /api/newsletter — subscribers (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  const list = await Subscriber.find({}).sort({ createdAt: -1 }).lean();
  res.json(list);
});

module.exports = router;
