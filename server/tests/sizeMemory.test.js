const test = require('node:test');
const assert = require('node:assert');
const { decide, neighbour } = require('../utils/sizeMemory');

test('the size kept most often wins', () => {
  const r = decide([
    { fit: 'Top', size: 'M', qty: 2, at: 1 },
    { fit: 'Top', size: 'L', qty: 1, at: 5 },
    { fit: 'Bottom', size: '32', qty: 1, at: 2 },
  ], []);
  assert.equal(r.Top.size, 'M');
  assert.equal(r.Top.note, 'You’ve kept 2 tops in M');
  assert.equal(r.Bottom.size, '32');
});

test('returns don’t count, exchanges count for the new size', () => {
  const r = decide(
    [{ fit: 'Top', size: 'L', qty: 2, at: 1 }],
    [{ fit: 'Top', size: 'L', qty: 2, exchangeSize: 'M', reason: 'Too big', at: 3 }],
  );
  assert.equal(r.Top.size, 'M');
});

test('nothing kept: a "too big" return points one size down', () => {
  const r = decide([{ fit: 'Top', size: 'L', qty: 1, at: 1 }], [{ fit: 'Top', size: 'L', qty: 1, reason: 'Too big', at: 2 }]);
  assert.deepEqual(r.Top, { size: 'M', basis: 'returned', note: 'You sent back an L for being too big' });
  assert.equal(neighbour('32', 1), '34');
  assert.equal(neighbour('XS', -1), 'XXS');
  assert.equal(neighbour('XXS', -1), null);
});

test('no history, no suggestion', () => {
  assert.deepEqual(decide([], []), {});
});
