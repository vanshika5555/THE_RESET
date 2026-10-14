/**
 * Recently viewed pieces, kept in this browser only (no account needed).
 * Newest first, capped at 12, with just enough to draw a card.
 */
const KEY = 'thereset_recent';
const MAX = 12;

export function getRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addRecent(p) {
  if (!p || !p._id) return;
  const entry = {
    _id: p._id,
    name: p.name,
    price: p.price,
    mrp: p.mrp || 0,
    image: (p.images && p.images[0]) || p.image || '',
    color: p.color || '',
  };
  const list = [entry, ...getRecent().filter(x => x._id !== p._id)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}
