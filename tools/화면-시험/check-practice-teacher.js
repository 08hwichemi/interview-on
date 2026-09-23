// 답안 연습장 — 교사 쪽 (학생을 고르면 «면접 준비 / 답안 연습장» 두 탭, 읽기 전용)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => {
    window.__FAKE__ = {
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                     school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 }],
        practice_categories: [{ id: 'c1', student_id: 's1', name: '창체' }],
        practice_answers: [
          { id: 'a1', student_id: 's1', grade: '3', category: '인성',
            question: '자기소개를 해 주세요.', answer: '안녕하세요, 고다윤입니다.',
            created_at: '2026-09-20T01:00:00Z', updated_at: '2026-09-20T01:00:00Z' },
          { id: 'a2', student_id: 's1', grade: '3', category: '창체',
            question: '창체 활동에서 기억에 남는 것은?', answer: '학급 자치회 활동입니다.',
            created_at: '2026-09-20T02:00:00Z', updated_at: '2026-09-20T02:00:00Z' }
        ]
      }
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); });
  await p.waitForTimeout(300);

  console.log('\n── 학생을 고르면 «면접 준비» 탭이 기본 ──');
  await p.evaluate(async () => { await pickStudent('s1'); });
  await p.waitForTimeout(300);
  확인('면접 준비가 보이는가', await p.evaluate(() => !document.getElementById('setup-prep').hidden));
  확인('답안 연습장은 접혀 있는가', await p.evaluate(() => document.getElementById('setup-practice').hidden));

  console.log('\n── 답안 연습장 탭으로 ──');
  await p.click('#setup-tab-practice');
  await p.waitForTimeout(300);
  확인('면접 준비는 접히는가', await p.evaluate(() => document.getElementById('setup-prep').hidden));
  확인('학생이 만든 분류(창체)가 보이는가',
       (await p.evaluate(() => document.getElementById('t-prac-cat').textContent)).indexOf('창체') > -1);

  await p.click('#t-prac-cat .prac-chip:has-text("인성")');
  await p.waitForTimeout(150);
  확인('인성 답안이 보이는가',
       (await p.evaluate(() => document.getElementById('t-prac-list').textContent)).indexOf('자기소개') > -1);
  확인('읽기 전용인가(입력칸 없음)',
       await p.evaluate(() => document.querySelectorAll('#t-prac-list textarea, #t-prac-list button.prac-del').length === 0));

  await p.click('#t-prac-cat .prac-chip:has-text("창체")');
  await p.waitForTimeout(150);
  확인('창체 답안이 보이는가',
       (await p.evaluate(() => document.getElementById('t-prac-list').textContent)).indexOf('학급 자치회') > -1);

  console.log('\n── 다른 학생을 고르면 다시 «면접 준비» 로 ──');
  await p.evaluate(async () => {
    window.__T.students.push({ id: 's2', student_no: '30102', name: '김서준', auth_user_id: null, grade: 3, class_no: 1 });
    await loadStudents();
    await pickStudent('s2');
  });
  await p.waitForTimeout(300);
  확인('«면접 준비» 로 되돌아오는가', await p.evaluate(() => !document.getElementById('setup-prep').hidden));

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
