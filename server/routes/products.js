const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, adminOnly, teamOnly, isTeam } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { notifyRestocked } = require('./alerts');
const { notifyPriceDrop } = require('../utils/priceDrops');

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

/**
 * Links a product to the same style in another colour.
 * linkTo: a product id to join its group, or '' to leave the group.
 * Returns the styleGroup to save, or undefined when nothing should change.
 */
async function groupFor(linkTo, selfId) {
  if (linkTo === undefined) return undefined;
  if (!linkTo) return '';
  if (selfId && String(linkTo) === String(selfId)) return undefined;
  const target = await Product.findById(linkTo).select('styleGroup');
  if (!target) { const e = new Error('The product to link with no longer exists.'); e.status = 400; throw e; }
  const group = target.styleGroup || String(target._id);
  if (!target.styleGroup) await Product.updateOne({ _id: target._id }, { $set: { styleGroup: group } });
  return group;
}

// GET /api/products/:id/colours — every colour of this style, this one included (public)
router.get('/:id/colours', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('styleGroup');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!product.styleGroup) return res.json([]);
    const all = await Product.find({ styleGroup: product.styleGroup })
      .select('name colorName swatch color image images inStock stock sizes price mrp')
      .sort({ createdAt: 1 })
      .lean();
    // Hidden colours stay hidden, but the one being viewed always shows.
    res.json(all.filter((p) => p.inStock !== false || String(p._id) === String(product._id)));
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
router.post('/', protect, teamOnly, async (req, res) => {
  try {
    const { _id, __v, createdAt, updatedAt, styleGroup, linkTo, ...fields } = req.body || {};
    const group = await groupFor(linkTo);
    if (group !== undefined) fields.styleGroup = group;
    const product = new Product(fields);
    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

// PUT update product  (admin only)
router.put('/:id', protect, teamOnly, async (req, res) => {
  try {
    // Bump the version so an order being placed at this exact moment
    // re-reads the product instead of overwriting this edit (see orders.js).
    const { _id, __v, createdAt, updatedAt, styleGroup, linkTo, lowestNotifiedPrice, ...changes } = req.body || {};
    const group = await groupFor(linkTo, req.params.id);
    if (group !== undefined) changes.styleGroup = group;
    const before = await Product.findById(req.params.id).lean();
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: changes, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    notifyRestocked(before, updated.toObject());   // emails anyone waiting; never blocks the save
    notifyPriceDrop(before, updated.toObject());   // wishlist shoppers hear about a lower price
    res.json(updated);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
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