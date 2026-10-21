import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, parseCsv } from '../src/utils/csv.js';

test('round trip keeps commas, quotes and line breaks inside cells', () => {
  const rows = [['ID', 'Name'], ['1', 'Tee, "Boxy"\nBlack'], ['2', 'Plain']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test('reads Excel files saved with semicolons', () => {
  assert.deepEqual(parseCsv('ID;Price\r\n1;1290\r\n'), [['ID', 'Price'], ['1', '1290']]);
});

test('skips blank lines and the byte-order mark', () => {
  assert.deepEqual(parseCsv('﻿ID,Price\n\n1,99\n'), [['ID', 'Price'], ['1', '99']]);
});
