// 생기부에서 질문 뽑기 — 묶음 하나씩 «기록 위 · 질문 아래» 로 보는 화면 (2026-10-05)
//
// 선생님 말씀: 질문마다 원문을 보는 게 아니라 원문을 먼저 보고 그 아래에서 고르고 싶다.
// 대신 원문이 기니까 자율·동아리·진로(학년별)로 하나씩 골라 보게.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

// 나이스 PDF 에서 꺼낸 줄 흉내 — pdf.js 는 안 부르고 sgReadPdf 를 바꿔치기합니다
const LINES = [
  '5. 창의적 체험활동상황', '학년 영역 시간 특기사항',
  '1학년', '자율활동 (34시간)',
  '학급 회장으로서 「우리 반 생활 협약」을 주제로 학급 회의를 세 차례 진행하여 합의안을 도출함.',
  '동아리활동 (26시간)',
  '(과학탐구부) 「미세먼지와 식물 생장」에 대해 탐구를 진행함. 「식물의 기공은 미세먼지에 어떻게 반응할까?」라는 질문을 던짐.',
  '「대조군 설정의 중요성」을 주제로 발표함. 「측정 오차의 원인」에 대해 조사함. 「잎의 표면적과 흡착량」을 주제로 보고서를 씀.',
  '「도시 녹지의 효과」에 대해 탐구함. 「공기정화식물의 한계」에 의문을 품고 자료를 찾음.',
  '2학년', '진로활동 (21시간)',
  '진로 특강을 듣고 「유전자 가위 기술의 명암」을 주제로 보고서를 작성하여 발표함.',
  '6. 교과학습발달상황', '세부능력 및 특기사항',
  '1학년', '[통합과학] 효소의 작용 단원에서 「온도와 효소 활성의 관계」 실험을 수행함.',
  '8. 행동특성 및 종합의견', '학년 행동특성 및 종합의견',
  '1학년', '배려심이 깊고 성실함. 학급 일에 솔선수범함.'
];

