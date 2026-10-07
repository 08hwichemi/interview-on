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
        reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: [],
        // 선생님이 생기부에서 뽑아 보낸 질문 (받은 질문)
        practice_offers: [
          { id: 'o1', student_id: 's1', grade: '3', area: '동아리활동', subject: '', status: '새로', teacher_name: '이용휘', created_at: '2026-10-07T01:00:00Z',
            question: '3학년 동아리활동에서 「이차전지의 환경오염」에 의문을 품었다고 적혀 있습니다. 무엇이 궁금했고, 어떻게 확인했나요?' },
          { id: 'o2', student_id: 's1', grade: '1', area: '자율활동', subject: '', status: '새로', teacher_name: '이용휘', created_at: '2026-10-07T00:59:00Z',
            question: '1학년 자율활동에서 「우리 반 생활 협약」을 사람들과 함께했다고 기록되어 있습니다.' },
          { id: 'o3', student_id: 's1', grade: '2', area: '세특', subject: '화학Ⅰ', status: '새로', teacher_name: '이용휘', created_at: '2026-10-07T00:58:00Z',
            question: '2학년 화학Ⅰ 시간에 「산-염기 중화 반응」 실험을 했다고 기록되어 있습니다.' }
        ]
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

  // 쓰는 동안은 서버에 안 보내고 이 기기(localStorage)에만 임시본을 둡니다 — 로그 줄이기
  await p.fill('.prac-q-input', '동아리에서 맡은 역할은?');
  await p.fill('.prac-a-input', '실험 설계를 맡았습니다.');
  await p.waitForTimeout(1900);
  // (질문 칸에서 답변 칸으로 옮길 때 질문 칸을 «벗어나서» 질문은 이미 저장됩니다 — 그게 맞습니다)
  확인('답변 칸에 쓰는 중인 글은 서버에 안 보내는가',
       (await 표(p, 'practice_answers')).every(r => (r.answer || '').indexOf('실험 설계') === -1),
       JSON.stringify((await 표(p, 'practice_answers')).map(r => r.answer)));
  확인('대신 이 기기에 임시본이 있는가',
       await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('pracDraft:' + PW.studentId) || '{}')).indexOf('실험 설계') > -1));
  await p.locator('.prac-a-input').first().blur();
  await p.waitForTimeout(400);
  var rows1 = await 표(p, 'practice_answers');
  확인('칸을 벗어나면 한 줄 저장됐는가', rows1.length === 1 && rows1[0].grade === '3' && rows1[0].category === '자율', JSON.stringify(rows1[0]));
  확인('서버에 올라가면 임시본을 지우는가', await p.evaluate(() => localStorage.getItem('pracDraft:' + PW.studentId) === null));

  console.log('\n── 바뀐 게 없으면 안 보내고, 앱을 떠나면 바로 보낸다 ──');
  await p.evaluate(() => { window.__upd = 0; var f = sb.from; sb.from = function (t) { var q = f.apply(this, arguments);
    if (t === 'practice_answers') { var u = q.update; q.update = function () { window.__upd++; return u.apply(this, arguments); }; } return q; }; });
  await p.locator('.prac-a-input').first().focus();
  await p.locator('.prac-a-input').first().blur();
  await p.waitForTimeout(300);
  확인('눌렀다가 그냥 나가면(바뀐 것 없음) 저장 안 하는가', await p.evaluate(() => window.__upd === 0));
  await p.fill('.prac-a-input', '실험 설계와 기록을 맡았습니다.');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
                           document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { delete document.hidden; });
  확인('앱/탭을 떠나면 바로 서버로 보내는가',
       (await 표(p, 'practice_answers'))[0].answer === '실험 설계와 기록을 맡았습니다.');

  console.log('\n── 못 보낸 임시본은 다음에 열 때 올린다 ──');
  await p.evaluate(() => {
    var id = PW.all[0].id, d = {};
    d[id] = { id: id, grade: '3', category: '자율', question: '동아리에서 맡은 역할은?',
              answer: '인터넷이 끊겨 못 보낸 글', t: Date.now() + 60000 };
    localStorage.setItem('pracDraft:' + PW.studentId, JSON.stringify(d));
  });
  await p.evaluate(() => practiceWriteInit(PW.studentId, '3', {}));
  await p.waitForTimeout(400);
  확인('임시본이 서버에 올라갔는가', (await 표(p, 'practice_answers'))[0].answer === '인터넷이 끊겨 못 보낸 글');
  확인('화면에도 그 글이 보이는가', (await p.inputValue('.prac-a-input')) === '인터넷이 끊겨 못 보낸 글');
  확인('올린 뒤 임시본을 지웠는가', await p.evaluate(() => localStorage.getItem('pracDraft:' + PW.studentId) === null));

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

  // 쓰다가 바로 필터를 눌러도(서버 답을 기다리지 않고 카드를 다시 그려도) 쓴 글이 그대로여야 합니다.
  await p.fill('#prac-write-list .prac-card:has-text("자율") .prac-a-input', '필터 누르기 직전에 고친 글');
  // 학년 «3» 만 고르면 하나만 남아야 합니다.
  await p.click('#prac-write-grade .prac-chip:has-text("3")');
  await p.waitForTimeout(50);
  확인('쓰다가 필터를 눌러도 쓴 글이 그대로 보이는가',
       (await p.inputValue('#prac-write-list .prac-card:has-text("자율") .prac-a-input')) === '필터 누르기 직전에 고친 글');
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
  await p.locator('.prac-a-input').first().blur();
  await p.waitForTimeout(400);
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

  console.log('\n── 받은 질문 — 선생님이 보낸 질문을 골라 넣기 ──');
  const 받은 = () => 표(p, 'practice_offers');
  const 단추들 = await p.$$eval('#screen-practice .prac-export button', es => es.map(e => e.textContent.trim()));
  확인('단추가 «받은 질문 · xlsx 저장 · 인쇄» 차례인가',
       단추들.length === 3 && 단추들[0].indexOf('받은 질문') > -1 && 단추들[1].indexOf('xlsx 저장') > -1 && 단추들[2].indexOf('인쇄') > -1, 단추들.join(' | '));
  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(150);
  확인('좁은 휴대폰(360px)에서도 세 단추가 한 줄에 들어가는가(옆으로 안 넘침)',
       await p.$eval('#screen-practice .prac-export', e => e.scrollWidth <= e.clientWidth + 1 &&
         [...e.children].every(c => c.scrollWidth <= c.clientWidth + 1)));
  await p.setViewportSize({ width: 420, height: 900 }); await p.waitForTimeout(150);
  확인('받은 질문 단추에 새로 받은 수(3)가 붙는가', (await p.textContent('#prac-offer-badge')) === '3' && !(await p.$eval('#prac-offer-badge', e => e.hidden)));
  확인('홈의 답안 연습장 숫자에도 들어가는가', (await p.textContent('#practice-badge')) === '3');

  await p.click('.prac-offer-btn'); await p.waitForTimeout(300);
  확인('휴대폰에서 받은 질문 창이 화면 높이의 80% 넘게 쓰는가',
       await p.$eval('.prac-offer-modal', e => e.getBoundingClientRect().height > window.innerHeight * 0.8));
  확인('받은 질문 창이 뜨는가', await p.evaluate(() => document.getElementById('prac-offer-overlay').style.display === 'flex'));
  확인('받은 질문 3개가 체크칸과 함께 보이는가', (await p.$$('#prac-offer-list .prac-offer input[type="checkbox"]')).length === 3);
  확인('처음엔 «넣기» 단추가 쉬는가', await p.$eval('#prac-offer-add', e => e.disabled));
  // 학년 · 영역(· 과목) 머리줄로 나뉘고, 1학년부터 차례로
  const 머리 = await p.$$eval('#prac-offer-list .prac-offer-group', es => es.map(e => e.textContent));
  확인('학년·영역 머리줄로 나뉘는가 (1학년 자율 → 2학년 세특 화학Ⅰ → 3학년 동아리)',
       머리.length === 3 && /^1학년 · 자율활동/.test(머리[0]) && /^2학년 · 세특 · 화학Ⅰ/.test(머리[1]) && /^3학년 · 동아리활동/.test(머리[2]), 머리.join(' | '));
  확인('보낸 선생님이 보이는가', (await p.textContent('#prac-offer-list .prac-offer >> nth=0')).indexOf('이용휘 선생님') > -1);
  // 학년 칩 · 영역 칩으로 골라 보기
  const 칩 = await p.$$eval('.prac-offer-filter .prac-chip', es => es.map(e => e.textContent.trim()));
  확인('받은 것에 있는 학년·영역만 칩으로 뜨는가', 칩.join() === '1학년,2학년,3학년,자율활동,동아리활동,세특', 칩.join());
  await p.click('.prac-offer-filter .prac-chip:has-text("세특")'); await p.waitForTimeout(100);
  확인('영역 칩(세특)을 누르면 그것만 보이는가', (await p.$$('#prac-offer-list .prac-offer:not(.gone)')).length === 1 &&
       (await p.textContent('.prac-offer-bar')).indexOf('골라 본 질문 1개 / 전체 3개') > -1);
  await p.click('#prac-offer-all'); await p.waitForTimeout(100);
  확인('골라 보는 중 «전체 선택» 은 보이는 것만 고르는가', (await p.textContent('#prac-offer-add')) === '고른 1개 넣기');
  await p.click('#prac-offer-all'); await p.waitForTimeout(100);
  await p.click('.prac-offer-filter .prac-chip:has-text("세특")'); await p.waitForTimeout(100);
  await p.click('.prac-offer-filter .prac-chip:has-text("3학년")'); await p.waitForTimeout(100);
  확인('학년 칩(3학년)을 누르면 3학년 것만 보이는가', (await p.$$('#prac-offer-list .prac-offer:not(.gone)')).length === 1 &&
       (await p.textContent('#prac-offer-list .prac-offer-group')).indexOf('3학년') === 0);
  await p.click('.prac-offer-filter .prac-chip:has-text("3학년")'); await p.waitForTimeout(100);
  확인('칩을 다 풀면 다시 전부 보이는가', (await p.$$('#prac-offer-list .prac-offer:not(.gone)')).length === 3);

  // 전체 선택 ↔ 전체 해제
  await p.click('#prac-offer-all'); await p.waitForTimeout(100);
  확인('«전체 선택» 을 누르면 셋 다 체크되는가', (await p.$$('#prac-offer-list .prac-offer input:checked')).length === 3 &&
       (await p.textContent('#prac-offer-add')) === '고른 3개 넣기');
  확인('«전체 선택» 체크칸이 켜지는가', await p.$eval('#prac-offer-all', e => e.checked && !e.indeterminate));
  await p.click('#prac-offer-all'); await p.waitForTimeout(100);
  확인('한 번 더 누르면 다 풀리는가', (await p.$$('#prac-offer-list .prac-offer input:checked')).length === 0 &&
       await p.$eval('#prac-offer-add', e => e.disabled) && await p.$eval('#prac-offer-all', e => !e.checked));

  await p.click('#prac-offer-list .prac-offer[data-id="o1"] .prac-offer-pick');
  await p.click('#prac-offer-list .prac-offer[data-id="o2"] .prac-offer-pick'); await p.waitForTimeout(100);
  확인('여러 개 고를 수 있는가 (고른 2개 넣기)', (await p.textContent('#prac-offer-add')) === '고른 2개 넣기');
  확인('몇 개만 고르면 전체 선택이 «일부» 표시(−)인가', await p.$eval('#prac-offer-all', e => !e.checked && e.indeterminate));
  await p.click('#prac-offer-list .prac-offer[data-id="o3"] .prac-offer-skip'); await p.waitForTimeout(300);
  확인('「안 쓸래요」 를 누르면 안씀 표시가 되는가', (await 받은()).find(r => r.id === 'o3').status === '안씀');
  확인('치운 것은 아래 «안 쓰기로 한 것» 으로 가는가', (await p.textContent('.prac-offer-old summary')).indexOf('안 쓰기로 한 것 1개') > -1);
  확인('치워도 고른 두 개는 그대로인가', (await p.textContent('#prac-offer-add')) === '고른 2개 넣기');

  var before = (await 표(p, 'practice_answers')).length;
  await p.click('#prac-offer-add'); await p.waitForTimeout(500);
  확인('넣으면 창이 닫히는가', await p.evaluate(() => document.getElementById('prac-offer-overlay').style.display === 'none'));
  var 넣은 = (await 표(p, 'practice_answers')).filter(r => r.category === '선생님 질문');
  확인('고른 두 개가 «선생님 질문» 카드로 들어가는가', 넣은.length === 2 && (await 표(p, 'practice_answers')).length === before + 2, JSON.stringify(넣은.map(r => r.grade)));
  확인('학년은 질문이 나온 학년인가 (3 · 1)', 넣은.map(r => r.grade).sort().join() === '1,3');
  확인('답은 비어 있는가', 넣은.every(r => r.answer === ''));
  확인('받은 질문은 «넣음» 이 되는가', (await 받은()).filter(r => r.status === '넣음').length === 2);
  확인('창체로 좁혀 둔 필터가 풀려서 새 카드가 보이는가',
       await p.evaluate(() => [...document.querySelectorAll('#prac-write-list .prac-card')].filter(c => c.textContent.indexOf('선생님 질문') > -1).length === 2));
  확인('빨간 숫자가 사라지는가', await p.$eval('#prac-offer-badge', e => e.hidden));

  // 질문 글자는 «쓴 것들» 카드에서 고칩니다. 받은 원문은 그대로
  const 카드 = p.locator('#prac-write-list .prac-card', { hasText: '이차전지' }).first();
  await 카드.locator('.prac-q-input').fill('이차전지 폐기 문제를 왜 궁금해했나요?');
  await 카드.locator('.prac-q-input').blur(); await p.waitForTimeout(400);
  확인('카드에서 질문 글자를 고칠 수 있는가', (await 표(p, 'practice_answers')).some(r => r.question === '이차전지 폐기 문제를 왜 궁금해했나요?'));
  확인('받은 질문의 원래 글은 그대로인가', (await 받은()).find(r => r.id === 'o1').question.indexOf('3학년 동아리활동에서') === 0);

  await p.click('.prac-offer-btn'); await p.waitForTimeout(300);
  확인('다 넣으면 «다 골랐습니다» 가 뜨는가', (await p.textContent('#prac-offer-list')).indexOf('다 골랐습니다') > -1);
  확인('넣은 것 2개 · 안 쓰기로 한 것 1개', (await p.textContent('.prac-offer-old summary')).indexOf('넣은 것 2개 · 안 쓰기로 한 것 1개') > -1);
  await p.click('.prac-offer-old summary');
  await p.click('.prac-offer.gone .prac-offer-skip:has-text("다시 보기")'); await p.waitForTimeout(300);
  확인('«다시 보기» 로 치운 것을 되살리는가', (await 받은()).find(r => r.id === 'o3').status === '새로' &&
       (await p.$$('#prac-offer-list .prac-offer input[type="checkbox"]')).length === 1);
  확인('되살리면 빨간 숫자가 1 이 되는가', (await p.textContent('#prac-offer-badge')) === '1');
  await p.click('#prac-offer-overlay .close-btn');
  await p.setViewportSize({ width: 1400, height: 900 }); await p.waitForTimeout(150);
  await p.click('.prac-offer-btn'); await p.waitForTimeout(300);
  const 크기 = await p.$eval('.prac-offer-modal', e => { const r = e.getBoundingClientRect(); return { w: r.width / innerWidth, h: r.height / innerHeight }; });
  확인('넓은 화면에서는 창 너비의 약 72%·높이의 약 82% 로 커지는가', 크기.w > 0.68 && 크기.w < 0.76 && 크기.h > 0.78, JSON.stringify(크기));
  await p.click('#prac-offer-overlay .close-btn');
  await p.setViewportSize({ width: 420, height: 900 }); await p.waitForTimeout(150);

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
