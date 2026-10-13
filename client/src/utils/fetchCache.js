import axios from 'axios';

/**
 * Shared GET requests.
 *
 * The home page alone used to download the full product list three times
 * (Featured, New Arrivals, Shop by Category), and every product card asked
 * for its own review summary. On a phone on mobile data that is the
 * difference between a page that appears and one that keeps spinning.
 *
 * Calls for the same URL now share one request, and the answer is reused
 * for a minute. Anything that changes data (POST/PUT/DELETE) still goes
 * straight to axios as before.
 */

const TTL = 60 * 1000;
const cache = new Map();   // url -> { at, promise }

export function cachedGet(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;

  const promise = axios.get(url).then((res) => res.data);
  cache.set(url, { at: Date.now(), promise });
  // A failed request must not be remembered — let the next caller retry.
  promise.catch(() => cache.delete(url));
  return promise;
}

// Products, optionally for one category ('Men' / 'Women').
export const getProducts = (category) =>
  cachedGet(category ? `/api/products?category=${encodeURIComponent(category)}` : '/api/products');

// Forget cached answers (e.g. after a review is posted).
export function clearCached(prefix = '') {
  [...cache.keys()].forEach((k) => { if (k.startsWith(prefix)) cache.delete(k); });
}
