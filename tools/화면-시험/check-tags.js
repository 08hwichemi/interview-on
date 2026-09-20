const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SP='/tmp/claude-0/-home-user-interview-on/92b76a30-44fa-522b-a2ab-054f7cf04b3d/scratchpad';
const SB = fs.readFileSync(path.join(SP,'stub4.js'),'utf8');
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

  console.log('\n── 지난 회차에서 쓰던 옛 문구 ──');
  await p.evaluate(() => {
    questions = [{ text:'시험용 질문', comp:'학업역량' }];
    // 옛 문구(지금 목록에 없는 것)를 두 개 넣어 둡니다
    answers = [{ good:['숫자·이름까지 말함'], bad:['아주 옛날 문구'], rating:'보통', memo:'', seconds:10 }];
    qIndex = 0; interviewId = 1; show('run'); showQuestion();
  });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const ta = document.getElementById('tag-area');
    const 눌린 = Array.from(ta.querySelectorAll('.chip[aria-pressed="true"]')).map(c=>c.dataset.tag);
    return { 눌린: 눌린, 칩수: ta.querySelectorAll('.chip').length };
  });
  확인('옛 문구도 목록에 나타나는가', r.눌린.indexOf('숫자·이름까지 말함') > -1 && r.눌린.indexOf('아주 옛날 문구') > -1,
       r.눌린.join(', '));
  확인('옛 문구가 «눌린» 채로 보이는가', r.눌린.length === 2, '눌린 '+r.눌린.length+'개');

  console.log('\n── 눌렀다 떼기 ──');
  await p.click('.chip.bad[data-tag="질문을 빗나감"]'); await p.waitForTimeout(100);
  확인('아쉬운 점을 누르면 저장되는가',
       await p.evaluate(()=>answers[0].bad.indexOf('질문을 빗나감') > -1));
  await p.click('.chip.bad[data-tag="질문을 빗나감"]'); await p.waitForTimeout(100);
  확인('다시 누르면 빠지는가',
       await p.evaluate(()=>answers[0].bad.indexOf('질문을 빗나감') === -1));
  확인('그래도 옛 문구는 그대로 남아 있는가',
       await p.evaluate(()=>answers[0].bad.indexOf('아주 옛날 문구') > -1));

  확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
