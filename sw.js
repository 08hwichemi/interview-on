// 캐시 이름을 바꾸면 이전에 저장된 캐시가 모두 무효화됩니다.
// 배포 후 학생 폰에 옛날 화면이 계속 보이면 이 숫자를 올려주세요.
const CACHE_NAME = 'smart-interview-v3';

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
//
// ⚠️ 화면(HTML)만은 «브라우저가 쥐고 있는 것»까지 건너뛰고 새로 받습니다.
//    깃허브 페이지는 index.html 을 10분쯤 쥐고 있으라고 알려 줍니다. 그러면
//    version.txt 는 새 판인데 화면 속 판 번호(BUILD_ID)는 옛것이라,
//    «새 버전이 있습니다» 띠가 새로고침해도·앱을 다시 열어도 계속 떴습니다.
//    (fetch 에 Request 를 그대로 넘기면 navigate 요청은 다시 만들 수 없어 막히므로
//     주소만 넘깁니다.)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req.url, { cache: 'reload', credentials: 'same-origin' })
        .catch(() => caches.match(req))
    );
    return;
  }
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
