// 답안 연습장 — 학생 쪽 (작성 자동저장 · 학년/분류 칩 · 커스텀 분류 · 조회)
//
// 학생 앱(index.html) 전체를 띄우고 «답안 연습장» 을 눌러 들어갑니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);

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
        reviews: [], questions: [], practice_categories: [], practice_answers: []
      }
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  var promptAnswer = null;
  p.on('dialog', async d => { await d.accept(d.type() === 'prompt' ? (promptAnswer == null ? '' : promptAnswer) : undefined); });

  await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });

  console.log('\n── 홈에서 답안 연습장으로 ──');
  await p.click('.menu-btn:has-text("답안 연습장")');
  await p.waitForSelector('#screen-practice.active');
  await p.waitForTimeout(300);
  확인('작성 탭이 기본인가', await p.evaluate(() => document.getElementById('prac-write').hidden === false));
  확인('학년이 내 학년(3)으로 미리 골라져 있는가',
       await p.evaluate(() => document.querySelector('#prac-write-grade .prac-chip[aria-pressed="true"]').textContent.trim()) === '3');
  확인('분류 기본값이 인성인가',
       await p.evaluate(() => document.querySelector('#prac-write-cat .prac-chip[aria-pressed="true"]').textContent.trim()) === '인성');
  확인('아직 쓴 게 없다는 안내', (await p.evaluate(() => document.getElementById('prac-write-list').textContent)).indexOf('없습니다') > -1);

  console.log('\n── 새 질문 쓰기 → 자동저장(멈추고 1.5초) ──');
  await p.click('button:has-text("＋ 새 질문 쓰기")');
  await p.fill('.prac-q-input', '「히트 패치」 탐구는 무엇이 궁금해서 시작했나요?');
  await p.fill('.prac-a-input', '피부 온도를 낮추는 소재에 관심이 있어서 시작했습니다.');
  await p.waitForTimeout(1900);
  var rows1 = await 표(p, 'practice_answers');
  확인('한 줄 저장됐는가', rows1.length === 1, rows1.length + '줄');
  확인('학생 · 학년 · 분류가 맞는가',
       rows1[0] && rows1[0].student_id === 's1' && rows1[0].grade === '3' && rows1[0].category === '인성');
  확인('저장됨 표시가 뜨는가', (await p.evaluate(() => document.querySelector('.prac-savehint').textContent)) === '저장됨');

  console.log('\n── 분류를 바꾸고 blur 로 곧바로 저장 ──');
  await p.click('#prac-write-cat .prac-chip:has-text("자율")');
  await p.waitForTimeout(200);
  확인('«쓴 게 없다» 로 바뀌는가(다른 분류라 안 보임)',
       (await p.evaluate(() => document.getElementById('prac-write-list').textContent)).indexOf('없습니다') > -1);
  await p.click('button:has-text("＋ 새 질문 쓰기")');
  await p.fill('.prac-a-input', '동아리에서 실험 설계를 맡았습니다.');   // 질문은 비워 둡니다
  await p.locator('.prac-a-input').blur();
  await p.waitForTimeout(400);
  var rows2 = await 표(p, 'practice_answers');
  확인('blur 만으로 바로 저장됐는가(2줄)', rows2.length === 2, rows2.length + '줄');
  확인('질문이 비어도 저장되는가', rows2.some(r => r.category === '자율' && r.answer.indexOf('실험 설계') > -1));

  console.log('\n── 커스텀 분류 만들기 ──');
  promptAnswer = '창체';
  await p.click('button:has-text("＋ 새 분류")');
  await p.waitForTimeout(300);
  var cats = await 표(p, 'practice_categories');
  확인('분류가 서버에 생겼는가', cats.length === 1 && cats[0].name === '창체', JSON.stringify(cats.map(c => c.name)));
  확인('그 분류가 바로 골라지는가',
       (await p.evaluate(() => document.querySelector('#prac-write-cat .prac-chip[aria-pressed="true"]').textContent.trim())) === '창체');
  await p.click('button:has-text("＋ 새 질문 쓰기")');
  await p.fill('.prac-q-input', '창체 활동에서 가장 기억에 남는 것은?');
  await p.fill('.prac-a-input', '학급 자치회 활동입니다.');
  await p.waitForTimeout(1900);
  var rows3 = await 표(p, 'practice_answers');
  확인('커스텀 분류로도 저장되는가', rows3.some(r => r.category === '창체'), rows3.length + '줄');

  console.log('\n── 비우면 지워진다 ──');
  await p.fill('.prac-q-input', '');
  await p.fill('.prac-a-input', '');
  await p.locator('.prac-a-input').blur();
  await p.waitForTimeout(400);
  var rows4 = await 표(p, 'practice_answers');
  확인('빈 카드는 서버에서 지워지는가', rows4.length === 2, rows4.length + '줄');

  console.log('\n── 조회 탭 ──');
  await p.click('#prac-tab-browse');
  await p.waitForTimeout(300);
  await p.click('#prac-browse-cat .prac-chip:has-text("인성")');
  await p.waitForTimeout(150);
  확인('인성 답안이 보이는가',
       (await p.evaluate(() => document.getElementById('prac-browse-list').textContent)).indexOf('히트 패치') > -1);
  await p.click('#prac-browse-cat .prac-chip:has-text("자율")');
  await p.waitForTimeout(150);
  확인('자율 답안이 보이는가',
       (await p.evaluate(() => document.getElementById('prac-browse-list').textContent)).indexOf('실험 설계') > -1);
  확인('조회에는 입력칸이 없는가(읽기 전용)',
       await p.evaluate(() => document.querySelectorAll('#prac-browse-list textarea').length === 0));

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
