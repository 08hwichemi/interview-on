// 관리자 «데이터 관리» 탭 — 세기 · 두 번 묻기 · 실제로 지우기
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub5.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }

const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);
const 부름 = p => p.evaluate(() => window.__calls);

function 씨앗() {
  return {
    profile:{ id:'u1', name:'이용휘', login_id:'이용휘', role:'admin' },
    rows: {
      profiles: [
        { id:'u1', role:'admin',   name:'이용휘', login_id:'이용휘', school_id:'sc1', must_change_password:false },
        { id:'u2', role:'teacher', name:'박영희', login_id:'박영희', school_id:'sc1', must_change_password:true }
      ],
      students: [
        { id:'s1', student_no:'30101', name:'고다윤', grade:3, class_no:1, auth_user_id:'a1' },
        { id:'s2', student_no:'30102', name:'김서준', grade:3, class_no:1, auth_user_id:'a2' },
        { id:'s3', student_no:'30103', name:'이하람', grade:3, class_no:1, auth_user_id:null }  // 계정 없음
      ],
      interviews: [
        { id:'iv1', student_id:'s1', teacher_id:'u1', status:'전달됨',   started_at:'2026-09-01' },
        { id:'iv2', student_id:'s2', teacher_id:'u1', status:'준비중',   started_at:'2026-09-02' }
      ],
      chats: [
        { id:'c1', room_id:'r1', sender_id:'u1', receiver_id:'a1', content:'안녕하세요' },
        { id:'c2', room_id:'r1', sender_id:'a1', receiver_id:'u1', content:'네 선생님' },
        { id:'c3', room_id:'r2', sender_id:'u1', receiver_id:'a2', content:'면접 잘 봤어요' }
      ]
    }
  };
}

async function 열기(b) {
  const ctx = await b.newContext({ viewport:{width:1100,height:1100} });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.route('**/xlsx*', r => r.fulfill({contentType:'application/javascript', body:'window.XLSX={};'}));
  await ctx.addInitScript(f => { window.__FAKE__ = f; }, 씨앗());
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/admin/'); await p.waitForSelector('#app:not([hidden])');
  await p.click('#tab-data'); await p.waitForTimeout(400);
  return { ctx, p, errs };
}

