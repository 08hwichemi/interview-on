// 교사 화면 — 명단 관리
//
// 엑셀에서 복사한 명단을 붙여넣으면 계정을 만듭니다.
// 실제 계정 생성과 비밀번호 초기화는 Edge Function(create-student-accounts)이 합니다.
//
// 초기 비밀번호는 모두 같은 값(INITIAL_PASSWORD)입니다. 서버가 정하고 응답으로 알려줍니다.
// 첫 로그인 때 본인 비밀번호로 반드시 바꾸게 되어 있습니다.

var rosterMode = 'student';   // 'student' | 'teacher'
var parsedRows = [];          // 미리보기에 뜬 줄
var initialPassword = '';     // 서버가 알려준 초기 비밀번호

// ── 화면 전환 ──
function setRosterMode(mode) {
  rosterMode = mode;
  document.getElementById('rm-tab-student').classList.toggle('on', mode === 'student');
  document.getElementById('rm-tab-teacher').classList.toggle('on', mode === 'teacher');

  document.getElementById('paste-box').value = '';
  document.getElementById('paste-box').placeholder = mode === 'student'
    ? '학년\t반\t학번\t이름\n3\t1\t20301\t홍길동\n3\t1\t20302\t김철수'
    : '이름\n이용휘\n박영희';

  document.getElementById('format-student').style.display = mode === 'student' ? 'block' : 'none';
  document.getElementById('format-teacher').style.display = mode === 'teacher' ? 'block' : 'none';

  clearPreview();
  loadRoster();
}

function clearPreview() {
  parsedRows = [];
  document.getElementById('preview-area').hidden = true;
  document.getElementById('result-area').hidden = true;
}

// 붙여넣은 칸만 비웁니다. 아래 "등록된 명단"은 그대로 둡니다.
function clearPaste() {
  document.getElementById('paste-box').value = '';
  document.getElementById('paste-box').focus();
  clearPreview();
}

function toast(msg, kind) {
  var el = document.getElementById('t-toast');
  el.textContent = msg;
  el.className = 't-toast show ' + (kind || '');
  setTimeout(function () { el.className = 't-toast ' + (kind || ''); }, 3000);
}

// 이름이라고 볼 수 있는지. 숫자뿐이면 이름이 아닙니다.
function isName(s) {
  return /[^\d\s]/.test(s);
}

// ── 붙여넣은 글자를 표로 ──
// 엑셀에서 복사하면 탭으로 나뉩니다. 쉼표도 받아줍니다.
function parsePaste() {
  var raw = document.getElementById('paste-box').value;
  var lines = raw.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);

  if (!lines.length) { toast('붙여넣은 내용이 없습니다.', 'bad'); return; }

  var rows = [];
  var problems = [];

  lines.forEach(function (line, idx) {
    var cells = line.split(/\t|,/).map(function (c) { return c.trim(); });

    // 머리글 줄은 건너뜁니다
    if (idx === 0 && /학번|이름|학년|성명/.test(line) && !/^\d/.test(cells[0])) return;

    var row;
    if (rosterMode === 'teacher') {
      // 교사는 이름만 (이름이 곧 아이디)
      row = { name: cells[0] };
      if (!row.name) { problems.push((idx + 1) + '번째 줄: 이름이 없습니다'); return; }
      if (!isName(row.name)) {
        problems.push((idx + 1) + '번째 줄: 이름 자리에 숫자만 있습니다 (' + row.name + ')');
        return;
      }
    } else {
      // 학생: 4칸이면 학년/반/학번/이름, 2칸이면 학번/이름
      if (cells.length >= 4) {
        row = { grade: cells[0], class_no: cells[1], student_no: cells[2], name: cells[3] };
      } else if (cells.length >= 2) {
        row = { grade: '', class_no: '', student_no: cells[0], name: cells[1] };
      } else {
        problems.push((idx + 1) + '번째 줄: 칸이 모자랍니다 (' + line + ')');
        return;
      }
      if (!/^\d+$/.test(row.student_no)) {
        problems.push((idx + 1) + '번째 줄: 학번은 숫자여야 합니다 (' + row.student_no + ')');
        return;
      }
      if (!row.name) { problems.push((idx + 1) + '번째 줄: 이름이 없습니다'); return; }
      // "3<탭>1" 처럼 뒷칸이 잘린 줄은 학번 3, 이름 1 로 읽혀 엉뚱한 계정이 생깁니다.
      // 이름이 숫자뿐이면 명단이 아니라 잘린 줄로 봅니다.
      if (!isName(row.name)) {
        problems.push((idx + 1) + '번째 줄: 이름 자리에 숫자만 있습니다 (' + line + ')');
        return;
      }
    }
    rows.push(row);
  });

  // 붙여넣은 것 안에서의 중복도 미리 잡아줍니다
  var seen = {};
  var dups = [];
  rows = rows.filter(function (r) {
    var key = rosterMode === 'teacher' ? r.name : r.student_no;
    if (seen[key]) { dups.push(key); return false; }
    seen[key] = true;
    return true;
  });
  if (dups.length) problems.push('중복된 ' + (rosterMode === 'teacher' ? '이름' : '학번') + ': ' + dups.join(', '));

  parsedRows = rows;
  renderPreview(problems);
}

