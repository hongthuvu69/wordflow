// Service worker: cho app chạy offline.
// Chiến lược "stale-while-revalidate": trả bản trong cache ngay, đồng thời tải bản mới về cho lần mở sau.
const CACHE = "wordflow-v1";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/store.js",
  "js/sync.js",
  "js/config.js",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
  "content/index.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Tải sẵn toàn bộ file nội dung.
      const index = await (await fetch("content/index.json")).json();
      await cache.addAll(index.files.map((f) => "content/" + f));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Chỉ cache file của chính app; request tới Supabase đi thẳng ra mạng.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) || new Response("Offline", { status: 503 });
    })()
  );
});
