// 교사 화면 — 면접
//
// 화면은 둘로 나뉩니다.
//   왼쪽 칸  면접 전에는 «학생 명단», 면접 중에는 «질문 진행 상황»
//   오른쪽 칸 준비 → 진행 → 마무리
//
// «면접 끝내기» 를 누르는 순간 학생 폰에 리포트가 보입니다.
// 그 전까지는 status 가 '진행중' 이라 학생에게 아무것도 보이지 않습니다.
//
// 계정을 만들고 지우는 일은 여기 없습니다. 그건 관리자 화면(admin/)의 몫입니다.

// ── 평가 단추 ──
// 면접을 보시면서 "이 말이 자주 나온다" 싶은 게 있으면 여기만 고치면 됩니다.
var TAGS = {
  '내용':   { good: ['근거가 구체적', '경험이 드러남', '질문에 정확히 답함', '배운 점까지 연결'],
             bad:  ['두루뭉술함', '질문에서 벗어남', '외운 티가 남', '사실만 나열'] },
  '말하기': { good: ['결론부터 말함', '또렷하고 알맞은 속도', '문장이 간결함'],
             bad:  ['목소리가 작음', '말이 빠름', '군더더기(음, 그)', '문장이 길어져 흐림'] },
  '태도':   { good: ['눈을 맞춤', '자세가 바름', '끝까지 침착함'],
             bad:  ['시선을 피함', '자세가 흐트러짐', '당황하면 말이 끊김'] }
};

// ── 채점표 ──
// 대학이 쓰는 공통 평가요소(학업·진로·공동체)에 면접에서만 볼 수 있는 두 가지를 더했습니다.
// 평가요소·평가항목 이름은 공개된 공동연구 문서의 용어이고, 설명은 우리가 쓴 문장입니다.
var SCORESHEET = [
  { area: '학업역량',   item: '학업태도',              desc: '배우려는 자세와 스스로 공부를 끌고 간 흔적이 답변에 나타나는가' },
  { area: '학업역량',   item: '탐구력',                desc: '궁금증을 실제 탐구로 옮기고, 그 과정을 자기 말로 풀어내는가' },
  { area: '진로역량',   item: '진로 탐색 활동과 경험',  desc: '관심 분야를 넓혀 온 경험이 구체적이고, 지원 전공과 이어지는가' },
  { area: '공동체역량', item: '협업과 소통 능력',       desc: '함께한 일에서 맡은 몫과 조율한 방식을 사례로 말하는가' },
  { area: '면접 태도',  item: '의사소통 능력',          desc: '질문의 뜻을 알아듣고, 결론과 근거를 분명하게 말하는가' },
  { area: '면접 확인',  item: '기록의 신뢰도',          desc: '생활기록부에 적힌 것과 답변이 서로 맞는가' }
];

var COMPETENCIES = ['학업역량', '진로역량', '공동체역량', '기타'];
var GRADES = ['A', 'B', 'C', 'D', 'E'];

// ── 상태 ──
var me = null;
var students = [];
var pickedClass = '';
var searchWord = '';

var target = null;
var questions = [];       // [{ text, competency }]
var interviewId = null;
var qIndex = 0;
var answers = [];         // [{ seconds, good, bad }]
var grades = {};          // { 평가항목: 'A'~'E' }
var timerId = null;
var seconds = 0;
var running = false;

// ── 공통 ──
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg, kind) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (kind || '');
  setTimeout(function () { el.className = 'toast ' + (kind || ''); }, 3000);
}

function show(view) {
  ['empty', 'setup', 'run', 'finish'].forEach(function (v) {
    document.getElementById('view-' + v).hidden = (v !== view);
  });
  // 면접 중에는 왼쪽 칸이 질문 진행 상황으로 바뀝니다.
  var inInterview = (view === 'run' || view === 'finish');
  document.getElementById('rail-students').hidden = inInterview;
  document.getElementById('rail-progress').hidden = !inInterview;
  if (inInterview) renderRailProgress();
  window.scrollTo(0, 0);
}

function mmss(s) {
  var m = Math.floor(s / 60), r = s % 60;
  return (m < 10 ? '0' + m : m) + ':' + (r < 10 ? '0' + r : r);
}

// 학번 앞 3자리가 학년+반입니다 (3학년 2반 → 302)
function classKey(s) { return String(s.student_no).slice(0, 3); }

// ══════════════ 왼쪽 칸 — 학생 명단 ══════════════

