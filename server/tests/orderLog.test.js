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
  assert.deepEqual(out.history.map((h) => h.text), ['Order placed', 'Marked Shipped']);
  assert.ok(out.history.every((h) => !('by' in h)));
  assert.equal(order.adminNote, 'fake order?');   // the original is untouched
});