// 「확인」→「지웁니다」 를 자동으로 눌러 줍니다. 무엇을 물었는지도 모아 둡니다.
function 답하기(p, 적을말) {
  const 물음 = [];
  p.on('dialog', async d => {
    물음.push(d.type() + ': ' + d.message().split('\n')[0]);
    if (d.type() === 'confirm') await d.accept();
    else if (d.type() === 'prompt') await d.accept(적을말);
    else await d.accept();
  });
  return 물음;
}

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 탭과 개수 ──');
  {
    const { ctx, p, errs } = await 열기(b);
    확인('데이터 관리 칸이 보이는가', !(await p.evaluate(()=>document.getElementById('data-panel').hidden)));
    확인('명단 칸은 감춰지는가',
         await p.evaluate(()=>document.getElementById('add-panel').hidden && document.getElementById('roster-panel').hidden));
    const 숫자 = await p.locator('#data-counts .datacount .n').allTextContents();
    확인('개수가 나오는가 (학생 3 · 교직원 2 · 면접 2 · 톡 3 · 수시 0)',
         숫자.join(',') === '3,2,2,3,0', 숫자.join(','));
    await p.click('#tab-student'); await p.waitForTimeout(300);
    확인('명단 탭으로 돌아가면 다시 감춰지는가',
         await p.evaluate(()=>document.getElementById('data-panel').hidden && !document.getElementById('add-panel').hidden));
    확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 「지웁니다」 를 안 적으면 아무것도 안 지웁니다 ──');
  {
    const { ctx, p } = await 열기(b);
    답하기(p, '네');                       // 엉뚱한 말을 적습니다
    await p.click('#btn-wipe-reports'); await p.waitForTimeout(500);
    확인('면접 기록이 그대로 있는가', (await 표(p,'interviews')).length === 2,
         (await 표(p,'interviews')).length + '건');
    확인('지우기를 아예 안 보냈는가',
         !(await 부름(p)).some(c => c.table==='interviews' && c.op==='delete'));
    await ctx.close();
  }

  console.log('\n── 확인을 취소하면 아무것도 안 지웁니다 ──');
  {
    const { ctx, p } = await 열기(b);
    p.on('dialog', async d => { await d.dismiss(); });
    await p.click('#btn-wipe-chats'); await p.waitForTimeout(500);
    확인('톡이 그대로 있는가', (await 표(p,'chats')).length === 3);
    await ctx.close();
  }

  console.log('\n── 리포트 기록 초기화 ──');
  {
    const { ctx, p, errs } = await 열기(b);
    const 물음 = 답하기(p, '지웁니다');
    await p.click('#btn-wipe-reports'); await p.waitForTimeout(700);
    확인('두 번 묻는가 (확인 + 적기)', 물음.length === 2, 물음.join(' / '));
    확인('면접이 다 지워졌는가', (await 표(p,'interviews')).length === 0,
         (await 표(p,'interviews')).length + '건');
    확인('명단은 그대로인가',
         (await 표(p,'students')).length === 3 && (await 표(p,'profiles')).length === 2);
    확인('톡은 그대로인가', (await 표(p,'chats')).length === 3);
    확인('결과가 화면에 뜨는가',
         /2건/.test(await p.evaluate(()=>document.getElementById('data-result').textContent)),
         await p.evaluate(()=>document.getElementById('data-result').textContent.trim()));
    확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 대화(톡) 초기화 ──');
  {
    const { ctx, p } = await 열기(b);
    답하기(p, '지웁니다');
    await p.click('#btn-wipe-chats'); await p.waitForTimeout(700);
    확인('톡이 다 지워졌는가', (await 표(p,'chats')).length === 0);
    확인('면접은 그대로인가', (await 표(p,'interviews')).length === 2);
    // ⚠️ 톡은 «지우기 정책» 만으로는 한 건도 안 지워집니다 (읽기 정책이 같이 걸립니다).
    //    반드시 서버 함수(admin_wipe_chats)로 지워야 합니다.
    확인('서버 함수로 지웠는가 (표를 직접 지우면 0건이 됩니다)',
         (await 부름(p)).some(c => c.table==='__rpc' && c.op==='admin_wipe_chats'));
    확인('표를 직접 지우려 하지 않았는가',
         !(await 부름(p)).some(c => c.table==='chats' && c.op==='delete'));
    await ctx.close();
  }

  console.log('\n── 학생 명단 초기화 ──');
  {
    const { ctx, p } = await 열기(b);
    답하기(p, '지웁니다');
    await p.click('#btn-wipe-students'); await p.waitForTimeout(900);
    const 보낸것 = (await 부름(p)).filter(c => c.table === '__fn');
    const ids = await p.evaluate(()=>window.__fnBody && window.__fnBody.login_ids);
    확인('계정 지우기를 서버에 보냈는가', !!ids, JSON.stringify(ids));
    확인('계정 있는 학생만 보냈는가 (3번은 계정이 없습니다)',
         JSON.stringify(ids) === JSON.stringify(['30101','30102']), JSON.stringify(ids));
    await ctx.close();
  }

  console.log('\n── 교사 명단 초기화 — 내 계정은 남깁니다 ──');
  {
    const { ctx, p } = await 열기(b);
    답하기(p, '지웁니다');
    await p.click('#btn-wipe-teachers'); await p.waitForTimeout(900);
    const ids = await p.evaluate(()=>window.__fnBody && window.__fnBody.login_ids);
    확인('나(이용휘)는 빼고 보냈는가',
         JSON.stringify(ids) === JSON.stringify(['박영희']), JSON.stringify(ids));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
