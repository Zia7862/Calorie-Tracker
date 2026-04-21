const CACHE_NAME = "nutritrack-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./home.html",
  "./meals.html",
  "./hydration.html",
  "./progress.html",
  "./settings.html",
  "./home.css",
  "./styles.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
