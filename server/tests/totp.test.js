const test = require('node:test');
const assert = require('node:assert/strict');
const totp = require('../utils/totp');

// RFC 6238 test secret "12345678901234567890": at 59 seconds the 8-digit
// code is 94287082, so the 6-digit code is its last six digits.
const secret = totp.base32Encode(Buffer.from('12345678901234567890'));

test('matches the RFC 6238 test vector', () => {
  assert.equal(totp.codeAt(secret, 1), '287082');
});

test('accepts the current code and one step either side, nothing else', () => {
  const t = 59000;
  assert.notEqual(totp.verify(secret, '287082', t), null);
  assert.notEqual(totp.verify(secret, '287 082', t), null);
  assert.equal(totp.verify(secret, '000000', t), null);
  assert.equal(totp.verify(secret, '287082', t + 5 * 60000), null);
  assert.equal(totp.verify(secret, 'abcdef', t), null);
});

test('new secrets are base32 and round-trip', () => {
  const s = totp.newSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.equal(totp.base32Encode(totp.base32Decode(s)), s);
});
