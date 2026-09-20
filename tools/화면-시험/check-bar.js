// 새 판 띠가 떠도 한 화면에 들어가는가 · 닫히는가 · 또 뜨지 않는가
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub4.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }

async function 열기(b, w, h, 로그인, 판) {
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.route('**/version.txt*', r => r.fulfill({contentType:'text/plain', body:판}));
  if (로그인) await ctx.addInitScript(() => { window.__FAKE__ = { profile:{name:'고다윤',login_id:'30101',role:'student'}, rows:{} }; });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8777/'); await p.waitForTimeout(1200);
  await p.evaluate(()=>{ const l=document.getElementById('loading'); if(l) l.style.display='none'; });
  return { ctx, p };
}
const 잼 = p => p.evaluate(() => {
  const bar=document.getElementById('updateBar'), f=document.querySelector('.footer');
  const hd=document.querySelector('.header');
  return { 띠보임:!bar.hidden, 띠높이:Math.round(bar.getBoundingClientRect().height),
           띠바닥:Math.round(bar.getBoundingClientRect().bottom),
           머리위:hd && hd.style.display!=='none' ? Math.round(hd.getBoundingClientRect().top) : null,
           넘침:document.documentElement.scrollHeight - window.innerHeight,
           꼬리바닥:Math.round(f.getBoundingClientRect().bottom), 창:window.innerHeight };
});

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 띠가 떠도 한 화면에 ──');
  for (const [w,h,로그인,이름] of [[450,946,false,'로그인'],[390,844,false,'로그인'],[360,640,false,'로그인'],
                                   [320,568,false,'로그인'],[390,844,true,'홈'],[360,640,true,'홈']]) {
    const { ctx, p } = await 열기(b, w, h, 로그인, '2099-01-01.1');
    const r = await 잼(p);
    확인(이름+' '+w+'×'+h+' — 띠가 떴는데도 스크롤이 없는가', r.띠보임 && r.넘침 <= 0,
         '넘침 '+r.넘침+' / 띠 '+r.띠높이+'px');
    확인(이름+' '+w+'×'+h+' — 꼬리말이 화면 안인가', r.꼬리바닥 <= r.창 + 1, r.꼬리바닥+' / '+r.창);
    if (로그인) 확인(이름+' '+w+'×'+h+' — 머리줄이 띠에 안 가리는가', r.머리위 >= r.띠바닥 - 1,
                    '머리 '+r.머리위+' / 띠바닥 '+r.띠바닥);
    if (w===450) await p.screenshot({ path: path.join(__dirname,'bar-fixed-450.png') });
    await ctx.close();
  }

  console.log('\n── 닫기 ──');
  {
    const { ctx, p } = await 열기(b, 390, 844, true, '2099-01-01.1');
    await p.click('#updateClose'); await p.waitForTimeout(200);
    const r = await 잼(p);
    확인('× 를 누르면 띠가 사라지는가', !r.띠보임);
    확인('닫은 뒤 본문이 제자리로 오는가', r.넘침 <= 0 && r.꼬리바닥 <= r.창 + 1);
    await p.evaluate(()=>checkForUpdate()); await p.waitForTimeout(600);
    확인('닫은 뒤에는 다시 안 뜨는가', !(await 잼(p)).띠보임);
    await ctx.close();
  }

  console.log('\n── 새로고침을 눌렀는데도 서버가 옛 화면을 줄 때 ──');
  {
    // ?v=2099-01-01.1 로 이미 다시 열어 본 상태 = 또 띄우면 무한 반복입니다
    const ctx = await b.newContext({ viewport:{width:390,height:844} });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
    await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
    await ctx.route('**/version.txt*', r => r.fulfill({contentType:'text/plain', body:'2099-01-01.1'}));
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8777/?v=2099-01-01.1'); await p.waitForTimeout(1200);
    확인('두 번째부터는 띠를 띄우지 않는가', !(await p.evaluate(()=>!document.getElementById('updateBar').hidden)));
    await ctx.close();
  }

  console.log('\n── 판이 같으면 아예 안 뜹니다 ──');
  {
    const 판 = fs.readFileSync('/home/user/interview-on/version.txt','utf8').trim();
    const { ctx, p } = await 열기(b, 390, 844, true, 판);
    확인('같은 판이면 띠가 안 뜨는가', !(await 잼(p)).띠보임, '판 '+판);
    확인('그때도 스크롤 없음', (await 잼(p)).넘침 <= 0);
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
