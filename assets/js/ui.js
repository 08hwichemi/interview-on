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
      else if (screenId === 'practice') appTitle.innerText = '답안 연습장';
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
  if (screenId === 'practice') practiceStudentEnter();
  window.scrollTo(0, 0);

  // ⚠️ 여기서 걸음을 쌓지 않습니다 — 이동수업 앱 원본에도 없습니다.
  //    단추를 눌러서 왔다면 pointerdown 에서 이미 쌓였고,
  //    앱이 켜지면서 스스로 불렀다면 쌓아 봐야 건너뛰어집니다.
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
// 그래서 이동수업 출석부 앱에서 실제로 통하는 방식을 **한 줄도 바꾸지 않고** 씁니다 —
//   ① 열자마자 걸음을 하나 쌓습니다 (아무것도 안 만진 채 누를 때를 대비)
//   ② 화면을 만질 때마다(pointerdown·터치·자판) 한 칸까지 다시 채웁니다
//   ③ 뒤로가기를 처리하면서도 한 칸 넣습니다 (세지는 않습니다)
//   ④ beforeunload 로 브라우저가 «사이트를 나가시겠습니까?» 를 묻게 합니다
//      — 우리 창이 아니라 크롬 창이라 모양이 다릅니다. 실제로 한 번은 이것이
//        앱을 붙잡아 주었습니다(자취에 「나가려 함」이 찍혔습니다)
//
// 뒤로가기를 누르면 —
//   1) 열린 창이 있으면 → 그 창만 닫기
//   2) 홈이 아니면      → 홈으로
//   3) 그 밖에는        → «앱을 종료하시겠습니까?» 예 / 아니오
//      (예전에는 «한 번 더 누르면 닫힙니다» 안내만 띄웠는데, 눈에 잘 안 띄고
//       두 번째 누름이 건너뛰기에 걸려서 이동수업 앱에서도 물음창으로 바꿨습니다)

// 늘 채워 두려는 «진짜 걸음» 수.
// ⚠️ 1 칸으로는 모자랍니다. 실제 자취로 확인한 것 —
//    뒤로가기 한 번(다른 화면 → 홈)에 걸음이 0 칸이 되는데, 사람이 화면을
//    만지지 않고 곧바로 또 누르면 채울 틈이 없어 그대로 앱이 꺼졌습니다.
//    (안드로이드에서는 beforeunload 도 안 옵니다 — 자취에 아무것도 안 찍혔습니다)
//    그래서 여유분을 여러 칸 쌓아 둡니다. 만질 때마다 한 칸씩 찹니다.
// ══ 아래는 이동수업 출석부 앱(movingclass-src/App.js)의 «정확히 같은» 짜임입니다 ══
//
// ⚠️ 여기를 «개선» 하지 마세요. 제가 세 판에 걸쳐 고쳐 보려다 전부 더 나빠졌습니다 —
//    ① 여유분을 1 → 4 칸으로 늘렸더니, pointerdown 과 touchstart 가 손가락 한 번에
//       둘 다 오는 바람에 허깨비 걸음이 잔뜩 쌓였습니다.
//       («while (걸음 < 1)» 로 막아 두면 두 이벤트가 와도 한 칸에서 멈춥니다)
//    ② 열자마자 쌓는 첫 걸음을 뺐더니, 앱을 켜고 아무것도 안 만진 채 뒤로가기를
//       누르면 막을 것이 하나도 없어 그대로 꺼졌습니다
//    ③ 뒤로가기를 처리하면서 쌓는 걸음(pushBestEffort)을 뺐더니,
//       한 번 뒤로 간 뒤에는 남는 것이 없어 다음 누름에 꺼졌습니다
//    셋 다 원본에는 있는 것들이고, 없애 보니 하나같이 탈이 났습니다.

var GUARD_TARGET = 1;      // 여유분 한 칸 (원본 그대로)
var backGuards = 0;        // 지금 쌓아 둔 걸음 수
var leaving = false;       // 일부러 나가는 중인가 (종료 확인 · 새로고침 · 로그아웃)
var leavingAt = 0;

// 일부러 화면을 떠날 때는 «나가시겠습니까?» 를 묻지 않습니다.
// (auth.js 의 로그아웃·역할별 이동, update-bar.js 의 새로고침에서 부릅니다)
function allowLeaving() { leaving = true; leavingAt = Date.now(); }
function leavingNow() { return leaving && Date.now() - leavingAt < 3000; }

// ── 자취 남기기 ──
// 휴대폰에서 무슨 일이 일어났는지 «앱이 꺼진 뒤에도» 볼 수 있어야 합니다.
// 다시 열고 꼬리말의 판 번호를 세 번 누르면 보입니다.
function logBack(what) {
  try {
    var a = JSON.parse(localStorage.getItem('backlog') || '[]');
    a.push(new Date().toTimeString().slice(0, 8) + ' ' + what);
    while (a.length > 10) a.shift();
    localStorage.setItem('backlog', JSON.stringify(a));
  } catch (e) { /* 사생활 보호 모드 */ }
}

// 사람이 만지는 중에 넣는 걸음 — 브라우저가 인정해 줍니다
function pushCounted() {
  try { history.pushState({ interviewOn: true }, ''); backGuards += 1; } catch (e) { /* 사생활 보호 모드 */ }
}
// 뒤로가기를 처리하면서 넣는 걸음 — 건너뛰어질 수 있으므로 «개수로 세지 않습니다»
function pushBestEffort() {
  try { history.pushState({ interviewOn: true }, ''); } catch (e) { /* 사생활 보호 모드 */ }
}

