const CACHE_NAME = "app-cache-v3";

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(["/", "/logo-cozinha-de-tacho.svg"]))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const mesmaOrigem = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copia = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("/", copia));
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) || (await caches.match("/"));
        })
    );
    return;
  }

  if (!mesmaOrigem) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copia = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copia));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
