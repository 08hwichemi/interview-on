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
//   · 설명서 쪽(guide.html) — 장마다 «따라 눌러 보기» 주소 · 단추 이름이 실제 화면에 있는가 · 400px
//
// 이 검사는 진짜 supabase 라이브러리 자리를 빈 파일로 막습니다 — 연습 모드는 그것 없이도 떠야 합니다.
const { chromium } = require('playwright');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const URL0 = 'http://127.0.0.1:8777/teacher/';

async function 새창(b, w) {
  const ctx = await b.newContext({ viewport: { width: w || 1440, height: 900 }, serviceWorkers: 'block' });
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
  for (let i = 0; i < 80; i++) {
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
  await 걸음(p, '김연습» 을 누르세요');
  console.log('  (테두리 밖을 눌러 봄)');
  await p.click('#class-chips .chip:nth-child(3)', { force: true });     // 2반
  await p.waitForTimeout(200);
  확인('  테두리 밖(2반)을 눌러도 화면이 안 바뀌는가 · 말풍선이 흔들리는가', await p.evaluate(() =>
    pickedClass === '301' && document.querySelector('.gd-tip').classList.contains('gd-nudge')));
  await p.click('#student-list .railrow[onclick*="g01"]');
  await 걸음(p, '★');
  확인('  지난 면접 1회차 · 수시 6곳이 보이는가', await p.evaluate(() =>
    document.querySelectorAll('#history .row').length === 1 && document.querySelectorAll('#susi .susirow').length === 6));
  await p.click('#student-list .srow:has(.railrow[onclick*="g01"]) .star');
  await 걸음(p, '첫인사');
  await p.click('#opening-box .chip:nth-child(3)');
  await 걸음(p, '«창체 질문 3개»');
  await p.click('button[onclick^="loadCommon(\'changche\'"]');
  await 걸음(p, '직접 적기');
  await p.click('button[onclick^="addQuestion(\'\'"]');
  await 걸음(p, '무엇을 보는 질문인지');
  확인('  예시 질문이 저절로 적혔는가', await p.evaluate(() => midQuestions[midQuestions.length - 1].text.indexOf('반응 속도') > -1));
  await p.click('#q-list .qrow:last-child select');
  await 걸음(p, '«질문지 저장»');
  확인('  «학업역량» 이 골라졌는가', await p.evaluate(() => midQuestions[midQuestions.length - 1].competency === '학업역량'));
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
  await 걸음(p, '이렇게 적힙니다');
  await p.waitForTimeout(500);
  확인('  예시 답변이 회색(확정 전) 글로 흘러나오는가', await p.evaluate(() => !!document.querySelector('#live-text .interim')));
  await 걸음(p, '우수 · 보통 · 미흡');
  확인('  다 말한 뒤 첫 질문에 예시 답변 전체가 붙었는가', await p.evaluate(() => answers[0].transcript === window.__guideSaid[0]),
       await p.evaluate(() => answers[0].transcript));
  await p.click('#rating-area .rbtn:nth-child(1)');
  await 걸음(p, '영역 줄');
  await p.click('#area-grid .arearow:nth-child(2) .abtn.l0');
  await 걸음(p, '요지');
  await p.click('#answer-memo');
  await 걸음(p, '«다음 질문 →»');
  확인('  요지 예시가 저절로 적혔는가', await p.evaluate(() => answers[0].memo.indexOf('지원 동기') === 0));
  await p.click('#btn-next');
  await 걸음(p, '다시 «답변 시작»');
  await p.click('#btn-answer');
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
  await 걸음(p, '여러 질문 붙여넣기');
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
  for (const n of [0, 1, 2, 3, 4, 5]) {
    const B = await 새창(b, 1280);
    await B.p.goto(URL0 + '?guide=' + n);
    await B.p.waitForSelector('.gd-tip:not([hidden]) .gd-t', { timeout: 8000 });
    let 누름 = 0, 막힘 = '';
    for (let i = 0; i < 60; i++) {
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
      await h.asElement().click();
      누름++;
      if (i === 59) 막힘 = '끝나지 않음: ' + t;
    }
    const 끝 = await B.p.evaluate(() => !document.querySelector('.gd-panel').hidden);
    확인(n + '장 — 테두리 친 곳만 ' + 누름 + '번 눌러 끝까지', !막힘 && 끝, 막힘);
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

  console.log('\n── 설명서(guide.html) ──');
  const E = await 새창(b, 1280);
  await E.p.goto('http://127.0.0.1:8777/teacher/guide.html');
  const 링크 = await E.p.evaluate(() => [].map.call(document.querySelectorAll('a.try'), a => a.getAttribute('href')));
  확인('장마다 «직접 해 보기» 링크(?guide=0~5)', [0, 1, 2, 3, 4, 5].every(n => 링크.indexOf('index.html?guide=' + n) > -1), 링크.join(' '));
  확인('맨 위 «연습 시작» 링크', await E.p.evaluate(() => !!document.querySelector('a[href="index.html?guide"]')));
  // 설명서 속 단추 이름(«…»)이 실제 화면에 있는가 — 낡지 않게
  const 이름들 = await E.p.evaluate(() => [].map.call(document.querySelectorAll('.k:not(.x)'), x => x.textContent.trim()));
  const 화면 = require('fs').readFileSync(require('path').join(__dirname, '../../teacher/index.html'), 'utf8') +
               require('fs').readFileSync(require('path').join(__dirname, '../../assets/js/teacher-app.js'), 'utf8') +
               require('fs').readFileSync(require('path').join(__dirname, '../../assets/js/other-school.js'), 'utf8') +
               require('fs').readFileSync(require('path').join(__dirname, '../../assets/js/listen.js'), 'utf8') +
               require('fs').readFileSync(require('path').join(__dirname, '../../assets/js/report.js'), 'utf8') +
               require('fs').readFileSync(require('path').join(__dirname, '../../r.html'), 'utf8') +
               require('fs').readFileSync(require('path').join(__dirname, '../../assets/js/other-report-page.js'), 'utf8');
  const 없음 = 이름들.filter(n => 화면.indexOf(n) === -1);
  확인('설명서의 단추 이름 ' + 이름들.length + '개가 모두 실제 화면에 있는가', 이름들.length > 20 && !없음.length, 없음.join(' / '));
  await E.p.setViewportSize({ width: 400, height: 800 });
  확인('400px 에서 옆으로 안 넘침', await E.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  확인('설명서 오류 없음', E.errs.length === 0, E.errs.join(' | '));
  await E.ctx.close();

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
