// 설명서의 «따라 눌러 보기» — 연습 모드(teacher/?guide) 시뮬레이션을 처음부터 끝까지 눌러 봅니다 (2026-10-12)
//
// 시뮬레이션입니다(선생님 말씀): 선생님은 주황 테두리 단추만 누르고, 글자와 학생 답변(받아 적기)은 예시가 저절로 채워집니다.
//   · 가짜 서버(guide-server.js)만 쓰고 실제 서버(supabase.co)에는 요청이 하나도 안 가는가
//   · 연습하며 누른 것이 실제 화면의 브라우저 기억(localStorage)에 안 남는가
//   · 걸음마다: 테두리가 있는가 · 말풍선이 그 단추를 안 가리는가 · 그 단추를 누르면 넘어가는가
//   · 말풍선에 «다음» · «대신 해 주기» 같은 안내용 단추가 없는가
//   · 테두리 밖을 누르거나 키보드를 쳐도 화면이 안 바뀌는가
//   · 칸을 누르면 예시 글자가 저절로 · «답변 시작» 을 누르면 예시 답변이 회색 → 검은 글로 (마이크 안 씀)
//   · 목차에서 바로(?guide=N) 테두리 친 곳만 눌러 장마다 끝까지 가는가
//   · «답변 시작» 뒤 크롬 «마이크 사용» 허용 창(그림) — «허용» 전에는 받아 적지 않음
//   · 설명서(guide.html)는 따라 하기로 들어가는 한 화면 — 링크 · 400px
//
// 이 검사는 진짜 supabase 라이브러리 자리를 빈 파일로 막습니다 — 연습 모드는 그것 없이도 떠야 합니다.
const { chromium } = require('playwright');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const URL0 = 'http://127.0.0.1:8777/teacher/';

