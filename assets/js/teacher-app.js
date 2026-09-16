// 교사 화면 — 면접
//
// 화면은 둘로 나뉩니다.
//   왼쪽 칸  면접 전에는 «학생 명단», 면접 중에는 «질문 진행 상황»
//   오른쪽 칸 준비 → 진행 → 마무리
//
// 면접을 끝내도 곧바로 학생에게 가지 않습니다.
//   진행중  →  작성완료  →  전달됨
//           면접 끝내기   학생에게 전달
//          (선생님만 봄)   (학생도 봄)
// 선생님이 리포트를 한 장으로 확인하고 다듬은 뒤에 보냅니다.
// 보낸 뒤에도 고칠 수 있고, 고치면 리포트에 «고친 날»이 남습니다.
//
// 계정을 만들고 지우는 일은 여기 없습니다. 그건 관리자 화면(admin/)의 몫입니다.

// ── 평가 단추 ──
// 면접을 보시면서 "이 말이 자주 나온다" 싶은 게 있으면 여기만 고치면 됩니다.
//
// 축이 넷입니다. 앞의 둘(내용·근거)이 «무엇을 말했나», 뒤의 둘(말하기·태도)이 «어떻게 말했나».
// 처음에는 뒤의 둘만 있어서 답변의 알맹이를 평가할 자리가 없었습니다.
var TAGS = {
  '내용':   { good: ['개념을 정확히 씀', '동기가 분명함', '과정을 순서대로 설명',
                    '배운 점까지 연결', '전공과 이어짐', '아쉬운 점도 스스로 짚음'],
             bad:  ['개념이 부정확', '활동 나열에 그침', '결과만 말하고 과정이 없음',
                    '질문을 빗나감', '외운 느낌'] },
  '근거':   { good: ['생기부 기록과 맞음', '구체적 사례를 듦', '숫자·이름까지 말함'],
             bad:  ['사례가 없음', '생기부 기록과 어긋남', '근거 없이 단정'] },
  '말하기': { good: ['결론부터 말함', '또렷하고 알맞은 속도', '문장이 간결함'],
             bad:  ['목소리가 작음', '말이 빠름', '군더더기(음, 그)',
                    '문장이 길어져 흐림', '결론이 없음'] },
  '태도':   { good: ['눈을 맞춤', '자세가 바름', '끝까지 침착함', '모르는 건 솔직히 말함'],
             bad:  ['시선을 피함', '자세가 흐트러짐', '당황하면 말이 끊김', '긴장이 심함'] }
};

// 태그를 다 누르지 못해도 이것 하나면 흐름이 읽힙니다.
var RATINGS = ['우수', '보통', '미흡'];

// 채점표(SCORESHEET)와 등급(GRADES), esc()·mmss() 는 report.js 에 있습니다.
// 선생님이 보는 리포트와 학생이 받는 리포트가 같은 종이여야 해서 한 곳에 모았습니다.

var COMPETENCIES = ['학업역량', '진로역량', '공동체역량', '기타'];

// ── 첫인사 · 끝인사 ──
// 실제 면접은 늘 자기소개(또는 지원동기)로 열고 «마지막으로 하고 싶은 말» 로 닫습니다.
// 매번 손으로 적으면 빠뜨리기 쉬워서 위아래에 붙박이로 두었습니다.
// 문장은 그대로 고칠 수 있고, 안 쓸 거면 끄면 됩니다.
var OPENINGS = [
  { key: 'intro',  label: '자기소개',
    text: '먼저 간단히 자기소개를 해 주세요.', comp: '기타' },
  { key: 'motive', label: '지원동기',
    text: '우리 학과에 지원한 동기를 말해 주세요.', comp: '진로역량' },
  { key: 'both',   label: '자기소개 + 지원동기',
    text: '간단한 자기소개와 함께, 우리 학과에 지원한 동기를 말해 주세요.', comp: '진로역량' }
];
var CLOSING_TEXT = '마지막으로 하고 싶은 말이 있나요?';

var opening = { on: true, key: 'intro', text: OPENINGS[0].text, comp: OPENINGS[0].comp };
var closing = { on: true, text: CLOSING_TEXT };

