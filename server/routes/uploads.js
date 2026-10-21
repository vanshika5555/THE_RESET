const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');

/**
 * Photo uploads go straight from the admin's browser to Cloudinary.
 * The API never touches the image itself; it only signs the request, so the
 * Cloudinary secret stays on the server and nobody else can upload.
 *
 * Set on Render (Environment) and in server/.env:
 *   CLOUDINARY_CLOUD_NAME   from the Cloudinary dashboard
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

// Cloudinary's signing rule: sort the parameters, join as a=b&c=d,
// add the secret, SHA-1 it.
function sign(params, secret) {
  const toSign = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

// GET /api/uploads/signature — a one-off permission slip for one upload batch
router.get('/signature', protect, adminOnly, (req, res) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(503).json({
      message: 'Photo uploads are not set up yet. Add the three CLOUDINARY_ keys to the server settings, or paste an image link for now.',
    });
  }

  const params = {
    folder: 'the-reset/products',
    timestamp: Math.floor(Date.now() / 1000),   // Cloudinary rejects it after 1 hour
  };

  res.json({
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    ...params,
    signature: sign(params, CLOUDINARY_API_SECRET),
  });
});

/**
 * GET /api/uploads/review-signature?product=<id> — photo uploads for reviews.
 * Only for shoppers who bought and received the piece, into their own folder,
 * images only.
 */
router.get('/review-signature', protect, async (req, res) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(503).json({ message: 'Photo uploads aren’t switched on yet.' });
  }
  const product = typeof req.query.product === 'string' ? req.query.product : '';
  const Order = require('../models/Order');
  const bought = /^[a-f0-9]{24}$/i.test(product)
    && await Order.exists({ user: req.user._id, 'items.product': product, status: 'Delivered' });
  if (!bought) return res.status(403).json({ message: 'Photos can be added once you’ve received this piece.' });

  const params = {
    folder: `the-reset/reviews/${req.user._id}`,
    allowed_formats: 'jpg,jpeg,png,webp,heic',
    timestamp: Math.floor(Date.now() / 1000),
  };
  res.json({ cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, ...params, signature: sign(params, CLOUDINARY_API_SECRET) });
});

module.exports = router;
module.exports.sign = sign;
