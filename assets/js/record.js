// 면접 녹음 — 노트북 안에서만 (2026-10-14)
//
// 선생님 말씀(10-14 타학교 면접 뒤): 핫스팟이 흔들려 받아 적기가 멈추고 긴 문장이 씹혔다 → «녹음 파일도 하고 싶어,
// 내가 내려받아 학생 주면 되는 거지».
//
// 어떻게 도는가
//   · 폰(안드로이드)과 달리 **컴퓨터 크롬 · 엣지는 녹음과 받아 적기를 동시에** 켤 수 있습니다(2026-10-13 폰에서만 안 됐음)
//   · 진행 화면에서 «면접 시작»(시계)을 처음 누를 때 켜지고, «면접 끝내기» 또는 «목록으로» 에서 멈추며
//     오른쪽 아래 띠의 **«⬇ 내려받기» 를 누르면** 노트북의 다운로드 폴더에 한 파일(면접녹음_학생_날짜시각.mp3 — 2026-10-23 부터, 아래)로. «일시정지» 해도 녹음은 이어집니다
//   · 인터넷을 안 거치고 서버에도 안 올립니다(Supabase 용량 0). 받아 적기가 끊겨도 녹음은 안 끊깁니다
//   · 목소리용으로 낮춰(32kbps) 15분이 4MB 쯤. 3초보다 짧으면 파일을 안 만듭니다
//   · 마이크를 못 잡으면(허용 안 함 · 다른 앱이 쥠) 녹음만 건너뛰고 받아 적기는 그대로
//   · «따라 하기»(?guide)에서는 마이크를 안 쓰니 단추를 숨깁니다
//   · 켜 둘지는 이 브라우저에 기억합니다(localStorage recOn, 처음은 켬)
// ⚠️ 탭을 닫거나 노트북이 잠들면 그때까지 것은 잃습니다 — 브라우저는 닫히는 순간 파일을 못 떨어뜨립니다
//
// 2026-10-23 선생님: «녹음 파일이 w 로 시작하는 확장자(.webm)인데 mp3 로 하면 용량이 커지거나 문제가 돼?» → mp3 로 받기로.
//   · 브라우저는 처음부터 mp3 로 녹음하지 못합니다. 그래서 녹음은 지금처럼 webm 으로 하고, **«⬇ 내려받기» 를 누를 때 노트북 안에서 mp3 로 바꿔** 받습니다
//     (assets/vendor/lame.min.js — 처음 누를 때만 불러옴. 서버에 안 올림)
//   · 목소리용으로 22kHz · 한 줄(모노) · 48kbps — 15분에 5MB 쯤(webm 4MB 보다 조금 큼). 학생 폰 · 카톡 · 윈도우 어디서나 열립니다
//   · 바꾸는 동안 단추에 «MP3로 바꾸는 중 40%». 바꾸지 못하면(아주 오래된 브라우저 등) 원래 webm 으로 받고 알려 줍니다

//
// 2026-10-14 저녁 선생님: «마이크를 꽂아 봤는데 마이크로 녹음되는 건지 노트북 마이크로 들어가는 건지 모르겠어»
//   → 진행 화면에 **마이크 고르기 · 지금 쓰는 마이크 이름 · 소리 막대**(말하면 움직임)를 두었습니다.
//     고른 마이크는 이 브라우저에 기억(localStorage micId). 녹음 중에 바꾸면 지금까지 것을 파일로 떨어뜨리고 새 마이크로 이어 녹음(파일 둘).
//   ⚠️ 받아 적기(크롬 → 구글)는 여기서 고른 마이크가 아니라 **윈도우 기본 마이크**를 씁니다 — 크롬의 음성 인식은 마이크를 고르는 길이 없습니다.
//     꽂은 마이크를 받아 적기에도 쓰려면 윈도우 소리 설정에서 입력 장치를 그 마이크로 바꿔야 합니다(화면에 안내)

