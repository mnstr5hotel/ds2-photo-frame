const CACHE_NAME = 'ds2-photo-frame-v2';
const STATIC_EXTENSIONS = /\.(?:css|js|json|svg|png|webp|wasm)$/i;
const NETWORK_FIRST_EXTENSIONS = /\.(?:css|js|json)$/i;

self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    const keys = await caches.keys();
    await Promise.all(keys.map(function(key) {
      return key === CACHE_NAME ? undefined : caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function(event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (!STATIC_EXTENSIONS.test(url.pathname)) return;

  event.respondWith((async function() {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then(function(response) {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
    if (NETWORK_FIRST_EXTENSIONS.test(url.pathname)) {
      try {
        return await network;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    }
    return cached || network;
  })());
});
