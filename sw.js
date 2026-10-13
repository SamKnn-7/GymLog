// Service worker: keeps a copy of the app on the phone so it opens instantly
// and works with no signal (gyms are often basements). Workout data is not
// handled here; that lives in the browser's own storage.
//
// Bump CACHE whenever the app's files change, so phones pick up the new version.
const CACHE = 'gymlog-v9';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/util.js',
  'js/library.js',
  'js/store.js',
  'js/stats.js',
  'js/charts.js',
  'js/bodymap.js',
  'js/ui.js',
  'js/timer.js',
  'js/core.js',
  'js/install.js',
  'js/views/dashboard.js',
  'js/views/workout.js',
  'js/views/history.js',
  'js/views/exercises.js',
  'js/views/body.js',
  'js/views/tools.js',
  'js/views/custom.js',
  'js/views/setup.js',
  'js/app.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Answer from the saved copy straight away, and refresh that copy in the
// background so the next visit has the latest files.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request, { ignoreSearch: true });
    const fresh = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
