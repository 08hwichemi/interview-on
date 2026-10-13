// 9. 실전 말하기 훈련 (로컬 스토리지 + 스톱워치)
var currentMockIndex = 0;
var secondsElapsed = 0;
var isTimerRunning = false;
var interviewResults = []; // 결과 기록용 배열

// ── 받아 적기(«말한 것을 글로 받아 적을게요») ──
// 녹음(MediaRecorder)과 받아 적기(크롬 음성 인식)는 **둘 중 하나만** 켭니다.
// ⚠️ 2026-10-13 선생님 폰(안드로이드 크롬)으로 세 번 시험 — 녹음 먼저 · 받아 적기 먼저 · 마이크 선 넘기기
//    셋 다 받아 적기가 안 됐습니다. 안드로이드의 받아 적기는 크롬이 아니라 안드로이드(구글 앱)의 인식기를 빌려 쓰는 것이라
//    크롬이 녹음으로 마이크를 쥐면 그쪽이 못 잡습니다. 그래서 «동시에» 는 접고 학생이 고르게 했습니다.
// 받아 적기는 선생님 화면의 listen.js 와 같은 방식(ko-KR · 계속 듣기 · 조용해서 스스로 멈추면 다시 켬)이지만,
// listen.js 는 선생님 화면의 변수(answers · qIndex …)에 붙어 있어 여기서는 따로 작게 둡니다.
var isTextOptedIn = false;   // 학생이 «글로 받아 적기» 를 골랐는가
var textResults = [];        // 질문마다 받아 적은 글
var MOCK_LISTEN = { rec: null, on: false, interim: '', hint: '', restartId: null, fails: 0 };
function mockListenCtor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

// 설정 화면 초기화 및 로컬 스토리지 불러오기
function initCustomInterviewSetup() {
  document.getElementById('changche-inputs').innerHTML = '';
  document.getElementById('major-inputs').innerHTML = '';
  
  var savedData = localStorage.getItem('smartInterviewQs');
  var parsed = savedData ? JSON.parse(savedData) : { changche: [], major: [] };
  
  // 최소 5개는 무조건 세팅
  var cCount = Math.max(5, parsed.changche.length);
  for(let i=0; i<cCount; i++) renderCustomInput('changche', parsed.changche[i] || '');
  
  var mCount = Math.max(5, parsed.major.length);
  for(let i=0; i<mCount; i++) renderCustomInput('major', parsed.major[i] || '');
}

// 입력칸 그리기, 삭제 버튼 추가 및 자동 저장 이벤트 연결
function renderCustomInput(type, value) {
  var container = document.getElementById(type + '-inputs');
  
  // 입력칸과 삭제 버튼을 묶을 가로 정렬 박스 생성
  var wrapper = document.createElement('div');
  wrapper.className = 'custom-q-row';
  
  // 🛡️ [추가] '고정' 라벨과 체크박스 생성
  var lockLabel = document.createElement('label');
  lockLabel.className = 'lock-label';
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'q-checkbox';
  
  // 글자가 이미 적혀있다면 안전하게 자동으로 '고정' 상태로 만들어줍니다. (빈칸은 체크 해제)
  if (value.trim() !== '') checkbox.checked = true; 

  lockLabel.appendChild(checkbox);
  lockLabel.appendChild(document.createTextNode('고정'));

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'custom-q-input';
  input.placeholder = type === 'changche' ? '예: 동아리 부장으로서 겪은 갈등 해결 경험은?' : '예: 지원 학과와 관련된 교과 세특 활동을 설명해보세요.';
  input.value = value;
  input.oninput = saveToLocalStorage; // 글자를 칠 때마다 폰에 저장
  
  // 삭제 버튼 생성
  var delBtn = document.createElement('button');
  delBtn.className = 'delete-q-btn';
  delBtn.innerHTML = '✕';
  delBtn.onclick = function() {
    // 5개 미만으로는 삭제되지 않도록 방어 로직 추가 (선택 사항이지만 UI 안정을 위해 권장)
    if (container.children.length <= 1) {
      showToast('최소 1개의 질문 칸은 필요합니다.', 'error');
      return;
    }
    container.removeChild(wrapper); // 화면에서 삭제
    saveToLocalStorage(); // 로컬 스토리지에 즉시 반영
  };
  
  wrapper.appendChild(lockLabel); // 🛡️ [추가] 체크박스 묶음 조립
  wrapper.appendChild(input);
  wrapper.appendChild(delBtn);
  container.appendChild(wrapper);
}

