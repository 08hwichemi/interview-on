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
// ── 2026-09-30: 업데이트를 «무조건» 받게 ──
// 띠만 띄우면 안 누르고 계속 쓰는 사람이 있습니다. 예전 판이 켜진 채로 남으면
// 고친 것(예: 서버 요청 줄이기)이 그 기기에는 영영 안 먹습니다. 그래서
//   · 하던 일이 없는 화면이면 → 화면 전체를 덮는 안내를 띄워 «업데이트» 만 누를 수 있게 (2026-10-22 부터는 그냥 새로고침 — 아래)
//   · 화면을 안 보고 있거나(다른 탭·앱) 돌아오는 순간이면 → 알아서 새로고침
//   · 날아가면 안 되는 일을 하는 중이면 → 예전처럼 띠만. 그 일이 끝나면 위 둘로
//     (학생 모의 면접 화면, 선생님이 면접 중이거나 학생을 골라 질문지를 만드는 중,
//      관리자 화면 — updateIsBusy() 참고)
// 답안 연습장은 쓰는 글이 그 기기에 임시로 남아서(practice.js) 새로고침해도 안전합니다.
//
// ── 2026-10-22: 아무것도 안 하고 있으면 누르지 않아도 저절로 ──
// 선생님 말씀: «학생 화면 · 교사 화면 아무것도 안 하고 있을 때 알아서 업데이트 하게».
//   · 하던 일이 없고(updateIsBusy) **1분 동안 손대지 않았으면**(누르기 · 치기 · 스크롤 — updateIsIdle) → 그대로 새로고침.
//     화면을 덮던 «업데이트» 안내는 없앴습니다. 막 열어서 아직 손대지 않았을 때도 바로 새로고침합니다
//   · 하던 일이 없지만 손대는 중이면 → 띠만. 손을 놓고 1분 지나면 저절로(새 판을 안 뒤 20초마다 다시 봅니다 — 서버에 묻지 않음)
//   · 하던 일이 있으면 → 띠만. 끝나면 위대로
//   · 새로고침 뒤에는 보던 곳으로 돌려놓습니다(updateSaveRestore · updateRestore) —
//     선생님: 보던 학생 · 탭(우리 학교 / 타학교), 학생: 보던 화면(홈 · 후기 · 기출 · 연습장 · 리포트 목록 · 모의 면접 세팅 · 후기 쓰기)
//   · 선생님 화면에서 «하던 일» = 면접 진행 · 마무리 중, 생기부 화면, 질문지에 저장 안 한 고침(teacher-app.js 의 prepDirty),
//     저장 안 한 타학교 학생, 붙여넣기 칸 · 코멘트 칸에 적다 만 글, 떠 있는 창, 따라 하기(?guide)
//
// ※ 새 판을 올릴 때는 손으로 고치지 말고 `python3 tools/판올리기.py` 를 쓰세요.
//    version.txt · BUILD_ID · 파일 주소 세 곳을 한꺼번에 맞춥니다.

var BUILD_ID = '2026-10-29.1';
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

// 닫기. 이번에 열어 둔 동안에는 띠가 다시 뜨지 않습니다(UPDATE_SHOWN 이 남아 있습니다).
// 다만 하던 일이 끝나면 applyUpdate() 가 덮는 안내를 띄우거나 알아서 새로고침합니다.
function hideUpdateBar() {
  var bar = document.getElementById('updateBar');
  if (bar) bar.hidden = true;
  document.body.classList.remove('has-update');
  document.documentElement.style.removeProperty('--updatebar-h');
}

// «새로고침» 을 눌러 ?v=판번호 로 다시 열었는데도 판 번호가 그대로면,
// 서버(또는 중간 서버)가 아직 옛 화면을 주고 있는 것입니다.
// 그때 또 띠를 띄우면 눌러도 눌러도 안 사라지는 것처럼 보입니다. 그래서 잠깐 쉽니다.
//
// 🚨 2026-10-11 까지는 주소의 ?v= 만 보고 «영영» 쉬었습니다. 설치한 앱 창은 며칠씩 열려 있으니,
//    GitHub 이 10분 뒤 새 화면을 내놓아도 그 창은 창을 닫을 때까지 옛 판에 머물렀습니다 —
//    선생님 말씀 «같은 GitHub 인데 면접ON 만 유독 늦게 뜬다» 의 까닭.
//    이제 «언제 해 봤는지» 를 같이 적어 두고(sessionStorage — 그 창 안에서만), 10분이 지나면 다시 띄웁니다.
var TRIED_FOR = 10 * 60 * 1000;   // GitHub Pages 가 파일을 쥐고 있으라는 시간과 같게

