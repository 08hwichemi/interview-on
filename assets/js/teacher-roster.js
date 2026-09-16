// 교사 화면 — 명단 관리
//
// 엑셀에서 복사한 명단을 붙여넣으면 계정을 만들고 초기 비밀번호를 돌려줍니다.
// 실제 계정 생성은 Edge Function(create-student-accounts)이 합니다.
// 초기 비밀번호는 서버 어디에도 저장되지 않으므로, 이 화면을 벗어나면 다시 볼 수 없습니다.

var rosterMode = 'student';   // 'student' | 'teacher'
var parsedRows = [];          // 미리보기에 뜬 줄
var lastCreated = [];         // 방금 만든 계정 + 초기 비밀번호

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

function toast(msg, kind) {
  var el = document.getElementById('t-toast');
  el.textContent = msg;
  el.className = 't-toast show ' + (kind || '');
  setTimeout(function () { el.className = 't-toast ' + (kind || ''); }, 3000);
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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 계정 만들기 ──
async function createAccounts() {
  if (!parsedRows.length) return;

  var btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = '만드는 중...';

  var res = await sb.functions.invoke('create-student-accounts', {
    body: { role: rosterMode, people: parsedRows }
  });

  btn.disabled = false;
  btn.textContent = '계정 만들기';

  if (res.error) {
    // Edge Function 이 4xx 를 주면 본문에 이유가 들어 있습니다
    var reason = res.error.message;
    try {
      var ctx = res.error.context;
      if (ctx && typeof ctx.json === 'function') {
        var body = await ctx.json();
        if (body && body.error) reason = body.error;
      }
    } catch (e) { /* 본문을 못 읽으면 원래 메시지를 씁니다 */ }
    toast('실패: ' + reason, 'bad');
    return;
  }

  lastCreated = res.data.created || [];
  renderResult(res.data);
  loadRoster();
}

function renderResult(data) {
  var created = data.created || [];
  var skipped = data.skipped || [];

  document.getElementById('result-summary').innerHTML =
    '<b>' + created.length + '명</b> 계정을 만들었습니다.' +
    (skipped.length ? ' <span class="muted">(' + skipped.length + '명 건너뜀)</span>' : '');

  document.getElementById('result-table').innerHTML =
    '<tr><th>아이디</th><th>이름</th><th>초기 비밀번호</th></tr>' +
    created.map(function (c) {
      return '<tr><td><b>' + esc(c.login_id) + '</b></td><td>' + esc(c.name) +
             '</td><td class="pw">' + esc(c.password) + '</td></tr>';
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

// ── 초기 비밀번호 내보내기 ──
// 서버에 저장돼 있지 않으므로 이 화면을 벗어나면 다시 볼 수 없습니다.
function copyPasswords() {
  var text = lastCreated.map(function (c) {
    return c.login_id + '\t' + c.name + '\t' + c.password;
  }).join('\n');
  navigator.clipboard.writeText('아이디\t이름\t초기 비밀번호\n' + text)
    .then(function () { toast('복사했습니다. 엑셀에 붙여넣으세요.', 'ok'); })
    .catch(function () { toast('복사에 실패했습니다.', 'bad'); });
}

function downloadPasswords() {
  var rows = [['아이디', '이름', '초기 비밀번호']].concat(
    lastCreated.map(function (c) { return [c.login_id, c.name, c.password]; })
  );
  var csv = rows.map(function (r) {
    return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\r\n');

  // 엑셀이 한글을 깨뜨리지 않도록 BOM 을 붙입니다
  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '초기비밀번호_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
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

    box.innerHTML = '<table class="t-table"><tr><th>아이디</th><th>이름</th><th>역할</th><th>비밀번호</th></tr>' +
      data.map(function (p) {
        return '<tr><td><b>' + esc(p.login_id) + '</b></td><td>' + esc(p.name) + '</td>' +
               '<td>' + (p.role === 'admin' ? '관리자' : '교사') + '</td>' +
               '<td>' + (p.must_change_password
                 ? '<span class="chip warn">초기 비밀번호</span>'
                 : '<span class="chip ok">변경 완료</span>') + '</td></tr>';
      }).join('') + '</table>';
    return;
  }

  const { data, error } = await sb
    .from('students')
    .select('student_no, name, grade, class_no, auth_user_id')
    .order('grade').order('class_no').order('student_no');

  if (error) { box.innerHTML = '<p class="muted">불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
  if (!data.length) { box.innerHTML = '<p class="muted">등록된 학생이 없습니다.</p>'; return; }

  box.innerHTML = '<table class="t-table"><tr><th>학년</th><th>반</th><th>학번</th><th>이름</th><th>계정</th></tr>' +
    data.map(function (s) {
      return '<tr><td>' + esc(s.grade) + '</td><td>' + esc(s.class_no) + '</td>' +
             '<td><b>' + esc(s.student_no) + '</b></td><td>' + esc(s.name) + '</td>' +
             '<td>' + (s.auth_user_id
               ? '<span class="chip ok">있음</span>'
               : '<span class="chip">없음</span>') + '</td></tr>';
    }).join('') + '</table>';
}
