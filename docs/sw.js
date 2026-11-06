// Çevrimdışı çalışma: uygulama dosyalarını önbelleğe alır. Hava durumu gibi dış istekler önbelleğe alınmaz.
// Dosyalardan biri değişince CACHE adındaki sürümü artır; eski önbellek otomatik silinir.
const CACHE = 'gonulmax-v7';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'js/app.js',
  'js/catalog.js',
  'js/catalog-data.js',
  'js/i18n.js',
  'js/store.js',
  'js/weather.js',
  'js/config.js',
  'js/core/dailyPick.js',
  'js/core/dates.js',
  'js/core/scentScore.js',
  'js/core/season.js',
  'js/core/streak.js',
  'js/core/types.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // dış istekler (hava durumu) doğrudan ağa gider

  // Ağ önce, olmazsa önbellek: yeni sürüm yayınlanınca kullanıcı eski dosyada takılı kalmaz.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
  );
});
