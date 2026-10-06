// Service worker mínimo: guarda en caché lo que se va pidiendo para poder abrir la app sin conexión.
const CACHE = 'english-review-v1';
// El servidor puede enviar «Vary: Origin»; sin ignorarlo, las peticiones de <script crossorigin> no encuentran su copia
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
    // La página: red primero, para recibir versiones nuevas; caché si no hay conexión
    event.respondWith(fromNetwork.catch(() => caches.match(req, MATCH).then((r) => r || caches.match('./index.html', MATCH))));
  } else {
    // Recursos: caché primero y se actualiza en segundo plano
    event.respondWith(caches.match(req, MATCH).then((cached) => cached || fromNetwork));
    event.waitUntil(fromNetwork.catch(() => {}));
  }
});
