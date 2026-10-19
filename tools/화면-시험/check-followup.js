// 질문 순서 바꾸기(▲ ▼) · 면접 도중 꼬리 질문 더하기 · 질문 빼기 (2026-10-12 선생님 말씀)
//
//   · 준비 화면 «낼 질문» 줄마다 ▲ ▼ — 한 칸씩 옮김 · 맨 위 ▲ / 맨 아래 ▼ 는 막힘 · 첫인사 · 끝인사는 그대로 맨 앞 · 맨 뒤
//   · 옮긴 순서대로 질문지가 저장되는가
//   · 꼬리 질문(2026-10-19 바뀜) — 새 질문이 아니라 질문 밑의 ↳ 줄. 시간 · 받아 적기 · 평가는 원래 질문 하나로
//     준비 화면 «＋ 꼬리» → ↳ 칸 · × 로 빼기 · ▲ ▼ 로 옮기면 따라감 · 질문지에 follow_ups 로 저장 · 다시 열면 그대로
//     진행 화면 «＋ 꼬리 질문» → 한 줄 칸 → «넣기»(Enter) — 질문 수 · 번호 · 답변 시계 · 받아 적기 그대로, 카드 밑에 ↳ 줄
//     글자를 안 적으면 아무것도 안 넣음 · Esc 로 닫힘 · × 로 빼기 · «질문 고치기» 다녀와도 그대로 · 마무리 화면 · 리포트에 ↳ 줄
//     지난 회차를 열었을 때는 단추가 없음
//   · «이 질문 삭제» — 받아 적은 글이 있으면 «같이 지워집니다» 를 묻고 · 표도 다시 씀 · 마지막을 빼면 앞 질문으로 · 하나 남으면 숨음
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const ROWS = () => ({
  profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘', must_change_password: false }],
  students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3 },
             { id: 's2', student_no: '30102', name: '나다은', auth_user_id: null, grade: 3 }],
  interviews: [
    { id: 'iv1', student_id: 's1', teacher_id: 't1', teacher_name: '이용휘', status: '진행중', started_at: '2026-10-12T09:00:00Z' },
    { id: 'iv0', student_id: 's2', teacher_id: 't1', teacher_name: '이용휘', status: '전달됨', started_at: '2026-10-01T09:00:00Z', grades: {} }
  ],
  interview_answers: [
    { id: 'a1', interview_id: 'iv1', seq: 1, competency: '기타', question: '먼저 간단히 자기소개를 해 주세요.', seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '' },
    { id: 'a2', interview_id: 'iv1', seq: 2, competency: '학업역량', question: '탐구는 무엇이 궁금해서 시작했나요?', seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '',
      follow_ups: ['그 궁금증은 풀렸나요?'] },
    { id: 'a3', interview_id: 'iv1', seq: 3, competency: '학업역량', question: '실험에서 가장 어려웠던 점은?', seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '' },
    { id: 'a0', interview_id: 'iv0', seq: 1, competency: '기타', question: '지난 질문', seconds: 30, good_tags: [], bad_tags: [], rating: '보통', memo: '' }
  ]
});

const FAKE_SR = () => {
  window.__recs = [];
  function R() { window.__recs.push(this); }
  R.prototype.start = function () {};
  R.prototype.stop = R.prototype.abort = function () { var me = this; setTimeout(function () { me.onend && me.onend(); }, 0); };
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
  window.__say = function (text) { var r = window.__recs[window.__recs.length - 1]; var one = [{ transcript: text }]; one.isFinal = true; r.onresult({ resultIndex: 0, results: [one] }); };
};

