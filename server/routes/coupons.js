const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { protect, adminOnly } = require('../middleware/authMiddleware');

/**
 * POST /api/coupons/check — see whether a code applies to a bag.
 * Used by checkout to preview the discount. The real discount is
 * recalculated when the order is placed, so this cannot be gamed.
 */
router.post('/check', protect, async (req, res) => {
  try {
    const code = (req.body.code || '').toUpperCase().trim();
    const subtotal = Number(req.body.subtotal) || 0;

    if (!code) return res.status(400).json({ message: 'Enter a code.' });

    const coupon = await Coupon.findOne({ code });
    if (!coupon) {
      return res.status(404).json({ message: 'That code was not recognised.' });
    }

    const result = coupon.check(subtotal);
    if (!result.ok) {
      return res.status(400).json({ message: result.reason });
    }

    res.json({
      code: coupon.code,
      description: coupon.description,
      discount: result.discount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---- admin management ----

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json(coupon);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A code with that name already exists.' });
    }
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const updated = await Coupon.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Code not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Code not found' });
    res.json({ message: 'Code deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;