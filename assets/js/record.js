// 면접 녹음 — 노트북 안에서만 (2026-10-14)
//
// 선생님 말씀(10-14 타학교 면접 뒤): 핫스팟이 흔들려 받아 적기가 멈추고 긴 문장이 씹혔다 → «녹음 파일도 하고 싶어,
// 내가 내려받아 학생 주면 되는 거지».
//
// 어떻게 도는가
//   · 폰(안드로이드)과 달리 **컴퓨터 크롬 · 엣지는 녹음과 받아 적기를 동시에** 켤 수 있습니다(2026-10-13 폰에서만 안 됐음)
//   · 진행 화면에서 «면접 시작»(시계)을 처음 누를 때 켜지고, «면접 끝내기» 또는 «목록으로» 에서 멈추며
//     **노트북의 다운로드 폴더에 한 파일**(면접녹음_학생_날짜시각.webm)로 떨어집니다. «일시정지» 해도 녹음은 이어집니다
//   · 인터넷을 안 거치고 서버에도 안 올립니다(Supabase 용량 0). 받아 적기가 끊겨도 녹음은 안 끊깁니다
//   · 목소리용으로 낮춰(32kbps) 15분이 4MB 쯤. 3초보다 짧으면 파일을 안 만듭니다
//   · 마이크를 못 잡으면(허용 안 함 · 다른 앱이 쥠) 녹음만 건너뛰고 받아 적기는 그대로
//   · «따라 하기»(?guide)에서는 마이크를 안 쓰니 단추를 숨깁니다
//   · 켜 둘지는 이 브라우저에 기억합니다(localStorage recOn, 처음은 켬)
// ⚠️ 탭을 닫거나 노트북이 잠들면 그때까지 것은 잃습니다 — 브라우저는 닫히는 순간 파일을 못 떨어뜨립니다

//
// 2026-10-14 저녁 선생님: «마이크를 꽂아 봤는데 마이크로 녹음되는 건지 노트북 마이크로 들어가는 건지 모르겠어»
//   → 진행 화면에 **마이크 고르기 · 지금 쓰는 마이크 이름 · 소리 막대**(말하면 움직임)를 두었습니다.
//     고른 마이크는 이 브라우저에 기억(localStorage micId). 녹음 중에 바꾸면 지금까지 것을 파일로 떨어뜨리고 새 마이크로 이어 녹음(파일 둘).
//   ⚠️ 받아 적기(크롬 → 구글)는 여기서 고른 마이크가 아니라 **윈도우 기본 마이크**를 씁니다 — 크롬의 음성 인식은 마이크를 고르는 길이 없습니다.
//     꽂은 마이크를 받아 적기에도 쓰려면 윈도우 소리 설정에서 입력 장치를 그 마이크로 바꿔야 합니다(화면에 안내)

var REC = { rec: null, stream: null, on: false, startedAt: 0, who: '', hint: '', tickId: null,
            mics: [], micLabel: '', audio: null, analyser: null, rafId: null };

function recMicId() { try { return localStorage.getItem('micId') || ''; } catch (e) { return ''; } }

// 마이크 목록 — 이름은 한 번 «허용» 한 뒤에야 보입니다
async function recListMics() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    var all = await navigator.mediaDevices.enumerateDevices();
    REC.mics = all.filter(function (d) { return d.kind === 'audioinput'; });
  } catch (e) { REC.mics = []; }
  recPaint();
}
if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', function () { recListMics(); });   // 꽂거나 빼면 목록 새로
}

// 마이크 고르기 칸에서 골랐을 때
function recPickMic(id) {
  try { if (id) localStorage.setItem('micId', id); else localStorage.removeItem('micId'); } catch (e) { /* */ }
  if (REC.on) {
    // 녹음 중 — 지금까지 것은 파일로, 새 마이크로 이어서(파일이 둘이 됩니다)
    recStop();
    if (typeof toast === 'function') toast('마이크를 바꿔 새 파일로 이어 녹음합니다. 지금까지 것은 먼저 내려받았습니다.');
    recStart();
  } else recPaint();
}

// 소리 막대 — 마이크로 소리가 들어오면 움직입니다(«이 마이크가 맞나» 를 눈으로)
function recMeterStart(stream) {
  recMeterStop();
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    var src = ctx.createMediaStreamSource(stream);
    var an = ctx.createAnalyser(); an.fftSize = 512;
    src.connect(an);
    REC.audio = ctx; REC.analyser = an;
    var buf = new Uint8Array(an.fftSize);
    (function loop() {
      if (!REC.analyser) return;
      an.getByteTimeDomainData(buf);
      var peak = 0;
      for (var i = 0; i < buf.length; i++) { var v = Math.abs(buf[i] - 128); if (v > peak) peak = v; }
      var bar = document.querySelector('#rec-level .bar');
      // 말소리는 보통 128 에서 5~30 쯤 흔들립니다 — 그 폭이 막대 전체가 되게 4배 (처음엔 1.6배라 «잘 안 움직인다» 하셨음)
      if (bar) bar.style.width = Math.min(100, Math.round(peak / 128 * 100 * 4)) + '%';
      REC.rafId = requestAnimationFrame(loop);
    })();
  } catch (e) { /* 가짜 마이크(시험) 등 — 막대 없이 녹음만 */ }
}
function recMeterStop() {
  if (REC.rafId) { cancelAnimationFrame(REC.rafId); REC.rafId = null; }
  REC.analyser = null;
  if (REC.audio) { try { REC.audio.close(); } catch (e) { /* */ } REC.audio = null; }
  var bar = document.querySelector('#rec-level .bar');
  if (bar) bar.style.width = '0';
}

