const test = require('node:test');
const assert = require('node:assert');
const { isUpcoming, dropWhen } = require('../utils/drops');

test('a drop is upcoming only before its moment', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  assert.equal(isUpcoming({ dropAt: null }, now), false);
  assert.equal(isUpcoming({}, now), false);
  assert.equal(isUpcoming({ dropAt: '2026-11-10T12:00:01Z' }, now), true);
  assert.equal(isUpcoming({ dropAt: '2026-11-10T12:00:00Z' }, now), false);
  assert.equal(isUpcoming({ dropAt: '2026-11-01T00:00:00Z' }, now), false);
});

test('drop time reads in India time', () => {
  assert.equal(dropWhen('2026-11-13T13:30:00Z'), 'Fri, 13 Nov, 7 pm');      // 19:00 IST
  assert.equal(dropWhen('2026-11-13T14:00:00Z'), 'Fri, 13 Nov, 7:30 pm');
});
