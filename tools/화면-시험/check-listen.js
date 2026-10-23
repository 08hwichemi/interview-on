// 면접 중 받아 적기(listen.js) · 👍👎 순간 찍기 · 키보드 · 마무리 화면에서 보며 평가하기 (2026-10-10)
//
// 이 작업 환경에는 마이크가 없으므로 크롬의 음성 인식을 **가짜**(window.__say 로 말을 넣음)로 바꿔 끼웁니다.
// 진짜 인식의 정확도는 선생님이 미리보기에서 직접 말해 보셔야 압니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }
const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);

const ROWS = () => ({
  profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
               school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
  students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 }],
  interviews: [{ id: 'iv1', student_id: 's1', teacher_id: 't1', teacher_name: '이용휘', status: '진행중', started_at: '2026-10-10T09:00:00Z' }],
  interview_answers: [
    { id: 'a1', interview_id: 'iv1', seq: 1, competency: '기타', question: '자기소개를 해 주세요.', seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '' },
    { id: 'a2', interview_id: 'iv1', seq: 2, competency: '학업역량', question: '「히트 패치」 탐구는 무엇이 궁금해서 시작했나요?', seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '' }
  ]
});

// 가짜 음성 인식 — 진짜와 같은 이름(webkitSpeechRecognition)으로 끼웁니다
const FAKE_SR = () => {
  window.__recs = [];
  function R() { this.started = false; window.__recs.push(this); }
  R.prototype.start = function (track) {
    if (window.__noTrack && track) throw new TypeError('start(track) 를 모르는 크롬 흉내');
    this.started = true; this.track = track || null; var me = this; setTimeout(function () { me.onstart && me.onstart(); }, 0); };
  R.prototype.stop = R.prototype.abort = function () {
    this.started = false; var me = this; setTimeout(function () { me.onend && me.onend(); }, 0);
  };
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
  // 말을 넣습니다. final=true 면 확정된 글
  window.__say = function (text, final) {
    // 실제 크롬처럼 — 확정한 칸은 남기고 다음 말은 새 칸(결과 번호 +1)에 (2026-10-23, stt-keep.js 가 칸마다 견줍니다)
    var r = window.__recs[window.__recs.length - 1];
    r.__done = r.__done || [];
    var one = [{ transcript: text }]; one.isFinal = !!final;
    r.onresult({ resultIndex: r.__done.length, results: r.__done.concat([one]) });
    if (final) r.__done.push(one);
  };
  // 실제 한국어 크롬처럼 — 아직 덜 굳은 문장을 여러 칸으로 나눠 보냄. parts = [[글, 확정?], …] (2026-10-23 선생님 화면에서 찾은 모양)
  window.__sayParts = function (parts) {
    var r = window.__recs[window.__recs.length - 1];
    r.__done = r.__done || [];
    var list = parts.map(function (x) { var one = [{ transcript: x[0] }]; one.isFinal = !!x[1]; return one; });
    r.onresult({ resultIndex: r.__done.length, results: r.__done.concat(list) });
    if (list.every(function (o) { return o.isFinal; })) r.__done = r.__done.concat(list);
  };
  window.__fail = function (kind) { var r = window.__recs[window.__recs.length - 1]; r.onerror({ error: kind }); };
  window.__end = function () { var r = window.__recs[window.__recs.length - 1]; r.started = false; r.onend && r.onend(); };
};
// 가짜 마이크 · 녹음기 — 이 환경엔 마이크가 없습니다. 10초 조각 대신 바로 조각 하나를 줍니다
const FAKE_MIC = () => {
  window.__mics = 0; window.__recorders = [];
  window.__gumArgs = [];
  navigator.mediaDevices.getUserMedia = async function (c) {
    window.__mics++; window.__gumArgs.push(c); window.__allowed = true;
    var id = c && c.audio && c.audio.deviceId && c.audio.deviceId.exact;
    if (id === 'gone') throw new Error('NotFoundError');
    var t = { stop: function () { t.stopped = true; }, label: id === 'usb1' ? 'USB 마이크 (외장)' : '노트북 내장 마이크' };
    return { getTracks: function () { return [t]; }, getAudioTracks: function () { return [t]; }, __t: t };
  };
  navigator.mediaDevices.enumerateDevices = async function () {
    window.__micListed = true;
    var ok = window.__allowed;   // 허용 전엔 이름이 비어 옵니다(진짜 크롬과 같게)
    return [{ kind: 'audioinput', deviceId: 'default', label: ok ? '노트북 내장 마이크' : '' },
            { kind: 'audioinput', deviceId: 'usb1', label: ok ? 'USB 마이크 (외장)' : '' },
            { kind: 'videoinput', deviceId: 'cam', label: '' }];
  };
  function MR(stream, opt) { this.stream = stream; this.opt = opt || {}; this.state = 'inactive'; window.__recorders.push(this); }
  MR.isTypeSupported = function (t) { return /webm/.test(t); };
  MR.prototype.start = function (slice) { this.state = 'recording'; this.slice = slice; };
  MR.prototype.stop = function () {
    this.state = 'inactive'; var me = this;
    me.ondataavailable && me.ondataavailable({ data: new Blob([new Uint8Array(50000)], { type: 'audio/webm' }) });
    setTimeout(function () { me.onstop && me.onstop(); }, 0);
  };
  window.MediaRecorder = MR;
};

