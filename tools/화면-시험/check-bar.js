// 새 판 알림 — 하던 일이 없고 1분 동안 손대지 않았으면(막 열었을 때 포함) 알아서 새로고침 · 안 볼 때도 알아서 ·
// 손대는 중이거나 하던 일이 있으면 띠만(한 화면에 들어가는가 · 닫히는가) — 끝나거나 손을 놓으면 알아서 ·
// 새로고침 뒤 보던 화면(학생) · 보던 학생(선생님)으로 · 선생님 질문지에 저장 안 한 고침이 있으면 안 함 (2026-10-22)
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub4.js'),'utf8');
const SB5 = fs.readFileSync(path.join(__dirname,'stub5.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }

// ⚠️ 서비스 워커(sw.js)를 끕니다 — 새로고침 뒤에는 서비스 워커가 요청을 먼저 받아 가짜 서버(route)가 안 먹고, 앱이 안 뜹니다
async function 열기(b, w, h, 로그인, 판) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, serviceWorkers:'block' });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.route('**/version.txt*', r => r.fulfill({contentType:'text/plain', body:판}));
  if (로그인) await ctx.addInitScript(() => { window.__FAKE__ = { profile:{name:'고다윤',login_id:'30101',role:'student'}, rows:{} }; });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8777/'); await p.waitForTimeout(1200);
  await p.evaluate(()=>{ const l=document.getElementById('loading'); if(l) l.style.display='none'; });
  return { ctx, p };
}
// 띠 자체의 모양을 보려고, 덮는 안내를 치우고 띠만 띄웁니다(«하던 일이 있을 때» 모습)
const 띠만 = p => p.evaluate(() => { UPDATE_SHOWN=false; showUpdateBar(); });
const 다시열림 = p => p.waitForURL(/\?v=2099-01-01\.1/, { timeout: 5000 }).then(() => true, () => false);
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
                                   [320,568,false,'로그인'],[390,844,true,'홈'],[360,640,true,'홈'],[320,568,true,'홈']]) {
    const { ctx, p } = await 열기(b, w, h, 로그인, fs.readFileSync('/home/user/interview-on/version.txt','utf8').trim());   // 같은 판 — 저절로 다시 열지 않게
    await 띠만(p); await p.waitForTimeout(100);
    const r = await 잼(p);
    확인(이름+' '+w+'×'+h+' — 띠가 떴는데도 스크롤이 없는가', r.띠보임 && r.넘침 <= 0,
         '넘침 '+r.넘침+' / 띠 '+r.띠높이+'px');
    확인(이름+' '+w+'×'+h+' — 꼬리말이 화면 안인가', r.꼬리바닥 <= r.창 + 1, r.꼬리바닥+' / '+r.창);
    if (로그인) 확인(이름+' '+w+'×'+h+' — 머리줄이 띠에 안 가리는가', r.머리위 >= r.띠바닥 - 1,
                    '머리 '+r.머리위+' / 띠바닥 '+r.띠바닥);
    if (w===450) await p.screenshot({ path: path.join(__dirname,'bar-fixed-450.png') });
    await ctx.close();
  }

  console.log('\n── 하던 일이 없으면: 누르지 않아도 알아서 ──');
  {
    // 막 열어서 아직 손대지 않은 홈 화면 — 그대로 새 판으로 다시 엽니다(덮는 안내 없음)
    const { ctx, p } = await 열기(b, 390, 844, true, '2099-01-01.1');
    확인('막 열었을 때 새 판이면 저절로 ?v=새판 으로 다시 여는가', /\?v=2099-01-01\.1/.test(p.url()) || await 다시열림(p), p.url());
    확인('덮는 안내는 없는가', !(await p.evaluate(() => !!document.getElementById('update-cover'))));
    await ctx.close();
  }
  {
    // 손대는 중이면 띠만 → 1분 동안 손을 놓으면 저절로
    const { ctx, p } = await 열기(b, 390, 844, true, '2099-01-01.1');
    await p.waitForTimeout(300);
    await p.goto('about:blank'); await p.goto('http://127.0.0.1:8777/'); await p.waitForTimeout(400);   // 새로 열고
    await p.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} SERVER_VERSION = null; UPDATE_SHOWN = false; lastTouchAt = Date.now(); checkForUpdate(); });
    await p.waitForTimeout(400);
    확인('방금 손댄 중이면 다시 열지 않고 띠만', (await 잼(p)).띠보임 && !/\?v=2099/.test(p.url()), p.url());
    const [ok] = await Promise.all([다시열림(p), p.evaluate(() => { lastTouchAt = Date.now() - 61000; applyUpdate(); })]);
    확인('1분 동안 손대지 않으면 저절로 다시 여는가', ok, p.url());
    await ctx.close();
  }

  console.log('\n── 새로고침 뒤 보던 화면으로(학생) ──');
  {
    const { ctx, p } = await 열기(b, 390, 844, true, '2026-01-01.1');   // 처음엔 같은 판인 척 — 안 다시 열림
    await p.evaluate(() => { BUILD_ID = '2026-01-01.1'; navigateTo('reviews'); });
    await p.waitForTimeout(200);
    const [ok] = await Promise.all([
      p.waitForURL(/\?v=2099-01-02\.1/, { timeout: 5000 }).then(() => true, () => false),
      p.evaluate(() => { SERVER_VERSION = '2099-01-02.1'; lastTouchAt = 0; applyUpdate(); })
    ]);
    확인('«실전 면접 후기» 를 보다가 새 판이면 저절로 다시 여는가', ok, p.url());
    await p.waitForTimeout(1500);
    확인('다시 열린 뒤 «실전 면접 후기» 화면으로 돌아오는가', await p.evaluate(() => document.getElementById('screen-reviews').classList.contains('active')));
    await ctx.close();
  }

  console.log('\n── 화면을 안 보고 있으면(다른 탭·앱) 알아서 새로고침 ──');
  {
    const { ctx, p } = await 열기(b, 390, 844, true, '2099-01-01.1');
    await Promise.all([
      p.waitForURL(/\?v=2099-01-01\.1/, { timeout: 5000 }),
      p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable:true, get:()=>true });
                         Object.defineProperty(document, 'visibilityState', { configurable:true, get:()=>'hidden' });
                         document.dispatchEvent(new Event('visibilitychange')); })
    ]);
    확인('다른 탭으로 가면 그때 새 판으로 다시 여는가', /\?v=2099-01-01\.1/.test(p.url()), p.url());
    await ctx.close();
  }

  console.log('\n── 하던 일이 있으면(모의 면접 · 톡 쓰다 만 것): 띠만, 끝나면 알아서 ──');
  {
    const { ctx, p } = await 열기(b, 390, 844, true, '2026-01-01.1');
    await p.evaluate(() => { BUILD_ID = '2026-01-01.1';
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-interview-run').classList.add('active');
      SERVER_VERSION = '2099-01-01.1'; lastTouchAt = 0; applyUpdate(); });
    await p.waitForTimeout(300);
    확인('모의 면접 화면에서는 손 안 대도 다시 열지 않고 띠만', (await 잼(p)).띠보임 && !/\?v=2099/.test(p.url()), p.url());
    await p.click('#updateClose'); await p.waitForTimeout(200);
    const r = await 잼(p);
    확인('× 를 누르면 띠가 사라지는가', !r.띠보임);
    확인('닫은 뒤 본문이 제자리로 오는가', r.넘침 <= 0 && r.꼬리바닥 <= r.창 + 1);
    await p.evaluate(() => { applyUpdate(); }); await p.waitForTimeout(200);
    확인('아직 면접 중이면 다시 안 뜨는가 · 안 다시 열림', !(await 잼(p)).띠보임 && !/\?v=2099/.test(p.url()));
    // 톡을 쓰다 만 채로 두면 안 다시 엽니다
    await p.evaluate(() => { document.getElementById('screen-interview-run').classList.remove('active');
      document.getElementById('screen-home').classList.add('active');
      var i = document.getElementById('chat-input'); if (i) i.value = '보내지 않은 말'; lastTouchAt = 0; applyUpdate(); });
    await p.waitForTimeout(300);
    확인('보내지 않은 톡이 있으면 안 다시 여는가', !/\?v=2099/.test(p.url()));
    const [ok] = await Promise.all([다시열림(p), p.evaluate(() => { document.getElementById('chat-input').value = ''; lastTouchAt = 0; applyUpdate(); })]);
    확인('면접이 끝나고(홈) 톡도 비면 저절로 다시 여는가', ok, p.url());
    await ctx.close();
  }

  console.log('\n── 선생님 화면 ──');
  {
    const ctx = await b.newContext({ viewport:{width:1280,height:900}, serviceWorkers:'block' });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB5}));
    await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
    await ctx.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({contentType:'application/javascript', body:''}));
    let 판 = fs.readFileSync('/home/user/interview-on/version.txt','utf8').trim();
    await ctx.route('**/version.txt*', r => r.fulfill({contentType:'text/plain', body:판}));
    await ctx.addInitScript(() => { window.__FAKE__ = { rows: {
      profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘', school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
      students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 },
                 { id: 's2', student_no: '30102', name: '김서준', auth_user_id: null, grade: 3, class_no: 1 }],
      interviews: [], interview_answers: [] } }; });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { await pickStudent('s2'); setupGoTab('practice'); setupGoTab('prep'); setupGoTab('practice'); });
    await p.waitForTimeout(300);
    // 질문을 하나 더하고 저장 안 함 → 고치는 중
    await p.evaluate(() => { setupGoTab('prep'); addQuestion('저장 안 한 질문', '기타'); document.activeElement && document.activeElement.blur(); });
    확인('질문지에 저장 안 한 고침이 있으면 «하던 일» 로 보는가', await p.evaluate(() => prepDirty() && updateIsBusy()));
    판 = '2099-01-03.1';
    await p.evaluate(() => { SERVER_VERSION = '2099-01-03.1'; lastTouchAt = 0; applyUpdate(); });
    await p.waitForTimeout(400);
    확인('그때는 손 안 대도 안 다시 열고 띠만', !/\?v=2099/.test(p.url()) && await p.evaluate(() => !document.getElementById('updateBar').hidden), p.url());
    // 저장하면 고친 것 없음 → 다시 열고, 같은 학생 · 같은 탭으로
    await p.evaluate(() => { setupGoTab('practice'); });
    await p.click('#setup-tab-prep');
    const [ok] = await Promise.all([
      p.waitForURL(/\?v=2099-01-03\.1/, { timeout: 8000 }).then(() => true, () => false),
      (async () => { await p.click('#btn-save-sheet'); await p.waitForTimeout(400); await p.evaluate(() => { document.activeElement && document.activeElement.blur(); lastTouchAt = 0; applyUpdate(); }); })()
    ]);
    확인('질문지를 저장하면(고친 것 없음) 저절로 다시 여는가', ok, p.url());
    await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(1200);
    확인('다시 열린 뒤 보던 학생(김서준) · «면접 준비» 탭으로 돌아오는가', await p.evaluate(() =>
      target && target.id === 's2' && !document.getElementById('view-setup').hidden && !document.getElementById('setup-prep').hidden));
    // (저장해 둔 질문지가 다시 펴지는지는 못 봅니다 — 가짜 서버는 새로고침하면 비워집니다. 실제로는 pickStudent → loadSheet 가 폅니다)
    // 면접 진행 중이면 절대 안 다시 엶
    await p.evaluate(() => { liveInterview = true; SERVER_VERSION = '2099-01-04.1'; lastTouchAt = 0; applyUpdate(); });
    await p.waitForTimeout(400);
    확인('면접 진행 중에는 안 다시 엶', /\?v=2099-01-03\.1/.test(p.url()) && !/2099-01-04/.test(p.url()));
    await ctx.close();
  }

  console.log('\n── 새로고침을 눌렀는데도 서버가 옛 화면을 줄 때 ──');
  {
    // ?v=2099-01-01.1 로 이미 다시 열어 본 상태 = 또 띄우면 무한 반복입니다
    const ctx = await b.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
    await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
    await ctx.route('**/version.txt*', r => r.fulfill({contentType:'text/plain', body:'2099-01-01.1'}));
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8777/?v=2099-01-01.1'); await p.waitForTimeout(1200);
    확인('두 번째부터는 띠를 띄우지 않는가', !(await p.evaluate(()=>!document.getElementById('updateBar').hidden)));
    확인('또 다시 열지 않는가(무한 새로고침 막음)', /\?v=2099-01-01\.1$/.test(p.url()), p.url());
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
