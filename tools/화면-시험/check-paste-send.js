// 선생님 화면 — 우리 학교 학생에게도 «📋 여러 질문 붙여넣기», 그리고 직접 적은 질문을 «📨 학생에게 보내기» (2026-10-15)
// (우리 학교에도 단추 · «낼 질문» 에 넣기(번호 떼기 · 같은 것 건너뜀) · 보내기는 묻고 · 아니오면 안 보냄 ·
//  practice_offers 로 학년 «공통» · 영역 «직접» · 같은 질문은 한 번만 · 다른 계정 로그인 막음 · 타학교엔 보내기 단추 없음 ·
//  학생을 바꾸면 칸이 닫힘 · 학생 앱 «받은 질문» 에 «공통 · 선생님 직접» 묶음 · 400px)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }
const 보임 = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [w, h] of [[1512, 1000], [400, 800]]) {
    console.log('\n════ 선생님 화면 ' + w + 'px ════');
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.addInitScript(() => {
      window.__FAKE__ = { rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                     school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'a1', grade: 3, class_no: 1 },
                   { id: 's2', student_no: '30102', name: '김서준', auth_user_id: 'a2', grade: 3, class_no: 1 }],
        reviews: [], questions: [], interviews: [], chats: [], practice_offers: []
      } };
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const 물음 = []; let 대답 = true;
    p.on('dialog', async d => { 물음.push(d.message()); if (대답) await d.accept(); else await d.dismiss(); });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { await pickStudent('s1'); if (!qsectOpen) toggleQsect(); });
    await p.waitForTimeout(300);

    console.log('\n── 우리 학교 학생 ──');
    확인('«📋 여러 질문 붙여넣기» 단추가 보이는가', await 보임(p, '.btnrow button[onclick="otherTogglePaste()"]'));
    await p.click('.btnrow button[onclick="otherTogglePaste()"]'); await p.waitForTimeout(100);
    확인('붙여넣기 칸이 열리는가', await 보임(p, '#other-paste'));
    확인('«📨 학생에게 보내기» 단추와 안내가 보이는가', await 보임(p, '#paste-send') && await 보임(p, '#other-paste .hint'));
    확인('단추 줄이 칸 밖으로 넘치지 않는가', await p.evaluate(() => {
      const box = document.getElementById('other-paste').getBoundingClientRect();
      return [...document.querySelectorAll('#other-paste .btnrow button')].every(x => x.getBoundingClientRect().right <= box.right + 0.5);
    }));
    확인('옆으로 넘치지 않는가', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    // «낼 질문» 에 넣기 — 타학교와 같게
    await p.fill('#other-paste-text', '1. 탐구 주제를 고른 까닭은?\n2) 실험에서 어려웠던 점은?\n\n- 탐구 주제를 고른 까닭은?');
    await p.click('#other-paste .btn.solid'); await p.waitForTimeout(150);
    확인('«낼 질문» 에 번호 떼고 2개', await p.evaluate(() => midQuestions.map(q => q.text).join('|') === '탐구 주제를 고른 까닭은?|실험에서 어려웠던 점은?'));
    확인('넣으면 칸이 닫히는가', !(await 보임(p, '#other-paste')));

    // 학생에게 보내기
    const 받은 = () => p.evaluate(() => window.__T.practice_offers || []);
    await p.click('.btnrow button[onclick="otherTogglePaste()"]');
    대답 = true; await p.click('#paste-send'); await p.waitForTimeout(150);
    확인('빈 칸이면 묻지 않고 «보낼 질문이 없습니다»', 물음.length === 0 && /보낼 질문이 없습니다/.test(await p.textContent('#toast')));
    await p.fill('#other-paste-text', 'Q1. 동아리에서 맡은 역할은?\n• 진로를 바꾼 까닭은?\n진로를 바꾼 까닭은?');
    대답 = false; await p.click('#paste-send'); await p.waitForTimeout(200);
    확인('보내기를 누르면 학생 이름 · 개수를 넣어 묻는가', 물음.length === 1 && /^2개를 고다윤 학생의 답안 연습장으로 보냅니다/.test(물음[0]), 물음[0]);
    확인('아니오면 안 보내고 칸도 그대로', (await 받은()).length === 0 && /동아리/.test(await p.inputValue('#other-paste-text')));
    대답 = true; await p.click('#paste-send'); await p.waitForTimeout(300);
    let 보낸 = await 받은();
    확인('예면 번호 뗀 2개가 그 학생에게', 보낸.length === 2 && 보낸.every(r => r.student_id === 's1') &&
         보낸.map(r => r.question).join('|') === '동아리에서 맡은 역할은?|진로를 바꾼 까닭은?', JSON.stringify(보낸.map(r => r.question)));
    확인('학년 «공통» · 영역 «직접» · 선생님 이름 · 학교가 붙는가', 보낸.every(r => r.grade === '공통' && r.area === '직접' && r.subject === '' &&
         r.teacher_id === 'u1' && r.teacher_name === '이용휘' && r.school_id), JSON.stringify(보낸[0]));
    확인('«낼 질문» 은 그대로(보내기는 질문지와 따로)', await p.evaluate(() => midQuestions.length === 2));
    확인('보내면 칸이 비고 닫히는가 · «보냈습니다»', !(await 보임(p, '#other-paste')) && /2개를 고다윤 학생에게 보냈습니다/.test(await p.textContent('#toast')));
    await p.click('.btnrow button[onclick="otherTogglePaste()"]');
    await p.fill('#other-paste-text', '동아리에서 맡은 역할은?\n새 질문 하나');
    await p.click('#paste-send'); await p.waitForTimeout(300);
    보낸 = await 받은();
    확인('같은 질문은 한 번만 — 새 것만 더해짐', 보낸.length === 3, 보낸.length + '줄');
    확인('«이미 보낸 1개는 건너뜀»', /1개를 고다윤 학생에게 보냈습니다.*이미 보낸 1개는 건너뜀/.test(await p.textContent('#toast')), await p.textContent('#toast'));

    // 같은 브라우저가 다른 계정으로 로그인돼 있으면 막음
    await p.click('.btnrow button[onclick="otherTogglePaste()"]');
    await p.fill('#other-paste-text', '다른 계정 질문');
    await p.evaluate(() => { window.__realGS = sb.auth.getSession; sb.auth.getSession = () => Promise.resolve({ data: { session: { user: { id: 'student-x' } } } }); });
    await p.click('#paste-send'); await p.waitForTimeout(300);
    확인('다른 계정이면 안 보내고 까닭을 알려 주는가', (await 받은()).length === 3 && /다른 계정/.test(물음[물음.length - 1]));
    await p.evaluate(() => { sb.auth.getSession = window.__realGS; });

    console.log('\n── 학생을 바꾸면 ──');
    await p.evaluate(async () => { await pickStudent('s2'); if (!qsectOpen) toggleQsect(); });
    await p.waitForTimeout(200);
    확인('붙여넣기 칸이 닫힌 채로 시작', !(await 보임(p, '#other-paste')));

    console.log('\n── 타학교 학생 ──');
    await p.evaluate(() => { railShowOther(true); otherNew(); }); await p.waitForTimeout(200);
    await p.evaluate(() => { if (!qsectOpen) toggleQsect(); });
    await p.click('.btnrow button[onclick="otherTogglePaste()"]'); await p.waitForTimeout(100);
    확인('타학교도 붙여넣기 칸은 열림', await 보임(p, '#other-paste'));
    확인('타학교엔 «학생에게 보내기» 단추 · 안내가 없음', !(await 보임(p, '#paste-send')) && !(await 보임(p, '#other-paste .hint')));
    확인('스크립트 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n════ 학생 앱 «받은 질문» ════');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 840 } });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.route('**/xlsx*', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await ctx.addInitScript(() => {
      const O = (id, grade, area, question) => ({ id, student_id: 's1', grade, area, subject: '', question, status: '새로',
        teacher_name: '이용휘', created_at: '2026-10-15T01:00:00Z' });
      window.__FAKE__ = { rows: {
        profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                     school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
        reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: [],
        practice_offers: [O('o1', '공통', '직접', '동아리에서 맡은 역할은?'), O('o2', '1', '동아리', '부원과 갈등을 어떻게 풀었나요?')]
      } };
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
    await p.evaluate(() => practiceOpenOffers()); await p.waitForTimeout(300);
    const 묶음 = await p.evaluate(() => [...document.querySelectorAll('#prac-offer-list .prac-offer-group')].map(x => x.textContent));
    확인('«공통 · 선생님 직접» 묶음으로 보이는가', 묶음.some(t => /^공통 · 선생님 직접/.test(t)), 묶음.join(' / '));
    확인('영역 칩에 «선생님 직접»', await p.evaluate(() =>
      [...document.querySelectorAll('#prac-offer-list .prac-offer-frow .prac-chip')].some(x => x.textContent === '선생님 직접')));
    await p.click('#prac-offer-list .prac-chip:has-text("선생님 직접")'); await p.waitForTimeout(100);
    확인('칩으로 좁히면 그 질문만', await p.evaluate(() => document.querySelectorAll('#prac-offer-list .prac-offer:not(.gone)').length) === 1);
    확인('스크립트 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
