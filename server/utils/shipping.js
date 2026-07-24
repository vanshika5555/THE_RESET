/**
 * Delivery charges — the single source of truth.
 *
 * The shop shows an estimate as the customer builds their bag, but the
 * amount actually charged is calculated here, on the server, from the
 * verified subtotal. Change the two numbers below to change your policy.
 *
 * NOTE: client/src/utils/price.js has a matching copy of these numbers so
 * the cart can show the same figures. Keep them in step.
 */

const FREE_DELIVERY_ABOVE = 1999;   // free once the bag reaches this
const DELIVERY_CHARGE     = 99;     // otherwise, flat rate

function deliveryCharge(subtotal) {
  const value = Number(subtotal) || 0;
  if (value <= 0) return 0;
  return value >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;
}

// How much more they need to spend to get free delivery (0 if already free).
function amountToFreeDelivery(subtotal) {
  const value = Number(subtotal) || 0;
  const gap = FREE_DELIVERY_ABOVE - value;
  return gap > 0 ? gap : 0;
}

module.exports = {
  FREE_DELIVERY_ABOVE,
  DELIVERY_CHARGE,
  deliveryCharge,
  amountToFreeDelivery,
};