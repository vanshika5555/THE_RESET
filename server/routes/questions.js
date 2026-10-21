const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Question = require('../models/Question');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, teamOnly } = require('../middleware/authMiddleware');
const { sendMailLater } = require('../utils/mailer');
const emails = require('../utils/emails');
const jwt = require('jsonwebtoken');

/*
  Product questions & answers.
  Shoppers ask (signed in); the team answers in the admin; answered questions
  show on the product page for everyone, and the asker gets an email.
*/

// 10 questions an hour per device is plenty for a real shopper.
const askLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'That’s a lot of questions — please try again in a while.' }),
});

const clean = (v, max) => (typeof v === 'string'
  ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
  : '');
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'A shopper';

// The signed-in shopper, if any (the product page works signed out too).
async function optionalUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const d = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const u = await User.findById(d.id).select('tokenVersion');
    return u && !d.purpose && (d.v || 0) === (u.tokenVersion || 0) ? u : null;
  } catch { return null; }
}

const publicView = (q, mine) => ({
  _id: q._id, name: q.name, text: q.text, createdAt: q.createdAt, status: q.status, mine: Boolean(mine),
  answer: q.status === 'answered' ? { text: q.answer.text, at: q.answer.at } : null,
});

// GET /api/questions?product=<id> — answered questions, plus my own waiting ones
router.get('/', async (req, res) => {
  try {
    const product = String(req.query.product || '');
    if (!/^[a-f0-9]{24}$/i.test(product)) return res.json([]);
    const me = await optionalUser(req);
    const filter = me
      ? { product, $or: [{ status: 'answered' }, { user: me._id, status: 'open' }] }
      : { product, status: 'answered' };
    const list = await Question.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json(list.map((q) => publicView(q, me && String(q.user) === String(me._id))));
  } catch (err) {
    res.status(500).json({ message: 'Could not load questions.' });
  }
});

// POST /api/questions — { product, text }
router.post('/', protect, askLimiter, async (req, res) => {
  try {
    const text = clean(req.body?.text, 300);
    if (text.length < 8) return res.status(400).json({ message: 'Add a little more detail so we can answer properly.' });
    const product = await Product.findById(req.body?.product).select('_id');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const open = await Question.countDocuments({ user: req.user._id, product: product._id, status: 'open' });
    if (open >= 3) return res.status(429).json({ message: 'You have questions waiting on this piece — we’ll answer those first.' });
    const q = await Question.create({ product: product._id, user: req.user._id, name: firstName(req.user.name), text });
    res.status(201).json(publicView(q.toObject(), true));
  } catch (err) {
    res.status(400).json({ message: 'Could not send your question. Please try again.' });
  }
});

/* ───────────── Team ───────────── */

// GET /api/questions/all?status=open — every question, newest first
router.get('/all', protect, teamOnly, async (req, res) => {
  const filter = ['open', 'answered', 'hidden'].includes(req.query.status) ? { status: req.query.status } : {};
  const list = await Question.find(filter)
    .populate('product', 'name image images color')
    .populate('user', 'name email')
    .sort({ status: 1, createdAt: -1 })
    .limit(300).lean();
  res.json(list);
});

// GET /api/questions/count — how many wait for an answer (dashboard)
router.get('/count', protect, teamOnly, async (req, res) => {
  res.json({ open: await Question.countDocuments({ status: 'open' }) });
});

// PUT /api/questions/:id — { answer } answers (or edits the answer); { status: 'hidden' | 'open' }
router.put('/:id', protect, teamOnly, async (req, res) => {
  try {
    const q = await Question.findById(req.params.id).populate('user', 'name email').populate('product', 'name');
    if (!q) return res.status(404).json({ message: 'Question not found' });
    const firstAnswer = q.status !== 'answered' && !q.answer.at;
    if (typeof req.body?.answer === 'string') {
      const text = clean(req.body.answer, 1000);
      if (text.length < 2) return res.status(400).json({ message: 'Write an answer first.' });
      q.answer = { text, by: req.user.name || '', at: new Date() };
      q.status = 'answered';
    } else if (['hidden', 'open', 'answered'].includes(req.body?.status)) {
      if (req.body.status === 'answered' && !q.answer.text) return res.status(400).json({ message: 'Write an answer first.' });
      q.status = req.body.status;
    }
    await q.save();
    // Tell the asker — once, the first time it's answered.
    if (firstAnswer && q.status === 'answered' && q.user?.email) {
      const msg = emails.questionAnswered({ name: q.user.name, question: q, product: q.product });
      if (msg) sendMailLater({ to: q.user.email, ...msg });
    }
    res.json(await Question.findById(q._id).populate('product', 'name image images color').populate('user', 'name email').lean());
  } catch (err) {
    res.status(400).json({ message: 'Could not save that.' });
  }
});

// DELETE /api/questions/:id
router.delete('/:id', protect, teamOnly, async (req, res) => {
  await Question.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
