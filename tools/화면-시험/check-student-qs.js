// 선생님 화면 «✍️ 학생 질문» — 학생이 답안 연습장에 쓴 질문을 골라 «낼 질문» 에 넣기
// (학년·분류 머리줄 · 칩으로 좁혀 보기 · 여러 개 체크 · 전체 선택 · 이미 넣은 것은 막힘 · 역량 붙음)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [w, h] of [[1512, 1000], [400, 800]]) {
    console.log('\n════ 화면 ' + w + 'px ════');
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.addInitScript(() => {
      const A = (id, grade, category, question, answer, t) => ({ id, student_id: 's1', grade, category, question, answer,
        created_at: '2026-10-0' + t + 'T01:00:00Z', updated_at: '2026-10-0' + t + 'T01:00:00Z' });
      window.__FAKE__ = {
        rows: {
          profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                       school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
          students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 },
                     { id: 's2', student_no: '30102', name: '김서준', auth_user_id: null, grade: 3, class_no: 1 }],
          practice_categories: [{ id: 'c1', student_id: 's1', name: '창체' }],
          practice_answers: [
            A('a1', '3', '진로', '화학공학과에 지원한 까닭은?', '어릴 때부터…', 3),
            A('a2', '1', '세특', '화학Ⅰ 시간에 한 실험을 설명해 보세요.', '', 2),
            A('a3', '3', '인성', '갈등을 푼 경험이 있나요?', '모둠에서…', 4),
            A('a4', '공통', '창체', '창체에서 가장 기억에 남는 활동은?', '', 5),
            A('a5', '3', '진로', '   ', '', 6),                                   // 질문이 빈 카드 — 안 보여야 함
            A('a6', '1', '세특', '탐구 보고서에서 아쉬운 점은?', '변인 통제…', 1)
          ],
          practice_comments: []
        }
      };
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); await pickStudent('s1'); });
    await p.waitForTimeout(300);

    // 좁은 화면은 «질문지 만들기» 가 접힌 채 시작합니다 — 펼쳐 둡니다
    await p.evaluate(() => { if (!qsectOpen) toggleQsect(); });
    console.log('\n── 단추 자리 ──');
    확인('«생기부에서 뽑기» 바로 옆에 «학생 질문» 단추가 있는가', await p.evaluate(() => {
      const sg = [...document.querySelectorAll('#setup-prep .btnrow button')].find(x => /생기부에서 뽑기/.test(x.textContent));
      return !!sg && /학생 질문/.test(sg.nextElementSibling && sg.nextElementSibling.textContent);
    }));
    확인('단추 줄이 «첫인사» 보다 위에 있는가', await p.evaluate(() => {
      const row = document.querySelector('#qsect-body .btnrow');
      const 첫 = [...document.querySelectorAll('#qsect-body .sec')].find(x => /^첫인사/.test(x.textContent));
      return !!(row.compareDocumentPosition(첫) & Node.DOCUMENT_POSITION_FOLLOWING);
    }));
    const 전 = await p.evaluate(() => document.querySelector('#qsect-body .btnrow').getBoundingClientRect().top + scrollY);
    await p.evaluate(() => { for (let i = 0; i < 10; i++) midQuestions.push({ text: '질문 ' + i, competency: '기타' }); renderQuestions(); });
    확인('질문이 10개 늘어도 단추 자리가 그대로인가',
         Math.abs(await p.evaluate(() => document.querySelector('#qsect-body .btnrow').getBoundingClientRect().top + scrollY) - 전) < 1);
    await p.evaluate(() => scrollTo(0, 0));
    await p.click('#qsect-body .btnrow button:has-text("직접 적기")');
    await p.waitForTimeout(200);
    확인('«직접 적기» 를 누르면 맨 아래 새 칸에 커서가 가고 화면에 보이는가', await p.evaluate(() => {
      const ins = document.querySelectorAll('#q-list .qrow input'), last = ins[ins.length - 1], r = last.getBoundingClientRect();
      return document.activeElement === last && last.value === '' && r.top >= 0 && r.bottom <= innerHeight;
    }));
    await p.evaluate(() => { midQuestions = [{ text: '갈등을 푼 경험이 있나요?', competency: '공동체역량' }]; renderQuestions(); scrollTo(0, 0); });

    console.log('\n── 창 열기 ──');
    await p.click('#setup-prep button:has-text("학생 질문")');
    await p.waitForTimeout(300);
    확인('창이 뜨는가', await p.evaluate(() => getComputedStyle(document.getElementById('sq-overlay')).display === 'flex'));
    확인('제목에 학생 이름', (await p.textContent('#sq-title')).indexOf('고다윤') > -1);
    확인('질문이 빈 카드는 빼고 5개', await p.evaluate(() => document.querySelectorAll('#sq-list .prac-offer').length === 5));
    const 머리 = await p.evaluate(() => [...document.querySelectorAll('#sq-list .prac-offer-group')].map(x => x.textContent));
    확인('학년 · 분류 머리줄이 1학년부터(1·세특 → 3·인성 → 3·진로 → 공통·창체)',
         JSON.stringify(머리) === JSON.stringify(['1학년 · 세특 2개', '3학년 · 인성 1개', '3학년 · 진로 1개', '공통 · 창체 1개']), JSON.stringify(머리));
    확인('같은 묶음 안에서는 먼저 쓴 것부터', await p.evaluate(() =>
      document.querySelectorAll('#sq-list .prac-offer')[0].textContent.indexOf('탐구 보고서') > -1));
    확인('학년 칩 · 분류 칩이 쓴 것에 있는 것만', await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#sq-list .prac-offer-frow')].map(r => [...r.querySelectorAll('.prac-chip')].map(c => c.textContent).join(','));
      return rows[0] === '1학년,3학년,공통' && rows[1] === '인성,진로,세특,창체';
    }), await p.evaluate(() => [...document.querySelectorAll('#sq-list .prac-offer-frow')].map(r => r.textContent).join(' / ')));
    확인('이미 «낼 질문» 에 있는 것은 체크칸이 막히고 «낼 질문에 있음»', await p.evaluate(() => {
      const r = [...document.querySelectorAll('#sq-list .prac-offer')].find(x => /갈등을 푼/.test(x.textContent));
      return r.classList.contains('sq-in') && r.querySelector('input').disabled && /낼 질문에 있음/.test(r.textContent);
    }));
    확인('답을 썼는지 보이는가', await p.evaluate(() => {
      const t = [...document.querySelectorAll('#sq-list .prac-offer')].map(x => x.querySelector('.prac-offer-foot').textContent);
      return t.some(x => /^답 씀/.test(x)) && t.some(x => /답은 아직 안 씀/.test(x));
    }));
    확인('처음엔 넣기 단추가 막혀 있는가', await p.evaluate(() => document.getElementById('sq-add').disabled));

    console.log('\n── 칩으로 좁혀 보기 ──');
    await p.click('#sq-list .prac-chip:has-text("세특")');
    await p.waitForTimeout(100);
    확인('세특만 고르면 2개', await p.evaluate(() => document.querySelectorAll('#sq-list .prac-offer').length === 2));
    await p.click('#sq-list .prac-chip:has-text("진로")');
    await p.waitForTimeout(100);
    확인('진로도 같이 고르면 3개(여러 개 고르기)', await p.evaluate(() => document.querySelectorAll('#sq-list .prac-offer').length === 3));
    확인('전체 선택 줄에 «골라 본 질문 3개 / 전체 5개»', /골라 본 질문 3개 \/ 전체 5개/.test(await p.textContent('#sq-list .prac-offer-bar')));

    console.log('\n── 전체 선택 · 해제 · 일부 ──');
    await p.click('#sq-all');
    확인('보이는 3개가 다 체크', await p.evaluate(() => Object.keys(SQ.picked).length === 3 &&
      [...document.querySelectorAll('#sq-list .prac-offer input')].every(x => x.checked)));
    확인('단추가 «고른 3개 질문 넣기»', (await p.textContent('#sq-add')) === '고른 3개 질문 넣기');
    await p.click('#sq-list .prac-offer:has-text("탐구 보고서") input');
    확인('하나 풀면 전체 선택이 «일부»', await p.evaluate(() => document.getElementById('sq-all').indeterminate));
    await p.click('#sq-all');
    await p.click('#sq-all');
    확인('전체 선택을 두 번 누르면 다 풀림', await p.evaluate(() => Object.keys(SQ.picked).length === 0 && document.getElementById('sq-add').disabled));
    // 칩 풀기
    await p.click('#sq-list .prac-chip:has-text("세특")');
    await p.click('#sq-list .prac-chip:has-text("진로")');
    await p.waitForTimeout(100);
    확인('칩을 다 풀면 다시 5개', await p.evaluate(() => document.querySelectorAll('#sq-list .prac-offer').length === 5));

    console.log('\n── 여러 개 골라 넣기 ──');
    const 스크롤전 = await p.evaluate(() => { const b = document.getElementById('sq-list'); b.scrollTop = 40; return b.scrollTop; });
    // Playwright 의 click 은 누르기 전에 그 칸이 보이게 스크롤해 버리므로, 화면 안에서 직접 누릅니다
    await p.evaluate(() => [...document.querySelectorAll('#sq-list .prac-offer')].find(x => /화학공학과/.test(x.textContent)).querySelector('input').click());
    확인('체크해도 창 안 스크롤이 안 튀는가', await p.evaluate(() => document.getElementById('sq-list').scrollTop) === 스크롤전);
    await p.click('#sq-list .prac-offer:has-text("화학Ⅰ 시간") input');
    await p.click('#sq-list .prac-offer:has-text("창체에서") input');
    await p.click('#sq-add');
    await p.waitForTimeout(200);
    확인('창이 닫히는가', await p.evaluate(() => getComputedStyle(document.getElementById('sq-overlay')).display === 'none'));
    const mq = await p.evaluate(() => midQuestions.map(q => q.text + '|' + q.competency));
    확인('«낼 질문» 맨 아래에 창 순서(1학년 → 3학년 → 공통)대로 3개, 역량이 붙음', JSON.stringify(mq) === JSON.stringify([
      '갈등을 푼 경험이 있나요?|공동체역량',
      '화학Ⅰ 시간에 한 실험을 설명해 보세요.|학업역량',
      '화학공학과에 지원한 까닭은?|진로역량',
      '창체에서 가장 기억에 남는 활동은?|기타']), JSON.stringify(mq));
    확인('화면의 질문 칸에도 보이는가', await p.evaluate(() => document.querySelectorAll('#q-list .qrow').length === 4));

    console.log('\n── 다시 열면 ──');
    await p.click('#setup-prep button:has-text("학생 질문")');
    await p.waitForTimeout(300);
    확인('넣은 것들은 «낼 질문에 있음» 으로 막힘(4개), 고른 것은 비어 있음', await p.evaluate(() =>
      document.querySelectorAll('#sq-list .prac-offer.sq-in').length === 4 && Object.keys(SQ.picked).length === 0));
    await p.click('#sq-all');
    확인('전체 선택은 남은 1개만 고름', await p.evaluate(() => Object.keys(SQ.picked).length === 1 && SQ.picked.a6));
    if (w === 400) {
      확인('400px 에서 옆으로 안 넘침', await p.evaluate(() => {
        const b = document.getElementById('sq-list'); return b.scrollWidth <= b.clientWidth + 1;
      }));
    }
    await p.click('#sq-overlay .close-btn');

    console.log('\n── 답안 연습장에 아무것도 없는 학생 ──');
    await p.evaluate(async () => { await pickStudent('s2'); });
    await p.waitForTimeout(300);
    await p.evaluate(() => openStudentQs());
    await p.waitForTimeout(300);
    확인('«아직 … 쓰지 않았습니다» 안내', /아직 답안 연습장에 질문을 쓰지 않았습니다/.test(await p.textContent('#sq-list')));
    확인('제목이 그 학생 이름으로', (await p.textContent('#sq-title')).indexOf('김서준') > -1);

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
