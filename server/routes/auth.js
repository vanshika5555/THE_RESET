const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { authLimiter, resetLimiter } = require('../middleware/security');
const { sendMailLater, SHOP_URL } = require('../utils/mailer');
const emails = require('../utils/emails');

// ---- helpers ----

// The token carries the account's tokenVersion; see authMiddleware.
const generateToken = (user) =>
  jwt.sign({ id: user._id, v: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '30d' });

const session = (user) => ({
  _id:   user._id,
  name:  user.name,
  email: user.email,
  role:  user.role,
  token: generateToken(user),
});

// Always a plain lower-case string — never an object a query could misread.
const normEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const str = (v) => (typeof v === 'string' ? v : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

function passwordProblem(pw) {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 128) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use at least one letter and one number.';
  return '';
}

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const name = str(req.body.name).trim().slice(0, 80);
  const email = normEmail(req.body.email);
  const password = str(req.body.password);

  if (!name) return res.status(400).json({ message: 'Please enter your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ message: problem });

  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'An account with this email already exists. Try signing in.' });

    // role is never taken from the request — nobody can sign themselves up as admin.
    const user = await User.create({ name, email, password });
    sendMailLater({ to: user.email, ...emails.welcome({ name: user.name }) });
    res.status(201).json(session(user));
  } catch (err) {
    res.status(400).json({ message: 'Could not create the account. Please try again.' });
  }
});

// POST /api/auth/login

/**
 * Simple in-memory brake on repeated failed logins.
 *
 * Not a replacement for a proper rate limiter, but it stops someone
 * guessing passwords thousands of times a minute against one account.
 */
const attempts = new Map();          // email -> { count, firstAt, blockedUntil }
const WINDOW_MS = 15 * 60 * 1000;    // 15 minutes
const MAX_TRIES = 8;
const BLOCK_MS  = 15 * 60 * 1000;

function loginBlocked(email) {
  const rec = attempts.get(email);
  if (!rec) return 0;
  if (rec.blockedUntil && rec.blockedUntil > Date.now()) {
    return Math.ceil((rec.blockedUntil - Date.now()) / 60000);
  }
  return 0;
}

function recordFailure(email) {
  const now = Date.now();
  const rec = attempts.get(email) || { count: 0, firstAt: now };

  // start a fresh window if the old one has passed
  if (now - rec.firstAt > WINDOW_MS) {
    rec.count = 0;
    rec.firstAt = now;
  }

  rec.count += 1;
  if (rec.count >= MAX_TRIES) {
    rec.blockedUntil = now + BLOCK_MS;
    rec.count = 0;
    rec.firstAt = now;
  }
  attempts.set(email, rec);
}

function clearFailures(email) {
  attempts.delete(email);
}

// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [email, rec] of attempts) {
    if ((rec.blockedUntil || 0) < now && now - rec.firstAt > WINDOW_MS) {
      attempts.delete(email);
    }
  }
}, 30 * 60 * 1000).unref();

router.post('/login', authLimiter, async (req, res) => {
  const email = normEmail(req.body.email);
  const password = str(req.body.password);
  const key = email;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter your email and password.' });
  }

  const waitMinutes = loginBlocked(key);
  if (waitMinutes) {
    return res.status(429).json({
      message: `Too many failed attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`,
    });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      recordFailure(key);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const match = await user.matchPassword(password);
    if (!match) {
      recordFailure(key);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    clearFailures(key);
    res.json(session(user));
  } catch (err) {
    res.status(400).json({ message: 'Could not sign in. Please try again.' });
  }
});

/**
 * POST /api/auth/forgot-password — email a one-time reset link.
 *
 * Always answers the same way whether or not the email has an account,
 * so the form cannot be used to discover who shops here.
 */
router.post('/forgot-password', resetLimiter, async (req, res) => {
  const email = normEmail(req.body.email);
  const reply = () => res.json({
    message: 'If an account exists for that email, a reset link is on its way. Check your inbox (and spam).',
  });

  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });

  try {
    const user = await User.findOne({ email });
    if (!user) return reply();

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordHash = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const link = `${SHOP_URL()}/reset-password/${token}`;
    sendMailLater({ to: user.email, ...emails.passwordReset({ name: user.name, link }) });
    return reply();
  } catch (err) {
    return reply();
  }
});

/**
 * POST /api/auth/reset-password — set a new password using the emailed token.
 * The token works once, for 30 minutes. Every existing session is signed out.
 */
router.post('/reset-password', resetLimiter, async (req, res) => {
  const token = str(req.body.token).trim();
  const password = str(req.body.password);

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ message: 'This reset link is not valid. Please request a new one.' });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ message: problem });

  try {
    const user = await User.findOne({
      resetPasswordHash: hashToken(token),
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordHash +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'This reset link has expired or was already used. Please request a new one.' });
    }

    user.password = password;
    user.resetPasswordHash = null;
    user.resetPasswordExpires = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    clearFailures(user.email);
    sendMailLater({ to: user.email, ...emails.passwordChanged({ name: user.name }) });
    res.json(session(user));      // signed straight in with the new password
  } catch (err) {
    res.status(400).json({ message: 'Could not reset the password. Please try again.' });
  }
});

