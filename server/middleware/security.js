const rateLimit = require('express-rate-limit');

/**
 * Security middleware shared by the whole API.
 *
 * 1. stripOperators — MongoDB treats keys that start with "$" as commands.
 *    Without this, a login request like { "email": { "$ne": "" } } would match
 *    the first user in the database. We remove such keys from anything the
 *    browser sends before a route ever sees it.
 *
 * 2. Rate limits — stop scripts hammering the login, sign-up and
 *    password-reset endpoints, and put a generous ceiling on everything else.
 */

function clean(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(v => clean(v, depth + 1));
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
    } else {
      value[key] = clean(value[key], depth + 1);
    }
  }
  return value;
}

function stripOperators(req, res, next) {
  if (req.body)   clean(req.body);
  if (req.params) clean(req.params);
  // Express 5 makes req.query read-only, so it is cleaned key by key.
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const v = req.query[key];
      if (key.startsWith('$') || (v && typeof v === 'object')) {
        try { delete req.query[key]; } catch { /* read-only — routes cast to String anyway */ }
      }
    }
  }
  next();
}

const json429 = (message) => (req, res) => res.status(429).json({ message });

// Every route: 300 requests per minute per IP is far above normal shopping.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many requests. Please slow down and try again in a minute.'),
});

// Sign in / sign up: 20 tries per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many attempts from this device. Please try again in 15 minutes.'),
});

// Password-reset emails: 5 per hour per IP, so nobody can spam an inbox.
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429('Too many reset requests. Please try again in an hour.'),
});

module.exports = { stripOperators, apiLimiter, authLimiter, resetLimiter };
