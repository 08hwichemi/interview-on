// 답안 연습장 — 문제 번호(처음 쓴 순 자동) · 정렬 고르기 (학생 작성·조회 탭)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => {
    const a = (id, grade, category, q, c, u) => ({ id, student_id: 's1', school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c',
      grade, category, question: q, answer: '', created_at: c, updated_at: u });
    window.__FAKE__ = { rows: {
      profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                   school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
      students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
      reviews: [], questions: [], practice_categories: [], practice_comments: [],
      // 처음 쓴 순: 가(3·자율) → 나(1·진로) → 다(3·동아리). 최근 고친 순: 나 가 다 가 아니라 «가» 가 제일 최근
      practice_answers: [
        a('a1', '3', '자율', '가 질문', '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z'),
        a('a2', '1', '진로', '나 질문', '2026-09-02T00:00:00Z', '2026-09-10T00:00:00Z'),
        a('a3', '3', '동아리', '다 질문', '2026-09-03T00:00:00Z', '2026-09-20T00:00:00Z')
      ] } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
  await p.click('.menu-btn:has-text("답안 연습장")');
  await p.waitForSelector('#screen-practice.active'); await p.waitForTimeout(400);

  const qs = sel => p.evaluate(s => [...document.querySelectorAll(s + ' .prac-card')].map(c =>
    (c.querySelector('.prac-num') || {}).textContent + ':' + (c.querySelector('.prac-q-input,.prac-q-view') || {}).value + (c.querySelector('.prac-q-view') || {}).textContent), sel);

  console.log('\n── 작성 탭: 기본은 번호순 ──');
  let r = await p.evaluate(() => [...document.querySelectorAll('#prac-write-list .prac-card')].map(c => c.querySelector('.prac-num').textContent + ':' + c.querySelector('.prac-q-input').value));
  확인('번호순 1→2→3', JSON.stringify(r) === JSON.stringify(['1번:가 질문', '2번:나 질문', '3번:다 질문']), JSON.stringify(r));

  console.log('\n── 최근 고친 순으로 바꿔도 번호는 그대로 ──');
  await p.evaluate(() => practiceSetSort('recent'));
  r = await p.evaluate(() => [...document.querySelectorAll('#prac-write-list .prac-card')].map(c => c.querySelector('.prac-num').textContent));
  확인('최근 고친 순 = 1번·3번·2번', JSON.stringify(r) === JSON.stringify(['1번', '3번', '2번']), JSON.stringify(r));

  console.log('\n── 학년·분류순 ──');
  await p.evaluate(() => practiceSetSort('group'));
  r = await p.evaluate(() => [...document.querySelectorAll('#prac-write-list .prac-card')].map(c => c.querySelector('.prac-num').textContent));
  확인('1학년(2번) 먼저, 그다음 3학년 동아리(3번)·자율(1번)', JSON.stringify(r) === JSON.stringify(['2번', '3번', '1번']), JSON.stringify(r));

  console.log('\n── 필터를 걸어도 번호는 전체 기준 ──');
  await p.evaluate(() => { practiceSetSort('num'); practiceWriteToggleGrade('3'); });
  r = await p.evaluate(() => [...document.querySelectorAll('#prac-write-list .prac-card .prac-num')].map(e => e.textContent));
  확인('3학년만 걸어도 1번·3번(2번이 아님)', JSON.stringify(r) === JSON.stringify(['1번', '3번']), JSON.stringify(r));
  await p.evaluate(() => practiceWriteToggleGrade('3'));

  console.log('\n── 조회 탭: 같은 정렬 · 같은 번호 · 기기에 기억 ──');
  await p.evaluate(() => practiceSetSort('recent'));
  await p.click('button:has-text("조회")'); await p.waitForTimeout(400);
  r = await p.evaluate(() => [...document.querySelectorAll('#prac-browse-list .prac-card .prac-num')].map(e => e.textContent));
  확인('조회도 최근 고친 순(1·3·2번)', JSON.stringify(r) === JSON.stringify(['1번', '3번', '2번']), JSON.stringify(r));
  확인('정렬 칩이 필터 상자 안에 그려졌는가',
       await p.evaluate(() => document.querySelectorAll('#prac-sort-browse .prac-chip').length === 3 &&
         document.querySelector('#prac-sort-browse .prac-chip[aria-pressed="true"]').textContent === '최근 고친 순'));
  확인('고른 정렬이 기기에 남는가', await p.evaluate(() => localStorage.getItem('practiceSort') === 'recent'));

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ 실패 ' + 실패 : '\n✅ 모두 통과'); process.exit(실패 ? 1 : 0);
})();
