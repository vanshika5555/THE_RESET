/*
  THE RESET — service worker.

  Makes the shop installable as an app and quicker on repeat visits:
  - pages always come fresh from the network; with no connection, a
    friendly offline page shows instead of the browser's dinosaur;
  - the site's own scripts and styles (their names change on every
    release) and the brand font files are kept once fetched.
  Product photos are left to the browser's normal cache (Cloudinary tells
  it to keep them), and the API is never touched: bags, orders, prices and
  stock always come live.

  Change VERSION to throw away everything this worker has kept.
*/
const VERSION = 'v1';
const SHELL = `reset-shell-${VERSION}`;
const ASSETS = `reset-assets-${VERSION}`;
const KEEP = [SHELL, ASSETS];
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll([OFFLINE, '/icon-192.png', '/favicon.svg']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('reset-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  // Only proper answers are kept — never errors, never opaque responses.
  if (res.ok && res.type !== 'opaque') {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(request, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Pages: network first; offline page if there's no connection.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }

  // The site's own built files have the version in their name — safe to keep.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  // The brand font files (their addresses never change).
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, ASSETS));
  }
  // Everything else (the API and photos included) is left alone.
});
