const test = require('node:test');
const assert = require('node:assert/strict');
const { computeInvoice, inWords, fyLabel } = require('../utils/invoice');

const order = (extra = {}) => ({
  items: [
    { name: 'Hoodie', price: '₹2,990', size: 'M', qty: 1 },
    { name: 'Shirt', price: 1890, size: 'L', qty: 2 },
  ],
  discount: 500,
  delivery: 0,
  total: 2990 + 3780 - 500,
  shippingAddress: { state: 'Delhi' },
  ...extra,
});

test('tax rows add back up to exactly what was paid', () => {
  process.env.SHOP_GSTIN = '07ABCDE1234F1Z5';
  process.env.SHOP_STATE = 'Delhi';
  const inv = computeInvoice(order());
  const sum = inv.taxRows.reduce((n, r) => n + r.taxable + r.tax, 0);
  assert.equal(Math.round(sum * 100) / 100, inv.total);
});

test('5% up to ₹2,500 a piece, 18% above', () => {
  process.env.SHOP_GSTIN = '07ABCDE1234F1Z5';
  const inv = computeInvoice(order({ discount: 0, total: 6770 }));
  assert.equal(inv.lines[0].rate, 18);   // ₹2,990
  assert.equal(inv.lines[1].rate, 5);    // ₹1,890
});

test('CGST + SGST inside the state, IGST outside it', () => {
  process.env.SHOP_GSTIN = '07ABCDE1234F1Z5';
  process.env.SHOP_STATE = 'Delhi';
  assert.equal(computeInvoice(order()).sameState, true);
  assert.equal(computeInvoice(order({ shippingAddress: { state: 'Maharashtra' } })).sameState, false);
});

test('a COD fee is part of the invoice total', () => {
  process.env.SHOP_GSTIN = '07ABCDE1234F1Z5';
  const inv = computeInvoice({ ...order({ discount: 0, total: 6770 + 49 }), payment: { method: 'cod', codFee: 49 } });
  const sum = inv.taxRows.reduce((n, r) => n + r.taxable + r.tax, 0);
  assert.equal(Math.round(sum * 100) / 100, 6819);
});

test('amounts in words, Indian style', () => {
  assert.equal(inWords(4880), 'Four Thousand Eight Hundred Eighty Rupees Only');
  assert.equal(inWords(125000.5), 'One Lakh Twenty Five Thousand Rupees and Fifty Paise Only');
});

test('financial year runs April to March', () => {
  assert.equal(fyLabel('2026-10-14'), '26-27');
  assert.equal(fyLabel('2027-02-01'), '26-27');
  assert.equal(fyLabel('2026-03-31'), '25-26');
});
