// --- [신규] 예쁜 메시지 창 조종 함수 ---
function showToast(msg, type = 'info') {
  var toast = document.getElementById("toast-message");
  toast.innerHTML = msg.replace(/\n/g, "<br>"); // 줄바꿈 적용
  toast.className = "toast-msg show " + type;
  setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 2500); // 2.5초 뒤 스르륵 사라짐
}

var confirmCallback = null;
function showConfirm(msg, callback) {
  document.getElementById('confirm-msg').innerHTML = msg.replace(/\n/g, "<br>");
  document.getElementById('custom-confirm').style.display = 'flex';
  confirmCallback = callback;
}
function closeConfirm() {
  document.getElementById('custom-confirm').style.display = 'none';
  confirmCallback = null;
}
document.getElementById('confirm-ok-btn').addEventListener('click', function() {
  // ⚠️ closeConfirm() 이 confirmCallback 을 비웁니다.
  //    먼저 부르고 나서 confirmCallback 을 보면 항상 비어 있어서,
  //    «확인» 을 눌러도 아무 일도 일어나지 않았습니다 (로그아웃·훈련 중단이 안 됐습니다).
  //    그래서 할 일을 먼저 챙겨 둔 뒤에 창을 닫습니다.
  var todo = confirmCallback;
  closeConfirm();
  if (todo) todo();
});

// [신규] 안전한 뒤로가기 처리
function handleBack() {
  var currentScreen = document.querySelector('.screen.active').id;
  // 훈련 중일 때는 한 번 물어보기
  if (currentScreen === 'screen-interview-run') {
    showConfirm('현재 진행 중인 훈련을 중단하고<br>홈으로 돌아가시겠습니까?', function() { navigateTo('home'); });
  } else {
    navigateTo('home');
  }
}

