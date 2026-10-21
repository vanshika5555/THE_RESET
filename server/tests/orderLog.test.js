const test = require('node:test');
const assert = require('node:assert');
const { entry, log, forCustomer } = require('../utils/orderLog');

test('log lines record who did it', () => {
  const order = { history: [] };
  log(order, 'status', 'Marked Shipped', { _id: 'u1', name: 'Aman', role: 'staff' });
  assert.equal(order.history.length, 1);
  assert.deepEqual(order.history[0].by, { id: 'u1', name: 'Aman', role: 'staff' });
  assert.equal(entry('paid', 'Paid online', null).by, null);
});

test('customers never see the internal note, note lines or staff names', () => {
  const order = {
    adminNote: 'fake order?',
    history: [
      entry('placed', 'Order placed', { _id: 'c', name: 'Riya', role: 'user' }),
      entry('note', 'Internal note added', { _id: 's', name: 'Aman', role: 'staff' }),
      entry('status', 'Marked Shipped', { _id: 's', name: 'Aman', role: 'staff' }),
    ],
  };
  const out = forCustomer(order);
  assert.equal('adminNote' in out, false);
  assert.deepEqual(out.history.map((h) => h.text), ['Order placed', 'Shipped']);
  assert.ok(out.history.every((h) => !('by' in h)));
  assert.equal(order.adminNote, 'fake order?');   // the original is untouched
});

test('the shop’s wording is turned into the customer’s', () => {
  const { customerText } = require('../utils/orderLog');
  assert.equal(customerText('Marked Delivered · ₹2,580 cash collected'), 'Delivered · ₹2,580 paid in cash');
  assert.equal(customerText('Return requested · 2 pieces · Too small'), 'You asked for a return · 2 pieces');
  assert.equal(customerText('Exchange received back at the shop'), 'Exchange received by us');
  assert.equal(customerText('Return declined'), 'Return request declined');
  assert.equal(customerText('Cancelled by the customer'), 'You cancelled the order');
});
