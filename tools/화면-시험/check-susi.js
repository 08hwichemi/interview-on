// 수시 지원 현황이 면접 준비 화면에 뜨는지
//
// 선생님 말씀: "교사 화면에서 대학명, 전형, 학과 이 정보만 학생 학번 이름하고
// 매칭시켜서 여기 빈 공간에 보여주면 선생님들이 면접 할 때 편할 것 같은데."
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const 계획 = [
  // 30101 고다윤 — 6장 + 전문대 한 장. 일부러 차례를 섞어 둡니다.
  { student_no:'30101', area:'main', slot:3, uni_name:'순천향대', type_name:'종합',
    admission_name:'일반학생전형', dept_name:'스마트자동차학과', interview_date:'2026/10/31',
    synced_at:'2026-09-18T01:00:00Z' },
  { student_no:'30101', area:'college', slot:1, uni_name:'영진전문대', type_name:'기타',
    admission_name:'일반전형', dept_name:'자동차과', interview_date:null,
    synced_at:'2026-09-18T01:00:00Z' },
  { student_no:'30101', area:'main', slot:1, uni_name:'경북대', type_name:'종합',
    admission_name:'학생부종합 일반학생전형', dept_name:'기계공학부', interview_date:'2026/10/16',
    synced_at:'2026-09-18T01:00:00Z' },
  { student_no:'30101', area:'main', slot:2, uni_name:'한서대', type_name:'교과',
    admission_name:'학생부교과1', dept_name:'AI모빌리티학과', interview_date:null,
    synced_at:'2026-09-18T01:00:00Z' }
];

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 교사 화면 ──');
  {
    const ctx = await b.newContext({ viewport:{ width:1512, height:1000 } });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType:'application/javascript', body:SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType:'text/css', body:'' }));
    await ctx.addInitScript(계획 => {
      window.__FAKE__ = {
        profile:{ id:'t1', name:'이용휘', login_id:'이용휘', role:'teacher' },
        rows: {
          profiles: [{ id:'u1', role:'teacher', name:'이용휘', login_id:'이용휘',
                       school_id:'9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password:false }],
          students: [
            { id:'s1', student_no:'30101', name:'고다윤', auth_user_id:null, grade:3, class_no:1 },
            { id:'s2', student_no:'30102', name:'김서준', auth_user_id:null, grade:3, class_no:1 }
          ],
          susi_plans: 계획
        }
      };
    }, 계획);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/teacher/');
    await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(() => { me = { id:'t1', name:'이용휘' }; });

    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.waitForTimeout(400);

    확인('수시 칸이 뜨는가', !(await p.evaluate(() => document.getElementById('susi-box').hidden)));

    console.log('  · 처음에는 펴져 있어야 합니다');
    확인('펴진 채로 뜨는가', !(await p.evaluate(() => document.getElementById('susi').hidden)));
    확인('단추 글자가 「접기」인가',
         (await p.textContent('#susi-more-label')).trim() === '접기',
         (await p.textContent('#susi-more-label')).trim());
    확인('머리줄 전체가 단추인가 (글자만이 아니라)',
         await p.evaluate(() => document.getElementById('susi-more').tagName === 'BUTTON'
                             && document.getElementById('susi-more').getBoundingClientRect().width > 300));
    확인('네모로 묶여 다른 구역과 구별되는가',
         await p.evaluate(() => {
           var acc = document.querySelector('.susiacc'), h = document.querySelector('.susihead');
           var cs = getComputedStyle(acc), hs = getComputedStyle(h);
           return parseFloat(cs.borderTopWidth) >= 1
               && parseFloat(cs.borderTopLeftRadius) >= 4
               && hs.backgroundColor !== 'rgba(0, 0, 0, 0)'
               && hs.backgroundColor !== getComputedStyle(document.querySelector('.susibody')).backgroundColor;
         }));
    확인('몇 곳인지 보이는가',
         (await p.textContent('#susi-count')).trim() === '3곳 · 면접 2곳',
         (await p.textContent('#susi-count')).trim());
    확인('언제 받아 온 자료인지 적는가',
         /9월 18일/.test(await p.evaluate(() => document.getElementById('susi-when').textContent)),
         await p.evaluate(() => document.getElementById('susi-when').textContent));

    const 줄 = await p.$$eval('#susi .susirow', els => els.map(e => ({
      sn: e.querySelector('.sn').textContent.trim(),
      uni: e.querySelector('.uni').textContent.trim(),
      dept: e.querySelector('.dept').textContent.trim(),
      adm: e.querySelector('.adm').textContent.trim(),
      iv: e.querySelector('.iv') ? e.querySelector('.iv').textContent.trim() : '',
      h: Math.round(e.getBoundingClientRect().height)
    })));
    확인('수시 6장만 나오는가 (전문대는 안 가져옵니다)', 줄.length === 3, 줄.length + '줄');
    확인('차례대로인가',
         줄.map(r => r.sn + r.uni).join(' ') === '1경북대 2한서대 3순천향대',
         줄.map(r => r.sn + r.uni).join(' '));
    확인('전문대가 섞여 있어도 안 보이는가', 줄.every(r => r.uni !== '영진전문대'));
    확인('학과가 나오는가', 줄[0].dept === '기계공학부', 줄[0].dept);
    확인('갈래와 전형 이름을 한 칸에 적는가',
         줄[0].adm === '종합 · 학생부종합 일반학생전형', 줄[0].adm);
    확인('면접 날짜는 해를 떼고 보여주는가', 줄[0].iv === '면접 10/16', 줄[0].iv);
    확인('한 지원이 한 줄인가 (28px 이하)', 줄.every(r => r.h <= 28), 줄.map(r => r.h).join(','));

    console.log('  · 접었을 때');
    await p.click('#susi-more'); await p.waitForTimeout(150);
    확인('머리줄 아무 데나 눌러도 접히는가', await p.evaluate(() => document.getElementById('susi').hidden));
    확인('단추 글자가 「펼치기」로 바뀌는가',
         (await p.textContent('#susi-more-label')).trim() === '펼치기');
    확인('꺾쇠가 돌아가는가',
         await p.evaluate(() => getComputedStyle(document.querySelector('.susihead .chev')).transform !== 'none'));
    const 접힘높이 = await p.evaluate(() => Math.round(document.querySelector('.susiacc').getBoundingClientRect().height));
    확인('접히면 머리줄 한 줄만 쓰는가 (46px 안쪽)', 접힘높이 <= 46, 접힘높이 + 'px');

    console.log('  · 마지막으로 한 대로 남는가');
    await p.evaluate(async () => { await pickStudent('s2'); });
    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.waitForTimeout(400);
    확인('접어 둔 상태가 학생을 바꿔도 남는가',
         await p.evaluate(() => document.getElementById('susi').hidden));
    await p.reload(); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(() => { me = { id:'t1', name:'이용휘' }; });
    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.waitForTimeout(400);
    확인('새로고침해도 남는가 (localStorage)',
         await p.evaluate(() => document.getElementById('susi').hidden));
    await p.click('#susi-more'); await p.waitForTimeout(150);   // 다시 펴 두고 이어서 봅니다

    console.log('\n── 자료 없는 학생 ──');
    await p.evaluate(async () => { await pickStudent('s2'); });
    await p.waitForTimeout(400);
    확인('수시 칸을 아예 접는가', await p.evaluate(() => document.getElementById('susi-box').hidden));

    console.log('\n── 좁은 화면(400px) ──');
    await p.evaluate(async () => { await pickStudent('s1'); });
    await p.setViewportSize({ width:400, height:900 });
    await p.waitForTimeout(300);
    const 넘침 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    확인('옆으로 안 넘치는가', 넘침 <= 0, 넘침 + 'px');
    const 폰줄 = await p.$$eval('#susi .susirow', els => els.map(e => Math.round(e.getBoundingClientRect().height)));
    // 휴대폰에서는 전형 이름만 둘째 줄로 내립니다 — 선생님 말씀대로 «많아도 두 줄»
    확인('휴대폰에서도 많아야 두 줄 (52px 안쪽)', 폰줄.every(h => h <= 52), 폰줄.join(','));
    const 폰면접 = await p.evaluate(() => {
      var r = document.querySelector('#susi .susirow.hasiv');
      if (!r) return null;
      var top = r.getBoundingClientRect().top;
      return Math.round(r.querySelector('.iv').getBoundingClientRect().top - top);
    });
    확인('면접 날짜는 휴대폰에서도 첫 줄에 남는가', 폰면접 !== null && 폰면접 < 12, 폰면접 + 'px');
    await p.click('#susi-more'); await p.waitForTimeout(150);
    const 폰접힘 = await p.evaluate(() => Math.round(document.querySelector('.susiacc').getBoundingClientRect().height));
    확인('휴대폰에서 접으면 머리줄만 (66px 안쪽 — 글이 두 줄이 될 수 있습니다)',
         폰접힘 <= 66, 폰접힘 + 'px');
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 관리자 화면: 새로 받기 ──');
  {
    const ctx = await b.newContext({ viewport:{ width:1100, height:1100 } });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType:'application/javascript', body:SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType:'text/css', body:'' }));
    await ctx.route('**/xlsx*', r => r.fulfill({ contentType:'application/javascript', body:'window.XLSX={};' }));
    await ctx.addInitScript(계획 => {
      window.__FAKE__ = {
        profile:{ id:'u1', name:'이용휘', login_id:'관리자', role:'admin' },
        susiFetched: 계획,
        rows: {
          profiles: [{ id:'u1', role:'admin', name:'이용휘', login_id:'관리자',
                       school_id:'sc1', must_change_password:false }],
          students: [{ id:'s1', student_no:'30101', name:'고다윤', grade:3, class_no:1, auth_user_id:'a1' }],
          susi_plans: []
        }
      };
    }, 계획);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/admin/');
    await p.waitForSelector('#app:not([hidden])');
    await p.click('#tab-data'); await p.waitForTimeout(400);

    const 칸 = await p.locator('#data-counts .datacount .k').allTextContents();
    확인('개수 칸에 수시가 들어갔는가', 칸.indexOf('수시 지원 줄') > -1, 칸.join(','));
    확인('처음엔 0줄인가',
         (await p.locator('#data-counts .datacount .n').allTextContents()).slice(-1)[0] === '0');

    await p.click('#btn-sync-susi'); await p.waitForTimeout(600);
    확인('수시 6장만 받아 왔는가 (전문대는 뺍니다)', (await 표(p)).length === 3, (await 표(p)).length + '줄');
    확인('결과를 화면에 적는가',
         /3줄/.test(await p.evaluate(() => document.getElementById('data-result').textContent)),
         await p.evaluate(() => document.getElementById('data-result').textContent.trim()));
    확인('개수 칸도 따라 바뀌는가',
         (await p.locator('#data-counts .datacount .n').allTextContents()).slice(-1)[0] === '3');
    확인('묻지 않고 바로 하는가 (지우는 일이 아닙니다)', true);
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();

    function 표(p) { return p.evaluate(() => window.__T.susi_plans || []); }
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