// '+ 질문 추가하기' 버튼 클릭 시
function addCustomInput(type) {
  renderCustomInput(type, '');
  saveToLocalStorage();
}

// 로컬 스토리지에 데이터 저장
function saveToLocalStorage() {
  // 🛡️ [핵심 수정] input 전체가 아니라, 글자를 입력하는 진짜 칸(.custom-q-input)만 콕 집어서 저장합니다!
  var changcheInputs = Array.from(document.querySelectorAll('#changche-inputs .custom-q-input')).map(el => el.value);
  var majorInputs = Array.from(document.querySelectorAll('#major-inputs .custom-q-input')).map(el => el.value);
  
  var data = { changche: changcheInputs, major: majorInputs };
  localStorage.setItem('smartInterviewQs', JSON.stringify(data));
  return data;
}

// --- [신규] 수파베이스 추천 질문 채우기 ---
async function fillRecommendedQuestions(type) {
  var btn = event.target;
  var originalText = btn.innerText;
  btn.innerText = "불러오는 중...";
  btn.disabled = true; // 연타 방지

  try {
    var data = await supabaseRequest('common_questions', { 'category': type });
    
    if (data && data.length > 0) {
      // 랜덤으로 질문 섞기
      var shuffled = data.sort(() => 0.5 - Math.random());
      
      // 🛡️ [수정] 체크가 '안 된(고정 안 된)' 입력칸만 타겟으로 잡습니다!
      var rows = document.querySelectorAll('#' + type + '-inputs .custom-q-row');
      var targetInputs = [];
      
      rows.forEach(function(row) {
        var chk = row.querySelector('.q-checkbox');
        var inp = row.querySelector('.custom-q-input');
        // 고정이 안 되어있거나(빈칸), 아예 체크박스가 없는 경우 변경 대상!
        if (chk && !chk.checked) {
          targetInputs.push(inp); 
        }
      });

      if (targetInputs.length === 0) { 
        showToast("모든 질문이 고정되어 있습니다. 고정을 풀고 추천을 눌러주세요.", "info");
        btn.innerText = originalText;
        btn.disabled = false;
        return;
      }

      // 고정 안 된 곳에만 쇽쇽 추천 질문 채워넣기
      targetInputs.forEach(function(input, idx) {
        if (shuffled[idx]) {
          input.value = shuffled[idx].content;
        }
      });
      
      saveToLocalStorage(); // 폰에 자동 저장
      var typeName = type === 'changche' ? '🌱 창체' : '📚 전공';
      showToast(typeName + ' 추천 질문이 랜덤으로 채워졌습니다!', 'success');
    } else {
      showToast("등록된 추천 질문이 없습니다.", "error");
    }
  } catch (e) {
    console.error(e);
    showToast("질문을 불러오지 못했습니다. 인터넷을 확인해주세요.", "error");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

// 📂 파일로 저장 (다운로드)
function exportQuestionsToFile() {
  var data = saveToLocalStorage();
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "나의면접질문.json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  showToast('질문 파일이 기기에 저장되었습니다.<br>이 파일을 언제든 다시 불러올 수 있습니다.', 'success');
}

// 📥 파일 불러오기
function importQuestionsFromFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      localStorage.setItem('smartInterviewQs', JSON.stringify(data));
      initCustomInterviewSetup();
      showToast('성공적으로 질문을 불러왔습니다.', 'success');
    } catch (err) {
      showToast('올바른 파일 형식이 아닙니다.', 'error');
    }
    event.target.value = ''; // 초기화
  };
  reader.readAsText(file);
}

// 배열 랜덤 섞기 헬퍼
function getRandom(arr, count) {
  var validArr = arr.filter(text => text.trim().length > 0);
  var shuffled = [...validArr].sort(() => 0.5 - Math.random());
  return count === 'all' ? shuffled : shuffled.slice(0, parseInt(count));
}

