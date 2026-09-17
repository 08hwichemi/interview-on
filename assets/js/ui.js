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

  // 로그인 화면에서는 뒤로가기를 막지 않으므로 «가짜 걸음» 이 비어 있습니다.
  // 로그인해서 들어오는 이 자리에서 다시 쌓아 둡니다. (함수는 아래에 있습니다)
  // (단추를 누른 김에 부르는 자리라 «사람의 손» 이 확실합니다 — true)
  if (screenId !== 'login' && screenId !== 'change-password') reviveBackGuard(true);
}

// 대학 고르기 팝업(openUnivModal · closeUnivModal · selectUniv)은
// browse.js 로 옮겼습니다. 교사 화면도 같은 팝업을 씁니다.

// ══════════════ 휴대폰 뒤로가기 막음 ══════════════
//
// 홈에서 뒤로가기를 누르면 앱이 그냥 닫히고 바탕화면으로 나가 버립니다.
// 이동수업 출석부 앱과 같은 방식으로 «한 번 더 누르면 나갑니다» 를 띄웁니다.
//
// 어떻게 도는가 —
//   ① 사람이 화면을 처음 누를 때 «가짜 걸음» 을 하나 쌓아 둡니다 (pushState)
//   ② 뒤로가기를 누르면 그 걸음이 빠지면서 popstate 가 옵니다
//   ③ 열린 창이 있으면 그것부터 닫고, 걸음을 다시 쌓습니다
//   ④ 홈이 아니면 홈으로 보내고, 걸음을 다시 쌓습니다
//   ⑤ 홈이면 안내만 하고 «걸음을 비워 둡니다».
//      2초 안에 또 누르면 밑바닥이라 진짜로 나가고,
//      안 누르면 2초 뒤에 걸음을 다시 쌓아 둡니다
//
// ⚠️ 예전에는 ⑤ 에서 걸음을 곧바로 다시 쌓았습니다. 그러면 두 번째로 눌러도
//    나가지지 않고(걸음만 빠짐) 세 번째에야 나갔으며, 그 세 번째로 나간 뒤에는
//    걸음이 비어 있어서 다시 들어와도 안 먹혔습니다. «일회성» 으로 보이던 까닭입니다.
//    이제 걸음이 쌓여 있는지를 history.state 로 직접 보고,
//    앱으로 돌아올 때(pageshow · 화면 다시 보임)마다 되살립니다.
//
// ⚠️⚠️ 여기가 안드로이드에서 «아예 안 먹히던» 진짜 까닭입니다.
//    크롬에는 «뒤로가기 가두기 막음»(history manipulation intervention) 이 있습니다.
//    사람이 화면을 **한 번도 건드리지 않은 채** 쌓은 걸음은 뒤로가기가
//    **그냥 건너뜁니다.** 우리는 화면을 열자마자(ui.js 를 읽자마자) 쌓고 있었으니
//    그 걸음은 없는 것이나 마찬가지였고, 뒤로가기를 누르면 바로 앱이 닫혔습니다.
//    ※ 컴퓨터 브라우저와 시험 도구에서는 이 건너뛰기가 일어나지 않습니다.
//      그래서 여기서 아무리 돌려 봐도 멀쩡해 보였습니다.
//    → 걸음은 반드시 **사람이 화면을 만진 뒤** 에 쌓습니다.
//      화면을 처음 누르는 순간(pointerdown·터치·자판) 곧바로 쌓고,
//      그 뒤로도 누를 때마다 «비어 있으면» 다시 쌓습니다.

var BACK_GUARD_MS = 2000;
var backGuardAt = 0;            // 안내를 띄운 때
var backGuardTimer = null;
var backGuardTouched = false;   // 사람이 이 화면을 한 번이라도 건드렸는가
var backGuardStrong = false;    // 지금 쌓아 둔 걸음이 «사람의 손» 으로 쌓은 것인가

// 걸음이 쌓여 있는지는 history.state 로 압니다. 두 번 쌓으면 두 번 눌러야 하므로
// 반드시 «없을 때만» 쌓습니다.
function backGuardArmed() {
  try { return !!(history.state && history.state.interviewOn); } catch (e) { return false; }
}

// 사람이 건드린 적이 있는가. 브라우저가 알려 주면 그걸 믿고, 모르면 우리가 센 것을 씁니다.
function backGuardCanArm() {
  if (backGuardTouched) return true;
  try {
    var ua = navigator.userActivation;
    if (ua && typeof ua.hasBeenActive === 'boolean') return ua.hasBeenActive;
  } catch (e) { /* 아래로 */ }
  return false;
}

// 로그인 화면에서는 막지 않습니다. 글자를 치다가 걸음이 쌓이면
// 로그인 화면에서 뒤로가기를 눌러도 한 번은 헛돌게 됩니다.
function onLoginScreen() {
  var cur = document.querySelector('.screen.active');
  var id = cur ? cur.id : '';
  return id === 'screen-login' || id === 'screen-change-password';
}

