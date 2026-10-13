// 학생 면접 연습 — «녹음» 과 «글로 받아 적기» 중 하나 고르기 (2026-10-13)
//
// 녹음과 받아 적기를 동시에 켜는 것은 안드로이드 크롬에서 안 돼 접었고(할-일.md), 학생이 둘 중 하나를 고릅니다.
// 이 작업 환경에는 마이크가 없으므로 크롬의 음성 인식을 **가짜**(window.__say 로 말을 넣음)로 바꿔 끼웁니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const ROWS = () => ({
  profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
               school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
  students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
  reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: [], practice_offers: []
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
  window.__say = function (text, final) {
    var r = window.__recs[window.__recs.length - 1];
    var one = [{ transcript: text }]; one.isFinal = !!final;
    r.onresult({ resultIndex: 0, results: [one] });
  };
  window.__fail = function (kind) { var r = window.__recs[window.__recs.length - 1]; r.onerror({ error: kind }); };
  window.__end = function () { var r = window.__recs[window.__recs.length - 1]; r.started = false; r.onend && r.onend(); };
};
// 받아 적기가 없는 브라우저(삼성 인터넷 · 카톡) 흉내
const NO_SR = () => { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (e) {}
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
  Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }); };

async function 열기(b, init, width) {
  const ctx = await b.newContext({ viewport: { width: width || 420, height: 900 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  if (init) await ctx.addInitScript(init);
  await ctx.addInitScript((rows) => { window.__FAKE__ = { rows: rows }; try { localStorage.removeItem('smartInterviewQs'); } catch (e) {} }, ROWS());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dialogs = []; p.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
  await p.evaluate(() => navigateTo('interview-setup'));
  await p.waitForSelector('#screen-interview-setup.active');
  // 질문 0개 → 도입 · 마무리 두 질문만
  await p.selectOption('#changche-count', '0'); await p.selectOption('#major-count', '0');
  await p.click('button:has-text("스톱워치 훈련 시작")'); await p.waitForTimeout(200);
  return { ctx, p, errs, dialogs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 크롬(음성 인식 있음) — 고르기 창 ──');
  let { ctx, p, errs, dialogs } = await 열기(b, FAKE_SR);
  확인('고르기 창이 떴는가', await p.evaluate(() => document.getElementById('recording-modal').style.display === 'flex'));
  확인('선택지가 녹음 · 글로 받아 적기 · 시간만 셋인가',
       await p.evaluate(() => [...document.querySelectorAll('#modal-record-select option')].map(o => o.value).join(',') === 'yes,text,no'));
  확인('«글로 받아 적기» 가 눌리는가(막히지 않음)', await p.evaluate(() => !document.querySelector('#modal-record-select option[value="text"]').disabled));
  확인('처음(녹음)의 설명에 «둘 중 하나만» 이 적혀 있는가', (await p.evaluate(() => document.getElementById('modal-record-hint').textContent)).indexOf('둘 중 하나만') > -1);
  await p.selectOption('#modal-record-select', 'text'); await p.waitForTimeout(50);
  확인('«글로 받아 적기» 를 고르면 설명이 바뀌는가(소리는 남지 않음)', (await p.evaluate(() => document.getElementById('modal-record-hint').textContent)).indexOf('소리는 남지 않습니다') > -1);
  await p.selectOption('#modal-mode-select', 'manual');
  await p.click('button:has-text("훈련 시작하기")'); await p.waitForTimeout(300);

  console.log('\n── 받아 적기로 답변 ──');
  확인('면접 화면으로', await p.evaluate(() => document.getElementById('screen-interview-run').classList.contains('active')));
  확인('받아 적기 칸이 보이고 «답변 시작을 누르고» 안내', await p.evaluate(() => {
    var b = document.getElementById('mock-live'); return !b.hidden && document.getElementById('mock-live-state').textContent.indexOf('답변 시작') > -1; }));
  확인('아직 음성 인식을 안 만들었는가', await p.evaluate(() => window.__recs.length === 0));
  확인('마이크(getUserMedia) 경고창이 안 떴는가 — 녹음은 안 켬', dialogs.length === 0, dialogs.join(' | '));
  await p.click('#mock-timer-btn'); await p.waitForTimeout(1200);
  확인('«답변 시작» 을 누르면 듣기 시작', await p.evaluate(() => MOCK_LISTEN.on && window.__recs.length === 1 && window.__recs[0].started));
  확인('ko-KR · 계속 듣기 · 확정 전 글도', await p.evaluate(() => { var r = window.__recs[0]; return r.lang === 'ko-KR' && r.continuous === true && r.interimResults === true; }));
  확인('«받아 적는 중» 표시', (await p.evaluate(() => document.getElementById('mock-live-state').textContent)).indexOf('받아 적는 중') > -1);
  확인('시계도 흐르는가', await p.evaluate(() => isTimerRunning && secondsElapsed >= 1));
  await p.evaluate(() => window.__say('안녕하세요 저는', false)); await p.waitForTimeout(50);
  확인('확정 전 글은 회색으로, 아직 저장 안 됨', await p.evaluate(() => !!document.querySelector('#mock-live-text .interim') && (textResults[0] || '') === ''));
  await p.evaluate(() => window.__say('안녕하세요 저는 고다윤입니다', true)); await p.waitForTimeout(50);
  확인('확정된 글이 첫 질문에 붙는가', await p.evaluate(() => textResults[0] === '안녕하세요 저는 고다윤입니다'), await p.evaluate(() => textResults[0]));
  확인('화면에도 검은 글로', await p.evaluate(() => document.getElementById('mock-live-text').textContent.indexOf('고다윤입니다') > -1 && !document.querySelector('#mock-live-text .interim')));
  // 크롬이 조용해서 스스로 멈추면 — 다시 켬
  await p.evaluate(() => window.__end()); await p.waitForTimeout(400);
  확인('스스로 멈추면 다시 켜는가', await p.evaluate(() => MOCK_LISTEN.on && window.__recs.length === 2 && window.__recs[1].started), await p.evaluate(() => window.__recs.length));
  await p.evaluate(() => window.__say('<b>물리</b>를 좋아합니다', true)); await p.waitForTimeout(50);
  확인('이어 말한 것이 띄어서 붙고, 꺾쇠는 글자로만', await p.evaluate(() => textResults[0] === '안녕하세요 저는 고다윤입니다 <b>물리</b>를 좋아합니다' && !document.querySelector('#mock-live-text b')));
  await p.evaluate(() => window.__say('마지막 말', false));
  await p.click('#mock-timer-btn'); await p.waitForTimeout(300);
  확인('«답변 완료» 를 누르면 끄고, 확정 전 글도 붙이는가', await p.evaluate(() => !MOCK_LISTEN.on && textResults[0].endsWith('마지막 말') && !window.__recs[1].started));
  확인('«받아 적은 답변» 표시로 바뀌고 글은 남아 있는가', await p.evaluate(() => document.getElementById('mock-live-state').textContent.indexOf('받아 적은 답변') > -1 && document.getElementById('mock-live-text').textContent.indexOf('마지막 말') > -1));
  확인('결과에 시간이 남는가', await p.evaluate(() => interviewResults[0] && interviewResults[0].seconds >= 1));
  // 다시 답변하기 → 글이 비워짐
  await p.click('#mock-timer-btn'); await p.waitForTimeout(100);   // «다시 답변하기»
  await p.click('#mock-timer-btn'); await p.waitForTimeout(200);   // «답변 시작»
  확인('«다시 답변하기» 뒤 다시 시작하면 글이 비는가', await p.evaluate(() => textResults[0] === '' && MOCK_LISTEN.on));
  await p.evaluate(() => window.__say('다시 한 자기소개', true));
  await p.click('#mock-timer-btn'); await p.waitForTimeout(200);
  await p.click('#mock-next-btn'); await p.waitForTimeout(300);
  확인('다음 질문으로 가면 받아 적기 칸이 비는가', await p.evaluate(() => currentMockIndex === 1 && document.getElementById('mock-live-text').textContent === '' && !MOCK_LISTEN.on));

  console.log('\n── 마이크가 막혔을 때 ──');
  await p.click('#mock-timer-btn'); await p.waitForTimeout(200);
  const 개수 = await p.evaluate(() => window.__recs.length);
  await p.evaluate(() => window.__fail('not-allowed')); await p.evaluate(() => window.__end()); await p.waitForTimeout(400);
  확인('«마이크 사용이 막혀» 안내가 뜨고 다시 켜지 않는가', await p.evaluate((n) => document.getElementById('mock-live-state').textContent.indexOf('마이크 사용이 막혀') > -1 && !MOCK_LISTEN.on && window.__recs.length === n, 개수),
       await p.evaluate(() => document.getElementById('mock-live-state').textContent + ' / ' + window.__recs.length + ' / ' + MOCK_LISTEN.on));
  확인('시계는 그대로 흐르는가(면접은 이어짐)', await p.evaluate(() => isTimerRunning));
  await p.waitForTimeout(1100);
  await p.click('#mock-timer-btn'); await p.waitForTimeout(200);
  await p.click('#mock-next-btn'); await p.waitForTimeout(400);

  console.log('\n── 결과 리포트 ──');
  확인('결과 화면으로', await p.evaluate(() => document.getElementById('screen-interview-result').classList.contains('active')));
  확인('카드 두 장에 «받아 적은 답변» 칸이 있는가', await p.evaluate(() => document.querySelectorAll('#result-container .result-card').length === 2 && document.querySelectorAll('#result-container .mock-said').length === 2));
  확인('첫 카드에 받아 적은 글', await p.evaluate(() => document.querySelectorAll('#result-container .mock-said')[0].textContent.indexOf('다시 한 자기소개') > -1));
  확인('둘째 카드는 «받아 적힌 말이 없습니다»', await p.evaluate(() => document.querySelectorAll('#result-container .mock-said')[1].textContent.indexOf('받아 적힌 말이 없습니다') > -1));
  확인('«이 답변 듣기» 는 없는가(녹음 안 함)', await p.evaluate(() => !document.querySelector('#result-container button[onclick^="playGlobalAudio"]')));
  확인('옆으로 넘치지 않는가(420px)', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  확인('자바스크립트 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();

  console.log('\n── 녹음을 고르면 받아 적기는 안 켬 ──');
  ({ ctx, p, errs, dialogs } = await 열기(b, FAKE_SR));
  await p.selectOption('#modal-record-select', 'yes'); await p.selectOption('#modal-mode-select', 'manual');
  await p.click('button:has-text("훈련 시작하기")'); await p.waitForTimeout(400);
  확인('받아 적기 칸이 숨어 있는가', await p.evaluate(() => document.getElementById('mock-live').hidden));
  await p.click('#mock-timer-btn'); await p.waitForTimeout(300);
  확인('음성 인식을 만들지 않는가', await p.evaluate(() => window.__recs.length === 0 && !isTextOptedIn));
  await p.click('#mock-timer-btn'); await p.waitForTimeout(100);
  await p.click('#mock-next-btn'); await p.waitForTimeout(100);
  await p.click('#mock-timer-btn'); await p.waitForTimeout(200); await p.click('#mock-timer-btn'); await p.waitForTimeout(100);
  await p.click('#mock-next-btn'); await p.waitForTimeout(300);
  확인('결과에 «받아 적은 답변» 칸이 없는가', await p.evaluate(() => document.querySelectorAll('#result-container .mock-said').length === 0));
  확인('자바스크립트 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();

  console.log('\n── 받아 적기가 없는 브라우저 ──');
  ({ ctx, p, errs } = await 열기(b, NO_SR));
  확인('«글로 받아 적기» 가 막혀 있고 «이 브라우저에는 없음» 이라 적혔는가',
       await p.evaluate(() => { var o = document.querySelector('#modal-record-select option[value="text"]'); return o.disabled && o.textContent.indexOf('없음') > -1; }));
  await p.selectOption('#modal-record-select', 'no'); await p.waitForTimeout(50);
  확인('«시간만» 을 고르면 «크롬으로 열면» 안내', (await p.evaluate(() => document.getElementById('modal-record-hint').textContent)).indexOf('크롬으로 열면') > -1);
  await p.selectOption('#modal-mode-select', 'manual');
  await p.click('button:has-text("훈련 시작하기")'); await p.waitForTimeout(300);
  확인('받아 적기 칸이 숨어 있고 면접은 돈다', await p.evaluate(() => document.getElementById('mock-live').hidden && document.getElementById('screen-interview-run').classList.contains('active')));
  확인('자바스크립트 오류 없음', errs.length === 0, errs.join(' | '));
  await ctx.close();

  await b.close();
  console.log(실패 ? `\n❌ ${실패}개 실패` : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