function renderPreview(problems) {
  var area = document.getElementById('preview-area');
  var head = rosterMode === 'teacher'
    ? '<tr><th>이름 (=아이디)</th></tr>'
    : '<tr><th>학년</th><th>반</th><th>학번 (=아이디)</th><th>이름</th></tr>';

  var body = parsedRows.map(function (r) {
    return rosterMode === 'teacher'
      ? '<tr><td>' + esc(r.name) + '</td></tr>'
      : '<tr><td>' + esc(r.grade) + '</td><td>' + esc(r.class_no) + '</td>' +
        '<td><b>' + esc(r.student_no) + '</b></td><td>' + esc(r.name) + '</td></tr>';
  }).join('');

  document.getElementById('preview-count').textContent = parsedRows.length + '명';
  document.getElementById('preview-table').innerHTML = head + body;

  var pb = document.getElementById('preview-problems');
  if (problems.length) {
    pb.hidden = false;
    pb.innerHTML = '<b>건너뛴 줄 ' + problems.length + '개</b><ul><li>' +
      problems.map(esc).join('</li><li>') + '</li></ul>';
  } else {
    pb.hidden = true;
  }

  document.getElementById('btn-create').disabled = parsedRows.length === 0;
  area.hidden = false;
  document.getElementById('result-area').hidden = true;
}

// 이름이 그대로 화면에 들어가므로 특수문자를 막습니다.
// 따옴표까지 막아야 data-name="..." 같은 속성 안에 넣어도 안전합니다.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── 서버 부르기 ──
// Edge Function 이 4xx 를 주면 본문에 이유가 들어 있습니다.
// 그냥 res.error.message 만 보면 "non-2xx status code" 같은 쓸모없는 말만 나옵니다.
async function callAccountFn(body) {
  var res = await sb.functions.invoke('create-student-accounts', { body: body });
  if (!res.error) return { data: res.data };

  var reason = res.error.message;
  try {
    var ctx = res.error.context;
    if (ctx && typeof ctx.json === 'function') {
      var payload = await ctx.json();
      if (payload && payload.error) reason = payload.error;
    }
  } catch (e) { /* 본문을 못 읽으면 원래 메시지를 씁니다 */ }
  return { error: reason };
}

// ── 계정 만들기 ──
async function createAccounts() {
  if (!parsedRows.length) return;

  var btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = '만드는 중...';

  var res = await callAccountFn({ role: rosterMode, people: parsedRows });

  btn.disabled = false;
  btn.textContent = '계정 만들기';

  if (res.error) { toast('실패: ' + res.error, 'bad'); return; }

  renderResult(res.data);
  loadRoster();
}

function renderResult(data) {
  var created = data.created || [];
  var skipped = data.skipped || [];
  initialPassword = data.initial_password || initialPassword;

  document.getElementById('result-summary').innerHTML =
    '<b>' + created.length + '명</b> 계정을 만들었습니다.' +
    (skipped.length ? ' <span class="muted">(' + skipped.length + '명 건너뜀)</span>' : '');

  // 초기 비밀번호가 모두 같으므로 한 줄이면 충분합니다.
  // 예전처럼 사람마다 다른 비밀번호를 표로 뽑아 나눠줄 일이 없습니다.
  document.getElementById('result-password').innerHTML =
    '초기 비밀번호는 모두 <b class="pw">' + esc(initialPassword) + '</b> 입니다. ' +
    '첫 로그인 때 본인 비밀번호로 바꾸게 되어 있습니다.';

  document.getElementById('result-table').innerHTML =
    '<tr><th>아이디</th><th>이름</th></tr>' +
    created.map(function (c) {
      return '<tr><td><b>' + esc(c.login_id) + '</b></td><td>' + esc(c.name) + '</td></tr>';
    }).join('');

  var sk = document.getElementById('result-skipped');
  if (skipped.length) {
    sk.hidden = false;
    sk.innerHTML = '<b>건너뛴 사람</b><ul><li>' + skipped.map(function (s) {
      return esc(s.login_id || s.name) + ' — ' + esc(s.reason);
    }).join('</li><li>') + '</li></ul>';
  } else {
    sk.hidden = true;
  }

  document.getElementById('preview-area').hidden = true;
  document.getElementById('result-area').hidden = false;
  document.getElementById('paste-box').value = '';
  window.scrollTo({ top: document.getElementById('result-area').offsetTop - 80, behavior: 'smooth' });
}

