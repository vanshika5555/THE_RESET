const test = require('node:test');
const assert = require('node:assert');
const { bestOffer, nextOffer, discountFor } = require('../utils/offers');

const buy2 = { name: 'Buy 2, get 10% off', condition: { type: 'qty', value: 2 }, reward: { type: 'percent', value: 10 } };
const spend3k = { name: '₹300 off ₹2,999+', condition: { type: 'spend', value: 2999 }, reward: { type: 'amount', value: 300 } };
const women = { name: 'Women: 15% off 3+', condition: { type: 'qty', value: 3 }, reward: { type: 'percent', value: 15 }, category: 'Women' };
const tee = (qty, category = 'Men', price = 1490) => ({ price, qty, category });

test('the offer that saves most wins', () => {
  assert.equal(bestOffer([buy2, spend3k], [tee(1)]), null);
  assert.equal(bestOffer([buy2, spend3k], [tee(2)]).offer.name, 'Buy 2, get 10% off');      // ₹298
  assert.equal(bestOffer([buy2, spend3k], [tee(3)]).offer.name, 'Buy 2, get 10% off');      // ₹447 > ₹300
  assert.equal(bestOffer([buy2, spend3k], [tee(1, 'Men', 3200)]).offer.name, '₹300 off ₹2,999+');  // one piece, big spend
});

test('department offers only count that department', () => {
  assert.equal(discountFor(women, [tee(2, 'Women'), tee(1, 'Men')]), 0);
  assert.equal(discountFor(women, [tee(3, 'Women'), tee(1, 'Men')]), Math.round(1490 * 3 * 0.15));
});

test('caps, dates and switched-off offers', () => {
  assert.equal(discountFor({ ...buy2, maxDiscount: 200 }, [tee(4)]), 200);
  assert.equal(bestOffer([{ ...buy2, active: false }], [tee(2)]), null);
  assert.equal(bestOffer([{ ...buy2, endsAt: '2020-01-01' }], [tee(2)]), null);
  assert.equal(bestOffer([{ ...buy2, startsAt: '2099-01-01' }], [tee(2)]), null);
});

test('the nudge points at the nearest better offer', () => {
  const n = nextOffer([buy2, spend3k], [tee(1)]);
  assert.equal(n.offer.name, 'Buy 2, get 10% off');
  assert.equal(n.gap, 1);
  assert.equal(nextOffer([buy2], [tee(2)]), null);   // already has it
});
