const express = require('express');
const router = express.Router();
const Offer = require('../models/Offer');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { live } = require('../utils/offers');

const PUBLIC = 'name condition reward maxDiscount category startsAt endsAt';

// GET /api/offers/active — what the shop shows and applies (public)
router.get('/active', async (req, res) => {
  const list = await Offer.find({ active: true }).select(PUBLIC).lean();
  res.set('Cache-Control', 'public, max-age=120');
  res.json(list.filter((o) => live(o)));
});

function clean(body = {}) {
  const num = (v) => Math.round(Number(v));
  const o = {
    name: String(body.name || '').trim().slice(0, 60),
    condition: { type: body.condition?.type === 'spend' ? 'spend' : 'qty', value: num(body.condition?.value) },
    reward: { type: body.reward?.type === 'amount' ? 'amount' : 'percent', value: num(body.reward?.value) },
    maxDiscount: Math.max(0, num(body.maxDiscount) || 0),
    category: ['Men', 'Women'].includes(body.category) ? body.category : '',
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    active: body.active !== false,
  };
  if (!o.name) return { error: 'Give the offer a name shoppers will see, like “Buy 2, get 10% off”.' };
  if (!(o.condition.value >= 1)) return { error: 'Set how many pieces, or how much spend, the offer needs.' };
  if (o.condition.type === 'qty' && o.condition.value > 20) return { error: 'That’s a lot of pieces — 20 at most.' };
  if (!(o.reward.value >= 1)) return { error: 'Set the discount.' };
  if (o.reward.type === 'percent' && o.reward.value > 90) return { error: 'A percent offer can be at most 90% off.' };
  if (o.startsAt && isNaN(o.startsAt)) o.startsAt = null;
  if (o.endsAt && isNaN(o.endsAt)) o.endsAt = null;
  if (o.startsAt && o.endsAt && o.endsAt < o.startsAt) return { error: 'The end date is before the start date.' };
  return { offer: o };
}

// Owner: GET / POST / PUT /:id / DELETE /:id
router.get('/', protect, adminOnly, async (req, res) => {
  res.json(await Offer.find().sort({ createdAt: -1 }).lean());
});
router.post('/', protect, adminOnly, async (req, res) => {
  const { offer, error } = clean(req.body);
  if (error) return res.status(400).json({ message: error });
  res.status(201).json(await Offer.create(offer));
});
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Just switching it on or off?
    if (Object.keys(req.body || {}).length === 1 && 'active' in req.body) {
      const o = await Offer.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true });
      return o ? res.json(o) : res.status(404).json({ message: 'Offer not found' });
    }
    const { offer, error } = clean(req.body);
    if (error) return res.status(400).json({ message: error });
    const o = await Offer.findByIdAndUpdate(req.params.id, offer, { new: true });
    return o ? res.json(o) : res.status(404).json({ message: 'Offer not found' });
  } catch (err) {
    res.status(400).json({ message: 'Could not save the offer.' });
  }
});
router.delete('/:id', protect, adminOnly, async (req, res) => {
  await Offer.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
