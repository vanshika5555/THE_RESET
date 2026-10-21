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

// "Wear it with" ids from the admin: real products, not itself, at most 4.
const MAX_PAIRS = 4;
function cleanPairs(list, selfId) {
  if (!Array.isArray(list)) return undefined;
  const ids = [...new Set(list.map(String))]
    .filter((id) => /^[a-f0-9]{24}$/i.test(id) && id !== String(selfId || ''));
  return ids.slice(0, MAX_PAIRS);
}

const CARD = 'name price mrp color image images inStock stock sizes subcategory category colorName styleGroup';
const sellable = (p) => p && p.inStock !== false
  && (!(p.stock || []).length || p.stock.some((s) => s.qty > 0));

/**
 * GET /api/products/:id/pairs — "Wear it with" (public).
 * The owner's own picks first; then what customers bought together with
 * this piece; then a top for a bottom (or the other way round) from the same
 * department. Never the same style in another colour, never sold out.
 */
router.get('/:id/pairs', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const product = await Product.findById(req.params.id).select('pairsWith category fitType season styleGroup').lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const self = String(product._id);
    const sameStyle = (p) => String(p._id) === self || (product.styleGroup && p.styleGroup === product.styleGroup);
    const out = [];
    const seen = new Set([self]);
    const take = (list, source) => {
      for (const p of list) {
        if (out.length >= MAX_PAIRS) return;
        const id = String(p._id);
        if (seen.has(id) || sameStyle(p) || !sellable(p)) continue;
        seen.add(id);
        out.push({ ...p, pairSource: source });
      }
    };

    // 1. Chosen in the admin, in the order chosen.
    if (product.pairsWith?.length) {
      const picked = await Product.find({ _id: { $in: product.pairsWith } }).select(CARD).lean();
      const byId = Object.fromEntries(picked.map((p) => [String(p._id), p]));
      take(product.pairsWith.map((id) => byId[String(id)]).filter(Boolean), 'shop');
    }

    // 2. Bought together at least twice.
    if (out.length < MAX_PAIRS) {
      const orders = await Order.find({ 'items.product': product._id, status: { $ne: 'Cancelled' } })
        .select('items.product').sort({ createdAt: -1 }).limit(500).lean();
      const count = {};
      orders.forEach((o) => new Set(o.items.map((i) => String(i.product))).forEach((id) => {
        if (id !== self) count[id] = (count[id] || 0) + 1;
      }));
      const top = Object.entries(count).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id);
      if (top.length) {
        const found = await Product.find({ _id: { $in: top } }).select(CARD).lean();
        const byId = Object.fromEntries(found.map((p) => [String(p._id), p]));
        take(top.map((id) => byId[id]).filter(Boolean), 'bought');
      }
    }

    // 3. Completes the outfit: tops with bottoms, bottoms with tops.
    if (out.length < MAX_PAIRS) {
      const other = (product.fitType || 'Top') === 'Top' ? 'Bottom' : 'Top';
      const pool = await Product.find({ category: product.category, fitType: other, inStock: { $ne: false } })
        .select(`${CARD} season createdAt`).sort({ createdAt: -1 }).limit(40).lean();
      pool.sort((a, b) => (b.season === product.season) - (a.season === product.season));
      take(pool, 'outfit');
    }

    res.set('Cache-Control', 'public, max-age=300');
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: 'Could not load suggestions.' });
  }
});

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
    if ('pairsWith' in fields) fields.pairsWith = cleanPairs(fields.pairsWith) || [];
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
    if ('pairsWith' in changes) changes.pairsWith = cleanPairs(changes.pairsWith, req.params.id) || [];
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