function resetGreetings() {
  opening = { on: true, key: 'intro', text: OPENINGS[0].text, comp: OPENINGS[0].comp };
  closing = { on: true, text: CLOSING_TEXT };
}

function pickOpening(key) {
  if (opening.key === key && opening.on) { opening.on = false; }   // 다시 누르면 끕니다
  else {
    var o = OPENINGS.filter(function (x) { return x.key === key; })[0];
    opening = { on: true, key: key, text: o.text, comp: o.comp };
  }
  renderGreetings();
  renderQuestions();
}
function setOpeningText(v) { opening.text = v; }
function toggleClosing() { closing.on = !closing.on; renderGreetings(); renderQuestions(); }
function setClosingText(v) { closing.text = v; }

function hasOpening() { return opening.on && opening.text.trim(); }
function hasClosing() { return closing.on && closing.text.trim(); }

function renderGreetings() {
  document.getElementById('opening-box').innerHTML =
    '<div class="chips tight">' + OPENINGS.map(function (o) {
      return '<button class="chip" aria-pressed="' + (opening.on && opening.key === o.key) + '"' +
             ' onclick="pickOpening(\'' + o.key + '\')">' + o.label + '</button>';
    }).join('') + '</div>' +
    (opening.on
      ? '<div class="qrow fixed"><span class="qno">1</span>' +
        '<input type="text" value="' + esc(opening.text) + '" oninput="setOpeningText(this.value)"></div>'
      : '<p class="empty">첫인사 없이 바로 질문부터 시작합니다.</p>');

  var last = (hasOpening() ? 1 : 0) +
             midQuestions.filter(function (q) { return q.text.trim(); }).length + 1;
  document.getElementById('closing-box').innerHTML =
    '<div class="chips tight">' +
      '<button class="chip" aria-pressed="' + closing.on + '" onclick="toggleClosing()">마지막으로 하고 싶은 말</button>' +
    '</div>' +
    (closing.on
      ? '<div class="qrow fixed"><span class="qno">' + last + '</span>' +
        '<input type="text" value="' + esc(closing.text) + '" oninput="setClosingText(this.value)"></div>'
      : '<p class="empty">끝인사 없이 마지막 질문으로 끝냅니다.</p>');
}

// 실제로 면접에 낼 질문 — 첫인사 + 가운데 질문들 + 끝인사
function composeQuestions() {
  var list = [];
  if (hasOpening()) list.push({ text: opening.text.trim(), competency: opening.comp });
  midQuestions.forEach(function (q) {
    if (q.text.trim()) list.push({ text: q.text.trim(), competency: q.competency });
  });
  if (hasClosing()) list.push({ text: closing.text.trim(), competency: '기타' });
  return list;
}

// ── 상태 ──
var me = null;
var students = [];
var pickedClass = '';
var searchWord = '';

var target = null;
var midQuestions = [];    // 준비 화면에서 손으로 채우는 가운데 질문들
var questions = [];       // 면접에 실제로 내는 질문 (첫인사 + 가운데 + 끝인사)
var interviewId = null;
var qIndex = 0;
var answers = [];         // [{ seconds, good, bad, rating, memo }]
var grades = {};          // { 평가항목: 'A'~'E' }

// 시간을 두 개 잽니다.
//   질문별 — 선생님이 «답변 시작» 으로 재고 멈춥니다
//   전체   — 면접을 시작한 순간부터 마무리까지 저 혼자 흐릅니다
//            (질문 사이에 오가는 시간이 있어서 질문별 시간을 더한 값과 다릅니다)
var timerId = null;
var seconds = 0;
var running = false;
var totalTimerId = null;
var totalSeconds = 0;
// 지금 이 면접이 «오늘 진행 중인 새 면접» 인지.
// 지난 회차를 열어 고칠 때는 시간이 더 흘러서는 안 됩니다.
// 이게 없어서, 옛 면접을 열고 «질문으로» 를 누르면 그 면접의 전체 시간이
// 실시간으로 불어났습니다.
var liveInterview = false;

// ── 공통 ──
function toast(msg, kind) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (kind || '');
  setTimeout(function () { el.className = 'toast ' + (kind || ''); }, 3000);
}