function armBackGuard() {
  if (leavingNow()) return;
  var n = 0;
  // ⚠️ 이 «while + n» 이 핵심입니다. 손가락 한 번에 pointerdown·touchstart 가
  //    둘 다 와도 걸음은 한 칸에서 멈춥니다.
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

// ⚠️ 자바스크립트로는 안드로이드 앱을 «닫을» 수가 없습니다.
//    history.go(-N) 은 우리 화면 «안» 에서만 움직이고, window.close() 는
//    스크립트가 연 창이 아니면 막힙니다. 할 수 있는 일은 막고 있던 걸음을 치워
//    **다음 뒤로가기가 그대로 나가게** 하는 것뿐입니다.
function askExit() {
  var box = document.getElementById('custom-confirm');
  if (box && box.style.display === 'flex') return;   // 다른 물음이 떠 있으면 겹치지 않게
  showConfirm('앱을 종료할까요?<br><span style="font-size:13px;color:var(--ink-3)">' +
              '«확인» 을 누르고 <b>뒤로가기를 한 번 더</b> 누르면 나갑니다</span>',
    function () {
      allowLeaving();
      backGuards = 0;
      logBack('종료 확인 → 막음 품');
      try { if (history.length > 1) history.go(-(history.length - 1)); } catch (e) {}
      setTimeout(function () { try { window.close(); } catch (e) {} }, 300);
      setTimeout(function () {
        allowLeaving();      // 아직 살아 있으면 — 한 번 더 누르시라고 알립니다
        showToast('뒤로가기를 한 번 더 누르면 나갑니다.');
      }, 700);
    });
}

window.addEventListener('popstate', function () {
  if (leavingNow()) { logBack('뒤로(나가는 중이라 넘김)'); return; }
  leaving = false;
  if (backGuards > 0) backGuards -= 1;

  if (closeTopLayer()) {
    logBack('뒤로 → 창 닫음 (걸음 ' + backGuards + ')');
    pushBestEffort();
    return;
  }

  var cur = document.querySelector('.screen.active');
  var id = cur ? cur.id.replace('screen-', '') : 'home';

  // 홈도 로그인도 아니면 홈으로 (훈련 중이면 handleBack() 이 «중단할까요?» 를 먼저 묻습니다)
  if (id !== 'home' && id !== 'login' && id !== 'change-password') {
    logBack('뒤로 → 홈으로 (' + id + ', 걸음 ' + backGuards + ')');
    handleBack();
    pushBestEffort();
    return;
  }

  logBack('뒤로 → 종료 물음 (' + id + ', 걸음 ' + backGuards + ')');
  pushBestEffort();
  askExit();
});

// 사람이 만질 때마다 걸음을 채웁니다. 이 걸음만 브라우저가 인정해 줍니다.
// (원본과 같이 세 가지를 다 듣습니다 — 위의 while 이 두 번 쌓는 것을 막아 줍니다)
['pointerdown', 'touchstart', 'keydown'].forEach(function (t) {
  window.addEventListener(t, armBackGuard, true);
});

// 보조 안전망. 브라우저가 직접 «사이트를 나가시겠습니까?» 를 묻습니다.
// 우리가 만든 창이 아니라 크롬의 창입니다 — 그래서 모양이 다릅니다.
window.addEventListener('beforeunload', function (e) {
  if (leavingNow()) { logBack('나감(일부러)'); return; }
  logBack('나가려 함 → 브라우저에 물어 달라고 함');
  e.preventDefault();
  e.returnValue = '';
  return '';
});

// 첫 진입분. 앱을 켜고 «아무것도 만지지 않은 채» 뒤로가기를 눌러도
// 막을 것이 하나는 있어야 합니다. (원본에도 있습니다)
pushCounted();
logBack('── 앱 열림 ' + (typeof BUILD_ID !== 'undefined' ? BUILD_ID : '?') + ' ──');

// ── 화면에서 바로 보는 진단 ──
// 휴대폰에서만 나는 탈은 여기서 재현할 수가 없습니다(컴퓨터 브라우저는 걸음을
// 건너뛰지 않습니다). 그래서 상태를 화면에서 바로 볼 수 있게 해 둡니다.
// 꼬리말의 판 번호(v2026-…)를 연달아 세 번 누르면 뜹니다.
// (꾹 누르기는 안드로이드가 «복사·공유» 메뉴로 가로채 갑니다)
var verTaps = 0, verTapAt = 0;
function showBackGuardState() {
  var 자취 = [];
  try { 자취 = JSON.parse(localStorage.getItem('backlog') || '[]'); } catch (e) {}
  // 토스트는 2.5초면 사라져서 사진을 못 찍습니다. 닫기 전까지 남는 창으로 보여 줍니다.
  showConfirm('판 ' + (typeof BUILD_ID !== 'undefined' ? BUILD_ID : '?') +
              ' · 걸음 ' + backGuards + '칸 · 히스토리 ' + history.length +
              ' · state ' + (history.state && history.state.interviewOn ? 'O' : 'X') +
              '<br><br><b>자취</b><br>' + (자취.length ? 자취.join('<br>') : '(없음)'),
              function () { try { localStorage.removeItem('backlog'); } catch (e) {} });
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
