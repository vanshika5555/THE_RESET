const test = require('node:test');
const assert = require('node:assert');
const { build, worthSending, istMidnight, dayKey } = require('../utils/dailyDigest');

const data = (over = {}) => ({
  date: new Date('2026-10-21T00:00:00+05:30'),
  questions: 0,
  toConfirm: 0, oldestPendingHours: 0, toShip: 0, returnsNew: 0, returnsBack: 0,
  cashOnTheRoad: { orders: 0, amount: 0 },
  sales: { orders: 0, amount: 0, pieces: 0 },
  stock: [], stockMore: 0, soldOut: 0,
  ...over,
});

test('India time: the day turns at midnight IST, not UTC', () => {
  // 20:00 UTC on the 20th is 01:30 on the 21st in India.
  const now = new Date('2026-10-20T20:00:00Z');
  assert.equal(dayKey(now), 20261021);
  assert.equal(istMidnight(now).toISOString(), '2026-10-20T18:30:00.000Z');
});

test('subject says what needs doing', () => {
  const m = build(data({ toConfirm: 3, toShip: 1, returnsNew: 1 }), { name: 'Vanshika Malik', owner: true });
  assert.equal(m.subject, 'Today: 3 to confirm, 1 to ship, 1 return');
  assert.match(m.html, /Good morning, Vanshika\./);
});

test('sales figures go to the owner only', () => {
  const d = data({ sales: { orders: 4, amount: 9160, pieces: 6 } });
  assert.match(build(d, { name: 'V', owner: true }).html, /₹9,160/);
  assert.doesNotMatch(build(d, { name: 'A', owner: false }).html, /₹9,160/);
  assert.equal(Boolean(worthSending(d, true)), true);
  assert.equal(Boolean(worthSending(d, false)), false);   // staff: nothing to do, no email
});

test('names from the shop are escaped', () => {
  const m = build(data({ stock: [{ name: '<b>Tee</b>', size: 'M', qty: 0, waiting: 2 }] }), { name: 'V', owner: true });
  assert.match(m.html, /&lt;b&gt;Tee&lt;\/b&gt;/);
  assert.match(m.html, /Sold out/);
  assert.match(m.html, /2 shoppers waiting/);
});