async function 새창(b, w) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await ctx.addInitScript(FAKE_SR);
  await ctx.addInitScript((rows) => {
    window.__FAKE__ = { profile: { id: 't1', name: '이용휘', role: 'teacher' }, rows: rows };
    try { localStorage.clear(); } catch (e) {}
  }, ROWS());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); await loadUnfinished(); });
  return { ctx, p, errs };
}
const 줄 = p => p.evaluate(() => [].map.call(document.querySelectorAll('#q-list .qrow input'), i => i.value));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 질문 순서 바꾸기 ──');
  const A = await 새창(b, 1440);
  let p = A.p;
  await p.click('#student-list .railrow[onclick*="s2"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { addQuestion('가 질문', '학업역량'); addQuestion('나 질문', '진로역량'); addQuestion('다 질문', '공동체역량'); });
  확인('줄마다 ▲ ▼ 가 있는가', await p.evaluate(() => document.querySelectorAll('#q-list .qrow .qmove').length === 6));
  확인('맨 위 ▲ · 맨 아래 ▼ 는 막혀 있는가', await p.evaluate(() => {
    var m = document.querySelectorAll('#q-list .qmove'); return m[0].disabled && !m[1].disabled && !m[4].disabled && m[5].disabled;
  }));
  await p.click('#q-list .qrow:nth-child(3) .qmove[data-d="-1"]'); await p.waitForTimeout(100);
  확인('셋째 ▲ → 가 · 다 · 나', JSON.stringify(await 줄(p)) === JSON.stringify(['가 질문', '다 질문', '나 질문']), JSON.stringify(await 줄(p)));
  확인('역량도 질문을 따라가는가', await p.evaluate(() => midQuestions[1].competency === '공동체역량'));
  확인('초점이 옮긴 줄의 ▲ 로 따라가 이어 누를 수 있는가', await p.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains('qmove') && document.activeElement.closest('.qrow') === document.querySelectorAll('#q-list .qrow')[1]));
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  확인('Enter 로 한 번 더 → 다 · 가 · 나', JSON.stringify(await 줄(p)) === JSON.stringify(['다 질문', '가 질문', '나 질문']), JSON.stringify(await 줄(p)));
  await p.click('#q-list .qrow:nth-child(1) .qmove[data-d="1"]'); await p.waitForTimeout(100);
  확인('첫째 ▼ → 가 · 다 · 나', JSON.stringify(await 줄(p)) === JSON.stringify(['가 질문', '다 질문', '나 질문']));
  확인('첫인사 · 끝인사는 그대로 맨 앞 · 맨 뒤', await p.evaluate(() => {
    var l = composeQuestions(); return l[0].slot === 'opening' && l[l.length - 1].slot === 'closing' && l[2].text === '다 질문';
  }));
  await p.click('#btn-save-sheet'); await p.waitForTimeout(400);
  확인('바꾼 순서대로 질문지가 저장되는가', await p.evaluate(() => {
    var rows = window.__T.interview_answers.filter(a => a.interview_id === sheetId).sort((a, z) => a.seq - z.seq).map(a => a.question);
    return rows[1] === '가 질문' && rows[2] === '다 질문' && rows[3] === '나 질문';
  }));
  await p.setViewportSize({ width: 400, height: 900 }); await p.waitForTimeout(200);
  확인('400px — 옆으로 안 넘치고 ▲ ▼ 가 보이는가', await p.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('#q-list .qmove').getBoundingClientRect().width > 20));
  await A.ctx.close();

  console.log('\n── 준비 화면에서 꼬리 질문 미리 적기 ──');
  const P = await 새창(b, 1440);
  p = P.p;
  await p.click('#student-list .railrow[onclick*="s2"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { addQuestion('가 질문', '학업역량'); addQuestion('나 질문', '진로역량'); });
  확인('질문 줄마다 «＋ 꼬리» 단추', await p.evaluate(() => document.querySelectorAll('#q-list .qrow .qfadd').length === 2));
  await p.click('#q-list .qrow:nth-child(1) .qfadd'); await p.waitForTimeout(100);
  확인('누르면 그 질문 밑에 ↳ 칸이 생기고 커서가 감', await p.evaluate(() => {
    var r = document.querySelectorAll('#q-list .qrow')[0], box = r.nextElementSibling;
    return box && box.classList.contains('qfollows') && document.activeElement === box.querySelector('input') && /↳/.test(box.textContent);
  }));
  await p.keyboard.type('가 꼬리 하나');
  await p.click('#q-list .qrow:nth-child(1) .qfadd'); await p.waitForTimeout(100);
  await p.keyboard.type('가 꼬리 둘');
  확인('꼬리 질문 두 줄이 그 질문에', await p.evaluate(() => JSON.stringify(midQuestions[0].follow) === JSON.stringify(['가 꼬리 하나', '가 꼬리 둘'])));
  확인('질문 줄(.qrow) 수는 그대로 2 · «질문 N개» 도 그대로', await p.evaluate(() => document.querySelectorAll('#q-list .qrow').length === 2 &&
    composeQuestions().length === 4));
  // ▲ ▼ 로 옮기면 꼬리 질문도 따라감
  await p.evaluate(() => moveQuestion(0, 1)); await p.waitForTimeout(100);
  확인('▼ 로 옮기면 꼬리 질문도 따라 아래로', await p.evaluate(() => {
    var rows = document.querySelectorAll('#q-list .qrow');
    return midQuestions[1].text === '가 질문' && midQuestions[1].follow.length === 2 && !midQuestions[0].follow &&
           rows[1].nextElementSibling && rows[1].nextElementSibling.classList.contains('qfollows') &&
           !(rows[0].nextElementSibling && rows[0].nextElementSibling.classList.contains('qfollows'));
  }));
  // 빈 꼬리 칸은 저장에서 빠짐
  await p.evaluate(() => addPrepFollow(0)); await p.waitForTimeout(50);   // «나 질문» 에 빈 꼬리 칸 하나
  await p.click('#btn-save-sheet'); await p.waitForTimeout(400);
  확인('질문지에 follow_ups 로 저장 · 빈 칸은 빠짐', await p.evaluate(() => {
    var rows = window.__T.interview_answers.filter(a => a.interview_id === sheetId).sort((a, z) => a.seq - z.seq);
    var ga = rows.find(a => a.question === '가 질문'), na = rows.find(a => a.question === '나 질문');
    return JSON.stringify(ga.follow_ups) === JSON.stringify(['가 꼬리 하나', '가 꼬리 둘']) && JSON.stringify(na.follow_ups) === '[]' &&
           rows.every(a => Array.isArray(a.follow_ups));
  }));
  // × 로 빼기
  await p.evaluate(() => { var rows = document.querySelectorAll('#q-list .qrow'); rows[1].nextElementSibling.querySelector('.qfrow:first-child .linkbtn').click(); });
  await p.waitForTimeout(100);
  확인('× 로 그 꼬리 질문만 빠짐', await p.evaluate(() => JSON.stringify(midQuestions[1].follow) === JSON.stringify(['가 꼬리 둘'])));
  await p.click('#btn-save-sheet'); await p.waitForTimeout(400);
  // 다른 학생 갔다 오면 저장한 질문지에 꼬리 질문이 그대로
  await p.click('#student-list .railrow[onclick*="s1"]'); await p.waitForTimeout(300);
  await p.click('#student-list .railrow[onclick*="s2"]'); await p.waitForTimeout(500);
  확인('질문지를 다시 열면 꼬리 질문이 그대로', await p.evaluate(() => {
    var q = midQuestions.find(x => x.text === '가 질문');
    return q && JSON.stringify(q.follow) === JSON.stringify(['가 꼬리 둘']) && /가 꼬리 둘/.test(document.querySelector('#q-list .qfollows input').value);
  }));
  // 면접 화면으로 — 카드 밑에 ↳ 줄
  await p.click('#btn-start'); await p.waitForTimeout(400);
  await p.evaluate(() => { qIndex = questions.findIndex(q => q.text === '가 질문'); showQuestion(); });
  확인('면접 화면 그 질문 카드 밑에 ↳ 꼬리 질문', await p.evaluate(() => {
    var f = document.getElementById('run-follow'); return !f.hidden && /↳\s*가 꼬리 둘/.test(f.textContent);
  }));
  await p.evaluate(() => { qIndex = questions.findIndex(q => q.text === '나 질문'); showQuestion(); });
  확인('꼬리 질문이 없는 질문에서는 그 칸이 숨음', await p.evaluate(() => document.getElementById('run-follow').hidden));
  await p.setViewportSize({ width: 400, height: 900 }); await p.evaluate(() => { editQuestions(); }); await p.waitForTimeout(300);
  확인('400px — 꼬리 칸이 옆으로 안 넘침', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 &&
    [...document.querySelectorAll('#q-list .qfrow')].every(r => r.getBoundingClientRect().right <= innerWidth)));
  확인('페이지 오류 없음', P.errs.length === 0, P.errs.join(' | '));
  await P.ctx.close();

  console.log('\n── 면접 도중 꼬리 질문 ──');
  const B = await 새창(b, 1440);
  p = B.p;
  await p.click('#unfinished-list button'); await p.waitForTimeout(400);
  확인('진행 화면에 «＋ 꼬리 질문» 단추', await p.evaluate(() => { var b = document.getElementById('btn-follow'); return !!b && !b.hidden && b.offsetWidth > 0; }));
  확인('불러온 면접의 꼬리 질문(2번)이 그대로', await p.evaluate(() => JSON.stringify(questions[1].follow) === JSON.stringify(['그 궁금증은 풀렸나요?'])));
  await p.click('#btn-timer'); await p.waitForTimeout(100);
  await p.click('#btn-answer'); await p.waitForTimeout(100);
  await p.evaluate(() => window.__say('저는 고다윤입니다'));
  await p.keyboard.press('1');
  const 전 = await p.evaluate(() => ({ n: questions.length, recs: window.__recs.length }));
  await p.click('#btn-follow');
  확인('누르면 한 줄 칸이 열리고 커서가 가는가', await p.evaluate(() => !document.getElementById('follow-box').hidden && document.activeElement.id === 'follow-text'));
  await p.keyboard.type('그 경험에서 가장 크게 배운 점은?');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  확인('새 질문이 안 생김 — 질문 수 · 번호 그대로', await p.evaluate((n) => questions.length === n && qIndex === 0 &&
    document.getElementById('run-step').textContent === '1 / ' + n, 전.n));
  확인('지금 질문 카드 밑에 ↳ 줄', await p.evaluate(() => {
    var f = document.getElementById('run-follow');
    return JSON.stringify(questions[0].follow) === JSON.stringify(['그 경험에서 가장 크게 배운 점은?']) && !f.hidden && /그 경험에서 가장 크게 배운 점은\?/.test(f.textContent);
  }));
  확인('칸은 닫히고 비워졌는가', await p.evaluate(() => document.getElementById('follow-box').hidden && document.getElementById('follow-text').value === ''));
  확인('답변 시계 · 받아 적기가 멈추지 않고 이어짐(음성 인식을 새로 만들지 않음)', await p.evaluate((r) => answering && window.__recs.length === r, 전.recs));
  await p.evaluate(() => window.__say('협업의 중요성을 배웠습니다'));
  확인('꼬리 질문에 한 답도 같은 질문에 이어 붙음', await p.evaluate(() => answers[0].transcript === '저는 고다윤입니다 협업의 중요성을 배웠습니다' && answers[0].rating === '우수'));
  확인('표에 꼬리 질문이 저장됨(그 질문 줄의 follow_ups)', await p.evaluate(() => {
    var r = window.__T.interview_answers.find(a => a.interview_id === 'iv1' && a.seq === 1);
    return r && JSON.stringify(r.follow_ups) === JSON.stringify(['그 경험에서 가장 크게 배운 점은?']);
  }));
  // 글자 없이 넣기 — 아무것도 안 넣음
  await p.click('#btn-follow'); await p.click('#follow-add'); await p.waitForTimeout(300);
  확인('글자 없이 «넣기» 는 아무것도 안 넣고 닫힘', await p.evaluate(() => questions[0].follow.length === 1 && document.getElementById('follow-box').hidden));
  // Esc 로 닫기
  await p.click('#btn-follow'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  확인('Esc 로 칸이 닫힘', await p.evaluate(() => document.getElementById('follow-box').hidden && questions[0].follow.length === 1));
  // 칸에 치는 동안 1 2 3 · Space 가 끼어들지 않는가
  await p.evaluate(() => { answers[0].rating = null; renderRating(); });
  await p.click('#btn-follow'); await p.keyboard.type('1 2'); await p.waitForTimeout(100);
  확인('칸에 치는 «1 2» 는 판정으로 안 감', await p.evaluate(() => answers[0].rating === null && document.getElementById('follow-text').value === '1 2'));
  await p.keyboard.press('Escape');
  await p.evaluate(() => { document.getElementById('follow-text').value = ''; });
  // 하나 더 넣고 × 로 빼기
  await p.click('#btn-follow'); await p.keyboard.type('지울 꼬리'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.click('#run-follow .runfrow:nth-child(2) .linkbtn'); await p.waitForTimeout(300);
  확인('× 로 그 줄만 빠지고 표에도', await p.evaluate(() => {
    var r = window.__T.interview_answers.find(a => a.interview_id === 'iv1' && a.seq === 1);
    return questions[0].follow.length === 1 && r.follow_ups.length === 1 && document.querySelectorAll('#run-follow .runfrow').length === 1;
  }));
  // 질문 고치기 다녀와도 그대로 (첫인사에 붙은 꼬리 질문까지)
  await p.click('#btn-prev'); await p.waitForTimeout(400);
  확인('«← 질문 고치기» 에서 2번 질문 밑에 꼬리 질문', await p.evaluate(() => {
    var q = midQuestions.find(x => x.text === '탐구는 무엇이 궁금해서 시작했나요?'); return q && q.follow[0] === '그 궁금증은 풀렸나요?';
  }));
  await p.click('#btn-start'); await p.waitForTimeout(400);
  확인('돌아와도 꼬리 질문 · 받아 적은 글이 그대로', await p.evaluate(() =>
    questions[0].follow[0] === '그 경험에서 가장 크게 배운 점은?' && questions[1].follow[0] === '그 궁금증은 풀렸나요?' &&
    answers[0].transcript.indexOf('협업') > -1));
  // 마무리 화면 · 리포트
  await p.evaluate(() => { qIndex = questions.length - 1; showQuestion(); });
  await p.click('#btn-next'); await p.waitForTimeout(400);
  확인('마무리 화면에도 그 질문 밑에 ↳ 꼬리 질문', await p.evaluate(() => /그 경험에서 가장 크게 배운 점은\?/.test(document.getElementById('ansrow-0').textContent) &&
    /그 궁금증은 풀렸나요\?/.test(document.getElementById('ansrow-1').textContent)));
  확인('리포트(reportHTML)에 ↳ 줄', await p.evaluate(() => {
    var html = reportHTML({ started_at: '2026-10-19T00:00:00Z', grades: {} }, [{ seq: 1, question: '큰 질문', follow_ups: ['작은 질문'], seconds: 30 }], '학생', 1);
    var d = document.createElement('div'); d.innerHTML = html;
    var f = d.querySelector('.ansfollow'); return !!f && /↳\s*작은 질문/.test(f.textContent);
  }));
  await p.evaluate(() => backToRun()); await p.waitForTimeout(300);

  console.log('\n── 면접 도중 질문 삭제 ──');
  B.묻기 = [];
  // 빈 질문(3번)부터
  await p.evaluate(() => { qIndex = questions.findIndex(q => q.text === '실험에서 가장 어려웠던 점은?'); showQuestion(); });
  확인('질문 번호 옆에 «이 질문 삭제»', await p.evaluate(() => { var b = document.getElementById('btn-delq'); return !b.hidden && b.offsetWidth > 0; }));
  p.removeAllListeners('dialog');
  p.on('dialog', d => { B.묻기.push(d.message()); d.accept(); });
  const 앞수 = await p.evaluate(() => questions.length);
  await p.click('#btn-delq'); await p.waitForTimeout(400);
  확인('빈 질문은 그냥 묻고 빠지는가(«같이 지워집니다» 없음)', B.묻기.length === 1 && B.묻기[0].indexOf('같이 지워집니다') === -1, B.묻기[0]);
  확인('질문이 하나 줄고 표도 같이', await p.evaluate((n) => questions.length === n - 1 &&
    window.__T.interview_answers.filter(a => a.interview_id === 'iv1').length === n - 1 && questions.every(q => q.text !== '실험에서 가장 어려웠던 점은?'), 앞수));
  확인('그 자리의 질문이 보이는가', await p.evaluate(() => document.getElementById('run-question').textContent === questions[qIndex].text &&
    document.getElementById('run-step').textContent === (qIndex + 1) + ' / ' + questions.length));
  확인('표를 다시 써도 꼬리 질문이 남는가', await p.evaluate(() => {
    var r = window.__T.interview_answers.find(a => a.interview_id === 'iv1' && a.question === '탐구는 무엇이 궁금해서 시작했나요?');
    return r && r.follow_ups[0] === '그 궁금증은 풀렸나요?';
  }));
  // 받아 적은 글이 있는 질문을 뺄 때는 «같이 지워집니다», 아니오를 누르면 그대로
  await p.evaluate(() => { qIndex = 0; showQuestion(); });
  p.removeAllListeners('dialog');
  p.on('dialog', d => { B.묻기.push(d.message()); d.dismiss(); });
  const 지금수 = await p.evaluate(() => questions.length);
  await p.click('#btn-delq'); await p.waitForTimeout(300);
  확인('받아 적은 글이 있으면 «같이 지워집니다» 를 묻고, «취소» 면 그대로', B.묻기[1] && B.묻기[1].indexOf('같이 지워집니다') > -1 && await p.evaluate((n) => questions.length === n, 지금수));
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.accept());
  // 마지막 질문을 빼면 그 앞 질문으로 (지금 질문 둘: 자기소개 · 탐구)
  await p.evaluate(() => { qIndex = questions.length - 1; showQuestion(); });
  await p.click('#btn-delq'); await p.waitForTimeout(400);
  확인('마지막 질문을 빼면 앞 질문으로 · 단추가 «면접 마무리 →»', await p.evaluate(() =>
    questions.length === 1 && qIndex === 0 && document.getElementById('btn-next').textContent === '면접 마무리 →'));
  확인('남은 첫 질문의 받아 적은 글 · 꼬리 질문은 그대로', await p.evaluate(() => answers[0].transcript.indexOf('저는 고다윤입니다') === 0 &&
    questions[0].follow[0] === '그 경험에서 가장 크게 배운 점은?'));
  확인('질문이 하나 남으면 «이 질문 삭제» 가 숨는가', await p.evaluate(() => document.getElementById('btn-delq').hidden));

  await p.setViewportSize({ width: 400, height: 900 }); await p.waitForTimeout(200);
  확인('400px — 단추 줄이 옆으로 안 넘침', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  확인('페이지 오류 없음', B.errs.length === 0, B.errs.join(' | '));
  await B.ctx.close();

  console.log('\n── 지난 회차를 열었을 때 ──');
  const C = await 새창(b, 1440);
  p = C.p;
  await p.evaluate(async () => { target = students[1]; await openPast('iv0', 1); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { backToFinish(); backToRun(); }); await p.waitForTimeout(200);
  확인('지난 회차를 고칠 때는 «＋ 꼬리 질문» · «이 질문 삭제» 가 없음', await p.evaluate(() =>
    !document.getElementById('view-run').hidden && document.getElementById('btn-follow').hidden && document.getElementById('btn-delq').hidden));
  await p.evaluate(() => { questions[0].follow = ['지난 꼬리']; showQuestion(); });
  확인('지난 회차의 꼬리 질문 줄에는 × 가 없음', await p.evaluate(() => !document.getElementById('run-follow').hidden &&
    !document.querySelector('#run-follow .linkbtn')));
  await C.ctx.close();

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
