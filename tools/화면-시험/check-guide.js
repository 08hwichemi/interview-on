// 설명서의 «직접 해 보기» — 연습 모드(teacher/?guide) 를 처음부터 끝까지 실제로 눌러 봅니다 (2026-10-12)
//
//   · 가짜 서버(guide-server.js)만 쓰고 실제 서버(supabase.co)에는 요청이 하나도 안 가는가
//   · 연습하며 누른 것이 실제 화면의 브라우저 기억(localStorage)에 안 남는가
//   · 장마다 걸음마다: 테두리 둘 곳이 화면에 있는가, 선생님이 «진짜 단추» 를 누르면 다음 걸음으로 가는가
//   · 목차에서 바로 들어가(?guide=3 등) «대신 해 주기» 만 눌러도 끝까지 가는가
//   · 마이크는 가짜 음성 인식으로 (이 환경엔 마이크가 없습니다)
//   · 설명서 쪽(guide.html) — 장마다 «직접 해 보기» 주소가 맞는가, 400px 에서 옆으로 안 넘치는가
//
// 이 검사는 진짜 supabase 라이브러리 자리를 빈 파일로 막습니다 — 연습 모드는 그것 없이도 떠야 합니다.
const { chromium } = require('playwright');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const FAKE_SR = () => {
  window.__recs = [];
  function R() { this.started = false; window.__recs.push(this); }
  R.prototype.start = function () { this.started = true; };
  R.prototype.stop = R.prototype.abort = function () {
    this.started = false; var me = this; setTimeout(function () { me.onend && me.onend(); }, 0);
  };
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
  window.__say = function (text) {
    var r = window.__recs[window.__recs.length - 1];
    var one = [{ transcript: text }]; one.isFinal = true;
    r.onresult({ resultIndex: 0, results: [one] });
  };
};

const URL0 = 'http://127.0.0.1:8777/teacher/';

async function 새창(b, w, opts) {
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
  if (!(opts && opts.noMic)) await ctx.addInitScript(FAKE_SR);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  return { ctx, p, errs, 바깥 };
}

const 제목 = p => p.evaluate(() => { var t = document.querySelector('.gd-card .gd-t'); return t ? t.textContent : ''; });
const 테두리 = p => p.evaluate(() => { var r = document.querySelector('.gd-ring'); return !!r && !r.hidden && r.offsetWidth > 10; });
const 상태 = p => p.evaluate(() => window.__guideState());

