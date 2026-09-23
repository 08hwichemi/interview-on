// 답안 연습장 — 엑셀로 저장 · 인쇄 (학생 · 교사 화면 공통, practice.js)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const SCH = '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c';

// 진짜 SheetJS 대신, 무엇을 «썼는지» 만 기록해 두는 가짜입니다.
const FAKE_XLSX = `
  window.XLSX = {
    utils: {
      aoa_to_sheet: function (aoa) { window.__lastAOA = aoa; return { __aoa: aoa }; },
      book_new: function () { return {}; },
      book_append_sheet: function (wb, ws, name) { window.__lastSheetName = name; }
    },
    writeFile: function (wb, filename) { window.__xlsxFile = filename; }
  };
`;

async function 열기(b, viewport, fake) {
  const ctx = await b.newContext({ viewport });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('**/xlsx*', r => r.fulfill({ contentType: 'application/javascript', body: FAKE_XLSX }));
  // 인쇄용 새 창도 이 컨텍스트에서 열리므로, 여기서 window.print 를 미리 가짜로 바꿔 둡니다.
  await ctx.addInitScript(() => { window.print = function () { window.__printed = true; }; });
  await ctx.addInitScript(f => { window.__FAKE__ = f; }, fake);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  const 답안들 = [
    { id: 'a1', student_id: 's1', grade: '공통', category: '인성',
      question: '자기소개를 해 주세요.', answer: '안녕하세요, 고다윤입니다.',
      created_at: '2026-09-20T01:00:00Z', updated_at: '2026-09-20T01:00:00Z' },
    { id: 'a2', student_id: 's1', grade: '3', category: '진로',
      question: '진로를 정한 계기는?', answer: '3학년 때 동아리 활동을 하면서입니다.',
      created_at: '2026-09-20T02:00:00Z', updated_at: '2026-09-20T02:00:00Z' }
  ];

  console.log('\n── 학생 화면 — 엑셀로 저장 · 인쇄 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 420, height: 900 }, {
      profile: { id: 'u1', role: 'student', name: '고다윤', login_id: '30101' },
      rows: {
        profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                     school_id: SCH, must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
        reviews: [], questions: [], practice_categories: [], practice_answers: 답안들, practice_comments: []
      }
    });
    await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active');
    await p.click('.menu-btn:has-text("답안 연습장")');
    await p.waitForSelector('#screen-practice.active');
    await p.waitForTimeout(300);

    await p.click('.prac-export button:has-text("엑셀로 저장")');
    await p.waitForTimeout(200);
    var aoa = await p.evaluate(() => window.__lastAOA);
    확인('파일 이름에 학생 이름이 들어가는가', await p.evaluate(() => window.__xlsxFile.indexOf('고다윤') > -1),
         await p.evaluate(() => window.__xlsxFile));
    확인('제목 줄이 «면접 질문지» 인가', aoa[0][1] === '면접 질문지');
    확인('머리글이 연번·학년·종류·질문·답변 인가', aoa[2].slice(1).join(',') === '연번,학년,종류,질문,답변', aoa[2].join(','));
    확인('두 답안이 다 담기는가(필터와 상관없이 전부)', aoa.length === 3 + 2, '줄수 ' + aoa.length);

    const [popup] = await Promise.all([
      ctx.waitForEvent('page'),
      p.click('.prac-export button:has-text("인쇄")')
    ]);
    await popup.waitForLoadState();
    await popup.waitForTimeout(200);
    확인('인쇄 창 제목에 학생 이름', (await popup.textContent('p.sub')) === '고다윤');
    확인('인쇄 표에 두 줄이 담기는가', (await popup.locator('tbody tr').count()) === 2);
    확인('불러오자마자 인쇄를 불렀는가', await popup.evaluate(() => window.__printed === true));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 교사 화면 — 엑셀로 저장 · 인쇄 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 1512, height: 1000 }, {
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                     school_id: SCH, must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 }],
        practice_categories: [], practice_answers: 답안들, practice_comments: []
      }
    });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { me = { id: 'u1', name: '이용휘' }; await loadStudents(); await pickStudent('s1'); });
    await p.click('#setup-tab-practice');
    await p.waitForTimeout(300);

    await p.click('#setup-practice .prac-export button:has-text("엑셀로 저장")');
    await p.waitForTimeout(200);
    확인('파일 이름에 학번·이름이 들어가는가',
         await p.evaluate(() => window.__xlsxFile.indexOf('30101') > -1 && window.__xlsxFile.indexOf('고다윤') > -1),
         await p.evaluate(() => window.__xlsxFile));

    const [popup] = await Promise.all([
      ctx.waitForEvent('page'),
      p.click('#setup-practice .prac-export button:has-text("인쇄")')
    ]);
    await popup.waitForLoadState();
    await popup.waitForTimeout(200);
    확인('인쇄 표에 두 줄이 담기는가', (await popup.locator('tbody tr').count()) === 2);
    확인('불러오자마자 인쇄를 불렀는가', await popup.evaluate(() => window.__printed === true));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
