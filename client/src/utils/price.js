/**
 * One place for turning prices into numbers and back into text.
 *
 * Prices are stored as strings like "₹1,299", so every screen that needs
 * to do maths has to parse them. Doing that with a loose regex in five
 * different files is how totals end up as NaN.
 */

// "₹1,299" -> 1299   |   "₹1,299.50" -> 1299.5   |   "" / junk -> 0
export function parsePrice(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;

  // keep digits and the first decimal point only
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const normalised = parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join('')}`
    : cleaned;

  const num = parseFloat(normalised);
  return Number.isFinite(num) ? num : 0;
}

// 1299 -> "₹1,299"
export function formatPrice(value) {
  const num = parsePrice(value);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Total for a list of cart items, safe against missing prices or quantities.
export function cartSubtotal(items = []) {
  return items.reduce((sum, item) => {
    const price = parsePrice(item.price);
    const qty = Number(item.qty) || 0;
    return sum + price * qty;
  }, 0);
}