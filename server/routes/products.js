const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const User = require('../models/User');

// GET all products  (public — the shop needs this)
router.get('/', async (req, res) => {
  try {
    const { category, season, subcategory } = req.query;
    const filter = {};
    if (category)    filter.category    = category;
    if (season)      filter.season      = season;
    if (subcategory) filter.subcategory = subcategory;
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single product  (public)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create product  (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const product = new Product(req.body);
    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update product  (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE product  (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/products/:id/view — note that this customer looked at this piece.
 *
 * Only recorded for signed-in customers. Kept to the last 20, newest first,
 * with a count so repeat interest is visible.
 */
router.post('/:id/view', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('viewed');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const id = String(req.params.id);
    const existing = user.viewed.find(v => String(v.product) === id);

    if (existing) {
      existing.count += 1;
      existing.at = new Date();
    } else {
      user.viewed.push({ product: id, at: new Date(), count: 1 });
    }

    user.viewed.sort((a, b) => new Date(b.at) - new Date(a.at));
    user.viewed = user.viewed.slice(0, 20);

    await user.save();
    res.json({ ok: true });
  } catch (err) {
    // Never let analytics break a product page.
    res.status(200).json({ ok: false });
  }
});

module.exports = router;