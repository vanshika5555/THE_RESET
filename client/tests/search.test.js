import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProducts, parseQuery, stem, distance, suggestWord } from '../src/utils/search.js';

const P = [
  { _id: 1, name: 'Oxford Shirt', subcategory: 'Shirts', category: 'Men', season: 'All Season', colorName: 'White' },
  { _id: 2, name: 'Linen Shirt', subcategory: 'Shirts', category: 'Women', season: 'Summer', colorName: 'Black' },
  { _id: 3, name: 'Boxy Tee', subcategory: 'T-Shirts', category: 'Men', season: 'Summer' },
  { _id: 4, name: 'Pleated Trousers', subcategory: 'Trousers', category: 'Men', season: 'All Season' },
  { _id: 5, name: 'Wool Blazer', subcategory: 'Blazers', category: 'Women', season: 'Winter', description: 'Soft shoulders, a shirt-friendly cut.' },
  { _id: 6, name: 'Slip Dress', subcategory: 'Dresses', category: 'Women', season: 'Summer' },
];
const ids = (q) => searchProducts(P, q).results.map((p) => p._id);

test('plurals and stems', () => {
  assert.equal(stem('shirts'), 'shirt');
  assert.equal(stem('dresses'), 'dress');
  assert.equal(stem('dress'), 'dress');
  assert.deepEqual(ids('dresses'), [6]);
});

test('spelling slips are forgiven, and flagged', () => {
  assert.equal(distance('shrit', 'shirt'), 1);
  assert.deepEqual(ids('blazr'), [5]);
  const r = searchProducts(P, 'shrit');
  assert.ok(r.results.length >= 2);
  assert.equal(r.corrected, true);
  assert.equal(searchProducts(P, 'shirt').corrected, false);
});

test('everyday words', () => {
  assert.deepEqual(ids('tees'), [3]);
  assert.deepEqual(ids('t-shirt'), [3]);
  assert.deepEqual(ids('pants'), [4]);
});

test('men / women narrow the department', () => {
  assert.deepEqual(parseQuery('shirts for ladies'), { department: 'Women', terms: ['shirts'] });
  assert.deepEqual(ids('mens shirt'), [1]);
  assert.equal(ids('women').every((id) => [2, 5, 6].includes(id)), true);
});

test('name matches rank above a mention in the description', () => {
  const r = ids('shirt');
  assert.ok(r.indexOf(5) > r.indexOf(1) && r.indexOf(5) > r.indexOf(2));
});

test('colour words match', () => {
  assert.deepEqual(ids('black shirt'), [2]);
});

test('did you mean', () => {
  assert.equal(suggestWord(P, 'trowsers'), 'trousers');
  assert.equal(suggestWord(P, 'qqqqq'), null);
});

test('nothing typed, nothing found', () => {
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('zzzz'), []);
});