async function loadStudents() {
  var box = document.getElementById('student-list');
  box.innerHTML = '<p class="empty">불러오는 중...</p>';

  const { data, error } = await sb
    .from('students')
    .select('id, student_no, name')
    .order('student_no');

  if (error) {
    box.innerHTML = '<p class="empty">명단을 불러오지 못했습니다: ' + esc(error.message) + '</p>';
    return;
  }

  students = data || [];
  if (!students.length) {
    document.getElementById('class-chips').hidden = true;
    box.innerHTML = '<p class="empty">아직 등록된 학생이 없습니다.<br>관리자 선생님께 명단 등록을 부탁하세요.</p>';
    return;
  }
  renderClassChips();
  renderStudents();
}

function renderClassChips() {
  var counts = {};
  students.forEach(function (s) { var k = classKey(s); counts[k] = (counts[k] || 0) + 1; });
  var keys = Object.keys(counts).sort();

  var html = '<button class="chip" aria-pressed="' + (pickedClass === '') + '" onclick="pickClass(\'\')">' +
             '전체<span class="n">' + students.length + '</span></button>';
  html += keys.map(function (k) {
    return '<button class="chip" aria-pressed="' + (pickedClass === k) + '" onclick="pickClass(\'' + k + '\')">' +
           Number(k.slice(1)) + '반<span class="n">' + counts[k] + '</span></button>';
  }).join('');

  var chips = document.getElementById('class-chips');
  chips.innerHTML = html;
  chips.hidden = false;
}

function pickClass(k) { pickedClass = k; renderClassChips(); renderStudents(); }
function onSearch(el) { searchWord = el.value.trim(); renderStudents(); }

function renderStudents() {
  var list = students;
  if (pickedClass) list = list.filter(function (s) { return classKey(s) === pickedClass; });
  if (searchWord) {
    list = list.filter(function (s) {
      return String(s.student_no).indexOf(searchWord) > -1 || String(s.name).indexOf(searchWord) > -1;
    });
  }

  var box = document.getElementById('student-list');
  document.getElementById('found-count').textContent = list.length;
  if (!list.length) { box.innerHTML = '<p class="empty">찾는 학생이 없습니다.</p>'; return; }

  box.innerHTML = list.map(function (s) {
    var on = target && target.id === s.id;
    return '<button class="railrow" aria-current="' + !!on + '" onclick="pickStudent(\'' + s.id + '\')">' +
      '<span class="id">' + esc(s.student_no) + '</span>' +
      '<span class="nm">' + esc(s.name) + '</span></button>';
  }).join('');
}

// ══════════════ 왼쪽 칸 — 질문 진행 상황 ══════════════

function renderRailProgress() {
  document.getElementById('progress-who').textContent =
    target ? target.student_no + ' ' + target.name : '';

  document.getElementById('progress-list').innerHTML = questions.map(function (q, i) {
    var a = answers[i] || { seconds: 0, good: [], bad: [] };
    var touched = a.seconds > 0 || a.good.length || a.bad.length;
    return '<button class="railrow q" aria-current="' + (i === qIndex) + '" onclick="goToQuestion(' + i + ')">' +
      '<span class="qn">' + (i + 1) + '</span>' +
      '<span class="qt">' + esc(q.text) + '</span>' +
      (touched ? '<span class="done">' + mmss(a.seconds) + '</span>' : '') +
      '</button>';
  }).join('');
}

// ══════════════ 준비 ══════════════

async function pickStudent(id) {
  target = students.filter(function (s) { return s.id === id; })[0];
  if (!target) return;

  renderStudents();   // 고른 줄 표시
  document.getElementById('target-name').textContent = target.student_no + ' ' + target.name;
  questions = [];
  renderQuestions();
  show('setup');
  loadHistory();
}

async function loadHistory() {
  var box = document.getElementById('history');
  box.innerHTML = '<p class="empty">지난 기록 확인 중...</p>';

  const { data, error } = await sb
    .from('interviews')
    .select('id, started_at, status, teacher_name, grades')
    .eq('student_id', target.id)
    .order('started_at', { ascending: false });

  if (error) { box.innerHTML = '<p class="empty">지난 기록을 못 읽었습니다: ' + esc(error.message) + '</p>'; return; }
  if (!data.length) { box.innerHTML = '<p class="empty">이 학생의 첫 면접입니다.</p>'; return; }

  box.innerHTML = '<div class="rows">' + data.map(function (iv, i) {
    var d = new Date(iv.started_at);
    var g = iv.grades || {};
    var got = Object.keys(g).map(function (k) { return g[k]; });
    return '<div class="row"><div class="who">' +
      '<span class="id">' + (data.length - i) + '회차</span>' +
      '<span class="nm">' + d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '</span>' +
      '<span class="sub">' + esc(iv.teacher_name) + (got.length ? ' · ' + got.join(' ') : '') + '</span>' +
      (iv.status === '진행중' ? ' <span class="pill warn">진행중</span>' : '') +
      '</div></div>';
  }).join('') + '</div>';
}