// 훈련 시작 (코스 조립)
function startCustomInterview() {
  var data = saveToLocalStorage();
  var cCount = document.getElementById('changche-count').value;
  var mCount = document.getElementById('major-count').value;

  var cQuestions = getRandom(data.changche, cCount);
  var mQuestions = getRandom(data.major, mCount);

  // 🛡️ [수정] 둘 다 '0개'를 의도적으로 선택한 경우는 에러 없이 통과시킵니다.
  if (cCount === '0' && mCount === '0') {
    // 0개 선택이므로 도입/마무리만으로 코스 조립 진행!
  } 
  // 🛡️ 실수로 빈칸만 남겨둔 경우에만 경고창을 띄웁니다.
  else if (cQuestions.length === 0 && mQuestions.length === 0) {
    showToast('출제할 질문이 없습니다.<br>질문을 작성하거나 출제 개수를 0개로 설정해주세요.', 'error');
    return;
  }

  var course = [];
  var stageNum = 1;

  // [도입]
  var intros = ["간단하게 1분 자기소개 부탁드립니다.", "본인의 자기소개와 우리 학과 지원 동기를 엮어서 말씀해 보세요."];
  course.push({ stage: "도입", tag: "자기소개/지원동기", text: intros[Math.floor(Math.random() * intros.length)] });

  // [창체]
  cQuestions.forEach(q => { course.push({ stage: "본론 (창체)", tag: "인성/공동체", text: q }); });

  // [전공]
  mQuestions.forEach(q => { course.push({ stage: "본론 (전공)", tag: "전공적합성", text: q }); });

  // [마무리]
  course.push({ stage: "마무리", tag: "발전가능성", text: "마지막으로 하고 싶은 말이나, 미처 하지 못한 말이 있다면 해보세요." });

  // 단계 번호 매기기
  course.forEach((item, idx) => { item.stageDisplay = `[${idx+1}/${course.length}] ${item.stage}`; });

  currentMockQuestions = course;
  currentMockIndex = 0;
  interviewResults = [];
  audioUrls = []; // ✨ [추가] 새 훈련 시작 시 이전 녹음 기록을 깨끗이 비웁니다!
  textResults = [];
  
  // [수정] 바로 넘어가지 않고 팝업창을 띄웁니다.
  paintRecordOptions();
  document.getElementById('recording-modal').style.display = 'flex';
}

// 고르기 창의 «내 답변을 어떻게 남길까요» — 고른 것에 맞는 설명을 아래 줄에 적고,
// 받아 적기가 없는 브라우저(삼성 인터넷 · 카톡 안 브라우저 · 파이어폭스)에서는 그 선택지를 막습니다.
function paintRecordOptions() {
  var sel = document.getElementById('modal-record-select');
  var hint = document.getElementById('modal-record-hint');
  if (!sel || !hint) return;
  var textOpt = sel.querySelector('option[value="text"]');
  var can = !!mockListenCtor();
  if (textOpt) {
    textOpt.disabled = !can;
    textOpt.textContent = can ? '📝 말한 것을 글로 받아 적을게요' : '📝 글로 받아 적기 (이 브라우저에는 없음)';
    if (!can && sel.value === 'text') sel.value = 'yes';
  }
  var v = sel.value;
  if (v === 'yes') hint.textContent = '답변을 녹음해 두고 결과 화면에서 다시 들을 수 있습니다. 녹음과 받아 적기는 둘 중 하나만 됩니다(휴대폰이 마이크를 나눠 쓰지 못합니다).';
  else if (v === 'text') hint.textContent = '말하는 동안 글로 받아 적혀 결과 화면에서 읽어 볼 수 있습니다. 소리는 남지 않습니다. 인터넷이 있어야 하고, 크롬에서 가장 잘 됩니다.';
  else hint.textContent = can ? '' : '이 브라우저에는 받아 적기가 없습니다. 크롬으로 열면 «글로 받아 적을게요» 를 고를 수 있습니다.';
}

// --- [신규] 팝업창 설정 완료 로직 ---
async function confirmSettings() {
  var recordVal = document.getElementById('modal-record-select').value;
  var modeVal = document.getElementById('modal-mode-select').value;

  document.getElementById('recording-modal').style.display = 'none';

  isRecordOptedIn = (recordVal === 'yes');
  isTextOptedIn = (recordVal === 'text') && !!mockListenCtor();   // 받아 적기 — 녹음과 동시에는 켜지 않음
  isAutoStart = (modeVal === 'auto'); // 실전 모드인지 연습 모드인지 저장
  MOCK_LISTEN.hint = '';

  if (isRecordOptedIn) {
    try {
      // 🛡️ [수정] 여기서는 마이크 권한만 얻어오고, 녹음기는 질문마다 새로 만듭니다.
      if (!mediaStream) mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert("마이크 권한이 거부되어 녹음 없이 진행합니다.");
      isRecordOptedIn = false;
    }
  }
  
  navigateTo('interview-run');
  showCurrentQuestion(); 
}

