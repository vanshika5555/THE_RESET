/**
 * Server-side price handling.
 *
 * Prices are stored as strings like "₹1,299". Anything that decides how
 * much a customer owes must parse them here, on the server — never trust
 * a total that arrived from the browser.
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

module.exports = { parsePrice };