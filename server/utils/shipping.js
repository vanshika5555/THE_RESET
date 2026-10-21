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

// Cash on delivery. Couriers cap how much cash they'll carry, and some shops
// add a small fee — set COD_FEE on Render to charge one (0 = free).
const COD_MAX = Number(process.env.COD_MAX) || 10000;
const COD_FEE = Math.max(0, Number(process.env.COD_FEE) || 0);

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
  COD_MAX,
  COD_FEE,
  FREE_DELIVERY_ABOVE,
  DELIVERY_CHARGE,
  deliveryCharge,
  amountToFreeDelivery,
};