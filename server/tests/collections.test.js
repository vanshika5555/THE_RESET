const test = require('node:test');
const assert = require('node:assert');
const { slugify } = require('../routes/collections');

test('edit names become clean links', () => {
  assert.equal(slugify('The Winter Edit'), 'the-winter-edit');
  assert.equal(slugify('  Wedding Guest — 2026!  '), 'wedding-guest-2026');
  assert.equal(slugify('Café & Linen'), 'cafe-linen');
  assert.equal(slugify('---'), '');
});
