/**
 * Gift cards — making codes, switching a paid card on, and emailing it.
 */
const crypto = require('crypto');
const GiftCard = require('../models/GiftCard');
const { sendMail } = require('./mailer');
const emails = require('./emails');

// No 0/O, 1/I/L — easy to read off a phone and type.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MIN = 500;
const MAX = 20000;
const PRESETS = [1000, 2000, 3000, 5000];

function newCode() {
  let s = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i += 1) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `RESET${s}`;
}

// "reset-ab12 cd34-ef56" → "RESETAB12CD34EF56"; the RESET prefix is optional when typing.
function normalise(input) {
  let s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s.startsWith('RESET')) s = `RESET${s}`;
  return s;
}

const hash = (code) => crypto.createHash('sha256').update(normalise(code)).digest('hex');

// RESET-AB12-CD34-EF56 for people to read.
const pretty = (code) => normalise(code).replace(/^RESET(.{4})(.{4})(.{4})$/, 'RESET-$1-$2-$3');

function withCode(fields = {}) {
  const code = newCode();
  return { ...fields, code, codeHash: hash(code), last4: code.slice(-4) };
}

async function sendCard(cardId) {
  const card = await GiftCard.findById(cardId).select('+code').populate('buyer', 'name email');
  if (!card || card.status !== 'Active' || !card.to.email) return false;
  await sendMail({ to: card.to.email, ...emails.giftCard({ card, code: pretty(card.code) }) });
  if (card.buyer && card.buyer.email && card.buyer.email !== card.to.email) {
    await sendMail({ to: card.buyer.email, ...emails.giftCardReceipt({ card, name: card.buyer.name }) }).catch(() => {});
  }
  await GiftCard.updateOne({ _id: card._id }, { sentAt: new Date() });
  return true;
}

// Paid → switched on and emailed. Only the first call does anything.
async function activate(card, paymentId) {
  const r = await GiftCard.updateOne(
    { _id: card._id, status: 'Awaiting' },
    { $set: { status: 'Active', paidAt: new Date(), razorpayPaymentId: paymentId || '' } }
  );
  if (r.modifiedCount) sendCard(card._id).catch((err) => console.error('Gift card email failed:', err.message));
  return GiftCard.findById(card._id);
}

module.exports = { MIN, MAX, PRESETS, newCode, normalise, hash, pretty, withCode, sendCard, activate };
