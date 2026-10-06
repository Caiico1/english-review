// Minimal service worker: caches whatever is requested so the app can open offline.
const CACHE = 'english-review-v2';
// The server may send "Vary: Origin"; unless it is ignored, <script crossorigin> requests miss their cached copy
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const fromNetwork = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });

  if (req.mode === 'navigate') {
    // The page: network first, to pick up new versions; cache when offline
    event.respondWith(fromNetwork.catch(() => caches.match(req, MATCH).then((r) => r || caches.match('./index.html', MATCH))));
  } else {
    // Assets: cache first, refreshed in the background
    event.respondWith(caches.match(req, MATCH).then((cached) => cached || fromNetwork));
    event.waitUntil(fromNetwork.catch(() => {}));
  }
});
