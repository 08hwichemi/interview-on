// 뒤로가기 막음 — 이동수업 출석부 앱에서 실제로 통했던 방식을 그대로 옮긴 것
//
// ⚠️ 여기서 통과한다고 휴대폰에서 된다는 뜻이 아닙니다.
//    크롬의 «건너뛰기» 는 컴퓨터 브라우저와 이 시험 도구에서는 일어나지 않습니다.
//    여기서 보는 것은 «짜임새가 맞는가» 까지입니다.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub4.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }

const 걸음 = p => p.evaluate(()=>backGuards);
const 물음창 = p => p.evaluate(()=>{
  const b=document.getElementById('custom-confirm');
  return b && b.style.display==='flex' ? document.getElementById('confirm-msg').textContent : '';
});
const 화면 = p => p.evaluate(()=>document.querySelector('.screen.active').id);

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport:{width:390,height:844} });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.addInitScript(() => { window.__FAKE__ = { profile:{name:'고다윤',login_id:'30101',role:'student'}, rows:{} }; });

  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/'); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const l=document.getElementById('loading'); if(l) l.style.display='none'; });

  console.log('\n── 걸음 채우기 (이동수업 앱 원본과 같은 짜임) ──');
  확인('열자마자 걸음이 하나 쌓이는가 (안 만지고 눌러도 막히게)',
       (await 걸음(p)) === 1, '걸음 '+await 걸음(p));
  const 히0 = await p.evaluate(()=>history.length);
  await p.click('.footer'); await p.waitForTimeout(250);
  확인('만져도 한 칸에서 멈추는가 (두 칸이면 절반이 허깨비입니다)',
       (await 걸음(p)) === 1, '걸음 '+await 걸음(p));
  확인('만졌다고 히스토리가 늘지는 않는가',
       (await p.evaluate(()=>history.length)) === 히0,
       히0+' → '+await p.evaluate(()=>history.length));

  console.log('\n── 만지지 않고 연달아 눌러도 버티는가 ──');
  await p.evaluate(()=>navigateTo('reviews')); await p.waitForTimeout(200);
  await p.goBack(); await p.waitForTimeout(250);
  확인('첫 번째 — 홈으로', (await 화면(p)) === 'screen-home', await 화면(p));
  await p.goBack(); await p.waitForTimeout(250);   // 만지지 않고 또
  확인('만지지 않고 또 눌러도 앱이 살아 있는가', !p.isClosed());
  확인('종료 물음이 뜨는가', /종료/.test(await 물음창(p)), await 물음창(p));
  await p.evaluate(()=>closeConfirm());
  await p.click('.footer'); await p.waitForTimeout(250);

  console.log('\n── 앱이 스스로 부르는 navigateTo 는 걸음을 늘리지 않는가 ──');
  {
    const pz = await ctx.newPage();
    await pz.goto('http://127.0.0.1:8777/'); await pz.waitForTimeout(1000);
    확인('켜지자마자 홈으로 가도 걸음은 한 칸인가', (await 걸음(pz)) === 1, '걸음 '+await 걸음(pz));
    확인('그때도 홈 화면인가', (await 화면(pz)) === 'screen-home', await 화면(pz));
    await pz.close({ runBeforeUnload: false });
  }

  console.log('\n── 홈이 아니면 홈으로 ──');
  await p.evaluate(()=>navigateTo('reviews')); await p.waitForTimeout(200);
  await p.goBack(); await p.waitForTimeout(300);
  확인('홈으로 돌아왔는가', (await 화면(p)) === 'screen-home', await 화면(p));
  확인('종료를 묻지는 않는가', (await 물음창(p)) === '');

  console.log('\n── 홈에서 뒤로가기 = 종료 물음 ──');
  await p.goBack(); await p.waitForTimeout(300);
  확인('«앱을 종료하시겠습니까?» 가 뜨는가', /종료/.test(await 물음창(p)), await 물음창(p));
  확인('아직 앱이 살아 있는가', !p.isClosed());

  console.log('\n── 물음창이 떠 있을 때 뒤로가기 = 물음창만 닫기 ──');
  await p.goBack(); await p.waitForTimeout(300);
  확인('물음창이 닫혔는가', (await 물음창(p)) === '');
  확인('앱은 그대로인가', (await 화면(p)) === 'screen-home');

  console.log('\n── 몇 번을 눌러도 똑같이 ──');
  for (const 번 of ['두 번째','세 번째','네 번째']) {
    await p.click('.footer'); await p.waitForTimeout(120);   // 사람이 만지면 걸음이 다시 찹니다
    await p.goBack(); await p.waitForTimeout(300);
    확인(번+' — 종료 물음이 뜨는가', /종료/.test(await 물음창(p)));
    await p.evaluate(()=>closeConfirm());
  }

  console.log('\n── 종료 «확인» 을 누르면 막음이 풀리는가 ──');
  {
    await p.click('.footer'); await p.waitForTimeout(300);
    await p.goBack(); await p.waitForTimeout(300);
    확인('종료 물음이 떠 있는가', /종료/.test(await 물음창(p)));
    await p.click('#confirm-ok-btn'); await p.waitForTimeout(1200);
    // 시험 브라우저에서는 앱 앞에 about:blank 가 있어서 그대로 떠납니다(= 나간 것).
    // 휴대폰에서는 맨 처음 자리로 돌아가고, 뒤로가기 한 번이면 나갑니다.
    const 떠남 = p.url() === 'about:blank';
    if (떠남) {
      확인('«확인» 을 누르면 앱 밖으로 나가는가', true, p.url());
    } else {
      확인('걸음이 0칸으로 비워졌는가', (await 걸음(p)) === 0, '걸음 '+await 걸음(p));
      확인('막지 않는 상태가 되었는가', await p.evaluate(()=>leavingNow()));
    }
  }

  console.log('\n── 마지막 안전망: 진짜로 나가려 하면 브라우저가 묻는가 ──');
  {
    const p2 = await ctx.newPage();
    await p2.goto('http://127.0.0.1:8777/'); await p2.waitForTimeout(900);
    let 물었나 = false;
    p2.on('dialog', async d => { 물었나 = (d.type() === 'beforeunload'); await d.dismiss(); });
    await p2.click('.footer'); await p2.waitForTimeout(150);   // 사람이 만져야 브라우저가 물어 줍니다
    await p2.close({ runBeforeUnload: true }); await p2.waitForTimeout(700);
    확인('나가려 하면 브라우저가 «나가시겠습니까?» 를 묻는가', 물었나);
  }

  console.log('\n── 일부러 나가는 길에는 묻지 않습니다 ──');
  {
    const p3 = await ctx.newPage();
    await p3.goto('http://127.0.0.1:8777/'); await p3.waitForTimeout(900);
    let 물었나 = false;
    p3.on('dialog', async d => { 물었나 = (d.type() === 'beforeunload'); await d.dismiss(); });
    await p3.click('.footer'); await p3.waitForTimeout(150);
    await p3.evaluate(()=>allowLeaving());
    await p3.close({ runBeforeUnload: true });
    await new Promise(r => setTimeout(r, 700));
    확인('새로고침·로그아웃 때는 안 묻는가 (그대로 닫힘)', !물었나 && p3.isClosed());
  }

  console.log('\n── 판 번호 세 번 누르기 = 진단 ──');
  {
    const p4 = await ctx.newPage();
    await p4.goto('http://127.0.0.1:8777/'); await p4.waitForTimeout(900);
    p4.on('dialog', async d => { await d.accept(); });
    for (let i=0;i<3;i++) { await p4.click('.verlabel'); await p4.waitForTimeout(80); }
    const t = await p4.evaluate(()=>{
      const b=document.getElementById('custom-confirm');
      return b && b.style.display==='flex' ? document.getElementById('confirm-msg').textContent : '';
    });
    확인('세 번 누르면 진단 창이 뜨는가', /판 .*걸음/.test(t), t.slice(0,60));
    확인('자취가 남아 있는가', /앱 열림|걸음\+1/.test(t));
  }

  확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
