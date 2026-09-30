/* Service worker, hand-written and small on purpose — Workbox would be 20KB of
   dependency to express six lines of policy.

   Policy, one line each:
   - the data artifacts are NETWORK-first with a cached fallback — see below,
     this was the defect;
   - build assets (/_next/static/…) are content-hashed, so cache-first forever;
   - navigations are network-first with a cached fallback, so a new deploy is
     picked up on the next visit but a dead network still opens the app.

   After the first visit the app is still fully usable offline. That is the
   whole point of shipping the catalogue to the device.

   ==========================================================================
   2026-08-10 — /data/ WAS CACHE-FIRST AND THAT SERVED A STALE CATALOGUE.

   The line above used to read "the four data artifacts and every product photo
   are immutable-by-content and cache-FIRST". THE PREMISE WAS FALSE. A product
   photo is immutable by content — its filename carries a hash. `products.json`
   is not: it is a FIXED URL whose contents are rewritten every morning at
   06:00. Cache-first on a fixed URL with changing contents is a stale read by
   construction, and `cacheFirst()` returns `hit || fetching`, so the visitor
   got the old bytes and the refresh only landed for the visit AFTER this one.

   VERSION made it unbounded rather than one-day. It is a hardcoded constant
   that has never been bumped — it still says `veredicto`, a domain this
   project abandoned — and `activate` only deletes caches that do NOT start
   with it. So nothing was ever purged and the staleness had no ceiling.

   Measured consequence: the chrome rendered "4.989 precios, ninguno con más de
   2 h" above a catalogue of an older vintage, /buscar returned "Nada con
   «samsung»" against 667 Samsung products, and the facet counts disagreed with
   the header. For a product whose único differentiator is honesty about its own
   data, a confidently-worded freshness claim over stale data is the worst
   failure available.

   Invisible to every gate, and worth understanding why: all 19 live-site
   invariants fetch the ORIGIN with no service worker. They grade what the
   server sends. This defect only exists in what a RETURNING BROWSER assembles.

   Fix: /data/ is network-first (fresh whenever the network answers, cached copy
   when it does not — so offline is untouched), and VERSION is bumped, which
   purges every poisoned cache from the old name on next activate.

   NOTE the /img/ branch below is now DEAD CODE and deliberately left readable:
   since the R2 cutover images are served from img.vale.cr, and the
   cross-origin guard in `fetch` returns before reaching it. Removing it is a
   separate change; leaving it silently would be the trap this comment exists
   to prevent. */

// Bump on any change to caching POLICY or to the shape of the cached
// artifacts. `activate` deletes every cache not starting with this string, so
// a bump is the only purge mechanism there is.
const VERSION = 'vale-v3';
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const IMG = `${VERSION}-img`;

const PRECACHE = ['/', '/buscar', '/manifest.webmanifest',
  '/data/index.json', '/data/products.json', '/data/categories.json',
  '/data/branches.json', '/data/meta.json', '/data/history.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      // one failed asset must not fail the whole install
      await Promise.allSettled(PRECACHE.map((u) => shell.add(u)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetching = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetching;
}

/** Network first, cached copy only when the network does not answer.
 *  For the daily artifacts this is the correct posture and cache-first was
 *  not: freshness IS the product here, and a catalogue that is one request
 *  behind reality contradicts the freshness line the chrome prints above it.
 *  Offline is unaffected — the cached copy is still there and still served
 *  the moment a fetch fails. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error('offline and not cached');
  }
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(SHELL);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cache = await caches.open(SHELL);
          return (await cache.match(request)) || (await cache.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/data/')) {
    e.respondWith(networkFirst(request, DATA));
    return;
  }
  if (url.pathname.startsWith('/img/')) {
    e.respondWith(cacheFirst(request, IMG));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/manifest')) {
    e.respondWith(cacheFirst(request, SHELL));
  }
});
