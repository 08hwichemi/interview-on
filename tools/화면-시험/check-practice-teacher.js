// 답안 연습장 — 교사 쪽 (다중선택 필터 · 읽기 전용 · 코멘트 남기기)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);

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
        ],
        practice_comments: []
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

  console.log('\n── 답안 연습장 탭 — 필터 없이 전부 보임 ──');
  await p.click('#setup-tab-practice');
  await p.waitForTimeout(300);
  확인('두 답안이 다 보이는가(필터 안 골랐으므로)',
       await p.evaluate(() => document.querySelectorAll('#t-prac-list .prac-card').length === 2));
  확인('학생이 만든 분류(창체)가 필터 칩에 있는가',
       (await p.evaluate(() => document.getElementById('t-prac-cat').textContent)).indexOf('창체') > -1);
  확인('읽기 전용인가(질문·답변 입력칸과 삭제 단추가 없음 — 코멘트 칸은 따로 있어도 됩니다)',
       await p.evaluate(() => document.querySelectorAll('#t-prac-list .prac-q-input, #t-prac-list .prac-a-input, #t-prac-list .prac-del').length === 0));

  console.log('\n── 필터 상자 — 처음엔 접힌 채 ──');
  확인('처음엔 접힌 채로 시작하는가', await p.evaluate(() => document.getElementById('fbox-body-teacher').hidden));
  await p.click('#fbox-head-teacher');
  확인('누르면 펼쳐지는가', await p.evaluate(() => !document.getElementById('fbox-body-teacher').hidden));

  await p.click('#t-prac-cat .prac-chip:has-text("창체")');
  await p.waitForTimeout(150);
  확인('창체만 필터하면 한 장만 남는가',
       await p.evaluate(() => document.querySelectorAll('#t-prac-list .prac-card').length === 1));
  await p.click('#t-prac-cat .prac-chip:has-text("창체")');   // 필터 도로 끄기
  await p.waitForTimeout(150);

  console.log('\n── 코멘트 남기기 ──');
  await p.click('#t-prac-list .prac-card:has-text("자기소개") .prac-comment-toggle');
  await p.waitForTimeout(150);
  확인('코멘트 입력칸이 보이는가(교사만)', await p.evaluate(() => !!document.querySelector('#t-prac-list textarea')));
  await p.fill('#t-prac-list .prac-card:has-text("자기소개") textarea', '자신감 있게 잘 썼습니다.');
  await p.click('#t-prac-list .prac-card:has-text("자기소개") button:has-text("코멘트 남기기")');
  await p.waitForTimeout(300);
  var comments = await 표(p, 'practice_comments');
  확인('서버에 코멘트가 쌓였는가', comments.length === 1 && comments[0].content === '자신감 있게 잘 썼습니다.');
  확인('그 선생님 이름이 남는가', comments[0].teacher_name === '이용휘');
  확인('화면에 바로 보이는가',
       (await p.locator('#t-prac-list .prac-card', { hasText: '자기소개' }).textContent()).indexOf('자신감 있게') > -1);

  console.log('\n── 다른 학생을 골라도 «답안 연습장» 탭을 그대로 이어 가는가 ──');
  await p.evaluate(async () => {
    window.__T.students.push({ id: 's2', student_no: '30102', name: '김서준', auth_user_id: null, grade: 3, class_no: 1 });
    await loadStudents();
    await pickStudent('s2');
  });
  await p.waitForTimeout(300);
  확인('«답안 연습장» 탭이 그대로 열려 있는가(귀찮게 다시 안 눌러도 됨)',
       await p.evaluate(() => !document.getElementById('setup-practice').hidden));

  console.log('\n── «면접 준비» 로 직접 돌아가면 그다음 학생도 «면접 준비» 부터 ──');
  await p.evaluate(async () => {
    document.getElementById('setup-tab-prep').click();
    window.__T.students.push({ id: 's3', student_no: '30103', name: '이하늘', auth_user_id: null, grade: 3, class_no: 1 });
    await loadStudents();
    await pickStudent('s3');
  });
  await p.waitForTimeout(300);
  확인('«면접 준비» 탭이 그대로 열려 있는가', await p.evaluate(() => !document.getElementById('setup-prep').hidden));

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