// 2026-10-14 밤 선생님: «마이크가 꽂혀 있는데 면접 시작을 해도 목록이 안 뜨고 뺐다 꽂아야 뜬다 · 면접 시작을 눌러도 녹음이 안 되고 단추를 눌러야 된다»
//   ① 목록은 녹음이 켜진 뒤에만 읽었음 → 진행 화면을 열 때 바로 읽습니다(허용이 이미 돼 있으면 이름까지 보임)
//   ② 단추 «🎙 녹음 켜짐» 이 상태처럼 보이는데 누르면 꺼지는 스위치였음
// 🚨 그 뒤 선생님: «그냥 편하게 쓰자. 면접 시작하면 녹음하고, 답변 시작하면 음성 인식. 왜 자꾸 옵션을 넣어 불편하게. 조작할 게 너무 많다»
//   → «면접 시작하면 녹음» 체크를 뺐습니다. «면접 시작» 이면 늘 녹음. «잠시만, 녹음 버튼은 남겨 놔야지, 중간에 멈출 수도 있으니»
//     → 단추는 «■ 녹음 멈추기»(녹음 중) / «⏺ 녹음 다시 켜기»(면접 중인데 멈춰 있을 때) 하나. 화면엔 «녹음 중 00:12» 표시. 마이크 고르기 칸은 그대로
//   → «녹음 다운로드는 다운로드 버튼으로 원하면 받게» — 끝내도 저절로 안 받고, 오른쪽 아래 «🎙 녹음 파일» 띠의 **⬇ 내려받기** 를 눌러야 받습니다.
//     파일은 브라우저 안에만 있다가(REC.files) 다음 학생의 면접을 시작하면 비웁니다. 안 받은 파일이 있는데 탭을 닫으면 브라우저가 한 번 묻습니다

var REC = { rec: null, stream: null, on: false, startedAt: 0, who: '', hint: '', tickId: null,
            mics: [], micLabel: '', audio: null, analyser: null, rafId: null, listed: false,
            paused: false,     // «녹음 멈추기» 를 눌렀는가 — 이 면접에선 «이어서» 를 눌러도 저절로 다시 켜지 않음
            files: [],         // 다 된 녹음 파일들 [{ name, blob, secs, got }] — «⬇ 내려받기» 를 눌러야 받음
            filesFor: null };  // 어느 면접(interviewId)의 파일인가 — 다른 면접을 시작하면 비움

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

function recWanted() { return !REC.paused; }   // 스위치 없음 — «면접 시작» 이면 늘 녹음. «녹음 멈추기» 를 누른 면접에서만 안 켬 (선생님 말씀: 옵션 빼고 편하게)

