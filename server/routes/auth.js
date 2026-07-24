const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password });
    res.status(201).json({
      _id:   user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
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

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const key = (email || '').toLowerCase().trim();

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

    res.json({
      _id:   user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/changepassword
router.put('/changepassword', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id);
    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
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
    user.addresses.push(req.body);
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

    ['label', 'fullName', 'phone', 'address', 'city', 'state', 'pincode']
      .forEach(f => { if (req.body[f] !== undefined) entry[f] = req.body[f]; });

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

    await User.updateOne({ _id: req.user._id }, { cart: clean });
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

// GET /api/auth/saved — the bag and wishlist stored on this account
router.get('/saved', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('cart wishlist');
    res.json({ cart: user?.cart || [], wishlist: user?.wishlist || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;