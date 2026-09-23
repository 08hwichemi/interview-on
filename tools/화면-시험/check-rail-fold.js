// 교사 화면(휴대폰): 학생을 고르면 왼쪽 학생 명단이 접혀서 스크롤이 줄어드는가.
// 칸이 쌓이는 900px 이하에서만 접히고, 컴퓨터(사이드바로 붙어 있을 때)는 늘 펼쳐져 있어야 합니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

async function 새페이지(b, width) {
  const ctx = await b.newContext({ viewport: { width: width, height: 900 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => {
    window.__FAKE__ = {
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                     school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
        students: [
          { id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 },
          { id: 's2', student_no: '30102', name: '김서준', auth_user_id: null, grade: 3, class_no: 1 }
        ],
        reviews: [], questions: [], interviews: [], interview_answers: [], susi_plans: []
      }
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); });
  await p.waitForTimeout(300);
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 휴대폰(400px) ──');
  {
    const { ctx, p, errs } = await 새페이지(b, 400);
    확인('학생을 고르기 전엔 접기 단추가 안 보이는가', await p.evaluate(() => getComputedStyle(document.getElementById('rail-fold-btn')).display === 'none'));

    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.waitForTimeout(200);
    확인('학생을 고르면 접기 단추가 보이는가', await p.evaluate(() => getComputedStyle(document.getElementById('rail-fold-btn')).display !== 'none'));
    확인('명단이 접혀 있는가(검색칸이 안 보임)', await p.evaluate(() => getComputedStyle(document.getElementById('search')).display === 'none'));
    확인('학생 목록도 접혀 있는가', await p.evaluate(() => getComputedStyle(document.getElementById('student-list')).display === 'none'));
    확인('단추에 고른 학생 이름이 보이는가', (await p.evaluate(() => document.getElementById('rail-fold-who').textContent)).indexOf('고다윤') > -1);
    확인('단추 글자가 「펼치기」인가', (await p.evaluate(() => document.getElementById('rail-fold-label').textContent)) === '펼치기');

    await p.click('#rail-fold-btn');
    await p.waitForTimeout(150);
    확인('누르면 명단이 다시 보이는가', await p.evaluate(() => getComputedStyle(document.getElementById('student-list')).display !== 'none'));
    확인('단추 글자가 「접기」로 바뀌는가', (await p.evaluate(() => document.getElementById('rail-fold-label').textContent)) === '접기');

    console.log('\n── 다른 학생을 고르면 다시 접히는가 ──');
    await p.evaluate(async () => { await pickStudent('s2'); });
    await p.waitForTimeout(200);
    확인('다시 접히는가', await p.evaluate(() => getComputedStyle(document.getElementById('student-list')).display === 'none'));
    확인('단추 이름도 바뀌는가', (await p.evaluate(() => document.getElementById('rail-fold-who').textContent)).indexOf('김서준') > -1);

    console.log('\n── 학생 목록으로 돌아가면 도로 펴지는가 ──');
    await p.evaluate(() => backToList());
    await p.waitForTimeout(200);
    확인('접기 단추가 다시 숨는가', await p.evaluate(() => getComputedStyle(document.getElementById('rail-fold-btn')).display === 'none'));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 컴퓨터(1200px): 접히지 않고 단추도 안 보이는가 ──');
  {
    const { ctx, p, errs } = await 새페이지(b, 1200);
    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.waitForTimeout(200);
    확인('접기 단추가 안 보이는가', await p.evaluate(() => getComputedStyle(document.getElementById('rail-fold-btn')).display === 'none'));
    확인('명단이 그대로 펼쳐져 있는가', await p.evaluate(() => getComputedStyle(document.getElementById('student-list')).display !== 'none'));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
