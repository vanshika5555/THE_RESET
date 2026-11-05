const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Product = require('../models/Product');
const { protect, teamOnly, adminOnly } = require('../middleware/authMiddleware');

/*
  Edits — hand-picked sets of pieces. Anyone can see published ones; the team
  builds them in the admin.
*/

const CARD = 'name price mrp color image images inStock stock sizes subcategory category colorName styleGroup season tag dropAt';
const MAX = 60;

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
  .trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const cleanIds = (list) => [...new Set((Array.isArray(list) ? list : []).map(String))]
  .filter((id) => /^[a-f0-9]{24}$/i.test(id)).slice(0, MAX);

// The fields a collection may be saved with.
function fields(body = {}) {
  const out = {};
  if ('title' in body) out.title = String(body.title || '').trim().slice(0, 60);
  if ('blurb' in body) out.blurb = String(body.blurb || '').trim().slice(0, 300);
  if ('image' in body) out.image = /^https:\/\/\S+$/.test(String(body.image || '')) ? String(body.image).slice(0, 500) : '';
  if ('products' in body) out.products = cleanIds(body.products);
  if ('published' in body) out.published = !!body.published;
  if ('showOnHome' in body) out.showOnHome = !!body.showOnHome;
  if ('position' in body) out.position = Math.max(0, Math.min(999, parseInt(body.position, 10) || 0));
  if ('slug' in body && body.slug) out.slug = slugify(body.slug);
  return out;
}

async function uniqueSlug(base, selfId) {
  const root = base || 'edit';
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    const clash = await Collection.findOne({ slug, ...(selfId ? { _id: { $ne: selfId } } : {}) }).select('_id').lean();
    if (!clash) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// The pieces of a collection, in its order; hidden pieces left out.
async function piecesOf(c) {
  const found = await Product.find({ _id: { $in: c.products }, inStock: { $ne: false } }).select(CARD).lean();
  const byId = Object.fromEntries(found.map((p) => [String(p._id), p]));
  return c.products.map((id) => byId[String(id)]).filter(Boolean);
}

const coverOf = (c, pieces) => c.image || pieces.map((p) => (p.images && p.images[0]) || p.image).find(Boolean) || '';

// GET /api/collections?home=1 — published edits (for the home page with home=1)
router.get('/', async (req, res) => {
  try {
    const filter = { published: true, ...(req.query.home ? { showOnHome: true } : {}) };
    const list = await Collection.find(filter).sort({ position: 1, createdAt: -1 }).limit(12).lean();
    const out = [];
    for (const c of list) {
      const pieces = await piecesOf(c);
      if (!pieces.length) continue;
      out.push({ _id: c._id, title: c.title, slug: c.slug, blurb: c.blurb, image: coverOf(c, pieces), count: pieces.length });
    }
    res.set('Cache-Control', 'public, max-age=120');
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: 'Could not load the edits.' });
  }
});

// GET /api/collections/all — every edit, drafts too (team)
router.get('/all', protect, teamOnly, async (req, res) => {
  try {
    const list = await Collection.find().sort({ position: 1, createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Could not load the edits.' });
  }
});

// GET /api/collections/:slug — one published edit with its pieces (the team can preview drafts)
router.get('/:slug', async (req, res) => {
  try {
    const c = await Collection.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
    if (!c) return res.status(404).json({ message: 'We couldn’t find that edit.' });
    if (!c.published && req.query.preview !== '1') return res.status(404).json({ message: 'We couldn’t find that edit.' });
    const pieces = await piecesOf(c);
    res.set('Cache-Control', c.published ? 'public, max-age=120' : 'no-store');
    res.json({ _id: c._id, title: c.title, slug: c.slug, blurb: c.blurb, image: coverOf(c, pieces), published: c.published, products: pieces });
  } catch (err) {
    res.status(500).json({ message: 'Could not load this edit.' });
  }
});

// POST /api/collections — new edit (team)
router.post('/', protect, teamOnly, async (req, res) => {
  try {
    const f = fields(req.body);
    if (!f.title) return res.status(400).json({ message: 'Give the edit a name.' });
    f.slug = await uniqueSlug(f.slug || slugify(f.title));
    const created = await Collection.create(f);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/collections/:id — save changes (team)
router.put('/:id', protect, teamOnly, async (req, res) => {
  try {
    const f = fields(req.body);
    if ('title' in f && !f.title) return res.status(400).json({ message: 'Give the edit a name.' });
    if (f.slug) f.slug = await uniqueSlug(f.slug, req.params.id);
    const updated = await Collection.findByIdAndUpdate(req.params.id, { $set: f }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'That edit no longer exists.' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/collections/:id — owner only
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Collection.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: 'Could not delete the edit.' });
  }
});

module.exports = router;
module.exports.slugify = slugify;
