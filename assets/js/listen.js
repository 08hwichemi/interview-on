// 받아 적기 — 학생이 말하는 것을 크롬에 들어 있는 음성 인식으로 글로 적습니다.
//
// 2026-10-10 선생님 말씀: 면접은 «무슨 내용을 말했나» 를 정리해서 평가하는데,
// 1~2분 답변이 쉴 새 없이 이어져 들으면서 단추를 찾아 누르면 내용을 놓친다.
// 그래서 면접 중에는 받아 적기만 켜 두고, 평가는 마무리 화면에서 받아 적은 글을 보며 합니다.
//
// 어떻게 도는가
//   · 크롬(과 엣지)의 SpeechRecognition — 공짜, 설치할 것 없음. 소리는 **구글 서버**를 거쳐 글자만 돌아옵니다
//     (선생님이 2026-10-10 «서버 거쳐도 된다» 고 하심). 우리 서버에는 글만 남습니다(interview_answers.transcript)
//   · 파이어폭스·삼성 브라우저에는 없습니다 → 단추를 숨기고 «크롬에서 열면 됩니다» 안내만
//   · **«답변 시작» 을 누른 동안만** 받아 적습니다(toggleAnswer). 선생님이 질문을 읽는 소리는 안 적힙니다
//   · 크롬은 조용하면 몇 초 만에 스스로 멈춥니다(onend). 켜 둔 상태면 바로 다시 켭니다
//   · 질문을 넘기면 그때까지 받아 적은 글은 그 질문에, 그 뒤는 새 질문에 붙습니다
//   · 마이크를 막았거나 인터넷이 끊기면 받아 적기를 끄고 까닭을 적습니다. 면접은 그대로 이어집니다
//
// 이 파일은 teacher-app.js 의 answers · qIndex · seconds · ticking · liveInterview 를 그대로 씁니다.
// teacher-app.js 는 시계 단추를 그릴 때(paintTimerButton) listenSync() 를, 질문을 바꿀 때 listenShowQuestion() 을 부릅니다.

var LISTEN = {
  rec: null,        // SpeechRecognition 객체
  on: false,        // 지금 듣고 있는가
  qi: -1,           // 어느 질문에 적는 중인가 (answers 의 번호)
  interim: '',      // 아직 확정 안 된 글(회색으로 보여 줌)
  hint: '',         // 화면에 적을 까닭 («마이크를 허용해 주세요» 등)
  restartId: null,
  fails: 0          // 잇달아 실패한 횟수 — 많으면 더 천천히 다시 켭니다
};

function listenCtor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

// 선생님이 켜 두었는가. 처음은 켜 둠(이 기능을 보고 만든 것이라).
function listenWanted() {
  try { return localStorage.getItem('listenOn') !== '0'; } catch (e) { return true; }
}
function toggleListen() {
  var next = !listenWanted();
  try { localStorage.setItem('listenOn', next ? '1' : '0'); } catch (e) { /* 못 적어도 이번만은 됨 */ }
  LISTEN.hint = '';
  listenSync();
}

// «원하는 상태 · 답변 시계 · 화면» 을 보고 켜거나 끕니다. 시계 단추를 누를 때마다, 질문을 넘길 때마다 부릅니다.
function listenSync() {
  var run = document.getElementById('view-run');
  var should = listenWanted() && !!listenCtor() &&
               typeof answering !== 'undefined' && answering &&
               typeof liveInterview !== 'undefined' && liveInterview &&
               run && !run.hidden;
  if (should && !LISTEN.on) listenStart();
  else if (!should && LISTEN.on) listenStop();
  listenPaint();
}

function listenStart() {
  var C = listenCtor();
  if (!C) return;
  if (LISTEN.restartId) { clearTimeout(LISTEN.restartId); LISTEN.restartId = null; }
  var rec;
  try { rec = new C(); } catch (e) { LISTEN.hint = '음성 인식을 켜지 못했습니다.'; return; }
  rec.lang = 'ko-KR';
  rec.continuous = true;        // 한 마디마다 멈추지 않고 계속
  rec.interimResults = true;    // 확정 전 글도 받아 회색으로 보여 줌
  rec.maxAlternatives = 1;
  LISTEN.qi = (typeof qIndex === 'number') ? qIndex : 0;

  rec.onresult = function (ev) {
    var fin = '', tmp = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      var r = ev.results[i];
      var t = (r[0] && r[0].transcript) || '';
      if (r.isFinal) fin += t; else tmp += t;
    }
    if (fin.trim()) listenAppend(LISTEN.qi, fin);
    LISTEN.interim = tmp;
    LISTEN.fails = 0;
    listenPaint();
  };
  rec.onerror = function (ev) {
    var kind = (ev && ev.error) || '';
    // 마이크를 막았을 때 — 다시 켜 봐야 소용없으니 끄고 까닭을 적습니다
    if (kind === 'not-allowed' || kind === 'service-not-allowed') {
      LISTEN.hint = '마이크 사용이 막혀 있습니다. 주소창 왼쪽 자물쇠 → 마이크 «허용» 뒤 다시 켜 주세요.';
      try { localStorage.setItem('listenOn', '0'); } catch (e) { /* */ }
      return;
    }
    if (kind === 'audio-capture') { LISTEN.hint = '마이크를 찾지 못했습니다. 노트북 마이크가 켜져 있는지 봐 주세요.'; return; }
    if (kind === 'network') { LISTEN.hint = '인터넷이 끊겨 받아 적지 못하고 있습니다. 이어지면 저절로 다시 적습니다.'; LISTEN.fails++; return; }
    // no-speech · aborted 는 흔한 일 — onend 에서 다시 켭니다
  };
  rec.onend = function () {
    // ⚠️ 이미 다른 것으로 갈아 끼운 뒤에 옛것의 onend 가 오면 아무것도 건드리면 안 됩니다 —
    //    처음엔 on=false 를 먼저 놓아서, 새것이 듣는 중인데 «멈춤» 으로 보였습니다
    if (LISTEN.rec !== rec) return;
    LISTEN.on = false;
    LISTEN.rec = null;
    // 아직 확정 안 된 글이 남아 있으면 버리지 않고 붙입니다(크롬이 스스로 멈출 때 생김)
    if (LISTEN.interim.trim()) { listenAppend(LISTEN.qi, LISTEN.interim); LISTEN.interim = ''; }
    // 켜 둔 상태면 다시 켭니다. 잇달아 실패하면 조금 기다렸다가
    var wait = LISTEN.fails > 2 ? 3000 : 150;
    LISTEN.restartId = setTimeout(function () { LISTEN.restartId = null; listenSync(); }, wait);
    listenPaint();
  };
  try {
    rec.start();
    LISTEN.rec = rec;
    LISTEN.on = true;
    if (LISTEN.hint.indexOf('인터넷') === -1) LISTEN.hint = '';
  } catch (e) {
    // 이미 도는 중에 또 start 하면 터집니다 — 그냥 둡니다
  }
}

