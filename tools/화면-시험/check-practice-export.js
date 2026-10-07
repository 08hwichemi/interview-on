// 답안 연습장 — 엑셀로 저장 · 인쇄 (학생 · 교사 화면 공통, practice.js)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const SCH = '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c';

// 엑셀 내려받기는 ExcelJS 로 만듭니다. 인터넷(CDN) 대신 깔려 있는 진짜 ExcelJS 를
// 끼워 넣고, 실제로 내려받아진 .xlsx 를 다시 열어서 꾸밈까지 확인합니다.
//   준비: npm i -g exceljs@4.4.0  (NODE_PATH 가 가리키는 곳에 깔리면 됩니다)
const ExcelJS = require('exceljs');
const EXCELJS_SRC = fs.readFileSync(require.resolve('exceljs/dist/exceljs.min.js'), 'utf8');

// 내려받은 파일을 열어 봅니다.
async function 엑셀_열기(download) {
  const file = await download.path();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb.worksheets[0];
}

async function 열기(b, viewport, fake) {
  // 서비스 워커가 CDN 요청을 먼저 가로채면 아래 route 가 안 먹으므로 꺼 둡니다.
  const ctx = await b.newContext({ viewport, acceptDownloads: true, serviceWorkers: 'block' });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('**/xlsx*', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await ctx.route('**/exceljs*', r => r.fulfill({ contentType: 'application/javascript', body: EXCELJS_SRC }));
  // 인쇄용 새 창도 이 컨텍스트에서 열리므로, 여기서 window.print 를 미리 가짜로 바꿔 둡니다.
  await ctx.addInitScript(() => { window.print = function () { window.__printed = true; }; });
  // 시험용 크로뮴은 한글 파일 이름을 «download» 로 바꿔 저장해 버려서(진짜 크롬은 괜찮음),
  // 파일 이름은 내려받기 링크에 적힌 이름으로 봅니다.
  await ctx.addInitScript(() => {
    var click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlName = this.download; return click.call(this); };
  });
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
      question: '진로를 정한 계기는?',
      answer: '3학년 때 동아리 활동을 하면서입니다. '.repeat(20) + '\n둘째 문단입니다.\n셋째 문단입니다.',
      created_at: '2026-09-20T02:00:00Z', updated_at: '2026-09-20T02:00:00Z' }
  ];

  console.log('\n── 학생 화면 — xlsx 저장 · 인쇄 (단추 이름은 2026-10-07 에 «xlsx 저장» 으로 줄임) ──');
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

    const [dl] = await Promise.all([
      p.waitForEvent('download'),
      p.click('.prac-export button:has-text("xlsx 저장")')
    ]);
    const 이름 = await p.evaluate(() => window.__dlName);
    확인('파일 이름에 학생 이름이 들어가는가', /고다윤.*\.xlsx$/.test(이름), 이름);
    const ws = await 엑셀_열기(dl);
    확인('시트 이름이 «면접 질문지» 인가', ws.name === '면접 질문지', ws.name);
    확인('제목 줄이 «면접 질문지» 인가', ws.getCell('B1').value === '면접 질문지');
    const head = [2, 3, 4, 5, 6].map(c => ws.getRow(3).getCell(c).value).join(',');
    확인('머리글이 연번·학년·종류·질문·답변 인가', head === '연번,학년,종류,질문,답변', head);
    확인('두 답안이 다 담기는가(필터와 상관없이 전부)',
         ws.getCell('E4').value === '자기소개를 해 주세요.' && ws.getCell('E5').value === '진로를 정한 계기는?' && !ws.getCell('E6').value);
    확인('머리글에 필터가 걸려 있는가', !!ws.autoFilter && JSON.stringify(ws.autoFilter).indexOf('3') > -1, JSON.stringify(ws.autoFilter));
    const v = (ws.views || [])[0] || {};
    확인('머리글(3행)까지 틀 고정인가', v.state === 'frozen' && v.ySplit === 3, JSON.stringify(v));
    확인('질문·답변 칸이 자동 줄바꿈인가',
         ws.getCell('E5').alignment && ws.getCell('E5').alignment.wrapText === true &&
         ws.getCell('F5').alignment && ws.getCell('F5').alignment.wrapText === true);
    확인('답이 긴 줄이 짧은 줄보다 높은가', ws.getRow(5).height > ws.getRow(4).height * 2,
         ws.getRow(4).height + ' / ' + ws.getRow(5).height);
    확인('답변 칸이 질문 칸보다 넓은가', ws.getColumn(6).width > ws.getColumn(5).width,
         ws.getColumn(5).width + ' / ' + ws.getColumn(6).width);
    확인('머리글에 배경색과 굵은 글씨', ws.getCell('F3').fill && ws.getCell('F3').fill.fgColor && ws.getCell('F3').font.bold === true);
    확인('인쇄: A4 가로 · 쪽마다 머리글', ws.pageSetup.orientation === 'landscape' && ws.pageSetup.printTitlesRow === '3:3',
         ws.pageSetup.orientation + ' ' + ws.pageSetup.printTitlesRow);

    const [popup] = await Promise.all([
      ctx.waitForEvent('page'),
      p.click('.prac-export button:has-text("인쇄")')
    ]);
    await popup.waitForLoadState();
    await popup.waitForTimeout(200);
    확인('인쇄 창 제목에 학생 이름', (await popup.textContent('p.sub')) === '고다윤');
    확인('인쇄 표에 두 줄이 담기는가', (await popup.locator('tbody tr').count()) === 2);
    확인('불러오자마자 인쇄를 불렀는가', await popup.evaluate(() => window.__printed === true));

    // 질문·답변 칸이 연번·학년·종류보다 훨씬 넓어야 합니다(colgroup 이 실제로 먹는지).
    var colw = await popup.evaluate(() => Array.from(document.querySelectorAll('col')).map(c => c.style.width));
    확인('질문·답변 칸이 나머지 셋을 합친 것보다 넓은가',
         (parseFloat(colw[3]) + parseFloat(colw[4])) > (parseFloat(colw[0]) + parseFloat(colw[1]) + parseFloat(colw[2])),
         colw.join(' / '));

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

    const [dl] = await Promise.all([
      p.waitForEvent('download'),
      p.click('#setup-practice .prac-export button:has-text("엑셀로 저장")')
    ]);
    const 이름 = await p.evaluate(() => window.__dlName);
    확인('파일 이름에 학번·이름이 들어가는가', 이름.indexOf('30101') > -1 && 이름.indexOf('고다윤') > -1, 이름);
    const ws = await 엑셀_열기(dl);
    확인('교사 쪽도 두 답안 · 필터 · 틀 고정', !!ws.getCell('E5').value && !!ws.autoFilter && ws.views[0].ySplit === 3);

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
