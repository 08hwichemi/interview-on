// 답안 연습장 — 학생 쪽 (다중선택 필터 · 새 질문 모달 · 자동저장 · 커스텀 분류 · 조회→수정 · 코멘트 읽음)
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
        reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: []
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
  확인('필터를 아무것도 안 골랐는가(전부 보임 상태)',
       await p.evaluate(() => PW.grades.length === 0 && PW.cats.length === 0));
  확인('«아직 쓴 게 없다» 안내', (await p.evaluate(() => document.getElementById('prac-write-list').textContent)).indexOf('없습니다') > -1);

  console.log('\n── «+ 새 질문 쓰기» → 학년·분류 모달 ──');
  await p.click('button:has-text("＋ 새 질문 쓰기")');
  await p.waitForTimeout(150);
  확인('모달이 뜨는가', await p.evaluate(() => document.getElementById('prac-modal-overlay').style.display === 'flex'));
  확인('학년 기본값이 내 학년(3)인가',
       (await p.evaluate(() => document.querySelector('#prac-modal-grade .prac-chip[aria-pressed="true"]').textContent.trim())) === '3');
  await p.click('#prac-modal-cat .prac-chip:has-text("자율")');
  await p.click('button:has-text("만들기")');
  await p.waitForTimeout(200);
  확인('모달이 닫히는가', await p.evaluate(() => document.getElementById('prac-modal-overlay').style.display === 'none'));
  확인('필터가 자동으로 그 학년·분류를 포함하게 됐는가(아무것도 안 골랐으면 통과)',
       await p.evaluate(() => (PW.grades.length === 0 || PW.grades.includes('3')) && (PW.cats.length === 0 || PW.cats.includes('자율'))));
  확인('새 카드에 자율·3 뱃지가 붙는가',
       (await p.evaluate(() => document.querySelector('.prac-card .prac-badges').textContent)).indexOf('자율') > -1);

  await p.fill('.prac-q-input', '동아리에서 맡은 역할은?');
  await p.fill('.prac-a-input', '실험 설계를 맡았습니다.');
  await p.waitForTimeout(1900);
  var rows1 = await 표(p, 'practice_answers');
  확인('한 줄 저장됐는가', rows1.length === 1 && rows1[0].grade === '3' && rows1[0].category === '자율', JSON.stringify(rows1[0]));

  console.log('\n── 필터를 여러 개 같이 고를 수 있다(다중선택) ──');
  await p.click('button:has-text("＋ 새 질문 쓰기")');
  await p.click('#prac-modal-grade .prac-chip:has-text("공통")');
  await p.click('#prac-modal-cat .prac-chip:has-text("인성")');
  await p.click('button:has-text("만들기")');
  await p.fill('.prac-q-input >> nth=0', '자기소개를 해 주세요.');
  await p.fill('.prac-a-input >> nth=0', '안녕하세요, 고다윤입니다.');
  await p.locator('.prac-a-input').first().blur();
  await p.waitForTimeout(400);
  var rows2 = await 표(p, 'practice_answers');
  확인('두 줄이 저장됐는가', rows2.length === 2, rows2.length + '줄');

  // 필터를 안 건드렸으면(전부 보임) 둘 다 보여야 합니다.
  확인('필터 없이 둘 다 보이는가',
       await p.evaluate(() => document.querySelectorAll('#prac-write-list .prac-card').length === 2));

  console.log('\n── 필터 상자 — 처음엔 접힌 채, 마지막 상태를 기억한다 ──');
  확인('처음엔 접힌 채로 시작하는가', await p.evaluate(() => document.getElementById('fbox-body-write').hidden));
  확인('접힌 채로도 요약이 보이는가(학년 전체 · 분류 전체)',
       (await p.textContent('#fbox-summary-write')).indexOf('전체') > -1);
  await p.click('#fbox-head-write');
  확인('누르면 펼쳐지는가', await p.evaluate(() => !document.getElementById('fbox-body-write').hidden));
  // 실제로는 새로고침해도 이어지지만(localStorage), 여기서는 화면을 나갔다 다시 들어와
  // «새로 그리기» 를 한 번 더 태워 localStorage 에서 다시 읽어 오는지를 봅니다
  // (진짜 브라우저 새로고침은 이 시험판의 서비스워커 때문에 가짜 서버 라우팅이 깨집니다).
  await p.click('#prac-tab-browse'); await p.click('#prac-tab-write'); await p.waitForTimeout(150);
  확인('다시 그려도 펼친 상태가 그대로인가(기기에 기억됨)',
       await p.evaluate(() => !document.getElementById('fbox-body-write').hidden));

  // 학년 «3» 만 고르면 하나만 남아야 합니다.
  await p.click('#prac-write-grade .prac-chip:has-text("3")');
  await p.waitForTimeout(150);
  확인('학년 3만 필터하면 한 장만 남는가',
       await p.evaluate(() => document.querySelectorAll('#prac-write-list .prac-card').length === 1));
  확인('요약 줄도 골라 둔 학년을 보여주는가', (await p.textContent('#fbox-summary-write')).indexOf('학년 3') > -1);
  // 공통도 같이 켜면(다중선택) 둘 다 다시 보여야 합니다.
  await p.click('#prac-write-grade .prac-chip:has-text("공통")');
  await p.waitForTimeout(150);
  확인('학년 두 개를 같이 켜면(다중선택) 둘 다 보이는가',
       await p.evaluate(() => document.querySelectorAll('#prac-write-list .prac-card').length === 2));
  // 필터 다시 끄기
  await p.click('#prac-write-grade .prac-chip:has-text("3")');
  await p.click('#prac-write-grade .prac-chip:has-text("공통")');
  await p.waitForTimeout(150);

  console.log('\n── 커스텀 분류 만들기(모달 안에서) ──');
  promptAnswer = '창체';
  await p.click('button:has-text("＋ 새 질문 쓰기")');
  await p.click('button:has-text("＋ 새 분류")');
  await p.waitForTimeout(200);
  var cats = await 표(p, 'practice_categories');
  확인('분류가 서버에 생겼는가', cats.length === 1 && cats[0].name === '창체', JSON.stringify(cats.map(c => c.name)));
  확인('모달 안에서 그 분류가 바로 골라지는가',
       (await p.evaluate(() => document.querySelector('#prac-modal-cat .prac-chip[aria-pressed="true"]').textContent.trim())) === '창체');
  await p.click('button:has-text("만들기")');
  await p.fill('.prac-q-input >> nth=0', '창체에서 기억에 남는 것은?');
  await p.fill('.prac-a-input >> nth=0', '학급 자치회 활동입니다.');
  await p.waitForTimeout(1900);
  var rows3 = await 표(p, 'practice_answers');
  확인('커스텀 분류로도 저장되는가', rows3.some(r => r.category === '창체'), rows3.length + '줄');

  console.log('\n── 조회 탭 → «수정» 으로 작성 탭으로 넘어가기 ──');
  await p.click('#prac-tab-browse');
  await p.waitForTimeout(300);
  확인('조회에도 필터 없이 전부 보이는가',
       await p.evaluate(() => document.querySelectorAll('#prac-browse-list .prac-card').length === 3));
  확인('읽기 전용인가(입력칸 없음)',
       await p.evaluate(() => document.querySelectorAll('#prac-browse-list textarea').length === 0));

  await p.click('#prac-browse-list .prac-card:has-text("창체") .prac-edit');
  await p.waitForTimeout(300);
  확인('작성 탭으로 넘어갔는가', await p.evaluate(() => document.getElementById('prac-write').hidden === false));
  확인('그 카드로 필터가 좁혀졌는가(창체 한 장만)',
       await p.evaluate(() => document.querySelectorAll('#prac-write-list .prac-card').length === 1));
  확인('그 카드 안에 편집 칸이 있는가', await p.evaluate(() => !!document.querySelector('#prac-write-list textarea')));

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