function alreadyTried(v) {
  var t = null;
  try { t = JSON.parse(sessionStorage.getItem('updateTried') || 'null'); } catch (e) { /* 못 읽으면 없는 셈 */ }
  if (t && t.v === v) return (Date.now() - t.at) < TRIED_FOR;   // 적어 둔 게 있으면 10분 안인지만
  // 적어 둔 건 없는데 주소에 그 판의 ?v= 가 있으면(막 다시 연 것) — 지금부터 10분 쉽니다.
  // 주소만 보고 영영 쉬던 것이 예전 오류라, 여기서 시각을 적어 두는 것이 핵심입니다.
  var inUrl = false;
  try { inUrl = new URLSearchParams(location.search).get('v') === v; } catch (e) { /* */ }
  if (inUrl) rememberTried(v);
  return inUrl;
}
function rememberTried(v) {
  try { sessionStorage.setItem('updateTried', JSON.stringify({ v: v, at: Date.now() })); } catch (e) { /* */ }
}

// 지금 새로고침하면 하던 것이 날아가는 중인가
function updateIsBusy() {
  if (location.pathname.indexOf('/admin/') > -1) return true;            // 관리자: 붙여 넣은 명단 등
  if (/[?&]guide/.test(location.search)) return true;                     // 따라 하기 — 새로고침하면 처음부터
  var el = document.activeElement;                                        // 지금 글을 쓰는 중(톡 입력칸 등)
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !document.hidden) return true;
  var chat = document.getElementById('chat-input');                       // 보내지 않은 톡
  if (chat && chat.value && chat.value.trim()) return true;
  // 떠 있는 창(받은 질문 · 연습장에서 가져오기 · 학생 질문 · 공지 · 톡 …) — 잠깐 쓰는 것이라 닫을 때까지 기다립니다
  var overlays = document.querySelectorAll('.modal-overlay, .chat-modal');
  for (var i = 0; i < overlays.length; i++) {
    var d = overlays[i].style.display;
    if (d === 'flex' || d === 'block') return true;
  }
  // 학생: 모의 면접(녹음 · 받아 적기) 중 · 결과 화면(녹음은 이 기기 안에만 있습니다).
  // 세팅 화면은 질문을 칠 때마다 기기에 담아 두므로(interview.js) 새로고침해도 됩니다
  if (document.querySelector('#screen-interview-run.active, #screen-interview-result.active')) return true;
  if (typeof liveInterview !== 'undefined' && liveInterview) return true; // 선생님: 면접 진행 중(질문 고치기 포함)
  if (location.pathname.indexOf('/teacher/') > -1) {
    var vis = function (id) { var v = document.getElementById(id); return !!v && !v.hidden; };
    if (vis('view-run') || vis('view-finish') || vis('view-saenggibu')) return true;   // 진행 · 마무리(지난 회차 고치기) · 생기부(PDF 는 이 화면에만)
    if (typeof prepDirty === 'function' && prepDirty()) return true;        // 질문지에 저장 안 한 고침
    if (typeof target !== 'undefined' && target && target.other && !target.ivId && String(target.name || '').trim()) return true;  // 명단에 안 넣은 타학교 학생
    var paste = document.getElementById('other-paste-text');
    if (paste && paste.value.trim()) return true;                          // 붙여넣기 칸에 적다 만 글
    var tas = document.querySelectorAll('#t-prac-list textarea, #finish-note');
    for (var j = 0; j < tas.length; j++) if (tas[j].value && tas[j].value.trim()) return true;   // 코멘트 · 총평에 적다 만 글
  }
  return false;
}

// 1분 동안 손대지 않았는가. 막 열어서 아직 한 번도 안 만졌으면 «안 만진 것» 입니다.
var UPDATE_IDLE_MS = 60 * 1000;
var lastTouchAt = 0;
['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach(function (t) {
  window.addEventListener(t, function () { lastTouchAt = Date.now(); }, { capture: true, passive: true });
});
function updateIsIdle() { return !lastTouchAt || Date.now() - lastTouchAt >= UPDATE_IDLE_MS; }

