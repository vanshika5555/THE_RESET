/*
  Shop search — forgiving and ranked.

  - Spelling slips still find things: "shrit" → shirt, "blazr" → blazer.
  - Plurals and everyday words match: "tees", "t-shirt", "pants" → trousers,
    "ladies" → women, "jeans" → denim.
  - "men" / "women" narrow the results to that department.
  - Name matches rank above description matches, whole words above
    partial ones, and spelling-corrected matches come last.

  The catalogue is small enough to search in the browser, so results appear
  as you type with no waiting on the server.
*/

// Everyday words → the words the catalogue uses.
const SYNONYMS = {
  tee: ['tshirt', 't-shirt', 'tee'],
  tees: ['tshirt', 'tee'],
  tshirt: ['tshirt', 'tee'],
  pant: ['trouser', 'pant', 'chino'],
  pants: ['trouser', 'pant', 'chino'],
  trousers: ['trouser', 'pant'],
  jeans: ['denim', 'jean'],
  jean: ['denim', 'jean'],
  sweater: ['knit', 'sweater', 'jumper', 'cardigan'],
  jumper: ['knit', 'sweater', 'jumper'],
  hoodie: ['hoodie', 'sweatshirt'],
  sweatshirt: ['sweatshirt', 'hoodie'],
  coat: ['coat', 'overcoat', 'jacket'],
  jacket: ['jacket', 'blazer', 'overshirt'],
  kurta: ['kurta', 'tunic'],
  top: ['top', 'blouse', 'tee', 'shirt'],
  gown: ['dress', 'gown'],
  frock: ['dress'],
  shorts: ['short'],
  linen: ['linen'],
  formal: ['formal', 'shirt', 'trouser', 'blazer'],
  summer: ['summer', 'linen'],
  winter: ['winter', 'wool', 'knit'],
  grey: ['grey', 'gray'],
  gray: ['grey', 'gray'],
};

const DEPARTMENT = {
  men: 'Men', mens: 'Men', man: 'Men', male: 'Men', gents: 'Men', boys: 'Men', him: 'Men',
  women: 'Women', womens: 'Women', woman: 'Women', female: 'Women', ladies: 'Women', lady: 'Women', girls: 'Women', her: 'Women',
};

// Words that carry no meaning in a search.
const STOP = new Set(['for', 'the', 'a', 'an', 'and', 'in', 'of', 'with', 'to', 'some', 'my']);

export const normalise = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/t-shirt/g, 'tshirt')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// shirts → shirt, dresses → dress, trousers → trouser (and "dress" stays "dress").
export function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(sses|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// Edit distance (a swapped pair like "shrit" counts as one slip), stopping
// early once it's clearly too far.
export function distance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const allowed = (w) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

// Splits a query into department filters and the words to look for.
export function parseQuery(q) {
  const words = normalise(q).split(' ').filter((w) => w && !STOP.has(w));
  let department = null;
  const terms = [];
  for (const w of words) {
    if (DEPARTMENT[w]) { department = DEPARTMENT[w]; continue; }
    terms.push(w);
  }
  return { department, terms };
}

// The searchable words of a product, by field weight.
function fieldsOf(p) {
  const words = (s) => normalise(s).split(' ').filter(Boolean).map(stem);
  return [
    { weight: 10, words: words(`${p.name} ${p.colorName || ''}`) },
    { weight: 7, words: words(`${p.subcategory} ${p.tag || ''}`) },
    { weight: 4, words: words(`${p.season} ${p.category}`) },
    { weight: 2, words: words(`${p.materials || ''} ${p.description || ''}`) },
  ];
}

// How well one typed word matches a product: 0 = not at all.
function termScore(term, fields, allowSlips) {
  const variants = new Set([stem(term), ...(SYNONYMS[term] || []), ...(SYNONYMS[stem(term)] || [])].map(stem));
  let best = 0;
  let fuzzy = false;
  for (const f of fields) {
    for (const w of f.words) {
      for (const v of variants) {
        let s = 0;
        let slip = false;
        if (w === v) s = f.weight * 3;
        else if (v.length >= 3 && w.startsWith(v)) s = f.weight * 2;
        else if (allowSlips && allowed(v) && w.length >= 4 && distance(v, w, allowed(v)) <= allowed(v)) { s = f.weight; slip = true; }
        if (s > best) { best = s; fuzzy = slip; }
      }
    }
  }
  return { score: best, fuzzy };
}

/**
 * Search the catalogue. Returns { results, department, corrected } —
 * corrected is true when spelling slips had to be forgiven to find anything.
 */
export function searchProducts(products, q, { limit } = {}) {
  // Exact words first; only if that finds nothing are spelling slips forgiven
  // (so "shirt" never drags in every "tshirt").
  const exact = run(products, q, false, limit);
  return exact.results.length ? exact : run(products, q, true, limit);
}

function run(products, q, allowSlips, limit) {
  const { department, terms } = parseQuery(q);
  if (!terms.length && !department) return { results: [], department, corrected: false };
  const scored = [];
  for (const p of products || []) {
    if (department && p.category !== department) continue;
    if (!terms.length) { scored.push({ p, score: 1, fuzzy: false }); continue; }
    const fields = fieldsOf(p);
    let total = 0;
    let anyFuzzy = false;
    let ok = true;
    for (const t of terms) {
      const { score, fuzzy } = termScore(t, fields, allowSlips);
      if (!score) { ok = false; break; }
      total += score;
      anyFuzzy = anyFuzzy || fuzzy;
    }
    if (ok) scored.push({ p, score: total - (anyFuzzy ? 5 : 0), fuzzy: anyFuzzy });
  }
  scored.sort((a, b) => b.score - a.score || String(a.p.name).localeCompare(String(b.p.name)));
  const results = scored.map((s) => s.p);
  return {
    results: limit ? results.slice(0, limit) : results,
    department,
    corrected: scored.length > 0 && scored.every((s) => s.fuzzy),
  };
}

// The catalogue's own words closest to what was typed — for "Did you mean…".
export function suggestWord(products, q) {
  const { terms } = parseQuery(q);
  if (terms.length !== 1) return null;
  const t = stem(terms[0]);
  const vocab = new Set();
  (products || []).forEach((p) => normalise(`${p.name} ${p.subcategory}`).split(' ').forEach((w) => { if (w.length >= 3) vocab.add(w); }));
  let best = null;
  let bestD = 3;
  for (const w of vocab) {
    const d = distance(t, stem(w), 2);
    if (d < bestD && d > 0) { best = w; bestD = d; }
  }
  return best;
}

// Recent searches on this device.
const RECENT_KEY = 'theresetRecentSearches';
export function recentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
export function rememberSearch(q) {
  const s = String(q || '').trim();
  if (s.length < 2) return;
  try {
    const list = [s, ...recentSearches().filter((x) => x.toLowerCase() !== s.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* private mode */ }
}
export function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* fine */ }
}
