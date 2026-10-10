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
  R.prototype.start = function () { this.started = true; };
  R.prototype.stop = R.prototype.abort = function () {
    this.started = false; var me = this; setTimeout(function () { me.onend && me.onend(); }, 0);
  };
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
  // 말을 넣습니다. final=true 면 확정된 글
  window.__say = function (text, final) {
    var r = window.__recs[window.__recs.length - 1];
    var one = [{ transcript: text }]; one.isFinal = !!final;
    r.onresult({ resultIndex: 0, results: [one] });
  };
  window.__fail = function (kind) { var r = window.__recs[window.__recs.length - 1]; r.onerror({ error: kind }); };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── 1. 크롬(음성 인식 있음) ──
  const ctx = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE_SR);
  await ctx.addInitScript((rows) => {
    window.__FAKE__ = { profile: { id: 't1', name: '이용휘', login_id: '이용휘', role: 'teacher' }, rows: rows };
    try { localStorage.removeItem('listenOn'); localStorage.removeItem('tagUse'); } catch (e) {}
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
  확인('진행 화면에 태그는 없고, 쓰는 칸(평가·요지)은 있는가',
       await p.evaluate(() => !document.getElementById('tag-area') && !!document.getElementById('answer-memo')));
  확인('영역 다섯 줄 × 좋음·보통·아쉬움 표가 있는가',
       await p.evaluate(() => document.querySelectorAll('#area-grid .arearow').length === 5 && document.querySelectorAll('#area-grid .abtn').length === 15));

  console.log('\n── 면접 시계와 답변 시계 ──');
  await p.click('#btn-timer'); await p.waitForTimeout(1300);
  확인('«면접 시작» 만으로는 면접 전체만 흐르고 답변 시계는 안 흐르는가',
       await p.evaluate(() => ticking && !answering && seconds === 0 && totalSeconds >= 1), await p.evaluate(() => seconds + ' / ' + totalSeconds));
  확인('«면접 시작» 만으로는 듣지 않는가', await p.evaluate(() => !LISTEN.on && window.__recs.length === 0));
  await p.click('#btn-answer'); await p.waitForTimeout(1300);
  확인('«답변 시작» 을 누르면 답변 시계가 흐르는가', await p.evaluate(() => answering && seconds >= 1), await p.evaluate(() => seconds));
  확인('단추가 «답변 끝» 으로', (await p.evaluate(() => document.getElementById('btn-answer').textContent)) === '답변 끝');
  확인('듣기 시작했는가', await p.evaluate(() => LISTEN.on && window.__recs.length === 1 && window.__recs[0].started));
  확인('«받아 적는 중» 표시', (await p.evaluate(() => document.getElementById('live-state').textContent)).indexOf('받아 적는 중') > -1);
  await p.evaluate(() => window.__say('안녕하세요 저는', false)); await p.waitForTimeout(50);
  확인('확정 전 글은 회색으로 보이고 아직 저장되지 않는가',
       await p.evaluate(() => !!document.querySelector('#live-text .interim') && answers[0].transcript === ''));
  await p.evaluate(() => window.__say('안녕하세요 저는 고다윤입니다', true)); await p.waitForTimeout(50);
  확인('확정된 글이 첫 질문에 붙는가', await p.evaluate(() => answers[0].transcript === '안녕하세요 저는 고다윤입니다'), await p.evaluate(() => answers[0].transcript));
  확인('화면에도 보이는가', (await p.evaluate(() => document.getElementById('live-text').textContent)).indexOf('고다윤입니다') > -1);

  console.log('\n── 들으면서 찍기 — 단추와 키보드 ──');
  await p.click('#mark-good'); await p.waitForTimeout(50);
  확인('👍 를 누르면 몇 초째인지와 함께 남는가', await p.evaluate(() => answers[0].marks.length === 1 && answers[0].marks[0].k === 'good' && typeof answers[0].marks[0].t === 'number'));
  확인('단추에 숫자 1', (await p.evaluate(() => document.getElementById('mark-good-n').textContent)) === '1');
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50);
  확인('↓ 키로 👎', await p.evaluate(() => answers[0].marks.length === 2 && answers[0].marks[1].k === 'bad'));
  await p.keyboard.press('Backspace'); await p.waitForTimeout(50);
  확인('Backspace 로 마지막 찍은 것을 지우는가', await p.evaluate(() => answers[0].marks.length === 1));
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
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(50);
  확인('글자 칸에 커서가 있으면 ↑ 가 👍 로 안 가는가', await p.evaluate(() => answers[0].marks.length === 1));
  await p.evaluate(() => { document.getElementById('tmp-ta').remove(); document.body.focus(); });

  console.log('\n── 질문을 넘기면 글이 질문을 따라간다 ──');
  await p.evaluate(() => window.__say('그리고 또', false)); await p.waitForTimeout(50);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  확인('→ 키로 다음 질문', await p.evaluate(() => qIndex === 1));
  확인('새 질문은 답변 시계가 멈춘 채 «답변 시작» 을 기다리는가',
       await p.evaluate(() => !answering && ticking && document.getElementById('btn-answer').textContent === '답변 시작'));
  확인('그래서 듣기도 멈췄는가', await p.evaluate(() => !LISTEN.on));
  await p.click('#btn-answer'); await p.waitForTimeout(200);
  확인('확정 전 글은 지난 질문에 붙여 두는가', await p.evaluate(() => answers[0].transcript === '안녕하세요 저는 고다윤입니다 그리고 또'), await p.evaluate(() => answers[0].transcript));
  확인('«답변 시작» 으로 새로 듣기 시작했는가(두 번째 인식)', await p.evaluate(() => LISTEN.on && LISTEN.qi === 1 && window.__recs.length === 2));
  확인('받아 적는 칸이 비워졌는가', (await p.evaluate(() => document.getElementById('live-text').textContent)).indexOf('고다윤') === -1);
  await p.evaluate(() => window.__say('열을 가하면 패치가', true)); await p.waitForTimeout(50);
  확인('두 번째 질문에 붙는가', await p.evaluate(() => answers[1].transcript === '열을 가하면 패치가'));
  const calls0 = await p.evaluate(() => window.__calls.filter(c => c.table === 'interview_answers' && c.op === 'upsert').length);
  확인('질문을 넘길 때 저장에 받아 적은 글이 들어가는가', await p.evaluate(() => {
    var c = window.__calls.filter(c => c.table === 'interview_answers' && c.op === 'upsert').pop();
    return c && c.v.transcript === '안녕하세요 저는 고다윤입니다 그리고 또' && Array.isArray(c.v.marks) && c.v.marks.length === 1 &&
           c.v.areas && c.v.areas['내용'] === '좋음' && c.v.memo === '동기가 또렷함';
  }), '저장 ' + calls0 + '번');

  console.log('\n── 크롬이 스스로 멈추면 다시 켠다 · 시계를 멈추면 같이 멈춘다 ──');
  await p.evaluate(() => window.__recs[window.__recs.length - 1].onend()); await p.waitForTimeout(400);
  확인('저절로 다시 켜지는가', await p.evaluate(() => LISTEN.on && window.__recs.length === 3));
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
      찍은0: r0.querySelector('.ansmarks').textContent, 찍은1: !!r1.querySelector('.ansmarks'),
      자주: r0.querySelectorAll('.tagrow.quick .chip').length, 접힘: r0.querySelector('.tagfull').hidden,
      판정0: r0.querySelector('.rbtn[aria-pressed="true"]') && r0.querySelector('.rbtn[aria-pressed="true"]').textContent
    };
  });
  확인('첫 질문의 받아 적은 글이 보이는가', fin.글0 === '안녕하세요 저는 고다윤입니다 그리고 또', fin.글0);
  확인('두 번째 질문의 글도', fin.글1 === '열을 가하면 패치가');
  확인('찍은 순간이 «0:00 👍» 꼴로', /👍/.test(fin.찍은0), fin.찍은0);
  확인('안 찍은 질문에는 그 줄이 없는가', !fin.찍은1);
  확인('자주 쓰는 것이 보이고 나머지는 접혀 있는가', fin.자주 > 0 && fin.자주 <= 14 && fin.접힘, fin.자주 + '개');
  확인('면접 중에 1 키로 매긴 «우수» 가 그대로', fin.판정0 === '우수', fin.판정0);
  확인('면접 중에 누른 영역 판정이 마무리 화면 표에도 눌린 채로',
       await p.evaluate(() => document.querySelector('#ansrow-0 .areagrid .arearow:nth-child(1) .abtn.l0').getAttribute('aria-pressed') === 'true'));
  확인('면접 중에 쓴 평가가 마무리 화면 칸에 그대로', await p.evaluate(() => document.querySelector('#ansrow-0 .ansmemo-in').value === '동기가 또렷함'));
  await p.click('#ansrow-1 .areagrid .arearow:nth-child(5) .abtn.l2'); await p.waitForTimeout(50);
  확인('마무리 화면에서도 영역을 누를 수 있는가', await p.evaluate(() => answers[1].areas['전공 연결'] === '아쉬움'));
  await p.click('#ansrow-1 .tagrow.quick .chip.bad[data-tag="군더더기(음, 그)"]'); await p.waitForTimeout(100);
  확인('자주 쓰는 것을 누르면 저장되는가', await p.evaluate(() => answers[1].bad.indexOf('군더더기(음, 그)') > -1));
  await p.click('#ansrow-1 .rbtn:nth-child(3)'); await p.waitForTimeout(50);
  확인('판정도 여기서', await p.evaluate(() => answers[1].rating === '미흡'));
  await p.fill('#ansrow-1 .ansmemo-in', '원리는 알지만 결론이 늦음'); await p.waitForTimeout(50);
  확인('요지도 여기서', await p.evaluate(() => answers[1].memo === '원리는 알지만 결론이 늦음'));

  console.log('\n── 면접 끝내기 — 한 번에 저장 ──');
  await p.click('#btn-finish'); await p.waitForTimeout(600);
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
  await p2.keyboard.press('ArrowUp'); await p2.waitForTimeout(50);
  확인('👍 는 그대로 되는가', await p2.evaluate(() => answers[0].marks.length === 1));
  확인('콘솔 오류 없음', errs2.length === 0, errs2.join(' | '));

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
