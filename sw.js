// Network-first service worker.
// Updates appear automatically on next page load when online.
// Falls back to cache only when network is unavailable.

const CACHE = 'ledger-runtime';

self.addEventListener('install', (event) => {
  // Take over immediately, no waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up any old version-pinned caches from previous deployments
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
      // Take control of all open tabs immediately
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for everything from our origin.
  // If the network responds, use it AND update cache.
  // If the network fails (offline / timeout), fall back to whatever's cached.
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache successful "basic" responses (not opaque or errors)
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          // Last resort for navigation requests: serve cached index.html so the app shell loads
          if (req.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          // Otherwise let it fail naturally
          return new Response('Offline and not cached', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
