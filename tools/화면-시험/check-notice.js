// 관리자 공지 — 관리자가 올리기·고치기·지우기, 학생·교사 홈에 뜨고 닫으면 다시 안 뜨는가
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }

const SCH = '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c';
const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);

function 열기(b, viewport, fake) {
  return (async () => {
    const ctx = await b.newContext({ viewport });
    await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
    await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.route('**/xlsx*', r => r.fulfill({ contentType: 'application/javascript', body: 'window.XLSX={};' }));
    await ctx.addInitScript(f => { window.__FAKE__ = f; }, fake);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    return { ctx, p, errs };
  })();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  console.log('\n── 관리자: 공지 올리기 · 다시 열면 채워져 있음 · 지우기 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 1100, height: 900 }, {
      profile: { id: 'u1', role: 'admin', name: '이용휘', login_id: '이용휘' },
      rows: {
        profiles: [{ id: 'u1', role: 'admin', name: '이용휘', login_id: '이용휘',
                     school_id: SCH, must_change_password: false }]
      }
    });
    await p.goto('http://127.0.0.1:8777/admin/'); await p.waitForSelector('#app:not([hidden])');

    await p.click('button:has-text("📢 공지")');
    await p.waitForTimeout(200);
    확인('창이 뜨는가(빈 채로 시작)', await p.evaluate(() => document.getElementById('notice-content').value === ''));

    await p.fill('#notice-content', '이번 주까지 답안 연습장에 자기소개 초안을 써 오세요.');
    await p.fill('#notice-link', 'forms.gle/abc123');
    await p.waitForTimeout(150);
    확인('미리보기에 내용이 그대로 보이는가',
         (await p.textContent('#notice-preview')).indexOf('자기소개 초안') > -1);
    확인('미리보기 링크에도 https:// 가 미리 붙는가(실제로 뜰 모양 그대로)',
         await p.evaluate(() => document.querySelector('#notice-preview a').getAttribute('href') === 'https://forms.gle/abc123'));

    await p.click('button:has-text("올리기")');
    await p.waitForTimeout(300);

    var rows = await 표(p, 'announcements');
    확인('서버에 한 줄로 올라갔는가', rows.length === 1, JSON.stringify(rows));
    확인('학교로 저장되는가', rows[0].school_id === SCH);
    확인('링크가 http 스킴 없이 적어도 그대로 저장되는가(다듬기는 보여줄 때 함)',
         rows[0].link === 'forms.gle/abc123', rows[0].link);
    확인('창이 닫히는가', await p.evaluate(() => document.getElementById('notice-modal-overlay').style.display !== 'flex'));

    await p.click('button:has-text("📢 공지")');
    await p.waitForTimeout(200);
    확인('다시 열면 저장된 내용이 채워져 있는가',
         await p.evaluate(() => document.getElementById('notice-content').value.indexOf('자기소개 초안') > -1));

    p.once('dialog', d => d.accept());
    await p.click('#btn-notice-clear');
    await p.waitForTimeout(300);
    확인('지우면 표에서 사라지는가', (await 표(p, 'announcements')).length === 0);

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 관리자는 면접(교사) 화면에서도 바로 공지를 올릴 수 있다 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 1400, height: 900 }, {
      profile: { id: 'u1', role: 'admin', name: '이용휘', login_id: '이용휘' },
      rows: {
        profiles: [{ id: 'u1', role: 'admin', name: '이용휘', login_id: '이용휘',
                     school_id: SCH, must_change_password: false }],
        students: []
      }
    });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    확인('공지 단추가 보이는가(관리자)', await p.evaluate(() => !document.getElementById('notice-admin-btn').hidden));

    await p.click('#notice-admin-btn');
    await p.waitForTimeout(200);
    await p.fill('#notice-content', '오늘 6교시 대강당에서 모의면접 있습니다.');
    await p.click('button:has-text("올리기")');
    await p.waitForTimeout(300);
    var rows = await 표(p, 'announcements');
    확인('면접 화면에서 올린 것도 서버에 저장되는가', rows.length === 1 && rows[0].content.indexOf('대강당') > -1,
         JSON.stringify(rows));
    확인('올린 사람 이름이 남는가(관리자 이름)', rows[0].created_by_name === '이용휘', rows[0].created_by_name);

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 일반 교사에게는 공지 단추가 안 보인다 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 1400, height: 900 }, {
      profile: { id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희' },
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희',
                     school_id: SCH, must_change_password: false }],
        students: []
      }
    });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    확인('공지 단추가 숨겨져 있는가(일반 교사)', await p.evaluate(() => document.getElementById('notice-admin-btn').hidden));
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 교사 홈: 공지가 뜨고, 닫으면 같은 공지는 다시 안 뜬다 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 1400, height: 900 }, {
      profile: { id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희' },
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희',
                     school_id: SCH, must_change_password: false }],
        students: [],
        announcements: [{ school_id: SCH, content: '내일 3교시는 모의면접입니다.',
                          link: null, updated_at: '2026-09-23T00:00:00Z' }]
      }
    });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.waitForTimeout(300);
    확인('공지 상자가 뜨는가', await p.evaluate(() => !document.getElementById('notice-box').hidden));
    확인('내용이 보이는가',
         (await p.textContent('#notice-box')).indexOf('모의면접') > -1);

    await p.click('#notice-box .notice-x');
    확인('닫으면 숨는가', await p.evaluate(() => document.getElementById('notice-box').hidden));

    await p.reload(); await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(300);
    확인('새로고침해도 같은 공지는 다시 안 뜨는가(localStorage 기억)',
         await p.evaluate(() => document.getElementById('notice-box').hidden));

    // 관리자가 새 공지로 고쳤다고 가정 — updated_at 이 달라지면 다시 떠야 합니다.
    await p.evaluate(() => {
      window.__T.announcements[0].content = '내일 3교시는 모의면접 → 4교시로 변경!';
      window.__T.announcements[0].updated_at = '2026-09-24T00:00:00Z';
      return noticeCheck();
    });
    await p.waitForTimeout(200);
    확인('새 공지(다른 updated_at)는 다시 뜨는가',
         await p.evaluate(() => !document.getElementById('notice-box').hidden));
    확인('바뀐 내용이 보이는가',
         (await p.textContent('#notice-box')).indexOf('4교시로 변경') > -1);

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 학생 홈: 공지가 뜨고 링크에 https:// 가 붙는가 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 420, height: 900 }, {
      profile: { id: 'u1', role: 'student', name: '고다윤', login_id: '30101' },
      rows: {
        profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                     school_id: SCH, must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
        reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: [],
        announcements: [{ school_id: SCH, content: '설문에 응답해 주세요.',
                          link: 'forms.gle/xyz', updated_at: '2026-09-23T00:00:00Z' }]
      }
    });
    await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active');
    await p.waitForTimeout(300);
    확인('공지 상자가 뜨는가', await p.evaluate(() => !document.getElementById('notice-box').hidden));
    확인('링크에 https:// 가 붙어서 걸리는가',
         await p.evaluate(() => document.querySelector('#notice-box a').getAttribute('href') === 'https://forms.gle/xyz'));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
