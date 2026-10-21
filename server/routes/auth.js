const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly, teamOnly, isTeam } = require('../middleware/authMiddleware');
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
    // 2-step verification on: the password alone isn't enough. Hand back a
    // 5-minute ticket that only /login/2fa accepts.
    if (user.twoFactorEnabled) {
      const ticket = jwt.sign({ id: user._id, purpose: '2fa' }, process.env.JWT_SECRET, { expiresIn: '5m' });
      return res.json({ twoFactorRequired: true, ticket, message: 'Enter the 6-digit code from your authenticator app.' });
    }
    res.json(session(user));
  } catch (err) {
    res.status(400).json({ message: 'Could not sign in. Please try again.' });
  }
});

/* ───────────── 2-step verification ───────────── */

const totp = require('../utils/totp');
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const backupCodes = () => Array.from({ length: 8 }, () => {
  const raw = crypto.randomBytes(5).toString('hex').toUpperCase();   // 10 characters
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
});

// Checks an authenticator code (never the same one twice) or a backup code (used up).
async function secondFactorOk(user, code) {
  const c = String(code || '').trim();
  const step = totp.verify(user.twoFactorSecret, c);
  if (step !== null) {
    const r = await User.updateOne(
      { _id: user._id, twoFactorLastStep: { $lt: step } },
      { $set: { twoFactorLastStep: step } }
    );
    return r.modifiedCount === 1;
  }
  const hashed = sha(c.toUpperCase().replace(/\s/g, ''));
  if (user.twoFactorBackup.includes(hashed)) {
    const r = await User.updateOne({ _id: user._id, twoFactorBackup: hashed }, { $pull: { twoFactorBackup: hashed } });
    return r.modifiedCount === 1;
  }
  return false;
}

// POST /api/auth/login/2fa — { ticket, code } → the real session
router.post('/login/2fa', authLimiter, async (req, res) => {
  try {
    let data;
    try { data = jwt.verify(str(req.body.ticket), process.env.JWT_SECRET); } catch { data = null; }
    if (!data || data.purpose !== '2fa') return res.status(401).json({ message: 'That sign-in took too long. Enter your password again.' });
    const user = await User.findById(data.id).select('+twoFactorSecret +twoFactorBackup +twoFactorLastStep');
    if (!user || !user.twoFactorEnabled) return res.status(401).json({ message: 'Please sign in again.' });
    if (!(await secondFactorOk(user, req.body.code))) {
      return res.status(401).json({ message: 'That code isn’t right. Use the newest code from your app, or a backup code.' });
    }
    res.json(session(user));
  } catch (err) {
    res.status(400).json({ message: 'Could not sign in. Please try again.' });
  }
});

// GET /api/auth/2fa — is it on, and how many backup codes are left
router.get('/2fa', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorBackup');
  res.json({ enabled: !!user?.twoFactorEnabled, backupLeft: user?.twoFactorBackup?.length || 0 });
});

// POST /api/auth/2fa/setup — a fresh secret to add to the authenticator app (admins)
router.post('/2fa/setup', protect, teamOnly, async (req, res) => {
  const secret = totp.newSecret();
  await User.updateOne({ _id: req.user._id }, { $set: { twoFactorPending: secret } });
  res.json({ secret, otpauth: totp.otpauthUrl(secret, req.user.email) });
});

// POST /api/auth/2fa/enable — { code } proves the app is set up; returns backup codes once
router.post('/2fa/enable', protect, teamOnly, authLimiter, async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorPending');
  if (!user?.twoFactorPending) return res.status(400).json({ message: 'Start the setup again.' });
  const step = totp.verify(user.twoFactorPending, req.body.code);
  if (step === null) return res.status(400).json({ message: 'That code isn’t right. Check the time on your phone is set automatically, and try the newest code.' });
  const codes = backupCodes();
  await User.updateOne({ _id: user._id }, {
    $set: {
      twoFactorEnabled: true,
      twoFactorSecret: user.twoFactorPending,
      twoFactorPending: '',
      twoFactorLastStep: step,
      twoFactorBackup: codes.map((c) => sha(c)),
    },
    $inc: { tokenVersion: 1 },   // other devices sign in again, this time with a code
  });
  const fresh = await User.findById(user._id);
  res.json({ ...session(fresh), backupCodes: codes });
});