function listenStop() {
  if (LISTEN.restartId) { clearTimeout(LISTEN.restartId); LISTEN.restartId = null; }
  var rec = LISTEN.rec;
  LISTEN.rec = null;
  LISTEN.on = false;
  if (LISTEN.interim.trim()) { listenAppend(LISTEN.qi, LISTEN.interim); LISTEN.interim = ''; }
  if (rec) { try { rec.abort(); } catch (e) { /* */ } }   // abort — 남은 결과를 또 보내지 않게(위에서 이미 붙였음)
}

// 저장하기 직전에 부릅니다(teacher-app.js saveAnswer): 아직 확정 안 된 글까지 그 질문에 붙여 두고
// 듣기를 한 번 끊습니다 — 안 끊으면 같은 말이 조금 뒤 «확정» 으로 또 와서 두 번 붙습니다.
// 끊긴 듣기는 질문을 그릴 때(listenShowQuestion) 나 아래 예비 시계가 다시 켭니다.
function listenCut(i) {
  if (!LISTEN.on || i !== LISTEN.qi) return;
  listenStop();
  setTimeout(listenSync, 250);
}

// 받아 적은 글을 그 질문에 붙입니다. 띄어쓰기 하나로 잇습니다.
function listenAppend(i, text) {
  if (typeof answers === 'undefined' || !answers[i]) return;
  var t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return;
  answers[i].transcript = (answers[i].transcript ? answers[i].transcript + ' ' : '') + t;
  if (typeof renderRailProgress === 'function') renderRailProgress();
}

// 질문을 넘기면: 지금까지 것은 지난 질문에 두고, 새 질문에 적기 시작합니다.
function listenShowQuestion() {
  if (typeof qIndex !== 'number') return;
  if (LISTEN.on && LISTEN.qi !== qIndex) {
    // 아직 확정 안 된 글은 지난 질문 것입니다 — 버리지 않고 붙인 뒤 새로 켭니다
    listenStop();
    LISTEN.qi = qIndex;
  }
  LISTEN.qi = qIndex;
  listenSync();
}

function listenPaint() {
  var box = document.getElementById('livebox');
  if (!box) return;
  var btn = document.getElementById('btn-stt');
  var st = document.getElementById('live-state');
  var txt = document.getElementById('live-text');
  var hint = document.getElementById('live-hint');
  var has = !!listenCtor();
  var wanted = listenWanted();

  box.setAttribute('data-on', LISTEN.on ? 'yes' : 'no');
  if (btn) {
    btn.hidden = !has;
    btn.textContent = wanted ? '🎤 받아 적기 끄기' : '🎤 받아 적기 켜기';
    btn.setAttribute('aria-pressed', wanted);
  }
  if (st) {
    st.textContent = !has ? '(이 브라우저에는 음성 인식이 없습니다)'
      : !wanted ? '받아 적기 꺼짐'
      : LISTEN.on ? '● 받아 적는 중'
      : '«답변 시작» 을 누르면 받아 적습니다';
  }
  if (hint) {
    hint.textContent = !has
      ? '크롬(또는 엣지)에서 열면 학생이 말하는 것을 글로 받아 적을 수 있습니다. 소리는 구글 서버를 거쳐 글자만 돌아옵니다.'
      : LISTEN.hint;
    hint.hidden = !hint.textContent;
  }
  if (txt) {
    var a = (typeof answers !== 'undefined' && typeof qIndex === 'number') ? answers[qIndex] : null;
    var fin = (a && a.transcript) || '';
    var tmp = LISTEN.on ? LISTEN.interim : '';
    if (!fin && !tmp) {
      txt.innerHTML = '<span class="empty">' + (wanted && has ? '학생이 말하면 여기에 적힙니다.' : '') + '</span>';
    } else {
      txt.innerHTML = esc(fin) + (tmp ? ' <span class="interim">' + esc(tmp) + '</span>' : '');
      txt.scrollTop = txt.scrollHeight;   // 늘 마지막 줄이 보이게
    }
  }
}