// ── 비밀번호 초기화 ──
// 비밀번호를 잊은 사람을 초기 비밀번호로 되돌립니다.
// 되돌린 뒤에는 다음 로그인 때 다시 바꾸게 됩니다.
async function resetPassword(loginId, name, btn) {
  if (!confirm(name + '(' + loginId + ') 님의 비밀번호를 초기 비밀번호로 되돌릴까요?')) return;

  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '되돌리는 중...';

  var res = await callAccountFn({ action: 'reset', login_ids: [loginId] });

  btn.disabled = false;
  btn.textContent = label;

  if (res.error) { toast('실패: ' + res.error, 'bad'); return; }

  var failed = res.data.failed || [];
  if (failed.length) { toast('실패: ' + failed[0].reason, 'bad'); return; }

  initialPassword = res.data.initial_password || initialPassword;
  toast(name + ' 님의 비밀번호를 ' + initialPassword + ' 으로 되돌렸습니다.', 'ok');
  loadRoster();
}

// 표의 버튼에서 부릅니다. 이름에 따옴표가 들어가도 깨지지 않게 data- 속성으로 넘깁니다.
function onResetClick(btn) {
  resetPassword(btn.dataset.loginId, btn.dataset.name, btn);
}

// ── 등록된 명단 보기 ──
async function loadRoster() {
  var box = document.getElementById('roster-list');
  box.innerHTML = '<p class="muted">불러오는 중...</p>';

  if (rosterMode === 'teacher') {
    const { data, error } = await sb
      .from('profiles')
      .select('login_id, name, role, must_change_password')
      .in('role', ['teacher', 'admin'])
      .order('name');

    if (error) { box.innerHTML = '<p class="muted">불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="muted">등록된 선생님이 없습니다.</p>'; return; }

    box.innerHTML = '<table class="t-table"><tr><th>아이디</th><th>이름</th><th>역할</th><th>비밀번호</th><th></th></tr>' +
      data.map(function (p) {
        return '<tr><td><b>' + esc(p.login_id) + '</b></td><td>' + esc(p.name) + '</td>' +
               '<td>' + (p.role === 'admin' ? '관리자' : '교사') + '</td>' +
               '<td>' + (p.must_change_password
                 ? '<span class="chip warn">초기 비밀번호</span>'
                 : '<span class="chip ok">변경 완료</span>') + '</td>' +
               '<td>' + resetButton(p.login_id, p.name) + '</td></tr>';
      }).join('') + '</table>';
    return;
  }

  const { data, error } = await sb
    .from('students')
    .select('student_no, name, grade, class_no, auth_user_id')
    .order('grade').order('class_no').order('student_no');

  if (error) { box.innerHTML = '<p class="muted">불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
  if (!data.length) { box.innerHTML = '<p class="muted">등록된 학생이 없습니다.</p>'; return; }

  box.innerHTML = '<table class="t-table"><tr><th>학년</th><th>반</th><th>학번</th><th>이름</th><th>계정</th><th></th></tr>' +
    data.map(function (s) {
      return '<tr><td>' + esc(s.grade) + '</td><td>' + esc(s.class_no) + '</td>' +
             '<td><b>' + esc(s.student_no) + '</b></td><td>' + esc(s.name) + '</td>' +
             '<td>' + (s.auth_user_id
               ? '<span class="chip ok">있음</span>'
               : '<span class="chip">없음</span>') + '</td>' +
             // 계정이 없는 학생은 되돌릴 비밀번호도 없습니다
             '<td>' + (s.auth_user_id ? resetButton(s.student_no, s.name) : '') + '</td></tr>';
    }).join('') + '</table>';
}

// 명단 각 줄 오른쪽에 붙는 "비밀번호 초기화" 버튼
function resetButton(loginId, name) {
  return '<button class="t-mini" onclick="onResetClick(this)"' +
         ' data-login-id="' + esc(loginId) + '" data-name="' + esc(name) + '">비밀번호 초기화</button>';
}
