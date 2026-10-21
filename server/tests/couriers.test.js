const test = require('node:test');
const assert = require('node:assert/strict');
const { buildShipment } = require('../utils/couriers');

test('known couriers get a tracking link built', () => {
  const { shipment } = buildShipment({ courier: 'Delhivery', trackingNumber: ' 1234 5678 ' });
  assert.equal(shipment.trackingNumber, '12345678');
  assert.match(shipment.trackingUrl, /^https:\/\/www\.delhivery\.com\/.+12345678$/);
});

test('unknown couriers fall back to AfterShip', () => {
  const { shipment } = buildShipment({ courier: 'Local Express', trackingNumber: 'AB12' });
  assert.equal(shipment.trackingUrl, 'https://www.aftership.com/track/AB12');
});

test('bad input is refused with a reason', () => {
  assert.ok(buildShipment({ courier: 'DTDC', trackingNumber: 'bad no!' }).error);
  assert.ok(buildShipment({ trackingNumber: 'AB12' }).error);
  assert.ok(buildShipment({ courier: 'DTDC', trackingNumber: 'AB12', trackingUrl: 'javascript:alert(1)' }).error);
  assert.equal(buildShipment({}).shipment, null);
});
