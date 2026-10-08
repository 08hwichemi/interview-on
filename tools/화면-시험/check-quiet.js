// 화면을 켜 두기만 했을 때 서버에 얼마나 묻는가 (2026-10-03, Supabase 사용량 줄이기)
//
// 시계를 30분 앞으로 돌려 보고, 그동안 나간 서버 요청을 셉니다.
//   · 톡 목록은 «5분마다 다시 확인» 을 뺐습니다 → 30분 동안 0번이어야 합니다
//   · 실시간이 끊겼다가 다시 붙으면 → 그때 한 번만 확인합니다
//   · 실시간 알림이 한꺼번에 두 개 와도(새 말 + 읽음) → 한 번만 받습니다
//   · 접속 표시(초록 점 · 하트비트)는 없앴습니다(2026-10-03) → 0번
//   · 빨간 숫자(리포트 · 연습장 · 공지 · 톡)는 앱을 열 때·돌아왔을 때 서버 함수 하나(app_badges)로 한 번에(2026-10-08).
//     톡 목록은 열 때 받지 않고, 돌아왔을 때도 «바뀐 게 있을 때만» 받습니다. 함수가 없으면 예전처럼 따로 묻습니다
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
// 가짜 서버에 «실시간 연결이 붙었다» 를 흉내 낼 수 있게 subscribe 의 콜백을 잡아 둡니다
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8') + `
;(function () {
  var make = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = make.apply(this, arguments);
    window.__subs = {}; window.__onChange = {};
    c.channel = function (name) {
      var ch = { on: function (a, b, fn) { window.__onChange[name] = fn; return ch; },
                 subscribe: function (cb) { window.__subs[name] = cb; return ch; } };
      return ch;
    };
    var from = c.from.bind(c);
    window.__reads = {};
    c.from = function (t) { window.__reads[t] = (window.__reads[t] || 0) + 1; return from(t); };
    var rpc = c.rpc.bind(c);
    c.rpc = function (n) { window.__reads['rpc:' + n] = (window.__reads['rpc:' + n] || 0) + 1; return rpc.apply(null, arguments); };
    return c;
  };
})();`;
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => {
    window.__FAKE__ = {
      rows: {
        profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                     school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3, last_seen_at: null }],
        reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: [],
        chats: []
      }
    };
  });
  const p = await ctx.newPage();
  await p.clock.install();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });
  await p.clock.runFor(2000);

  const 처음 = await p.evaluate(() => Object.assign({}, window.__reads));
  확인('앱을 열 때 빨간 숫자는 묶음 확인 한 번(app_badges)', 처음['rpc:app_badges'] === 1, JSON.stringify(처음));
  확인('앱을 열 때 톡 목록 · 공지 · 리포트 · 연습장 코멘트 · 받은 질문을 따로 묻지 않는가',
       ['chats', 'announcements', 'interviews', 'report_reads', 'practice_comments', 'practice_comment_reads', 'practice_offers']
         .every(k => !처음[k]), JSON.stringify(처음));

  console.log('\n── 화면을 켜 둔 채 30분 ──');
  await p.clock.runFor('30:00');
  const 뒤 = await p.evaluate(() => Object.assign({}, window.__reads));
  const 더 = function (k) { return (뒤[k] || 0) - (처음[k] || 0); };
  확인('톡 목록을 다시 묻지 않는가(0번)', 더('chats') === 0, 더('chats') + '번');
  확인('하트비트를 보내지 않는가(0번)', !뒤['rpc:student_heartbeat'], (뒤['rpc:student_heartbeat'] || 0) + '번');
  const 모두 = Object.keys(뒤).reduce(function (n, k) { return n + 더(k); }, 0);
  확인('30분 동안 서버 요청이 0번인가', 모두 === 0, 모두 + '번 ' + JSON.stringify(뒤));

  console.log('\n── 실시간이 끊겼다가 다시 붙으면 ──');
  await p.evaluate(() => { window.__subs['chat-list']('SUBSCRIBED'); });   // 처음 붙음
  await p.clock.runFor(2000);
  확인('처음 붙을 때는 다시 받지 않는가', (await p.evaluate(() => window.__reads.chats || 0)) === (뒤.chats || 0));
  await p.evaluate(() => { window.__subs['chat-list']('CLOSED'); window.__subs['chat-list']('SUBSCRIBED'); });  // 끊겼다 다시
  await p.clock.runFor(2000);
  const 다시 = await p.evaluate(() => window.__reads.chats || 0);
  확인('다시 붙을 때 톡 목록을 한 번 확인하는가', 다시 - (뒤.chats || 0) === 1, (다시 - (뒤.chats || 0)) + '번');

  console.log('\n── 실시간 알림이 한꺼번에 둘 오면 ──');
  await p.evaluate(() => {
    var m = { id: 'c1', room_id: 'r', sender_id: 't1', receiver_id: 'u1', content: '안녕', is_read: false,
              created_at: new Date().toISOString() };
    window.__T.chats.push(m);
    window.__onChange['chat-list']({ eventType: 'INSERT', new: m });
    window.__onChange['chat-list']({ eventType: 'UPDATE', new: Object.assign({}, m, { is_read: true }) });
  });
  await p.clock.runFor(2000);
  const 둘 = await p.evaluate(() => window.__reads.chats);
  확인('목록은 한 번만 받는가', 둘 - 다시 === 1, (둘 - 다시) + '번');
  확인('남이 주고받은 말에는 반응하지 않는가', await p.evaluate(async () => {
    var before = window.__reads.chats;
    window.__onChange['chat-list']({ eventType: 'INSERT', new: { sender_id: 'x', receiver_id: 'y' } });
    return before;
  }).then(async before => { await p.clock.runFor(2000); return (await p.evaluate(() => window.__reads.chats)) === before; }));

  console.log('\n── 앱으로 돌아왔을 때(묶음 확인) ──');
  const 돌아옴 = async () => { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.clock.runFor(2000); };
  const 읽음 = () => p.evaluate(() => Object.assign({}, window.__reads));
  await 돌아옴();   // 30분이 지났으니 이번엔 묻고, 곧바로 또 돌아오면 안 묻습니다
  let r0 = await 읽음();
  await 돌아옴();
  let r1 = await 읽음();
  확인('마지막 확인에서 5분이 안 지났으면 묻지 않는가', (r1['rpc:app_badges'] || 0) === (r0['rpc:app_badges'] || 0));
  await p.clock.runFor('05:01');
  r0 = await 읽음(); await 돌아옴(); r1 = await 읽음();
  확인('5분이 지나 돌아오면 묶음 확인 한 번', r1['rpc:app_badges'] - r0['rpc:app_badges'] === 1);
  확인('바뀐 게 없으면 톡 목록은 안 받는가', (r1.chats || 0) === (r0.chats || 0), ((r1.chats || 0) - (r0.chats || 0)) + '번');
  // 실시간이 놓친 새 톡이 서버에 있으면 — 묶음 확인이 알아채고 목록을 한 번 받습니다
  await p.evaluate(() => { window.__T.chats.push({ id: 'c2', room_id: 'r', sender_id: 't1', receiver_id: 'u1', content: '또', is_read: false,
                                                    created_at: new Date(Date.now() + 1000).toISOString() }); });
  await p.clock.runFor('05:01');
  r0 = await 읽음(); await 돌아옴(); r1 = await 읽음();
  확인('새 톡이 있으면 그때만 목록을 한 번 받는가', (r1.chats || 0) - (r0.chats || 0) === 1, ((r1.chats || 0) - (r0.chats || 0)) + '번');
  const 안읽음 = await p.evaluate(() => window.__T.chats.filter(c => c.receiver_id === 'u1' && !c.is_read).length);
  확인('💬 빨간 숫자가 서버의 안 읽은 수와 같은가', (await p.evaluate(() => document.getElementById('chat-badge').textContent)) === String(안읽음), '안 읽음 ' + 안읽음);

  console.log('\n── 서버 함수가 없으면 예전처럼 따로 ──');
  await p.evaluate(() => { window.__noBadgesRpc = true; });
  await p.clock.runFor('05:01');
  r0 = await 읽음(); await 돌아옴(); r1 = await 읽음();
  확인('함수가 없으면 공지 · 톡 · 리포트 · 연습장을 따로 묻는가(빨간 숫자가 멈추지 않게)',
       ['announcements', 'chats', 'interviews', 'practice_comments'].every(k => (r1[k] || 0) - (r0[k] || 0) >= 1), JSON.stringify(r1));
  await p.evaluate(() => { window.__noBadgesRpc = false; });

  확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));

  console.log('\n── 교사 화면을 켜 둔 채 30분 ──');
  {
    const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx2.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx2.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx2.addInitScript(() => {
      window.__FAKE__ = {
        rows: {
          profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘',
                       school_id: '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c', must_change_password: false }],
          students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'a1', grade: 3, class_no: 1 }],
          reviews: [], questions: [], chats: []
        }
      };
    });
    const t = await ctx2.newPage();
    await t.clock.install();
    const terrs = []; t.on('pageerror', e => terrs.push(e.message));
    await t.goto('http://127.0.0.1:8777/teacher/');
    await t.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    await t.clock.runFor(2000);
    const 앞 = await t.evaluate(() => Object.assign({}, window.__reads));
    확인('교사 화면도 열 때 묶음 확인 한 번 · 톡 목록 · 공지는 따로 안 물음', 앞['rpc:app_badges'] === 1 && !앞.chats && !앞.announcements, JSON.stringify(앞));
    await t.clock.runFor('30:00');
    const 끝 = await t.evaluate(() => Object.assign({}, window.__reads));
    const 늘 = Object.keys(끝).reduce(function (n, k) { return n + (끝[k] - (앞[k] || 0)); }, 0);
    확인('30분 동안 서버 요청이 0번인가(초록 점 읽기 없음)', 늘 === 0, 늘 + '번 ' + JSON.stringify(끝));
    확인('학생 명단에 초록 점이 없는가', (await t.locator('.online-dot').count()) === 0);
    확인('교사 화면 콘솔 오류 없음', terrs.length === 0, terrs.join(' | '));
    await ctx2.close();
  }
  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
