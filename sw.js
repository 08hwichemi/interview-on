const CACHE_NAME = 'smart-interview-v1';

// 1. 설치: 딜레이 없이 즉시 권한 넘겨받기
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. 활성화: 옛날 버전 찌꺼기 날리기
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 3. 통신: 무조건 인터넷에서 최신 버전을 가져오고, 폰이 오프라인일 때만 저장된 캐시 사용
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});