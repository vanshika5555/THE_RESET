/**
 * Invite a friend — "Give ₹200, get ₹200".
 *
 * Everyone has a code (made the first time they look at it). A friend who
 * signs up through it is linked to them. When that friend's first order
 * worth at least the minimum is delivered, both get store credit — once.
 * Rewarding on delivery — not sign-up — means fake accounts earn nothing.
 *
 * REFERRAL_REWARD (₹, default 200), REFERRAL_MIN (₹ order value, default 999),
 * REFERRALS=off to switch it off.
 */
const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const credit = require('./credit');
const { sendMailLater } = require('./mailer');
const emails = require('./emails');

const on = () => (process.env.REFERRALS || '').toLowerCase() !== 'off';
const reward = () => Math.max(0, Number(process.env.REFERRAL_REWARD) || 200);
const minOrder = () => Math.max(0, Number(process.env.REFERRAL_MIN ?? 999));

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const tail = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join('');
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);

// RIYA-7K2P: the first name (letters only, up to 8) and 4 random characters.
async function codeFor(user) {
  if (user.referralCode) return user.referralCode;
  const base = (String(user.name || '').split(/\s+/)[0] || 'FRIEND').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'FRIEND';
  for (let i = 0; i < 6; i += 1) {
    const code = `${base}-${tail(4)}`;
    try {
      const r = await User.updateOne({ _id: user._id, referralCode: { $in: [null, ''] } }, { $set: { referralCode: code } });
      if (r.modifiedCount) return code;
      const fresh = await User.findById(user._id).select('referralCode');
      if (fresh?.referralCode) return fresh.referralCode;
    } catch (err) {
      if (err.code !== 11000) throw err;   // that code is taken — try another
    }
  }
  throw new Error('Could not make a referral code.');
}

async function inviterFor(code) {
  const c = normCode(code);
  if (!c) return null;
  return User.findOne({ referralCode: c }).select('name email');
}

// At sign-up: link the new account to whoever invited them (never to themselves).
async function attach(newUser, code) {
  if (!on() || !code) return null;
  const inviter = await inviterFor(code);
  if (!inviter || String(inviter._id) === String(newUser._id)) return null;
  await User.updateOne({ _id: newUser._id, referredBy: null }, { $set: { referredBy: inviter._id } });
  return inviter;
}

const amountOf = (o) => Math.max(0, (Number(o.total) || Number(o.subtotal) || 0) - (Number(o.delivery) || 0) - (Number(o.payment?.codFee) || 0));
const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);

/**
 * Called when an order is marked Delivered. Rewards both people once, the
 * first time one of the friend's orders qualifies.
 */
async function rewardIfDue(order) {
  try {
    if (!on() || !order?.user) return false;
    const friend = await User.findById(order.user._id || order.user).select('name email referredBy referralRewarded');
    if (!friend?.referredBy || friend.referralRewarded) return false;
    // Their first delivered order worth the minimum (smaller ones don't use it up).
    if (amountOf(order) < minOrder()) return false;
    const inviter = await User.findById(friend.referredBy).select('name email');
    if (!inviter) return false;
    // Same phone as the inviter's own orders? Most likely the same person.
    const phone = digits(order.shippingAddress?.phone);
    if (phone) {
      const own = await Order.exists({ user: inviter._id, 'shippingAddress.phone': { $regex: `${phone}$` } });
      if (own) {
        await User.updateOne({ _id: friend._id }, { $set: { referralRewarded: true } });
        return false;
      }
    }
    // Claim it — only one call can.
    const claim = await User.updateOne({ _id: friend._id, referralRewarded: { $ne: true } }, { $set: { referralRewarded: true } });
    if (!claim.modifiedCount) return false;

    const amt = reward();
    const first = (n) => String(n || '').split(/\s+/)[0] || 'your friend';
    await credit.add(inviter._id, amt, 'referral', `${first(friend.name)} joined with your invite`, { order: order._id });
    await credit.add(friend._id, amt, 'referral', `Welcome gift from ${first(inviter.name)}`, { order: order._id });
    sendMailLater({ to: inviter.email, ...emails.referralReward({ name: inviter.name, amount: amt, other: first(friend.name), inviter: true }) });
    sendMailLater({ to: friend.email, ...emails.referralReward({ name: friend.name, amount: amt, other: first(inviter.name), inviter: false }) });
    return true;
  } catch (err) {
    console.error('Referral reward failed:', err.message);
    return false;
  }
}

module.exports = { on, reward, minOrder, codeFor, inviterFor, attach, rewardIfDue, normCode };
