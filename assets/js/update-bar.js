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
// ⚠️ 한 번 크게 틀렸던 곳입니다.
// version.txt 는 «항상 새로» 받는데, 이 js 파일은 GitHub Pages 가 브라우저에
// 10분쯤 쥐고 있게 합니다. 그래서 version.txt 만 새것이 되고 BUILD_ID 는 옛것이 남아
// 띠가 떴는데 새로고침을 눌러도 안 사라지는 일이 생겼습니다.
// 고친 방법은 두 가지입니다.
//   1) 화면이 부르는 우리 파일 주소에 ?v=판번호 를 붙입니다 (tools/판올리기.py 가 해줍니다)
//   2) «새로고침» 단추가 그냥 새로고침하지 않고 주소에 ?v= 를 붙여 다시 엽니다.
//      주소가 달라져야 브라우저가 쥐고 있던 옛 파일을 버립니다.
//
// ※ 새 판을 올릴 때는 손으로 고치지 말고 `python3 tools/판올리기.py` 를 쓰세요.
//    version.txt · BUILD_ID · 파일 주소 세 곳을 한꺼번에 맞춥니다.

var BUILD_ID = '2026-09-17.28';
var UPDATE_SHOWN = false;
var SERVER_VERSION = null;   // 서버에 올라와 있는 판 번호

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

// 띠의 «진짜» 높이를 재어 둡니다. 글이 길거나 화면이 좁으면 두세 줄이 되는데,
// 예전처럼 44px 로 박아 두면 머리줄을 덮고 본문이 화면 밖으로 밀려납니다.
function sizeUpdateBar() {
  var bar = document.getElementById('updateBar');
  if (!bar || bar.hidden) return;
  var h = Math.ceil(bar.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty('--updatebar-h', h + 'px');
}

function showUpdateBar() {
  if (UPDATE_SHOWN) return;
  var bar = document.getElementById('updateBar');
  if (!bar) return;
  UPDATE_SHOWN = true;
  bar.hidden = false;
  // 학생 앱은 화면 맨 위에 띠를 붙박이로 띄웁니다(휴대폰이라 스크롤해도 보여야 합니다).
  // 그만큼 본문을 아래로 내려야 머리줄이 가려지지 않습니다 — CSS 가 이 표시를 보고 처리합니다.
  document.body.classList.add('has-update');
  sizeUpdateBar();
}

// 닫기. 이번에 열어 둔 동안에는 다시 뜨지 않습니다(UPDATE_SHOWN 이 남아 있습니다).
function hideUpdateBar() {
  var bar = document.getElementById('updateBar');
  if (bar) bar.hidden = true;
  document.body.classList.remove('has-update');
  document.documentElement.style.removeProperty('--updatebar-h');
}

// «새로고침» 을 눌러 ?v=판번호 로 다시 열었는데도 판 번호가 그대로면,
// 서버(또는 중간 서버)가 아직 옛 화면을 주고 있는 것입니다.
// 그때 또 띠를 띄우면 눌러도 눌러도 안 사라지는 것처럼 보입니다. 한 번으로 끝냅니다.
function alreadyTried(v) {
  try { return new URLSearchParams(location.search).get('v') === v; } catch (e) { return false; }
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
      if (t !== BUILD_ID) {
        if (alreadyTried(t)) return;          // 이미 그 판으로 다시 열어 봤습니다
        SERVER_VERSION = t; showUpdateBar();
      }
    })
    .catch(function () { /* 오프라인이면 다음 차례에 다시 봅니다 */ });
}

// 지금 쓰고 있는 판 번호를 화면에 적어 둡니다.
// 무엇을 보고 있는지 알 수 없으면 «업데이트 된 거 맞나» 를 확인할 길이 없습니다.
function paintVersion() {
  var el = document.getElementById('app-version');
  if (el) el.textContent = BUILD_ID;
}

// 그냥 location.reload() 를 하면 브라우저가 쥐고 있던 옛 js·css 를 그대로 다시 씁니다.
// 주소를 바꿔야 새 파일을 받습니다.
function reloadFresh() {
  // 일부러 다시 여는 길입니다 — 뒤로가기 막음(ui.js)이 «나가시겠습니까?» 를 묻지 않게 합니다
  if (typeof allowLeaving === 'function') allowLeaving();
  var base = location.href.split('?')[0].split('#')[0];
  location.replace(base + '?v=' + encodeURIComponent(SERVER_VERSION || String(Date.now())));
}

document.addEventListener('DOMContentLoaded', function () {
  paintVersion();

  var rb = document.getElementById('updateReload');
  if (rb) rb.addEventListener('click', reloadFresh);
  var xb = document.getElementById('updateClose');
  if (xb) xb.addEventListener('click', hideUpdateBar);

  // 화면을 돌리거나 글씨 크기가 바뀌면 띠의 줄 수가 달라집니다
  window.addEventListener('resize', sizeUpdateBar);

  checkForUpdate();                             // 열자마자 한 번
  setInterval(checkForUpdate, 3 * 60 * 1000);   // 그 뒤로 3분마다
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkForUpdate();   // 탭으로 돌아올 때도
  });
});