// «■ 녹음 멈추기» / «⏺ 녹음 다시 켜기» 단추 — 중간에 멈출 수 있게(선생님 말씀)
function recButton() {
  if (REC.on) { REC.paused = true; recStop(); return; }   // 멈추면 지금까지 것을 파일로. 이 면접에선 저절로 다시 켜지 않음
  REC.paused = false;
  REC.hint = '';
  recStart();
  recPaint();
}
function toggleRec() { recButton(); }   // 옛 이름 — 혹시 어디서 부르면
function recSupported() {
  if (/[?&]guide(=|&|$)/.test(location.search)) return false;   // 연습 모드 — 마이크 안 씀
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
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
  if (REC.on || REC.starting || !recWanted() || !recSupported()) return;
  if (typeof liveInterview !== 'undefined' && !liveInterview) return;   // 지난 회차를 고치는 중
  REC.starting = true;   // 마이크를 잡는 사이 또 부르면 두 번 잡지 않게
  try { await recStartInner(); } finally { REC.starting = false; recPaint(); }
}
async function recStartInner() {
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
  var ivNow = (typeof interviewId !== 'undefined') ? interviewId : null;
  if (REC.filesFor !== ivNow) { REC.files = []; REC.filesFor = ivNow; }   // 다른 학생의 면접 — 지난 파일은 비움(받았든 안 받았든; 끝낼 때 띠가 떠 있었음)
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
  var ext = /mp4/.test(blob.type) ? 'm4a' : 'webm';   // 원래 녹음 — mp3 로 못 바꿀 때만 이것으로 받습니다
  var d = new Date(startedAt);
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var base = '면접녹음_' + String(who || '학생').replace(/[\\/:*?"<>|\s]+/g, '_') + '_' +
             d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes());
  REC.files.push({ name: base + '.mp3', base: base, ext: ext, blob: blob, mp3: null, busy: null, secs: secs, got: false });
  recPaint();
  if (typeof toast === 'function') toast('녹음이 끝났습니다(' + recMmss(secs) + '). 오른쪽 아래 «⬇ 내려받기» 로 받으세요.');
}
function recMmss(secs) { return typeof mmss === 'function' ? mmss(secs) : secs + '초'; }

// ── mp3 로 바꾸기 (2026-10-23) ──
// lame.min.js 자리는 이 파일(assets/js/record.js) 기준으로 잡습니다 — 선생님 화면은 /teacher/ 안에서 열려서 화면 주소 기준이면 헛걸음합니다
var REC_LAME_URL = (function () {
  try { var me = document.currentScript && document.currentScript.src; if (me) return new URL('../vendor/lame.min.js', me).href; } catch (e) { /* */ }
  return 'assets/vendor/lame.min.js';
})();
var REC_MP3_RATE = 22050, REC_MP3_KBPS = 48;   // 목소리용 — 15분에 5MB 쯤
function recLoadLame() {
  if (window.lamejs && window.lamejs.Mp3Encoder) return Promise.resolve();
  return new Promise(function (ok, bad) {
    var sc = document.createElement('script');
    sc.src = REC_LAME_URL;
    sc.onload = function () { (window.lamejs && window.lamejs.Mp3Encoder) ? ok() : bad(new Error('lamejs 없음')); };
    sc.onerror = function () { bad(new Error('lame.min.js 를 못 불러옴')); };
    document.head.appendChild(sc);
  });
}
// 녹음(webm) → mp3. onPct(0~100) 로 얼마나 됐는지 알려 줍니다.
// 소리를 22kHz 한 줄로 풀어(브라우저의 소리 풀기 — 이때 22kHz 로 맞춰 줌) 10초쯤씩 끊어 바꾸고, 그 사이 화면에 숨 돌릴 틈을 줍니다(멈춘 것처럼 안 보이게)
async function recToMp3(blob, onPct) {
  await recLoadLame();
  var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Off) throw new Error('소리를 풀 수 없는 브라우저');
  var buf = await new Off(1, REC_MP3_RATE, REC_MP3_RATE).decodeAudioData(await blob.arrayBuffer());
  var a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  var enc = new window.lamejs.Mp3Encoder(1, buf.sampleRate, REC_MP3_KBPS);
  var STEP = 1152 * 200, pcm = new Int16Array(STEP), out = [];
  for (var i = 0; i < a.length; i += STEP) {
    var n = Math.min(STEP, a.length - i);
    for (var j = 0; j < n; j++) {
      var v = b ? (a[i + j] + b[i + j]) / 2 : a[i + j];
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      pcm[j] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }
    var part = enc.encodeBuffer(n === STEP ? pcm : pcm.subarray(0, n));
    if (part.length) out.push(part);
    if (onPct) onPct(Math.round((i + n) / a.length * 100));
    await new Promise(function (r) { setTimeout(r, 0); });
  }
  var end = enc.flush();
  if (end.length) out.push(end);
  return new Blob(out, { type: 'audio/mpeg' });
}

// «⬇ 내려받기» — 눌렀을 때만 다운로드 폴더로. 처음 누를 때 mp3 로 바꾸고, 바꾼 것은 기억해 두어 «다시 내려받기» 는 바로
async function recDownload(i) {
  var f = REC.files[i];
  if (!f || f.busy !== null && f.busy !== undefined) return;
  var blob = f.mp3, name = f.name;
  if (!blob) {
    f.busy = 0; recPaint();
    try { blob = await recToMp3(f.blob, function (pct) { f.busy = pct; recPaint(); }); f.mp3 = blob; }
    catch (e) { console.warn('mp3 로 바꾸지 못했습니다:', e); blob = null; }
    f.busy = null;
  }
  if (!blob) {   // 못 바꾸면 원래 녹음 그대로
    blob = f.blob; name = (f.base || f.name.replace(/\.mp3$/, '')) + '.' + (f.ext || 'webm');
    if (typeof toast === 'function') toast('MP3 로 바꾸지 못해 원래 녹음 파일(.' + (f.ext || 'webm') + ')로 받습니다.', 'bad');
  }
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  f.got = true;
  recPaint();
  if (typeof toast === 'function' && blob === f.mp3) toast('내려받았습니다 — ' + name + ' (다운로드 폴더)');
}
// 띠의 ✕ — 안 받은 파일이 있으면 한 번 묻습니다
function recDropFiles() {
  if (REC.files.some(function (f) { return !f.got; }) && !confirm('아직 내려받지 않은 녹음 파일이 있습니다. 버릴까요?')) return;
  REC.files = []; REC.filesFor = null;
  recPaint();
}
// 안 받은 파일이 있는데 탭을 닫으면 브라우저가 한 번 묻습니다
window.addEventListener('beforeunload', function (ev) {
  if (REC.on || REC.files.some(function (f) { return !f.got; })) { ev.preventDefault(); ev.returnValue = ''; }
});

