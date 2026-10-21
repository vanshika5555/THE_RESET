const test = require('node:test');
const assert = require('node:assert/strict');
const { deliveryCharge, amountToFreeDelivery, FREE_DELIVERY_ABOVE, DELIVERY_CHARGE } = require('../utils/shipping');

test('delivery is free from the threshold up', () => {
  assert.equal(deliveryCharge(FREE_DELIVERY_ABOVE), 0);
  assert.equal(deliveryCharge(FREE_DELIVERY_ABOVE + 1), 0);
  assert.equal(deliveryCharge(FREE_DELIVERY_ABOVE - 1), DELIVERY_CHARGE);
  assert.equal(deliveryCharge(0), 0);
});

test('amountToFreeDelivery never goes negative', () => {
  assert.equal(amountToFreeDelivery(FREE_DELIVERY_ABOVE - 100), 100);
  assert.equal(amountToFreeDelivery(FREE_DELIVERY_ABOVE + 500), 0);
});