// --- 현재 질문 화면 렌더링 및 모드 분기 ---
function showCurrentQuestion() {
  var item = currentMockQuestions[currentMockIndex];
  document.getElementById('mock-univ-badge').innerText = item.stageDisplay;
  document.getElementById('mock-type-badge').innerText = item.tag;
  document.getElementById('mock-question-text').innerText = item.text;
  
  var btn = document.getElementById('mock-timer-btn');
  document.getElementById('mock-next-btn').style.display = "none";
  resetStopwatch();
  mockListenPaint();   // 받아 적기 칸 — 골랐을 때만 보이고, 새 질문이면 비어 있음

  if (isAutoStart) {
    // 1. 실전 모드: 바로 5초 카운트다운 시작
    startCountdown(); 
  } else {
    // 2. 연습 모드: 타이머 0초로 대기하고 버튼 누를 수 있게 열어둠
    document.getElementById('timer').innerText = "00:00";
    btn.innerText = "▶ 답변 시작";
    btn.style.backgroundColor = "var(--ink)"; 
    btn.disabled = false; 
  }
}

// --- [신규] 5초 카운트다운 로직 ---
function startCountdown() {
  stopStopwatch(); // 기존 타이머 멈춤
  if (countdownInterval) clearInterval(countdownInterval);
  
  var btn = document.getElementById('mock-timer-btn');
  btn.innerText = "답변 준비 중...";
  btn.style.backgroundColor = "var(--ink-3)"; // 회색으로 잠금
  btn.disabled = true; // 터치 방지
  document.getElementById('mock-next-btn').style.display = "none";
  
  var count = 10; // ✨ 숫자를 10으로 바꾸면 10초부터 카운트다운이 시작됩니다!
  document.getElementById('timer').innerText = count; // 화면에 10 표시
  
  countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      document.getElementById('timer').innerText = count;
    } else {
      clearInterval(countdownInterval);
      startActualInterview(); // 0초가 되면 진짜 훈련 시작
    }
  }, 1000);
}

// --- [신규] 진짜 훈련(녹음+타이머) 시작 ---
// 🛡️ [주의] 함수 이름 앞에 반드시 async를 붙여주세요!
async function startActualInterview() { 
  var btn = document.getElementById('mock-timer-btn');
  btn.disabled = false;
  
  audioUrls[currentMockIndex] = null; 
  textResults[currentMockIndex] = '';

  if (isTextOptedIn) mockListenStart();   // 받아 적기 — 녹음 대신(둘 중 하나만)

  if (isRecordOptedIn) {
    try {
      // 🛡️ [핵심 1] 팝업 없이 조용히 매번 '새 마이크 선'을 뽑아옵니다.
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = []; 
      mediaRecorder = new MediaRecorder(mediaStream); // 새 마이크 선에 새 녹음기 장착
      
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        const audioType = audioChunks.length > 0 ? audioChunks[0].type : 'audio/mp4';
        const audioBlob = new Blob(audioChunks, { type: audioType });
        audioUrls[currentMockIndex] = URL.createObjectURL(audioBlob);
      };
      mediaRecorder.start(); // 즉시 시작
    } catch (err) {
      console.error("마이크 연결 실패:", err);
    }
  }
  
  resetStopwatch(); 
  startStopwatch(); // 00:00 부터 시작
  btn.innerText = "■ 답변 완료 (정지)";
  btn.style.backgroundColor = "var(--rose)";
  isTimerRunning = true;
}

