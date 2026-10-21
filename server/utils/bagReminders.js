const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { sendMail } = require('./mailer');
const emails = require('./emails');

/**
 * "Still in your bag?" — one gentle email to a signed-in customer whose bag
 * has sat untouched for a day. Never more than one per bag, never if they
 * have ordered since, never for pieces that have sold out, and never again
 * once they turn reminders off.
 *
 * Runs on the live server only (Render sets RENDER=true), so a laptop
 * pointed at the same database never sends them. Set BAG_REMINDERS=off to
 * stop them everywhere, or BAG_REMINDERS=on to run them locally.
 */

const WAIT = 24 * 60 * 60 * 1000;          // a day after the bag last changed
const GIVE_UP = 7 * 24 * 60 * 60 * 1000;   // older bags are left alone
const EVERY = 30 * 60 * 1000;              // check every half hour

const sig = (id) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`bag-off:${id}`).digest('hex').slice(0, 32);
const offLink = (id) => {
  const api = (process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
  return `${api}/api/auth/reminders/off?u=${id}&t=${sig(String(id))}`;
};
const validOff = (id, t) => typeof t === 'string' && t.length === 32
  && crypto.timingSafeEqual(Buffer.from(sig(String(id))), Buffer.from(t));

const qtyFor = (p, size) => {
  const e = (p.stock || []).find((s) => s.size === size);
  if (!e) return p.inStock ? Infinity : 0;
  return e.qty;
};

async function sendDue() {
  const now = Date.now();
  const due = await User.find({
    'cart.0': { $exists: true },
    cartUpdatedAt: { $lte: new Date(now - WAIT), $gte: new Date(now - GIVE_UP) },
    cartReminderSentAt: null,
    bagReminders: { $ne: false },
  }).select('name email cart cartUpdatedAt').limit(50).lean();

  for (const u of due) {
    // Claim it first, so two servers (or a restart) can't both send.
    const claim = await User.updateOne(
      { _id: u._id, cartReminderSentAt: null },
      { $set: { cartReminderSentAt: new Date() } }
    );
    if (!claim.modifiedCount) continue;

    // Ordered since the bag last changed? Then it isn't abandoned.
    const ordered = await Order.exists({ user: u._id, createdAt: { $gte: u.cartUpdatedAt } });
    if (ordered) continue;

    // Only pieces that can still be bought, at today's price.
    const ids = u.cart.map((i) => i.product).filter(Boolean);
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const byId = Object.fromEntries(products.map((p) => [String(p._id), p]));
    const items = u.cart.map((i) => {
      const p = byId[String(i.product)];
      if (!p || p.inStock === false) return null;
      const left = qtyFor(p, i.size);
      if (left <= 0) return null;
      return {
        id: String(p._id),
        name: p.colorName ? `${p.name} — ${p.colorName}` : p.name,
        size: i.size,
        qty: i.qty || 1,
        price: p.price,
        mrp: p.mrp,
        image: (p.images && p.images[0]) || p.image,
        fewLeft: left !== Infinity && left <= 3 ? left : 0,
      };
    }).filter(Boolean);
    if (!items.length || !u.email) continue;

    try {
      await sendMail({ to: u.email, ...emails.bagReminder({ name: u.name, items, stopUrl: offLink(u._id) }) });
    } catch (err) {
      console.error('Bag reminder failed:', err.message);
    }
  }
}

function startBagReminders() {
  const flag = (process.env.BAG_REMINDERS || '').toLowerCase();
  const on = flag === 'on' || (process.env.RENDER && flag !== 'off');
  if (!on) return;
  const run = () => sendDue().catch((err) => console.error('Bag reminders:', err.message));
  setTimeout(run, 60 * 1000);           // shortly after start-up
  setInterval(run, EVERY).unref();
  console.log('Bag reminders on (one email a day after a bag is left).');
}

module.exports = { startBagReminders, sendDue, validOff, offLink };