// POST /api/auth/logout-all — sign out on every device (this one gets a fresh token)
router.post('/logout-all', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    res.json(session(user));
  } catch (err) {
    res.status(400).json({ message: 'Could not sign out other devices.' });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/changepassword
// Returns a fresh token for this device; every other device is signed out.
router.put('/changepassword', protect, async (req, res) => {
  const currentPassword = str(req.body.currentPassword);
  const newPassword = str(req.body.newPassword);
  const problem = passwordProblem(newPassword);
  if (problem) return res.status(400).json({ message: problem });

  try {
    const user = await User.findById(req.user._id);
    const match = await user.matchPassword(currentPassword);
    // 400, not 401 — a wrong current password must not sign the customer out.
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    sendMailLater({ to: user.email, ...emails.passwordChanged({ name: user.name }) });
    res.json({ message: 'Password updated. Other devices have been signed out.', ...session(user) });
  } catch (err) {
    res.status(400).json({ message: 'Could not change the password. Please try again.' });
  }
});

// GET /api/auth/users — list all customers (admin only)
// Passwords are hashed and are never returned.
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      // Bring product names through so the admin shows pieces, not ids.
      .populate('wishlist', 'name price category')
      .populate('viewed.product', 'name price category')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---- Saved addresses (the logged-in customer's own) ----

// GET /api/auth/addresses
router.get('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    res.json(user ? user.addresses : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/addresses — add one
router.post('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.addresses.length >= 10) {
      return res.status(400).json({ message: 'You can save up to 10 addresses.' });
    }
    const a = req.body || {};
    const pick = (k) => (typeof a[k] === 'string' ? a[k].slice(0, 200) : undefined);
    user.addresses.push({
      label: pick('label') || 'Home', fullName: pick('fullName'), phone: pick('phone'),
      houseNo: pick('houseNo'), address: pick('address'), landmark: pick('landmark'),
      city: pick('city'), state: pick('state'), pincode: pick('pincode'),
    });
    await user.save();
    res.status(201).json(user.addresses);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/auth/addresses/:addressId — update one
router.put('/addresses/:addressId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const entry = user.addresses.id(req.params.addressId);
    if (!entry) return res.status(404).json({ message: 'Address not found' });

    // houseNo and landmark were missing here, so edits to them were silently lost.
    ['label', 'fullName', 'phone', 'houseNo', 'address', 'landmark', 'city', 'state', 'pincode']
      .forEach(f => { if (typeof req.body[f] === 'string') entry[f] = req.body[f].slice(0, 200); });

    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/auth/addresses/:addressId
router.delete('/addresses/:addressId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const entry = user.addresses.id(req.params.addressId);
    if (!entry) return res.status(404).json({ message: 'Address not found' });
    entry.deleteOne();
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ---- What the customer is currently interested in ----

/**
 * The shop keeps the bag and wishlist in the browser so they work instantly
 * and while signed out. These endpoints mirror them onto the account, so the
 * lists follow the customer between devices and the shop can see demand that
 * has not become an order yet.
 */

// PUT /api/auth/cart — replace the saved bag
router.put('/cart', protect, async (req, res) => {
  try {
    const items = Array.isArray(req.body.cart) ? req.body.cart : [];
    const clean = items.slice(0, 50).map(i => ({
      product: i._id || i.product,
      name:  i.name,
      price: i.price,
      image: i.image,
      size:  i.size,
      qty:   Math.max(1, Number(i.qty) || 1),
    }));

    // Any change to the bag restarts the reminder clock.
    await User.updateOne({ _id: req.user._id }, {
      cart: clean,
      cartUpdatedAt: clean.length ? new Date() : null,
      cartReminderSentAt: null,
    });
    res.json({ saved: clean.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/auth/wishlist — replace the saved wishlist
router.put('/wishlist', protect, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.wishlist) ? req.body.wishlist : [];
    await User.updateOne({ _id: req.user._id }, { wishlist: ids.slice(0, 100) });
    res.json({ saved: Math.min(ids.length, 100) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/auth/reminders/off?u=&t= — "stop these reminders" link in the bag email
router.get('/reminders/off', async (req, res) => {
  const { validOff } = require('../utils/bagReminders');
  const id = String(req.query.u || '');
  let ok = false;
  try {
    ok = /^[a-f0-9]{24}$/i.test(id) && validOff(id, req.query.t);
    if (ok) await User.updateOne({ _id: id }, { bagReminders: false });
  } catch { ok = false; }
  const shop = (process.env.SHOP_URL || 'https://the-reset-snowy.vercel.app').replace(/\/$/, '');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>THE RESET</title>
<div style="max-width:440px;margin:80px auto;padding:0 20px;font:16px/1.6 Helvetica,Arial,sans-serif;color:#111">
<p style="font-weight:800;letter-spacing:.04em">THE RESET</p>
<h1 style="font-size:24px">${ok ? 'Shopping emails turned off' : 'This link is not valid'}</h1>
<p style="color:#555">${ok ? "We won't email you about your bag or price drops on your wishlist. Order and delivery emails still arrive as usual." : 'It may have been copied incorrectly.'}</p>
<p><a href="${shop}" style="color:#111">Back to the shop</a></p></div>`);
});

// GET /api/auth/saved — the bag and wishlist stored on this account
router.get('/saved', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('cart wishlist').populate('cart.product');
    // The bag comes back as full product details, ready to show — pieces
    // that were deleted or hidden since are dropped.
    const cart = (user?.cart || [])
      .filter((i) => i.product && i.product.inStock !== false)
      .map((i) => ({ ...i.product.toObject(), size: i.size, qty: i.qty || 1 }));
    res.json({ cart, wishlist: user?.wishlist || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;