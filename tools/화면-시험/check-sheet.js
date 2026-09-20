// 면접 전에 «질문지» 를 미리 만들어 두는 길
//
// 선생님 말씀: "학생들 배정되고 나면 미리 학생 생기부를 통해서 질문을 만들어 놓고
// 나서 학생이랑 면접을 할거거든."
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const SB = fs.readFileSync(path.join(__dirname,'stub5.js'),'utf8');
let 실패=0;
function 확인(무엇, ok, 덧){ console.log((ok?'  ✓ ':'  ✗ ')+무엇+(덧?'  → '+덧:'')); if(!ok)실패++; }

const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport:{width:1512,height:1000} });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({contentType:'application/javascript', body:SB}));
  await ctx.route('**/pretendard*', r => r.fulfill({contentType:'text/css', body:''}));
  await ctx.addInitScript(() => {
    window.__FAKE__ = { profile:{ id:'t1', name:'이용휘', login_id:'이용휘', role:'teacher' },
      rows: { profiles: [{ id:'u1', role:'teacher', name:'이용휘', login_id:'이용휘',
                           school_id:'9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password:false }],
        students: [
        { id:'s1', student_no:'30101', name:'고다윤', auth_user_id:null, grade:3, class_no:1 },
        { id:'s2', student_no:'30102', name:'김서준', auth_user_id:null, grade:3, class_no:1 } ] } };
  });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(() => { me = { id:'t1', name:'이용휘' }; });

  console.log('\n── 질문지를 미리 만들어 저장 ──');
  await p.evaluate(async () => {
    await pickStudent('s1');
    // 첫인사·끝인사는 처음부터 켜져 있습니다 (pickOpening 을 부르면 꺼집니다)
    addQuestion('「히트 패치」 탐구는 무엇이 궁금해서 시작했나요?', '학업역량');
    addQuestion('그 결과를 어떻게 확인했나요?', '학업역량');
  });
  await p.waitForTimeout(150);
  await p.click('#btn-save-sheet'); await p.waitForTimeout(400);

  const ivs = await 표(p, 'interviews');
  const ans = await 표(p, 'interview_answers');
  확인('«준비중» 줄이 하나 생겼는가', ivs.length === 1 && ivs[0].status === '준비중',
       JSON.stringify(ivs.map(x=>x.status)));
  확인('그 학생·그 선생님 것으로 남는가',
       ivs[0] && ivs[0].student_id === 's1' && ivs[0].teacher_id === 't1');
  확인('질문이 다 들어갔는가 (첫인사 + 2 + 끝인사)', ans.length === 4, ans.length + '개');
  확인('차례가 맞는가', ans.map(a=>a.seq).join(',') === '1,2,3,4');
  확인('안내가 뜨는가', !(await p.evaluate(()=>document.getElementById('sheet-note').hidden)));
  확인('면접은 아직 시작 안 했는가', await p.evaluate(()=>interviewId === null));

  console.log('\n── 다른 학생에 갔다가 다시 오면 그대로 뜨는가 ──');
  await p.evaluate(async () => { await pickStudent('s2'); });
  await p.waitForTimeout(300);
  확인('다른 학생은 빈 화면인가',
       await p.evaluate(()=>midQuestions.length === 0 && sheetId === null));
  await p.evaluate(async () => { await pickStudent('s1'); });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({
    가운데: midQuestions.map(q=>q.text), 첫인사: opening.on, 끝인사: closing.on,
    글: composeQuestions().map(q=>q.text), 안내: !document.getElementById('sheet-note').hidden
  }));
  확인('질문지가 그대로 돌아왔는가', r.글.length === 4, r.글.length + '개');
  확인('첫인사가 첫인사 자리에 있는가', r.첫인사 === true);
  확인('끝인사가 끝인사 자리에 있는가', r.끝인사 === true);
  확인('가운데 질문은 둘인가', r.가운데.length === 2, r.가운데.join(' / '));
  확인('«미리 만들어 둔 질문지» 안내가 뜨는가', r.안내 === true);

  console.log('\n── 고쳐서 다시 저장 ──');
  await p.evaluate(() => { addQuestion('전공을 고른 까닭은?', '진로역량'); });
  await p.waitForTimeout(100);
  await p.click('#btn-save-sheet'); await p.waitForTimeout(400);
  const ivs2 = await 표(p, 'interviews'), ans2 = await 표(p, 'interview_answers');
  확인('줄이 늘어나지 않는가 (덮어씁니다)', ivs2.length === 1, ivs2.length + '줄');
  확인('질문이 5개가 되었는가', ans2.length === 5, ans2.length + '개');

  console.log('\n── 지난 면접 목록에는 안 보입니다 ──');
  await p.evaluate(async () => { await loadHistory(); });
  await p.waitForTimeout(300);
  확인('«준비중» 은 회차로 안 세는가',
       /첫 면접/.test(await p.evaluate(()=>document.getElementById('history').textContent)),
       await p.evaluate(()=>document.getElementById('history').textContent.trim().slice(0,40)));

  console.log('\n── 화면만 넘기는 것은 «면접 시작» 이 아닙니다 ──');
  await p.click('#btn-start'); await p.waitForTimeout(500);
  const ivs3 = await 표(p, 'interviews');
  확인('새 줄이 생기지 않는가', ivs3.length === 1, ivs3.length + '줄');
  확인('아직 «준비중» 인가 (시계를 안 눌렀습니다)', ivs3[0].status === '준비중', ivs3[0].status);
  확인('진행 화면이긴 한가', await p.evaluate(()=>!!document.querySelector('#view-run:not([hidden])')));
  확인('시계 단추가 «면접 시작» 인가',
       (await p.evaluate(()=>document.getElementById('btn-timer').textContent)) === '면접 시작');

  console.log('\n── 그대로 나갔다 들어오면 질문지로 되돌아옵니다 ──');
  await p.evaluate(async () => { await pickStudent('s2'); await pickStudent('s1'); });
  await p.waitForTimeout(500);
  확인('지난 면접 목록에 안 뜨는가',
       /첫 면접/.test(await p.evaluate(()=>document.getElementById('history').textContent)),
       await p.evaluate(()=>document.getElementById('history').textContent.trim().slice(0,40)));
  확인('«미리 만들어 둔 질문지» 로 다시 뜨는가',
       await p.evaluate(()=>sheetId !== null && !document.getElementById('sheet-note').hidden));
  확인('질문도 그대로인가', await p.evaluate(()=>composeQuestions().length === 5),
       await p.evaluate(()=>composeQuestions().length) + '개');

  console.log('\n── 시계를 눌러야 «진행중» 이 됩니다 ──');
  await p.click('#btn-start'); await p.waitForTimeout(400);
  await p.click('#btn-timer'); await p.waitForTimeout(500);
  const ivs3b = await 표(p, 'interviews');
  확인('«진행중» 으로 바뀌었는가', ivs3b[0].status === '진행중', ivs3b[0].status);
  확인('줄은 여전히 하나인가', ivs3b.length === 1, ivs3b.length + '줄');
  확인('질문지 표시는 사라졌는가',
       await p.evaluate(()=>sheetId === null && document.getElementById('sheet-note').hidden));
  확인('그 면접으로 들어갔는가',
       await p.evaluate(()=>interviewId === window.__T.interviews[0].id));
  await p.evaluate(()=>stopTicking());

  console.log('\n── 질문지 지우기 ──');
  await p.evaluate(async () => {
    // 새 질문지를 하나 만들어 두고 지워 봅니다
    await pickStudent('s2');
    addQuestion('시험용 질문', '기타');
  });
  await p.waitForTimeout(150);
  await p.click('#btn-save-sheet'); await p.waitForTimeout(400);
  확인('두 번째 학생 질문지가 생겼는가', (await 표(p,'interviews')).length === 2);
  p.on('dialog', async d => { await d.accept(); });   // 교사 화면은 브라우저 confirm 을 씁니다
  await p.evaluate(()=>deleteSheet());
  await p.waitForTimeout(500);
  const ivs4 = await 표(p, 'interviews');
  확인('질문지 줄이 지워졌는가', ivs4.length === 1 && ivs4[0].status === '진행중',
       ivs4.map(x=>x.status).join(','));
  확인('화면의 질문은 그대로 있는가', await p.evaluate(()=>midQuestions.length === 1));

  확인('콘솔 오류 없음', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ '+실패+'개 실패' : '\n✅ 모두 통과');
  process.exit(실패?1:0);
})();