// ── 새로고침 뒤 보던 곳으로 ──
// 다시 여는 것은 같은 창(탭) 안이라 sessionStorage 에 적어 둡니다. 2분이 지난 것은 버립니다.
var RESTORE_KEY = 'updateRestore';
var RESTORE_SCREENS = ['home', 'reviews', 'questions', 'practice', 'my-reports', 'interview-setup', 'hugi'];
function updateSaveRestore() {
  var r = null;
  if (location.pathname.indexOf('/teacher/') > -1) {
    r = { t: 'teacher', other: typeof railOther !== 'undefined' && !!railOther };
    if (typeof target !== 'undefined' && target) {
      if (target.other) r.oid = target.ivId || null; else r.sid = target.id;
      r.tab = typeof teacherLastGoTab !== 'undefined' ? teacherLastGoTab : 'prep';
    }
  } else {
    var s = document.querySelector('.screen.active');
    var id = s ? s.id.replace('screen-', '') : '';
    if (RESTORE_SCREENS.indexOf(id) > -1) r = { t: 'student', screen: id };
  }
  if (!r) return;
  r.at = Date.now();
  try { sessionStorage.setItem(RESTORE_KEY, JSON.stringify(r)); } catch (e) { /* 못 적으면 처음 화면으로 */ }
}
// 앱이 다 뜬 뒤 부릅니다(학생: auth.js 의 enterApp, 선생님: teacher/index.html 의 시작 부분)
async function updateRestore() {
  var r = null;
  try { r = JSON.parse(sessionStorage.getItem(RESTORE_KEY) || 'null'); sessionStorage.removeItem(RESTORE_KEY); } catch (e) { return; }
  if (!r || !r.at || Date.now() - r.at > 2 * 60 * 1000) return;
  try {
    if (r.t === 'teacher' && location.pathname.indexOf('/teacher/') > -1) {
      if (r.other && typeof railShowOther === 'function') railShowOther(true);
      if (r.tab && typeof teacherLastGoTab !== 'undefined') teacherLastGoTab = r.tab;
      if (r.sid && typeof pickStudent === 'function') await pickStudent(r.sid);
      else if (r.oid && typeof otherOpen === 'function') { if (typeof otherLoad === 'function') await otherLoad(); await otherOpen(r.oid); }
    } else if (r.t === 'student' && r.screen && r.screen !== 'home' && typeof navigateTo === 'function') {
      navigateTo(r.screen);
    }
  } catch (e) { console.warn('보던 화면으로 돌아가지 못했습니다:', e); }
}

// 새 판이 있다는 걸 안 뒤, 지금 형편에 맞게 처리합니다.
// ⚠️ 2026-09-30 ~ 10-21 엔 «하던 일이 없으면» 화면을 덮는 «업데이트» 안내를 띄워 누르게 했습니다.
//    «아무것도 안 할 때는 알아서» 라는 말씀(2026-10-22)에 덮는 안내는 없애고 그냥 새로고침합니다.
var UPDATE_WATCH = null;
function applyUpdate() {
  if (!SERVER_VERSION) return;
  // 새 판을 안 뒤로는 20초마다 형편을 다시 봅니다 — 하던 일이 끝나거나 손을 놓으면 그때 새로고침(서버에 묻지 않습니다)
  if (!UPDATE_WATCH) UPDATE_WATCH = setInterval(applyUpdate, 20 * 1000);
  if (updateIsBusy()) { showUpdateBar(); return; }   // 하던 일이 있으면 띠만
  if (document.hidden || updateIsIdle()) { reloadFresh(); return; }   // 안 보고 있거나 1분 동안 손대지 않았으면 조용히
  showUpdateBar();                                   // 손대는 중이면 띠만 — 손을 놓고 1분 지나면 저절로
}

function checkForUpdate() {
  if (SERVER_VERSION) { applyUpdate(); return; }      // 이미 알고 있으면 다시 묻지 않고 처리만
  if (!window.fetch || !VERSION_URL) return;

  fetch(VERSION_URL + '?_=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (t) {
      if (t === null) return;
      t = String(t).trim();
      // 파일이 통째로 없어서 서버가 안내 쪽(HTML)을 주는 경우가 있습니다. 그러면 그냥 둡니다.
      if (!t || t.length > 40 || /[<>]/.test(t)) return;
      if (t !== BUILD_ID) {
        if (alreadyTried(t)) return;          // 이미 그 판으로 다시 열어 봤습니다
        SERVER_VERSION = t; applyUpdate();
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
  // 답안 연습장에 쓰던 글을 서버로 보내 봅니다(못 가도 그 기기 임시본에서 다음에 올라갑니다)
  if (typeof practiceFlushAll === 'function') { try { practiceFlushAll(); } catch (e) { /* 그래도 새로고침 */ } }
  updateSaveRestore();   // 새로 연 뒤 보던 곳으로 돌아가게
  var base = location.href.split('?')[0].split('#')[0];
  var v = SERVER_VERSION || String(Date.now());
  rememberTried(v);
  // 같은 판으로 두 번째 여는 것이면(10분 전에 해 봤는데 옛 화면이 왔던 것) 주소를 조금 바꿔서
  // 브라우저가 쥐고 있던 것을 또 쓰지 못하게 합니다
  var again = (function () { try { return new URLSearchParams(location.search).get('v') === v; } catch (e) { return false; } })();
  location.replace(base + '?v=' + encodeURIComponent(v) + (again ? '&t=' + Date.now() : ''));
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
  setInterval(function () { if (!document.hidden) checkForUpdate(); }, 3 * 60 * 1000);   // 그 뒤로 3분마다(보고 있을 때만)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkForUpdate();   // 탭으로 돌아올 때도
    else if (SERVER_VERSION) applyUpdate();                          // 떠날 때 새 판을 알고 있으면 그때 새로고침
  });
});
