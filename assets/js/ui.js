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
  closeConfirm();
  if(confirmCallback) confirmCallback();
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
}

// 4. 모달(팝업) 관련 함수
function openUnivModal(type) {
  currentModalType = type;
  var univs = getFilteredList(appMeta[type], {}, 'u'); // 해당 카테고리의 모든 대학 추출
  var html = '';
  
  // 전체 보기 버튼 추가
  html += '<button class="univ-list-btn" style="background:var(--surface-2); color:var(--ink-2);" onclick="selectUniv(\'전체\')">🌐 모든 대학 (전체 보기)</button>';
  
  univs.forEach(function(u) {
    html += '<button class="univ-list-btn" onclick="selectUniv(\'' + u + '\')">' + u + '</button>';
  });
  
  document.getElementById('univ-modal-list').innerHTML = html;
  document.getElementById('univ-modal').style.display = 'flex';
}

function closeUnivModal() {
  document.getElementById('univ-modal').style.display = 'none';
}

// 팝업에서 대학을 눌렀을 때 실행!
function selectUniv(univName) {
  if (currentModalType === 'rev') {
    selectedRevUniv = univName;
    document.getElementById('rev-main-univ-btn').innerHTML = '<span>🏫 ' + univName + '</span><span>▼</span>';
    document.getElementById('rev-sub-filters').style.display = 'block'; // 세부 필터 잠금 해제
    updateRevFilters('univ'); // 학과/전형 옵션 업데이트
  } else {
    selectedQUniv = univName;
    document.getElementById('q-main-univ-btn').innerHTML = '<span>🏫 ' + univName + '</span><span>▼</span>';
    // 🛡️ [수정] 복잡한 필터링 과정을 건너뛰고 대학 선택 즉시 바로 검색을 실행합니다.
    updateQFilters();
  }
  closeUnivModal();
}