function recWanted() {
  try { return localStorage.getItem('recOn') !== '0'; } catch (e) { return true; }
}
function recSupported() {
  if (/[?&]guide(=|&|$)/.test(location.search)) return false;   // 연습 모드 — 마이크 안 씀
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
function toggleRec() {
  var next = !recWanted();
  try { localStorage.setItem('recOn', next ? '1' : '0'); } catch (e) { /* 못 적어도 이번만은 됨 */ }
  REC.hint = '';
  if (!next && REC.on) recStop();                                     // 끄면 지금까지 것을 파일로
  else if (next && typeof ticking !== 'undefined' && ticking) recStart();   // 면접 중에 켜면 바로
  recPaint();
}

function recMime() {
  var tries = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
  for (var i = 0; i < tries.length; i++) {
    if (!tries[i] || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(tries[i]))) return tries[i];
  }
  return '';
}

// «면접 시작»(시계)을 누를 때 teacher-app.js 가 부릅니다. 이미 켜져 있으면 그대로.
async function recStart() {
  if (REC.on || !recWanted() || !recSupported()) return;
  if (typeof liveInterview !== 'undefined' && !liveInterview) return;   // 지난 회차를 고치는 중
  var stream;
  var micId = recMicId();
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: micId ? { deviceId: { exact: micId } } : true });
    } catch (e1) {
      if (!micId) throw e1;
      // 골라 둔 마이크가 지금 없음(빼 두었거나 다른 컴퓨터) — 기본 마이크로
      try { localStorage.removeItem('micId'); } catch (e) { /* */ }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      REC.hint = '골라 둔 마이크를 찾지 못해 기본 마이크로 녹음합니다.';
    }
  } catch (e) {
    REC.hint = '마이크를 쓸 수 없어 녹음은 못 합니다(받아 적기는 그대로). 주소창 자물쇠 → 마이크 «허용» 을 봐 주세요.';
    recPaint();
    return;
  }
  if (REC.on) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }   // 기다리는 사이 다른 곳에서 켜짐
  var opt = { audioBitsPerSecond: 32000 };   // 목소리용 — 15분에 4MB 쯤
  var mime = recMime();
  if (mime) opt.mimeType = mime;
  var r;
  try { r = new MediaRecorder(stream, opt); }
  catch (e) {
    try { r = new MediaRecorder(stream); } catch (e2) { stream.getTracks().forEach(function (t) { t.stop(); }); REC.hint = '이 브라우저는 녹음을 못 합니다.'; recPaint(); return; }
  }
  // ⚠️ 조각 · 시작 시각 · 학생 이름은 **이 녹음기 것**으로 닫아 둡니다 — 마이크를 바꾸면 옛 녹음기의 마지막 조각과 onstop 이
  //    새 녹음기를 만든 뒤에 오는데, 공용 칸(REC.chunks)에 두니 새 녹음기가 비워 버려 파일이 안 떨어졌습니다(검사에서 잡음)
  var chunks = [], startedAt = Date.now();
  var who = (typeof target !== 'undefined' && target && typeof whoLabel === 'function') ? whoLabel(target) : '학생';
  r.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
  r.onstop = function () { recFinish(chunks, startedAt, who); };
  r.onerror = function () { REC.hint = '녹음이 중간에 멈췄습니다. 지금까지 것은 파일로 남깁니다.'; recStop(); };
  try { r.start(10000); }   // 10초마다 조각을 받아 둡니다 — 중간에 멈춰도 그때까지 것은 남게
  catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); REC.hint = '녹음을 켜지 못했습니다.'; recPaint(); return; }
  REC.rec = r; REC.stream = stream; REC.on = true; REC.startedAt = startedAt;
  REC.who = who;
  if (REC.hint.indexOf('골라 둔 마이크') === -1) REC.hint = '';
  try { var tr = stream.getAudioTracks ? stream.getAudioTracks()[0] : null; REC.micLabel = (tr && tr.label) || ''; } catch (e) { REC.micLabel = ''; }
  if (REC.tickId) clearInterval(REC.tickId);
  REC.tickId = setInterval(recPaint, 1000);
  recMeterStart(stream);
  recListMics();   // 허용한 뒤라 이름이 보입니다
  recPaint();
}

