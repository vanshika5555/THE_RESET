const express = require('express');
const router  = express.Router();
const Review  = require('../models/Review');
const { protect } = require('../middleware/authMiddleware');

// POST /api/reviews — add review (logged in)
router.post('/', protect, async (req, res) => {
  const { product, rating, review } = req.body;
  try {
    const existing = await Review.findOne({ user: req.user._id, product });
    if (existing) {
      // update existing
      existing.rating = rating;
      existing.review = review;
      const updated = await existing.save();
      return res.json(updated);
    }
    const created = await Review.create({
      user: req.user._id,
      userName: req.user.name,
      product,
      rating,
      review,
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
    if (review.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

module.exports = router;