async function 열기(viewport) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript((lines) => {
    window.__FAKE__ = { rows: {
      profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                   school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
      students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'a1', grade: 3, class_no: 1 }],
      reviews: [], questions: [], interviews: [], chats: []
    } };
    window.__LINES = lines;
  }, LINES);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.click('#student-list .railrow'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.sgReadPdf = async () => window.__LINES; });
  // 좁은 화면에서는 단추가 접혀 있을 수 있어 바로 부릅니다
  await p.evaluate(() => openSaenggibu()); await p.waitForTimeout(150);
  await p.setInputFiles('#sg-file', { name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await p.waitForTimeout(400);
  return { b, p, errs };
}

(async () => {
  console.log('\n── 노트북 ──');
  {
    const { b, p, errs } = await 열기({ width: 1440, height: 900 });
    // 왼쪽: 학년 단추 → 그 학년의 묶음만
    확인('학년 단추가 뜨는가 (1학년 · 2학년)',
         (await p.$$eval('#sg-rail .sg-gbtn', es => es.map(e => e.textContent.trim()))).join() === '1학년,2학년');
    확인('처음엔 첫 묶음의 학년(1학년)이 눌려 있는가', (await p.textContent('#sg-rail .sg-gbtn[aria-pressed="true"]')).indexOf('1학년') === 0);
    let rail = await p.$$eval('#sg-rail .sg-rentry', es => es.map(e => e.textContent.trim()));
    확인('1학년 묶음만 보이는가 (자율·동아리·통합과학·행특)', rail.length === 4, rail.join(' | '));
    확인('영역 머리줄(창체·세특·행특)이 있는가',
         (await p.$$eval('#sg-rail .sg-rhead', es => es.map(e => e.textContent))).join() === '창의적 체험활동,세부능력 및 특기사항,행동특성 및 종합의견');
    확인('첫 묶음(자율활동)이 골라져 있는가', (await p.$eval('#sg-rail .sg-rentry[aria-current="true"]', e => e.textContent)).indexOf('자율활동') === 0);
    await p.click('#sg-rail .sg-gbtn:has-text("2학년")'); await p.waitForTimeout(150);
    확인('2학년을 누르면 2학년 첫 묶음(진로활동)으로 가는가', (await p.textContent('.sg-gtitle')).indexOf('2학년 · 진로활동') > -1);
    확인('2학년 묶음만 보이는가', (await p.$$eval('#sg-rail .sg-rentry', es => es.length)) === 1);
    await p.click('button:has-text("앞 묶음")'); await p.waitForTimeout(150);
    확인('앞 묶음으로 1학년에 가면 학년 단추도 따라오는가', (await p.textContent('#sg-rail .sg-gbtn[aria-pressed="true"]')).indexOf('1학년') === 0);
    await p.click('#sg-rail .sg-rentry >> nth=0'); await p.waitForTimeout(150);
    rail = await p.$$eval('#sg-rail .sg-rentry', es => es.map(e => e.textContent.trim()));

    // 기록이 위, 질문이 아래
    const recordTop = await p.$eval('.sg-record', e => e.getBoundingClientRect().top);
    const listTop = await p.$eval('.sg-list', e => e.getBoundingClientRect().top);
    확인('기록 전문이 질문보다 위에 있는가', recordTop < listTop);
    확인('기록이 통째로 보이는가', (await p.textContent('.sg-record')).indexOf('우리 반 생활 협약') > -1);
    확인('질문에는 따로 원문 칸이 없는가', (await p.$$('.sg-list .sg-src')).length === 0);
    확인('질문이 가리키는 대목에 색이 입혀지는가', (await p.$$('.sg-record mark')).length >= 1);

    // 동아리활동 묶음 — 질문이 5개를 넘습니다
    const idx = rail.findIndex(t => t.indexOf('동아리') > -1);
    await p.click('#sg-rail .sg-rentry >> nth=' + idx); await p.waitForTimeout(200);
    const shown = await p.$$('.sg-list label.sg-item');
    const more = await p.$('.sg-more');
    확인('질문은 처음에 5개까지만 보이는가', shown.length === 5, shown.length + '개');
    확인('「더 보기」 단추가 있는가', !!more && (await more.textContent()).indexOf('더 보기') > -1);
    await more.click(); await p.waitForTimeout(200);
    확인('더 보기를 누르면 다 나오는가', (await p.$$('.sg-list label.sg-item')).length > 5);

    // 체크하면 화면이 튀지 않고 왼쪽 숫자가 바뀜
    await p.$eval('.sg-main', e => { e.scrollTop = 200; });
    await p.click('.sg-list label.sg-item >> nth=0'); await p.waitForTimeout(100);
    확인('체크해도 읽던 자리가 안 튀는가', (await p.$eval('.sg-main', e => e.scrollTop)) === 200);
    확인('왼쪽 목록에 담은 수가 붙는가', (await p.$eval('#sg-rail .sg-rentry[aria-current="true"] .n b', e => e.textContent)) === '1');
    확인('학년 단추에도 담은 수가 붙는가', (await p.$eval('#sg-rail .sg-gbtn[aria-pressed="true"] b', e => e.textContent)) === '1');
    확인('아래 단추에 담을 수가 뜨는가', (await p.textContent('#sg-add')).indexOf('1개') === 0);

    // 직접 적는 칸은 맨 아래
    const lastItem = await p.$eval('.sg-list > :last-child', e => e.classList.contains('blank'));
    확인('직접 적는 칸이 질문 맨 아래에 있는가', lastItem);
    await p.fill('.sg-item.blank .sg-write', '직접 쓴 질문'); await p.waitForTimeout(100);
    확인('직접 적으면 저절로 담기는가', (await p.textContent('#sg-add')).indexOf('2개') === 0);

    // 앞·다음 묶음
    await p.click('button:has-text("다음 묶음")'); await p.waitForTimeout(150);
    확인('「다음 묶음」으로 넘어가는가', (await p.$eval('#sg-rail .sg-rentry[aria-current="true"]', e => e.textContent)).indexOf('진로') > -1);

    // 떠 있는 창이 아니라 오른쪽 칸을 통째로 쓰는가
    확인('준비 화면이 숨고 생기부 화면이 그 자리에 뜨는가',
         (await p.$eval('#view-setup', e => e.hidden)) && !(await p.$eval('#view-saenggibu', e => e.hidden)));
    확인('왼쪽 학생 명단은 그대로 보이는가', await p.$eval('#rail-students', e => e.offsetParent !== null));
    확인('생기부 화면이 왼쪽 명단과 같은 높이까지 오는가',
         (await p.$eval('.sg-panel', e => e.getBoundingClientRect().height)) > 700);
    확인('머리줄에 학생 이름이 있는가', (await p.textContent('#sg-who')).indexOf('고다윤') > -1);

    // 담기
    await p.click('#sg-add'); await p.waitForTimeout(200);
    확인('담으면 준비 화면으로 돌아오는가', !(await p.$eval('#view-setup', e => e.hidden)));
    const q = await p.evaluate(() => midQuestions.map(x => x.text));
    확인('담은 질문이 «낼 질문» 으로 가는가', q.length === 2 && q.indexOf('직접 쓴 질문') > -1, q.join(' | '));
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await b.close();
  }

  console.log('\n── 휴대폰 (400px) ──');
  {
    const { b, p, errs } = await 열기({ width: 400, height: 800 });
    확인('왼쪽 목록은 숨고 고르는 칸이 뜨는가',
         !(await p.$eval('#sg-rail', e => e.offsetParent !== null)) && (await p.$eval('.sg-jump', e => e.offsetParent !== null)));
    확인('고르는 칸이 학년별로 묶여 있는가', (await p.$$eval('.sg-jump optgroup', es => es.map(e => e.label))).join() === '1학년,2학년');
    await p.selectOption('.sg-jump', '2'); await p.waitForTimeout(150);
    확인('고르는 칸으로 묶음을 바꿀 수 있는가', (await p.textContent('.sg-gtitle')).indexOf('진로') > -1);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    확인('옆으로 넘치지 않는가', !over);
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await b.close();
  }

  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
