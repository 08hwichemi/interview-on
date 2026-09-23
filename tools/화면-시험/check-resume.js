// 면접 도중 창이 닫혔을 때 «이어서 하기»
//
// 선생님이 면접을 진행하다가 노트북이 꺼지거나 탭을 닫으면 그 면접은
// status='진행중' 인 채로 서버에 남습니다. 다시 들어와도 자동으로는 못
// 찾으므로, 첫 화면에 그런 면접을 모아 보여 주고 눌러서 이어 가게 합니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => {
    window.__FAKE__ = {
      profile: { id: 't1', name: '이용휘', login_id: '이용휘', role: 'teacher' },
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                     school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
        students: [
          { id: 's1', student_no: '30101', name: '고다윤', auth_user_id: null, grade: 3, class_no: 1 },
          { id: 's2', student_no: '30102', name: '김서준', auth_user_id: null, grade: 3, class_no: 1 }
        ],
        // 창이 닫히기 전, 첫 질문까지 매기고 멈춘 «진행중» 면접입니다.
        interviews: [{
          id: 'iv1', student_id: 's1', teacher_id: 't1', teacher_name: '이용휘',
          status: '진행중', started_at: '2026-09-20T09:00:00Z'
        }],
        interview_answers: [
          { id: 'a1', interview_id: 'iv1', seq: 1, competency: '기타',
            question: '자기소개를 해 주세요.', seconds: 40,
            good_tags: ['자신감 있게 말함'], bad_tags: [], rating: '우수', memo: '' },
          { id: 'a2', interview_id: 'iv1', seq: 2, competency: '학업역량',
            question: '「히트 패치」 탐구는 무엇이 궁금해서 시작했나요?',
            seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '' }
        ]
      }
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  // 가짜 로그인은 session.user.id 가 'u1' 이지만, 면접 자료는 선생님 id 't1' 로
  // 두었습니다 (check-sheet.js 와 같은 방식). 여기 맞춰 다시 채우고 다시 불러옵니다.
  await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); await loadUnfinished(); });
  await p.waitForTimeout(300);

  console.log('\n── 첫 화면에 «끝내지 못한 면접» 이 뜨는가 ──');
  확인('안내가 보이는가', !(await p.evaluate(() => document.getElementById('unfinished').hidden)));
  확인('그 학생 이름이 있는가',
       (await p.evaluate(() => document.getElementById('unfinished-list').textContent)).indexOf('30101 고다윤') > -1);
  확인('다른 학생(진행중 아님)은 안 뜨는가',
       (await p.evaluate(() => document.getElementById('unfinished-list').textContent)).indexOf('김서준') === -1);

  console.log('\n── 눌러서 이어 가면 ──');
  await p.click('#unfinished-list button');
  await p.waitForTimeout(400);

  확인('진행 화면으로 가는가', await p.evaluate(() => !!document.querySelector('#view-run:not([hidden])')));
  확인('그 학생이 골라졌는가', await p.evaluate(() => target && target.id === 's1'));
  확인('질문 두 개가 살아있는가', await p.evaluate(() => questions.length === 2), await p.evaluate(() => questions.length));
  확인('첫 질문 평가가 그대로인가',
       await p.evaluate(() => answers[0].rating === '우수' && answers[0].good.indexOf('자신감 있게 말함') > -1));
  확인('아직 안 매긴 두 번째 질문에 가 있는가', await p.evaluate(() => qIndex === 1), await p.evaluate(() => qIndex));
  확인('시계는 멈춰 있는가 (선생님이 «이어서» 를 눌러야 함)',
       await p.evaluate(() => !ticking));
  확인('시계 단추가 «이어서» 인가',
       (await p.evaluate(() => document.getElementById('btn-timer').textContent)) === '이어서');
  확인('전체 시간이 매긴 것들의 합인가 (40초)',
       (await p.evaluate(() => document.getElementById('total-timer').textContent)) === '00:40');
  확인('안내가 사라졌는가', await p.evaluate(() => document.getElementById('unfinished').hidden));

  console.log('\n── 시계를 눌러야 다시 흐른다 ──');
  await p.click('#btn-timer'); await p.waitForTimeout(1200);
  확인('시계가 흐르기 시작하는가', await p.evaluate(() => ticking));
  await p.evaluate(() => stopTicking());

  console.log('\n── 목록으로 접으면 다시 «끝내지 못한 면접» 에 뜬다 ──');
  p.on('dialog', async d => { await d.accept(); });
  await p.click('#rail-progress .backbtn'); await p.waitForTimeout(400);
  확인('빈 화면으로 돌아갔는가', await p.evaluate(() => !!document.querySelector('#view-empty:not([hidden])')));
  확인('다시 안내가 뜨는가 (여전히 진행중 상태이므로)',
       !(await p.evaluate(() => document.getElementById('unfinished').hidden)));

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