// --- 완료 또는 다시하기 버튼 로직 ---
function handleTimerClick() {
  var btn = document.getElementById('mock-timer-btn');
  
  if (isTimerRunning) {
    // 1. [정지] 버튼을 눌렀을 때
    if (isRecordOptedIn && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop(); 
      
      // 🛡️ [핵심 2] 아이폰에게 "나 마이크 진짜 다 썼어! 선 끊어!" 라고 확실히 보고하기
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop()); // 모든 마이크 신호 강제 종료
        mediaStream = null; // 껍데기까지 완벽하게 비워줌
      }
    }
    stopStopwatch();
    if (isTextOptedIn) mockListenStop();   // 아직 확정 안 된 글까지 붙이고 끕니다 (시계를 먼저 멈춰야 «다시 켜는 중» 이 아니라 «받아 적은 답변» 으로 그려짐)
    btn.innerText = "다시 답변하기 (초기화)";
    btn.style.backgroundColor = "var(--ink-3)";
    document.getElementById('mock-next-btn').style.display = "block";
    
    interviewResults[currentMockIndex] = {
      stage: currentMockQuestions[currentMockIndex].stage,
      seconds: secondsElapsed
    };
    
    document.getElementById('mock-next-btn').innerText = (currentMockIndex === currentMockQuestions.length - 1) ? "결과 리포트 보기" : "다음 질문으로";
    
  } else {
    // 2. 타이머가 멈춰있을 때 눌렀다!
    if (btn.innerText === "다시 답변하기 (초기화)") {
      // [다시하기]를 누른 경우
      resetStopwatch();
      document.getElementById('mock-next-btn').style.display = "none";
      
      if (isAutoStart) {
        startCountdown(); // 실전 모드면 다시 5초 카운트다운
      } else {
        // 연습 모드면 다시 대기 상태로
        btn.innerText = "▶ 답변 시작";
        btn.style.backgroundColor = "var(--ink)";
      }
    } else if (btn.innerText === "▶ 답변 시작") {
      // 연습 모드에서 대기하다가 [답변 시작]을 누른 경우
      startActualInterview(); 
    }
  }
}

function nextCustomQuestion() {
  currentMockIndex++;
  if (currentMockIndex >= currentMockQuestions.length) {
    showInterviewResult();
  } else {
    showCurrentQuestion();
  }
}

// 결과 리포트 화면 (아코디언 디자인 적용)
function showInterviewResult() {
  navigateTo('interview-result');
  var container = document.getElementById('result-container'); // [수정] 바뀐 id로 연결
  container.innerHTML = '';
  var totalSeconds = 0;

  interviewResults.forEach((res, idx) => {
    var m = Math.floor(res.seconds / 60);
    var s = res.seconds % 60;
    var timeStr = m > 0 ? `${m}분 ${s}초` : `${s}초`;
    totalSeconds += res.seconds;

    // 아코디언 카드 생성
    var cardHtml = `
      <div class="result-card" onclick="toggleCard(this)">
        <div class="result-card-header">
          <div style="text-align:left;">
            <div style="font-size:12px; color:var(--ink-3); margin-bottom:2px;">${idx+1}단계. ${res.stage}</div>
            <div style="font-weight:bold; color:var(--ink);">⏱️ 답변 시간: ${timeStr}</div>
          </div>
          <div class="arrow">▶</div>
        </div>
        <div class="result-card-body">
          <div style="margin-bottom:12px;">
            <div style="font-size:11px; color:var(--ink); font-weight:bold; margin-bottom:4px;">[질문 내용]</div>
            <div style="font-size:14px; color:var(--ink-2); line-height:1.5; word-break:keep-all;">${currentMockQuestions[idx].text}</div>
          </div>
          ${isTextOptedIn ? `
            <div class="mock-said" style="border-top:1px dashed var(--line); padding-top:12px; margin-top:12px;" onclick="event.stopPropagation()">
              <div style="font-size:11px; color:var(--ink); font-weight:bold; margin-bottom:4px;">[받아 적은 답변]</div>
              <div style="font-size:14px; color:var(--ink-2); line-height:1.6; word-break:keep-all; white-space:pre-wrap;">${(textResults[idx] || '').trim() ? escapeMockText(textResults[idx]) : '<span style="color:var(--ink-3);">받아 적힌 말이 없습니다.</span>'}</div>
            </div>
          ` : ''}
          ${audioUrls[idx] ? `
            <div style="border-top:1px dashed var(--line); padding-top:12px; margin-top:12px;" onclick="event.stopPropagation()">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <button onclick="playGlobalAudio(${idx}, ${idx+1})" style="padding:8px 16px; background:var(--surface-2); color:var(--ink-2); border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">▶ 이 답변 듣기</button>
                <a href="${audioUrls[idx]}" download="면접훈련_${idx+1}.mp4" style="font-size:13px; font-weight:bold; color:var(--ink-3); text-decoration:underline;">📥 파일 저장</a>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });

  var tm = Math.floor(totalSeconds / 60);
  var ts = totalSeconds % 60;
  document.getElementById('result-total-time').innerText = `총 답변 소요 시간: ${tm}분 ${ts}초`;
}

