const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

/**
 * GET /sitemap.xml — every page Google should know about.
 * The shop on Vercel forwards its own /sitemap.xml here (see client/vercel.json),
 * so the list is always current without rebuilding the shop.
 */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

router.get('/sitemap.xml', async (req, res) => {
  const base = (process.env.SHOP_URL || 'https://the-reset-snowy.vercel.app').replace(/\/$/, '');
  try {
    const products = await Product.find({ inStock: { $ne: false } }).select('_id updatedAt').lean();
    const pages = [
      { loc: '/', priority: '1.0' },
      { loc: '/men', priority: '0.9' },
      { loc: '/women', priority: '0.9' },
      { loc: '/about', priority: '0.5' },
      { loc: '/help', priority: '0.4' },
    ];
    const urls = [
      ...pages.map(p => `<url><loc>${esc(base + p.loc)}</loc><priority>${p.priority}</priority></url>`),
      ...products.map(p => `<url><loc>${esc(`${base}/product/${p._id}`)}</loc>${
        p.updatedAt ? `<lastmod>${new Date(p.updatedAt).toISOString().slice(0, 10)}</lastmod>` : ''
      }<priority>0.8</priority></url>`),
    ];
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
  } catch (err) {
    res.status(500).send('');
  }
});

module.exports = router;
