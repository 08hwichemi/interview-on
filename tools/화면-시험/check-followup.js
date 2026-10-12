// 질문 순서 바꾸기(▲ ▼) · 면접 도중 꼬리 질문 더하기 (2026-10-12 선생님 말씀)
//
//   · 준비 화면 «낼 질문» 줄마다 ▲ ▼ — 한 칸씩 옮김 · 맨 위 ▲ / 맨 아래 ▼ 는 막힘 · 첫인사 · 끝인사는 그대로 맨 앞 · 맨 뒤
//   · 옮긴 순서대로 질문지가 저장되는가
//   · 진행 화면 «＋ 꼬리 질문» → 한 줄 칸 → «넣기»(Enter) — 지금 질문 바로 뒤에 들어가고 그리로 넘어감
//   · 지금 질문에 받아 적은 글 · 평가는 그대로 · 표의 질문 순서도 맞게 다시 써짐
//   · 글자를 안 적으면 «꼬리 질문 (N번에 이어서)» · Esc 로 닫힘 · 지난 회차를 열었을 때는 단추가 없음
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
    { id: 'a2', interview_id: 'iv1', seq: 2, competency: '학업역량', question: '탐구는 무엇이 궁금해서 시작했나요?', seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '' },
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

  console.log('\n── 면접 도중 꼬리 질문 ──');
  const B = await 새창(b, 1440);
  p = B.p;
  await p.click('#unfinished-list button'); await p.waitForTimeout(400);
  확인('진행 화면에 «＋ 꼬리 질문» 단추', await p.evaluate(() => { var b = document.getElementById('btn-follow'); return !!b && !b.hidden && b.offsetWidth > 0; }));
  await p.click('#btn-answer'); await p.waitForTimeout(100);
  await p.evaluate(() => window.__say('저는 고다윤입니다'));
  await p.keyboard.press('1');
  await p.click('#btn-follow');
  확인('누르면 한 줄 칸이 열리고 커서가 가는가', await p.evaluate(() => !document.getElementById('follow-box').hidden && document.activeElement.id === 'follow-text'));
  await p.keyboard.type('그 경험에서 가장 크게 배운 점은?');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  확인('지금 질문 바로 뒤(2번)에 들어가고 그리로 넘어갔는가', await p.evaluate(() =>
    questions.length === 3 && qIndex === 1 && questions[1].text === '그 경험에서 가장 크게 배운 점은?' && questions[2].text === '탐구는 무엇이 궁금해서 시작했나요?'));
  확인('화면의 질문 카드 · 번호가 바뀌었는가', await p.evaluate(() =>
    document.getElementById('run-question').textContent === '그 경험에서 가장 크게 배운 점은?' && document.getElementById('run-step').textContent === '2 / 3'));
  확인('칸은 닫히고 비워졌는가', await p.evaluate(() => document.getElementById('follow-box').hidden && document.getElementById('follow-text').value === ''));
  확인('앞 질문의 받아 적은 글 · 판정은 그대로', await p.evaluate(() => answers[0].transcript === '저는 고다윤입니다' && answers[0].rating === '우수'));
  확인('새 질문은 «답변 시작» 을 기다리는가(답변 시계 멈춤)', await p.evaluate(() => !answering && document.getElementById('btn-answer').textContent === '답변 시작'));
  확인('표의 질문 순서가 1 · 꼬리 · 2 로 다시 써졌는가(앞 질문 글도)', await p.evaluate(() => {
    var rows = window.__T.interview_answers.filter(a => a.interview_id === 'iv1').sort((a, z) => a.seq - z.seq);
    return rows.length === 3 && rows[1].question === '그 경험에서 가장 크게 배운 점은?' && rows[2].question === '탐구는 무엇이 궁금해서 시작했나요?' &&
           rows[0].transcript === '저는 고다윤입니다';
  }));
  확인('왼쪽 진행 상황에도 세 줄', await p.evaluate(() => document.querySelectorAll('#progress-list .railrow').length === 3));
  확인('역량은 앞 질문을 따름', await p.evaluate(() => questions[1].competency === '기타'));
  // 꼬리 질문에 답 → 받아 적기가 그 질문에 붙는가
  await p.click('#btn-answer'); await p.waitForTimeout(100);
  await p.evaluate(() => window.__say('협업의 중요성을 배웠습니다'));
  확인('꼬리 질문의 받아 적기가 그 질문에 붙는가', await p.evaluate(() => answers[1].transcript === '협업의 중요성을 배웠습니다'));
  // 글자 없이 넣기
  await p.click('#btn-follow'); await p.click('#follow-add'); await p.waitForTimeout(400);
  확인('글자 없이 넣으면 «꼬리 질문 (2번에 이어서)»', await p.evaluate(() => questions[2].text === '꼬리 질문 (2번에 이어서)' && qIndex === 2 && questions.length === 4));
  // Esc 로 닫기
  await p.click('#btn-follow'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  확인('Esc 로 칸이 닫히고 질문은 안 늘어남', await p.evaluate(() => document.getElementById('follow-box').hidden && questions.length === 4));
  // 칸에 치는 동안 1 2 3 · Space 가 끼어들지 않는가
  await p.click('#btn-follow'); await p.keyboard.type('1 2'); await p.waitForTimeout(100);
  확인('칸에 치는 «1 2» 는 판정 · 답변 시작으로 안 감', await p.evaluate(() => answers[2].rating === null && !answering && document.getElementById('follow-text').value === '1 2'));
  await p.keyboard.press('Escape');
  // 마무리까지 — 질문 «고치기» 로 돌아가도 꼬리 질문이 낼 질문에 있는가
  await p.evaluate(() => { qIndex = 0; showQuestion(); });
  await p.click('#btn-prev'); await p.waitForTimeout(400);
  확인('«← 질문 고치기» 에서 꼬리 질문이 «낼 질문» 제자리에', await p.evaluate(() => {
    var v = [].map.call(document.querySelectorAll('#q-list .qrow input'), i => i.value);
    return v.indexOf('그 경험에서 가장 크게 배운 점은?') > -1;
  }));
  await p.click('#btn-start'); await p.waitForTimeout(400);
  확인('돌아와도 꼬리 질문의 받아 적은 글이 그대로', await p.evaluate(() => answers[questions.findIndex(q => q.text === '그 경험에서 가장 크게 배운 점은?')].transcript === '협업의 중요성을 배웠습니다'));
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
  확인('지난 회차를 고칠 때는 «＋ 꼬리 질문» 이 없음', await p.evaluate(() => !document.getElementById('view-run').hidden && document.getElementById('btn-follow').hidden));
  await C.ctx.close();

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
