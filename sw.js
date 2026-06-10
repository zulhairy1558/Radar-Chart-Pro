const CACHE_NAME = 'radarviz-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/js/config.js',
  '/js/DataManager.js',
  '/js/RadarRenderer.js',
  '/js/TooltipManager.js',
  '/js/ThemeManager.js',
  '/js/ExportManager.js',
  '/js/TableRenderer.js',
  '/js/LegendRenderer.js',
  '/js/DataEntryGrid.js',
  '/js/ImageWatermark.js',
  '/js/UIController.js',
  '/js/main.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap'
];

// Install event – cache all essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Fetch event – cache‑first strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if found, otherwise fetch from network
        if (response) return response;
        return fetch(event.request).then(networkResponse => {
          // Optionally cache new resources (except cross-origin)
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
  );
});

// Activate event – clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});