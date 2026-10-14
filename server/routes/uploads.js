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

module.exports = router;
module.exports.sign = sign;
