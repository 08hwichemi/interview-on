// 앱 시작점 — 페이지가 열리면 여기서부터 실행됩니다.

// 1. 앱 초기화 (수파베이스에서 필터용 메타데이터 가져오기)
window.onload = async function() {
  try {
    const [revData, qData] = await Promise.all([
      supabaseRequest('reviews'),
      supabaseRequest('questions')
    ]);

    appMeta.rev = revData.map(d => ({ y: d['년도'], u: d['대학'], t: d['세부유형'], m: d['모집단위'] }));
    // 🛡️ [수정] 언더바(_)를 슬래시(/)로 정확하게 맞췄습니다!
    appMeta.q = qData.map(d => ({ y: d['년도'], u: d['대학'], t1: d['전형/역량1'], t2: d['역량2'] }));

    document.getElementById('loading').style.display = 'none';
  } catch (e) {
    console.error("오류:", e);
    document.getElementById('loading').style.display = 'none';
  }
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
