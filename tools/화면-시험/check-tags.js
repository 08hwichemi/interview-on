// 평가 단추(태그) — 2026-10-10 부터 **마무리 화면**에서 질문마다 누릅니다(진행 화면에는 없음).
//   · 문구가 겹치지 않는가 · 아쉬운 점이 더 넉넉한가
//   · «자주 쓰는 것» 줄이 먼저, «모든 평가 단추 보기» 로 펼침
//   · 지난 회차에서 쓰던 옛 문구도 눌린 채로 살아남는가
//   · 누르면 저장되고 다시 누르면 빠지는가, 누른 횟수가 브라우저에 남는가
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub4.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport:{width:1512,height:1000} });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.addInitScript(() => { window.__FAKE__ = { profile:{name:'이용휘',login_id:'이용휘',role:'teacher'}, rows:{} }; });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');

  console.log('\n── 문구가 겹치지 않는가 ──');
  const 겹침 = await p.evaluate(() => {
    const all=[]; Object.keys(TAGS).forEach(a=>['good','bad'].forEach(k=>TAGS[a][k].forEach(t=>all.push(t))));
    return all.length - new Set(all).size;
  });
  확인('같은 말이 두 번 들어 있지 않은가', 겹침 === 0, '겹침 '+겹침);
  const 수 = await p.evaluate(() => {
    let g=0,bd=0; Object.keys(TAGS).forEach(a=>{g+=TAGS[a].good.length; bd+=TAGS[a].bad.length;});
    return {좋음:g, 아쉬움:bd};
  });
  확인('아쉬운 점이 좋았던 점보다 넉넉한가 (연습 면접이므로)',
       수.아쉬움 > 수.좋음, '좋음 '+수.좋음+' / 아쉬움 '+수.아쉬움);
  확인('영역 다섯 줄(AREAS)마다 그 갈래 단추(TAGS)가 있는가', await p.evaluate(() =>
    AREAS.every(ar => TAGS[ar.key] && TAGS[ar.key].good.length && TAGS[ar.key].bad.length)));

  console.log('\n── 진행 화면에는 태그가 없다 ──');
  await p.evaluate(() => {
    target = { id:'s1', student_no:'30101', name:'고다윤' };
    questions = [{ text:'시험용 질문', competency:'학업역량' }];
    // 옛 문구(지금 목록에 없는 것)를 두 개 넣어 둡니다
    answers = [{ good:['숫자·이름까지 말함'], bad:['아주 옛날 문구'], rating:'보통', memo:'', seconds:10, transcript:'', marks:[] }];
    qIndex = 0; interviewId = 1; totalSeconds = 10; show('run'); showQuestion();
  });
  await p.waitForTimeout(200);
  확인('진행 화면에 .chip 이 하나도 없는가', await p.evaluate(() => document.querySelectorAll('#view-run .chip').length === 0));
  확인('대신 우수·보통·미흡과 영역 표가 있는가', await p.evaluate(() => document.querySelectorAll('#rating-area .rbtn').length === 3 && document.querySelectorAll('#area-grid .arearow').length === 5));

  console.log('\n── 마무리 화면 — 줄마다 그 갈래 단추, 옛 문구도 눌린 채로 ──');
  await p.evaluate(() => { try { localStorage.removeItem('tagUse'); } catch(e){} openFinish(); });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const row = document.getElementById('ansrow-0');
    const rows = Array.from(row.querySelectorAll('.eg-row'));
    const 눌린 = Array.from(row.querySelectorAll('.chip[aria-pressed="true"]')).map(c=>c.dataset.tag);
    const 줄이름 = rows.map(r => r.querySelector('.arealabel b').textContent);
    // 줄마다: 이름 칸 · 단추 셋 · 좋았던 점 · 아쉬운 점이 같은 윗선에 있는가
    // 줄의 네 칸(이름·단추·좋았던 점·아쉬운 점)이 **윗선도 아랫선도** 같은 높이인가 — 선이 한 줄로 이어지려면
    // 칸이 줄 높이를 꽉 채워야 합니다(.9 에서 이름 칸만 짧아 선이 어긋났던 것)
    const 맞춤 = rows.slice(0,5).every(r => {
      const kids = [r.querySelector('.arealabel'), r.querySelector('.areapicks'), r.querySelector('.chips.good'), r.querySelector('.chips.bad')]
        .map(k => k.getBoundingClientRect());
      return kids.every(b => Math.abs(b.top - kids[0].top) < 1.5 && Math.abs(b.bottom - kids[0].bottom) < 1.5);
    });
    const 전공 = rows[4].querySelectorAll('.chip').length;
    return { 눌린, 줄이름, 맞춤, 전공, 칩수: row.querySelectorAll('.chip').length, 펼치기: !!row.querySelector('.tagmore, .tagfull') };
  });
  확인('줄이 내용·근거·말하기·태도·전공 연결 + 지난 기록인가', r.줄이름.join('·') === '내용·근거·말하기·태도·전공 연결·지난 기록', r.줄이름.join('·'));
  확인('줄마다 이름·단추·좋았던 점·아쉬운 점이 같은 선에 있는가', r.맞춤);
  확인('«전공 연결» 줄에도 단추가 있는가', r.전공 >= 2, r.전공 + '개');
  확인('옛 문구도 «지난 기록» 줄에 눌린 채로', r.눌린.indexOf('숫자·이름까지 말함') > -1 && r.눌린.indexOf('아주 옛날 문구') > -1 && r.눌린.length === 2, r.눌린.join(', '));
  확인('펼치기가 없는가', !r.펼치기);
  확인('단추가 모두 보이는가(줄이면서 49개)', r.칩수 >= 45, r.칩수 + '개');
  확인('아쉬운 점이 줄마다 6개 이하인가', await p.evaluate(() => Object.keys(TAGS).every(ax => TAGS[ax].bad.length <= 6)));

  console.log('\n── 눌렀다 떼기 ──');
  await p.click('#ansrow-0 .eg-row:nth-child(2) .chip.bad[data-tag="질문을 빗나감"]'); await p.waitForTimeout(100);
  확인('아쉬운 점을 누르면 저장되는가', await p.evaluate(()=>answers[0].bad.indexOf('질문을 빗나감') > -1));
  확인('누른 횟수가 브라우저에 남는가', await p.evaluate(() => (tagUse()['질문을 빗나감'] || 0) === 1));
  확인('누른 것이 그 줄 맨 앞으로 오는가', await p.evaluate(() => document.querySelector('#ansrow-0 .eg-row:nth-child(2) .chips.bad .chip').dataset.tag === '질문을 빗나감'));
  await p.click('#ansrow-0 .eg-row:nth-child(2) .chip.bad[data-tag="질문을 빗나감"]'); await p.waitForTimeout(100);
  확인('다시 누르면 빠지는가', await p.evaluate(()=>answers[0].bad.indexOf('질문을 빗나감') === -1));
  확인('그래도 옛 문구는 그대로 남아 있는가', await p.evaluate(()=>answers[0].bad.indexOf('아주 옛날 문구') > -1));

  // 🚨 1300px 아래(좁은 노트북)에서 태그 단추의 안쪽 여백 · 윗테두리가 사라졌던 것(2026-10-11 선생님 화면)
  for (const w of [1512, 1280, 1000]) {
    await p.setViewportSize({ width: w, height: 1000 }); await p.waitForTimeout(100);
    const s = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('#ansrow-0 .eg-row .chip'));
      return { l: parseFloat(c.paddingLeft), top: parseFloat(c.borderTopWidth), bottom: parseFloat(c.borderBottomWidth) }; });
    확인(w + 'px — 태그 단추에 안쪽 여백과 윗테두리가 있는가', s.l >= 8 && s.top === s.bottom && s.top >= 1, JSON.stringify(s));
  }

  확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
