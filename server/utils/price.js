/**
 * Server-side price handling.
 *
 * Product prices are stored as plain numbers (2990). Older data and older
 * admin builds used text like "₹2,990", so everything still goes through
 * parsePrice, which accepts both. Never trust a total from the browser.
 */

function parsePrice(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;

  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const normalised = parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join('')}`
    : cleaned;

  const num = parseFloat(normalised);
  return Number.isFinite(num) ? num : 0;
}

// 2990 -> "₹2,990" (used for the price text frozen onto order lines)
function formatINR(value) {
  return '₹' + parsePrice(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

module.exports = { parsePrice, formatINR };