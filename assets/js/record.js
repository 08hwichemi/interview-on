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

var REC = { rec: null, stream: null, chunks: [], on: false, startedAt: 0, who: '', hint: '', tickId: null };

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
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  REC.chunks = [];
  r.ondataavailable = function (ev) { if (ev.data && ev.data.size) REC.chunks.push(ev.data); };
  r.onstop = recFinish;
  r.onerror = function () { REC.hint = '녹음이 중간에 멈췄습니다. 지금까지 것은 파일로 남깁니다.'; recStop(); };
  try { r.start(10000); }   // 10초마다 조각을 받아 둡니다 — 중간에 멈춰도 그때까지 것은 남게
  catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); REC.hint = '녹음을 켜지 못했습니다.'; recPaint(); return; }
  REC.rec = r; REC.stream = stream; REC.on = true; REC.startedAt = Date.now();
  REC.who = (typeof target !== 'undefined' && target && typeof whoLabel === 'function') ? whoLabel(target) : '학생';
  REC.hint = '';
  if (REC.tickId) clearInterval(REC.tickId);
  REC.tickId = setInterval(recPaint, 1000);
  recPaint();
}

// 멈추고 파일로 — «면접 끝내기» · «목록으로» · 녹음 끄기
function recStop() {
  if (!REC.on) return;
  REC.on = false;
  if (REC.tickId) { clearInterval(REC.tickId); REC.tickId = null; }
  var r = REC.rec, s = REC.stream;
  REC.rec = null; REC.stream = null;
  try { if (r && r.state !== 'inactive') r.stop(); else recFinish(); } catch (e) { recFinish(); }
  if (s) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* */ } }
  recPaint();
}

function recFinish() {
  var chunks = REC.chunks; REC.chunks = [];
  var secs = Math.round((Date.now() - REC.startedAt) / 1000);
  if (!chunks.length || secs < 3) return;   // 너무 짧으면 파일을 안 만듭니다
  var blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
  var ext = /mp4/.test(blob.type) ? 'm4a' : 'webm';
  var d = new Date(REC.startedAt);
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var name = '면접녹음_' + String(REC.who || '학생').replace(/[\\/:*?"<>|\s]+/g, '_') + '_' +
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
  btn.textContent = REC.on ? '⏺ 녹음 중 · 끄기' : (wanted ? '🎙 녹음 켜짐' : '🎙 녹음 꺼짐');
  btn.title = REC.on ? '끄면 지금까지 녹음을 파일로 내려받습니다'
    : wanted ? '«면접 시작» 을 누르면 노트북에서 녹음하고, 끝내면 파일로 내려받습니다' : '녹음하지 않습니다';
  if (st) {
    var secs = REC.on ? Math.round((Date.now() - REC.startedAt) / 1000) : 0;
    st.textContent = REC.on ? (typeof mmss === 'function' ? mmss(secs) : secs + '초') : '';
    st.hidden = !REC.on;
  }
  if (hint) { hint.textContent = REC.hint; hint.hidden = !REC.hint; }
}