function show(view) {
  ['empty', 'setup', 'run', 'finish', 'report'].forEach(function (v) {
    document.getElementById('view-' + v).hidden = (v !== view);
  });
  // 면접 중에는 왼쪽 칸이 질문 진행 상황으로 바뀝니다.
  var inInterview = (view === 'run' || view === 'finish' || view === 'report');
  document.getElementById('rail-students').hidden = inInterview;
  document.getElementById('rail-progress').hidden = !inInterview;
  if (inInterview) renderRailProgress();
  window.scrollTo(0, 0);
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

  // 시간을 «건드린 질문만» 보여주니 1번에만 00:00 이 뜨고 나머지는 빈 줄이라
  // 고장난 것처럼 보였습니다. 이제 모든 줄에 똑같이 보여줍니다.
  document.getElementById('progress-list').innerHTML = questions.map(function (q, i) {
    var a = answers[i] || { seconds: 0, good: [], bad: [], rating: null, memo: '' };
    var done = a.seconds > 0 || a.good.length || a.bad.length || a.rating || a.memo;
    return '<button class="railrow q" aria-current="' + (i === qIndex) + '" onclick="goToQuestion(' + i + ')">' +
      '<span class="qn">' + (i + 1) + '</span>' +
      '<span class="qt">' + esc(q.text) + '</span>' +
      '<span class="done' + (done ? '' : ' yet') + '">' +
        (a.rating ? esc(a.rating) + ' ' : '') + mmss(a.seconds) +
      '</span>' +
      '</button>';
  }).join('');
}

// 면접을 접고 학생 목록으로 돌아갑니다.
// 예전에는 리포트 화면 위쪽의 작은 «닫기» 하나뿐이라 돌아갈 길을 못 찾았습니다.
function backToList() {
  if (liveInterview && interviewId) {
    if (!confirm('면접을 접고 학생 목록으로 갈까요?\n지금까지 기록은 남아 있고, 나중에 다시 열 수 있습니다.')) return;
  }
  stopTimer();
  stopTotalTimer();
  liveInterview = false;
  interviewId = null;
  viewing = null;
  target = null;
  midQuestions = [];
  questions = [];
  answers = [];
  grades = {};
  resetGreetings();
  document.getElementById('finish-note').value = '';
  renderStudents();
  show('empty');
}

// ══════════════ 준비 ══════════════

async function pickStudent(id) {
  target = students.filter(function (s) { return s.id === id; })[0];
  if (!target) return;

  renderStudents();   // 고른 줄 표시
  document.getElementById('target-name').textContent = target.student_no + ' ' + target.name;
  midQuestions = [];
  questions = [];
  resetGreetings();
  renderGreetings();
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

  // 누가기록입니다. 눌러서 그때 리포트를 그대로 다시 봅니다.
  box.innerHTML = '<div class="rows">' + data.map(function (iv, i) {
    var round = data.length - i;
    var d = new Date(iv.started_at);
    var g = iv.grades || {};
    var got = SCORESHEET.map(function (r) { return g[r.item]; }).filter(Boolean);
    var state = iv.status === '전달됨'  ? '<span class="pill ok2">전달함</span>'
              : iv.status === '작성완료' ? '<span class="pill warn">아직 안 보냄</span>'
              :                            '<span class="pill warn">진행중</span>';
    return '<button class="row pickable" onclick="openPast(\'' + iv.id + '\', ' + round + ')">' +
      '<span class="who">' +
        '<span class="id">' + round + '회차</span>' +
        '<span class="nm">' + d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '</span>' +
        state +
        '<span class="sub">' + esc(iv.teacher_name) + (got.length ? ' · ' + got.join(' ') : '') + '</span>' +
      '</span>' +
      '<span class="acts"><span class="go">리포트 →</span></span></button>';
  }).join('') + '</div>';
}

function addQuestion(text, competency) {
  midQuestions.push({ text: text || '', competency: competency || '기타' });
  renderQuestions();
}
function removeQuestion(i) { midQuestions.splice(i, 1); renderQuestions(); }
function setQText(i, v) { midQuestions[i].text = v; renderGreetings(); }
function setQComp(i, v) { midQuestions[i].competency = v; }