// 멈추고 파일로 — «면접 끝내기» · «목록으로» · 녹음 끄기
function recStop() {
  if (!REC.on) return;
  REC.on = false;
  if (REC.tickId) { clearInterval(REC.tickId); REC.tickId = null; }
  var r = REC.rec, s = REC.stream;
  REC.rec = null; REC.stream = null; REC.micLabel = '';
  recMeterStop();
  try { if (r && r.state !== 'inactive') r.stop(); } catch (e) { /* 이미 멈춘 녹음기 */ }   // 멈추면 onstop → recFinish 가 파일을 만듭니다
  if (s) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* */ } }
  recPaint();
}

function recFinish(chunks, startedAt, who) {
  var secs = Math.round((Date.now() - startedAt) / 1000);
  if (!chunks || !chunks.length || secs < 3) return;   // 너무 짧으면 파일을 안 만듭니다
  var blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
  var ext = /mp4/.test(blob.type) ? 'm4a' : 'webm';
  var d = new Date(startedAt);
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var name = '면접녹음_' + String(who || '학생').replace(/[\\/:*?"<>|\s]+/g, '_') + '_' +
             d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes()) + '.' + ext;
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  if (typeof toast === 'function') toast('녹음 파일을 내려받았습니다 — ' + name + ' (' + Math.round(blob.size / 1024 / 1024 * 10) / 10 + 'MB, 다운로드 폴더)');
}

function recPaint() {
  var btn = document.getElementById('btn-rec');
  var st = document.getElementById('rec-state');
  var hint = document.getElementById('rec-hint');
  if (!btn) return;
  var ok = recSupported();
  btn.hidden = !ok;
  var wanted = recWanted();
  btn.setAttribute('aria-pressed', wanted);
  btn.classList.toggle('rec-on', REC.on);
  btn.textContent = REC.on ? '녹음 중 · 끄기' : (wanted ? '🎙 녹음 켜짐' : '🎙 녹음 꺼짐');   // 녹음 중엔 CSS 의 깜빡이는 빨간 점이 앞에 붙음
  btn.title = REC.on ? '끄면 지금까지 녹음을 파일로 내려받습니다'
    : wanted ? '«면접 시작» 을 누르면 노트북에서 녹음하고, 끝내면 파일로 내려받습니다' : '녹음하지 않습니다';
  if (st) {
    var secs = REC.on ? Math.round((Date.now() - REC.startedAt) / 1000) : 0;
    st.textContent = REC.on ? (typeof mmss === 'function' ? mmss(secs) : secs + '초') : '';
    st.hidden = !REC.on;
  }
  if (hint) { hint.textContent = REC.hint; hint.hidden = !REC.hint; }

  // 마이크 줄 — 고르기 · 지금 쓰는 마이크 이름 · 소리 막대
  var row = document.getElementById('rec-row');
  if (row) {
    row.hidden = !ok;
    var sel = document.getElementById('mic-pick');
    var named = REC.mics.filter(function (d) { return d.label; });
    if (sel && document.activeElement !== sel) {
      var cur = recMicId();
      var html = '<option value="">기본 마이크 (윈도우 설정대로)</option>';
      named.forEach(function (d) {
        html += '<option value="' + d.deviceId.replace(/"/g, '') + '"' + (d.deviceId === cur ? ' selected' : '') + '>' +
                String(d.label).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</option>';
      });
      if (!named.length) html += '<option value="" disabled>(마이크를 한 번 허용하면 이름이 보입니다)</option>';
      sel.innerHTML = html;
      if (cur && !named.some(function (d) { return d.deviceId === cur; })) sel.value = '';
    }
    var lab = document.getElementById('rec-mic');
    if (lab) lab.textContent = REC.on ? (REC.micLabel ? '지금 녹음: ' + REC.micLabel : '') : (named.length > 1 ? '마이크가 ' + named.length + '개 — 어느 것으로 녹음할지 고르세요' : '');
    var lv = document.getElementById('rec-level');
    if (lv) lv.setAttribute('data-on', REC.on ? 'yes' : 'no');
    var tip = document.getElementById('rec-mictip');
    if (tip) {
      tip.hidden = named.length < 2;   // 마이크가 둘 이상일 때만
      var viaTrack = typeof LISTEN !== 'undefined' && LISTEN.on && LISTEN.viaTrack;
      var bad = typeof LISTEN !== 'undefined' && LISTEN.trackBad;
      tip.innerHTML = viaTrack ? '받아 적기도 이 마이크로 듣고 있습니다.'
        : bad ? '이 크롬은 고른 마이크를 받아 적기에 못 넘깁니다 — 받아 적기는 <b>윈도우 기본 마이크</b>를 씁니다. 꽂은 마이크로 받아 적으려면 윈도우 설정 → 시스템 → 소리 → 입력에서 그 마이크를 고르세요.'
        : '녹음을 켜 두면 받아 적기도 여기서 고른 마이크로 듣습니다(최근 크롬). 녹음을 끄면 받아 적기는 <b>윈도우 기본 마이크</b>를 씁니다 — 윈도우 설정 → 시스템 → 소리 → 입력에서 바꿀 수 있습니다.';
    }
  }
}
