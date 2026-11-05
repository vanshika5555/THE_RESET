const Product = require('../models/Product');
const StockAlert = require('../models/StockAlert');
const { sendMail } = require('./mailer');
const emails = require('./emails');

/**
 * Drops: a product with a dropAt in the future is on show (countdown,
 * "Notify me") but can't be bought until that moment. Shoppers who asked
 * are emailed once when it goes live. Their sign-ups are StockAlert rows
 * with size DROP.
 *
 * The email sweep runs on the live server only (Render sets RENDER=true);
 * DROP_ALERTS=on runs it locally, DROP_ALERTS=off stops it everywhere.
 */

const DROP = 'DROP';
const EVERY = 2 * 60 * 1000;                // look every 2 minutes
const GIVE_UP = 3 * 24 * 60 * 60 * 1000;    // a drop older than 3 days gets no "it's live" email

const isUpcoming = (p, now = Date.now()) => !!(p && p.dropAt && new Date(p.dropAt).getTime() > now);

// "Fri 13 Nov, 7 pm" in India time.
function dropWhen(at) {
  const d = new Date(at);
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    .replace(':00', '').replace(/\s?([ap])\.?m\.?/i, (m, x) => ` ${x.toLowerCase()}m`);
  return `${day}, ${time}`;
}

async function sendDropAlerts(now = Date.now()) {
  const live = await Product.find({
    dropAt: { $lte: new Date(now), $gte: new Date(now - GIVE_UP) },
    dropNotifiedAt: null,
  }).limit(20).lean();

  let sent = 0;
  for (const p of live) {
    // Claim it, so a restart or a second server can't send twice.
    const claim = await Product.updateOne({ _id: p._id, dropNotifiedAt: null }, { $set: { dropNotifiedAt: new Date() } });
    if (!claim.modifiedCount || p.inStock === false) continue;
    const alerts = await StockAlert.find({ product: p._id, size: DROP, notifiedAt: null }).lean();
    for (const a of alerts) {
      try {
        await sendMail({ to: a.email, ...emails.dropLive({ product: p }) });
        await StockAlert.updateOne({ _id: a._id }, { $set: { notifiedAt: new Date() } });
        sent += 1;
      } catch (err) {
        console.error('Drop email failed:', err.message);
      }
    }
  }
  return sent;
}

function startDropAlerts() {
  const flag = (process.env.DROP_ALERTS || '').toLowerCase();
  const on = flag === 'on' || (process.env.RENDER && flag !== 'off');
  if (!on) return;
  const run = () => sendDropAlerts().catch((err) => console.error('Drop alerts:', err.message));
  setTimeout(run, 30 * 1000);
  setInterval(run, EVERY).unref();
  console.log('Drop alerts on (emails shoppers when a drop goes live).');
}

module.exports = { DROP, isUpcoming, dropWhen, sendDropAlerts, startDropAlerts };
