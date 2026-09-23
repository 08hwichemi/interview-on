// 관리자 공지 — 표 하나(announcements, active 로 «지금 뜨는 줄» 표시)로 합친 방식
// 새 공지로 올리기 · 줄마다 수정(그 자리에서 바로) · 공지로 올리기(재활성) · 지우기
// · 학생·교사는 🔔 로 지금 공지·지난 공지를 봄 · 안읽음이면 배지+토스트
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

  console.log('\n── 관리자: 새 공지로 올리기 ──');
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
    확인('입력칸이 빈 채로 시작하는가(수정 아님, 새로 쓰는 칸)',
         await p.evaluate(() => document.getElementById('notice-content').value === ''));

    await p.fill('#notice-content', '이번 주까지 답안 연습장에 자기소개 초안을 써 오세요.');
    await p.fill('#notice-link', 'forms.gle/abc123');
    await p.waitForTimeout(150);
    확인('미리보기에 내용이 그대로 보이는가',
         (await p.textContent('#notice-preview')).indexOf('자기소개 초안') > -1);
    확인('미리보기 링크에도 https:// 가 미리 붙는가(실제로 뜰 모양 그대로)',
         await p.evaluate(() => document.querySelector('#notice-preview a').getAttribute('href') === 'https://forms.gle/abc123'));

    // 끊어질 자리(/·?·=) 가 거의 없는 긴 링크(구글 드라이브 공유 주소 같은)를 넣어도
    // 작은 창(480px) 밖으로 미리보기가 밀고 나가면 안 됩니다.
    await p.fill('#notice-link', 'https://drive.google.com/' + 'a'.repeat(80));
    await p.waitForTimeout(150);
    확인('긴 링크를 넣어도 미리보기가 창 밖으로 밀고 나가지 않는가',
         await p.evaluate(() => {
           var modal = document.querySelector('.notice-modal');
           return modal.scrollWidth <= modal.clientWidth + 1;
         }));
    await p.fill('#notice-link', 'forms.gle/abc123');   // 저장은 원래 값으로

    await p.click('button:has-text("새 공지로 올리기")');
    await p.waitForTimeout(300);

    var rows = await 표(p, 'announcements');
    확인('서버에 한 줄로 올라갔는가', rows.length === 1, JSON.stringify(rows));
    확인('바로 active 로 올라가는가', rows[0].active === true);
    확인('학교로 저장되는가', rows[0].school_id === SCH);
    확인('링크가 http 스킴 없이 적어도 그대로 저장되는가(다듬기는 보여줄 때 함)',
         rows[0].link === 'forms.gle/abc123', rows[0].link);
    확인('올리고 나면 입력칸이 다시 비는가(다음에 또 새로 쓸 수 있게)',
         await p.evaluate(() => document.getElementById('notice-content').value === ''));
    확인('창이 닫히지 않고 그대로(같은 창에서 계속 관리)',
         await p.evaluate(() => document.getElementById('notice-modal-overlay').style.display === 'flex'));
    확인('지난 공지 목록에 방금 올린 것이 «지금 뜨는 중» 표시로 보이는가',
         (await p.textContent('#notice-history')).indexOf('지금 뜨는 중') > -1);

    console.log('\n── 줄마다 수정 — 그 자리에서 바로 고침(새 줄 안 생김, active 면 즉시 반영) ──');
    var row1 = p.locator('.notice-history-row', { hasText: '자기소개 초안' });
    var id1 = await row1.getAttribute('data-id');
    await row1.locator('button:has-text("수정")').click();
    await p.waitForTimeout(150);
    확인('수정 칸이 원래 내용으로 채워지는가',
         (await p.inputValue('#nh-content-' + id1)).indexOf('자기소개 초안') > -1);
    await p.fill('#nh-content-' + id1, '이번 주까지 자기소개 초안을 반드시 제출하세요.');
    await p.click('#nh-edit-' + id1 + ' button:has-text("저장")');
    await p.waitForTimeout(300);
    var rowsAfterEdit = await 표(p, 'announcements');
    확인('같은 줄(같은 id) 그대로 고쳐지는가 — 새 줄이 안 생김', rowsAfterEdit.length === 1);
    확인('내용이 고쳐지는가', rowsAfterEdit[0].content.indexOf('반드시 제출') > -1);
    확인('active 상태는 그대로인가(수정만 했을 뿐 끄거나 새로 올린 게 아니므로)',
         rowsAfterEdit[0].active === true);

    console.log('\n── 새 공지를 또 올리면 이전 것은 자동으로 꺼진다(active 가 하나로 유지) ──');
    await p.fill('#notice-content', '다음 주엔 실전 모의고사가 있습니다.');
    await p.click('button:has-text("새 공지로 올리기")');
    await p.waitForTimeout(300);
    var rows2 = await 표(p, 'announcements');
    확인('두 줄이 되는가', rows2.length === 2, JSON.stringify(rows2));
    확인('새 줄만 active 인가(한 번에 하나만)',
         rows2.filter(function (r) { return r.active; }).length === 1 &&
         rows2.filter(function (r) { return r.active; })[0].content.indexOf('모의고사') > -1);

    console.log('\n── 예전 공지도 «공지로 올리기» 로 다시 활성화할 수 있다(내용은 안 바뀜) ──');
    await p.waitForTimeout(200);
    var row2 = p.locator('.notice-history-row', { hasText: '반드시 제출' });
    확인('active 아닌 줄에는 «공지로 올리기» 단추가 보이는가',
         await row2.locator('button:has-text("공지로 올리기")').isVisible());
    await row2.locator('button:has-text("공지로 올리기")').click();
    await p.waitForTimeout(300);
    var rows3 = await 표(p, 'announcements');
    확인('그 줄이 다시 active 가 되는가',
         rows3.filter(function (r) { return r.active; })[0].content.indexOf('반드시 제출') > -1);
    확인('내용 자체는 안 바뀌었는가(재활성만 한 것)',
         rows3.length === 2 && rows3.some(function (r) { return r.content.indexOf('모의고사') > -1 && !r.active; }));

    console.log('\n── 지금 공지 끄기 — 기록은 남고 배너만 꺼진다 ──');
    p.once('dialog', d => d.accept());
    await p.click('#btn-notice-off');
    await p.waitForTimeout(300);
    var rows4 = await 표(p, 'announcements');
    확인('active 인 줄이 하나도 없는가(배너 꺼짐)', !rows4.some(function (r) { return r.active; }));
    확인('그래도 기록 두 줄은 그대로 남아 있는가', rows4.length === 2);

    console.log('\n── 줄 지우기 — 완전 삭제 ──');
    p.once('dialog', d => d.accept());
    await p.locator('.notice-history-row', { hasText: '모의고사' }).locator('button:has-text("지우기")').click();
    await p.waitForTimeout(300);
    확인('그 줄만 서버에서 사라지는가',
         (await 표(p, 'announcements')).length === 1 &&
         !(await 표(p, 'announcements')).some(function (r) { return r.content.indexOf('모의고사') > -1; }));

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
    await p.click('button:has-text("새 공지로 올리기")');
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

  console.log('\n── 교사 홈: 🔔 단추에 안읽음 점, 눌러 보면 지금 공지 · 지난 공지 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 1400, height: 900 }, {
      profile: { id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희' },
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희',
                     school_id: SCH, must_change_password: false }],
        students: [],
        announcements: [
          { id: 'a1', school_id: SCH, content: '지난주 안내였습니다.', link: null, active: false,
            created_by_name: '이용휘', created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z' },
          { id: 'a2', school_id: SCH, content: '내일 3교시는 모의면접입니다.', link: null, active: true,
            created_by_name: '이용휘', created_at: '2026-09-23T00:00:00Z', updated_at: '2026-09-23T00:00:00Z' }
        ]
      }
    });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.waitForTimeout(300);
    확인('홈 화면이 공지 상자로 밀려나지 않는가(더는 자리를 차지하지 않음)',
         await p.evaluate(() => document.getElementById('notice-box') === null));
    확인('🔔 단추에 안읽음 점이 켜져 있는가', await p.evaluate(() => !document.getElementById('notice-dot').hidden));
    확인('처음 들어왔을 때 토스트로도 알려주는가',
         (await p.evaluate(() => document.getElementById('toast').textContent)).indexOf('새 공지') > -1);

    await p.click('#notice-open');
    await p.waitForTimeout(200);
    확인('창이 뜨는가', await p.evaluate(() => document.getElementById('notice-panel-overlay').style.display === 'flex'));
    var body = await p.textContent('#notice-panel-body');
    확인('지금 공지가 보이는가', body.indexOf('내일 3교시는 모의면접입니다') > -1);
    확인('지난 공지 목록도 같이 보이는가(지난주 것까지)', body.indexOf('지난주 안내') > -1);
    확인('열어 보면 안읽음 점이 꺼지는가', await p.evaluate(() => document.getElementById('notice-dot').hidden));

    await p.click('#notice-panel-overlay .close-btn');
    await p.reload(); await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(300);
    확인('한 번 읽은 공지는 새로고침해도 다시 안읽음 점이 안 뜨는가(같은 updated_at)',
         await p.evaluate(() => document.getElementById('notice-dot').hidden));

    // 관리자가 (active 줄을) 고쳤다고 가정 — updated_at 이 달라지면 다시 «안읽음» 이 되어야 합니다.
    await p.evaluate(() => { document.getElementById('toast').textContent = ''; });   // 이전 토스트 흔적 지움
    await p.evaluate(() => {
      var row = window.__T.announcements.find(function (r) { return r.active; });
      row.content = '내일 3교시는 모의면접 → 4교시로 변경!';
      row.updated_at = '2026-09-24T00:00:00Z';
      return noticeCheckBadge();
    });
    await p.waitForTimeout(200);
    확인('고친 공지는 다시 안읽음 점이 뜨는가', await p.evaluate(() => !document.getElementById('notice-dot').hidden));
    확인('고친 공지도 토스트로 다시 알려주는가',
         (await p.evaluate(() => document.getElementById('toast').textContent)).indexOf('새 공지') > -1);

    // 열어 본 뒤(=읽음 처리한 뒤)에는, 계속 확인해도(3분마다·탭 복귀 시) 다시 안 띄웁니다.
    await p.click('#notice-open'); await p.click('#notice-panel-overlay .close-btn');
    await p.evaluate(() => { document.getElementById('toast').textContent = ''; });
    await p.evaluate(() => noticeCheckBadge());
    await p.waitForTimeout(200);
    확인('읽고 나면 같은 공지로는 토스트가 또 안 뜨는가(성가시지 않게)',
         (await p.evaluate(() => document.getElementById('toast').textContent)) === '');

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 학생 홈: 5개 메뉴 버튼 자리를 그대로 두고, 🔔 로 공지를 본다 ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 420, height: 900 }, {
      profile: { id: 'u1', role: 'student', name: '고다윤', login_id: '30101' },
      rows: {
        profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101',
                     school_id: SCH, must_change_password: false }],
        students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
        reviews: [], questions: [], practice_categories: [], practice_answers: [], practice_comments: [],
        announcements: [{ id: 'a1', school_id: SCH, content: '설문에 응답해 주세요.', link: 'forms.gle/xyz',
                          active: true, created_by_name: '이용휘',
                          created_at: '2026-09-23T00:00:00Z', updated_at: '2026-09-23T00:00:00Z' }]
      }
    });
    await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active');
    await p.waitForTimeout(300);
    확인('홈 메뉴 버튼 5개가 그대로 온전한가(공지 상자가 안 끼어듦)',
         (await p.locator('.home-grid .menu-btn').count()) === 5);
    확인('🔔 단추에 안읽음 점이 켜져 있는가', await p.evaluate(() => !document.getElementById('notice-dot').hidden));
    확인('학생 화면도 토스트로 알려주는가',
         (await p.evaluate(() => document.getElementById('toast-message').textContent)).indexOf('새 공지') > -1);

    await p.click('#notice-open');
    await p.waitForTimeout(200);
    확인('링크에 https:// 가 붙어서 걸리는가',
         await p.evaluate(() => document.querySelector('#notice-panel-body a').getAttribute('href') === 'https://forms.gle/xyz'));

    // 구글 드라이브 링크처럼 끊어질 자리(/·?·=)가 거의 없는 긴 주소도 좁은 휴대폰
    // 화면(420px) 밖으로 밀려나지 않아야 합니다 — overflow-wrap 이 없으면 잘려 보입니다.
    await p.evaluate(() => {
      window.__T.announcements[0].link = 'https://drive.google.com/' + 'a'.repeat(80);
      return noticeOpenPanel();
    });
    await p.waitForTimeout(200);
    확인('끊어질 자리 없는 긴 링크도 화면을 밀고 나가지 않는가',
         await p.evaluate(() => document.documentElement.scrollWidth <= 420),
         'scrollWidth ' + await p.evaluate(() => document.documentElement.scrollWidth));

    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n── 일반 교사도 지난 공지를 읽을 수 있다(관리자 전용이 아님) ──');
  {
    const { ctx, p, errs } = await 열기(b, { width: 1400, height: 900 }, {
      profile: { id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희' },
      rows: {
        profiles: [{ id: 'u1', role: 'teacher', name: '박영희', login_id: '박영희',
                     school_id: SCH, must_change_password: false }],
        students: [],
        announcements: [{ id: 'a1', school_id: SCH, content: '예전 공지 내용', link: null, active: false,
                          created_by_name: '이용휘', created_at: '2026-09-10T00:00:00Z', updated_at: '2026-09-10T00:00:00Z' }]
      }
    });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.click('#notice-open');
    await p.waitForTimeout(200);
    확인('지금 공지가 없어도 지난 공지는 보이는가',
         (await p.textContent('#notice-panel-body')).indexOf('예전 공지 내용') > -1);
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