function renderQuestions() {
  var box = document.getElementById('q-list');
  // 첫인사가 1번이면 가운데 질문은 2번부터입니다. 화면 번호와 실제 순서를 맞춥니다.
  var base = hasOpening() ? 1 : 0;
  if (!midQuestions.length) {
    box.innerHTML = '<p class="empty">아직 질문이 없습니다. 아래에서 더하세요.</p>';
  } else {
    box.innerHTML = midQuestions.map(function (q, i) {
      return '<div class="qrow">' +
        '<span class="qno">' + (base + i + 1) + '</span>' +
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
  renderGreetings();
  document.getElementById('btn-start').disabled = (composeQuestions().length === 0);
}

async function loadCommon(category, competency) {
  const { data, error } = await sb
    .from('common_questions').select('content').eq('category', category);

  if (error || !data || !data.length) { toast('추천 질문을 불러오지 못했습니다.', 'bad'); return; }

  var shuffled = data.slice().sort(function () { return Math.random() - 0.5; });
  shuffled.slice(0, 3).forEach(function (r) { midQuestions.push({ text: r.content, competency: competency }); });
  renderQuestions();
  toast('추천 질문 3개를 더했습니다.', 'ok');
}

// ══════════════ 진행 ══════════════

async function startInterview() {
  // 첫인사 → 가운데 질문들 → 끝인사 순서로 한 줄로 폅니다.
  questions = composeQuestions();
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
  answers = questions.map(function () {
    return { seconds: 0, good: [], bad: [], rating: null, memo: '' };
  });
  grades = {};
  liveInterview = true;
  startTotalTimer();
  show('run');
  showQuestion();
}

function startTotalTimer() {
  stopTotalTimer();
  totalSeconds = 0;
  paintTotal();
  totalTimerId = setInterval(function () { totalSeconds++; paintTotal(); }, 1000);
}

function stopTotalTimer() {
  if (totalTimerId) { clearInterval(totalTimerId); totalTimerId = null; }
}

function paintTotal() {
  var el = document.getElementById('total-timer');
  if (el) el.textContent = mmss(totalSeconds);
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

  renderRating();
  renderTagButtons();
  document.getElementById('answer-memo').value = answers[qIndex].memo || '';
  renderRailProgress();
}

// 한 줄 판정 — 우수 · 보통 · 미흡
function renderRating() {
  var cur = answers[qIndex].rating;
  document.getElementById('rating-area').innerHTML = RATINGS.map(function (r) {
    return '<button class="rbtn" aria-pressed="' + (cur === r) + '"' +
           ' onclick="pickRating(\'' + r + '\', this)">' + r + '</button>';
  }).join('');
}

function pickRating(r, btn) {
  // 같은 것을 다시 누르면 지웁니다. 잘못 눌렀을 때 되돌릴 길이 있어야 합니다.
  var same = answers[qIndex].rating === r;
  answers[qIndex].rating = same ? null : r;
  Array.prototype.forEach.call(btn.parentNode.children, function (b) {
    b.setAttribute('aria-pressed', !same && b === btn);
  });
  renderRailProgress();
}

function setMemo(el) { answers[qIndex].memo = el.value; }

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
    bad_tags: a.bad,
    rating: a.rating,
    memo: a.memo || ''
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
  stopTimer();
  stopTotalTimer();   // 마무리 화면에서는 전체 시간도 멈춥니다
  document.getElementById('finish-who').textContent = target.student_no + ' ' + target.name;

  var spoken = answers.reduce(function (n, a) { return n + a.seconds; }, 0);
  document.getElementById('finish-total').textContent = mmss(totalSeconds);
  document.getElementById('finish-spoken').textContent = mmss(spoken);

  renderScoresheet();
  renderAnswerSummary();
  show('finish');
}

// 질문마다 «무슨 질문 / 얼마나 / 어땠는지» 를 한 덩어리로 훑어봅니다.
// 학생 리포트에도 이 모양 그대로 들어갑니다.
function renderAnswerSummary() {
  // report.js 가 그리는 리포트와 같은 모양으로 맞춥니다.
  // 선생님이 마무리 화면에서 본 것과 학생이 받는 것이 달라서는 안 됩니다.
  document.getElementById('answer-summary').innerHTML =
    '<div class="rp-answers">' + questions.map(function (q, i) {
      var a = answers[i];
      return '<div class="ansrow">' +
        '<div class="anshead">' +
          '<span class="qno">' + (i + 1) + '</span>' +
          '<span class="qt">' + esc(q.text) + '</span>' +
          (a.rating ? '<span class="pill rate">' + esc(a.rating) + '</span>' : '') +
          '<span class="secs">' + mmss(a.seconds) + '</span>' +
        '</div>' +
        (q.competency && q.competency !== '기타'
          ? '<div class="anscomp">' + esc(q.competency) + ' 질문</div>' : '') +
        (a.good.length || a.bad.length
          ? '<div class="anstags">' +
              a.good.map(function (x) { return '<span class="minitag good">' + esc(x) + '</span>'; }).join('') +
              a.bad.map(function (x) { return '<span class="minitag bad">' + esc(x) + '</span>'; }).join('') +
            '</div>'
          : '') +
        (a.memo ? '<p class="ansmemo">' + esc(a.memo) + '</p>' : '') +
        '</div>';
    }).join('') + '</div>';
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

// 질문으로 돌아가면 면접이 아직 안 끝난 것이므로 전체 시간도 다시 흐릅니다.
// 단, 지난 회차를 열어 고치는 중이라면 시간은 그대로 두어야 합니다.
// 그러지 않으면 옛 면접의 «면접 전체» 가 실시간으로 불어납니다.
function backToRun() {
  if (liveInterview && !totalTimerId) {
    totalTimerId = setInterval(function () { totalSeconds++; paintTotal(); }, 1000);
  }
  show('run');
  showQuestion();
}

// ══════════════ 리포트 — 확인하고 전달 ══════════════

var viewing = null;   // 지금 보고 있는 리포트 { interview, answers, round }

// «면접 끝내기» — 저장만 하고 리포트를 띄웁니다. 아직 학생에게 가지 않습니다.
async function finishInterview() {
  var btn = document.getElementById('btn-finish');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '저장하는 중...';

  var patch = {
    finished_at: new Date().toISOString(),
    total_seconds: totalSeconds,
    grades: grades,
    overall_note: document.getElementById('finish-note').value.trim()
  };
  // 이미 학생에게 보낸 것을 고쳤다면, 고친 날을 남깁니다.
  if (viewing && viewing.interview && viewing.interview.status === '전달됨') {
    patch.edited_at = new Date().toISOString();
  } else {
    patch.status = '작성완료';
  }

  const { error } = await sb.from('interviews').update(patch).eq('id', interviewId);

  btn.disabled = false;
  btn.textContent = label;

  if (error) { toast('저장하지 못했습니다: ' + error.message, 'bad'); return; }
  liveInterview = false;   // 시간은 여기서 멈춥니다. 뒤에 고쳐도 더 흐르지 않습니다
  openReport(interviewId);
}

// 리포트 한 장을 띄웁니다. 학생이 받을 것과 같은 종이입니다.
async function openReport(id) {
  var box = document.getElementById('report-body');
  box.innerHTML = '<p class="empty">불러오는 중...</p>';
  show('report');

  var r = await fetchReport(id);
  if (r.error) { box.innerHTML = '<p class="empty">리포트를 못 읽었습니다: ' + esc(r.error) + '</p>'; return; }

  // 같은 면접을 다시 그릴 때는 회차 번호를 잃지 않게 챙겨 둡니다
  // (전달하고 나면 openReport 를 다시 부릅니다)
  var keepRound = (viewing && viewing.interview && viewing.interview.id === id) ? viewing.round : null;
  viewing = { interview: r.interview, answers: r.answers, round: keepRound };
  interviewId = id;

  var who = target ? target.student_no + ' ' + target.name : '';
  box.innerHTML = reportHTML(r.interview, r.answers, who, viewing.round);

  var sent = r.interview.status === '전달됨';
  document.getElementById('report-state').innerHTML = sent
    ? '<span class="pill ok2">학생이 보고 있습니다</span>'
    : '<span class="pill warn">아직 학생에게 안 갔습니다</span>';

  var d = document.getElementById('btn-deliver');
  d.textContent = sent ? '고친 내용 다시 알리기' : '학생에게 전달';
  document.getElementById('report-note').textContent = sent
    ? '이미 전달했습니다. 고친 내용은 학생이 새로고침하면 바로 보입니다.'
    : '전달을 눌러야 학생 폰에 보입니다. 그 전까지는 선생님만 볼 수 있습니다.';
}

async function deliverReport() {
  if (!interviewId) return;
  var btn = document.getElementById('btn-deliver');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '보내는 중...';

  var already = viewing && viewing.interview.status === '전달됨';
  var patch = already
    ? { edited_at: new Date().toISOString() }
    : { status: '전달됨', delivered_at: new Date().toISOString() };

  const { error } = await sb.from('interviews').update(patch).eq('id', interviewId);

  btn.disabled = false;
  btn.textContent = label;

  if (error) { toast('보내지 못했습니다: ' + error.message, 'bad'); return; }
  toast(already ? '고친 내용을 알렸습니다.' : '학생에게 전달했습니다.', 'ok');
  openReport(interviewId);
}

// 종이로 뽑습니다. 인쇄창에서 프린터 대신 «PDF로 저장» 을 고르면 PDF 도 됩니다.
function printTeacherReport() {
  var who = target ? target.student_no + ' ' + target.name : '';
  printReport('report-body', reportFileName(who, viewing && viewing.round));
}

// 잘못 시작한 면접, 시험 삼아 해 본 면접을 지웁니다.
// 질문·시간·평가는 interview_answers 에 있는데, 면접 줄을 지우면
// 서버에서 함께 지워집니다 (ON DELETE CASCADE).
async function deleteReport() {
  if (!interviewId) return;

  var iv = viewing && viewing.interview;
  var who = target ? target.student_no + ' ' + target.name : '이 학생';
  var msg = who + (iv ? ' · ' + ymd(iv.started_at) : '') + ' 면접 기록을 지웁니다.\n\n' +
            '질문·시간·평가·총평이 모두 함께 지워지고, 되돌릴 수 없습니다.';
  if (iv && iv.status === '전달됨') {
    msg += '\n이미 전달한 리포트라 학생 화면에서도 사라집니다.';
  }
  if (!confirm(msg + '\n\n정말 지울까요?')) return;

  const { error } = await sb.from('interviews').delete().eq('id', interviewId);
  if (error) { toast('지우지 못했습니다: ' + error.message, 'bad'); return; }

  var back = target;
  stopTimer();
  stopTotalTimer();
  liveInterview = false;
  interviewId = null;
  viewing = null;
  toast('리포트를 지웠습니다.', 'ok');

  // 지운 뒤에는 그 학생의 준비 화면으로. 지난 기록 목록이 새로 그려집니다.
  if (back) pickStudent(back.id); else backToList();
}

// 리포트에서 다시 고치러 갑니다.
function backToFinish() {
  document.getElementById('finish-note').value =
    (viewing && viewing.interview.overall_note) || '';
  renderScoresheet();
  renderAnswerSummary();
  show('finish');
}

// ══════════════ 지난 회차 다시 열기 ══════════════

// 누가기록입니다. 지난 면접을 눌러 그대로 다시 봅니다.
async function openPast(id, round) {
  var box = document.getElementById('report-body');
  box.innerHTML = '<p class="empty">불러오는 중...</p>';
  show('report');

  var r = await fetchReport(id);
  if (r.error) { box.innerHTML = '<p class="empty">리포트를 못 읽었습니다: ' + esc(r.error) + '</p>'; return; }

  // 고치기로 들어갈 수 있도록 화면 상태를 그 면접으로 되돌립니다.
  interviewId = id;
  viewing = { interview: r.interview, answers: r.answers, round: round };
  questions = r.answers.map(function (a) { return { text: a.question, competency: a.competency }; });
  answers = r.answers.map(function (a) {
    return { seconds: a.seconds || 0, good: a.good_tags || [], bad: a.bad_tags || [],
             rating: a.rating || null, memo: a.memo || '' };
  });
  grades = r.interview.grades || {};
  totalSeconds = r.interview.total_seconds || 0;
  qIndex = 0;
  liveInterview = false;   // 지난 회차입니다. 시간이 더 흐르면 안 됩니다
  stopTotalTimer();
  paintTotal();

  openReport(id);
}
