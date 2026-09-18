// 관리자 화면 — 명단 관리
//
// 붙여넣거나 엑셀 파일을 고르면 곧바로 계정을 만듭니다.
// 실제 계정 생성·초기화·삭제는 Edge Function(create-student-accounts)이 합니다.
//
// 초기 비밀번호는 모두 같은 값입니다. 첫 로그인 때 본인 비밀번호로 반드시 바꾸게 되어 있고,
// 잊은 사람은 명단 오른쪽 «비번초기화» 로 되돌립니다.

// ⚠️ Edge Function 의 INITIAL_PASSWORD_STUDENT · INITIAL_PASSWORD_TEACHER 와 같아야 합니다.
//    여기는 단추에 적어 보여주기만 하는 값이고, 실제로 정하는 곳은 서버입니다.
//    학생과 선생님이 서로 다릅니다.
var INITIAL_PW_STUDENT = '111111';
var INITIAL_PW_TEACHER = '123456';

// 지금 보고 있는 명단(학생/교사)에 맞는 초기 비밀번호
function initialPw(mode) {
  return (mode || rosterMode) === 'student' ? INITIAL_PW_STUDENT : INITIAL_PW_TEACHER;
}

var rosterMode = 'student';   // 'student' | 'teacher' | 'data'
var isAdmin = false;          // 로그인 확인이 끝나면 admin/index.html 이 채웁니다
var myLoginId = '';           // 지금 로그인한 관리자의 아이디 (같은 곳에서 채웁니다)
var pickedClass = '';         // 학생 명단에서 고른 반 ('' 이면 전체)
var rosterCache = [];         // 방금 불러온 명단

// ── 화면 전환 ──
function setRosterMode(mode) {
  rosterMode = mode;
  pickedClass = '';

  document.getElementById('tab-student').setAttribute('aria-selected', mode === 'student');
  document.getElementById('tab-teacher').setAttribute('aria-selected', mode === 'teacher');
  document.getElementById('tab-data').setAttribute('aria-selected', mode === 'data');

  // «데이터 관리» 는 명단 화면과 아예 다른 칸입니다. 서로 감춥니다.
  document.getElementById('add-panel').hidden    = (mode === 'data');
  document.getElementById('roster-panel').hidden = (mode === 'data');
  document.getElementById('data-panel').hidden   = (mode !== 'data');
  if (mode === 'data') { loadDataCounts(); return; }

  var student = mode === 'student';
  document.getElementById('add-title').textContent = student ? '학생 추가 등록' : '교사 추가 등록';
  document.getElementById('roster-title').textContent = student ? '등록된 학생 명단' : '교직원 계정';
  document.getElementById('excel-box').hidden = !student;

  document.getElementById('add-hint').innerHTML = student
    ? '엑셀 파일을 고르거나, 아래 칸에 <b>한 줄에 한 명씩</b> 붙여넣으세요. ' +
      '<b>학번 이름</b> / <b>반 번호 이름</b> / <b>학년 반 번호 이름</b> 다 됩니다. ' +
      '학번이 없으면 <b>학년+반(2자리)+번호(2자리)</b> 로 만듭니다 (3학년 2반 15번 → <b>30215</b>).'
    : '<b>이름만</b> 한 줄에 한 명씩 적으세요. 이름이 곧 아이디입니다. ' +
      '같은 이름이 두 분이면 <b>김영수2</b> 처럼 구분해 주세요.';

  var box = document.getElementById('paste-box');
  box.value = '';
  box.placeholder = student
    ? '30201 홍길동\n30202 김철수\n30203 이영희'
    : '이용휘\n박영희\n최수진';

  document.getElementById('btn-create').textContent = '등록하기 (초기비번 ' + initialPw(mode) + ')';
  document.getElementById('excel-name').textContent = '';
  document.getElementById('add-problems').hidden = true;
  document.getElementById('add-result').hidden = true;

  loadRoster();
}

function toast(msg, kind) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (kind || '');
  setTimeout(function () { el.className = 'toast ' + (kind || ''); }, 3000);
}

// 이름이 그대로 화면에 들어가므로 특수문자를 막습니다.
// 따옴표까지 막아야 data-name="..." 같은 속성 안에 넣어도 안전합니다.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }

// 이름이라고 볼 수 있는지. 숫자뿐이면 이름이 아닙니다.
function isName(s) { return /[^\d\s]/.test(s); }

