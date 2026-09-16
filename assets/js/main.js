// 앱 시작점 — 페이지가 열리면 여기서부터 실행됩니다.

// 1. 로그인 상태를 먼저 확인합니다.
//    이미 로그인돼 있으면 바로 홈으로, 아니면 로그인 화면으로 보냅니다.
//    자료 불러오기는 로그인이 확인된 뒤에만 일어납니다 (auth.js 의 enterApp).
window.onload = function() {
  initAuth();
};

// 2. PWA 서비스 워커 등록 (앱 설치의 최종 관문)
// 경로 앞의 './' 가 중요합니다. GitHub Pages 처럼 하위 경로(/interview-on/)에서
// 서비스될 때 절대 경로('/sw.js')를 쓰면 등록이 실패합니다.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('서비스 워커 고용 완료!');
      })
      .catch(error => {
        console.log('서비스 워커 고용 실패...', error);
      });
  });
}
