// 학생 모의 면접 세팅 — «📒 연습장에서» 로 답안 연습장에 써 둔 질문을 골라 질문 칸에 넣기 (2026-10-15)
// (칸마다 단추 · 학년·분류 칩 · 전체 선택/일부 · 빈 칸부터 채우고 모자라면 칸을 더함 · «고정» 켜짐 ·
//  이미 칸에 있는 질문은 못 고름 · 빈 질문은 안 보임 · 기기에 저장 · 뒤로가기로 창 닫힘 · 360px)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const A = (id, grade, category, question, t) => ({ id, student_id: 's1', grade, category, question, answer: '',
  created_at: '2026-10-0' + t + 'T01:00:00Z', updated_at: '2026-10-0' + t + 'T01:00:00Z' });
const ROWS = (answers) => ({
  profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
               school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
  students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
  reviews: [], questions: [], practice_categories: [], practice_comments: [], practice_offers: [],
  practice_answers: answers
});
const ANSWERS = [
  A('a1', '3', '진로', '화학공학과에 지원한 까닭은?', 3),
  A('a2', '1', '세특', '화학Ⅰ 시간에 한 실험을 설명해 보세요.', 2),
  A('a3', '3', '인성', '갈등을 푼 경험이 있나요?', 4),
  A('a4', '공통', '동아리', '동아리에서 맡은 역할은?', 5),
  A('a5', '3', '진로', '   ', 6),                                   // 질문이 빈 카드 — 안 보여야 함
  A('a6', '1', '세특', '탐구 보고서에서 아쉬운 점은?', 1),
  A('a7', '2', '자율', '자율활동에서 기억에 남는 것은?', 7),
  A('a8', '2', '자율', '학급 회의에서 낸 의견은?', 8),
  A('a9', '2', '자율', '봉사에서 배운 점은?', 9)
];

