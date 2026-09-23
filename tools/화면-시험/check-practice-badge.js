// 답안 연습장 — 코멘트 안읽음 빨간 숫자 (학생 홈)
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
    window.__FAKE__ = {
      rows: {
        profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                     school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
        reviews: [], questions: [],
        practice_categories: [],
        practice_answers: [
          { id: 'a1', student_id: 's1', grade: '3', category: '인성',
            question: '자기소개를 해 주세요.', answer: '안녕하세요.',
            created_at: '2026-09-20T01:00:00Z', updated_at: '2026-09-20T01:00:00Z' }
        ],
        practice_comments: [
          { id: 'cm1', answer_id: 'a1', teacher_name: '이용휘', content: '잘했습니다',
            created_at: '2026-09-21T01:00:00Z' },
          { id: 'cm2', answer_id: 'a1', teacher_name: '이용휘', content: '한 가지만 더 보완해 볼까요',
            created_at: '2026-09-22T01:00:00Z' }
        ],
        practice_comment_reads: []
      }
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
  await p.waitForTimeout(500);   // watchReports/practiceWatchComments 의 첫 새로고침을 기다립니다

  console.log('\n── 코멘트 두 개가 안 읽음 ──');
  확인('홈에 빨간 숫자 2가 뜨는가',
       await p.evaluate(() => document.getElementById('practice-badge').hidden === false
                           && document.getElementById('practice-badge').textContent === '2'));

  console.log('\n── 답안 연습장 조회에서 코멘트를 열어 보면 ──');
  await p.click('.menu-btn:has-text("답안 연습장")');
  await p.waitForSelector('#screen-practice.active');
  await p.click('#prac-tab-browse');
  await p.waitForTimeout(300);
  확인('코멘트 칩에 안읽음 배지(2)가 뜨는가',
       (await p.evaluate(() => document.querySelector('.prac-cbadge').textContent)) === '2');

  await p.click('.prac-comment-toggle');
  await p.waitForTimeout(400);
  var reads = await p.evaluate(() => window.__T.practice_comment_reads || []);
  확인('읽음 표시가 서버에 남는가(두 개 다)', reads.length === 2, reads.length + '건');

  await p.click('#prac-tab-write'); await p.click('#prac-tab-browse');   // 다시 그려서 확인
  await p.waitForTimeout(300);
  확인('다시 열어도 코멘트 배지가 사라졌는가', await p.evaluate(() => !document.querySelector('.prac-cbadge')));

  // 홈으로 돌아가면 숫자도 0
  await p.evaluate(() => navigateTo('home'));
  await p.waitForTimeout(200);
  await p.evaluate(() => practiceRefreshBadge());
  await p.waitForTimeout(200);
  확인('홈의 빨간 숫자도 사라지는가', await p.evaluate(() => document.getElementById('practice-badge').hidden === true));

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