function addQuestion(text, competency) {
  questions.push({ text: text || '', competency: competency || '기타' });
  renderQuestions();
}
function removeQuestion(i) { questions.splice(i, 1); renderQuestions(); }
function setQText(i, v) { questions[i].text = v; }
function setQComp(i, v) { questions[i].competency = v; }

function renderQuestions() {
  var box = document.getElementById('q-list');
  if (!questions.length) {
    box.innerHTML = '<p class="empty">아직 질문이 없습니다. 아래에서 더하세요.</p>';
  } else {
    box.innerHTML = questions.map(function (q, i) {
      return '<div class="qrow">' +
        '<span class="qno">' + (i + 1) + '</span>' +
        '<input type="text" value="' + esc(q.text) + '" placeholder="질문을 적으세요"' +
        ' oninput="setQText(' + i + ', this.value)">' +
        '<select onchange="setQComp(' + i + ', this.value)">' +
          COMPETENCIES.map(function (c) {
            return '<option value="' + c + '"' + (c === q.competency ? ' selected' : '') + '>' + c + '</option>';
          }).join('') +
        '</select>' +
        '<button class="linkbtn danger" onclick="removeQuestion(' + i + ')">빼기</button>' +
        '</div>';
    }).join('');
  }
  document.getElementById('btn-start').disabled = !questions.some(function (q) { return q.text.trim(); });
}

async function loadCommon(category, competency) {
  const { data, error } = await sb
    .from('common_questions').select('content').eq('category', category);

  if (error || !data || !data.length) { toast('추천 질문을 불러오지 못했습니다.', 'bad'); return; }

  var shuffled = data.slice().sort(function () { return Math.random() - 0.5; });
  shuffled.slice(0, 3).forEach(function (r) { questions.push({ text: r.content, competency: competency }); });
  renderQuestions();
  toast('추천 질문 3개를 더했습니다.', 'ok');
}

// ══════════════ 진행 ══════════════

async function startInterview() {
  questions = questions.filter(function (q) { return q.text.trim(); });
  if (!questions.length) { toast('질문이 없습니다.', 'bad'); return; }

  var btn = document.getElementById('btn-start');
  btn.disabled = true;
  btn.textContent = '시작하는 중...';

  // 면접을 먼저 만들어 둡니다. 도중에 브라우저가 꺼져도 기록이 남습니다.
  // 이때는 status 가 '진행중' 이라 학생에게 보이지 않습니다.
  const { data, error } = await sb.from('interviews').insert({
    school_id: SCHOOL_ID,
    student_id: target.id,
    teacher_id: me.id,
    teacher_name: me.name || '',
    status: '진행중'
  }).select('id').single();

  btn.disabled = false;
  btn.textContent = '면접 시작';

  if (error) { toast('면접을 시작하지 못했습니다: ' + error.message, 'bad'); return; }

  interviewId = data.id;
  qIndex = 0;
  answers = questions.map(function () { return { seconds: 0, good: [], bad: [] }; });
  grades = {};
  show('run');
  showQuestion();
}

function showQuestion() {
  var q = questions[qIndex];
  document.getElementById('run-step').textContent = (qIndex + 1) + ' / ' + questions.length;
  document.getElementById('run-comp').textContent = q.competency;
  document.getElementById('run-question').textContent = q.text;

  stopTimer();
  seconds = answers[qIndex].seconds;
  paintTimer();
  document.getElementById('btn-timer').textContent = seconds ? '이어서 재기' : '답변 시작';
  document.getElementById('btn-prev').disabled = (qIndex === 0);
  document.getElementById('btn-next').textContent =
    (qIndex === questions.length - 1) ? '면접 마무리 →' : '다음 질문 →';

  renderTagButtons();
  renderRailProgress();
}