// POST /api/auth/2fa/disable — { password, code }
router.post('/2fa/disable', protect, authLimiter, async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret +twoFactorBackup +twoFactorLastStep');
  if (!user?.twoFactorEnabled) return res.json({ enabled: false });
  if (!(await user.matchPassword(str(req.body.password)))) return res.status(400).json({ message: 'That password is not right.' });
  if (!(await secondFactorOk(user, req.body.code))) return res.status(400).json({ message: 'That code isn’t right.' });
  await User.updateOne({ _id: user._id }, { $set: { twoFactorEnabled: false, twoFactorSecret: '', twoFactorBackup: [], twoFactorLastStep: 0 } });
  res.json({ enabled: false });
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

// ---- Store credit ----

async function creditStatement(userId) {
  const CreditLog = require('../models/CreditLog');
  const credit = require('../utils/credit');
  const [balance, history] = await Promise.all([
    credit.balanceOf(userId),
    CreditLog.find({ user: userId }).sort({ createdAt: -1 }).limit(50).select('-__v -user').lean(),
  ]);
  return { balance, history };
}

// GET /api/auth/credit — my store credit and its statement
router.get('/credit', protect, async (req, res) => {
  try {
    const st = await creditStatement(req.user._id);
    // Who adjusted it is the shop's business.
    st.history = st.history.map(({ by, ...h }) => h); // eslint-disable-line no-unused-vars
    res.json(st);
  } catch (err) {
    res.status(500).json({ message: 'Could not load your store credit.' });
  }
});

// GET /api/auth/users/:id/credit — a customer's credit (owner)
router.get('/users/:id/credit', protect, adminOnly, async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Customer not found' });
  res.json(await creditStatement(req.params.id));
});

// POST /api/auth/users/:id/credit — { amount, note } add (or take back) credit by hand (owner)
router.post('/users/:id/credit', protect, adminOnly, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Customer not found' });
    const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 120) : '';
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) {
      return res.status(400).json({ message: 'Enter an amount between ₹1 and ₹1,00,000 (use − to take credit away).' });
    }
    if (!note) return res.status(400).json({ message: 'Add a short reason — the customer sees it on their statement.' });
    const customer = await User.findById(req.params.id).select('email name');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    const credit = require('../utils/credit');
    await credit.add(customer._id, amount, 'adjust', note, { by: req.user.name || 'Owner' });
    res.json(await creditStatement(customer._id));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Could not change the credit.' });
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

/* ───────────── Morning email for the team ───────────── */

// GET /api/auth/digest — is my morning email on?
router.get('/digest', protect, teamOnly, async (req, res) => {
  const me = await User.findById(req.user._id).select('dailyDigest');
  res.json({ on: me?.dailyDigest !== false, owner: req.user.role === 'admin', hour: Math.min(23, Math.max(0, Number(process.env.DIGEST_HOUR) || 9)) });
});

// PUT /api/auth/digest — { on }
router.put('/digest', protect, teamOnly, async (req, res) => {
  const on = req.body?.on !== false;
  await User.updateOne({ _id: req.user._id }, { dailyDigest: on });
  res.json({ on });
});

// GET /api/auth/digest/preview — today's email as it would look for me
router.get('/digest/preview', protect, teamOnly, async (req, res) => {
  try {
    const { gather, build } = require('../utils/dailyDigest');
    const mail = build(await gather(), { name: req.user.name, owner: req.user.role === 'admin' });
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'private, no-store');
    const { esc } = require('../utils/emails');
    res.send(mail.html.replace('<head>', `<head><title>${esc(mail.subject)}</title>`));
  } catch (err) {
    res.status(500).json({ message: 'Could not build the preview.' });
  }
});

/* ───────────── Team: staff accounts (owner only) ───────────── */

const ADMIN_URL = () => (process.env.ADMIN_URL || 'https://the-reset-admin.vercel.app').replace(/\/$/, '');

// GET /api/auth/team — everyone who can open the admin
router.get('/team', protect, adminOnly, async (req, res) => {
  const people = await User.find({ role: { $in: ['admin', 'staff'] } })
    .select('name email role twoFactorEnabled createdAt').sort({ role: 1, createdAt: 1 }).lean();
  res.json(people);
});

// POST /api/auth/team — { name, email } add someone as staff
router.post('/team', protect, adminOnly, async (req, res) => {
  const email = normEmail(req.body.email);
  const name = str(req.body.name).trim().slice(0, 60);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  try {
    let user = await User.findOne({ email });
    let tempPassword = '';
    if (user) {
      if (user.role === 'admin') return res.status(400).json({ message: 'That’s the owner account.' });
      if (user.role === 'staff') return res.status(400).json({ message: 'They’re already on the team.' });
      user.role = 'staff';
      user.tokenVersion = (user.tokenVersion || 0) + 1;   // fresh sign-in with the new access
      await user.save();
    } else {
      if (name.length < 2) return res.status(400).json({ message: 'Add their name.' });
      // A one-time password they change after signing in (Security → Password).
      tempPassword = `${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(3).toString('hex')}A1`;
      user = await User.create({ name, email, password: tempPassword, role: 'staff' });
    }
    sendMailLater({
      to: user.email,
      subject: 'You’ve been added to THE RESET team',
      text: `Hi ${user.name.split(' ')[0]},\n\nYou can now sign in to the shop admin at ${ADMIN_URL()} with ${user.email}.`
        + (tempPassword ? `\nYour first password: ${tempPassword}\nPlease change it after signing in (Security → Password).` : '\nUse your usual password.')
        + '\n\nTHE RESET',
      html: `<p>Hi ${emails.esc(user.name.split(' ')[0])},</p><p>You can now sign in to the shop admin at <a href="${ADMIN_URL()}">${ADMIN_URL()}</a> with <strong>${emails.esc(user.email)}</strong>.</p>`
        + (tempPassword ? `<p>Your first password: <strong>${tempPassword}</strong><br>Please change it after signing in (Security → Password).</p>` : '<p>Use your usual password.</p>')
        + '<p>THE RESET</p>',
    });
    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: 'staff', tempPassword });
  } catch (err) {
    res.status(400).json({ message: 'Could not add them. Try again.' });
  }
});