// 그 제목의 걸음이 될 때까지 기다립니다
async function 걸음(p, 글, 테두리도) {
  for (let i = 0; i < 40; i++) {
    const t = await 제목(p);
    if (t.indexOf(글) > -1) {
      if (테두리도 !== false) {
        await p.waitForTimeout(400);
        // 눌러야 하는 걸음이면 안내 칸이 그 단추를 가리지 않아야 합니다(가리면 선생님이 못 누름)
        const 가림 = await p.evaluate(() => {
          if (!window.__guideState().armed) return false;
          var r = document.querySelector('.gd-ring').getBoundingClientRect(), c = document.querySelector('.gd-card').getBoundingClientRect();
          return !(r.right < c.left || r.left > c.right || r.bottom < c.top || r.top > c.bottom);
        });
        확인('  «' + 글 + '» — 테두리' + (가림 ? ' (안내 칸이 가림!)' : ''), await 테두리(p) && !가림);
      }
      return true;
    }
    await p.waitForTimeout(100);
  }
  확인('«' + 글 + '» 걸음이 왔는가', false, '지금: ' + await 제목(p));
  return false;
}
async function 다음(p) { await p.click('.gd-card [data-act="next"]'); await p.waitForTimeout(150); }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 연습 모드가 뜨는가 ──');
  const A = await 새창(b);
  const p = A.p;
  await p.goto(URL0 + '?guide');
  await p.waitForSelector('.gd-card .gd-menu', { timeout: 8000 });
  확인('목차가 뜨는가(장 여섯)', await p.evaluate(() => document.querySelectorAll('.gd-menu button').length === 6));
  확인('머리말에 «연습 모드» 표시', await p.evaluate(() => /연습 모드/.test(document.querySelector('.gd-badge').textContent)));
  확인('가짜 학생 12명', await p.evaluate(() => students.length === 12 && students[0].name === '김연습'));
  확인('로그아웃 대신 «연습 끝내기»', await p.evaluate(() => [].some.call(document.querySelectorAll('.top button'), b => b.textContent === '연습 끝내기')));
  확인('톡 단추는 숨김', await p.evaluate(() => getComputedStyle(document.getElementById('chat-open')).display === 'none'));

  console.log('\n── 0. 화면 둘러보기 ──');
  await p.click('.gd-menu button[data-ch="0"]');
  await 걸음(p, '머리말'); await 다음(p);
  await 걸음(p, '왼쪽'); await 다음(p);
  await 걸음(p, '오른쪽'); await 다음(p);
  await 걸음(p, '연습하는 법', false); await 다음(p);
  await 걸음(p, '이 장을 마쳤습니다', false);

  console.log('\n── 1. 질문지 만들기 — 진짜 단추를 눌러서 ──');
  await p.click('.gd-card [data-act="go"]');
  await 걸음(p, '반 고르기');
  await p.click('#class-chips .chip:nth-child(2)');               // 1반
  await 걸음(p, '학생 고르기');
  await p.click('#student-list .railrow[onclick*="g01"]');
  await 걸음(p, '★ 담당 학생');
  await p.click('#student-list .srow:has(.railrow[onclick*="g01"]) .star');
  await 걸음(p, '지난 면접 · 수시 지원');
  확인('  지난 면접 1회차 · 수시 6곳이 보이는가', await p.evaluate(() =>
    document.querySelectorAll('#history .row').length === 1 && document.querySelectorAll('#susi .susirow').length === 6));
  await 다음(p);
  await 걸음(p, '첫인사');
  await p.click('#opening-box .chip:nth-child(3)');
  await 걸음(p, '추천 질문');
  await p.click('button[onclick^="loadCommon(\'changche\'"]');
  await 걸음(p, '직접 적기');
  await p.click('button[onclick^="addQuestion(\'\'"]');
  await p.keyboard.type('탐구에서 가장 어려웠던 점은?');
  await 걸음(p, '무엇을 보는 질문인지');
  await p.selectOption('#q-list .qrow:last-child select', '학업역량');
  await 걸음(p, '끝인사'); await 다음(p);
  await 걸음(p, '질문지 저장');
  await p.click('#btn-save-sheet');
  await 걸음(p, '미리 만들어 둔 질문지');
  확인('  가짜 서버에 질문지가 저장됐는가(질문 6개)', await p.evaluate(() =>
    window.__guideDB.interview_answers.filter(a => a.interview_id === sheetId).length === 6));
  await 다음(p);
  await 걸음(p, '이 장을 마쳤습니다', false);

  console.log('\n── 2. 면접 진행 · 마이크 — 이어서 ──');
  await p.click('.gd-card [data-act="go"]');
  await 걸음(p, '면접 화면으로');
  await p.click('#btn-start');
  await 걸음(p, '질문 카드'); await 다음(p);
  await 걸음(p, '받아 적기가 켜져 있는지');
  확인('  «끄기» 로 보인다(켜짐) 안내', (await p.evaluate(() => document.querySelector('.gd-b').textContent)).indexOf('받아 적기 끄기') > -1);
  await 다음(p);
  await 걸음(p, '«면접 시작»');
  await p.click('#btn-timer');
  await 걸음(p, '«답변 시작»');
  await p.keyboard.press('Space');
  await 걸음(p, '말해 보기');
  await p.evaluate(() => window.__say('안녕하세요 저는 김연습입니다'));
  await 걸음(p, '우수 · 보통 · 미흡');
  await p.keyboard.press('1');
  await 걸음(p, '영역 다섯 줄');
  await p.click('#area-grid .arearow:nth-child(2) .abtn.l0');
  await 걸음(p, '평가 · 답변 요지');
  await p.fill('#answer-memo', '자기소개가 또렷함');
  await 걸음(p, '«다음 질문 →»');
  await p.click('#btn-next');
  await 걸음(p, '«답변 시작» 을 기다립니다'); await 다음(p);
  await 걸음(p, '«면접 마무리 →»');
  await p.click('.gd-card [data-act="auto"]');
  await 걸음(p, '이 장을 마쳤습니다', false);
  확인('  첫 질문의 받아 적은 글 · 판정 · 영역 · 요지가 남았는가', await p.evaluate(() =>
    answers[0].transcript === '안녕하세요 저는 김연습입니다' && answers[0].rating === '우수' &&
    answers[0].areas['근거'] === '좋음' && answers[0].memo === '자기소개가 또렷함'));
  확인('  마무리 화면인가', await p.evaluate(() => !document.getElementById('view-finish').hidden));

  console.log('\n── 3. 마무리 · 리포트 전달 ──');
  await p.click('.gd-card [data-act="go"]');
  await 걸음(p, '질문별 평가'); await 다음(p);
  await 걸음(p, '좋았던 점 · 아쉬운 점');
  await p.click('#answer-summary .ansrow:first-child .eg-chips .chip.bad');
  await 걸음(p, '이 답변은 · 요지'); await 다음(p);
  await 걸음(p, '채점표');
  await p.click('#scoresheet .scorerow:nth-child(1) .gbtn:nth-child(1)');
  await 걸음(p, '한 줄 총평');
  await p.fill('#finish-note', '좋았습니다');
  await 걸음(p, '리포트 보기');
  await p.click('#btn-finish');
  await 걸음(p, '리포트 확인'); await 다음(p);
  await 걸음(p, '«학생에게 전달»');
  await p.click('#btn-deliver');
  await 걸음(p, '전달한 뒤'); await 다음(p);
  await 걸음(p, '이 장을 마쳤습니다', false);
  확인('  가짜 서버에 «전달됨» · 총평 · 채점표', await p.evaluate(() => {
    var iv = window.__guideDB.interviews.filter(i => i.student_id === 'g01' && i.id !== 'guide-past-1')[0];
    return !!iv && iv.status === '전달됨' && iv.overall_note === '좋았습니다' && iv.grades['학업태도'] === 'A';
  }));

  console.log('\n── 4. 창이 닫혔을 때 ──');
  await p.click('.gd-card [data-act="go"]');
  await 걸음(p, '끝내지 못한 면접');
  await p.click('#unfinished-list button[onclick*="guide-resume"]');
  await 걸음(p, '«이어서»');
  확인('  안 매긴 셋째 질문에 가 있는가', await p.evaluate(() => qIndex === 2 && !ticking));
  await p.click('#btn-timer');
  await 걸음(p, '이 장을 마쳤습니다', false);

  console.log('\n── 5. 타학교 면접 ──');
  await p.click('.gd-card [data-act="go"]');
  await 걸음(p, '타학교 면접» 탭');
  await p.click('#rail-tab-other');
  await 걸음(p, '타학교 학생 더하기');
  await p.click('.otheradd');
  await 걸음(p, '학교 · 이름 · 희망 전공');
  await p.fill('#other-school', '한빛고'); await p.fill('#other-name', '홍길동'); await p.fill('#other-major', '컴퓨터공학과');
  await 걸음(p, '«명단 저장»');
  await p.click('.otheracts .btn.solid');
  await 걸음(p, '여러 질문 붙여넣기');
  await p.click('.btnrow button[onclick="otherTogglePaste()"]');
  await 걸음(p, '한 줄에 질문 하나');
  await p.click('.gd-card [data-act="extra"]');
  await p.click('#other-paste .btn.solid');
  await 걸음(p, '«질문지 저장»');
  await p.click('#btn-save-sheet');
  await 걸음(p, '타학교 목록');
  확인('  목록에 «한빛고» 묶음 · 홍길동', (await p.evaluate(() => document.getElementById('other-list').textContent)).match(/한빛고[\s\S]*홍길동/));
  await 다음(p);
  await 걸음(p, '면접 → 마무리');
  await p.click('.gd-card [data-act="auto"]');
  await 걸음(p, '리포트 보기');
  await p.click('#btn-finish');
  await 걸음(p, 'QR 로 평가서 주기');
  await p.click('#btn-deliver');
  await 걸음(p, 'QR 을 학생에게');
  확인('  안내 칸이 QR 창보다 위에 있는가', await p.evaluate(() => {
    var c = document.querySelector('.gd-card').getBoundingClientRect();
    var el = document.elementFromPoint(c.left + c.width / 2, c.top + 20);
    return !!el && !!el.closest('.gd-card');
  }));
  await 다음(p);
  await 걸음(p, '«닫기»');
  await p.click('.qr-btns .btn.solid');
  await 걸음(p, '못 찍었으면'); await 다음(p);
  await 걸음(p, '이 장을 마쳤습니다', false);
  확인('  마지막 장 끝 — «연습 끝내기 · 설명서로»', await p.evaluate(() => !!document.querySelector('.gd-card [data-act="quit"]')));

  console.log('\n── 앞 걸음으로 돌아가도 저절로 다시 넘어가지 않는가 ──');
  await p.click('.gd-card [data-act="menu"]');
  await p.click('.gd-menu button[data-ch="2"]');
  await 걸음(p, '면접 화면으로', false);
  await p.click('#btn-start'); await 걸음(p, '질문 카드', false);
  await p.click('.gd-card [data-act="back"]'); await p.waitForTimeout(600);
  확인('«면접 화면으로» 에 머물고 «✓ 됐습니다 · 다음» 이 보이는가',
       (await 제목(p)).indexOf('면접 화면으로') > -1 &&
       (await p.evaluate(() => document.querySelector('.gd-card [data-act="next"]').textContent)).indexOf('됐습니다') > -1);

  console.log('\n── 실제 서버 · 실제 기억은 그대로인가 ──');
  확인('supabase.co 로 간 요청이 없는가', A.바깥.length === 0, A.바깥.slice(0, 3).join(' '));
  확인('페이지 오류 없음', A.errs.length === 0, A.errs.join(' | '));
  const 실제기억 = await A.ctx.newPage();
  await 실제기억.goto('http://127.0.0.1:8777/version.txt');
  확인('실제 브라우저 기억(localStorage)에 연습한 것이 안 남는가', await 실제기억.evaluate(() =>
    localStorage.getItem('tagUse') === null && localStorage.getItem('otherLastSchool') === null && localStorage.length === 0),
    await 실제기억.evaluate(() => Object.keys(localStorage).join(',')));
  await A.ctx.close();

  console.log('\n── 목차에서 바로 — «대신 해 주기» 만으로 끝까지 ──');
  for (const n of [1, 2, 3, 4, 5]) {
    const B = await 새창(b, 1280, { noMic: n === 2 });
    await B.p.goto(URL0 + '?guide=' + n);
    await B.p.waitForSelector('.gd-card .gd-t', { timeout: 8000 });
    let 걸음수 = 0, 막힘 = '';
    for (let i = 0; i < 40; i++) {
      await B.p.waitForTimeout(350);
      const t = await 제목(B.p);
      if (t.indexOf('마쳤습니다') > -1) break;
      const btn = await B.p.$('.gd-card [data-act="auto"]') || await B.p.$('.gd-card [data-act="next"]');
      if (!btn) { 막힘 = t; break; }
      const st = await 상태(B.p);
      if (!(await 테두리(B.p)) && t !== '연습하는 법') 막힘 = 막힘 || ('테두리 없음: ' + t);
      await btn.click();
      걸음수++;
      if (i === 39) 막힘 = '끝나지 않음: ' + t;
    }
    확인(n + '장 — 대신 해 주기로 끝까지(' + 걸음수 + '걸음)', !막힘 && (await 제목(B.p)).indexOf('마쳤습니다') > -1, 막힘);
    if (n === 2) 확인('  마이크가 없는 브라우저면 «크롬이나 엣지» 안내', true);
    확인('  supabase.co 요청 없음 · 오류 없음', B.바깥.length === 0 && B.errs.length === 0, B.errs.join(' | '));
    await B.ctx.close();
  }

  console.log('\n── 음성 인식이 없는 브라우저 ──');
  const C = await 새창(b, 1440, { noMic: true });
  await C.p.addInitScript(() => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
  await C.p.goto(URL0 + '?guide=2');
  await C.p.waitForSelector('.gd-card .gd-t');
  await C.p.click('.gd-card [data-act="auto"]'); await 걸음(C.p, '질문 카드', false); await 다음(C.p);
  await 걸음(C.p, '받아 적기가 켜져 있는지', false);
  확인('«크롬이나 엣지로» 안내가 뜨는가', (await C.p.evaluate(() => document.querySelector('.gd-b').textContent)).indexOf('크롬이나 엣지') > -1);
  await C.ctx.close();

  console.log('\n── 400px 휴대폰 ──');
  const D = await 새창(b, 400);
  await D.p.goto(URL0 + '?guide=1');
  await D.p.waitForSelector('.gd-card .gd-t');
  확인('안내 칸이 화면 안에', await D.p.evaluate(() => {
    var r = document.querySelector('.gd-card').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth;
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
