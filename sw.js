// 오프라인 캐시. 배포할 때 VERSION과 ?v= 값을 함께 올리면 새 파일로 교체됨
const VERSION = 'jogakbo-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css?v=2',
  './js/app.js?v=2', './js/core.js?v=2', './js/quilt.js?v=2', './js/share.js?v=2',
  './data/questions.json?v=2', './data/messages.json?v=2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // 같은 사이트의 다른 앱(럭키데스크) 캐시는 건드리지 않음
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jogakbo-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  if (url.origin === location.origin) {
    // 네트워크 우선(업데이트 반영), 오프라인이면 캐시
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(req, { ignoreSearch: true })).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    })),
  );
});
