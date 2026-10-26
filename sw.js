/* ENDURA service worker — offline shell + model cache */

const VERSION = 'en-v1';
const CDN_CACHE = 'endura-cdn';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/core.js',
  'js/data.js',
  'js/charts.js',
  'js/vision.js',
  'js/rest.js',
  'js/views/common.js',
  'js/views/today.js',
  'js/views/workout.js',
  'js/views/nutrition.js',
  'js/views/body.js',
  'js/views/settings.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('precache incomplete', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION && k !== CDN_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // app shell: cache first, then network (and fill the cache)
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') {
          const cache = await caches.open(VERSION);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const fallback = await caches.match('index.html');
        return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // model / library CDN: stale-while-revalidate
  if (/jsdelivr\.net|tfhub\.dev|storage\.googleapis\.com|kaggle\.com/.test(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const cached = await cache.match(req);
      const refresh = fetch(req).then((res) => {
        if (res && (res.type === 'cors' || res.type === 'basic')) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await refresh) || new Response('', { status: 504 });
    })());
  }
});