function recPaint() {
  var st = document.getElementById('rec-state');
  var btn = document.getElementById('btn-rec');
  var hint = document.getElementById('rec-hint');
  if (!st) return;
  var ok = recSupported();
  var live = typeof liveInterview === 'undefined' || liveInterview;
  var tick = typeof ticking !== 'undefined' && ticking;
  // 진행 화면을 열면 마이크 목록부터(허용이 돼 있으면 이름까지) — 전엔 녹음이 켜진 뒤에만 읽어 «뺐다 꽂아야 뜬다» 하셨음
  if (ok && !REC.listed) { REC.listed = true; recListMics(); }
  // «녹음 중 00:12» 표시
  var secs = REC.on ? Math.round((Date.now() - REC.startedAt) / 1000) : 0;
  st.textContent = REC.on ? '녹음 중 ' + (typeof mmss === 'function' ? mmss(secs) : secs + '초') : '';
  st.hidden = !REC.on;
  st.title = '«면접 끝내기» 를 누르면 오른쪽 아래에 «⬇ 내려받기» 가 뜹니다';
  // 단추: 녹음 중이면 «■ 녹음 멈추기», 면접 중인데 멈춰 있으면 «⏺ 녹음 다시 켜기», 그 밖엔 숨김
  if (btn) {
    btn.hidden = !ok || !live || !(REC.on || (tick && REC.paused));
    btn.textContent = REC.on ? '■ 녹음 멈추기' : '⏺ 녹음 다시 켜기';
    btn.title = REC.on ? '멈추면 지금까지 녹음이 파일이 되어 «⬇ 내려받기» 가 뜹니다' : '지금부터 다시 녹음합니다(파일이 하나 더 생깁니다)';
  }
  if (hint) { hint.textContent = REC.hint; hint.hidden = !REC.hint; }

  // 오른쪽 아래 «🎙 녹음 파일» 띠 — 다 된 파일마다 «⬇ 내려받기»
  var bar = document.getElementById('rec-files');
  if (bar) {
    bar.hidden = !REC.files.length;
    if (REC.files.length) {
      bar.innerHTML = '<div class="rfhead"><span>🎙 녹음 파일 ' + REC.files.length + '개 — 노트북에만 있습니다. 필요하면 내려받으세요.</span>' +
        '<button type="button" class="rfx" onclick="recDropFiles()" title="띠 닫기(파일 버림)" aria-label="녹음 파일 띠 닫기">✕</button></div>' +
        REC.files.map(function (f, i) {
          return '<div class="rfrow"><span class="rfname">' + String(f.name).replace(/&/g, '&amp;').replace(/</g, '&lt;') +
                 ' <span class="opt">' + recMmss(f.secs) + (f.mp3 ? ' · ' + (Math.round(f.mp3.size / 1024 / 1024 * 10) / 10) + 'MB' : '') + '</span></span>' +
                 '<button type="button" class="btn ' + (f.got ? '' : 'solid') + ' rfget" onclick="recDownload(' + i + ')"' + (f.busy !== null && f.busy !== undefined ? ' disabled' : '') + '>' +
                   (f.busy !== null && f.busy !== undefined ? 'MP3로 바꾸는 중 ' + f.busy + '%' : f.got ? '다시 내려받기' : '⬇ 내려받기') + '</button></div>';
        }).join('');
    }
  }

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
        : '«면접 시작» 하면 이 마이크로 녹음하고, «답변 시작» 하면 같은 마이크로 받아 적습니다.';
    }
  }
}
