const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub5.js'),'utf8');
const 계획 = [
  {student_no:'30101',area:'main',slot:1,uni_name:'경북대',type_name:'종합',admission_name:'학생부종합 일반학생전형',dept_name:'기계공학부',interview_date:'2026/10/16',synced_at:'2026-09-18T01:00:00Z'},
  {student_no:'30101',area:'main',slot:2,uni_name:'한국교통대',type_name:'종합',admission_name:'학생부종합Ⅱ',dept_name:'자동차공학과',interview_date:'2026/11/01',synced_at:'2026-09-18T01:00:00Z'},
  {student_no:'30101',area:'main',slot:3,uni_name:'순천향대',type_name:'종합',admission_name:'일반학생전형',dept_name:'스마트자동차학과',interview_date:null,synced_at:'2026-09-18T01:00:00Z'},
  {student_no:'30101',area:'main',slot:4,uni_name:'강원대(춘천삼척)',type_name:'교과',admission_name:'학생부교과(일반교과전형)',dept_name:'기계공학과',interview_date:null,synced_at:'2026-09-18T01:00:00Z'},
  {student_no:'30101',area:'main',slot:5,uni_name:'한서대',type_name:'교과',admission_name:'학생부교과1',dept_name:'AI모빌리티학과',interview_date:null,synced_at:'2026-09-18T01:00:00Z'},
  {student_no:'30101',area:'main',slot:6,uni_name:'세종대',type_name:'종합',admission_name:'학생부종합(창의인재전형)',dept_name:'컴퓨터공학과',interview_date:'2026/11/22',synced_at:'2026-09-18T01:00:00Z'}
];
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for (const w of [1100, 400]) {
    const ctx = await b.newContext({viewport:{width:w,height:1200}, deviceScaleFactor:2});
    await ctx.route('**/supabase-js*/**', r=>r.fulfill({contentType:'application/javascript',body:SB}));
    await ctx.route('**/pretendard*', r=>r.fulfill({contentType:'text/css',body:''}));
    await ctx.addInitScript(계획=>{window.__FAKE__={profile:{id:'t1',name:'이용휘',login_id:'이용휘',role:'teacher'},rows:{profiles:[{id:'u1',role:'teacher',name:'이용휘',login_id:'이용휘',school_id:'sc1',must_change_password:false}],students:[{id:'s1',student_no:'30101',name:'고다윤',auth_user_id:null,grade:3,class_no:1}],susi_plans:계획}};},계획);
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(()=>{me={id:'t1',name:'이용휘'};});
    await p.evaluate(async()=>{await pickStudent('s1');});
    await p.waitForTimeout(500);
    // 접힌 채로 한 장, 펼친 채로 한 장
    // 위아래 구역과 얼마나 구별되는지 보려고 준비 화면 위쪽을 함께 찍습니다
    await p.evaluate(() => {
      var box = document.getElementById('susi-box');
      var wrap = document.createElement('div');
      wrap.id = 'shotwrap';
      var start = document.getElementById('history-box');
      var end = box.nextElementSibling ? box.nextElementSibling.nextElementSibling : null;
      var nodes = [start, box];
      var n = box.nextElementSibling;
      for (var i = 0; i < 3 && n; i++) { nodes.push(n); n = n.nextElementSibling; }
      start.parentNode.insertBefore(wrap, start);
      nodes.forEach(function (x) { wrap.appendChild(x); });
    });
    let el = await p.$('#shotwrap');
    await el.screenshot({path: __dirname+'/susi-'+w+'-펼침.png'});
    await p.click('#susi-more'); await p.waitForTimeout(200);
    el = await p.$('#shotwrap');
    await el.screenshot({path: __dirname+'/susi-'+w+'-접힘.png'});
    await ctx.close();
  }
  await b.close();
})();
