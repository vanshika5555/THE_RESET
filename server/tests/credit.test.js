const test = require('node:test');
const assert = require('node:assert');
const { amountDue, splitRefund } = require('../utils/credit');

test('what is left to pay after store credit', () => {
  assert.equal(amountDue({ total: 2580, payment: { credit: 1500 } }), 1080);
  assert.equal(amountDue({ total: 1389, payment: { credit: 1389 } }), 0);
  assert.equal(amountDue({ total: 999 }), 999);
});

test('a return is refunded in the same share the order was paid', () => {
  // ₹2,580 order, ₹1,500 of it store credit → 58% of any refund is credit.
  const order = { total: 2580, payment: { method: 'cod', credit: 1500 } };
  assert.deepEqual(splitRefund(order, 1290, false), { credit: 750, money: 540 });
  assert.deepEqual(splitRefund(order, 1290, true), { credit: 1290, money: 0 });
  assert.deepEqual(splitRefund({ total: 1000, payment: { method: 'online' } }, 400, false), { credit: 0, money: 400 });
  assert.deepEqual(splitRefund({ total: 1389, payment: { method: 'credit', credit: 1389 } }, 1290, false), { credit: 1290, money: 0 });
});
