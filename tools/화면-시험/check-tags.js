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
  확인('씨앗(자주 쓰는 것)이 모두 지금 목록에 있는 문구인가', await p.evaluate(() =>
    ['good','bad'].every(k => TAG_SEED[k].every(t => allTags(k).indexOf(t) > -1))));

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
  확인('대신 👍👎 단추가 있는가', await p.evaluate(() => !!document.getElementById('mark-good') && !!document.getElementById('mark-bad')));

  console.log('\n── 마무리 화면 — 지난 회차에서 쓰던 옛 문구 ──');
  await p.evaluate(() => { try { localStorage.removeItem('tagUse'); } catch(e){} openFinish(); });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const row = document.getElementById('ansrow-0');
    const 눌린 = Array.from(new Set(Array.from(row.querySelectorAll('.chip[aria-pressed="true"]')).map(c=>c.dataset.tag)));
    const quick = row.querySelector('.tagrow.quick');
    return { 눌린, 칩수: row.querySelectorAll('.chip').length,
             접힘: row.querySelector('.tagfull').hidden,
             자주좋음: quick.querySelectorAll('.chip.good').length, 자주아쉬움: quick.querySelectorAll('.chip.bad').length };
  });
  확인('옛 문구도 목록에 나타나는가', r.눌린.indexOf('숫자·이름까지 말함') > -1 && r.눌린.indexOf('아주 옛날 문구') > -1, r.눌린.join(', '));
  확인('옛 문구가 «눌린» 채로 보이는가', r.눌린.length === 2, '눌린 '+r.눌린.length+'개');
  확인('처음엔 모든 단추가 접혀 있는가', r.접힘);
  확인('자주 쓰는 것은 좋음·아쉬움 각각 7개 이하인가(6개 + 이미 누른 옛 문구)',
       r.자주좋음 <= TAG_QUICK_N_MAX() && r.자주아쉬움 <= TAG_QUICK_N_MAX(), r.자주좋음 + ' / ' + r.자주아쉬움);
  function TAG_QUICK_N_MAX(){ return 7; }

  console.log('\n── 펼쳐서 눌렀다 떼기 ──');
  await p.click('#ansrow-0 .tagmore'); await p.waitForTimeout(100);
  확인('«모든 평가 단추 보기» 로 펼쳐지는가', await p.evaluate(() => !document.querySelector('#ansrow-0 .tagfull').hidden));
  await p.click('#ansrow-0 .tagfull .chip.bad[data-tag="질문을 빗나감"]'); await p.waitForTimeout(100);
  확인('아쉬운 점을 누르면 저장되는가', await p.evaluate(()=>answers[0].bad.indexOf('질문을 빗나감') > -1));
  확인('펼친 채로 남아 있는가', await p.evaluate(() => !document.querySelector('#ansrow-0 .tagfull').hidden));
  확인('누른 것이 «자주 쓰는 것» 줄에도 눌린 채로 보이는가',
       await p.evaluate(() => !!document.querySelector('#ansrow-0 .tagrow.quick .chip[data-tag="질문을 빗나감"][aria-pressed="true"]')));
  확인('누른 횟수가 브라우저에 남는가', await p.evaluate(() => (tagUse()['질문을 빗나감'] || 0) === 1));
  await p.click('#ansrow-0 .tagrow.quick .chip.bad[data-tag="질문을 빗나감"]'); await p.waitForTimeout(100);
  확인('다시 누르면 빠지는가', await p.evaluate(()=>answers[0].bad.indexOf('질문을 빗나감') === -1));
  확인('그래도 옛 문구는 그대로 남아 있는가', await p.evaluate(()=>answers[0].bad.indexOf('아주 옛날 문구') > -1));
  확인('많이 누른 것이 자주 쓰는 것 맨 앞에 오는가', await p.evaluate(() => {
    for (let i=0;i<5;i++) bumpTagUse('문장이 간결함');
    return quickTags('good')[0] === '문장이 간결함';
  }));

  확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