// 스톱워치 코어 로직
function startStopwatch() {
  isTimerRunning = true;
  timerInterval = setInterval(function() {
    secondsElapsed++;
    updateTimerDisplay();
  }, 1000);
}

function stopStopwatch() {
  isTimerRunning = false;
  if(timerInterval) clearInterval(timerInterval);
}

function resetStopwatch() {
  stopStopwatch();
  secondsElapsed = 0;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  var m = Math.floor(secondsElapsed / 60), s = secondsElapsed % 60;
  document.getElementById('timer').innerText = (m < 10 ? '0'+m : m) + ':' + (s < 10 ? '0'+s : s);
}

// 🛡️ [신규] 공용 스피커 재생 함수 (메모리 폭발 방지)
function playGlobalAudio(idx, stageNum) {
  var container = document.getElementById('global-player-container');
  var player = document.getElementById('global-audio-player');
  var title = document.getElementById('global-player-title');

  // 1. 공용 스피커 짠! 하고 나타나게 하기
  container.style.display = 'block';
  title.innerText = "🔊 " + stageNum + "단계 답변 재생 중";

  // 2. 기존 노래 끄고, 누른 버튼의 녹음 파일로 갈아 끼우기
  player.pause();
  player.src = audioUrls[idx];
  
  // 3. 바로 재생 (화면 위로 강제 이동하는 명령어 삭제됨!)
  player.play().catch(function(e) { console.log("재생 대기:", e); });
}

// ── 훈련 중단 — 켜 둔 마이크 · 받아 적기를 끄고 홈으로 ──
function abortMockInterview() {
  try { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); } catch (e) { /* 이미 멈춤 */ }
  if (mediaStream) { try { mediaStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* */ } mediaStream = null; }
  mockListenStop();
  stopStopwatch();
  navigateTo('home');
}

