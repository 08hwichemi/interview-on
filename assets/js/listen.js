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
//   · (2026-10-23) 회색 글 없이 **들리는 대로 바로 검은 글**, 한 번 적은 글은 지우지 않습니다 — stt-keep.js 의 sttKeepResult.
//     크롬이 확정하며 단어를 바꾸거나 빼 버려 말한 것이 사라지던 것을 막으려고(선생님 말씀: «틀린 것도 다 적혀 있는 게 좋아»)
//   · 마이크를 막았거나 인터넷이 끊기면 받아 적기를 끄고 까닭을 적습니다. 면접은 그대로 이어집니다
//
// 이 파일은 teacher-app.js 의 answers · qIndex · seconds · ticking · liveInterview 를 그대로 씁니다.
// teacher-app.js 는 시계 단추를 그릴 때(paintTimerButton) listenSync() 를, 질문을 바꿀 때 listenShowQuestion() 을 부릅니다.

var LISTEN = {
  rec: null,        // SpeechRecognition 객체
  on: false,        // 지금 듣고 있는가
  qi: -1,           // 어느 질문에 적는 중인가 (answers 의 번호)
  interim: '',      // (예전) 아직 확정 안 된 글 — 2026-10-23 부터는 늘 비어 있습니다(바로 적으므로)
  keep: null,       // 듣기 한 번 동안 칸마다 이미 적은 글(stt-keep.js)
  hint: '',         // 화면에 적을 까닭 («마이크를 허용해 주세요» 등)
  restartId: null,
  fails: 0,         // 잇달아 실패한 횟수 — 많으면 조금 천천히 다시 켭니다
  gap: false,       // 답변 중인데 끊겨서 다시 켜는 사이인가 — 이때 말은 안 적힙니다(화면에 빨갛게)
  gaps: 0,          // 이 면접에서 끊겼다 다시 켠 횟수
  viaTrack: false,  // 녹음 중인 마이크 선(고른 마이크)으로 듣는 중인가
  trackBad: false   // 마이크 선 넘기기가 이 크롬에서 안 됨 — 기본 마이크로
};

// 2026-10-14 선생님: «녹음은 꽂은 마이크로 되는데 받아 적기는 노트북 마이크로 되는 것 같다(마이크를 가려도 적힌다)».
//   크롬의 음성 인식은 마이크를 고르는 칸이 없고 늘 윈도우 기본 마이크를 씁니다. 대신 최근 크롬은 start(마이크 선) 으로
//   «이 소리를 들어라» 하고 넘길 수 있어서, 녹음(record.js)이 고른 마이크로 켜져 있으면 그 선을 넘깁니다.
//   모르는 크롬이면(오류 · audio-capture) 전처럼 기본 마이크로. 녹음을 꺼 두면 넘길 선이 없어 기본 마이크입니다.
function listenTrack() {
  if (LISTEN.trackBad) return null;
  if (typeof REC === 'undefined' || !REC.on || !REC.stream) return null;
  try { var t = REC.stream.getAudioTracks ? REC.stream.getAudioTracks()[0] : null; return (t && t.readyState !== 'ended') ? t : null; }
  catch (e) { return null; }
}

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

// 지금 듣고 있어야 하는가 — 켜 둠 · 답변 시계가 흐름 · 진행 화면
function listenShould() {
  var run = document.getElementById('view-run');
  return listenWanted() && !!listenCtor() &&
         typeof answering !== 'undefined' && answering &&
         typeof liveInterview !== 'undefined' && liveInterview &&
         run && !run.hidden;
}