// 좋았던 것과 아쉬운 것을 갈라 놓습니다.
// 한 줄에 섞어 놓으면 면접 중에 급히 누를 때 잘못 누릅니다.
function renderTagButtons() {
  var a = answers[qIndex];

  function group(kind, list, label) {
    return '<div class="tagcol"><span class="cap ' + kind + '">' + label + '</span><div class="chips">' +
      list.map(function (t) {
        return '<button class="chip ' + kind + '" aria-pressed="' + (a[kind].indexOf(t) > -1) + '"' +
               ' onclick="toggleTag(\'' + kind + '\', this)" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div></div>';
  }

  document.getElementById('tag-area').innerHTML = Object.keys(TAGS).map(function (axis) {
    return '<div class="tagrow"><span class="axis">' + axis + '</span><div class="tagcols">' +
      group('good', TAGS[axis].good, '좋았던 점') +
      group('bad',  TAGS[axis].bad,  '아쉬운 점') +
      '</div></div>';
  }).join('');
}

function toggleTag(kind, btn) {
  var tag = btn.dataset.tag;
  var arr = answers[qIndex][kind];
  var at = arr.indexOf(tag);
  if (at > -1) arr.splice(at, 1); else arr.push(tag);
  btn.setAttribute('aria-pressed', at === -1);
}

function paintTimer() { document.getElementById('timer').textContent = mmss(seconds); }

function toggleTimer() {
  if (running) { stopTimer(); document.getElementById('btn-timer').textContent = '이어서 재기'; return; }
  running = true;
  document.getElementById('btn-timer').textContent = '멈추기';
  timerId = setInterval(function () {
    seconds++; answers[qIndex].seconds = seconds; paintTimer();
  }, 1000);
}

function stopTimer() {
  running = false;
  if (timerId) { clearInterval(timerId); timerId = null; }
}

// 질문 하나가 끝날 때마다 서버에 남깁니다. 마지막에 한꺼번에 저장하면
// 도중에 창이 닫혔을 때 면접 전체가 날아갑니다.
// 같은 자리로 돌아와 다시 저장하면 덮어씁니다 (interview_id + seq 가 짝).
async function saveAnswer(i) {
  var q = questions[i], a = answers[i];
  const { error } = await sb.from('interview_answers').upsert({
    interview_id: interviewId,
    seq: i + 1,
    competency: q.competency,
    question: q.text,
    seconds: a.seconds,
    good_tags: a.good,
    bad_tags: a.bad
  }, { onConflict: 'interview_id,seq' });
  if (error) toast('이 질문을 저장하지 못했습니다: ' + error.message, 'bad');
}

async function goToQuestion(i) {
  if (i === qIndex) return;
  stopTimer();
  await saveAnswer(qIndex);
  qIndex = i;
  showQuestion();
}

async function prevQuestion() {
  if (qIndex === 0) return;
  stopTimer();
  await saveAnswer(qIndex);
  qIndex--;
  showQuestion();
}

async function nextQuestion() {
  stopTimer();
  var btn = document.getElementById('btn-next');
  btn.disabled = true;
  await saveAnswer(qIndex);
  btn.disabled = false;

  if (qIndex === questions.length - 1) { openFinish(); return; }
  qIndex++;
  showQuestion();
}

// ══════════════ 마무리 ══════════════

function openFinish() {
  document.getElementById('finish-who').textContent = target.student_no + ' ' + target.name;
  var total = answers.reduce(function (n, a) { return n + a.seconds; }, 0);
  document.getElementById('finish-total').textContent = mmss(total);
  renderScoresheet();
  show('finish');
}

function renderScoresheet() {
  document.getElementById('scoresheet').innerHTML = SCORESHEET.map(function (r, i) {
    return '<div class="scorerow">' +
      '<span class="area">' + esc(r.area) + '</span>' +
      '<span class="item"><b>' + esc(r.item) + '</b><span class="desc">' + esc(r.desc) + '</span></span>' +
      '<span class="picks">' + GRADES.map(function (g) {
        return '<button class="gbtn" aria-pressed="' + (grades[r.item] === g) + '"' +
               ' onclick="pickGrade(' + i + ', \'' + g + '\', this)">' + g + '</button>';
      }).join('') + '</span></div>';
  }).join('');
}

function pickGrade(rowIndex, g, btn) {
  grades[SCORESHEET[rowIndex].item] = g;
  Array.prototype.forEach.call(btn.parentNode.children, function (b) {
    b.setAttribute('aria-pressed', b === btn);
  });
}

function backToRun() { show('run'); showQuestion(); }

async function finishInterview() {
  var btn = document.getElementById('btn-finish');
  btn.disabled = true;
  btn.textContent = '저장하는 중...';

  const { error } = await sb.from('interviews').update({
    status: '끝남',
    finished_at: new Date().toISOString(),
    grades: grades,
    overall_note: document.getElementById('finish-note').value.trim()
  }).eq('id', interviewId);

  btn.disabled = false;
  btn.textContent = '면접 끝내기 (학생에게 공개)';

  if (error) { toast('저장하지 못했습니다: ' + error.message, 'bad'); return; }

  toast(target.name + ' 학생에게 리포트가 공개되었습니다.', 'ok');
  interviewId = null;
  grades = {};
  document.getElementById('finish-note').value = '';
  show('setup');
  loadHistory();
}