// ── 받아 적기(학생 면접 연습) ──
function mockListenStart() {
  var C = mockListenCtor();
  if (!C) return;
  if (MOCK_LISTEN.restartId) { clearTimeout(MOCK_LISTEN.restartId); MOCK_LISTEN.restartId = null; }
  var rec;
  try { rec = new C(); } catch (e) { MOCK_LISTEN.hint = '음성 인식을 켜지 못했습니다.'; mockListenPaint(); return; }
  rec.lang = 'ko-KR';
  rec.continuous = true;       // 한 마디마다 멈추지 않고 계속
  rec.interimResults = true;   // 확정 전 글도 받아 회색으로 보여 줌
  rec.maxAlternatives = 1;
  var qi = currentMockIndex;   // 어느 질문에 적는 중인가

  rec.onresult = function (ev) {
    var fin = '', tmp = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      var r = ev.results[i];
      var t = (r[0] && r[0].transcript) || '';
      if (r.isFinal) fin += t; else tmp += t;
    }
    if (fin.trim()) mockListenAppend(qi, fin);
    MOCK_LISTEN.interim = tmp;
    MOCK_LISTEN.fails = 0;
    mockListenPaint();
  };
  rec.onerror = function (ev) {
    var kind = (ev && ev.error) || '';
    if (kind === 'not-allowed' || kind === 'service-not-allowed') {
      // 마이크를 막았을 때 — 다시 켜 봐야 소용없으니 끕니다. 시간 재기는 그대로 이어집니다
      MOCK_LISTEN.hint = '마이크 사용이 막혀 받아 적지 못합니다. 주소창의 자물쇠 → 마이크 «허용» 뒤 다시 해 보세요. (아이폰은 설정 → Siri 및 받아쓰기도 켜야 합니다)';
      MOCK_LISTEN.stopped = true;   // onend 에서 다시 켜지 않게
      return;
    }
    if (kind === 'audio-capture') { MOCK_LISTEN.hint = '마이크를 잡지 못했습니다. 다른 앱이 마이크를 쓰고 있지 않은지 봐 주세요.'; MOCK_LISTEN.fails++; return; }
    if (kind === 'network') { MOCK_LISTEN.hint = '인터넷이 끊겨 받아 적지 못하고 있습니다. 이어지면 저절로 다시 적습니다.'; MOCK_LISTEN.fails++; return; }
    // no-speech · aborted 는 흔한 일 — onend 에서 다시 켭니다
  };
  rec.onend = function () {
    // ⚠️ 다른 것으로 갈아 끼운 뒤에 옛것의 onend 가 오면 아무것도 건드리지 않습니다(listen.js 에서 한 번 틀렸던 자리)
    if (MOCK_LISTEN.rec !== rec) return;
    MOCK_LISTEN.on = false;
    MOCK_LISTEN.rec = null;
    if (MOCK_LISTEN.interim.trim()) { mockListenAppend(qi, MOCK_LISTEN.interim); MOCK_LISTEN.interim = ''; }
    // 답변 중이면(시계가 흐르면) 다시 켭니다 — 크롬은 조용하면 몇 초 만에 스스로 멈추기 때문. 잇달아 실패하면 조금 기다렸다가
    if (isTimerRunning && isTextOptedIn && !MOCK_LISTEN.stopped) {
      var wait = MOCK_LISTEN.fails > 2 ? 3000 : 150;
      MOCK_LISTEN.restartId = setTimeout(function () { MOCK_LISTEN.restartId = null; if (isTimerRunning && !MOCK_LISTEN.on) mockListenStart(); }, wait);
    }
    mockListenPaint();
  };
  try {
    rec.start();
    MOCK_LISTEN.rec = rec;
    MOCK_LISTEN.on = true;
    MOCK_LISTEN.stopped = false;
    if (MOCK_LISTEN.hint.indexOf('인터넷') === -1) MOCK_LISTEN.hint = '';
  } catch (e) {
    // 이미 도는 중에 또 start 하면 터집니다 — 그냥 둡니다
  }
  mockListenPaint();
}

function mockListenStop() {
  if (MOCK_LISTEN.restartId) { clearTimeout(MOCK_LISTEN.restartId); MOCK_LISTEN.restartId = null; }
  var rec = MOCK_LISTEN.rec;
  MOCK_LISTEN.rec = null;
  MOCK_LISTEN.on = false;
  if (MOCK_LISTEN.interim.trim()) { mockListenAppend(currentMockIndex, MOCK_LISTEN.interim); MOCK_LISTEN.interim = ''; }
  if (rec) { try { rec.abort(); } catch (e) { /* */ } }   // abort — 남은 결과를 또 보내지 않게(위에서 이미 붙였음)
  mockListenPaint();
}

function mockListenAppend(qi, text) {
  var t = String(text || '').trim();
  if (!t) return;
  var cur = textResults[qi] || '';
  textResults[qi] = cur ? (cur + ' ' + t) : t;
}

function escapeMockText(t) {
  return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 받아 적기 칸 그리기 — 받아 적기를 골랐을 때만 보입니다
function mockListenPaint() {
  var box = document.getElementById('mock-live');
  if (!box) return;
  box.hidden = !isTextOptedIn;
  if (!isTextOptedIn) return;
  var state = document.getElementById('mock-live-state');
  var text = document.getElementById('mock-live-text');
  var said = textResults[currentMockIndex] || '';
  if (MOCK_LISTEN.hint) state.textContent = '⚠️ ' + MOCK_LISTEN.hint;
  else if (MOCK_LISTEN.on) state.textContent = '🎙️ 받아 적는 중… (말하면 글이 나타납니다)';
  else if (isTimerRunning) state.textContent = '받아 적기를 다시 켜는 중…';
  else if (said) state.textContent = '📝 받아 적은 답변';
  else state.textContent = '📝 «답변 시작» 을 누르고 말하면 여기에 받아 적힙니다';
  var html = escapeMockText(said);
  if (MOCK_LISTEN.interim.trim()) html += (html ? ' ' : '') + '<span class="interim">' + escapeMockText(MOCK_LISTEN.interim) + '</span>';
  text.innerHTML = html || (MOCK_LISTEN.on ? '<span class="empty">…</span>' : '');
}
