const crypto = require('crypto');

/**
 * Time-based one-time codes (RFC 6238) — the 6-digit codes in Google
 * Authenticator, Microsoft Authenticator, 1Password, Authy and the like.
 * No extra package: it's an HMAC over the current 30-second window.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0; let value = 0; let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let value = 0; const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

const newSecret = () => base32Encode(crypto.randomBytes(20));

function codeAt(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

const counterNow = (t = Date.now()) => Math.floor(t / 30000);

// Accepts the code for now, or one step either side (clocks drift a little).
// Returns the matching counter so a code can't be used twice.
function verify(secret, token, t = Date.now()) {
  const code = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code) || !secret) return null;
  const now = counterNow(t);
  for (const c of [now - 1, now, now + 1]) {
    const a = Buffer.from(codeAt(secret, c));
    if (crypto.timingSafeEqual(a, Buffer.from(code))) return c;
  }
  return null;
}

function otpauthUrl(secret, account, issuer = 'THE RESET') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { newSecret, verify, otpauthUrl, codeAt, counterNow, base32Encode, base32Decode };
