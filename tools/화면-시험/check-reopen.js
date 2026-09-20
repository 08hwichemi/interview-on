// 지난 리포트를 열어 «질문 고치기» 까지 들어가는 길
// (선생님 말씀: "리포트 눌러서 수정하려고 계속 들어가면서 질문고치기 누르려고 하니까
//  안되는 리포트가 있어")
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub4.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }

const 보통 = [
  {seq:1,question:'먼저 간단히 자기소개를 해 주세요.',competency:'기타',seconds:30,good_tags:[],bad_tags:[],rating:'보통',memo:''},
  {seq:2,question:'「히트 패치」 탐구는 무엇이 궁금해서 시작했나요?',competency:'학업역량',seconds:60,good_tags:['개념을 정확히 씀'],bad_tags:['말이 빠름'],rating:'우수',memo:'좋았음'},
  {seq:3,question:'마지막으로 하고 싶은 말이 있나요?',competency:'기타',seconds:20,good_tags:[],bad_tags:[],rating:'보통',memo:''}];
const 빈칸 = [{seq:1,question:'질문 하나',competency:null,seconds:10,good_tags:null,bad_tags:null,rating:null,memo:null}];
const 없음 = [];
const 인사없이 = [{seq:1,question:'전공을 고른 까닭은?',competency:'진로역량',seconds:40,good_tags:[],bad_tags:[],rating:'보통',memo:''}];

async function 열기(b) {
  const ctx = await b.newContext({ viewport:{width:1512,height:1000} });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.addInitScript(() => { window.__FAKE__ = { profile:{name:'이용휘',login_id:'이용휘',role:'teacher'}, rows:{} }; });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  for (const [이름, rows, 기대] of [
        ['질문 3개(첫인사·끝인사 포함)', 보통,     { 가운데:1, 첫인사:true,  끝인사:true  }],
        ['역량이 비어 있는 리포트',      빈칸,     { 가운데:1, 첫인사:false, 끝인사:false }],
        ['인사말 없이 질문만',           인사없이, { 가운데:1, 첫인사:false, 끝인사:false }],
        ['질문이 하나도 없는 리포트',    없음,     { 가운데:0, 첫인사:false, 끝인사:false }]]) {
    console.log('\n── ' + 이름 + ' ──');
    const { ctx, p, errs } = await 열기(b);
    const r = await p.evaluate(async (rows) => {
      target = { id:1, student_no:'30101', name:'고다윤' };
      window.fetchReport = async () => ({
        interview: { id:9, status:'작성완료', grades:{}, total_seconds:110, overall_note:'' }, answers: rows });
      const 결과 = { 단계:[] };
      try {
        await openPast(9, 1);                 결과.단계.push('리포트');
        backToFinish();                       결과.단계.push('채점표');
        backToRun();                          결과.단계.push('진행');
        await prevQuestion();                 결과.단계.push('질문고치기');
      } catch (e) { 결과.터짐 = e.message; return 결과; }
      결과.준비화면 = !!document.querySelector('#view-setup:not([hidden])');
      결과.가운데 = midQuestions.length;
      결과.첫인사 = opening.on; 결과.끝인사 = closing.on;
      // 되돌아갈 때 질문이 늘거나 줄지 않아야 합니다
      결과.다시 = composeQuestions().map(q => q.text);
      결과.원래 = rows.map(a => a.question);
      return 결과;
    }, rows);

    확인('터지지 않는가', !r.터짐, r.터짐 || '');
    확인('준비 화면까지 갔는가', r.준비화면 === true, (r.단계||[]).join(' → '));
    확인('가운데 질문 ' + 기대.가운데 + '개', r.가운데 === 기대.가운데, '가운데 ' + r.가운데);
    확인('첫인사 ' + (기대.첫인사?'켬':'끔'), r.첫인사 === 기대.첫인사);
    확인('끝인사 ' + (기대.끝인사?'켬':'끔'), r.끝인사 === 기대.끝인사);
    if (rows.length) 확인('되돌아가도 질문이 그대로인가',
         JSON.stringify(r.다시) === JSON.stringify(r.원래),
         (r.다시||[]).length + '개 / 원래 ' + (r.원래||[]).length + '개');
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
