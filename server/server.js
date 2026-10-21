const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const { stripOperators, apiLimiter } = require('./middleware/security');

// Refuse to start without the secrets the API depends on.
for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in the environment. Add it to .env (local) or Render → Environment.`);
    process.exit(1);
  }
}

const app = express();

// Render sits in front of the app as a proxy; this lets rate limits see the
// visitor's real IP instead of Render's.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Sensible security headers. This is a JSON API, so the page-focused
// policies (CSP etc.) belong on the Vercel sites, not here.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ---- Which websites are allowed to call this API ----
// Add more by setting ALLOWED_ORIGINS in .env / Render, comma separated.
const defaultOrigins = [
  'http://localhost:3000',   // admin (local)
  'http://localhost:3001',   // shop (local)
];

const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [...defaultOrigins, ...envOrigins];

app.use(cors({
  origin: (origin, callback) => {
    // Requests with no origin (Postman, server-to-server, health checks) are fine.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow Vercel preview deployments of these two projects.
    if (/^https:\/\/the-reset(-admin)?[a-z0-9-]*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    console.warn('Blocked by CORS:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Razorpay's webhook needs the raw body to check its signature, so it is
// mounted before the JSON parser.
app.use('/api/payments', require('./routes/payments'));
app.use(express.json({ limit: '200kb' }));
app.use(stripOperators);
app.use('/api', apiLimiter);

// Health check for uptime monitors (keeps the free Render plan awake).
app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1, at: new Date().toISOString() });
});

// Routes
app.use('/api/products', require('./routes/products'));
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/reviews',  require('./routes/reviews'));
app.use('/api/coupons',  require('./routes/coupons'));
app.use('/api/uploads',  require('./routes/uploads'));
app.use('/api/alerts',   require('./routes/alerts'));
app.use('/api/returns',  require('./routes/returns'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/giftcards', require('./routes/giftcards'));
app.use('/api/questions', require('./routes/questions'));

// Sitemap for search engines (outside /api, no rate limit)
app.use('/', require('./routes/sitemap'));
app.use('/share', require('./routes/share'));  // link previews for WhatsApp, Instagram, X…

// Test route
app.get('/', (req, res) => {
  res.send('THE RESET API is running');
});

// Unknown API routes get JSON, not an HTML page.
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Last-resort error handler: one consistent JSON shape, no stack traces leaked.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'This website is not allowed to use the API.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'That request is too large.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request could not be read.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await require('./utils/migrations').runMigrations();
    console.log('Allowed origins:', allowedOrigins.join(', '));
    const port = process.env.PORT || 5000;
    // Express 5 calls this even when listening fails, so check for an error —
    // otherwise "Server running" prints while an older copy still holds the port.
    app.listen(port, (err) => {
      if (err) {
        console.error(err.code === 'EADDRINUSE'
          ? `Port ${port} is already in use — another copy of the server is still running. Stop it with:  lsof -ti:${port} | xargs kill -9`
          : `Could not start the server: ${err.message}`);
        process.exit(1);
      }
      console.log(`Server running on port ${port}`);
      require('./utils/bagReminders').startBagReminders();
      require('./routes/payments').startPaymentSweeper();
      require('./utils/dailyDigest').startDailyDigest();
    });
  })
  .catch((err) => console.log('MongoDB error:', err));