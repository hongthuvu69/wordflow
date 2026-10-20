// Service worker: cho app chạy offline.
// Chiến lược "network-first": có mạng thì luôn lấy bản mới nhất (bỏ qua cache HTTP 10 phút của
// GitHub Pages), mạng chậm quá 3 giây hoặc mất mạng thì dùng bản đã lưu.
const CACHE = "wordflow-v4";
const TIMEOUT_MS = 3000;
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/store.js",
  "js/sync.js",
  "js/practice.js",
  "js/config.js",
  "js/ui.js",
  "js/toeic.js",
  "js/toeic-ui.js",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
  "content/index.json",
  "tests/index.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL.map((url) => new Request(url, { cache: "no-cache" })));
      // Tải sẵn toàn bộ file nội dung.
      const index = await (await fetch("content/index.json", { cache: "no-cache" })).json();
      await cache.addAll(index.files.map((f) => new Request("content/" + f, { cache: "no-cache" })));
      // Tải sẵn ngân hàng đề để làm bài khi không có mạng.
      const tests = await (await fetch("tests/index.json", { cache: "no-cache" })).json();
      await cache.addAll(tests.tests.map((t) => new Request("tests/" + t.file, { cache: "no-cache" })));
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
      const network = fetch(req, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      event.waitUntil(network);
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
      const fresh = await Promise.race([network, timeout]);
      if (fresh) return fresh;
      const cached = await cache.match(req, { ignoreSearch: true });
      return cached || (await network) || new Response("Offline", { status: 503 });
    })()
  );
});
