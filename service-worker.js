const CACHE = 'jda-static-v6';
const ASSETS = ['./', './index.html', './styles.css', './icons.css', './app-core.js', './app-walking.js', './app-sitting.js', './app-route.js', './app-ui.js', './manifest.webmanifest', './icon.svg', './assets/icons/dogs.svg', './assets/icons/sitting.svg', './assets/icons/walks.svg', './assets/icons/home.svg', './assets/icons/route.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
