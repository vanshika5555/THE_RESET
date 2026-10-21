const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePrice, formatINR } = require('../utils/price');

test('parsePrice reads numbers and old text prices', () => {
  assert.equal(parsePrice(2990), 2990);
  assert.equal(parsePrice('₹2,990'), 2990);
  assert.equal(parsePrice('1,49,999.50'), 149999.5);
  assert.equal(parsePrice(''), 0);
  assert.equal(parsePrice(null), 0);
  assert.equal(parsePrice('abc'), 0);
  assert.equal(parsePrice(NaN), 0);
});

test('formatINR uses Indian grouping', () => {
  assert.equal(formatINR(2990), '₹2,990');
  assert.equal(formatINR(150000), '₹1,50,000');
  assert.equal(formatINR('₹1,890'), '₹1,890');
});
