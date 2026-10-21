const express = require('express');
const router  = express.Router();
const Review  = require('../models/Review');
const Order   = require('../models/Order');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// A review photo must be one of this shopper's own uploads to our Cloudinary.
const photoOk = (url, userId) => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return !!cloud && typeof url === 'string' && url.length < 500
    && url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`)
    && url.includes(`/the-reset/reviews/${userId}/`);
};

// POST /api/reviews — add review (logged in)
router.post('/', protect, async (req, res) => {
  const product = typeof req.body.product === 'string' ? req.body.product : '';
  const rating = Math.round(Number(req.body.rating));
  const review = typeof req.body.review === 'string' ? req.body.review.trim() : '';

  if (!product) return res.status(400).json({ message: 'Which piece is this review for?' });
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Pick a rating from 1 to 5 stars.' });
  if (review.length < 3) return res.status(400).json({ message: 'Write a few words about the piece.' });
  if (review.length > 2000) return res.status(400).json({ message: 'Please keep the review under 2000 characters.' });

  try {
    // "Verified buyer" = this customer has a delivered order with this piece.
    const verified = !!(await Order.exists({ user: req.user._id, 'items.product': product, status: 'Delivered' }));

    const photos = Array.isArray(req.body.photos) ? [...new Set(req.body.photos)].slice(0, 3) : [];
    if (photos.length && !verified) return res.status(403).json({ message: 'Photos can be added once you’ve received this piece.' });
    if (photos.some((u) => !photoOk(u, req.user._id))) return res.status(400).json({ message: 'One of the photos didn’t upload properly. Remove it and try again.' });

    const existing = await Review.findOne({ user: req.user._id, product });
    if (existing) {
      existing.rating = rating;
      existing.review = review;
      existing.verified = verified;
      existing.photos = photos;
      const updated = await existing.save();
      return res.json(updated);
    }
    const created = await Review.create({
      user: req.user._id,
      userName: req.user.name,
      product,
      rating,
      review,
      verified,
      photos,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/reviews/product/:productId — get all reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reviews/myreviews — get logged in user's reviews
router.get('/myreviews', protect, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate('product', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/reviews/:id — delete a review
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    // The author, or an admin taking down something that breaks the rules.
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized' });
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reviews/all — latest reviews for moderation (admin)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const filter = req.query.photos === '1' ? { 'photos.0': { $exists: true } } : {};
    const list = await Review.find(filter).populate('product', 'name image').sort({ createdAt: -1 }).limit(200);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Could not load reviews.' });
  }
});

// PUT /api/reviews/:id/remove-photo — { url } (admin)
router.put('/:id/remove-photo', protect, adminOnly, async (req, res) => {
  try {
    const r = await Review.findByIdAndUpdate(req.params.id, { $pull: { photos: String(req.body.url || '') } }, { new: true });
    if (!r) return res.status(404).json({ message: 'Review not found' });
    res.json(r);
  } catch (err) {
    res.status(400).json({ message: 'Could not remove the photo.' });
  }
});

// GET /api/reviews/summary/:productId — avg rating + count
router.get('/summary/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId });
    const count = reviews.length;
    const avg   = count ? (reviews.reduce((s, r) => s + r.rating, 0) / count).toFixed(1) : 0;
    res.json({ count, avg: parseFloat(avg) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/reviews/recent — the latest well-rated reviews, for the homepage.
 * Only 4 and 5 star reviews with a bit of substance behind them.
 */
router.get('/recent', async (req, res) => {
  try {
    const reviews = await Review.find({ rating: { $gte: 4 } })
      .populate('product', 'name category image images')
      .sort({ createdAt: -1 })
      .limit(12);

    // Skip one-word reviews — they read as filler on a homepage.
    // Low enough to let a genuine short review through ("Great fit, love it")
    // while still keeping out "ok" and "nice".
    const MIN_LENGTH = 10;

    const worthShowing = reviews
      .filter(r => r.product && (r.review || '').trim().length >= MIN_LENGTH)
      .slice(0, 6);

    res.json(worthShowing);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;