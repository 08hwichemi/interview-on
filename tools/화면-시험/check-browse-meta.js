// 자료 둘러보기 — 앱을 열 때 후기·기출 질문 표에서 «목록용 칸 4개만» 받는가,
// 「모든 대학」 단추가 없는가, 후기 카드에 «소감 및 팁» 이 보이는가
// (예전엔 모든 칸을 받아 앱을 열 때마다 약 4MB 가 나갔습니다 — browse.js 참고)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
// 가짜 서버가 select 에 넘어온 칸 이름을 적어 두게 합니다
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8')
  .replace('select(cols, opt) {', 'select(cols, opt) { (window.__SELECTS__ = window.__SELECTS__ || []).push([st.table, cols]);');
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
        reviews: [
          { 년도: 2026, 대학: '가천대', 세부유형: '학생부종합', 모집단위: '간호학과', 합불: '합격', 질문: '긴 본문', 답변: '긴 답변', 소감: '떨지 말고 천천히 말하세요' },
          { 년도: 2025, 대학: '경희대', 세부유형: '네오르네상스', 모집단위: '화학과', 합불: '불합격', 질문: '긴 본문', 답변: '긴 답변' }
        ],
        questions: [
          { 년도: 2027, 대학: '가천대', 전형_역량1: '가천바람개비', 역량2: '인성', 질문: '자기소개를 해 주세요.' }
        ]
      }
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
  await p.waitForTimeout(300);

  const sel = await p.evaluate(() => window.__SELECTS__ || []);
  const rev = sel.filter(s => s[0] === 'reviews').map(s => s[1]);
  const q = sel.filter(s => s[0] === 'questions').map(s => s[1]);
  확인('후기 표는 칸 4개만 받음', rev.length === 1 && rev[0] === '년도, 대학, 세부유형, 모집단위', JSON.stringify(rev));
  확인('기출 질문 표는 칸 4개만 받음', q.length === 1 && q[0] === '년도, 대학, 전형_역량1, 역량2', JSON.stringify(q));

  const meta = await p.evaluate(() => appMeta);
  확인('후기 목록용 자료가 채워짐', meta.rev.length === 2 && meta.rev[0].u === '가천대' && meta.rev[0].m === '간호학과', JSON.stringify(meta.rev[0]));
  확인('기출 목록용 자료가 채워짐', meta.q.length === 1 && meta.q[0].t1 === '가천바람개비' && meta.q[0].t2 === '인성', JSON.stringify(meta.q[0]));

  // 대학 고르기 팝업에 대학이 다 나오는가
  await p.evaluate(() => openUnivModal('rev'));
  const univs = await p.$$eval('#univ-modal-list .univ-list-btn', els => els.map(e => e.textContent.trim()));
  확인('대학 고르기에 대학이 나옴', univs.includes('가천대') && univs.includes('경희대'), univs.join(' / '));
  확인('「모든 대학 (전체 보기)」 단추는 없음', !univs.some(u => u.indexOf('모든 대학') > -1), univs.join(' / '));

  // 대학을 고르면 그 대학 것만 받고, 후기 카드에 «소감 및 팁» 이 보이는가
  await p.evaluate(() => { window.__SELECTS__ = []; });
  await p.click('#univ-modal-list .univ-list-btn:has-text("가천대")');
  await p.waitForSelector('#review-list .card', { state: 'attached', timeout: 5000 });
  const cards = await p.$$eval('#review-list .card-title', els => els.map(e => e.textContent.trim()));
  확인('고른 대학 후기만 나옴', cards.length === 1 && cards[0].indexOf('가천대') === 0, cards.join(' / '));
  const body = await p.$eval('#review-list .card', e => e.textContent);
  확인('후기 카드에 소감이 보임', body.indexOf('소감 및 팁') > -1 && body.indexOf('떨지 말고 천천히 말하세요') > -1);

  확인('화면 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '❌ ' + 실패 + '개 실패' : '✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
