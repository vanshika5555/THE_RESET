const test = require('node:test');
const assert = require('node:assert');
const gc = require('../utils/giftCards');

test('codes are RESET + 12 easy-to-read characters, all different', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const c = gc.newCode();
    assert.match(c, /^RESET[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{12}$/);
    seen.add(c);
  }
  assert.equal(seen.size, 2000);
});

test('however it is typed, the same code matches', () => {
  const c = gc.newCode();
  const shown = gc.pretty(c);                    // RESET-XXXX-XXXX-XXXX
  assert.match(shown, /^RESET-.{4}-.{4}-.{4}$/);
  assert.equal(gc.hash(shown), gc.hash(c));
  assert.equal(gc.hash(shown.toLowerCase()), gc.hash(c));
  assert.equal(gc.hash(c.slice(5)), gc.hash(c));  // without the RESET part
  assert.equal(gc.hash(` ${c.slice(5, 9)} ${c.slice(9, 13)} ${c.slice(13)} `), gc.hash(c));
  assert.notEqual(gc.hash(gc.newCode()), gc.hash(c));
});