// DELETE /api/auth/team/:id — take away admin access (they keep a normal shop account)
router.delete('/team/:id', protect, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: 'You can’t remove yourself.' });
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'staff') return res.status(404).json({ message: 'Not a staff account.' });
    await User.updateOne({ _id: user._id }, { $set: { role: 'user' }, $inc: { tokenVersion: 1 } });
    res.json({ removed: true });
  } catch (err) {
    res.status(400).json({ message: 'Could not remove them.' });
  }
});

/* ───────────── Privacy: email choices, a copy of your data, deleting the account ───────────── */

// GET /api/auth/preferences
router.get('/preferences', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('bagReminders email').lean();
  const Subscriber = require('../models/Subscriber');
  const sub = user ? await Subscriber.findOne({ email: user.email }).select('unsubscribed').lean() : null;
  res.json({ shoppingEmails: user?.bagReminders !== false, newsletter: !!sub && !sub.unsubscribed });
});

// PUT /api/auth/preferences — { shoppingEmails?, newsletter? }
router.put('/preferences', protect, async (req, res) => {
  try {
    const set = {};
    if (typeof req.body.shoppingEmails === 'boolean') set.bagReminders = req.body.shoppingEmails;
    if (Object.keys(set).length) await User.updateOne({ _id: req.user._id }, { $set: set });
    if (req.body.newsletter === false) {
      const Subscriber = require('../models/Subscriber');
      await Subscriber.updateOne({ email: req.user.email }, { $set: { unsubscribed: true } });
    }
    res.json({ saved: true });
  } catch (err) {
    res.status(400).json({ message: 'Could not save your choices.' });
  }
});

// GET /api/auth/export — everything the shop holds about this customer, as JSON
router.get('/export', protect, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const Review = require('../models/Review');
    const ReturnRequest = require('../models/ReturnRequest');
    const StockAlert = require('../models/StockAlert');
    const Subscriber = require('../models/Subscriber');
    const user = await User.findById(req.user._id)
      .select('-password -tokenVersion -resetPasswordHash -resetPasswordExpires -__v').lean();
    const CreditLog = require('../models/CreditLog');
    const [orders, reviews, returns, alerts, newsletter, storeCredit] = await Promise.all([
      Order.find({ user: req.user._id }).select('-adminNote -history.by -__v').lean(),
      Review.find({ user: req.user._id }).select('-__v').lean(),
      ReturnRequest.find({ user: req.user._id }).select('-__v').lean(),
      StockAlert.find({ email: user.email }).select('-__v').lean(),
      Subscriber.findOne({ email: user.email }).select('-__v').lean(),
      CreditLog.find({ user: req.user._id }).select('-__v -by').lean(),
    ]);
    res.set('Content-Disposition', 'attachment; filename="the-reset-my-data.json"');
    res.json({ exportedAt: new Date(), account: user, orders, reviews, returns, backInStockAlerts: alerts, newsletter, storeCredit });
  } catch (err) {
    res.status(500).json({ message: 'Could not prepare your data. Try again.' });
  }
});

// DELETE /api/auth/account — { password } — close the account for good.
router.delete('/account', protect, authLimiter, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const Review = require('../models/Review');
    const ReturnRequest = require('../models/ReturnRequest');
    const StockAlert = require('../models/StockAlert');
    const Subscriber = require('../models/Subscriber');

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    if (isTeam(user)) return res.status(400).json({ message: 'Team accounts can’t be deleted from the shop. Ask the owner to remove you from the team first.' });
    if (!(await user.matchPassword(str(req.body.password)))) {
      return res.status(400).json({ message: 'That password is not right.' });
    }

    // Not while something is still on its way, or a return is open.
    const openOrder = await Order.exists({ user: user._id, status: { $in: ['Pending', 'Confirmed', 'Shipped'] } });
    if (openOrder) return res.status(409).json({ message: 'You have an order that hasn’t been delivered yet. You can delete your account once it arrives (or cancel it first).' });
    const openReturn = await ReturnRequest.exists({ user: user._id, status: { $in: ['Requested', 'Approved', 'Received'] } });
    if (openReturn) return res.status(409).json({ message: 'You have a return in progress. You can delete your account once it’s finished.' });

    // Orders and returns stay for tax records, but no longer point to a person's account.
    await Order.updateMany({ user: user._id }, { $set: { user: null, guest: { name: 'Deleted account', email: '' } } });
    await ReturnRequest.updateMany({ user: user._id }, { $set: { user: null } });
    await Review.deleteMany({ user: user._id });
    await StockAlert.deleteMany({ $or: [{ user: user._id }, { email: user.email }] });
    await Subscriber.deleteOne({ email: user.email });
    await User.deleteOne({ _id: user._id });

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete the account. Try again.' });
  }
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