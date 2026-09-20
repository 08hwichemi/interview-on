// 준비 화면 전체 — 구역이 구별되는지
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
    const ctx = await b.newContext({viewport:{width:w,height:1400}, deviceScaleFactor:2});
    await ctx.route('**/supabase-js*/**', r=>r.fulfill({contentType:'application/javascript',body:SB}));
    await ctx.route('**/pretendard*', r=>r.fulfill({contentType:'text/css',body:''}));
    await ctx.addInitScript(계획=>{window.__FAKE__={profile:{id:'t1',name:'이용휘',login_id:'이용휘',role:'teacher'},rows:{profiles:[{id:'u1',role:'teacher',name:'이용휘',login_id:'이용휘',school_id:'sc1',must_change_password:false}],students:[{id:'s1',student_no:'30101',name:'김민찬',auth_user_id:null,grade:3,class_no:1}],susi_plans:계획}};},계획);
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(()=>{me={id:'t1',name:'이용휘'};});
    await p.evaluate(async()=>{
      await pickStudent('s1');
      addQuestion('「히트 패치」 탐구는 무엇이 궁금해서 시작했나요?','학업역량');
      addQuestion('그 결과를 어떻게 확인했나요?','학업역량');
    });
    await p.waitForTimeout(500);
    const el = await p.$('#view-setup');
    await el.screenshot({path: __dirname+'/setup-'+w+'.png'});
    await ctx.close();
  }
  await b.close();
})();
