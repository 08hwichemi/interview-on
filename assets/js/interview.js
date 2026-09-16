// 9. 실전 말하기 훈련 (로컬 스토리지 + 스톱워치)
var currentMockIndex = 0;
var secondsElapsed = 0;
var isTimerRunning = false;
var interviewResults = []; // 결과 기록용 배열

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
  
  // [수정] 바로 넘어가지 않고 팝업창을 띄웁니다.
  document.getElementById('recording-modal').style.display = 'flex';
}

// --- [신규] 팝업창 설정 완료 로직 ---
async function confirmSettings() {
  var recordVal = document.getElementById('modal-record-select').value;
  var modeVal = document.getElementById('modal-mode-select').value;

  document.getElementById('recording-modal').style.display = 'none';

  isRecordOptedIn = (recordVal === 'yes');
  isAutoStart = (modeVal === 'auto'); // 실전 모드인지 연습 모드인지 저장

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

  if (isAutoStart) {
    // 1. 실전 모드: 바로 5초 카운트다운 시작
    startCountdown(); 
  } else {
    // 2. 연습 모드: 타이머 0초로 대기하고 버튼 누를 수 있게 열어둠
    document.getElementById('timer').innerText = "00:00";
    btn.innerText = "▶ 답변 시작";
    btn.style.backgroundColor = "#1a4fa0"; 
    btn.disabled = false; 
  }
}

// --- [신규] 5초 카운트다운 로직 ---
function startCountdown() {
  stopStopwatch(); // 기존 타이머 멈춤
  if (countdownInterval) clearInterval(countdownInterval);
  
  var btn = document.getElementById('mock-timer-btn');
  btn.innerText = "답변 준비 중...";
  btn.style.backgroundColor = "#94a3b8"; // 회색으로 잠금
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
  btn.style.backgroundColor = "#dc2626";
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
    btn.innerText = "다시 답변하기 (초기화)";
    btn.style.backgroundColor = "#64748b";
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
        btn.style.backgroundColor = "#1a4fa0";
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
            <div style="font-size:12px; color:#64748b; margin-bottom:2px;">${idx+1}단계. ${res.stage}</div>
            <div style="font-weight:bold; color:#1e293b;">⏱️ 답변 시간: ${timeStr}</div>
          </div>
          <div class="arrow">▶</div>
        </div>
        <div class="result-card-body">
          <div style="margin-bottom:12px;">
            <div style="font-size:11px; color:#1a4fa0; font-weight:bold; margin-bottom:4px;">[질문 내용]</div>
            <div style="font-size:14px; color:#334155; line-height:1.5; word-break:keep-all;">${currentMockQuestions[idx].text}</div>
          </div>
          ${audioUrls[idx] ? `
            <div style="border-top:1px dashed #e2e8f0; padding-top:12px; margin-top:12px;" onclick="event.stopPropagation()">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <button onclick="playGlobalAudio(${idx}, ${idx+1})" style="padding:8px 16px; background:#e0f2fe; color:#0369a1; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">▶ 이 답변 듣기</button>
                <a href="${audioUrls[idx]}" download="면접훈련_${idx+1}.mp4" style="font-size:13px; font-weight:bold; color:#64748b; text-decoration:underline;">📥 파일 저장</a>
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
