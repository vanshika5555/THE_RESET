<p align="center">
  <img src="client/public/og.jpg" alt="THE RESET — considered essentials for men and women" width="100%">
</p>

<h1 align="center">THE RESET</h1>

<p align="center">
  A full-stack clothing store — shop, admin panel and API — built with the MERN stack.<br>
  <a href="https://the-reset-snowy.vercel.app"><b>Live shop</b></a> ·
  <a href="https://the-reset-admin.vercel.app"><b>Admin panel</b></a> ·
  <a href="https://the-reset-api.onrender.com/api/health"><b>API status</b></a>
</p>

<p align="center">
  <a href="https://github.com/vanshika5555/THE_RESET/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/vanshika5555/THE_RESET/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-000?logo=react&logoColor=61DAFB">
  <img alt="Vite 6" src="https://img.shields.io/badge/Vite-6-000?logo=vite&logoColor=FFC517">
  <img alt="Express 5" src="https://img.shields.io/badge/Express-5-000?logo=express">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Atlas-000?logo=mongodb&logoColor=47A248">
  <img alt="Cloudinary" src="https://img.shields.io/badge/Images-Cloudinary-000?logo=cloudinary&logoColor=3448C5">
</p>

---

## What's inside

### Shop (`client/`)
- **Browse** — Men / Women collections with season, category and price filters, live search with suggestions, a second photo on hover and swipeable cards on phones.
- **Product page** — photo gallery with zoom, size guide, per-size stock ("Only 2 left in M"), sale prices with % off, reviews with a *Verified buyer* badge, related and recently viewed products.
- **Sold out?** — pick the size anyway and tap *Notify me*; you get an email the moment it's restocked.
- **Share** — the phone share sheet or copy-link; shared links unfurl on WhatsApp, Instagram and X with the product's photo and price.
- **Bag & checkout** — quick-add from any grid, saved addresses, coupon codes, server-side price checks.
- **Store credit** — returns can be refunded as instant store credit, the owner can add credit as a goodwill gesture, and it comes off at checkout (whole order or part of it).
- **Invite a friend** — “give ₹200, get ₹200”: share a link; both get store credit once the friend’s first order arrives (no credit for sign-ups alone, so fake accounts earn nothing).
- **Gift cards** — bought online and emailed with a code; the recipient adds it to their account as store credit. The owner can send free ones from the admin.
- **Account** — orders with live status, cancel while pending, **returns & exchanges** within 7 days, wishlist, reviews, password reset by email, *sign out everywhere*.
- **Newsletter** — subscribers get a one-time `WELCOME-XXXXXX` code for their first order.
- **Built for phones first** — sticky Add to Bag, 44px tap targets, no horizontal scroll at 360px.
- **Installable app** — add it to the home screen on Android or iPhone; opens full screen, with an offline page when there's no signal.

### Admin (`admin/`)
- **Dashboard** — orders to confirm and ship, sales, low stock, and which sold-out sizes shoppers are waiting for.
- **Products** — add and edit with drag-and-drop photo upload (signed Cloudinary uploads), per-size stock, sale price, hide/show.
- **Orders, returns, customers, discount codes** — the full order life-cycle, including approving returns and restocking returned items.
- **Team** — staff accounts with their own logins, an activity log on every order, and a morning email with the day's to-do list.

### API (`server/`)
- **Express 5 + Mongoose 9** REST API.
- **Stock that can't oversell** — five people buying the last piece leaves exactly one order; single-use coupons are claimed atomically.
- **Security** — helmet headers, rate limits on login and reset, NoSQL-injection stripping, bcrypt passwords, JWTs that can be revoked (`tokenVersion`), hashed one-time reset tokens.
- **Emails** — order placed / status changes, back in stock, returns, password reset, welcome code (SMTP; printed to the log when SMTP isn't set).
- **SEO** — a live `sitemap.xml` and per-product link previews for social apps.

## Tech stack

| Part   | Built with |
|--------|------------|
| Shop   | React 19, React Router 7, Vite 6, plain CSS (Archivo variable font) |
| Admin  | React 19, React Router 7, Vite 6 |
| API    | Node.js, Express 5, Mongoose 9, JWT, Nodemailer, helmet |
| Data   | MongoDB Atlas · Cloudinary for product photos |
| Hosted | Vercel (shop + admin) · Render (API) |

## Project layout

```
THE_RESET/
├── client/   # the shop            → Vercel  (port 3001 locally)
├── admin/    # the admin panel     → Vercel  (port 3000 locally)
└── server/   # the API             → Render  (port 5000 locally)
    ├── models/       Product, Order, User, Review, Coupon, ReturnRequest, StockAlert, Subscriber
    ├── routes/       products, auth, orders, reviews, coupons, uploads, alerts, returns, newsletter, share, sitemap
    ├── middleware/   auth + security
    └── utils/        stock, price, mailer, emails, migrations
```

## Run it locally

You need Node.js 20+ and a MongoDB connection string (a free MongoDB Atlas cluster works).

```bash
git clone https://github.com/vanshika5555/THE_RESET.git
cd THE_RESET

# 1. API
cd server
cp .env.example .env        # then fill in MONGO_URI and JWT_SECRET at least
npm install
npm start                   # http://localhost:5000

# 2. Shop (new terminal)
cd client && npm install && npm start      # http://localhost:3001

# 3. Admin (new terminal)
cd admin && npm install && npm start       # http://localhost:3000
```

Run the tests with `npm test` inside `server/`, `client/` or `admin/`. GitHub runs them — plus a full build of the shop and admin — on every push.

Create the first admin account with `node seedAdmin.js` inside `server/` (it reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`).

### Environment variables

All of them are listed with comments in [`server/.env.example`](server/.env.example).

| Key | Needed for |
|-----|-----------|
| `MONGO_URI`, `JWT_SECRET` | everything (required) |
| `ALLOWED_ORIGINS` | which sites may call the API |
| `SHOP_URL`, `API_URL` | links inside emails and previews |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | sending email |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | photo uploads in the admin |

The shop and admin read `REACT_APP_API_URL` (set it on Vercel; locally it falls back to `http://localhost:5000`).

## Deploying

- **API → Render**: root directory `server`, build `npm install`, start `npm start`, add the env vars above.
- **Shop and admin → Vercel**: root directory `client` or `admin`; `vercel.json` in each sets the build. Add `REACT_APP_API_URL`.
- Point an uptime monitor at `/api/health` so the free Render instance doesn't sleep.

---

<p align="center">Made by <a href="https://github.com/vanshika5555">Vanshika Malik</a></p>
