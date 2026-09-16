// 캐시 이름을 바꾸면 이전에 저장된 캐시가 모두 무효화됩니다.
// 배포 후 학생 폰에 옛날 화면이 계속 보이면 이 숫자를 올려주세요.
const CACHE_NAME = 'smart-interview-v2';

// 1. 설치: 딜레이 없이 즉시 권한 넘겨받기
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. 활성화: 옛날 버전 찌꺼기 날리기
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => clients.claim())
  );
});

// 3. 통신: 무조건 인터넷에서 최신 버전을 가져오고, 폰이 오프라인일 때만 저장된 캐시 사용
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
