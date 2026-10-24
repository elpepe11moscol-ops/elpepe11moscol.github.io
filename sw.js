
 // Noche — Seguimiento · service worker
// Cambia CACHE_VERSION en cada publicación para que los dispositivos descarguen la versión nueva.
// Este archivo no modifica localStorage.
const CACHE_PREFIX = 'noche-pwa-';
const CACHE_VERSION = 'v3';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
        APP_SHELL.map(url => new Request(url, { cache: 'reload' }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function networkFirst(event) {
  const req = event.request;

  return new Promise(resolve => {
    let settled = false;

    const fromCache = () =>
      caches.match(req, { ignoreSearch: true })
        .then(r => r || caches.match('./index.html'));

    const finish = res => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };

    const timer = setTimeout(() => {
      fromCache().then(r => {
        if (r) finish(r);
      });
    }, 4000);

    fetch(req).then(res => {
      clearTimeout(timer);

      if (res && res.ok) {
        const copy = res.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy))
        );
        finish(res);
      } else {
        fromCache().then(r => finish(r || res));
      }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(r => finish(r || Response.error()));
    });
  });
}

function cacheFirst(event) {
  const req = event.request;

  return caches.match(req).then(cached => {
    if (cached) return cached;

    return fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy))
        );
      }
      return res;
    });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(event));
  } else {
    event.respondWith(cacheFirst(event));
  }
});
