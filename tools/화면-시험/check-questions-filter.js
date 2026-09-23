// 「대학별 기출 질문」도 「실전 면접 후기」처럼 년도·전형·역량2 로 좁혀 볼 수 있는가
// (학생 화면 · 교사 화면 둘 다) — 그리고 교사 화면(휴대폰)에서 학생을 고르면
// 「지난 면접」「질문지 만들기」가 접혀서 스크롤이 줄어드는가.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const QUESTIONS = [
  { id: 'q1', '대학': '경북대', '년도': 2027, '전형_역량1': '학생부종합', '역량2': '전공적합성', '질문': '전공을 고른 이유는?' },
  { id: 'q2', '대학': '경북대', '년도': 2027, '전형_역량1': '학생부종합', '역량2': '인성', '질문': '갈등을 풀어 본 경험은?' },
  { id: 'q3', '대학': '경북대', '년도': 2026, '전형_역량1': '학생부교과', '역량2': '전공적합성', '질문': '지원 동기는?' },
  { id: 'q4', '대학': '한서대', '년도': 2027, '전형_역량1': '학생부종합', '역량2': '발전가능성', '질문': '앞으로의 계획은?' },
  // 일부 대학은 전형 이름 대신 역량 이름이 그대로 들어가 있습니다 — 전형 목록에서 뺍니다
  { id: 'q5', '대학': '경북대', '년도': 2027, '전형_역량1': '인성', '역량2': null, '질문': '봉사활동 경험은?' }
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── 1) 학생 화면 — 필터 연쇄 ──
  {
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.addInitScript((Q) => {
      window.__FAKE__ = {
        rows: {
          profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                       school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
          students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
          reviews: [], questions: Q, practice_categories: [], practice_answers: [], practice_comments: []
        }
      };
    }, QUESTIONS);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));

    await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });

    console.log('\n── 학생 화면: 대학별 기출 질문 ──');
    await p.click('.menu-btn:has-text("대학별 기출 질문")');
    await p.waitForSelector('#screen-questions.active');
    확인('처음엔 세부 필터가 숨어 있는가', await p.evaluate(() => getComputedStyle(document.getElementById('q-sub-filters')).display === 'none'));

    await p.evaluate(() => selectUniv('경북대'));
    await p.waitForTimeout(150);
    확인('대학을 고르면 세부 필터가 열리는가', await p.evaluate(() => getComputedStyle(document.getElementById('q-sub-filters')).display !== 'none'));
    확인('그 대학의 연도만 뜨는가 (2027, 2026)',
         (await p.evaluate(() => Array.from(document.getElementById('q-year').options).map(o => o.value).join(','))) === '전체,2027,2026');
    확인('일단 4건(경북대 전체)이 보이는가', await p.evaluate(() => document.querySelectorAll('#question-list .card').length) === 4);

    await p.selectOption('#q-year', '2027');
    await p.evaluate(() => updateQFilters('year'));
    await p.waitForTimeout(150);
    확인('연도를 2027로 좁히면 3건인가(학생부종합 2 + 인성 1)', await p.evaluate(() => document.querySelectorAll('#question-list .card').length) === 3);
    확인('전형 선택지가 연도에 맞게 좁혀지는가 (학생부종합만 — 「인성」은 전형이 아니라 빠짐)',
         (await p.evaluate(() => Array.from(document.getElementById('q-type1').options).map(o => o.value).join(','))) === '전체,학생부종합');

    await p.selectOption('#q-type1', '학생부종합');
    await p.evaluate(() => updateQFilters('type1'));
    await p.waitForTimeout(150);
    확인('역량2 선택지도 좁혀지는가 (전공적합성·인성)',
         (await p.evaluate(() => Array.from(document.getElementById('q-type2').options).map(o => o.value).sort().join(','))) === '인성,전공적합성,전체');

    await p.selectOption('#q-type2', '인성');
    await p.evaluate(() => updateQFilters('type2'));
    await p.waitForTimeout(150);
    확인('역량2까지 고르면 1건만 남는가', await p.evaluate(() => document.querySelectorAll('#question-list .card').length) === 1);
    확인('그 카드가 맞는 질문인가',
         (await p.evaluate(() => document.querySelector('#question-list .card').textContent)).indexOf('갈등을 풀어 본 경험') > -1);
    확인('누르지 않아도 질문이 처음부터 보이는가(펼치기 필요 없음)',
         await p.evaluate(() => getComputedStyle(document.querySelector('#question-list .card .card-body')).display !== 'none'));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── 2) 교사 화면 — 필터 연쇄 + 휴대폰 아코디언 ──
  {
    const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });   // 휴대폰 폭
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.addInitScript((Q) => {
      window.__FAKE__ = {
        rows: {
          profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                       school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
          students: [
            { id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 },
            { id: 's2', student_no: '30102', name: '김서준', auth_user_id: null, grade: 3, class_no: 1 }
          ],
          reviews: [], questions: Q, interviews: [], interview_answers: [], susi_plans: []
        }
      };
    }, QUESTIONS);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); await loadBrowseMeta(); });
    await p.waitForTimeout(300);

    console.log('\n── 교사 화면: 대학별 기출 질문 필터 ──');
    await p.click('#nav-questions');
    await p.waitForTimeout(150);
    await p.evaluate(() => selectUniv('경북대'));
    await p.waitForTimeout(150);
    확인('세부 필터가 열리는가', await p.evaluate(() => getComputedStyle(document.getElementById('q-sub-filters')).display !== 'none'));
    await p.selectOption('#q-year', '2027');
    await p.evaluate(() => updateQFilters('year'));
    await p.waitForTimeout(150);
    확인('연도로 좁히면 3건인가', await p.evaluate(() => document.querySelectorAll('#question-list .card').length) === 3);
    확인('전형 목록에 「인성」은 안 뜨는가(역량 이름이라 뺌)',
         (await p.evaluate(() => Array.from(document.getElementById('q-type1').options).map(o => o.value))).indexOf('인성') === -1);

    console.log('\n── 교사 화면(휴대폰): 학생을 고르면 「지난 면접」·「질문지」가 접혀 있는가 ──');
    await p.evaluate(() => goPage('interview'));
    await p.waitForTimeout(150);
    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.waitForTimeout(300);
    확인('지난 면접이 접혀 있는가', await p.evaluate(() => document.getElementById('history').hidden));
    확인('질문지 만들기가 접혀 있는가', await p.evaluate(() => document.getElementById('qsect-body').hidden));
    확인('지난 면접 단추 글자가 「펼치기」인가',
         (await p.evaluate(() => document.getElementById('history-acc-label').textContent)) === '펼치기');
    확인('질문지 단추 글자가 「펼치기」인가',
         (await p.evaluate(() => document.getElementById('qsect-more-label').textContent)) === '펼치기');

    await p.click('#history-acc-head');
    확인('지난 면접을 누르면 펼쳐지는가', await p.evaluate(() => !document.getElementById('history').hidden));
    await p.click('#qsect-head');
    확인('질문지를 누르면 펼쳐지는가', await p.evaluate(() => !document.getElementById('qsect-body').hidden));

    console.log('\n── 다른 학생을 골라도 펼친 상태가 남는가 ──');
    await p.evaluate(async () => { await pickStudent('s2'); });
    await p.waitForTimeout(300);
    확인('지난 면접이 펼친 채로 남는가', await p.evaluate(() => !document.getElementById('history').hidden));
    확인('질문지도 펼친 채로 남는가', await p.evaluate(() => !document.getElementById('qsect-body').hidden));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── 3) 교사 화면(컴퓨터 — 640px 초과): 학생을 고르면 처음부터 펴져 있는가 ──
  {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.addInitScript(() => {
      window.__FAKE__ = {
        rows: {
          profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                       school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
          students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 }],
          reviews: [], questions: [], interviews: [], interview_answers: [], susi_plans: []
        }
      };
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); await loadBrowseMeta(); });
    await p.waitForTimeout(300);

    console.log('\n── 교사 화면(컴퓨터): 학생을 고르면 처음부터 펼쳐져 있는가 ──');
    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.waitForTimeout(300);
    확인('지난 면접이 펴져 있는가', await p.evaluate(() => !document.getElementById('history').hidden));
    확인('질문지 만들기가 펴져 있는가', await p.evaluate(() => !document.getElementById('qsect-body').hidden));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
