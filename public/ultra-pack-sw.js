// Serves the downloaded 4K texture pack from Cache Storage at <app>/__ultra-pack/v<N>/… (web only;
// the native app reads the files from the filesystem instead). Registered lazily by
// src/platform/assetPackStores.ts when the Ultra pack is used. Every other request is left to the
// network untouched. See docs/ASSET_PACK.md.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !new URL(req.url).pathname.includes('/__ultra-pack/v')) return;
  event.respondWith(
    caches.match(req.url, { ignoreSearch: true }).then((hit) => hit || new Response('', { status: 404 })),
  );
});
