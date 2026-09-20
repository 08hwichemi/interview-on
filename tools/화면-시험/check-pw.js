const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SP='/tmp/claude-0/-home-user-interview-on/92b76a30-44fa-522b-a2ab-054f7cf04b3d/scratchpad';
const SB = fs.readFileSync(path.join(SP,'stub5.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport:{width:1100,height:1000} });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.route('**/xlsx*', r => r.fulfill({contentType:'application/javascript', body:'window.XLSX={};'}));
  await ctx.addInitScript(() => {
    window.__FAKE__ = { profile:{ id:'u1', name:'이용휘', login_id:'이용휘', role:'admin' },
      rows: { profiles:[{ id:'u1', role:'admin', name:'이용휘', login_id:'이용휘', school_id:'sc1' },
                        { id:'u2', role:'teacher', name:'박영희', login_id:'박영희', school_id:'sc1' }],
              students:[{ id:'s1', student_no:'30101', name:'고다윤', grade:3, class_no:1, auth_user_id:'a1' }] } };
  });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/admin/'); await p.waitForSelector('#app:not([hidden])');

  확인('학생 탭 등록 단추에 111111',
       /111111/.test(await p.textContent('#btn-create')), await p.textContent('#btn-create'));
  await p.click('#tab-teacher'); await p.waitForTimeout(300);
  확인('교사 탭 등록 단추에 123456',
       /123456/.test(await p.textContent('#btn-create')), await p.textContent('#btn-create'));
  await p.click('#tab-student'); await p.waitForTimeout(300);
  확인('학생 탭으로 돌아오면 다시 111111',
       /111111/.test(await p.textContent('#btn-create')), await p.textContent('#btn-create'));

  // 비번초기화 확인창 문구도 몫에 맞아야 합니다
  const 물음 = [];
  p.on('dialog', async d => { 물음.push(d.message()); await d.dismiss(); });
  await p.locator('#roster-list .linkbtn').first().click(); await p.waitForTimeout(300);
  확인('학생 비번초기화 안내에 111111', /111111/.test(물음.join(' ')), 물음.join(' | '));
  await p.click('#tab-teacher'); await p.waitForTimeout(300);
  물음.length = 0;
  await p.locator('#roster-list .linkbtn').first().click(); await p.waitForTimeout(300);
  확인('교사 비번초기화 안내에 123456', /123456/.test(물음.join(' ')), 물음.join(' | '));

  확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