// strong = 지금 이 순간이 «사람이 누르는 중» 인가 (손가락·자판·단추 누름 안에서 부른 것인가)
function armBackGuard(strong) {
  if (onLoginScreen()) return;
  var armed = backGuardArmed();
  if (armed && (backGuardStrong || !strong)) return;   // 이미 튼튼하면 그대로 둡니다
  if (!backGuardCanArm()) return;                      // 지금 쌓아 봐야 뒤로가기가 건너뜁니다
  if (backGuardTimer) { clearTimeout(backGuardTimer); backGuardTimer = null; }
  try {
    // 이미 «약한» 걸음이 쌓여 있으면 걸음 수는 그대로 두고 알맹이만 갈아 끼웁니다.
    // (또 쌓으면 뒤로가기를 두 번 눌러야 해서 더 나빠집니다)
    if (armed) history.replaceState({ interviewOn: true }, '', location.href);
    else       history.pushState({ interviewOn: true }, '', location.href);
    backGuardStrong = !!strong;
  } catch (e) { /* 사생활 보호 모드 */ }
}

// 안내를 띄운 동안에는 밑바닥으로 비워 둡니다. 그래야 한 번 더 누를 때 진짜로 나갑니다.
// 안 누르고 넘어가면 다시 쌓아 두어야 다음에도 막을 수 있습니다.
function holdBackGuard() {
  if (backGuardTimer) clearTimeout(backGuardTimer);
  backGuardTimer = setTimeout(function () {
    backGuardTimer = null;
    armBackGuard(false);
  }, BACK_GUARD_MS + 200);
}

// 앱으로 돌아왔을 때 · 화면을 옮길 때 되살립니다. 안내를 막 띄운 참이면 건드리지 않습니다.
function reviveBackGuard(strong) {
  if (Date.now() - backGuardAt < BACK_GUARD_MS) return;
  armBackGuard(strong);
}

// 화면을 누르는 순간이 걸음을 쌓기에 가장 안전한 때입니다 — 그 순간만은 «사람의 손» 이 확실합니다.
function onUserTouch() {
  backGuardTouched = true;
  reviveBackGuard(true);
}
['pointerdown', 'touchstart', 'keydown'].forEach(function (t) {
  window.addEventListener(t, onUserTouch, { capture: true, passive: true });
});

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

window.addEventListener('popstate', function () {
  backGuardStrong = false;        // 쌓아 두었던 걸음이 방금 빠졌습니다

  if (closeTopLayer()) { armBackGuard(false); return; }

  var cur = document.querySelector('.screen.active');
  var id = cur ? cur.id.replace('screen-', '') : 'home';

  // 로그인 전에는 막지 않습니다. 나가고 싶으면 나갈 수 있어야 합니다.
  if (id === 'login' || id === 'change-password') return;

  if (id !== 'home') {
    // 훈련 중이면 handleBack() 이 «중단할까요?» 를 먼저 묻습니다
    handleBack();
    armBackGuard(false);
    return;
  }

  backGuardAt = Date.now();
  showToast('한 번 더 누르면 앱이 닫힙니다.');
  holdBackGuard();
});

// 앱을 내렸다 다시 열면 화면은 그대로인 채 되살아납니다(다시 읽지 않습니다).
// 그때 걸음이 비어 있으면 뒤로가기가 그냥 나가 버리므로 여기서 다시 쌓습니다.
window.addEventListener('pageshow', function () { reviveBackGuard(false); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') reviveBackGuard(false);
});

armBackGuard(false);

// ── 화면에서 바로 보는 진단 ──
// 휴대폰에서만 나는 탈은 여기서 재현할 수가 없습니다(컴퓨터 브라우저는
// 걸음을 건너뛰지 않습니다). 그래서 상태를 화면에서 바로 볼 수 있게 해 둡니다.
// 꼬리말의 «v2026-…» 글자를 0.8초 꾹 누르면 뜹니다.
function showBackGuardState() {
  showToast('판 ' + (typeof BUILD_ID !== 'undefined' ? BUILD_ID : '?') +
            '<br>걸음: ' + (backGuardArmed() ? (backGuardStrong ? '쌓임(튼튼)' : '쌓임(약함)') : '비었음') +
            '<br>만짐: ' + (backGuardCanArm() ? 'O' : 'X') +
            ' · 걸음수: ' + history.length);
}
document.addEventListener('DOMContentLoaded', function () {
  var el = document.querySelector('.verlabel');
  if (!el) return;
  var t = null;
  el.addEventListener('pointerdown', function () { t = setTimeout(showBackGuardState, 800); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (e) {
    el.addEventListener(e, function () { if (t) { clearTimeout(t); t = null; } });
  });
});
