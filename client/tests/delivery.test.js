import test from 'node:test';
import assert from 'node:assert/strict';
import { validPin, zoneFor, estimate } from '../src/utils/delivery.js';

test('pincodes are 6 digits and never start with 0', () => {
  assert.equal(validPin('110024'), true);
  assert.equal(validPin('011002'), false);
  assert.equal(validPin('11002'), false);
  assert.equal(validPin('11002a'), false);
});

test('zones: metro, standard, far-off', () => {
  assert.equal(zoneFor('110024').name, 'metro');
  assert.equal(zoneFor('560001').name, 'metro');
  assert.equal(zoneFor('302001').name, 'standard');
  assert.equal(zoneFor('190001').name, 'remote');
  assert.equal(zoneFor('744101').name, 'remote');
});

test('estimates skip Sundays and never start today', () => {
  const wed = new Date('2026-10-21T10:00:00+05:30');
  const e = estimate('110024', wed);
  assert.ok(e.from > wed);
  assert.notEqual(e.from.getDay(), 0);
  assert.notEqual(e.to.getDay(), 0);
  assert.ok(e.to >= e.from);
  assert.equal(estimate('12345', wed), null);
});