(async () => {
  // ⚠️ 이 작업 환경은 LANG 이 비어 있어 크롬이 한글 파일 이름(면접녹음_…)을 «download» 로 바꿉니다 — 크롬만 C.UTF-8 로 띄웁니다(check-other 와 같음)
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    env: Object.assign({}, process.env, { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }) });

  // ── 1. 크롬(음성 인식 있음) ──
  const ctx = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE_SR);
  await ctx.addInitScript(FAKE_MIC);
  await ctx.addInitScript((rows) => {
    window.__FAKE__ = { profile: { id: 't1', name: '이용휘', login_id: '이용휘', role: 'teacher' }, rows: rows };
    try { localStorage.removeItem('listenOn'); localStorage.removeItem('tagUse'); localStorage.removeItem('recOn'); localStorage.removeItem('micId'); } catch (e) {}
  }, ROWS());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); await loadUnfinished(); });
  await p.waitForTimeout(300);
  await p.click('#unfinished-list button'); await p.waitForTimeout(400);
  확인('진행 화면인가', await p.evaluate(() => !!document.querySelector('#view-run:not([hidden])')));

  console.log('\n── 시계가 흐르기 전 ──');
  확인('받아 적기 단추가 보이고 «끄기» 인가(처음은 켜 둠)',
       (await p.evaluate(() => document.getElementById('btn-stt').textContent)).indexOf('끄기') > -1);
  확인('아직 듣지 않는다 — «답변 시작을 누르면»', (await p.evaluate(() => document.getElementById('live-state').textContent)).indexOf('답변 시작') > -1);
  확인('음성 인식을 아직 안 만들었는가', await p.evaluate(() => window.__recs.length === 0));
  확인('진행 화면을 열 때 마이크 목록을 읽었는가(허용 전엔 «허용하면 이름이 보입니다»)', await p.evaluate(() => {
    var o = [...document.querySelectorAll('#mic-pick option')]; return window.__micListed && o.some(x => x.disabled && x.textContent.indexOf('허용') > -1); }));
  확인('진행 화면에 태그는 없고, 쓰는 칸(평가·요지)은 있는가',
       await p.evaluate(() => !document.getElementById('tag-area') && !!document.getElementById('answer-memo')));
  확인('영역 다섯 줄 × 좋음·보통·아쉬움 표가 있는가',
       await p.evaluate(() => document.querySelectorAll('#area-grid .arearow').length === 5 && document.querySelectorAll('#area-grid .abtn').length === 15));

  console.log('\n── 면접 시계와 답변 시계 ──');
  await p.click('#btn-timer'); await p.waitForTimeout(1300);
  확인('«면접 시작» 만으로는 면접 전체만 흐르고 답변 시계는 안 흐르는가',
       await p.evaluate(() => ticking && !answering && seconds === 0 && totalSeconds >= 1), await p.evaluate(() => seconds + ' / ' + totalSeconds));
  확인('«면접 시작» 만으로는 듣지 않는가', await p.evaluate(() => !LISTEN.on && window.__recs.length === 0));
  console.log('\n── 녹음 (record.js, 2026-10-14) ──');
  확인('«면접 시작» 을 누르면 녹음이 켜지는가(처음은 켜 둠)', await p.evaluate(() => REC.on && window.__mics === 1 && window.__recorders.length === 1 && window.__recorders[0].state === 'recording'));
  확인('목소리용 32kbps · webm · 10초 조각', await p.evaluate(() => { var r = window.__recorders[0]; return r.opt.audioBitsPerSecond === 32000 && /webm/.test(r.opt.mimeType) && r.slice === 10000; }));
  확인('«녹음 중 00:0N» 표시와 «■ 녹음 멈추기» 단추, 체크는 없음(선생님: 옵션 빼고 편하게 · 멈추는 단추는 남김)', await p.evaluate(() => { var st = document.getElementById('rec-state'), b = document.getElementById('btn-rec'); return !st.hidden && /녹음 중 00:0\d/.test(st.textContent) && !b.hidden && b.textContent.indexOf('녹음 멈추기') > -1 && !document.getElementById('rec-auto'); }));
  await p.click('#btn-timer'); await p.waitForTimeout(200);   // 일시정지
  확인('«일시정지» 해도 녹음은 이어지는가', await p.evaluate(() => REC.on && window.__recorders[0].state === 'recording'));
  await p.click('#btn-timer'); await p.waitForTimeout(200);   // 이어서
  확인('«이어서» 눌러도 녹음기를 새로 만들지 않는가', await p.evaluate(() => window.__recorders.length === 1));
  await p.waitForTimeout(1600);
  const dl0 = p.waitForEvent('download', { timeout: 1500 }).catch(() => null);
  await p.click('#btn-rec'); await p.waitForTimeout(300);   // «■ 녹음 멈추기»
  확인('«녹음 멈추기» 를 누르면 파일이 되고 «⏺ 녹음 다시 켜기» 로 바뀌는가', await p.evaluate(() => !REC.on && REC.paused && REC.files.length === 1 && document.getElementById('btn-rec').textContent.indexOf('다시 켜기') > -1 && !document.getElementById('btn-rec').hidden));
  확인('저절로 내려받지 않고 오른쪽 아래 «녹음 파일» 띠에 «⬇ 내려받기» 가 뜨는가(선생님: 원하면 받게)', !(await dl0) && await p.evaluate(() => { var b = document.getElementById('rec-files'); return !b.hidden && b.querySelectorAll('.rfget').length === 1 && b.textContent.indexOf('⬇ 내려받기') > -1; }));
  const dlx = p.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await p.click('#rec-files .rfget'); const dx = await dlx;
  // 가짜 녹음기는 빈 소리(0 으로 채운 조각)라 mp3 로 못 바꿉니다 → 원래 webm 으로 받는 길을 봅니다. 진짜로 바꾸는 것은 아래 «mp3 로 바꾸기» 에서
  확인('«⬇ 내려받기» 를 누르면 그때 받고 «다시 내려받기» 로 바뀌는가(못 바꾸면 원래 .webm 으로)', !!dx && /^면접녹음_.*고다윤.*\.webm$/.test(dx.suggestedFilename()) && await p.evaluate(() => REC.files[0].got && document.querySelector('#rec-files .rfget').textContent.indexOf('다시 내려받기') > -1), dx && dx.suggestedFilename());
  확인('띠에 보이는 이름은 .mp3', await p.evaluate(() => /\.mp3/.test(document.querySelector('#rec-files .rfname').textContent)));
  console.log('\n── mp3 로 바꾸기 (2026-10-23 — 진짜 소리로) ──');
  {
    // 3초짜리 진짜 소리(440Hz)를 WAV 로 만들어 녹음 파일 자리에 넣고 «⬇ 내려받기»
    await p.evaluate(() => {
      window.__keepFiles = REC.files;   // 아래 검사가 보는 원래 파일들 — 끝나고 되돌립니다
      var rate = 48000, n = rate * 3, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      var w = function (o, t) { for (var k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      for (var i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / rate * 2 * Math.PI * 440) * 12000, true);
      REC.files = [{ name: '면접녹음_소리시험.mp3', base: '면접녹음_소리시험', ext: 'webm', blob: new Blob([buf], { type: 'audio/wav' }), mp3: null, busy: null, secs: 3, got: false }];
      recPaint();
    });
    const dlm = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await p.click('#rec-files .rfget');
    const 중 = await p.evaluate(() => document.querySelector('#rec-files .rfget').textContent);
    const dm = await dlm;
    확인('누르면 «MP3로 바꾸는 중» 표시', /MP3로 바꾸는 중|다시 내려받기/.test(중), 중);
    확인('.mp3 파일로 받는가', !!dm && /\.mp3$/.test(dm.suggestedFilename()), dm && dm.suggestedFilename());
    if (dm) {
      const b = fs.readFileSync(await dm.path());
      const ok = b.length > 3000 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0));
      확인('받은 파일이 진짜 mp3(첫 바이트가 mp3 머리) · 3초에 알맞은 크기', ok && b.length < 60000, b.length + '바이트 · ' + b.slice(0, 4).toString('hex'));
    }
    확인('바꾼 것은 기억 · 크기 표시(MB) · «다시 내려받기»', await p.evaluate(() => REC.files[0].mp3 && REC.files[0].mp3.type === 'audio/mpeg' &&
      /MB/.test(document.querySelector('#rec-files .rfname').textContent) && /다시 내려받기/.test(document.querySelector('#rec-files .rfget').textContent)));
    await p.evaluate(() => { REC.files = window.__keepFiles || []; recPaint(); });
  }
  await p.click('#btn-timer'); await p.waitForTimeout(200); await p.click('#btn-timer'); await p.waitForTimeout(300);   // 일시정지 → 이어서
  확인('멈춘 뒤엔 «이어서» 를 눌러도 저절로 다시 켜지지 않는가', await p.evaluate(() => !REC.on && window.__recorders.length === 1));
  await p.click('#btn-rec'); await p.waitForTimeout(300);   // «⏺ 녹음 다시 켜기»
  확인('«녹음 다시 켜기» 를 누르면 다시 녹음하는가', await p.evaluate(() => REC.on && !REC.paused && window.__recorders.length === 2));
  console.log('\n── 마이크 고르기 · 이름 · 소리 막대 (2026-10-14 «꽂은 마이크인지 노트북 마이크인지») ──');
  await p.waitForTimeout(200);
  확인('마이크 줄이 보이고 «지금 녹음: 노트북 내장 마이크»', await p.evaluate(() => !document.getElementById('rec-row').hidden && document.getElementById('rec-mic').textContent.indexOf('지금 녹음: 노트북 내장 마이크') > -1), await p.evaluate(() => document.getElementById('rec-mic').textContent));
  확인('고르기 칸에 기본 + 마이크 둘(이름)', await p.evaluate(() => { var o = [...document.querySelectorAll('#mic-pick option')].filter(x => !x.disabled); return o.length === 3 && o[1].textContent === '노트북 내장 마이크' && o[2].textContent === 'USB 마이크 (외장)'; }));
  확인('마이크가 둘이라 «받아 적기는 윈도우 기본 마이크» 안내가 보이는가', await p.evaluate(() => !document.getElementById('rec-mictip').hidden));
  확인('소리 막대가 켜져 있는가', await p.evaluate(() => document.getElementById('rec-level').getAttribute('data-on') === 'yes'));
  await p.waitForTimeout(3000);   // 3초보다 짧은 녹음은 파일을 안 만드니 기다립니다
  await p.selectOption('#mic-pick', 'usb1'); await p.waitForTimeout(400);
  확인('녹음 중에 마이크를 바꾸면 지금까지 것이 파일(띠에 2개)이 되고 새 마이크로 이어 녹음', await p.evaluate(() => REC.on && REC.files.length === 2 && document.querySelectorAll('#rec-files .rfget').length === 2 && window.__recorders.length === 3 && window.__gumArgs[2].audio.deviceId.exact === 'usb1' && document.getElementById('rec-mic').textContent.indexOf('USB 마이크') > -1),
       await p.evaluate(() => JSON.stringify({ on: REC.on, n: window.__recorders.length, files: REC.files.length, mic: document.getElementById('rec-mic').textContent, hint: REC.hint })));
  확인('고른 마이크를 기억하는가', await p.evaluate(() => localStorage.getItem('micId') === 'usb1' && document.getElementById('mic-pick').value === 'usb1'));
  await p.click('#btn-answer'); await p.waitForTimeout(1300);
  확인('«답변 시작» 을 누르면 답변 시계가 흐르는가', await p.evaluate(() => answering && seconds >= 1), await p.evaluate(() => seconds));
  확인('단추가 «답변 끝» 으로', (await p.evaluate(() => document.getElementById('btn-answer').textContent)) === '답변 끝');
  확인('듣기 시작했는가', await p.evaluate(() => LISTEN.on && window.__recs.length === 1 && window.__recs[0].started));
  // 받아 적기도 고른 마이크로 — 녹음 마이크 선을 음성 인식에 넘김 (2026-10-14 «마이크를 가려도 적힌다»)
  확인('«답변 시작» 으로 켜진 받아 적기가 녹음 중인 마이크 선(USB)을 넘겨 듣는가', await p.evaluate(() => { var r = window.__recs[window.__recs.length - 1]; return LISTEN.on && LISTEN.viaTrack && r.track && r.track.label === 'USB 마이크 (외장)'; }));
  확인('«받아 적는 중 (USB 마이크 …)» 과 «받아 적기도 이 마이크로» 안내', await p.evaluate(() => document.getElementById('live-state').textContent.indexOf('USB 마이크') > -1 && document.getElementById('rec-mictip').textContent.indexOf('받아 적기도 이 마이크로') > -1));
  await p.evaluate(() => { window.__fail('audio-capture'); window.__end(); }); await p.waitForTimeout(400);
  확인('마이크 선을 못 받는 크롬이면(audio-capture) 기본 마이크로 다시 켜고 안내', await p.evaluate(() => { var r = window.__recs[window.__recs.length - 1]; return LISTEN.on && !LISTEN.viaTrack && LISTEN.trackBad && !r.track && document.getElementById('rec-mictip').textContent.indexOf('못 넘깁니다') > -1; }));
  await p.evaluate(() => { LISTEN.trackBad = false; LISTEN.hint = ''; LISTEN.fails = 0; });
  확인('«받아 적는 중» 표시', (await p.evaluate(() => document.getElementById('live-state').textContent)).indexOf('받아 적는 중') > -1);
  await p.evaluate(() => window.__say('안녕하세요 저는', false)); await p.waitForTimeout(50);
  // 2026-10-23: 회색 글 없이 들리는 대로 바로 검은 글(아직 안 굳은 꼬리 — 크롬이 고치면 따라 바뀜, stt-keep.js)
  확인('확정 전 글도 회색 없이 바로 화면에 보이는가(아직 안 굳음)', await p.evaluate(() => !document.querySelector('#live-text .interim') &&
       document.getElementById('live-text').textContent.indexOf('안녕하세요 저는') > -1 && answers[0].transcript === ''),
       await p.evaluate(() => answers[0].transcript + ' / ' + document.getElementById('live-text').textContent));
  await p.evaluate(() => window.__say('안녕하세요 저는 고다윤입니다', true)); await p.waitForTimeout(50);
  확인('확정되면 굳어서 한 번만 붙는가', await p.evaluate(() => answers[0].transcript === '안녕하세요 저는 고다윤입니다'), await p.evaluate(() => answers[0].transcript));
  확인('화면에도 보이는가', (await p.evaluate(() => document.getElementById('live-text').textContent)).indexOf('고다윤입니다') > -1);
  // 크롬이 확정하며 앞 말을 빼 버려도(«어릴 때부터» 가 사라짐) 이미 적은 것은 남고, 늘어난 말만 붙음
  await p.evaluate(() => { window.__say('어릴 때부터', false); window.__say('어릴 때부터 실험을', false); window.__say('실험을 좋아했고', true); }); await p.waitForTimeout(50);
  확인('크롬이 확정하며 뺀 말(«어릴 때부터»)도 남는가', await p.evaluate(() => answers[0].transcript === '안녕하세요 저는 고다윤입니다 어릴 때부터 실험을 좋아했고'),
       await p.evaluate(() => answers[0].transcript));
  // 크롬이 뒷부분을 다른 말로 갈아 끼워도(«어릴 때부터» → «실험을 좋아했고») 둘 다 남음 — 처음엔 «했고» 만 붙던 자리
  await p.evaluate(() => { window.__say('그래서 저는 어릴', false); window.__say('그래서 저는 어릴 때부터', false); window.__say('그래서 저는 어릴 때부터 계속', false); window.__say('그래서 저는 실험을 좋아했고', true); }); await p.waitForTimeout(50);
  확인('크롬이 뒷말을 갈아 끼워도 앞말 · 새 말 둘 다 남는가', await p.evaluate(() => answers[0].transcript.endsWith('그래서 저는 어릴 때부터 실험을 좋아했고')),
       await p.evaluate(() => answers[0].transcript));
  // 띄어쓰기만 바꿔 다시 보내도(«반응 속도» → «반응속도 탐구에서») 겹치지 않고 늘어난 것만
  await p.evaluate(() => { window.__say('반응 속도', false); window.__say('반응속도 탐구에서', false); window.__say('반응속도 탐구에서 온도를', true); }); await p.waitForTimeout(50);
  확인('띄어쓰기가 바뀌어도 겹치지 않고, 두 번째 모양(«반응속도»)으로 굳는가', await p.evaluate(() => answers[0].transcript.endsWith('좋아했고 반응속도 탐구에서 온도를')),
       await p.evaluate(() => answers[0].transcript));
  // 🚨 선생님 화면에서 나온 모양 — 칸이 나뉘고 낱말이 칸 사이를 옮겨 다니며, 첫 짐작은 한 글자씩 띄어 옴
  //    .1 판에서는 «받 아 적 기 손 적기 손실 을 손 실을 손실 손실을 …» 처럼 겹쳐 적혔습니다
  await p.evaluate(() => {
    answers[0].transcript = '';
    var F = '받아 적기 손실을 최대로 선생님';
    [[['받 아']], [['받아 적 기']], [['받아 적기'], [' 손']], [['받아 적기 손실 을']], [['받아 적기 손실을'], [' 최 대로']],
     [['받아 적기 손실을 최대로'], [' 선 생님']], [[F, 1]],
     [[' 면 접']], [[' 면접 화 면']], [[' 면접 화면과'], [' 학 생']], [[' 면접 화면과 학생', 1]]].forEach(function (p) { window.__sayParts(p); });
  });
  await p.waitForTimeout(50);
  확인('실제 크롬 모양(칸 나뉨 · 한 글자씩 띄움)에서도 겹치지 않고 바르게', await p.evaluate(() => answers[0].transcript === '받아 적기 손실을 최대로 선생님 면접 화면과 학생'),
       await p.evaluate(() => answers[0].transcript));
  // (.3) 띄어쓰기 — 첫 짐작 «속 도 태 도 · 충분 합» 으로 굳은 글도 크롬이 «속도 태도 · 충분합니다» 로 다시 보내면 띄어쓰기를 따라 고침(글자는 그대로)
  await p.evaluate(() => {
    answers[0].transcript = '';
    [[['말하기 결론부터']], [['말하기 결론부터 알맞은 길이와 속 도']], [['말하기 결론부터 알맞은 길이와 속 도 태 도']],
     [['말하기 결론부터 알맞은 길이와 속도 태도 시선']], [['말하기 결론부터 알맞은 길이와 속도 태도 시선 자세', 1]],
     [[' 한두 줄이면']], [[' 한두 줄이면 충분 합']], [[' 한두 줄이면 충분 합니다']], [[' 한두 줄이면 충분합니다', 1]]].forEach(function (p) { window.__sayParts(p); });
  });
  await p.waitForTimeout(50);
  확인('띄어쓰기도 크롬의 새 글을 따라 고쳐지는가(«속도 태도» · «충분합니다»)', await p.evaluate(() =>
       answers[0].transcript === '말하기 결론부터 알맞은 길이와 속도 태도 시선 자세 한두 줄이면 충분합니다'), await p.evaluate(() => answers[0].transcript));
  await p.evaluate(() => { answers[0].transcript = '안녕하세요 저는 고다윤입니다'; listenPaint(); });   // 아래 검사들이 보는 글로 되돌림
  console.log('\n── 끊겨서 다시 켜는 사이 (2026-10-14 핫스팟) ──');
  await p.evaluate(() => { LISTEN.fails = 5; window.__end(); }); await p.waitForTimeout(300);
  확인('잇달아 실패한 뒤 끊기면 «끊겨서 다시 켜는 중» 이 빨갛게', await p.evaluate(() => document.getElementById('livebox').getAttribute('data-on') === 'gap' && document.getElementById('live-state').textContent.indexOf('다시 켜는 중') > -1 && !LISTEN.on));
  await p.waitForTimeout(1000);
  확인('1초 뒤(전엔 3초) 다시 켜지고 빨간 표시가 꺼지는가', await p.evaluate(() => LISTEN.on && !LISTEN.gap && document.getElementById('livebox').getAttribute('data-on') === 'yes'), await p.evaluate(() => LISTEN.on + ' / ' + LISTEN.gap));
  await p.evaluate(() => { window.__end(); }); await p.waitForTimeout(1200); await p.evaluate(() => { window.__end(); }); await p.waitForTimeout(1200);
  확인('세 번 넘게 끊기면 «N번 끊겼다» 안내', (await p.evaluate(() => document.getElementById('live-hint').textContent)).indexOf('번 끊겼다') > -1, await p.evaluate(() => document.getElementById('live-hint').textContent));
  await p.evaluate(() => { LISTEN.fails = 0; window.__recs0 = window.__recs.length; });   // 끊김 시험으로 늘어난 개수는 여기서부터 셉니다

  console.log('\n── 들으면서 누르기 — 단추와 키보드 ──');
  확인('👍👎 단추는 없고(우수·보통·미흡과 겹쳐 뺌) 판정이 영역 표 위에 있는가', await p.evaluate(() => {
    var r = document.getElementById('rating-area'), g = document.getElementById('area-grid');
    return !document.getElementById('mark-good') && r && g && (r.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  await p.keyboard.press('2'); await p.waitForTimeout(50);
  확인('2 키로 «보통»', await p.evaluate(() => answers[0].rating === '보통'));
  확인('판정 단추가 눌린 채로 그려지는가', await p.evaluate(() => document.querySelector('#rating-area .rbtn[aria-pressed="true"]').textContent === '보통'));
  await p.keyboard.press('2'); await p.waitForTimeout(50);
  확인('같은 키를 또 누르면 지워지는가', await p.evaluate(() => answers[0].rating === null));
  await p.keyboard.press('1');
  // 영역별 판정
  await p.click('#area-grid .arearow:nth-child(1) .abtn.l0'); await p.waitForTimeout(50);
  await p.click('#area-grid .arearow:nth-child(3) .abtn.l2'); await p.waitForTimeout(50);
  확인('영역을 누르면 { 내용: 좋음, 말하기: 아쉬움 } 으로 남는가',
       await p.evaluate(() => answers[0].areas['내용'] === '좋음' && answers[0].areas['말하기'] === '아쉬움' && Object.keys(answers[0].areas).length === 2));
  await p.click('#area-grid .arearow:nth-child(1) .abtn.l1'); await p.waitForTimeout(50);
  확인('같은 줄에서 다른 것을 누르면 바뀌는가', await p.evaluate(() => answers[0].areas['내용'] === '보통'));
  await p.click('#area-grid .arearow:nth-child(1) .abtn.l1'); await p.waitForTimeout(50);
  확인('다시 누르면 지워지는가', await p.evaluate(() => !('내용' in answers[0].areas)));
  await p.click('#area-grid .arearow:nth-child(1) .abtn.l0');
  // 면접 중에 쓰는 칸
  await p.fill('#answer-memo', '동기가 또렷함'); await p.waitForTimeout(50);
  확인('면접 중에 쓴 평가가 남는가', await p.evaluate(() => answers[0].memo === '동기가 또렷함'));
  // 글자 칸에 커서가 있을 땐 끼어들지 않는다
  await p.evaluate(() => { var t = document.createElement('textarea'); t.id = 'tmp-ta'; document.getElementById('view-run').appendChild(t); t.focus(); });
  await p.keyboard.press('3'); await p.waitForTimeout(50);
  확인('글자 칸에 커서가 있으면 3 이 «미흡» 으로 안 가는가', await p.evaluate(() => answers[0].rating === '우수'));
  await p.evaluate(() => { document.getElementById('tmp-ta').remove(); document.body.focus(); });

  console.log('\n── 질문을 넘기면 글이 질문을 따라간다 ──');
  await p.evaluate(() => window.__say('그리고 또', false)); await p.waitForTimeout(50);
  // 아래 평가 표를 보다가 넘기는 상황 — 넘기면 질문 카드와 «답변 시작» 이 보이게 위로 올라와야 합니다
  await p.setViewportSize({ width: 1512, height: 600 });
  await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(100);
  const before = await p.evaluate(() => window.scrollY);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(900);
  확인('→ 키로 다음 질문', await p.evaluate(() => qIndex === 1));
  확인('넘기면 위로 올라가 «답변 시작» 이 보이는가', await p.evaluate(() => {
    var r = document.getElementById('btn-answer').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  }), '스크롤 ' + before + ' → ' + await p.evaluate(() => window.scrollY));
  await p.setViewportSize({ width: 1512, height: 1000 });
  확인('새 질문은 답변 시계가 멈춘 채 «답변 시작» 을 기다리는가',
       await p.evaluate(() => !answering && ticking && document.getElementById('btn-answer').textContent === '답변 시작'));
  확인('그래서 듣기도 멈췄는가', await p.evaluate(() => !LISTEN.on));
  await p.click('#btn-answer'); await p.waitForTimeout(200);
  확인('질문을 넘기기 전에 들은 말은 지난 질문에 남는가', await p.evaluate(() => answers[0].transcript === '안녕하세요 저는 고다윤입니다 그리고 또'), await p.evaluate(() => answers[0].transcript));
  확인('«답변 시작» 으로 새로 듣기 시작했는가(두 번째 인식)', await p.evaluate(() => LISTEN.on && LISTEN.qi === 1 && window.__recs.length === window.__recs0 + 1));
  확인('받아 적는 칸이 비워졌는가', (await p.evaluate(() => document.getElementById('live-text').textContent)).indexOf('고다윤') === -1);
  await p.evaluate(() => window.__say('열을 가하면 패치가', true)); await p.waitForTimeout(50);
  확인('두 번째 질문에 붙는가', await p.evaluate(() => answers[1].transcript === '열을 가하면 패치가'));
  const calls0 = await p.evaluate(() => window.__calls.filter(c => c.table === 'interview_answers' && c.op === 'upsert').length);
  확인('질문을 넘길 때 저장에 받아 적은 글이 들어가는가', await p.evaluate(() => {
    var c = window.__calls.filter(c => c.table === 'interview_answers' && c.op === 'upsert').pop();
    return c && c.v.transcript === '안녕하세요 저는 고다윤입니다 그리고 또' &&
           c.v.areas && c.v.areas['내용'] === '좋음' && c.v.memo === '동기가 또렷함';
  }), '저장 ' + calls0 + '번');

  console.log('\n── 크롬이 스스로 멈추면 다시 켠다 · 시계를 멈추면 같이 멈춘다 ──');
  await p.evaluate(() => window.__recs[window.__recs.length - 1].onend()); await p.waitForTimeout(400);
  확인('저절로 다시 켜지는가', await p.evaluate(() => LISTEN.on && window.__recs.length === window.__recs0 + 2));
  await p.click('#btn-answer'); await p.waitForTimeout(200);
  확인('«답변 끝» 을 누르면 듣기도 멈추는가', await p.evaluate(() => !LISTEN.on && !answering && ticking && !window.__recs[2].started));
  await p.click('#btn-answer'); await p.waitForTimeout(200);
  확인('다시 «답변 시작» 하면 다시 듣는가', await p.evaluate(() => LISTEN.on));
  await p.click('#btn-timer'); await p.waitForTimeout(200);
  확인('면접 전체를 멈추면 답변 시계·듣기도 멈추는가', await p.evaluate(() => !ticking && !answering && !LISTEN.on));
  await p.click('#btn-timer'); await p.waitForTimeout(200);
  확인('«이어서» 뒤에는 답변 시계가 저절로 안 켜지는가', await p.evaluate(() => ticking && !answering && !LISTEN.on));
  await p.keyboard.press(' '); await p.waitForTimeout(200);
  확인('Space 로 «답변 시작»', await p.evaluate(() => answering && LISTEN.on));
  await p.click('#btn-stt'); await p.waitForTimeout(200);
  확인('«받아 적기 끄기» 를 누르면 멈추고 기억하는가', await p.evaluate(() => !LISTEN.on && localStorage.getItem('listenOn') === '0'));
  await p.click('#btn-stt'); await p.waitForTimeout(200);
  확인('다시 켜면 듣는가', await p.evaluate(() => LISTEN.on));
  await p.evaluate(() => window.__fail('not-allowed')); await p.evaluate(() => window.__recs[window.__recs.length - 1].onend()); await p.waitForTimeout(400);
  확인('마이크를 막으면 끄고 까닭을 적는가',
       await p.evaluate(() => !LISTEN.on && document.getElementById('live-hint').textContent.indexOf('마이크') > -1 && localStorage.getItem('listenOn') === '0'));
  await p.click('#btn-stt'); await p.waitForTimeout(200);

  console.log('\n── 마무리 화면 — 받아 적은 글을 보며 평가 ──');
  await p.click('#btn-next'); await p.waitForTimeout(400);
  확인('마무리 화면인가', await p.evaluate(() => !!document.querySelector('#view-finish:not([hidden])')));
  확인('시계를 멈추면서 듣기도 멈췄는가', await p.evaluate(() => !LISTEN.on));
  const fin = await p.evaluate(() => {
    const r0 = document.getElementById('ansrow-0'), r1 = document.getElementById('ansrow-1');
    return {
      글0: r0.querySelector('.anssaid p').textContent, 글1: r1.querySelector('.anssaid p').textContent,
      자주: r0.querySelectorAll('.evalgrid .chip').length, 펼치기: !!r0.querySelector('.tagmore, .tagfull'),
      판정0: r0.querySelector('.rbtn[aria-pressed="true"]') && r0.querySelector('.rbtn[aria-pressed="true"]').textContent
    };
  });
  확인('첫 질문의 받아 적은 글이 보이는가', fin.글0 === '안녕하세요 저는 고다윤입니다 그리고 또', fin.글0);
  확인('두 번째 질문의 글도', fin.글1 === '열을 가하면 패치가');
  확인('영역 줄마다 단추가 다 보이고 펼치기는 없는가', fin.자주 >= 45 && !fin.펼치기, fin.자주 + '개');
  확인('면접 중에 1 키로 매긴 «우수» 가 그대로', fin.판정0 === '우수', fin.판정0);
  확인('면접 중에 누른 영역 판정이 마무리 화면 표에도 눌린 채로',
       await p.evaluate(() => document.querySelector('#ansrow-0 .eg-row:nth-child(2) .abtn.l0').getAttribute('aria-pressed') === 'true'));
  확인('면접 중에 쓴 평가가 마무리 화면 칸에 그대로', await p.evaluate(() => document.querySelector('#ansrow-0 .ansmemo-in').value === '동기가 또렷함'));
  await p.click('#ansrow-1 .eg-row:nth-child(6) .abtn.l2'); await p.waitForTimeout(50);
  확인('마무리 화면에서도 영역을 누를 수 있는가', await p.evaluate(() => answers[1].areas['전공 연결'] === '아쉬움'));
  await p.click('#ansrow-1 .evalgrid .chip.bad[data-tag="군더더기(음, 그)"]'); await p.waitForTimeout(100);
  확인('자주 쓰는 것을 누르면 저장되는가', await p.evaluate(() => answers[1].bad.indexOf('군더더기(음, 그)') > -1));
  await p.click('#ansrow-1 .ratingrow .rbtn:nth-of-type(3)'); await p.waitForTimeout(50);
  확인('노트북 너비에서 «말하기» 줄의 이름·단추·좋았던 점·아쉬운 점이 한 줄에, 요지 칸은 맨 아래', await p.evaluate(() => {
    var row = document.getElementById('ansrow-1');
    var r = row.querySelector('.eg-row:nth-child(4)');
    var kids = [r.querySelector('.arealabel'), r.querySelector('.areapicks'), r.querySelector('.chips.good'), r.querySelector('.chips.bad')].map(k => k.getBoundingClientRect());
    var m = row.querySelector('.ansmemo-in').getBoundingClientRect();
    var same = kids.every(k => Math.abs(k.top - kids[0].top) < 1.5 && Math.abs(k.bottom - kids[0].bottom) < 1.5);   // 윗선·아랫선 모두
    return same && kids[3].left > kids[2].left && kids[2].left >= kids[1].right - 1 && m.top >= kids[3].bottom;
  }));
  확인('한 질문의 평가 칸 높이가 560px 아래인가(전엔 약 700px)', await p.evaluate(() => {
    return document.querySelector('#ansrow-1 .anseval').getBoundingClientRect().height < 560;
  }), await p.evaluate(() => Math.round(document.querySelector('#ansrow-1 .anseval').getBoundingClientRect().height) + 'px'));
  확인('판정도 여기서', await p.evaluate(() => answers[1].rating === '미흡'));
  await p.fill('#ansrow-1 .ansmemo-in', '원리는 알지만 결론이 늦음'); await p.waitForTimeout(50);
  확인('요지도 여기서', await p.evaluate(() => answers[1].memo === '원리는 알지만 결론이 늦음'));

  console.log('\n── 면접 끝내기 — 한 번에 저장 ──');
  const dlP = p.waitForEvent('download', { timeout: 1500 }).catch(() => null);
  await p.click('#btn-finish'); await p.waitForTimeout(600);
  const dl = await dlP;
  확인('끝내면 녹음이 멈추고 띠에 파일 3개 — 저절로 내려받지는 않는가', !dl && await p.evaluate(() => !REC.on && REC.files.length === 3 && !document.getElementById('rec-files').hidden && !document.getElementById('view-report').hidden));
  확인('마이크 선을 끊었는가', await p.evaluate(() => !REC.on && window.__recorders[2].stream.__t.stopped));
  await p.evaluate(() => { window.__dropAsk = null; var c = window.confirm; window.confirm = function (m) { window.__dropAsk = m; return true; }; recDropFiles(); window.confirm = c; });
  확인('띠의 ✕ 는 안 받은 파일이 있으면 묻고 비우는가', await p.evaluate(() => /내려받지 않은/.test(window.__dropAsk || '') && REC.files.length === 0 && document.getElementById('rec-files').hidden));
  const saved = await 표(p, 'interview_answers');
  const s2 = saved.filter(r => r.seq === 2)[0];
  확인('서버 줄에 받아 적은 글·태그·판정·요지가 다 들어갔는가',
       s2 && s2.transcript === '열을 가하면 패치가' && s2.bad_tags.indexOf('군더더기(음, 그)') > -1 && s2.rating === '미흡' && s2.memo === '원리는 알지만 결론이 늦음' && s2.areas['전공 연결'] === '아쉬움',
       JSON.stringify(s2));
  확인('저장은 요청 한 번(배열 upsert)인가', await p.evaluate(() => {
    var c = window.__calls.filter(c => c.table === 'interview_answers' && c.op === 'upsert' && Array.isArray(c.v));
    return c.length === 1 && c[0].v.length === 2;
  }));
  확인('리포트 화면으로 넘어갔는가', await p.evaluate(() => !!document.querySelector('#view-report:not([hidden])')));
  확인('리포트에 「전공 연결 아쉬움」 이 보이는가', (await p.evaluate(() => document.getElementById('report-body').textContent)).indexOf('전공 연결 아쉬움') > -1);
  확인('리포트에 받아 적은 글이 질문마다 보이는가', await p.evaluate(() => {
    var said = Array.from(document.querySelectorAll('#report-body .anssaid p')).map(e => e.textContent);
    return said.length === 2 && said[0] === '안녕하세요 저는 고다윤입니다 그리고 또' && said[1] === '열을 가하면 패치가';
  }));
  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();

  // ── 2. 음성 인식이 없는 브라우저 ──
  console.log('\n── 음성 인식이 없는 브라우저 ──');
  const ctx2 = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx2.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx2.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx2.addInitScript(() => {
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
  });
  await ctx2.addInitScript((rows) => { window.__FAKE__ = { profile: { id: 't1', name: '이용휘', login_id: '이용휘', role: 'teacher' }, rows: rows }; }, ROWS());
  const p2 = await ctx2.newPage();
  const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto('http://127.0.0.1:8777/teacher/'); await p2.waitForSelector('#app:not([hidden])');
  await p2.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); await loadUnfinished(); });
  await p2.waitForTimeout(300);
  await p2.click('#unfinished-list button'); await p2.waitForTimeout(400);
  await p2.click('#btn-answer'); await p2.waitForTimeout(200);
  확인('«답변 시작» 하나로 면접 시계까지 켜지는가', await p2.evaluate(() => ticking && answering));
  확인('단추가 숨고 «크롬에서 열면» 안내가 보이는가',
       await p2.evaluate(() => document.getElementById('btn-stt').hidden && document.getElementById('live-hint').textContent.indexOf('크롬') > -1 && !LISTEN.on));
  await p2.keyboard.press('1'); await p2.waitForTimeout(50);
  확인('판정은 그대로 되는가', await p2.evaluate(() => answers[0].rating === '우수'));
  확인('콘솔 오류 없음', errs2.length === 0, errs2.join(' | '));

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
