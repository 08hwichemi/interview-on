// 새 판 알림
//
// 열어 둔 탭은 새로고침 전까지 예전 화면 그대로입니다. 사이트에 새 판이 올라가도
// 계속 예전 화면을 보게 되므로, 화면 맨 위에 «새로고침» 띠를 띄웁니다.
//
// 판 번호(BUILD_ID)와 옆 파일 version.txt 를 견줍니다.
// 문서의 Last-Modified 를 보는 방법도 있지만, 서버가 그 머리글을 보내지 않으면
// 새 판이 올라와도 영영 달라지지 않아 띠가 한 번도 안 뜹니다.
// version.txt 는 몇 글자짜리 파일이라 자주 물어봐도 부담이 없습니다.
//
// ※ 새 판을 올릴 때는 아래 BUILD_ID 와 version.txt 를 같은 값으로 고쳐야 합니다.

var BUILD_ID = '2026-09-16.4';
var UPDATE_SHOWN = false;

// version.txt 는 저장소 맨 위에 하나만 둡니다.
// 학생 앱은 맨 위(/)에서, 교사 화면은 한 칸 안쪽(/teacher/)에서 열리므로
// 화면 주소를 기준으로 잡으면 교사 화면에서 /teacher/version.txt 를 찾아 헛걸음합니다.
// 그래서 이 파일(assets/js/update-bar.js)의 제 위치를 기준으로 거슬러 올라갑니다.
var VERSION_URL = (function () {
  try {
    var me = document.currentScript && document.currentScript.src;
    if (me) return new URL('../../version.txt', me).href;
  } catch (e) { /* 아래로 넘어갑니다 */ }
  try { return new URL('version.txt', location.href).href; } catch (e) { return null; }
})();

function showUpdateBar() {
  if (UPDATE_SHOWN) return;
  var bar = document.getElementById('updateBar');
  if (!bar) return;
  UPDATE_SHOWN = true;
  bar.hidden = false;
  // 학생 앱은 화면 맨 위에 띠를 붙박이로 띄웁니다(휴대폰이라 스크롤해도 보여야 합니다).
  // 그만큼 본문을 아래로 내려야 머리줄이 가려지지 않습니다 — CSS 가 이 표시를 보고 처리합니다.
  document.body.classList.add('has-update');
}

function checkForUpdate() {
  if (UPDATE_SHOWN || !window.fetch || !VERSION_URL) return;

  fetch(VERSION_URL + '?_=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (t) {
      if (t === null) return;
      t = String(t).trim();
      // 파일이 통째로 없어서 서버가 안내 쪽(HTML)을 주는 경우가 있습니다. 그러면 그냥 둡니다.
      if (!t || t.length > 40 || /[<>]/.test(t)) return;
      if (t !== BUILD_ID) showUpdateBar();
    })
    .catch(function () { /* 오프라인이면 다음 차례에 다시 봅니다 */ });
}

document.addEventListener('DOMContentLoaded', function () {
  var rb = document.getElementById('updateReload');
  if (rb) rb.addEventListener('click', function () { location.reload(); });

  checkForUpdate();                             // 열자마자 한 번
  setInterval(checkForUpdate, 3 * 60 * 1000);   // 그 뒤로 3분마다
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkForUpdate();   // 탭으로 돌아올 때도
  });
});
