const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const { formatINR } = require('../utils/price');

/**
 * Link previews for shared product links.
 *
 * The shop is a single-page app, so WhatsApp, Instagram, X and friends —
 * which never run JavaScript — would see the same generic card for every
 * product. The shop's vercel.json sends only those preview bots here; this
 * returns a tiny page whose tags describe the actual product (photo, name,
 * price). Real shoppers never hit this route.
 */

const SHOP = () => (process.env.SHOP_URL || 'https://the-reset-snowy.vercel.app').replace(/\/$/, '');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?![a-z]{1,3}_)/;

// A 1200×630 card (the size every app expects), photo centred on the brand grey.
function cardImage(url) {
  if (!url) return `${SHOP()}/og.jpg`;
  if (url.startsWith('/')) url = SHOP() + url;
  if (CLOUDINARY.test(url)) {
    return url.replace(CLOUDINARY, '$1c_pad,b_rgb:f2f2f1,w_1200,h_630,f_jpg,q_auto/');
  }
  return url;
}

function page({ title, description, image, url, price, available }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="THE RESET">
<meta property="og:type" content="${price ? 'product' : 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="en_IN">
${price ? `<meta property="product:price:amount" content="${price}">
<meta property="product:price:currency" content="INR">
<meta property="product:availability" content="${available ? 'in stock' : 'out of stock'}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(url)}">
</head><body><a href="${esc(url)}">${esc(title)}</a></body></html>`;
}

// GET /share/product/:id
router.get('/product/:id', async (req, res) => {
  const url = `${SHOP()}/product/${encodeURIComponent(req.params.id)}`;
  res.set('Content-Type', 'text/html; charset=utf-8');

  const fallback = () => page({
    title: 'THE RESET — Considered Essentials',
    description: 'Considered essentials for men and women. Clean lines, honest fabric, nothing excess.',
    image: `${SHOP()}/og.jpg`,
    url,
  });

  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send(fallback());

  try {
    const p = await Product.findById(req.params.id)
      .select('name price mrp description category subcategory image images inStock stock').lean();
    if (!p) return res.status(404).send(fallback());

    const onSale = p.mrp > p.price;
    const off = onSale ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    const priceLine = onSale
      ? `${formatINR(p.price)} (was ${formatINR(p.mrp)}, ${off}% off)`
      : formatINR(p.price);
    const blurb = (p.description || `${p.subcategory} for ${String(p.category).toLowerCase()}`)
      .replace(/\s+/g, ' ').trim();
    const short = blurb.length > 140 ? `${blurb.slice(0, 137).trimEnd()}…` : blurb;
    const stockLeft = (p.stock || []).reduce((n, s) => n + (s.qty || 0), 0);
    const available = p.inStock !== false && (!(p.stock || []).length || stockLeft > 0);

    res.set('Cache-Control', 'public, max-age=600');
    res.send(page({
      title: `${p.name} — ${formatINR(p.price)} | THE RESET`,
      description: `${priceLine} · ${short}`,
      image: cardImage(p.image || (p.images || [])[0]),
      url,
      price: p.price,
      available,
    }));
  } catch (err) {
    res.status(500).send(fallback());
  }
});

module.exports = router;