// «원하는 상태 · 답변 시계 · 화면» 을 보고 켜거나 끕니다. 시계 단추를 누를 때마다, 질문을 넘길 때마다 부릅니다.
function listenSync() {
  var should = listenShould();
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
  rec.interimResults = true;    // 확정 전 글도 받습니다 — 받는 대로 바로 적습니다(stt-keep.js)
  rec.maxAlternatives = 1;
  LISTEN.qi = (typeof qIndex === 'number') ? qIndex : 0;
  var keep = { seen: {} };      // 이 듣기에서 칸마다 이미 적은 글 — 새로 켤 때마다 새로(크롬도 칸 번호를 0부터 다시 셉니다)

  rec.onstart = function () { if (LISTEN.rec === rec) { LISTEN.gap = false; listenPaint(); } };   // 서버가 다시 듣기 시작 — 빨간 표시 끔
  rec.onresult = function (ev) {
    if (LISTEN.rec !== rec) return;   // 이미 멈춘(갈아 끼운) 듣기에서 늦게 온 것 — 두 번 붙지 않게
    LISTEN.gap = false;
    // 확정을 기다리지 않고, 새로 늘어난 글만 바로 붙입니다. 이미 적은 글은 크롬이 고쳐도 그대로 둡니다
    var add = sttKeepResult(keep, ev);
    if (add) listenAppend(LISTEN.qi, add);
    LISTEN.interim = '';
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
    if (kind === 'audio-capture') {
      if (LISTEN.viaTrack) {   // onend 에서 기본 마이크로 다시 켬
        LISTEN.trackBad = true; LISTEN.hint = '이 크롬은 고른 마이크를 받아 적기에 못 넘깁니다 — 기본 마이크로 받아 적습니다.';
        if (typeof recPaint === 'function') recPaint();   // 마이크 줄 안내도 바로
        return;
      }
      LISTEN.hint = '마이크를 찾지 못했습니다. 노트북 마이크가 켜져 있는지 봐 주세요.'; return;
    }
    if (kind === 'network') { LISTEN.hint = '인터넷이 끊겨 받아 적지 못하고 있습니다. 이어지면 저절로 다시 적습니다.'; LISTEN.fails++; return; }
    // no-speech · aborted 는 흔한 일 — onend 에서 다시 켭니다
  };
  rec.onend = function () {
    // ⚠️ 이미 다른 것으로 갈아 끼운 뒤에 옛것의 onend 가 오면 아무것도 건드리면 안 됩니다 —
    //    처음엔 on=false 를 먼저 놓아서, 새것이 듣는 중인데 «멈춤» 으로 보였습니다
    if (LISTEN.rec !== rec) return;
    LISTEN.on = false;
    LISTEN.rec = null;
    // (예전엔 여기서 확정 안 된 글을 붙였습니다 — 이제는 받는 대로 이미 붙어 있습니다)
    // 켜 둔 상태면 다시 켭니다. 잇달아 실패하면 조금 기다렸다가
    // (2026-10-14 핫스팟 면접에서 «잘 되다가 멈춤» — 3초 쉬던 것을 1초로. 쉬는 동안의 말은 사라지니 짧게.
    //  다시 켜는 것은 크롬 안의 일이라 우리 서버 사용량과는 상관없습니다)
    // (2026-10-23) 0.15초 쉬던 것도 없앴습니다 — 바로 다시 켜고, 크롬이 아직 못 받으면 아래 listenStart 가 0.1초 뒤 다시 해 봅니다
    var wait = LISTEN.fails > 2 ? 1000 : 0;
    if (listenShould()) { LISTEN.gap = true; LISTEN.gaps++; }   // 답변 중인데 끊김 — 다시 켜질 때까지 빨갛게
    LISTEN.restartId = setTimeout(function () { LISTEN.restartId = null; listenSync(); }, wait);
    listenPaint();
  };
  var track = listenTrack();
  var started = false;
  if (track) {
    try { rec.start(track); started = true; LISTEN.viaTrack = true; }   // 고른 마이크 선으로
    catch (e) { LISTEN.trackBad = true; LISTEN.viaTrack = false; }      // 모르는 크롬 — 기본 마이크로
  }
  if (!started) {
    try { rec.start(); started = true; LISTEN.viaTrack = false; }
    catch (e) {
      // 이미 도는 중이거나, 막 멈춘 직후라 크롬이 아직 못 받을 때 터집니다 — 답변 중이면 0.1초 뒤 다시 해 봅니다(말이 덜 빠지게)
      if (listenShould() && !LISTEN.restartId) LISTEN.restartId = setTimeout(function () { LISTEN.restartId = null; listenSync(); }, 100);
    }
  }
  if (started) {
    LISTEN.rec = rec;
    LISTEN.on = true;
    if (LISTEN.hint.indexOf('인터넷') === -1 && LISTEN.hint.indexOf('못 넘깁니다') === -1) LISTEN.hint = '';
    if (typeof recPaint === 'function') recPaint();   // 마이크 줄 안내(«받아 적기도 이 마이크로») 바로
  }
}

function listenStop() {
  if (LISTEN.restartId) { clearTimeout(LISTEN.restartId); LISTEN.restartId = null; }
  var rec = LISTEN.rec;
  LISTEN.rec = null;
  LISTEN.on = false;
  LISTEN.interim = '';
  if (rec) { try { rec.abort(); } catch (e) { /* */ } }   // abort — 남은 결과를 또 보내지 않게(받은 것은 이미 붙어 있음)
}

// 저장하기 직전에 부릅니다(teacher-app.js saveAnswer): 아직 확정 안 된 글까지 그 질문에 붙여 두고
// 듣기를 한 번 끊습니다 — 안 끊으면 같은 말이 조금 뒤 «확정» 으로 또 와서 두 번 붙습니다.
// 끊긴 듣기는 질문을 그릴 때(listenShowQuestion) 나 아래 예비 시계가 다시 켭니다.
// ⚠️ 2026-10-23 부터는 끊지 않습니다. 받는 대로 이미 붙어 있어 두 번 붙을 일이 없고,
//    끊었다 다시 켜는 0.25초 사이의 말이 빠지기 때문입니다(«손실 없게» — 선생님 말씀). 이름만 남겨 둡니다.
function listenCut(i) { /* 할 일 없음 */ }

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
  var gap = LISTEN.gap && !LISTEN.on && listenShould();   // 답변 중인데 다시 켜는 사이

  box.setAttribute('data-on', LISTEN.on ? 'yes' : gap ? 'gap' : 'no');
  if (btn) {
    btn.hidden = !has;
    btn.textContent = wanted ? '🎤 받아 적기 끄기' : '🎤 받아 적기 켜기';
    btn.setAttribute('aria-pressed', wanted);
  }
  if (st) {
    st.textContent = !has ? '(이 브라우저에는 음성 인식이 없습니다)'
      : !wanted ? '받아 적기 꺼짐'
      : LISTEN.on ? ('● 받아 적는 중' + (LISTEN.viaTrack && typeof REC !== 'undefined' && REC.micLabel ? ' (' + REC.micLabel + ')' : ''))
      : gap ? '⚠️ 끊겨서 다시 켜는 중 — 지금 말은 안 적힙니다'
      : '«답변 시작» 을 누르면 받아 적습니다';
  }
  if (hint) {
    hint.textContent = !has
      ? '크롬(또는 엣지)에서 열면 학생이 말하는 것을 글로 받아 적을 수 있습니다. 소리는 구글 서버를 거쳐 글자만 돌아옵니다.'
      : LISTEN.hint || (LISTEN.gaps >= 3 && typeof liveInterview !== 'undefined' && liveInterview
          ? '이 면접에서 ' + LISTEN.gaps + '번 끊겼다 다시 켰습니다. 인터넷이 불안하면 잦습니다 — 녹음 파일로 보완하세요.' : '');
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