// ── 엑셀 파일 읽기 ──
// 읽은 내용을 아래 칸에 글자로 풀어 넣습니다. 그래야 선생님이 눈으로 확인하고
// 틀린 줄을 고친 뒤 등록할 수 있습니다. 붙여넣기와 등록 경로가 하나로 합쳐집니다.
function readExcelFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  document.getElementById('excel-name').textContent = file.name + ' 읽는 중...';

  if (!window.XLSX) {
    document.getElementById('excel-name').textContent = '';
    toast('엑셀을 읽는 기능을 불러오지 못했습니다. 붙여넣기를 써 주세요.', 'bad');
    return;
  }

  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('엑셀 안에서 시트를 찾지 못했습니다.');

      // header:1 → 칸을 그대로 2차원 배열로. 머리글 이름을 짐작하지 않습니다.
      var grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
      var lines = grid
        .map(function (row) {
          return row.map(function (c) { return String(c == null ? '' : c).trim(); })
                    .filter(function (c) { return c !== ''; })
                    .join('\t');
        })
        .filter(Boolean);

      if (!lines.length) throw new Error('내용이 있는 줄을 찾지 못했습니다.');

      document.getElementById('paste-box').value = lines.join('\n');
      document.getElementById('excel-name').textContent = file.name + ' — ' + lines.length + '줄';
      toast('엑셀을 읽었습니다. 내용을 확인하고 등록하세요.', 'ok');
    } catch (err) {
      document.getElementById('excel-name').textContent = '';
      toast('엑셀을 읽지 못했습니다: ' + (err.message || '') , 'bad');
    }
    event.target.value = '';   // 같은 파일을 다시 골라도 열리도록
  };
  reader.onerror = function () {
    document.getElementById('excel-name').textContent = '';
    toast('파일을 여는 데 실패했습니다.', 'bad');
  };
  reader.readAsArrayBuffer(file);
}

// ── 적어 넣은 것을 사람 목록으로 ──
function parsePeople() {
  var raw = document.getElementById('paste-box').value;
  var grade = document.getElementById('grade-pick').value;
  var lines = raw.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);

  var people = [];
  var problems = [];

  lines.forEach(function (line, idx) {
    var no = idx + 1;
    // 엑셀은 탭, 손으로 친 것은 빈칸이나 쉼표로 나뉩니다. 다 받아줍니다.
    var cells = line.split(/[\t,]|\s{1,}/).map(function (c) { return c.trim(); }).filter(Boolean);
    if (!cells.length) return;

    // 머리글 줄은 건너뜁니다
    if (/^(학년|학번|번호|반|이름|성명)$/.test(cells[0])) return;

    if (rosterMode === 'teacher') {
      var tname = cells[0];
      if (!isName(tname)) { problems.push(no + '번째 줄: 이름 자리에 숫자만 있습니다 (' + line + ')'); return; }
      people.push({ name: tname });
      return;
    }

    // 학생 — 맨 뒤가 이름, 앞이 숫자들
    var name = cells[cells.length - 1];
    var nums = cells.slice(0, -1);

    if (!isName(name)) { problems.push(no + '번째 줄: 이름을 찾지 못했습니다 (' + line + ')'); return; }
    if (!nums.length)  { problems.push(no + '번째 줄: 학번이나 반·번호가 없습니다 (' + line + ')'); return; }
    if (!nums.every(function (n) { return /^\d+$/.test(n); })) {
      problems.push(no + '번째 줄: 이름 앞은 숫자여야 합니다 (' + line + ')'); return;
    }

    var g, cls, num, studentNo;
    if (nums.length === 1) {
      // 학번을 그대로 적어준 경우
      studentNo = nums[0];
      g   = studentNo.length === 5 ? studentNo.slice(0, 1) : '';
      cls = studentNo.length === 5 ? String(Number(studentNo.slice(1, 3))) : '';
    } else {
      if (nums.length === 2) { g = grade;   cls = nums[0]; num = nums[1]; }
      else                   { g = nums[0]; cls = nums[1]; num = nums[2]; }
      studentNo = String(g) + pad2(cls) + pad2(num);
    }

    people.push({ student_no: studentNo, name: name, grade: g || null, class_no: cls || null });
  });

  // 같은 아이디가 여러 줄 들어왔으면 하나만 남깁니다
  var seen = {};
  var dups = [];
  people = people.filter(function (p) {
    var key = rosterMode === 'teacher' ? p.name : p.student_no;
    if (seen[key]) { dups.push(key); return false; }
    seen[key] = true;
    return true;
  });
  if (dups.length) problems.push('같은 것이 두 번 들어와 하나만 남겼습니다: ' + dups.join(', '));

  return { people: people, problems: problems };
}