async function 열기(b, width, answers, saved) {
  const ctx = await b.newContext({ viewport: { width: width, height: 860 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('**/xlsx*', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await ctx.addInitScript(([rows, saved]) => {
    window.__FAKE__ = { rows: rows };
    try { if (!sessionStorage.getItem('__set')) { sessionStorage.setItem('__set', '1'); localStorage.setItem('smartInterviewQs', JSON.stringify(saved)); } } catch (e) {}
  }, [ROWS(answers), saved]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
  await p.evaluate(() => navigateTo('interview-setup'));
  await p.waitForSelector('#screen-interview-setup.active');
  return { ctx, p, errs };
}
const 칸 = (p, type) => p.evaluate(t => [...document.querySelectorAll('#' + t + '-inputs .custom-q-row')].map(r => ({
  v: r.querySelector('.custom-q-input').value, fix: r.querySelector('.q-checkbox').checked })), type);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  for (const w of [1280, 360]) {
    console.log('\n════ 화면 ' + w + 'px ════');
    // 창체 칸: 이미 «갈등을 푼 경험이 있나요?» 하나 + 빈 칸 4 / 전공 칸: 빈 칸 5
    const { ctx, p, errs } = await 열기(b, w, ANSWERS, { changche: ['갈등을 푼 경험이 있나요?', '', '', '', ''], major: [] });

    console.log('\n── 단추 ──');
    확인('창체 · 전공 칸 둘 다 «📒 연습장에서» 단추가 있는가', await p.evaluate(() =>
      !!document.querySelector('#changche-box .mock-pull-btn') && !!document.querySelector('#major-box .mock-pull-btn')));
    확인('«✨ AI 추천 질문» 도 그대로 있는가', await p.evaluate(() =>
      [...document.querySelectorAll('#changche-box button')].some(x => /AI 추천/.test(x.textContent))));
    확인('제목 줄이 칸 밖으로 넘치지 않는가', await p.evaluate(() => {
      const box = document.getElementById('changche-box').getBoundingClientRect();
      return [...document.querySelectorAll('#changche-box .custom-q-title button')].every(x => x.getBoundingClientRect().right <= box.right + 0.5);
    }));
    확인('옆으로 넘치지 않는가', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    console.log('\n── 창 열기 (창체) ──');
    await p.click('#changche-box .mock-pull-btn'); await p.waitForTimeout(300);
    확인('창이 뜨는가', await p.evaluate(() => document.getElementById('mock-prac-overlay').style.display === 'flex'));
    확인('제목에 «창체» 가 붙는가', /창체/.test(await p.textContent('#mock-prac-title')));
    const 줄 = await p.evaluate(() => [...document.querySelectorAll('#mock-prac-list .prac-offer')].map(r => r.querySelector('.prac-offer-q').textContent));
    확인('빈 질문은 빼고 8개가 보이는가', 줄.length === 8, 줄.length + '개');
    확인('학년 순서(1 → 2 → 3 → 공통)로 보이는가', 줄[0] === '탐구 보고서에서 아쉬운 점은?' && 줄[7] === '동아리에서 맡은 역할은?', 줄.join(' / '));
    확인('학년 칩이 1학년 · 2학년 · 3학년 · 공통', await p.evaluate(() =>
      [...document.querySelectorAll('#mock-prac-list .prac-offer-frow:first-child .prac-chip')].map(x => x.textContent).join(',') === '1학년,2학년,3학년,공통'));
    확인('이미 칸에 있는 «갈등…» 은 막혀 있고 «이미 질문 칸에 있음»', await p.evaluate(() => {
      const r = document.querySelector('#mock-prac-list .prac-offer[data-id="a3"]');
      return r.classList.contains('had') && r.querySelector('input').disabled && /이미 질문 칸에 있음/.test(r.textContent);
    }));
    확인('카드에 학년 · 분류가 적혀 있는가', /2학년 · 자율/.test(await p.textContent('#mock-prac-list .prac-offer[data-id="a7"]')));
    확인('처음엔 «넣을 질문을 고르세요» 로 막힘', await p.evaluate(() => {
      const b = document.getElementById('mock-prac-add'); return b.disabled && /넣을 질문을 고르세요/.test(b.textContent); }));

    console.log('\n── 칩으로 좁히기 · 전체 선택 ──');
    await p.click('#mock-prac-list .prac-chip:has-text("2학년")'); await p.waitForTimeout(100);
    확인('«2학년» 을 누르면 3개만', await p.evaluate(() => document.querySelectorAll('#mock-prac-list .prac-offer').length) === 3);
    await p.click('#mock-prac-all'); await p.waitForTimeout(100);
    확인('전체 선택 → «고른 3개 넣기»', /고른 3개 넣기/.test(await p.textContent('#mock-prac-add')));
    await p.click('#mock-prac-list .prac-offer[data-id="a8"] input'); await p.waitForTimeout(50);
    확인('하나 풀면 «−»(일부) 표시 · «고른 2개»', await p.evaluate(() => document.getElementById('mock-prac-all').indeterminate) &&
         /고른 2개 넣기/.test(await p.textContent('#mock-prac-add')));
    await p.click('#mock-prac-list .prac-chip:has-text("2학년")'); await p.waitForTimeout(100);
    await p.click('#mock-prac-list .prac-chip:has-text("동아리")'); await p.waitForTimeout(100);
    확인('분류 «동아리» 로 좁히면 1개', await p.evaluate(() => document.querySelectorAll('#mock-prac-list .prac-offer').length) === 1);
    await p.click('#mock-prac-list .prac-offer[data-id="a4"] input'); await p.waitForTimeout(50);
    확인('칩으로 가려진 것까지 «고른 3개»', /고른 3개 넣기/.test(await p.textContent('#mock-prac-add')));

    console.log('\n── 넣기 ──');
    await p.click('#mock-prac-add'); await p.waitForTimeout(200);
    확인('창이 닫히는가', await p.evaluate(() => document.getElementById('mock-prac-overlay').style.display === 'none'));
    let c = await 칸(p, 'changche');
    확인('빈 칸부터 채우고(칸 수 5 그대로) 원래 질문은 그대로', c.length === 5 && c[0].v === '갈등을 푼 경험이 있나요?' &&
         c.slice(1, 4).map(x => x.v).sort().join('|') === ['자율활동에서 기억에 남는 것은?', '봉사에서 배운 점은?', '동아리에서 맡은 역할은?'].sort().join('|') && c[4].v === '',
         c.map(x => x.v).join(' / '));
    확인('넣은 칸은 «고정» 이 켜지는가', c.slice(1, 4).every(x => x.fix) && !c[4].fix);
    확인('기기에 저장되는가', await p.evaluate(() => JSON.parse(localStorage.getItem('smartInterviewQs')).changche.filter(Boolean).length === 4));
    확인('«넣었습니다» 안내', /3개를 🌱 창체 질문 칸에 넣었습니다/.test(await p.textContent('#toast-message')));

    console.log('\n── 다시 열기 · 전공 칸 · 칸이 모자랄 때 ──');
    await p.click('#major-box .mock-pull-btn'); await p.waitForTimeout(300);
    확인('제목에 «전공»', /전공/.test(await p.textContent('#mock-prac-title')));
    확인('창체 칸에 넣은 것도 «이미 있음» 으로 막힘', await p.evaluate(() =>
      ['a3', 'a4', 'a7', 'a9'].every(id => document.querySelector('#mock-prac-list .prac-offer[data-id="' + id + '"]').classList.contains('had'))));
    확인('전에 고른 것은 비워져 있음', /넣을 질문을 고르세요/.test(await p.textContent('#mock-prac-add')));
    await p.click('#mock-prac-all'); await p.waitForTimeout(100);
    확인('전체 선택은 아직 없는 것만 — 고른 4개', /고른 4개 넣기/.test(await p.textContent('#mock-prac-add')));
    // 전공 칸을 2개만 남기고 줄여서 칸이 모자라게
    await p.evaluate(() => { const rows = document.querySelectorAll('#major-inputs .custom-q-row'); for (let i = 2; i < rows.length; i++) rows[i].remove(); });
    await p.click('#mock-prac-add'); await p.waitForTimeout(200);
    c = await 칸(p, 'major');
    확인('칸이 모자라면 새 칸을 더해 다 넣는가(2 → 4)', c.length === 4 && c.every(x => x.v && x.fix), c.map(x => x.v).join(' / '));

    console.log('\n── 뒤로가기 ──');
    await p.click('#changche-box .mock-pull-btn'); await p.waitForTimeout(300);
    await p.evaluate(() => closeTopLayer());
    확인('뒤로가기(위 창 닫기)로 창이 닫히는가', await p.evaluate(() => document.getElementById('mock-prac-overlay').style.display === 'none'));
    if (w === 360) {
      await p.click('#changche-box .mock-pull-btn'); await p.waitForTimeout(300);
      확인('360px — 창이 화면 안에 있는가', await p.evaluate(() => {
        const r = document.querySelector('#mock-prac-overlay .modal-content').getBoundingClientRect();
        return r.left >= -0.5 && r.right <= innerWidth + 0.5;
      }));
      확인('360px — 넣기 단추가 보이는가', await p.evaluate(() => {
        const r = document.getElementById('mock-prac-add').getBoundingClientRect(); return r.bottom <= innerHeight && r.height > 0; }));
      await p.screenshot({ path: path.join(__dirname, 'mock-pull-360.png') });
    }
    확인('스크립트 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n════ 연습장에 쓴 게 없는 학생 ════');
  {
    const { ctx, p, errs } = await 열기(b, 420, [], { changche: [], major: [] });
    await p.click('#changche-box .mock-pull-btn'); await p.waitForTimeout(300);
    확인('«아직 없습니다» 안내 · 넣기 막힘', /아직 없습니다/.test(await p.textContent('#mock-prac-list')) &&
         await p.evaluate(() => document.getElementById('mock-prac-add').disabled));
    확인('스크립트 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
