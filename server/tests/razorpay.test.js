const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
process.env.RAZORPAY_KEY_SECRET = 'test-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'hook-secret';
const rzp = require('../utils/razorpay');

test('checkout signatures are checked with the key secret', () => {
  const sig = crypto.createHmac('sha256', 'test-secret').update('order_1|pay_1').digest('hex');
  assert.equal(rzp.validCheckoutSignature('order_1', 'pay_1', sig), true);
  assert.equal(rzp.validCheckoutSignature('order_1', 'pay_2', sig), false);
  assert.equal(rzp.validCheckoutSignature('order_1', 'pay_1', 'nope'), false);
});

test('webhook signatures are checked over the raw body', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const sig = crypto.createHmac('sha256', 'hook-secret').update(body).digest('hex');
  assert.equal(rzp.validWebhookSignature(body, sig), true);
  assert.equal(rzp.validWebhookSignature(Buffer.from('{"event":"x"}'), sig), false);
});

test('rupees go to Razorpay as paise', () => {
  assert.equal(rzp.paise(1389), 138900);
  assert.equal(rzp.paise(99.5), 9950);
});