// ── 서버 부르기 ──
// Edge Function 이 4xx 를 주면 본문에 이유가 들어 있습니다.
// res.error.message 만 보면 "non-2xx status code" 같은 쓸모없는 말만 나옵니다.
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

// ── 등록하기 ──
async function createAccounts() {
  var parsed = parsePeople();
  var pb = document.getElementById('add-problems');

  if (parsed.problems.length) {
    pb.hidden = false;
    pb.innerHTML = '<b>건너뛴 줄 ' + parsed.problems.length + '개</b><ul><li>' +
      parsed.problems.map(esc).join('</li><li>') + '</li></ul>';
  } else {
    pb.hidden = true;
  }

  if (!parsed.people.length) { toast('등록할 사람이 없습니다.', 'bad'); return; }

  var btn = document.getElementById('btn-create');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '등록하는 중...';

  var res = await callAccountFn({ role: rosterMode, people: parsed.people });

  btn.disabled = false;
  btn.textContent = label;

  if (res.error) { toast('실패: ' + res.error, 'bad'); return; }

  var created = res.data.created || [];
  var skipped = res.data.skipped || [];
  if (res.data.initial_password) {
    // 서버가 실제로 쓴 값을 그대로 받아 둡니다 (여기 적힌 값과 어긋나지 않게)
    if (rosterMode === 'student') INITIAL_PW_STUDENT = res.data.initial_password;
    else INITIAL_PW_TEACHER = res.data.initial_password;
    btn.textContent = '등록하기 (초기비번 ' + initialPw() + ')';
  }

  var box = document.getElementById('add-result');
  box.hidden = false;
  box.innerHTML =
    '<b>' + created.length + '명</b> 등록했습니다. 초기 비밀번호는 <b class="pw">' + esc(initialPw()) + '</b> 입니다.' +
    (skipped.length
      ? '<ul><li>' + skipped.map(function (s) {
          return esc(s.login_id || s.name) + ' — ' + esc(s.reason);
        }).join('</li><li>') + '</li></ul>'
      : '');

  document.getElementById('paste-box').value = '';
  document.getElementById('excel-name').textContent = '';
  loadRoster();
}

// ── 비밀번호 초기화 ──
async function onResetClick(btn) {
  var loginId = btn.dataset.loginId, name = btn.dataset.name;
  if (!confirm(name + '(' + loginId + ') 님의 비밀번호를 ' + initialPw() + ' 로 되돌릴까요?')) return;

  btn.disabled = true;
  var res = await callAccountFn({ action: 'reset', login_ids: [loginId] });
  btn.disabled = false;

  if (res.error) { toast('실패: ' + res.error, 'bad'); return; }
  var failed = res.data.failed || [];
  if (failed.length) { toast('실패: ' + failed[0].reason, 'bad'); return; }

  if (res.data.initial_password) {
    if (rosterMode === 'student') INITIAL_PW_STUDENT = res.data.initial_password;
    else INITIAL_PW_TEACHER = res.data.initial_password;
  }
  toast(name + ' 님의 비밀번호를 ' + initialPw() + ' 로 되돌렸습니다.', 'ok');
  loadRoster();
}

// ── 삭제 ──
async function onDeleteClick(btn) {
  var loginId = btn.dataset.loginId, name = btn.dataset.name;
  if (!confirm(name + '(' + loginId + ') 님의 계정을 지울까요?\n지우면 되돌릴 수 없습니다.')) return;

  btn.disabled = true;
  var res = await callAccountFn({ action: 'delete', login_ids: [loginId] });
  btn.disabled = false;

  if (res.error) { toast('실패: ' + res.error, 'bad'); return; }
  var failed = res.data.failed || [];
  if (failed.length) { toast('실패: ' + failed[0].reason, 'bad'); return; }

  toast(name + ' 님의 계정을 지웠습니다.', 'ok');
  loadRoster();
}

function rowActions(loginId, name, canTouch) {
  if (!canTouch) return '';
  var d = ' data-login-id="' + esc(loginId) + '" data-name="' + esc(name) + '"';
  return '<button class="linkbtn" onclick="onResetClick(this)"' + d + '>비번초기화</button>' +
         '<button class="linkbtn danger" onclick="onDeleteClick(this)"' + d + '>삭제</button>';
}

