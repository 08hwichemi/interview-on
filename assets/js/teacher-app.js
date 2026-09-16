// 교사 화면
//
// 면접은 이 화면에서 시작합니다. 첫 단계는 «누구를 면접할지» 고르는 것입니다.
// 선생님은 전교생을 다 볼 수 있습니다. 면접 기간에 선생님끼리 바꿔 들어가도 되도록.
//
// 계정을 만들고 지우는 일은 여기 없습니다. 그건 관리자 화면(admin/)의 몫입니다.

var students = [];       // 전교생
var pickedClass = '';    // 고른 반 ('' 이면 전체)
var searchWord = '';

function toast(msg, kind) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (kind || '');
  setTimeout(function () { el.className = 'toast ' + (kind || ''); }, 3000);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 학번 앞 3자리가 학년+반입니다 (3학년 2반 → 302)
function classKey(s) { return String(s.student_no).slice(0, 3); }

async function loadStudents() {
  var box = document.getElementById('student-list');
  box.innerHTML = '<p class="empty">불러오는 중...</p>';

  const { data, error } = await sb
    .from('students')
    .select('student_no, name, grade, class_no')
    .order('student_no');

  if (error) {
    box.innerHTML = '<p class="empty">명단을 불러오지 못했습니다: ' + esc(error.message) + '</p>';
    return;
  }

  students = data || [];
  if (!students.length) {
    document.getElementById('class-chips').hidden = true;
    box.innerHTML = '<p class="empty">아직 등록된 학생이 없습니다. 관리자 선생님께 명단 등록을 부탁하세요.</p>';
    return;
  }

  renderClassChips();
  renderStudents();
}

function renderClassChips() {
  var counts = {};
  students.forEach(function (s) {
    var k = classKey(s);
    counts[k] = (counts[k] || 0) + 1;
  });
  var keys = Object.keys(counts).sort();

  var html = '<button class="chip" aria-pressed="' + (pickedClass === '') + '" onclick="pickClass(\'\')">' +
             '전체<span class="n">' + students.length + '</span></button>';
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

function onSearch(el) {
  searchWord = el.value.trim();
  renderStudents();
}

function renderStudents() {
  var list = students;
  if (pickedClass) list = list.filter(function (s) { return classKey(s) === pickedClass; });
  if (searchWord) {
    var w = searchWord;
    list = list.filter(function (s) {
      return String(s.student_no).indexOf(w) > -1 || String(s.name).indexOf(w) > -1;
    });
  }

  var box = document.getElementById('student-list');
  document.getElementById('found-count').textContent = list.length + '명';

  if (!list.length) {
    box.innerHTML = '<p class="empty">찾는 학생이 없습니다.</p>';
    return;
  }

  box.innerHTML = '<div class="rows">' + list.map(function (s) {
    return '<div class="row"><div class="who">' +
      '<span class="id">' + esc(s.student_no) + '</span>' +
      '<span class="nm">' + esc(s.name) + '</span>' +
      '</div></div>';
  }).join('') + '</div>';
}
