const test = require('node:test');
const assert = require('node:assert');
const { fitSummary } = require('../routes/reviews');

const r = (...fits) => fits.map((fit) => ({ fit }));

test('fit verdict needs two answers and a clear majority', () => {
  assert.equal(fitSummary(r('small')).verdict, '');
  assert.equal(fitSummary(r('', '', 'small')).verdict, '');
  assert.equal(fitSummary(r('small', 'small')).verdict, 'small');
  assert.equal(fitSummary(r('true', 'true', 'large')).verdict, 'true');           // 67%
  assert.equal(fitSummary(r('true', 'small', 'large')).verdict, 'mixed');
  assert.equal(fitSummary(r('large', 'large', 'large', 'true', 'true')).verdict, 'large'); // 60%
  const s = fitSummary(r('small', 'true', '', 'true'));
  assert.deepEqual([s.votes, s.small, s.true, s.large], [3, 1, 2, 0]);
});
