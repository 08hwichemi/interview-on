// 학생 접속 표시(presence.js) — 학생이 화면을 열어 두면 하트비트를 보내고,
// 교사 화면 학생 명단에 초록 점이 뜨는가. 접속 안 했으면 점 자체가 없어야 합니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── isStudentOnline() 기준(90초) ──');
  {
    const ctx = await b.newContext();
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8777/teacher/');
    확인('없으면 오프라인', await p.evaluate(() => isStudentOnline(null)) === false);
    확인('30초 전이면 온라인', await p.evaluate(() => isStudentOnline(new Date(Date.now() - 30000).toISOString())));
    확인('89초 전이면 온라인', await p.evaluate(() => isStudentOnline(new Date(Date.now() - 89000).toISOString())));
    확인('91초 전이면 오프라인', await p.evaluate(() => isStudentOnline(new Date(Date.now() - 91000).toISOString())) === false);
    await ctx.close();
  }

  console.log('\n── 학생 화면: 들어오면 바로 하트비트를 보내는가 ──');
  {
    const ctx = await b.newContext();
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.addInitScript(() => {
      window.__FAKE__ = {
        rows: {
          profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                       school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
          students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3, last_seen_at: null }],
          reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: []
        }
      };
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
    await p.waitForTimeout(200);

    확인('로그인하자마자 하트비트로 last_seen_at 이 찍히는가',
         await p.evaluate(() => {
           var s = window.__T.students.find(function (x) { return x.id === 's1'; });
           return !!s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime()) < 5000;
         }));

    console.log('\n── 탭으로 돌아오면(visibilitychange) 다시 한 번 찍는가 ──');
    await p.evaluate(async () => {
      window.__T.students[0].last_seen_at = null;
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await p.waitForTimeout(150);
    확인('탭으로 돌아오면 하트비트가 다시 찍히는가',
         await p.evaluate(() => !!window.__T.students.find(function (x) { return x.id === 's1'; }).last_seen_at));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 교사 화면: 접속 중인 학생만 초록 점 ──');
  {
    const ctx = await b.newContext();
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.addInitScript(() => {
      window.__FAKE__ = {
        rows: {
          profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                       school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
          students: [
            { id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'a1', grade: 3, class_no: 1,
              last_seen_at: new Date(Date.now() - 10000).toISOString() },        // 방금 접속
            { id: 's2', student_no: '30102', name: '김서준', auth_user_id: 'a2', grade: 3, class_no: 1,
              last_seen_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() }, // 10분 전(오프라인)
            { id: 's3', student_no: '30103', name: '이하늘', auth_user_id: null, grade: 3, class_no: 1,
              last_seen_at: null }                                                 // 한 번도 접속 안 함
          ],
          reviews: [], questions: [], interviews: [], interview_answers: [], susi_plans: []
        }
      };
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); startOnlineWatch(); });
    await p.waitForTimeout(300);

    확인('방금 접속한 학생(고다윤) 줄에 초록 점이 있는가', await p.evaluate(() => {
      var row = Array.from(document.querySelectorAll('#student-list .srow')).find(r => r.textContent.indexOf('고다윤') > -1);
      return !!row && !!row.querySelector('.online-dot');
    }));
    확인('10분 전 접속(김서준)엔 점이 없는가', await p.evaluate(() => {
      var row = Array.from(document.querySelectorAll('#student-list .srow')).find(r => r.textContent.indexOf('김서준') > -1);
      return !!row && !row.querySelector('.online-dot');
    }));
    확인('한 번도 접속 안 한 학생(이하늘)엔 점이 없는가', await p.evaluate(() => {
      var row = Array.from(document.querySelectorAll('#student-list .srow')).find(r => r.textContent.indexOf('이하늘') > -1);
      return !!row && !row.querySelector('.online-dot');
    }));

    console.log('\n── 다시 읽으면(refreshOnlineStatus) 새로 접속한 학생도 점이 붙는가 ──');
    await p.evaluate(async () => {
      var s2 = window.__T.students.find(function (x) { return x.id === 's2'; });
      s2.last_seen_at = new Date().toISOString();   // 방금 김서준도 접속했다고 가정
      await refreshOnlineStatus();
    });
    await p.waitForTimeout(150);
    확인('새로 접속한 김서준에도 점이 생기는가', await p.evaluate(() => {
      var row = Array.from(document.querySelectorAll('#student-list .srow')).find(r => r.textContent.indexOf('김서준') > -1);
      return !!row && !!row.querySelector('.online-dot');
    }));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