// 3. 화면 이동 및 상태 리셋
function navigateTo(screenId) {
  // 🛡️ [최종 방어] 화면 이동 시 모든 백그라운드 동작(타이머, 녹음, 재생)을 강제 종료!
  
  // 1. 카운트다운(시한폭탄) 정지
  if (typeof countdownInterval !== 'undefined' && countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  // 2. 녹음기(유령 마이크) 정지 및 마이크 선 뽑기
  if (typeof mediaRecorder !== 'undefined' && mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (typeof mediaStream !== 'undefined' && mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  // 3. [추가] 재생 중인 소리 끄기 및 하단 플레이어 숨기기
  var globalPlayer = document.getElementById('global-audio-player');
  var playerContainer = document.getElementById('global-player-container');
  if (globalPlayer) {
    globalPlayer.pause(); // 소리 즉시 정지
    globalPlayer.src = ""; // 메모리 해제
  }
  if (playerContainer) {
    playerContainer.style.display = 'none'; // 하단 플레이어 바 숨김
  }

  // 기존 화면 이동 로직
  var screens = document.getElementsByClassName('screen');
  for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
  
  document.getElementById('screen-' + screenId).classList.add('active');
  
  var header = document.querySelector('.header');
  var backBtn = document.getElementById('backBtn');
  var appTitle = document.getElementById('app-title');
  
  // 로그인 전, 그리고 비밀번호를 바꿔야 하는 동안에는 헤더를 숨깁니다.
  // (헤더에 로그아웃 버튼이 있어서, 절차를 건너뛸 구멍이 되면 안 됩니다)
  if (screenId === 'login' || screenId === 'change-password') {
    header.style.display = 'none';
  } else {
    header.style.display = 'flex';
    if (screenId === 'home') {
      backBtn.style.display = 'none';
      appTitle.innerText = '스마트 면접 대비';
      stopStopwatch();
    } else {
      backBtn.style.display = 'flex';
      if (screenId === 'my-reports') appTitle.innerText = '내 면접 리포트';
      else if (screenId === 'report-detail') appTitle.innerText = '면접 리포트';
      else if (screenId === 'reviews') appTitle.innerText = '실전 면접 후기';
      else if (screenId === 'questions') appTitle.innerText = '대학별 기출 질문';
      else if (screenId === 'interview-setup' || screenId === 'interview-run' || screenId === 'interview-result') {
        appTitle.innerText = '모의 면접 연습';
      }
    }
  }
  
  if (screenId === 'interview-setup') {
    stopStopwatch();
    initCustomInterviewSetup();
  }
  // 목록은 들어올 때마다 새로 받습니다. 선생님이 방금 보냈을 수 있습니다.
  if (screenId === 'my-reports') loadMyReports();
  window.scrollTo(0, 0);

  // 단추를 누른 김에 부르는 자리라 «사람의 손» 이 확실합니다.
  // 여기서 채워 두는 걸음은 브라우저가 건너뛰지 않습니다. (함수는 아래에 있습니다)
  armBackGuard();
}

// 대학 고르기 팝업(openUnivModal · closeUnivModal · selectUniv)은
// browse.js 로 옮겼습니다. 교사 화면도 같은 팝업을 씁니다.

// ══════════════ 휴대폰 뒤로가기 막음 ══════════════
//
// 이 앱도 화면을 .screen 클래스 하나로만 바꾸므로, 브라우저가 보기에는
// 페이지가 처음부터 끝까지 한 장뿐입니다. 그래서 뒤로가기를 누르면
// «돌아갈 화면이 없다» 며 앱이 그대로 닫혀 바탕화면으로 나가 버립니다.
//
// ⚠️⚠️ 이것을 «가짜 걸음(pushState)» 만으로 막으려다 몇 판을 헛돌았습니다.
//    크롬에는 사이트가 뒤로가기를 가둬 두지 못하게 막는 기능이 있습니다.
//    **사람이 화면을 만지지 않은 채 쌓은 걸음은 뒤로가기가 그냥 건너뜁니다.**
//    게다가 크롬은 **터치 한 번당 걸음 하나만** 인정합니다.
//    그래서 뒤로가기를 처리하면서 걸음을 다시 채워도 소용이 없습니다.
//    ※ 컴퓨터 브라우저와 시험 도구에서는 이 건너뛰기가 일어나지 않습니다.
//      여기서 아무리 돌려 봐도 멀쩡해 보이므로 실제 휴대폰에서 봐야 합니다.
//
// 그래서 이동수업 출석부 앱에서 실제로 통했던 방식을 그대로 가져왔습니다 —
//   ① 화면을 만질 때마다(pointerdown·터치·자판) 걸음을 «세어 가며» 채웁니다.
//      이때 넣은 걸음은 사람의 조작이라 브라우저가 건너뛰지 않습니다
//   ② 뒤로가기를 처리하면서 넣는 걸음은 건너뛰어질 수 있으므로 «개수로 세지 않습니다»
//   ③ 그래도 걸음이 바닥나 진짜로 나가려는 마지막 순간에는
//      **beforeunload** 로 브라우저가 직접 «나가시겠습니까?» 를 묻게 합니다.
//      이건 브라우저 기능이라 위의 건너뛰기 제한을 받지 않습니다. **이게 진짜 안전망입니다**
//
// 뒤로가기를 누르면 —
//   1) 열린 창이 있으면 → 그 창만 닫기
//   2) 홈이 아니면      → 홈으로
//   3) 그 밖에는        → «앱을 종료하시겠습니까?» 예 / 아니오
//      (예전에는 «한 번 더 누르면 닫힙니다» 안내만 띄웠는데, 눈에 잘 안 띄고
//       두 번째 누름이 건너뛰기에 걸려서 이동수업 앱에서도 물음창으로 바꿨습니다)

var GUARD_TARGET = 1;      // 늘 채워 두려는 걸음 수 (크롬이 터치 한 번당 하나만 인정합니다)
var backGuards = 0;        // 지금 쌓아 둔 걸음 수
var leaving = false;       // 일부러 나가는 중인가 (종료 확인 · 새로고침 · 로그아웃)
var leavingAt = 0;

// 일부러 화면을 떠날 때는 «나가시겠습니까?» 를 묻지 않습니다.
// (auth.js 의 로그아웃·역할별 이동, update-bar.js 의 새로고침에서 부릅니다)
function allowLeaving() { leaving = true; leavingAt = Date.now(); }
function leavingNow() { return leaving && Date.now() - leavingAt < 3000; }

// 사람이 만지는 중에 넣는 걸음 — 브라우저가 인정해 줍니다
function pushCounted() {
  try { history.pushState({ interviewOn: true }, ''); backGuards += 1; } catch (e) { /* 사생활 보호 모드 */ }
}
// 뒤로가기를 처리하면서 넣는 걸음 — 건너뛰어질 수 있으므로 세지 않습니다
function pushBestEffort() {
  try { history.pushState({ interviewOn: true }, ''); } catch (e) { /* 사생활 보호 모드 */ }
}

function armBackGuard() {
  if (leavingNow()) return;
  var n = 0;
  while (backGuards < GUARD_TARGET && n < GUARD_TARGET) { pushCounted(); n++; }
}

// 위에 떠 있는 창을 하나 닫습니다. 닫았으면 true.
function closeTopLayer() {
  var confirmBox = document.getElementById('custom-confirm');
  if (confirmBox && confirmBox.style.display === 'flex') { closeConfirm(); return true; }

  var room = document.getElementById('chat-room-modal');
  if (room && room.style.display === 'flex') {
    if (typeof closeChatRoom === 'function') closeChatRoom(); else room.style.display = 'none';
    return true;
  }
  var list = document.getElementById('chat-list-modal');
  if (list && list.style.display === 'flex') {
    if (typeof closeChatList === 'function') closeChatList(); else list.style.display = 'none';
    return true;
  }
  var univ = document.getElementById('univ-modal');
  if (univ && univ.style.display === 'flex') {
    if (typeof closeUnivModal === 'function') closeUnivModal(); else univ.style.display = 'none';
    return true;
  }
  return false;
}

function askExit() {
  var box = document.getElementById('custom-confirm');
  if (box && box.style.display === 'flex') return;   // 다른 물음이 떠 있으면 겹치지 않게
  showConfirm('앱을 종료하시겠습니까?', function () {
    allowLeaving();
    // 쌓아 둔 걸음을 모두 지나 앱 밖으로 나갑니다
    try { history.go(-(backGuards + 1)); } catch (e) {}
    setTimeout(function () { try { window.close(); } catch (e) {} }, 300);
  });
}

window.addEventListener('popstate', function () {
  if (leavingNow()) return;
  leaving = false;
  if (backGuards > 0) backGuards -= 1;

  if (closeTopLayer()) { pushBestEffort(); return; }

  var cur = document.querySelector('.screen.active');
  var id = cur ? cur.id.replace('screen-', '') : 'home';

  // 홈도 로그인도 아니면 홈으로 (훈련 중이면 handleBack() 이 «중단할까요?» 를 먼저 묻습니다)
  if (id !== 'home' && id !== 'login' && id !== 'change-password') {
    handleBack();
    pushBestEffort();
    return;
  }

  pushBestEffort();
  askExit();
});

// 사람이 만질 때마다 걸음을 채웁니다. 이 걸음만 브라우저가 인정해 줍니다.
['pointerdown', 'touchstart', 'keydown'].forEach(function (t) {
  window.addEventListener(t, armBackGuard, true);
});

// ⚠️ 진짜 안전망.
// 위의 걸음은 «터치 한 번당 하나» 라서, 만지지 않고 뒤로가기를 연달아 누르면
// 막지 못합니다. 그 마지막 순간에 브라우저가 직접 묻게 합니다.
window.addEventListener('beforeunload', function (e) {
  if (leavingNow()) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
});

pushCounted();   // 첫 진입분

// ── 화면에서 바로 보는 진단 ──
// 휴대폰에서만 나는 탈은 여기서 재현할 수가 없습니다(컴퓨터 브라우저는 걸음을
// 건너뛰지 않습니다). 그래서 상태를 화면에서 바로 볼 수 있게 해 둡니다.
// 꼬리말의 판 번호(v2026-…)를 연달아 세 번 누르면 뜹니다.
// (꾹 누르기는 안드로이드가 «복사·공유» 메뉴로 가로채 갑니다)
var verTaps = 0, verTapAt = 0;
function showBackGuardState() {
  showToast('판 ' + (typeof BUILD_ID !== 'undefined' ? BUILD_ID : '?') +
            '<br>걸음 ' + backGuards + '칸 · 히스토리 ' + history.length +
            '<br>state ' + (history.state && history.state.interviewOn ? 'O' : 'X'));
}
document.addEventListener('DOMContentLoaded', function () {
  var el = document.querySelector('.verlabel');
  if (!el) return;
  el.addEventListener('click', function () {
    var now = Date.now();
    verTaps = (now - verTapAt < 800) ? verTaps + 1 : 1;
    verTapAt = now;
    if (verTaps >= 3) { verTaps = 0; showBackGuardState(); }
  });
});