// ── 등록된 명단 보기 ──
async function loadRoster() {
  var box = document.getElementById('roster-list');
  var chips = document.getElementById('class-chips');
  box.innerHTML = '<p class="empty">불러오는 중...</p>';
  chips.hidden = true;

  if (rosterMode === 'teacher') {
    const { data, error } = await sb
      .from('profiles')
      .select('login_id, name, role, must_change_password')
      .in('role', ['teacher', 'admin'])
      .order('name');

    if (error) { box.innerHTML = '<p class="empty">불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="empty">등록된 선생님이 없습니다.</p>'; return; }

    box.innerHTML = '<div class="rows">' + data.map(function (p) {
      return '<div class="row"><div class="who">' +
        '<span class="nm">' + esc(p.name) + '</span> ' +
        '<span class="pill ' + (p.role === 'admin' ? 'admin' : 'teacher') + '">' +
          (p.role === 'admin' ? '관리자' : '교사') + '</span> ' +
        '<span class="pill ' + (p.must_change_password ? 'warn' : 'ok') + '">' +
          (p.must_change_password ? '초기 비밀번호' : '변경 완료') + '</span>' +
        '</div><div class="acts">' + rowActions(p.login_id, p.name, isAdmin) + '</div></div>';
    }).join('') + '</div>';
    return;
  }

  const { data, error } = await sb
    .from('students')
    .select('student_no, name, grade, class_no, auth_user_id')
    .order('student_no');

  if (error) { box.innerHTML = '<p class="empty">불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
  if (!data.length) { box.innerHTML = '<p class="empty">등록된 학생이 없습니다.</p>'; return; }

  rosterCache = data;
  renderClassChips();
  renderStudents();
}

// 학번 앞 3자리(학년+반)로 묶어 고를 수 있게 합니다. 학생이 많아지면 전체 나열은 못 봅니다.
function classKey(s) { return String(s.student_no).slice(0, 3); }

function renderClassChips() {
  var counts = {};
  rosterCache.forEach(function (s) {
    var k = classKey(s);
    counts[k] = (counts[k] || 0) + 1;
  });
  var keys = Object.keys(counts).sort();
  if (keys.length < 2) { document.getElementById('class-chips').hidden = true; return; }

  var html = '<button class="chip" aria-pressed="' + (pickedClass === '') + '" onclick="pickClass(\'\')">' +
             '전체<span class="n">' + rosterCache.length + '</span></button>';
  html += keys.map(function (k) {
    return '<button class="chip" aria-pressed="' + (pickedClass === k) + '" onclick="pickClass(\'' + k + '\')">' +
           k.slice(0, 1) + '학년 ' + Number(k.slice(1)) + '반<span class="n">' + counts[k] + '</span></button>';
  }).join('');

  var chips = document.getElementById('class-chips');
  chips.innerHTML = html;
  chips.hidden = false;
}

function pickClass(k) {
  pickedClass = k;
  renderClassChips();
  renderStudents();
}

function renderStudents() {
  var list = pickedClass
    ? rosterCache.filter(function (s) { return classKey(s) === pickedClass; })
    : rosterCache;

  var box = document.getElementById('roster-list');
  if (!list.length) { box.innerHTML = '<p class="empty">이 반에는 등록된 학생이 없습니다.</p>'; return; }

  box.innerHTML = '<div class="rows">' + list.map(function (s) {
    return '<div class="row"><div class="who">' +
      '<span class="id">' + esc(s.student_no) + '</span>' +
      '<span class="nm">' + esc(s.name) + '</span>' +
      (s.auth_user_id ? '' : ' <span class="pill warn">계정 없음</span>') +
      '</div><div class="acts">' +
      // 계정이 없는 학생은 되돌릴 비밀번호도, 지울 계정도 없습니다
      rowActions(s.student_no, s.name, !!s.auth_user_id) +
      '</div></div>';
  }).join('') + '</div>';
}


// ══════════════ 데이터 관리 ══════════════
//
// 새 학년도를 시작할 때 한 번 쓰는 자리입니다. 모두 «되돌릴 수 없는» 일이라
// 두 번 묻습니다 — 무엇이 얼마나 지워지는지 보여주고, 「지웁니다」를 적게 합니다.
//
// 지우는 길이 둘입니다.
//   · 기록(면접·톡)  브라우저에서 바로 지웁니다. RLS 가 우리 학교 것만 내줍니다
//   · 계정(학생·교사) Edge Function 이 지웁니다. auth 계정은 service_role 만 만질 수 있습니다
//
// ⚠️ 표 사이가 «딸려 지우기(cascade)» 로 묶여 있습니다 —
//   · 면접을 지우면 질문·평가(interview_answers)와 읽음 표시(report_reads)가 같이
//   · 학생 계정을 지우면 그 학생의 면접이 통째로, 그리고 주고받은 톡도 같이
//   · 선생님 계정은 «그 선생님이 본 면접» 이 남아 있으면 지워지지 않습니다
//     (interviews.teacher_id 가 막습니다). 리포트를 먼저 지우시면 됩니다.

var IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000';   // «전부» 를 뜻하는 거르개

async function countRows(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  return error ? null : (count || 0);
}

// ⚠️ 톡은 «내가 주고받은 것» 만 읽을 수 있습니다(chats_read). 그래서 그냥 세면
//    관리자 본인 것만 나옵니다. 내용은 안 주고 개수만 돌려주는 서버 함수를 씁니다.
async function countChats() {
  const { data, error } = await sb.rpc('admin_chat_count');
  return error ? null : (data || 0);
}

async function loadDataCounts() {
  var box = document.getElementById('data-counts');
  box.innerHTML = '<p class="empty">세는 중...</p>';

  var 학생 = await countRows('students');
  var 면접 = await countRows('interviews');
  var 톡   = await countChats();
  var 교사 = null;
  const { count: tc } = await sb.from('profiles')
    .select('*', { count: 'exact', head: true }).in('role', ['teacher', 'admin']);
  교사 = (tc === undefined || tc === null) ? null : tc;

  function 칸(k, n) {
    return '<div class="datacount"><span class="n">' +
           (n === null ? '?' : n) + '</span><span class="k">' + k + '</span></div>';
  }
  box.innerHTML = 칸('학생 계정', 학생) + 칸('교직원 계정', 교사) +
                  칸('면접 기록', 면접) + 칸('주고받은 톡', 톡);
}

// 두 번 묻습니다. 「지웁니다」를 그대로 적어야 넘어갑니다.
function reallyWipe(title, detail) {
  if (!confirm(title + '\n\n' + detail + '\n\n되돌릴 수 없습니다. 계속할까요?')) return false;
  var typed = prompt('마지막 확인입니다.\n정말 지우시려면 아래 칸에  지웁니다  라고 적어 주세요.');
  if (typed === null) return false;
  if (String(typed).trim() !== '지웁니다') {
    toast('「지웁니다」 라고 적어야 지웁니다. 아무것도 지우지 않았습니다.', 'bad');
    return false;
  }
  return true;
}

function dataResult(html, kind) {
  var el = document.getElementById('data-result');
  el.className = 'note ' + (kind || 'info');
  el.innerHTML = html;
  el.hidden = false;
}

function dataBusy(id, on, label) {
  var b = document.getElementById(id);
  if (!b) return;
  b.disabled = on;
  if (label) b.textContent = label;
}

// ── 면접 기록 전부 ──
async function wipeReports() {
  var n = await countRows('interviews');
  if (n === 0) { toast('지울 면접 기록이 없습니다.'); return; }
  if (!reallyWipe('리포트 기록 초기화',
      '면접 기록 ' + n + '건을 모두 지웁니다.\n' +
      '질문·시간·평가·총평·채점표와 미리 만들어 둔 질문지가 함께 사라집니다.\n' +
      '학생·교사 명단은 그대로 둡니다.')) return;

  dataBusy('btn-wipe-reports', true, '지우는 중...');
  const { error } = await sb.from('interviews').delete().neq('id', IMPOSSIBLE_ID);
  dataBusy('btn-wipe-reports', false, '리포트 기록 초기화');

  if (error) { dataResult('지우지 못했습니다: ' + esc(error.message), 'bad'); return; }
  dataResult('면접 기록 <b>' + n + '건</b>을 지웠습니다.');
  toast('면접 기록을 지웠습니다.', 'ok');
  loadDataCounts();
}

// ── 톡 전부 ──
async function wipeChats() {
  var n = await countChats();
  if (n === 0) { toast('지울 톡이 없습니다.'); return; }
  if (!reallyWipe('대화(톡) 초기화',
      '주고받은 톡 ' + n + '건을 모두 지웁니다.\n' +
      '명단과 면접 기록은 그대로 둡니다.')) return;

  dataBusy('btn-wipe-chats', true, '지우는 중...');
  const { error } = await sb.from('chats').delete().neq('id', IMPOSSIBLE_ID);
  dataBusy('btn-wipe-chats', false, '대화(톡) 초기화');

  if (error) { dataResult('지우지 못했습니다: ' + esc(error.message), 'bad'); return; }

  // RLS 가 조용히 막으면 오류 없이 0건만 지워집니다. 정말 지워졌는지 세어 봅니다.
  var left = await countChats();
  if (left) {
    dataResult('지우지 못했습니다. 아직 <b>' + left + '건</b>이 남아 있습니다. ' +
               '(chats 의 지우기 권한(RLS)을 확인해야 합니다)', 'bad');
    loadDataCounts();
    return;
  }
  dataResult('톡 <b>' + n + '건</b>을 지웠습니다.');
  toast('톡을 지웠습니다.', 'ok');
  loadDataCounts();
}

// ── 계정 지우기 (Edge Function) ──
// 한 번에 500명까지라 100명씩 나눠 보냅니다. 오래 걸리니 단추에 몇 명째인지 적습니다.
async function wipeAccounts(ids, btnId, label) {
  var done = 0, failed = [];
  for (var i = 0; i < ids.length; i += 100) {
    var 묶음 = ids.slice(i, i + 100);
    dataBusy(btnId, true, '지우는 중 ' + (i + 묶음.length) + '/' + ids.length);
    var res = await callAccountFn({ action: 'delete', login_ids: 묶음 });
    if (res.error) { failed.push({ login_id: '(서버)', reason: res.error }); break; }
    done += (res.data.done || []).length;
    failed = failed.concat(res.data.failed || []);
  }
  dataBusy(btnId, false, label);
  return { done: done, failed: failed };
}

function wipeReport(done, failed, 무엇) {
  var html = 무엇 + ' <b>' + done + '명</b>을 지웠습니다.';
  if (failed.length) {
    html += '<br>못 지운 ' + failed.length + '명:<ul><li>' +
      failed.slice(0, 10).map(function (f) {
        return esc(f.login_id) + ' — ' + esc(f.reason);
      }).join('</li><li>') + '</li></ul>';
    if (/teacher_id|violates foreign key/.test(JSON.stringify(failed))) {
      html += '<b>면접 기록이 남아 있어서 막힌 것입니다. 「리포트 기록 초기화」를 먼저 하세요.</b>';
    }
  }
  dataResult(html, failed.length ? 'bad' : 'info');
}

async function wipeStudents() {
  const { data, error } = await sb.from('students')
    .select('student_no, auth_user_id').order('student_no');
  if (error) { dataResult('명단을 읽지 못했습니다: ' + esc(error.message), 'bad'); return; }

  var ids = (data || []).filter(function (s) { return s.auth_user_id; })
                        .map(function (s) { return String(s.student_no); });
  if (!ids.length) { toast('지울 학생 계정이 없습니다.'); return; }

  if (!reallyWipe('학생 명단 초기화',
      '학생 계정 ' + ids.length + '명을 모두 지웁니다.\n' +
      '그 학생들의 면접 기록과 주고받은 톡도 함께 사라집니다.')) return;

  var r = await wipeAccounts(ids, 'btn-wipe-students', '학생 명단 초기화');
  wipeReport(r.done, r.failed, '학생');
  if (r.done) toast('학생 계정 ' + r.done + '명을 지웠습니다.', 'ok');
  loadDataCounts();
}

async function wipeTeachers() {
  const { data, error } = await sb.from('profiles')
    .select('login_id, name, role').in('role', ['teacher', 'admin']).order('name');
  if (error) { dataResult('명단을 읽지 못했습니다: ' + esc(error.message), 'bad'); return; }

  // 지금 로그인한 관리자 계정은 남겨 둡니다. 안 그러면 아무도 관리할 수 없게 됩니다.
  var ids = (data || []).map(function (p) { return p.login_id; })
                        .filter(function (id) { return id && id !== myLoginId; });
  if (!ids.length) { toast('지울 선생님 계정이 없습니다.'); return; }

  if (!reallyWipe('교사 명단 초기화',
      '선생님·관리자 계정 ' + ids.length + '명을 지웁니다.\n' +
      '지금 로그인한 「' + myLoginId + '」 계정은 남습니다.\n' +
      '그분들이 주고받은 톡도 함께 사라집니다.')) return;

  var r = await wipeAccounts(ids, 'btn-wipe-teachers', '교사 명단 초기화');
  wipeReport(r.done, r.failed, '선생님');
  if (r.done) toast('선생님 계정 ' + r.done + '명을 지웠습니다.', 'ok');
  loadDataCounts();
}