async function 새창(b, w, 폰) {
  const ctx = await b.newContext(폰 ? { viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }
                                    : { viewport: { width: w || 1440, height: 900 }, serviceWorkers: 'block' });
  const 바깥 = [];
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (/supabase\.co/.test(u)) { 바깥.push(u); return r.abort(); }
    if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
    if (/pretendard/.test(u)) return r.fulfill({ contentType: 'text/css', body: '' });
    if (/cdnjs\.cloudflare\.com/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
    return r.continue();
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const 묻는창 = []; p.on('dialog', d => { 묻는창.push(d.message()); d.accept(); });
  return { ctx, p, errs, 바깥, 묻는창 };
}

const 제목 = p => p.evaluate(() => {
  var pn = document.querySelector('.gd-panel');
  if (pn && !pn.hidden) { var a = pn.querySelector('.gd-t'); return a ? a.textContent : ''; }
  var t = document.querySelector('.gd-tip:not([hidden]) .gd-t'); return t ? t.textContent : '';
});
const 테두리 = p => p.evaluate(() => { var r = document.querySelector('.gd-ring'); return !!r && !r.hidden && r.offsetWidth > 10; });

// 그 글이 든 걸음이 될 때까지 기다립니다. 걸음이면 테두리가 있고, 말풍선이 테두리를 안 가리는지도 봅니다
async function 걸음(p, 글, 테두리도) {
  for (let i = 0; i < 300; i++) {          // 받아 적기 보여 주기는 읽을 시간까지 기다려서 길게(최대 30초)
    const t = await 제목(p);
    if (t.indexOf(글) > -1) {
      if (테두리도 !== false) {
        await p.waitForTimeout(350);
        const 가림 = await p.evaluate(() => {
          var r = document.querySelector('.gd-ring').getBoundingClientRect(), c = document.querySelector('.gd-tip').getBoundingClientRect();
          return !(r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom);
        });
        const 자리 = await p.evaluate(() => window.__guideState().place);
        확인('  «' + 글 + '» — 테두리 · 말풍선(' + 자리 + ')' + (가림 ? ' — 말풍선이 가림!' : ''), await 테두리(p) && !가림);
      }
      return true;
    }
    await p.waitForTimeout(100);
  }
  확인('«' + 글 + '» 걸음이 왔는가', false, '지금: ' + await 제목(p));
  return false;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 연습 모드가 뜨는가 ──');
  const A = await 새창(b);
  const p = A.p;
  await p.goto(URL0 + '?guide');
  await p.waitForSelector('.gd-panel .gd-menu', { timeout: 8000 });
  확인('목차가 뜨는가(장 여섯)', await p.evaluate(() => document.querySelectorAll('.gd-menu button').length === 6));
  확인('머리말에 «연습 모드» 표시', await p.evaluate(() => /연습 모드/.test(document.querySelector('.gd-badge').textContent)));
  확인('가짜 학생 12명', await p.evaluate(() => students.length === 12 && students[0].name === '김연습'));
  확인('로그아웃 대신 «연습 끝내기»', await p.evaluate(() => [].some.call(document.querySelectorAll('.top button'), b => b.textContent === '연습 끝내기')));
  확인('톡 단추는 숨김', await p.evaluate(() => getComputedStyle(document.getElementById('chat-open')).display === 'none'));
  확인('받아 적기는 가짜(마이크 안 씀)', await p.evaluate(() => window.webkitSpeechRecognition && /FakeSpeech/.test(String(window.webkitSpeechRecognition))));

  console.log('\n── 0. 화면 둘러보기 ──');
  await p.click('.gd-menu button[data-ch="0"]');
  await 걸음(p, '타학교 면접» 을 눌러');
  확인('  말풍선에 안내용 단추(다음 · 대신 해 주기)가 없는가', await p.evaluate(() => !document.querySelector('.gd-tip button')));
  await p.click('#rail-tab-other');
  await 걸음(p, '«우리 학교»');
  await p.click('#rail-tab-ours');
  await 걸음(p, '0장', false);

  console.log('\n── 1. 질문지 만들기 — 글자는 하나도 안 침 ──');
  await 걸음(p, '«1반»');
  await p.click('#class-chips .chip:nth-child(2)');
  await 걸음(p, '옆 ★');
  console.log('  (테두리 밖을 눌러 봄)');
  await p.click('#class-chips .chip:nth-child(3)', { force: true });     // 2반
  await p.waitForTimeout(200);
  확인('  테두리 밖(2반)을 눌러도 화면이 안 바뀌는가 · 말풍선이 흔들리는가', await p.evaluate(() =>
    pickedClass === '301' && document.querySelector('.gd-tip').classList.contains('gd-nudge')));
  await p.click('#student-list .srow:has(.railrow[onclick*="g01"]) .star');
  await 걸음(p, '김연습» 을 누르세요');
  await p.click('#student-list .railrow[onclick*="g01"]');
  await 걸음(p, '첫인사');
  확인('  지난 면접 1회차 · 수시 6곳이 보이는가', await p.evaluate(() =>
    document.querySelectorAll('#history .row').length === 1 && document.querySelectorAll('#susi .susirow').length === 6));
  await p.click('#opening-box .chip:nth-child(3)');
  await 걸음(p, '«창체 질문 3개»');
  await p.click('button[onclick^="loadCommon(\'changche\'"]');
  await 걸음(p, '질문 3개가 붙었습니다', false);
  확인('  누른 결과 보여 주기 — 초록 테두리가 «낼 질문» 목록에', await p.evaluate(() => {
    var r = document.querySelector('.gd-ring'), q = document.getElementById('q-list').getBoundingClientRect(), g = r.getBoundingClientRect();
    return !r.hidden && r.dataset.kind === 'show' && Math.abs(g.top - (q.top - 6)) < 2 && q.top >= 0 && q.top < innerHeight;
  }));
  await p.click('#q-list .qrow input', { force: true });
  await p.waitForTimeout(150);
  확인('  보여 주는 동안 눌러도 아무 일 없음', await p.evaluate(() => midQuestions.length === 3 && window.__guideState().showing));
  await 걸음(p, '직접 적기');
  await p.click('button[onclick^="addQuestion(\'\'"]');
  await 걸음(p, '무엇을 보는 질문인지');
  확인('  예시 질문이 저절로 적혔는가', await p.evaluate(() => midQuestions[midQuestions.length - 1].text.indexOf('반응 속도') > -1));
  await p.click('#q-list .qrow:last-child select');
  await 걸음(p, '순서를 바꿔');
  확인('  «학업역량» 이 골라졌는가', await p.evaluate(() => midQuestions[midQuestions.length - 1].competency === '학업역량'));
  await p.click('#q-list .qrow:last-child .qmove[data-d="-1"]');
  await 걸음(p, '«질문지 저장»');
  확인('  예시 질문이 한 칸 위로', await p.evaluate(() => midQuestions[midQuestions.length - 2].text.indexOf('반응 속도') > -1));
  await p.click('#btn-save-sheet');
  await 걸음(p, '1장', false);
  확인('  가짜 서버에 질문지가 저장됐는가(질문 6개)', await p.evaluate(() =>
    window.__guideDB.interview_answers.filter(a => a.interview_id === sheetId).length === 6));

  console.log('\n── 2. 면접 진행 · 받아 적기 — 마이크 없이 예시 답변 ──');
  await 걸음(p, '면접 화면으로 →» 를');
  await p.click('#btn-start');
  await 걸음(p, '«면접 시작»');
  await p.keyboard.press('Space');
  await p.waitForTimeout(150);
  확인('  키보드(Space)는 막혀 있는가', await p.evaluate(() => !ticking && !answering));
  await p.click('#btn-timer');
  await 걸음(p, '«답변 시작»');
  await p.click('#btn-answer');
  await 걸음(p, '마이크를 물으면');
  await p.waitForTimeout(700);
  확인('  «허용» 을 누르기 전에는 받아 적지 않는가', await p.evaluate(() => !answers[0].transcript && !LISTEN.interim));
  await p.click('#gd-mic-allow');
  await 걸음(p, '이렇게 적힙니다');
  const 들어감 = Date.now();
  확인('  허용 창이 사라졌는가', await p.evaluate(() => !document.getElementById('gd-mic')));
  확인('  언제 넘어가는지 막대 · 안내', await p.evaluate(() => !!document.querySelector('.gd-tip .gd-wait i') && /저절로 넘어갑니다/.test(document.querySelector('.gd-tip').textContent)));
  // 다섯 낱말마다 검은 글로 굳어 회색이 잠깐 비는 때가 있어, 3초 안에 한 번이라도 보이면 됩니다
  확인('  예시 답변이 회색(확정 전) 글로 흘러나오는가', await p.waitForFunction(() => !!document.querySelector('#live-text .interim'), null, { timeout: 3000 }).then(() => true, () => false));
  await p.waitForFunction(() => window.__guideSpoke[0], null, { timeout: 30000 });
  const 말끝 = Date.now();
  await 걸음(p, '우수 · 보통 · 미흡');
  확인('  받아 적기가 끝나도 바로 안 넘어가고 읽을 시간을 주는가(말풍선 12초 넘게 · 말 끝난 뒤 1초 넘게)',
       Date.now() - 들어감 >= 12000 && Date.now() - 말끝 >= 1000, ((Date.now() - 들어감) / 1000).toFixed(1) + '초');
  확인('  다 말한 뒤 첫 질문에 예시 답변 전체가 붙었는가', await p.evaluate(() => answers[0].transcript === window.__guideSaid(0)),
       await p.evaluate(() => answers[0].transcript));
  await p.click('#rating-area .rbtn:nth-child(1)');
  await 걸음(p, '영역 줄');
  await p.click('#area-grid .arearow:nth-child(2) .abtn.l0');
  await 걸음(p, '요지');
  await p.click('#answer-memo');
  await 걸음(p, '«＋ 꼬리 질문»');
  확인('  요지 예시가 저절로 적혔는가', await p.evaluate(() => answers[0].memo.indexOf('지원 동기') === 0));
  await p.click('#btn-follow');
  await 걸음(p, '꼬리 질문 칸');
  await p.click('#follow-text');
  await 걸음(p, '«넣기»');
  await p.click('#follow-add');
  await 걸음(p, '2번에 꼬리 질문이', false);
  확인('  꼬리 질문이 2번에 · 왼쪽 진행 상황에 초록 테두리', await p.evaluate(() =>
    questions[1].text.indexOf('틀을 만들') > -1 && qIndex === 1 && document.querySelector('.gd-ring').dataset.kind === 'show'));
  await 걸음(p, '꼬리 질문을 말하고');
  await p.click('#btn-answer');
  await 걸음(p, '«다음 질문 →»');
  await p.waitForFunction(() => window.__guideSpoke[1], null, { timeout: 30000 });
  확인('  꼬리 질문에는 그에 맞는 예시 답이 받아 적히는가', await p.evaluate(() => answers[1].transcript.indexOf('온도계 위치') > -1), await p.evaluate(() => answers[1].transcript));
  await p.click('#btn-next');
  await 걸음(p, '남은 질문도 같은 순서');
  await p.click('#btn-next');
  await 걸음(p, '2장', false);
  확인('  첫 질문의 판정 · 영역이 남고, 질문마다 받아 적은 글이 있는가', await p.evaluate(() =>
    answers[0].rating === '우수' && answers[0].areas['근거'] === '좋음' && answers.every(a => a.transcript)));

  console.log('\n── 3. 마무리 · 리포트 전달 ──');
  await 걸음(p, '좋았던 점 · 아쉬운 점');
  await p.click('#answer-summary .ansrow:first-child .eg-chips .chip.bad');
  await 걸음(p, 'A ~ E');
  await p.click('#scoresheet .scorerow:nth-child(1) .gbtn:nth-child(1)');
  await 걸음(p, '한 줄 총평');
  await p.click('#finish-note');
  await 걸음(p, '리포트 보기');
  await p.click('#btn-finish');
  await 걸음(p, '학생이 받을 리포트 한 장', false);
  확인('  리포트를 위에서부터 보여 주는가', await p.evaluate(() => { var r = document.getElementById('report-body').getBoundingClientRect(); return r.top > 0 && r.top < 200; }));
  await 걸음(p, '«학생에게 전달»');
  await p.click('#btn-deliver');
  await 걸음(p, '3장', false);
  확인('  가짜 서버에 «전달됨» · 예시 총평 · 채점표', await p.evaluate(() => {
    var iv = window.__guideDB.interviews.filter(i => i.student_id === 'g01' && i.id !== 'guide-past-1')[0];
    return !!iv && iv.status === '전달됨' && iv.overall_note.indexOf('결론을 먼저') > -1 && iv.grades['학업태도'] === 'A';
  }));

  console.log('\n── 4. 창이 닫혔을 때 ──');
  await 걸음(p, '이어서 하기 →» 를');
  await p.click('#unfinished-list button[onclick*="guide-resume"]');
  await 걸음(p, '«이어서» 를');
  확인('  안 매긴 셋째 질문에 가 있는가', await p.evaluate(() => qIndex === 2 && !ticking));
  await p.click('#btn-timer');
  await 걸음(p, '4장', false);

  console.log('\n── 5. 타학교 면접 ──');
  await 걸음(p, '타학교 면접» 을 누르세요');
  await p.click('#rail-tab-other');
  await 걸음(p, '타학교 학생 더하기');
  await p.click('.otheradd');
  await 걸음(p, '학교 · 이름 · 희망 전공');
  await p.click('#other-name');
  await 걸음(p, '«명단 저장»');
  확인('  학교 · 이름 · 희망 전공 예시가 저절로', await p.evaluate(() =>
    document.getElementById('other-school').value === '한빛고' && document.getElementById('other-name').value === '홍길동'));
  await p.click('.otheracts .btn.solid');
  await 걸음(p, '«📋 붙여넣기»');
  await p.click('.btnrow button[onclick="otherTogglePaste()"]');
  await 걸음(p, '붙여 넣는 칸');
  await p.click('#other-paste-text');
  await 걸음(p, '«낼 질문» 에 넣기');
  await p.click('#other-paste .btn.solid');
  await 걸음(p, '«질문지 저장»');
  확인('  붙여 넣은 세 질문(번호 뗌)', await p.evaluate(() => midQuestions.length === 3 && midQuestions[0].text === '탐구 주제를 고른 까닭은 무엇인가요?'));
  await p.click('#btn-save-sheet');
  await 걸음(p, '면접 화면으로 →» 를');
  확인('  목록에 «한빛고» 묶음 · 홍길동', !!(await p.evaluate(() => document.getElementById('other-list').textContent)).match(/한빛고[\s\S]*홍길동/));
  await p.click('#btn-start');
  await 걸음(p, '리포트 보기');
  await p.click('#btn-finish');
  await 걸음(p, 'QR 로 평가서 주기');
  await p.click('#btn-deliver');
  await 걸음(p, '학생이 찍었으면');
  확인('  말풍선이 QR 창보다 위에 있고 QR 그림을 안 가리는가', await p.evaluate(() => {
    var c = document.querySelector('.gd-tip').getBoundingClientRect(), q = document.querySelector('#qr-box').getBoundingClientRect();
    var el = document.elementFromPoint(c.left + c.width / 2, c.top + 20);
    return !!el && !!el.closest('.gd-tip') && (q.right <= c.left || q.left >= c.right || q.bottom <= c.top || q.top >= c.bottom);
  }));
  await p.click('.qr-btns .btn.solid');
  await 걸음(p, 'QR 다시 보기');
  await p.click('#btn-deliver');
  await 걸음(p, '«닫기» 를 누르세요');
  await p.click('.qr-btns .btn.solid');
  await 걸음(p, '모두 마쳤습니다', false);
  확인('  마지막 — «설명서로 돌아가기»', await p.evaluate(() => !!document.querySelector('.gd-panel [data-act="quit"]')));
  확인('  묻는 창(confirm · alert)이 한 번도 안 떴는가', A.묻는창.length === 0, A.묻는창.join(' | '));

  console.log('\n── 실제 서버 · 실제 기억은 그대로인가 ──');
  확인('supabase.co 로 간 요청이 없는가', A.바깥.length === 0, A.바깥.slice(0, 3).join(' '));
  확인('페이지 오류 없음', A.errs.length === 0, A.errs.join(' | '));
  const 실제기억 = await A.ctx.newPage();
  await 실제기억.goto('http://127.0.0.1:8777/version.txt');
  확인('실제 브라우저 기억(localStorage)에 연습한 것이 안 남는가', await 실제기억.evaluate(() =>
    localStorage.getItem('tagUse') === null && localStorage.getItem('otherLastSchool') === null && localStorage.length === 0),
    await 실제기억.evaluate(() => Object.keys(localStorage).join(',')));
  await A.ctx.close();

  console.log('\n── 목차에서 바로(?guide=N) — 테두리 친 곳만 눌러 장 끝까지 ──');
  // 노트북(1280)과 휴대폰(390, 손가락으로 톡) 둘 다 — 2026-10-12 휴대폰에서 ★ 단계에 막혔습니다(학생을 고르면 명단이 접힘)
  for (const [w, n] of [[1280, 0], [1280, 1], [1280, 2], [1280, 3], [1280, 4], [1280, 5],
                        [390, 0], [390, 1], [390, 2], [390, 3], [390, 4], [390, 5]]) {
    const B = await 새창(b, w, w < 600);
    await B.p.goto(URL0 + '?guide=' + n);
    await B.p.waitForSelector('.gd-tip:not([hidden]) .gd-t', { timeout: 8000 });
    let 누름 = 0, 막힘 = '';
    for (let i = 0; i < 160; i++) {
      await B.p.waitForTimeout(350);
      if (await B.p.evaluate(() => !document.querySelector('.gd-panel').hidden)) break;   // 장 끝 알림
      const st = await B.p.evaluate(() => window.__guideState());
      if (st.busy) continue;
      const t = await 제목(B.p);
      if (!(await 테두리(B.p))) { 막힘 = '테두리 없음: ' + t; break; }
      if (t.indexOf('👀') === 0) continue;               // 보여 주기만 하는 걸음 — 기다림
      // 테두리 친 곳 안에서 누를 것 하나(태그 단추 → 단추 → 칸)
      const h = await B.p.evaluateHandle(() => {
        var el = window.__guideTarget();
        if (!el) return null;
        if (/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return el;
        return el.querySelector('button.chip') || el.querySelector('button') || el.querySelector('input, textarea, select') || el;
      });
      if (!h.asElement()) continue;
      if (w < 600) await h.asElement().tap(); else await h.asElement().click();
      누름++;
      if (i === 159) 막힘 = '끝나지 않음: ' + t;
    }
    const 끝 = await B.p.evaluate(() => !document.querySelector('.gd-panel').hidden);
    확인(w + 'px · ' + n + '장 — 테두리 친 곳만 ' + 누름 + '번 눌러 끝까지', !막힘 && 끝, 막힘);
    확인('  supabase.co 요청 없음 · 오류 없음', B.바깥.length === 0 && B.errs.length === 0, B.errs.join(' | '));
    await B.ctx.close();
  }

  console.log('\n── 400px 휴대폰 ──');
  const D = await 새창(b, 400);
  await D.p.goto(URL0 + '?guide=1');
  await D.p.waitForSelector('.gd-tip:not([hidden]) .gd-t');
  await D.p.waitForTimeout(400);
  확인('말풍선이 화면 안에', await D.p.evaluate(() => {
    var r = document.querySelector('.gd-tip').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth;
  }));
  확인('옆으로 안 넘침', await D.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await D.ctx.close();

  console.log('\n── 설명서(guide.html) — 따라 하기로 들어가는 한 화면 ──');
  const E = await 새창(b, 1280);
  await E.p.goto('http://127.0.0.1:8777/teacher/guide.html');
  const 링크 = await E.p.evaluate(() => [].map.call(document.querySelectorAll('a[href*="?guide"]'), a => a.getAttribute('href')));
  확인('«따라 하기 시작»(?guide=0)과 부분 링크(?guide=1~5)', [0, 1, 2, 3, 4, 5].every(n => 링크.indexOf('index.html?guide=' + n) > -1), 링크.join(' '));
  확인('글로 된 0~7장 설명서는 없는가', await E.p.evaluate(() => !document.querySelector('section#s1, nav.toc')));
  await E.p.setViewportSize({ width: 400, height: 800 });
  확인('400px 에서 옆으로 안 넘침', await E.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  확인('설명서 오류 없음', E.errs.length === 0, E.errs.join(' | '));
  await E.ctx.close();
  확인('면접 화면 머리말 «📘 설명서» 가 따라 하기(?guide)로 가는가',
       /id="guide-link" href="\?guide"/.test(require('fs').readFileSync(require('path').join(__dirname, '../../teacher/index.html'), 'utf8')));

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
