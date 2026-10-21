const User = require('../models/User');
const Product = require('../models/Product');
const { sendMailLater } = require('./mailer');
const emails = require('./emails');
const { offLink } = require('./bagReminders');

/**
 * Wishlist price drops: when a piece someone saved gets cheaper, tell them —
 * once per new low. Raising the price again re-arms it for the next drop.
 * Shoppers who turned off shopping emails (the link in these and in bag
 * reminders) are skipped.
 */
async function notifyPriceDrop(before, after) {
  try {
    if (!before || !after || after.inStock === false) return;
    const was = Number(before.price) || 0;
    const now = Number(after.price) || 0;
    if (!was || !now) return;

    // Price went up above the last low we told people about: re-arm.
    if (after.lowestNotifiedPrice && now > after.lowestNotifiedPrice) {
      await Product.updateOne({ _id: after._id }, { $set: { lowestNotifiedPrice: 0 } });
      return;
    }
    const floor = after.lowestNotifiedPrice || was;
    if (now >= floor) return;

    // Claim this low first so two quick saves can't both send.
    const claim = await Product.updateOne(
      { _id: after._id, $or: [{ lowestNotifiedPrice: { $exists: false } }, { lowestNotifiedPrice: 0 }, { lowestNotifiedPrice: { $gt: now } }] },
      { $set: { lowestNotifiedPrice: now } }
    );
    if (!claim.modifiedCount) return;

    const people = await User.find({ wishlist: after._id, bagReminders: { $ne: false } })
      .select('name email').limit(500).lean();
    const product = { ...after, price: now, wasPrice: Math.max(was, Number(after.mrp) || 0) };
    for (const u of people) {
      if (!u.email) continue;
      sendMailLater({ to: u.email, ...emails.priceDrop({ name: u.name, product, stopUrl: offLink(u._id) }) });
    }
    if (people.length) console.log(`Price drop on ${after.name}: told ${people.length} shopper${people.length === 1 ? '' : 's'}.`);
  } catch (err) {
    console.error('Price drop alerts failed:', err.message);
  }
}

module.exports = { notifyPriceDrop };
