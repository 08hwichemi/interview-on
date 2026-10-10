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
//
// ⚠️ 문구를 더하거나 고칠 때 —
//   ① **«아쉬운 점» 을 넉넉히 둡니다.** 연습 면접이라 고칠 거리를 짚어 주는 것이
//      본업입니다. 좋았던 점만 많으면 학생이 무엇을 다듬어야 할지 모릅니다
//   ② **같은 말을 두 번 넣지 않습니다.** 예전에 「구체적 사례를 듦」과
//      「숫자·이름까지 말함」이 나란히 있었는데 결국 같은 말이라, 선생님이
//      어느 것을 누를지 망설이게 됩니다. 겹치면 하나로 합칩니다
//   ③ 한 눈에 읽히게 **열 자 안팎**으로 짧게 씁니다
//   ④ 지난 회차에서 쓰던 문구를 지워도 **그 리포트에는 그대로 남습니다**
//      (리포트는 저장된 글자를 그리고, 이 목록을 보지 않습니다).
//      다시 열어 고칠 때도 사라지지 않도록 tagPanelHTML() 이 «지난 기록» 줄에 붙여 줍니다
var TAGS = {
  // 무엇을 말했나 — 답변의 알맹이
  '내용': {
    good: ['질문의 핵심을 짚음', '개념을 정확히 씀', '동기가 분명함',
           '과정을 순서대로 설명', '배운 점까지 연결', '전공과 이어짐',
           '한계도 스스로 짚음'],
    bad:  ['질문을 빗나감', '개념이 부정확', '활동 나열에 그침',
           '과정 없이 결과만', '왜 했는지가 없음', '배운 점이 없음',
           '전공과 연결이 약함', '누구나 할 수 있는 답', '외운 티가 남',
           '용어를 뜻 모르고 씀']
  },
  // 그 말을 무엇으로 뒷받침했나
  '근거': {
    good: ['생기부 기록과 맞음', '구체적 사례를 듦', '직접 한 일이 드러남',
           '읽은 책·자료를 댐'],
    bad:  ['사례가 없음', '생기부 기록과 어긋남', '근거 없이 단정',
           '기록보다 부풀림', '사례가 질문과 안 맞음', '들은 이야기에 그침',
           '「열심히 했다」에 그침']
  },
  // 어떻게 말했나 — 전달
  '말하기': {
    // 두괄식인지 아닌지는 세 갈래로 가릅니다 —
    //   결론부터 말함(두괄식) / 결론이 맨 뒤에(미괄식) / 결론이 없음
    // 예전에는 «결론부터 말함» 만 있고 그 반대쪽이 없어서,
    // 두괄식이 아니었다는 것을 눌러서 남길 자리가 없었습니다.
    good: ['결론부터 말함(두괄식)', '또렷하고 알맞은 속도', '문장이 간결함',
           '길이가 알맞음', '모호하면 되물음'],
    bad:  ['결론이 맨 뒤에 나옴', '결론이 없음', '목소리가 작음', '말이 빠름',
           '말이 느림', '군더더기(음, 그)', '문장이 길어져 흐림',
           '답이 너무 짧음', '답이 너무 길어짐', '같은 말을 되풀이함',
           '말끝을 흐림']
  },
  // 몸과 마음가짐
  '태도': {
    good: ['눈을 맞춤', '자세가 바름', '끝까지 침착함', '모르는 건 솔직히 말함',
           '표정이 밝음', '끝까지 듣고 답함'],
    bad:  ['시선을 피함', '자세가 흐트러짐', '당황하면 말이 끊김', '긴장이 심함',
           '손·다리를 자꾸 움직임', '말을 끊고 답함', '표정이 굳음',
           '모르는데 얼버무림']
  }
};

// 태그를 다 누르지 못해도 이것 하나면 흐름이 읽힙니다.
var RATINGS = ['우수', '보통', '미흡'];

// 면접 중 영역별 한 줄 판정 (2026-10-10 선생님 말씀: 👍👎 만으로는 모자라다 —
// 영역을 대여섯으로 나눠 거기서 좋음·보통·아쉬움을 누르는 게 낫겠다).
// 위 TAGS 의 네 축에 «전공 연결» 을 더한 다섯 줄. 줄마다 하나만, 다시 누르면 지움.
// 마무리 화면에서도 같은 표를 고칠 수 있고, 리포트에 한 줄로 들어갑니다(report.js areasLine).
var AREAS = [
  { key: '내용',     desc: '질문의 핵심을 짚었나' },
  { key: '근거',     desc: '사례·기록으로 뒷받침했나' },
  { key: '말하기',   desc: '결론부터 · 알맞은 길이와 속도' },
  { key: '태도',     desc: '시선 · 자세 · 침착함' },
  { key: '전공 연결', desc: '지원 학과와 이어지나' }
];
var LEVELS = ['좋음', '보통', '아쉬움'];

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
//
// slot 을 같이 달아 둡니다. 면접 도중에 «질문 고치기» 로 돌아올 때
// 이걸 보고 첫인사·가운데·끝인사로 도로 풀어 놓습니다 (decomposeQuestions).
function composeQuestions() {
  var list = [];
  if (hasOpening()) list.push({ text: opening.text.trim(), competency: opening.comp, slot: 'opening' });
  midQuestions.forEach(function (q) {
    if (q.text.trim()) list.push({ text: q.text.trim(), competency: q.competency, slot: 'mid' });
  });
  if (hasClosing()) list.push({ text: closing.text.trim(), competency: '기타', slot: 'closing' });
  return list;
}

// ⚠️ 표에는 «첫인사/끝인사» 라는 칸이 없습니다 — 질문 글자만 남습니다.
//    그대로 읽으면 자기소개와 「마지막으로 하고 싶은 말」이 가운데 질문에 섞이고
//    준비 화면의 첫인사·끝인사 스위치가 꺼진 채로 뜹니다.
//    맨 앞·맨 뒤 글자를 아는 인사말과 견주어 제자리를 찾아 줍니다.
//    (선생님이 글자를 고쳤으면 그냥 가운데 질문이 됩니다 — 예전과 같습니다)
function putBackSlots(list) {
  var 인사말 = OPENINGS.map(function (o) { return o.text; });
  if (list.length && 인사말.indexOf(list[0].text) > -1) list[0].slot = 'opening';
  var 끝 = list.length - 1;
  if (끝 >= 0 && list[끝].text === CLOSING_TEXT) list[끝].slot = 'closing';
  return list;
}

// composeQuestions() 의 반대입니다. 준비 화면의 칸들을 지금 질문으로 채웁니다.
//
// ⚠️ 지난 회차를 열었을 때는 slot 이 없습니다 (표에 안 적습니다).
//    그때는 전부 «가운데 질문» 으로 폅니다. 첫인사·끝인사 칸을 억지로
//    맞히려다 엉뚱한 질문이 첫인사로 올라가는 것보다 낫습니다.
function decomposeQuestions(list) {
  midQuestions = [];
  opening = { on: false, key: opening.key, text: opening.text, comp: opening.comp };
  closing = { on: false, text: closing.text };

  (list || []).forEach(function (q) {
    if (q.slot === 'opening') { opening = { on: true, key: opening.key, text: q.text, comp: q.competency }; return; }
    if (q.slot === 'closing') { closing = { on: true, text: q.text }; return; }
    midQuestions.push({ text: q.text, competency: q.competency });
  });
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
var answers = [];         // [{ seconds, good, bad, rating, memo, transcript, marks, areas }]
var grades = {};          // { 평가항목: 'A'~'E' }

// 시간을 두 개 보여주지만, 시계는 하나입니다.
//   면접 전체   — 「면접 시작」을 누른 순간부터
//   이 질문 답변 — 지금 보고 있는 질문에 머문 시간
// 한 시계가 둘을 같이 올리므로 「일시정지」 한 번이면 둘 다 멈춥니다.
// 단추를 둘로 나눠 두면 하나만 멈춰 놓고 면접을 보다가 시간이 어긋납니다.
//
// 「면접 준비」의 «면접 시작» 은 화면만 넘깁니다. 시계는 진행 화면에서
// 선생님이 «면접 시작» 을 한 번 더 눌러야 흐릅니다. 학생을 앉히고
// 자리를 잡는 동안 시간이 가면 안 되기 때문입니다.
var tickId = null;
var ticking = false;      // 지금 시계가 흐르는 중인가
var startedOnce = false;  // 이 면접에서 「면접 시작」을 한 번이라도 눌렀는가
var seconds = 0;          // 지금 질문에 머문 시간
var totalSeconds = 0;     // 면접 전체
// 지금 이 면접이 «오늘 진행 중인 새 면접» 인지.
// 지난 회차를 열어 고칠 때는 시간이 더 흘러서는 안 됩니다.
// 이게 없어서, 옛 면접을 열고 «질문으로» 를 누르면 그 면접의 전체 시간이
// 실시간으로 불어났습니다.
var liveInterview = false;
// 면접을 하다가 «질문 고치기» 로 준비 화면에 돌아와 있는 중인가.
// 이때는 왼쪽 칸을 학생 명단으로 되돌리면 안 됩니다. 다른 학생을 누르면
// 지금 면접의 질문이 통째로 날아갑니다.
var editingMid = false;

// ── 공통 ──
function toast(msg, kind) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (kind || '');
  setTimeout(function () { el.className = 'toast ' + (kind || ''); }, 3000);
}

function show(view) {
  ['empty', 'setup', 'saenggibu', 'run', 'finish', 'report'].forEach(function (v) {
    document.getElementById('view-' + v).hidden = (v !== view);
  });
  // 면접 중에는 왼쪽 칸이 질문 진행 상황으로 바뀝니다.
  // 질문을 고치러 준비 화면에 와 있을 때도 마찬가지입니다 — 명단을 되돌려 놓으면
  // 다른 학생을 눌러서 지금 면접의 질문을 날려 버릴 수 있습니다.
  var inInterview = (view === 'run' || view === 'finish' || view === 'report') || editingMid;
  document.getElementById('rail-students').hidden = inInterview;
  document.getElementById('rail-progress').hidden = !inInterview;
  if (inInterview) renderRailProgress();
  window.scrollTo(0, 0);
}

// ══════════════ 머리말 메뉴 ══════════════
//
// 면접 | 실전 면접 후기 | 대학별 기출 질문
// 뒤의 둘은 학생 앱과 같은 자료를 같은 모양으로 보여줍니다 (reviews.js · questions.js).
// 선생님이 학생에게 "이런 질문이 나온다" 고 말하려면 같은 화면을 봐야 합니다.
var PAGES = ['interview', 'reviews', 'questions'];
var browseReady = false;   // 대학 목록을 이미 받아 뒀는지

function goPage(name) {
  PAGES.forEach(function (p) {
    document.getElementById('page-' + p).hidden = (p !== name);
    document.getElementById('nav-' + p).setAttribute('aria-current', p === name);
  });
  window.scrollTo(0, 0);
  // 대학 목록은 자료 전체를 한 번 훑어야 나옵니다.
  // 면접만 보시는 날에는 안 받도록, 처음 들어올 때 받습니다.
  if (name !== 'interview') loadBrowseOnce();
}

async function loadBrowseOnce() {
  if (browseReady) return;
  browseReady = true;
  try {
    await loadBrowseMeta();
  } catch (e) {
    browseReady = false;
    toast('자료를 불러오지 못했습니다: ' + ((e && e.message) || e), 'bad');
  }
}

// 학번 앞 3자리가 학년+반입니다 (3학년 2반 → 302)
function classKey(s) { return String(s.student_no).slice(0, 3); }

// ══════════════ 왼쪽 칸 — 학생 명단 ══════════════

async function loadStudents() {
  var box = document.getElementById('student-list');
  box.innerHTML = '<p class="empty">불러오는 중...</p>';

  const { data, error } = await sb
    .from('students')
    .select('id, student_no, name, auth_user_id, grade')
    .order('student_no');

  if (error) {
    box.innerHTML = '<p class="empty">명단을 불러오지 못했습니다: ' + esc(error.message) + '</p>';
    return;
  }

  students = data || [];
  if (!students.length) {
    document.getElementById('class-chips').hidden = true;
    document.getElementById('fav-box').hidden = true;
    box.innerHTML = '<p class="empty">아직 등록된 학생이 없습니다.<br>관리자 선생님께 명단 등록을 부탁하세요.</p>';
    return;
  }
  await loadFavorites();
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

// 학생 한 줄 — 고르는 단추와 별표 단추가 나란히 붙습니다.
// 단추 안에 단추를 넣을 수 없어서 감싸는 칸을 하나 둡니다.
function studentRow(s) {
  var on = target && target.id === s.id;
  var fav = favorites[s.id] === true;
  return '<div class="srow">' +
    '<button class="railrow" aria-current="' + !!on + '" onclick="pickStudent(\'' + s.id + '\')">' +
      '<span class="id">' + esc(s.student_no) + '</span>' +
      '<span class="nm">' + esc(s.name) + '</span>' +
    '</button>' +
    '<button class="star" aria-pressed="' + fav + '" onclick="toggleFavorite(\'' + s.id + '\')"' +
      ' title="' + (fav ? '담당 학생에서 빼기' : '담당 학생으로 담기') + '">★</button>' +
    '</div>';
}

// 지금 명단에 보이는 학생들 — 고른 반 · 찾는 말로 걸러진 것
function visibleStudents() {
  var list = students;
  if (pickedClass) list = list.filter(function (s) { return classKey(s) === pickedClass; });
  if (searchWord) {
    list = list.filter(function (s) {
      return String(s.student_no).indexOf(searchWord) > -1 || String(s.name).indexOf(searchWord) > -1;
    });
  }
  return list;
}
// «3학년 2반» · «전체» — 면접 후기 한꺼번에 받기 단추와 파일 이름에 씁니다
function visibleLabel() {
  var label = pickedClass ? pickedClass.charAt(0) + '학년 ' + Number(pickedClass.slice(1)) + '반' : '전체';
  return searchWord ? label + ' «' + searchWord + '»' : label;
}

// 면접 후기 한꺼번에 — 지금 명단에 보이는 학생들 것을 압축 파일 하나로 (hugi.js)
function downloadClassHugi() { hugiDownloadClass(visibleStudents(), visibleLabel()); }

function renderStudents() {
  var list = visibleStudents();
  var hb = document.getElementById('btn-hugi-class');
  if (hb) { hb.hidden = !list.length; hb.textContent = '🗒️ ' + visibleLabel() + ' 면접 후기 받기'; }

  var box = document.getElementById('student-list');
  document.getElementById('found-count').textContent = list.length;
  renderFavorites();
  if (!list.length) { box.innerHTML = '<p class="empty">찾는 학생이 없습니다.</p>'; return; }

  box.innerHTML = list.map(studentRow).join('');
}

// ══════════════ 담당 학생 (별표) ══════════════
//
// 전교생 명단에서 매번 우리 반 학생을 찾아 내리는 게 번거로워서,
// 별표를 눌러 둔 학생을 명단 맨 위에 따로 모아 둡니다.
// 브라우저가 아니라 계정에 붙여 두었으므로, 학교 컴퓨터에서 담아 두면
// 집에서 열어도 그대로 있습니다 (public.teacher_favorites).
var favorites = {};        // { student_id: true }

async function loadFavorites() {
  const { data, error } = await sb
    .from('teacher_favorites').select('student_id').eq('teacher_id', me.id);
  // 못 읽어도 명단 자체는 써야 하므로 조용히 넘어갑니다.
  if (error) { console.warn('담당 학생을 못 읽었습니다:', error.message); return; }
  favorites = {};
  (data || []).forEach(function (r) { favorites[r.student_id] = true; });
}

async function toggleFavorite(id) {
  var wasOn = favorites[id] === true;
  favorites[id] = !wasOn;     // 먼저 화면부터 바꿉니다. 누르자마자 반응해야 합니다
  renderStudents();

  var res = wasOn
    ? await sb.from('teacher_favorites').delete()
        .eq('teacher_id', me.id).eq('student_id', id)
    : await sb.from('teacher_favorites')
        .upsert({ teacher_id: me.id, student_id: id }, { onConflict: 'teacher_id,student_id' });

  if (res.error) {
    favorites[id] = wasOn;    // 서버가 거절하면 되돌립니다
    renderStudents();
    toast('담당 학생을 저장하지 못했습니다: ' + res.error.message, 'bad');
  }
}

function renderFavorites() {
  var picked = students.filter(function (s) { return favorites[s.id]; });
  var box = document.getElementById('fav-box');
  box.hidden = !picked.length;
  if (!picked.length) return;

  document.getElementById('fav-count').textContent = picked.length;
  // 반 고르기·이름 찾기와 상관없이 담아 둔 학생은 늘 다 보입니다.
  document.getElementById('fav-list').innerHTML = picked.map(studentRow).join('');
}

// ══════════════ 왼쪽 칸 — 질문 진행 상황 ══════════════

function renderRailProgress() {
  document.getElementById('progress-who').textContent =
    target ? target.student_no + ' ' + target.name : '';

  // 시간을 «건드린 질문만» 보여주니 1번에만 00:00 이 뜨고 나머지는 빈 줄이라
  // 고장난 것처럼 보였습니다. 이제 모든 줄에 똑같이 보여줍니다.
  document.getElementById('progress-list').innerHTML = questions.map(function (q, i) {
    var a = answers[i] || { seconds: 0, good: [], bad: [], rating: null, memo: '', transcript: '', marks: [], areas: {} };
    var done = a.seconds > 0 || a.good.length || a.bad.length || a.rating || a.memo ||
               a.transcript || (a.marks && a.marks.length) || Object.keys(a.areas || {}).length;
    return '<button class="railrow q" aria-current="' + (i === qIndex) + '" onclick="goToQuestion(' + i + ')">' +
      '<span class="qn">' + (i + 1) + '</span>' +
      '<span class="qt">' + esc(q.text) + '</span>' +
      '<span class="done' + (done ? '' : ' yet') + '">' +
        (a.rating ? esc(a.rating) + ' ' : '') + mmss(a.seconds) +
      '</span>' +
      '</button>';
  }).join('');
}

// ── 왼쪽 학생 명단 접기(휴대폰) ──
// 칸이 쌓이는 900px 이하에서는 명단이 준비 화면 위에 옵니다. 학생을 고르면
// 자동으로 접어서 준비 화면까지 스크롤을 덜 내리게 합니다(넓은 화면은 CSS가
// 아예 단추를 숨겨서 이 상태와 상관없이 늘 펼쳐진 채로 보입니다).
function isNarrowRail() {
  try { return window.matchMedia('(max-width:900px)').matches; } catch (e) { return false; }
}
var railFolded = false;
function paintRailFold() {
  var wrap = document.getElementById('rail-students');
  var btn = document.getElementById('rail-fold-btn');
  var label = document.getElementById('rail-fold-label');
  var who = document.getElementById('rail-fold-who');
  if (!wrap || !btn) return;
  wrap.classList.toggle('has-target', !!target);
  wrap.classList.toggle('folded', railFolded);
  btn.setAttribute('aria-expanded', railFolded ? 'false' : 'true');
  if (label) label.textContent = railFolded ? '펼치기' : '접기';
  if (who) who.textContent = target ? target.student_no + ' ' + target.name : '';
}
function toggleRailFold() {
  railFolded = !railFolded;
  paintRailFold();
}

// 면접을 접고 학생 목록으로 돌아갑니다.
// 예전에는 리포트 화면 위쪽의 작은 «닫기» 하나뿐이라 돌아갈 길을 못 찾았습니다.
function backToList() {
  if (liveInterview && interviewId) {
    if (!confirm('면접을 접고 학생 목록으로 갈까요?\n지금까지 기록은 남아 있고, 나중에 다시 열 수 있습니다.')) return;
  }
  stopTicking();
  liveInterview = false;
  editingMid = false;
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
  railFolded = false;   // 목록으로 돌아왔으니 접힘도 도로 풉니다
  paintRailFold();
  show('empty');
  loadUnfinished();   // 접은 면접이 '진행중' 이면 다시 이 목록에 뜹니다
}

// ══════════════ 준비 화면 안의 두 탭 — 면접 준비 / 답안 연습장 ══════════════
//
// 답안(질문·답변)은 학생이 혼자 쓰는 곳입니다(practice.js) — 선생님은 못 쓰고 못 지웁니다.
// 코멘트는 선생님이 답니다 — RLS 가 그렇게 갈라 둡니다.
// 마지막으로 보던 탭을 기억해 둡니다 — «답안 연습장» 을 보다가 다른 학생을 고르면
// 그 학생의 같은 탭이 바로 뜹니다(pickStudent 가 씁니다). 면접 도중 질문을 고치러
// 돌아올 때는(editQuestions) 이 기억과 상관없이 늘 «면접 준비» 로 갑니다.
var teacherLastGoTab = 'prep';

function setupGoTab(which) {
  teacherLastGoTab = which;
  document.getElementById('setup-tab-prep').setAttribute('aria-current', which === 'prep');
  document.getElementById('setup-tab-practice').setAttribute('aria-current', which === 'practice');
  document.getElementById('setup-prep').hidden = which !== 'prep';
  document.getElementById('setup-practice').hidden = which !== 'practice';
  document.getElementById('setup-tab-hugi').setAttribute('aria-current', which === 'hugi');
  document.getElementById('setup-hugi').hidden = which !== 'hugi';
  if (which === 'hugi' && target) hugiTeacherTab(target);
  if (which === 'practice' && target) {
    practiceBrowseInit(target.id, {
      gradeBox: document.getElementById('t-prac-grade'),
      catBox: document.getElementById('t-prac-cat'),
      list: document.getElementById('t-prac-list')
    }, { canComment: true, fboxKey: 'teacher' });
  }
}

// ══════════════ 준비 ══════════════

async function pickStudent(id) {
  // 면접 도중 질문을 고치는 중이라면 명단이 보이지 않지만, 혹시 몰라 막아 둡니다.
  if (editingMid) return;
  target = students.filter(function (s) { return s.id === id; })[0];
  if (!target) return;

  renderStudents();   // 고른 줄 표시
  railFolded = isNarrowRail();   // 휴대폰에서는 고르자마자 명단을 접습니다
  paintRailFold();
  document.getElementById('target-name').textContent = target.student_no + ' ' + target.name;
  // 이 학생에게 바로 말을 걸 수 있습니다. 계정이 없으면 단추를 숨깁니다.
  var talk = document.getElementById('btn-talk');
  talk.hidden = !target.auth_user_id;
  talk.onclick = function () {
    openChatRoom(target.auth_user_id, target.student_no + ' ' + target.name);
  };
  midQuestions = [];
  questions = [];
  interviewId = null;
  resetGreetings();
  renderGreetings();
  renderQuestions();
  setupGoTab(teacherLastGoTab);   // 마지막으로 보던 탭을 그대로 이어 갑니다
  show('setup');
  paintHistoryAcc();   // 학생을 고를 때마다 접힌 상태를 다시 맞춥니다 (휴대폰: 접어서 스크롤 줄이기)
  paintQsect();
  loadSheet();      // 미리 만들어 둔 질문지가 있으면 그대로 펴 놓습니다
  loadHistory();
  loadSusi();       // 수시로 어디에 지원했는지 (있으면)
}

// ══════════════ 끝내지 못한 면접 이어서 하기 ══════════════
//
// 면접 도중 컴퓨터가 꺼지거나 창을 닫으면 그 면접은 서버에 status='진행중' 인
// 채로 남습니다. 선생님이 다시 들어와도 어느 학생이었는지 저절로는 못 찾으므로,
// 아무도 안 고른 첫 화면에 그런 면접을 모아 보여 주고 눌러서 이어 가게 합니다.
async function loadUnfinished() {
  var box = document.getElementById('unfinished');
  var list = document.getElementById('unfinished-list');
  if (!box || !list || !me) return;
  box.hidden = true;

  const { data, error } = await sb.from('interviews')
    .select('id, student_id, started_at')
    .eq('teacher_id', me.id).eq('status', '진행중')
    .order('started_at', { ascending: false });
  // 못 읽어도 화면은 그냥 써야 하니 조용히 넘어갑니다.
  if (error || !data || !data.length) return;

  list.innerHTML = data.map(function (iv) {
    var s = students.filter(function (x) { return x.id === iv.student_id; })[0];
    var who = s ? (s.student_no + ' ' + s.name) : '(알 수 없는 학생)';
    var d = new Date(iv.started_at);
    return '<button class="row pickable" onclick="resumeInterview(\'' + iv.id + '\')">' +
      '<span class="who">' +
        '<span class="nm">' + esc(who) + '</span>' +
        '<span class="sub">' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 시작</span>' +
      '</span>' +
      '<span class="acts"><span class="go">이어서 하기 →</span></span></button>';
  }).join('');
  box.hidden = false;
}

// 창이 닫혀 끝내지 못한 면접을 되찾아 진행 화면으로 돌아갑니다.
// ⚠️ 그동안 창이 얼마나 오래 닫혀 있었는지는 서버에 안 남아 있어 알 길이 없습니다
//    (실시간으로 흐르는 시계는 브라우저 안에서만 돕니다 — docs/할-일.md 의
//    «학생 폰에 면접 시간 띄우기» 아이디어가 해결책입니다). 그래서 시계는 멈춘
//    채로 두고, 「면접 전체」시간은 이미 매긴 질문들의 시간을 더한 값으로
//    다시 채웁니다 — 정확하진 않아도 0 보다는 낫습니다.
async function resumeInterview(id) {
  var r = await fetchReport(id);
  if (r.error) { toast('불러오지 못했습니다: ' + r.error, 'bad'); return; }
  var iv = r.interview;

  target = students.filter(function (s) { return s.id === iv.student_id; })[0] ||
           { id: iv.student_id, student_no: '', name: '(알 수 없음)' };
  renderStudents();
  railFolded = isNarrowRail();
  paintRailFold();
  document.getElementById('target-name').textContent = target.student_no + ' ' + target.name;
  var talk = document.getElementById('btn-talk');
  talk.hidden = !target.auth_user_id;
  talk.onclick = function () { openChatRoom(target.auth_user_id, target.student_no + ' ' + target.name); };

  questions = putBackSlots((r.answers || []).map(function (a) {
    return { text: a.question, competency: a.competency };
  }));
  answers = (r.answers || []).map(function (a) {
    return { seconds: a.seconds || 0, good: a.good_tags || [], bad: a.bad_tags || [],
             rating: a.rating || null, memo: a.memo || '',
             transcript: a.transcript || '', marks: a.marks || [], areas: a.areas || {} };
  });
  grades = iv.grades || {};

  interviewId = id;
  sheetId = null; sheetSavedAt = null;
  editingMid = false;
  liveInterview = true;
  startedOnce = true;      // 이미 «면접 시작» 을 한 번 눌렀던 면접이라, 다음엔 «이어서» 로 뜹니다
  totalSeconds = answers.reduce(function (n, a) { return n + a.seconds; }, 0);
  stopTicking();
  paintTotal();

  // 아직 아무것도 안 매긴 첫 질문부터 이어 갑니다. 다 매겼으면 마지막 질문에 둡니다.
  qIndex = 0;
  for (var i = 0; i < answers.length; i++) {
    qIndex = i;
    var a = answers[i];
    if (!(a.seconds > 0 || a.good.length || a.bad.length || a.rating || a.memo ||
          a.transcript || (a.marks && a.marks.length) || Object.keys(a.areas || {}).length)) break;
  }

  paintHistoryAcc();
  paintQsect();
  loadHistory();
  loadSusi();
  document.getElementById('unfinished').hidden = true;

  show('run');
  showQuestion();
  toast('이어서 진행합니다. 시계를 눌러야 다시 흐릅니다.', 'ok');
}

// ══════════════ 미리 만들어 두는 질문지 ══════════════
//
// 선생님은 학생이 배정되면 생기부를 보고 **면접 전에 미리** 질문을 만들어 둡니다.
// 그래서 학생마다 질문지를 하나 저장해 두고, 면접 날에는 학생을 고르기만 하면
// 그 질문지가 그대로 뜨게 했습니다.
//
// 표를 새로 만들지 않고 interviews 를 씁니다 — **status 가 '준비중' 인 줄이 질문지**입니다.
//   · 질문 글자는 이미 interview_answers 에 넣게 되어 있습니다 (점수·시간만 비워 둡니다)
//   · 학생은 '전달됨' 만 볼 수 있으므로 (RLS) 질문지는 학생에게 안 보입니다
//   · 「면접 시작」을 누르면 **그 줄이 그대로 '진행중'** 이 됩니다. 새로 만들지 않습니다
//   · 지난 면접 목록에서는 빼 둡니다 — 회차가 아니니까요
//
// ⚠️ 표에 '준비중' 을 허락해 두어야 합니다 (docs/할-일.md 의 SQL 한 줄).
var sheetId = null;        // 지금 학생의 «준비중» 줄 id
var sheetSavedAt = null;

function paintSheetNote() {
  var box = document.getElementById('sheet-note');
  if (!box) return;
  box.hidden = !sheetId;
  if (!sheetId) return;
  var when = sheetSavedAt ? new Date(sheetSavedAt) : null;
  document.getElementById('sheet-when').textContent = when
    ? (when.getMonth() + 1) + '월 ' + when.getDate() + '일에 저장' : '';
}

// 학생을 고르면 저장해 둔 질문지를 그대로 펴 놓습니다.
async function loadSheet() {
  sheetId = null; sheetSavedAt = null;
  paintSheetNote();
  if (!target || !me) return;

  const { data, error } = await sb.from('interviews')
    .select('id, started_at')
    .eq('student_id', target.id).eq('teacher_id', me.id).eq('status', '준비중')
    .order('started_at', { ascending: false }).limit(1);
  if (error || !data || !data.length) return;

  const rows = await sb.from('interview_answers')
    .select('seq, question, competency')
    .eq('interview_id', data[0].id).order('seq', { ascending: true });
  if (rows.error) return;

  sheetId = data[0].id;
  sheetSavedAt = data[0].started_at;
  decomposeQuestions(putBackSlots((rows.data || []).map(function (a) {
    return { text: a.question, competency: a.competency || '기타' };
  })));
  renderGreetings();
  renderQuestions();
  paintSheetNote();
}

// 질문지 줄('준비중')을 챙기고 질문을 통째로 다시 씁니다.
// 「질문지 저장」과 「면접 화면으로」가 같이 씁니다. 실패하면 false.
async function keepSheet(list) {
  if (!sheetId) {
    const ins = await sb.from('interviews').insert({
      school_id: SCHOOL_ID,
      student_id: target.id,
      teacher_id: me.id,
      teacher_name: me.name || '',
      status: '준비중'
    }).select('id, started_at').single();
    if (ins.error) {
      // 표가 아직 '준비중' 을 막고 있는 경우입니다. 무엇을 해야 하는지 알려 줍니다.
      if (/status_check/.test(ins.error.message || '')) {
        alert('질문지 기능을 쓰려면 Supabase 에서 아래 SQL 을 한 번 돌려야 합니다.\n' +
              '(Supabase → SQL Editor → 붙여넣고 Run)\n\n' +
              "alter table public.interviews\n" +
              "  drop constraint if exists interviews_status_check,\n" +
              "  add constraint interviews_status_check\n" +
              "    check (status in ('준비중','진행중','작성완료','전달됨'));");
        toast('표에 «준비중» 을 아직 허락하지 않았습니다.', 'bad');
        return false;
      }
      toast('질문지를 저장하지 못했습니다: ' + ins.error.message, 'bad');
      return false;
    }
    sheetId = ins.data.id; sheetSavedAt = ins.data.started_at;
  }

  // 뺀 질문이 남지 않게 통째로 다시 씁니다.
  var res = await sb.from('interview_answers').delete().eq('interview_id', sheetId);
  if (!res.error) {
    var rows = list.map(function (q, i) {
      return { interview_id: sheetId, seq: i + 1,
               competency: q.competency, question: q.text,
               seconds: 0, good_tags: [], bad_tags: [], memo: '' };
    });
    res = await sb.from('interview_answers').insert(rows);
  }
  if (res.error) { toast('질문지를 저장하지 못했습니다: ' + res.error.message, 'bad'); return false; }
  paintSheetNote();
  return true;
}

// 「질문지 저장」 — 면접은 시작하지 않고 질문만 남겨 둡니다.
async function saveSheet() {
  var list = composeQuestions();
  if (!list.length) { toast('저장할 질문이 없습니다.', 'bad'); return; }

  var btn = document.getElementById('btn-save-sheet');
  btn.disabled = true; btn.textContent = '저장하는 중...';
  var ok = await keepSheet(list);
  btn.disabled = false; btn.textContent = '질문지 저장';
  if (ok) toast('질문지를 저장했습니다. 면접 날 이 학생을 고르면 그대로 뜹니다.');
}

// 저장해 둔 질문지를 버립니다 (화면의 질문은 그대로 둡니다).
// ⚠️ 교사 화면에는 showConfirm() 이 없습니다 — 그건 학생 앱(ui.js) 것입니다.
//    여기서는 다른 지우기들과 같이 브라우저 confirm 을 씁니다.
async function deleteSheet() {
  if (!sheetId) return;
  if (!confirm('저장해 둔 질문지를 지울까요?\n화면에 있는 질문은 그대로 둡니다.')) return;

  var id = sheetId;
  sheetId = null; sheetSavedAt = null;
  paintSheetNote();
  await sb.from('interview_answers').delete().eq('interview_id', id);
  const { error } = await sb.from('interviews').delete().eq('id', id);
  if (error) { toast('질문지를 지우지 못했습니다: ' + error.message, 'bad'); return; }
  toast('질문지를 지웠습니다.');
}

async function loadHistory() {
  var box = document.getElementById('history');
  box.innerHTML = '<p class="empty">지난 기록 확인 중...</p>';

  const { data, error } = await sb
    .from('interviews')
    .select('id, started_at, status, teacher_name, grades')
    .eq('student_id', target.id)
    .neq('status', '준비중')        // 미리 만들어 둔 질문지는 회차가 아닙니다
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

// ══════════════ 수시 지원 현황 ══════════════
//
// 학생이 어디에 지원했는지는 «수시지원계획서» 앱에 있습니다 — 다른 Supabase 방입니다.
// 화면에서 그 방을 직접 부르면 그 방의 열쇠를 브라우저에 넣어야 하고,
// 그러면 누구나 전교생 지원 현황을 볼 수 있게 됩니다.
// 그래서 서버에서 서버로 한 번 받아 둔 사본(susi_plans)을 봅니다.
//   · 담는 것은 «대학명 · 전형 · 학과 · 면접 날짜» 뿐입니다 (성적·합불은 안 가져옵니다)
//   · 학번으로 맞춥니다
//   · 새로 받아 오는 것은 관리자 화면의 「수시 지원 자료 새로 받기」 단추입니다
// '2026/10/16' → '10/16',  '2026/09/21 ~ 2026/09/23' → '09/21~09/23'
// 해는 어차피 올해라 자리만 차지합니다.
function susiDate(s) {
  return String(s || '').replace(/\d{4}\//g, '').replace(/\s*~\s*/, '~').trim();
}

async function loadSusi() {
  var box  = document.getElementById('susi-box');
  var list = document.getElementById('susi');
  if (!box || !list || !target) return;
  box.hidden = true;

  // «수시 6장»(area='main') 만 씁니다. 후보·전문대는 면접 준비에 쓰지 않습니다.
  const { data, error } = await sb.from('susi_plans')
    .select('slot, uni_name, type_name, admission_name, dept_name, interview_date, synced_at')
    .eq('student_no', target.student_no)
    .eq('area', 'main');

  // 표가 아직 없거나 권한이 없으면 조용히 접어 둡니다 — 면접에 꼭 필요한 자료는 아닙니다.
  if (error || !data || !data.length) return;

  var rows = data.slice().sort(function (a, z) { return (a.slot || 0) - (z.slot || 0); });

  var when = rows[0].synced_at ? new Date(rows[0].synced_at) : null;
  document.getElementById('susi-when').textContent = when
    ? '(' + (when.getMonth() + 1) + '월 ' + when.getDate() + '일에 받아 온 자료)'
    : '(수시지원계획서 앱)';

  // 한 지원에 한 줄입니다. 칸을 거의 안 쓰도록 테두리 없이 촘촘하게 적습니다.
  // 전형 이름은 길어서 넘치면 …으로 자릅니다 (마우스를 올리면 다 보입니다).
  list.innerHTML = rows.map(function (r) {
    var iv  = susiDate(r.interview_date);
    var adm = [r.type_name, r.admission_name].filter(Boolean).join(' · ');
    return '<div class="susirow' + (iv ? ' hasiv' : '') + '">' +
        '<span class="sn">' + (r.slot || '') + '</span>' +
        '<span class="uni">' + esc(r.uni_name || '') + '</span>' +
        '<span class="dept">' + esc(r.dept_name || '') + '</span>' +
        '<span class="adm" title="' + esc(adm) + '">' + esc(adm) + '</span>' +
        (iv ? '<span class="iv">면접 ' + esc(iv) + '</span>' : '') +
      '</div>';
  }).join('');

  // 접었을 때도 «무엇이 들어 있는지» 는 보이게 합니다.
  var 면접수 = rows.filter(function (r) { return susiDate(r.interview_date); }).length;
  document.getElementById('susi-count').textContent =
    rows.length + '곳' + (면접수 ? ' · 면접 ' + 면접수 + '곳' : '');

  paintSusi();
  box.hidden = false;
}

// ── 아코디언 ──
// **처음에는 펴 놓습니다.** 접힌 채로 두면 자료가 있는지조차 모릅니다.
// 한 번 접거나 펴면 그 상태가 이 브라우저에 남습니다 — 매번 다시 누르지 않게.
var susiOpen = (function () {
  try {
    var v = localStorage.getItem('susiOpen');
    return v === null ? true : v === '1';   // 처음 오신 분은 펼친 채로
  } catch (e) { return true; }              // 사생활 보호 모드도 펼친 채로
})();

function paintSusi() {
  var list  = document.getElementById('susi');
  var btn   = document.getElementById('susi-more');
  var label = document.getElementById('susi-more-label');
  if (!list || !btn) return;
  list.hidden = !susiOpen;
  if (label) label.textContent = susiOpen ? '접기' : '펼치기';
  btn.setAttribute('aria-expanded', susiOpen ? 'true' : 'false');
}

function toggleSusi() {
  susiOpen = !susiOpen;
  try { localStorage.setItem('susiOpen', susiOpen ? '1' : '0'); } catch (e) { /* 사생활 보호 모드 */ }
  paintSusi();
}

// 휴대폰(좁은 화면)에서는 학생을 고르면 스크롤이 너무 길어져서,
// 「지난 면접」과 「질문지 만들기」도 접었다 펼 수 있게 했습니다.
// 처음 오신 분은: 휴대폰이면 접힌 채로, 넓은 화면이면 펼친 채로 시작합니다.
// 한 번 누르면 그 상태가 이 브라우저에 남습니다.
function isNarrowScreen() {
  try { return window.matchMedia('(max-width:640px)').matches; } catch (e) { return false; }
}
function accDefaultOpen(key) {
  try {
    var v = localStorage.getItem(key);
    if (v !== null) return v === '1';
  } catch (e) { /* 사생활 보호 모드 */ }
  return !isNarrowScreen();
}

var historyAccOpen = accDefaultOpen('historyAccOpen');
function paintHistoryAcc() {
  var body  = document.getElementById('history');
  var head  = document.getElementById('history-acc-head');
  var label = document.getElementById('history-acc-label');
  if (!body || !head) return;
  body.hidden = !historyAccOpen;
  if (label) label.textContent = historyAccOpen ? '접기' : '펼치기';
  head.setAttribute('aria-expanded', historyAccOpen ? 'true' : 'false');
}
function toggleHistoryAcc() {
  historyAccOpen = !historyAccOpen;
  try { localStorage.setItem('historyAccOpen', historyAccOpen ? '1' : '0'); } catch (e) { /* 사생활 보호 모드 */ }
  paintHistoryAcc();
}

var qsectOpen = accDefaultOpen('qsectOpen');
function paintQsect() {
  var body  = document.getElementById('qsect-body');
  var head  = document.getElementById('qsect-head');
  var label = document.getElementById('qsect-more-label');
  if (!body || !head) return;
  body.hidden = !qsectOpen;
  if (label) label.textContent = qsectOpen ? '접기' : '펼치기';
  head.setAttribute('aria-expanded', qsectOpen ? 'true' : 'false');
}
function toggleQsect() {
  qsectOpen = !qsectOpen;
  try { localStorage.setItem('qsectOpen', qsectOpen ? '1' : '0'); } catch (e) { /* 사생활 보호 모드 */ }
  paintQsect();
}

function addQuestion(text, competency) {
  midQuestions.push({ text: text || '', competency: competency || '기타' });
  renderQuestions();
  // 단추가 맨 위로 올라가서 새 빈 칸은 멀리 아래에 생깁니다. 그 칸으로 옮겨 가 바로 글자를 치게 합니다.
  if (!text) {
    var inputs = document.querySelectorAll('#q-list .qrow input');
    var last = inputs[inputs.length - 1];
    if (last) { last.scrollIntoView({ block: 'center' }); last.focus({ preventScroll: true }); }
  }
}
function removeQuestion(i) { midQuestions.splice(i, 1); renderQuestions(); }
function setQText(i, v) { midQuestions[i].text = v; renderGreetings(); }
function setQComp(i, v) { midQuestions[i].competency = v; }

function renderQuestions() {
  var box = document.getElementById('q-list');
  // 첫인사가 1번이면 가운데 질문은 2번부터입니다. 화면 번호와 실제 순서를 맞춥니다.
  var base = hasOpening() ? 1 : 0;
  if (!midQuestions.length) {
    box.innerHTML = '<p class="empty">아직 질문이 없습니다. 위 «질문 더하기» 에서 더하세요.</p>';
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
  var 전체 = composeQuestions();
  // 구역 머리줄에 «질문 몇 개» 를 적어 둡니다 (첫인사·끝인사까지 셉니다)
  var cnt = document.getElementById('q-count');
  if (cnt) cnt.textContent = 전체.length ? '질문 ' + 전체.length + '개' : '';
  var 빔 = 전체.length === 0;
  document.getElementById('btn-start').disabled = 빔;
  var save = document.getElementById('btn-save-sheet');
  if (save) {
    save.disabled = 빔;
    // 면접을 하다가 질문을 고치러 온 중이면 «질문지» 가 아니라 «지금 면접» 입니다.
    save.hidden = editingMid;
  }
  paintStartButton();
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

// ── 학생 질문 — 학생이 답안 연습장에 쓴 질문을 «낼 질문» 으로 끌어오기 (2026-10-07 선생님 말씀) ──
// «생기부에서 뽑기» 옆 단추. 고른 학생이 연습장에 쓴 질문을 학년 · 분류로 묶어 보여 주고,
// 여러 개 체크해서 «질문 넣기» 를 누르면 «낼 질문» 맨 아래에 붙습니다(글자는 거기서 고쳐 쓰시면 됩니다).
// 짜임은 학생 앱의 «받은 질문» 창과 같습니다 — 위에 학년·분류 칩(여러 개, 안 고르면 전부,
// 쓴 것에 있는 것만), 그 아래 «전체 선택», 「3학년 · 진로」 머리줄마다 질문 카드.
// 이미 «낼 질문» 에 같은 글자가 있으면 체크칸을 막아 두 번 들어가지 않게 합니다.
// 서버 요청: 창을 열 때 1번(답안 연습장 탭과 같은 practice_answers 읽기). 넣을 때는 요청 없음.
var SQ = { list: [], picked: {}, grades: [], cats: [], studentId: null };
// 분류 → 무엇을 보는 질문인지. 낼 질문 칸에서 바꿀 수 있습니다. 모르는 분류(학생이 만든 것)는 «기타»
var SQ_COMP = { '인성': '공동체역량', '자율': '공동체역량', '동아리': '공동체역량', '행발': '공동체역량',
                '진로': '진로역량', '세특': '학업역량' };
var SQ_GRADE_ORDER = ['1', '2', '3', '공통'];

async function openStudentQs() {
  if (!target) return;
  var overlay = document.getElementById('sq-overlay');
  var box = document.getElementById('sq-list');
  // 다른 학생으로 바꿨으면 칩도 새로 — 같은 학생이면 골라 둔 칩을 그대로 둡니다
  if (SQ.studentId !== target.id) SQ = { list: [], picked: {}, grades: [], cats: [], studentId: target.id };
  SQ.list = []; SQ.picked = {};
  document.getElementById('sq-title').textContent = '✍️ 학생 질문 — ' + target.name;
  box.innerHTML = '<p class="prac-empty">불러오는 중...</p>';
  paintStudentQsBtn();
  overlay.style.display = 'flex';
  var rows = await fetchPracticeAnswers(target.id);
  if (SQ.studentId !== target.id) return;   // 불러오는 사이 다른 학생을 골랐으면 버립니다
  SQ.list = rows.filter(function (a) { return String(a.question || '').trim(); });
  paintStudentQs();
}
function closeStudentQs() { document.getElementById('sq-overlay').style.display = 'none'; }

function sqGrade(a) { return SQ_GRADE_ORDER.indexOf(a.grade) > -1 ? a.grade : '공통'; }
function sqCat(a) { return a.category || '분류 없음'; }
// 분류 순서: 연습장의 기본 분류 → 학생이 만든 분류(가나다)
function sqCatOrder(c) {
  var i = PRACTICE_FIXED_CATS.indexOf(c);
  return i > -1 ? i : PRACTICE_FIXED_CATS.length;
}
function sqSort(list) {
  return list.slice().sort(function (x, y) {
    return (SQ_GRADE_ORDER.indexOf(sqGrade(x)) - SQ_GRADE_ORDER.indexOf(sqGrade(y))) ||
           (sqCatOrder(sqCat(x)) - sqCatOrder(sqCat(y))) ||
           sqCat(x).localeCompare(sqCat(y)) ||
           String(x.created_at).localeCompare(String(y.created_at));
  });
}
// 이미 «낼 질문» 에 같은 글자가 있는가
function sqAlreadyIn(a) {
  var t = String(a.question).trim();
  return midQuestions.some(function (q) { return String(q.text || '').trim() === t; });
}
// 칩에 걸리는(지금 보이는) 질문 중 넣을 수 있는 것
function sqVisible() {
  return SQ.list.filter(function (a) {
    return practiceMatchFilter(sqGrade(a), SQ.grades) && practiceMatchFilter(sqCat(a), SQ.cats);
  });
}
function sqPickable() { return sqVisible().filter(function (a) { return !sqAlreadyIn(a); }); }
function sqToggleGrade(g) { practiceToggleIn(SQ.grades, g); paintStudentQs(); }
function sqToggleCat(c) { practiceToggleIn(SQ.cats, c); paintStudentQs(); }

function paintStudentQs() {
  var box = document.getElementById('sq-list');
  var gradesHere = SQ_GRADE_ORDER.filter(function (g) { return SQ.list.some(function (a) { return sqGrade(a) === g; }); });
  var catsHere = [];
  sqSort(SQ.list).forEach(function (a) { if (catsHere.indexOf(sqCat(a)) === -1) catsHere.push(sqCat(a)); });
  catsHere.sort(function (x, y) { return (sqCatOrder(x) - sqCatOrder(y)) || x.localeCompare(y); });
  SQ.grades = SQ.grades.filter(function (g) { return gradesHere.indexOf(g) > -1; });
  SQ.cats = SQ.cats.filter(function (c) { return catsHere.indexOf(c) > -1; });

  var html;
  if (!SQ.list.length) {
    html = '<p class="prac-empty">이 학생은 아직 답안 연습장에 질문을 쓰지 않았습니다.</p>';
  } else {
    var visible = sqSort(sqVisible());
    html = '<p class="prac-hint">학생이 답안 연습장에 쓴 질문입니다. 골라서 「질문 넣기」를 누르면 «낼 질문» 맨 아래에 붙습니다. ' +
           '글자는 거기서 고쳐 쓰셔도 됩니다.</p>' +
      '<div class="prac-offer-filter">' +
        '<div class="prac-offer-frow"><span class="prac-offer-flabel">학년</span><div class="prac-chips">' +
          gradesHere.map(function (g) {
            return '<button class="prac-chip" aria-pressed="' + (SQ.grades.indexOf(g) > -1) + '" onclick="sqToggleGrade(\'' + g + '\')">' +
                   esc(practiceOfferGradeText(g)) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="prac-offer-frow"><span class="prac-offer-flabel">분류</span><div class="prac-chips">' +
          practiceFilterChipsHTML(catsHere, SQ.cats, 'sqToggleCat') + '</div></div>' +
      '</div>';
    var narrowed = SQ.grades.length || SQ.cats.length;
    html += '<label class="prac-offer-bar"><input type="checkbox" id="sq-all" onchange="sqToggleAll()">' +
              '<b>전체 선택</b><span>' + (narrowed ? '골라 본 질문 ' : '쓴 질문 ') + visible.length + '개' +
              (narrowed ? ' / 전체 ' + SQ.list.length + '개' : '') + '</span></label>';
    if (!visible.length) html += '<p class="prac-empty">고른 학년·분류에 맞는 질문이 없습니다.</p>';
    var lastKey = null;
    visible.forEach(function (a) {
      var key = sqGrade(a) + '|' + sqCat(a);
      if (key !== lastKey) {
        var n = visible.filter(function (x) { return sqGrade(x) + '|' + sqCat(x) === key; }).length;
        html += '<p class="prac-offer-group">' + esc(practiceOfferGradeText(sqGrade(a)) + ' · ' + sqCat(a)) +
                ' <span>' + n + '개</span></p>';
        lastKey = key;
      }
      var inAlready = sqAlreadyIn(a);
      var on = !inAlready && !!SQ.picked[a.id];
      var hasAnswer = String(a.answer || '').trim();
      html += '<div class="prac-offer' + (on ? ' on' : '') + (inAlready ? ' sq-in' : '') + '" data-id="' + esc(a.id) + '">' +
        '<label class="prac-offer-pick"><input type="checkbox"' + (on ? ' checked' : '') + (inAlready ? ' disabled' : '') +
          ' onchange="sqToggle(\'' + esc(a.id) + '\')">' +
          '<span class="prac-offer-q">' + esc(String(a.question).trim()) + '</span></label>' +
        '<div class="prac-offer-foot"><span>' + (hasAnswer ? '답 씀' : '답은 아직 안 씀') + ' · ' + esc(practiceWhen(a)) + '</span>' +
          (inAlready ? '<span class="sq-tag">낼 질문에 있음</span>' : '') + '</div>' +
        '</div>';
    });
  }
  // 칩을 눌러 다시 그려도 읽던 자리가 맨 위로 튀지 않게
  var keepTop = box.scrollTop;
  box.innerHTML = html;
  box.scrollTop = keepTop;
  paintStudentQsBtn();
}

// 체크할 때마다 다시 그리면 창 안의 스크롤이 튑니다 — 그 줄과 단추만 고칩니다
function sqToggle(id) {
  if (SQ.picked[id]) delete SQ.picked[id]; else SQ.picked[id] = true;
  var row = document.querySelector('#sq-list .prac-offer[data-id="' + id + '"]');
  if (row) row.classList.toggle('on', !!SQ.picked[id]);
  paintStudentQsBtn();
}
// 전체 선택 ↔ 해제 — 지금 보이는 것 중 «낼 질문» 에 아직 없는 것만
function sqToggleAll() {
  var list = sqPickable();
  var all = list.length && list.every(function (a) { return SQ.picked[a.id]; });
  list.forEach(function (a) {
    if (all) delete SQ.picked[a.id]; else SQ.picked[a.id] = true;
    var row = document.querySelector('#sq-list .prac-offer[data-id="' + a.id + '"]');
    if (row) {
      row.classList.toggle('on', !all);
      var cb = row.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = !all;
    }
  });
  paintStudentQsBtn();
}
function paintStudentQsBtn() {
  var allBox = document.getElementById('sq-all');
  if (allBox) {
    var list = sqPickable();
    var some = list.filter(function (a) { return SQ.picked[a.id]; }).length;
    allBox.checked = list.length > 0 && some === list.length;
    allBox.indeterminate = some > 0 && some < list.length;
    allBox.disabled = list.length === 0;
  }
  var btn = document.getElementById('sq-add');
  if (!btn) return;
  var n = Object.keys(SQ.picked).length;
  btn.disabled = n === 0;
  btn.textContent = n ? '고른 ' + n + '개 질문 넣기' : '넣을 질문을 고르세요';
}

// 고른 질문을 «낼 질문» 맨 아래에 붙이고 창을 닫습니다. 고른 순서가 아니라 창에 보이던 순서(학년 → 분류)대로.
function addStudentQs() {
  var picks = sqSort(SQ.list.filter(function (a) { return SQ.picked[a.id] && !sqAlreadyIn(a); }));
  if (!picks.length) return;
  picks.forEach(function (a) {
    midQuestions.push({ text: String(a.question).trim(), competency: SQ_COMP[sqCat(a)] || '기타' });
  });
  renderQuestions();
  closeStudentQs();
  toast('학생 질문 ' + picks.length + '개를 「낼 질문」에 넣었습니다. 글자는 고쳐 쓰셔도 됩니다.', 'ok');
}

// ══════════════ 진행 ══════════════

// ── 면접 도중에 질문 고치기 ──
//
// 선생님 말씀: «질문 완료 했다가 면접 화면 갔을 때 질문을 수정하고 싶을 때
// 수정이 안 되더라». 첫 질문에서 «← 이전» 이 아무것도 안 했습니다.
// 이제 그 자리에서 준비 화면으로 돌아옵니다. 매긴 평가는 그대로 있습니다.
async function editQuestions() {
  if (interviewId) await saveAnswer(qIndex);
  // 선생님이 질문을 손보는 동안 시간이 가면 안 됩니다. 돌아가서 «이어서» 를 누르시면 됩니다.
  stopTicking();
  editingMid = true;
  decomposeQuestions(questions);
  renderGreetings();
  renderQuestions();
  setupGoTab('prep');
  show('setup');
}

function paintStartButton() {
  var btn = document.getElementById('btn-start');
  var note = document.getElementById('setup-editing');
  btn.textContent = editingMid ? '고치기 끝 · 면접 화면으로 →' : '질문 완료 · 면접 화면으로 →';
  if (note) note.hidden = !editingMid;
  // 면접 도중에는 지난 회차를 눌러 열면 지금 면접이 날아갑니다. 접어 둡니다.
  var hist = document.getElementById('history-box');
  if (hist) hist.hidden = editingMid;
  var save = document.getElementById('btn-save-sheet');
  if (save) save.hidden = editingMid;
}

// 「질문 완료 · 면접 화면으로 →」
//
// ⚠️ 이 단추는 **면접을 시작하지 않습니다.** 화면만 넘깁니다.
//    예전에는 여기서 status 를 '진행중' 으로 바꿨는데, 그러면 시계를 한 번도
//    안 눌렀는데도 «면접을 한 번 본 것» 이 되어 버렸습니다. 나갔다 들어오면
//    지난 면접 목록에 회차가 하나 서 있고 리포트까지 나왔습니다.
//    면접이 시작되는 때는 **진행 화면의 «면접 시작» 을 누른 순간**입니다 (toggleTimer).
//    그때까지는 계속 '준비중' — 질문을 고치는 중입니다.
async function startInterview() {
  // 첫인사 → 가운데 질문들 → 끝인사 순서로 한 줄로 폅니다.
  var list = composeQuestions();
  if (!list.length) { toast('질문이 없습니다.', 'bad'); return; }

  // 이미 하던 면접이라면 새로 만들지 않고 그 면접으로 돌아갑니다.
  if (interviewId && editingMid) { await resumeWithQuestions(list); return; }

  questions = list;

  var btn = document.getElementById('btn-start');
  btn.disabled = true;
  btn.textContent = '넘어가는 중...';

  // 아직 '준비중' 인 줄을 만듭니다(없으면). 질문도 같이 남깁니다 —
  // 진행 화면에서 창이 닫혀도 질문지는 살아 있어야 합니다.
  var ok = await keepSheet(list);

  btn.disabled = false;
  btn.textContent = '질문 완료 · 면접 화면으로 →';
  if (!ok) return;

  interviewId = sheetId;     // 이 줄에 답을 적어 갑니다 (아직 '준비중' 입니다)
  qIndex = 0;
  answers = questions.map(function () {
    return { seconds: 0, good: [], bad: [], rating: null, memo: '', transcript: '', marks: [], areas: {} };
  });
  grades = {};
  liveInterview = true;

  // 시계는 아직 멈춰 있습니다. 진행 화면에서 «면접 시작» 을 눌러야 흐르고,
  // 그때 비로소 면접이 «진행중» 이 됩니다.
  stopTicking();
  startedOnce = false;
  totalSeconds = 0;
  paintTotal();

  show('run');
  showQuestion();
}

// 진행 화면의 «면접 시작» 을 처음 누른 순간 — 여기서부터가 진짜 면접입니다.
async function markInterviewStarted() {
  if (!interviewId || !sheetId) return;    // 이미 시작한 면접이거나 지난 회차입니다
  const { error } = await sb.from('interviews')
    .update({ status: '진행중', started_at: new Date().toISOString() })
    .eq('id', interviewId);
  if (error) { toast('면접을 시작하지 못했습니다: ' + error.message, 'bad'); return; }
  sheetId = null;            // 이제 질문지가 아니라 면접입니다
  sheetSavedAt = null;
  paintSheetNote();
}

// 질문을 고친 뒤 하던 면접으로 돌아갑니다.
//
// ⚠️ 매긴 평가를 잃지 않는 것이 핵심입니다.
//    answers 는 «몇 번째 질문» 으로 매여 있어서, 질문을 하나 끼워 넣으면
//    그 뒤의 평가가 통째로 한 칸씩 밀립니다.
//    그래서 번호가 아니라 «질문 글자» 로 짝을 다시 맞춥니다.
//    글자를 고친 질문은 짝을 못 찾아 빈칸으로 돌아갑니다. 그게 맞습니다 —
//    다른 질문이 된 것이니까요.
async function resumeWithQuestions(list) {
  var btn = document.getElementById('btn-start');
  btn.disabled = true;
  btn.textContent = '저장하는 중...';

  var oldQ = questions, oldA = answers, used = {};
  answers = list.map(function (q) {
    for (var i = 0; i < oldQ.length; i++) {
      if (used[i] || oldQ[i].text !== q.text) continue;
      used[i] = true;
      return oldA[i];
    }
    return { seconds: 0, good: [], bad: [], rating: null, memo: '', transcript: '', marks: [], areas: {} };
  });
  questions = list;
  if (qIndex >= questions.length) qIndex = questions.length - 1;

  var ok = await rewriteAnswers();

  btn.disabled = false;
  paintStartButton();
  if (!ok) return;          // 저장이 안 되면 준비 화면에 그대로 둡니다

  editingMid = false;
  show('run');
  showQuestion();
  toast('질문을 고쳤습니다. 매긴 평가는 그대로 있습니다.', 'ok');
}

// 질문 순서가 바뀌었으니 표의 줄도 통째로 다시 씁니다.
// (seq 로 맞춰 둔 줄이라 하나씩 고치면 엉킵니다)
async function rewriteAnswers() {
  var del = await sb.from('interview_answers').delete().eq('interview_id', interviewId);
  if (del.error) { toast('질문을 저장하지 못했습니다: ' + del.error.message, 'bad'); return false; }

  var rows = questions.map(function (q, i) {
    var a = answers[i];
    return {
      interview_id: interviewId, seq: i + 1,
      competency: q.competency, question: q.text,
      seconds: a.seconds, good_tags: a.good, bad_tags: a.bad,
      rating: a.rating, memo: a.memo || '',
      transcript: a.transcript || '', marks: a.marks || [], areas: a.areas || {}
    };
  });
  if (!rows.length) return true;
  const { error } = await sb.from('interview_answers').insert(rows);
  if (error) { toast('질문을 저장하지 못했습니다: ' + error.message, 'bad'); return false; }
  return true;
}

// ── 시계 둘 ──
//   «면접 전체»(ticking)  — «면접 시작» 한 번 누르면 끝까지 흐릅니다(선생님이 질문 읽는 시간도 면접입니다)
//   «이 질문 답변»(answering) — 질문마다 선생님이 읽고 나서 «답변 시작» 을 누르면 그때부터. 받아 적기도 이것에 붙어 있습니다
// 2026-10-10 선생님 말씀: 교사가 질문을 말하고 학생 답변 시간을 재 준다 — 시계 하나가 계속 흐르면
// 질문 읽는 소리까지 받아 적히고 그 시간도 답변에 들어간다.
var answering = false;

function startTicking() {
  if (tickId) return;
  ticking = true;
  tickId = setInterval(function () {
    totalSeconds++;
    paintTotal();
    if (!answering) return;
    seconds++;
    if (answers[qIndex]) answers[qIndex].seconds = seconds;
    paintTimer();
  }, 1000);
  paintTimerButton();
}

function stopTicking() {
  ticking = false;
  if (tickId) { clearInterval(tickId); tickId = null; }
  answering = false;     // 면접을 멈추면 답변 시계도 같이 멈춥니다. 이어 갈 때는 «답변 시작» 을 다시
  paintTimerButton();
}

// «답변 시작» / «답변 끝» — 면접 시계가 아직 안 흐르면 같이 켭니다(한 번만 눌러도 되게).
function toggleAnswer() {
  if (answering) { answering = false; paintTimerButton(); return; }
  if (!ticking) toggleTimer();
  if (!ticking) return;          // 지난 회차(liveInterview 아님)에서는 시계가 안 켜집니다
  answering = true;
  paintTimerButton();
}

function toggleTimer() {
  if (ticking) { stopTicking(); return; }
  // 처음 누르는 순간이 «면접 시작» 입니다. 이때 비로소 '진행중' 이 됩니다.
  if (!startedOnce) markInterviewStarted();
  startedOnce = true;
  startTicking();
}

function paintTimerButton() {
  var b = document.getElementById('btn-timer');
  if (!b) return;
  // 지난 회차를 열어 고치는 중이면 시간이 더 흘러서는 안 됩니다.
  b.hidden = !liveInterview;
  b.textContent = ticking ? '일시정지' : (startedOnce ? '이어서' : '면접 시작');
  b.className = ticking ? 'ghost tbtn' : 'btn solid tbtn';
  var ab = document.getElementById('btn-answer');
  if (ab) {
    ab.hidden = !liveInterview;
    ab.textContent = answering ? '답변 끝' : '답변 시작';
    ab.className = answering ? 'btn tbtn' : 'btn solid tbtn';
  }
  var box = document.getElementById('timerbox');
  if (box) {
    box.setAttribute('data-running', ticking ? 'yes' : 'no');
    box.setAttribute('data-answering', answering ? 'yes' : 'no');
  }
  // 받아 적기는 답변 시계와 같이 켜지고 멈춥니다 (listen.js)
  if (typeof listenSync === 'function') listenSync();
}

function paintTotal() {
  var el = document.getElementById('total-timer');
  if (el) el.textContent = mmss(totalSeconds);
}

function showQuestion() {
  // 질문이 없으면 그릴 것이 없습니다. 준비 화면에서 질문부터 만들어야 합니다.
  if (!questions.length) { editQuestions(); return; }
  if (qIndex >= questions.length) qIndex = questions.length - 1;
  var q = questions[qIndex];
  document.getElementById('run-step').textContent = (qIndex + 1) + ' / ' + questions.length;
  document.getElementById('run-comp').textContent = q.competency;
  document.getElementById('run-question').textContent = q.text;

  // 면접 전체 시계는 그대로 둡니다. 질문을 넘겼다고 면접이 멈추는 건 아니니까요.
  // 「이 질문 답변」은 새 질문의 시간으로 갈아 끼우고 **멈춘 채** 둡니다 — 선생님이 질문을 읽고 «답변 시작» 을 누르면 흐릅니다.
  answering = false;
  seconds = answers[qIndex].seconds;
  paintTimer();
  paintTotal();
  paintTimerButton();
  var prev = document.getElementById('btn-prev');
  prev.disabled = false;
  prev.textContent = (qIndex === 0) ? '← 질문 고치기' : '← 이전';
  document.getElementById('btn-next').textContent =
    (qIndex === questions.length - 1) ? '면접 마무리 →' : '다음 질문 →';

  renderRating();
  renderAreas('area-grid', qIndex);
  document.getElementById('answer-memo').value = answers[qIndex].memo || '';
  paintMarks();
  // 받아 적는 칸은 지금 질문의 글로 갈아 끼웁니다 (listen.js — 음성 인식이 없는 브라우저면 안내만)
  if (typeof listenShowQuestion === 'function') listenShowQuestion();
  renderRailProgress();
}

// ── 들으면서 찍는 순간 — 👍 좋았다 · 👎 아쉽다 ──
//
// 2026-10-10 선생님 말씀: 1~2분 답변이 쉴 새 없이 이어지는데 단추 62개에서 고르다 보면 내용을 놓친다.
// 그래서 면접 중에는 «몇 초째에 좋았다/아쉬웠다» 만 찍어 두고(눈으로 찾을 게 없음),
// 무엇이 좋았는지는 마무리 화면에서 받아 적은 글을 보며 고릅니다.
function addMark(kind) {
  var a = answers[qIndex];
  if (!a) return;
  a.marks = a.marks || [];
  a.marks.push({ t: seconds, k: kind });
  paintMarks();
  // 눌렸다는 느낌 — 화면을 안 보고 눌러도 알 수 있게 잠깐 커졌다 돌아옵니다
  var b = document.getElementById('mark-' + kind);
  if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
  renderRailProgress();
}

// 마지막에 찍은 것을 지웁니다 — 잘못 눌렀을 때 되돌릴 길
function undoMark() {
  var a = answers[qIndex];
  if (!a || !a.marks || !a.marks.length) return;
  a.marks.pop();
  paintMarks();
}

function paintMarks() {
  var a = answers[qIndex] || { marks: [] };
  var m = a.marks || [];
  var g = m.filter(function (x) { return x.k === 'good'; }).length;
  var b = m.filter(function (x) { return x.k === 'bad'; }).length;
  var eg = document.getElementById('mark-good-n'), eb = document.getElementById('mark-bad-n');
  if (eg) eg.textContent = g ? String(g) : '';
  if (eb) eb.textContent = b ? String(b) : '';
}

// 「0:12 👍 · 0:48 👎」 — 마무리 화면과 리포트에서 찍은 순간을 한 줄로
function marksLine(marks) {
  return (marks || []).map(function (x) {
    return mmss(x.t || 0) + ' ' + (x.k === 'good' ? '👍' : '👎');
  }).join(' · ');
}

// ── 키보드 — 화면을 안 보고도 누를 수 있게 ──
//   ↑ 좋았다 · ↓ 아쉽다 · 1 2 3 우수·보통·미흡 · Space 답변 시작/끝 · → 다음 질문 · ← 이전 · Backspace 마지막 찍은 것 지우기
// 글자 칸에 커서가 있을 때는 끼어들지 않습니다. 진행 화면이 보일 때만 듣습니다.
document.addEventListener('keydown', function (e) {
  var run = document.getElementById('view-run');
  if (!run || run.hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
  var k = e.key;
  if (k === 'ArrowUp') addMark('good');
  else if (k === 'ArrowDown') addMark('bad');
  else if (k === '1' || k === '2' || k === '3') pickRating(RATINGS[Number(k) - 1]);
  else if (k === ' ' || k === 'Spacebar') toggleAnswer();
  // 저장하는 중(단추가 잠김)에 연타하면 두 질문을 건너뛰므로 그동안은 듣지 않습니다
  else if (k === 'ArrowRight') { if (document.getElementById('btn-next').disabled) return; nextQuestion(); }
  else if (k === 'ArrowLeft') { if (document.getElementById('btn-next').disabled) return; prevQuestion(); }
  else if (k === 'Backspace') undoMark();
  else return;
  // 단추에 초점이 있으면 Space·Enter 가 그 단추를 또 누르므로 막습니다
  e.preventDefault();
});

// 영역별 판정 표 — 진행 화면(#area-grid)과 마무리 화면(질문마다) 둘 다 이걸로 그립니다.
function areasHTML(i) {
  var cur = answers[i].areas || {};
  return AREAS.map(function (ar) {
    return '<div class="arearow">' +
      '<span class="arealabel"><b>' + esc(ar.key) + '</b><span class="desc">' + esc(ar.desc) + '</span></span>' +
      '<span class="areapicks">' + LEVELS.map(function (lv) {
        return '<button class="abtn l' + LEVELS.indexOf(lv) + '" aria-pressed="' + (cur[ar.key] === lv) + '"' +
               ' onclick="pickArea(' + i + ', \'' + ar.key + '\', \'' + lv + '\')">' + lv + '</button>';
      }).join('') + '</span>' +
    '</div>';
  }).join('');
}
function renderAreas(boxId, i) {
  var box = document.getElementById(boxId);
  if (box) box.innerHTML = areasHTML(i);
}
function pickArea(i, key, lv) {
  var a = answers[i];
  a.areas = a.areas || {};
  if (a.areas[key] === lv) delete a.areas[key]; else a.areas[key] = lv;   // 다시 누르면 지움
  if (i === qIndex) renderAreas('area-grid', i);
  repaintAnswerRow(i);     // 마무리 화면에 그 질문 칸이 있으면 같이
  renderRailProgress();
}

function setMemo(el) { answers[qIndex].memo = el.value; }

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
  renderRating();      // 키보드(1·2·3)로도 부르므로 단추를 넘겨받지 않고 다시 그립니다
  renderRailProgress();
}

// ══════════════ 평가 단추(태그) — 마무리 화면에서 질문마다 ══════════════
//
// 2026-10-10 까지는 진행 화면에 62개가 다 펼쳐져 있었는데, 실제로 눌린 답변은 303개 가운데 30개(10%),
// 눌린 것도 아홉 문구가 70% 였습니다(서버에서 세어 봄). 들으면서 찾아 누르는 표가 아니라
// «다 들은 뒤 몇 개 고르는 것» 이라, 마무리 화면으로 옮기고 **자주 쓰는 것을 앞에** 둡니다.
//
// 자주 쓰는 순서: 이 브라우저에서 누른 횟수(localStorage `tagUse`) + 처음 씨앗(실제 기록에서 많이 눌린 것).
// 서버에서 세지 않습니다 — 요청이 늘지 않게.
var TAG_SEED = {
  good: ['생기부 기록과 맞음', '눈을 맞춤', '결론부터 말함(두괄식)', '질문의 핵심을 짚음', '자세가 바름', '구체적 사례를 듦'],
  bad:  ['군더더기(음, 그)', '시선을 피함', '당황하면 말이 끊김', '긴장이 심함', '개념이 부정확', '외운 티가 남', '답이 너무 길어짐']
};
var TAG_QUICK_N = 6;   // 자주 쓰는 것으로 보여 주는 개수(좋음·아쉬움 각각)

function tagUse() {
  try { return JSON.parse(localStorage.getItem('tagUse') || '{}') || {}; } catch (e) { return {}; }
}
function bumpTagUse(t) {
  try {
    var u = tagUse(); u[t] = (u[t] || 0) + 1;
    localStorage.setItem('tagUse', JSON.stringify(u));
  } catch (e) { /* 사생활 보호 모드 — 순서만 못 기억할 뿐 */ }
}
function allTags(kind) {
  var out = [];
  Object.keys(TAGS).forEach(function (ax) { out = out.concat(TAGS[ax][kind]); });
  return out;
}
// 자주 쓰는 것 — 누른 횟수가 많은 것부터, 횟수가 같으면 씨앗 순서
function quickTags(kind) {
  var u = tagUse(), seed = TAG_SEED[kind];
  return allTags(kind).map(function (t, i) {
    var si = seed.indexOf(t);
    return { t: t, n: u[t] || 0, s: si === -1 ? 99 : si, i: i };
  }).sort(function (a, z) { return (z.n - a.n) || (a.s - z.s) || (a.i - z.i); })
    .slice(0, TAG_QUICK_N).map(function (x) { return x.t; });
}

// 질문 i 의 평가 단추 한 묶음.
//   위: 자주 쓰는 것(좋음 · 아쉬움 한 줄씩) + «모든 단추 보기»
//   아래(펼쳤을 때): 내용·근거·말하기·태도 네 줄 — 좋았던 점 | 아쉬운 점
// 지난 회차에서 쓰던 옛 문구(지금 목록에 없는 것)는 눌린 채로 «지난 기록» 줄에 남깁니다 —
// 그대로 두면 다시 열어 고칠 때 조용히 사라집니다. 어느 축이었는지는 모르니 한 줄에만.
var tagOpen = {};   // { 질문번호: true } — «모든 단추 보기» 를 펼쳐 둔 질문

function tagChip(i, kind, t, pressed) {
  return '<button class="chip ' + kind + '" aria-pressed="' + pressed + '"' +
         ' onclick="toggleTagAt(' + i + ', \'' + kind + '\', this)" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
}

function tagPanelHTML(i) {
  var a = answers[i];
  function has(kind, t) { return (a[kind] || []).indexOf(t) > -1; }
  function group(kind, list, label) {
    return '<div class="tagcol"><span class="cap ' + kind + '">' + label + '</span><div class="chips">' +
      list.map(function (t) { return tagChip(i, kind, t, has(kind, t)); }).join('') + '</div></div>';
  }
  function leftovers(kind) {
    var known = allTags(kind);
    return (a[kind] || []).filter(function (t) { return known.indexOf(t) === -1; });
  }
  // 자주 쓰는 것에는 «이미 누른 것» 도 끼워 넣습니다 — 펼치지 않아도 뭘 골랐는지 보이게
  function quick(kind) {
    var list = quickTags(kind);
    (a[kind] || []).forEach(function (t) { if (list.indexOf(t) === -1) list.push(t); });
    return list;
  }
  var open = !!tagOpen[i];
  var 옛좋음 = leftovers('good'), 옛아쉬움 = leftovers('bad');

  return '<div class="tagpanel" data-open="' + open + '">' +
    '<div class="tagrow quick"><span class="axis">자주 씀</span><div class="tagcols">' +
      group('good', quick('good'), '좋았던 점') +
      group('bad',  quick('bad'),  '아쉬운 점') +
    '</div></div>' +
    '<button class="linkbtn tagmore" onclick="toggleTagPanel(' + i + ')">' +
      (open ? '▲ 접기' : '▼ 모든 평가 단추 보기') + '</button>' +
    '<div class="tagfull" ' + (open ? '' : 'hidden') + '>' +
      Object.keys(TAGS).map(function (axis) {
        return '<div class="tagrow"><span class="axis">' + axis + '</span><div class="tagcols">' +
          group('good', TAGS[axis].good, '좋았던 점') +
          group('bad',  TAGS[axis].bad,  '아쉬운 점') +
          '</div></div>';
      }).join('') +
      (옛좋음.length || 옛아쉬움.length
        ? '<div class="tagrow"><span class="axis">지난 기록</span><div class="tagcols">' +
            group('good', 옛좋음, '좋았던 점') +
            group('bad',  옛아쉬움, '아쉬운 점') +
          '</div></div>'
        : '') +
    '</div>' +
  '</div>';
}

function toggleTagPanel(i) {
  tagOpen[i] = !tagOpen[i];
  repaintAnswerRow(i);
}

// 같은 문구가 자주 쓰는 줄과 펼친 줄에 둘 다 있을 수 있어, 누르면 그 질문 칸을 통째로 다시 그립니다.
function toggleTagAt(i, kind, btn) {
  var tag = btn.dataset.tag;
  var arr = answers[i][kind];
  var at = arr.indexOf(tag);
  if (at > -1) arr.splice(at, 1); else { arr.push(tag); bumpTagUse(tag); }
  repaintAnswerRow(i);
  renderRailProgress();
}

function paintTimer() { document.getElementById('timer').textContent = mmss(seconds); }

// 질문 하나가 끝날 때마다 서버에 남깁니다. 마지막에 한꺼번에 저장하면
// 도중에 창이 닫혔을 때 면접 전체가 날아갑니다.
// 같은 자리로 돌아와 다시 저장하면 덮어씁니다 (interview_id + seq 가 짝).
async function saveAnswer(i) {
  var q = questions[i], a = answers[i];
  // ⚠️ 질문이 하나도 없는 면접(시작만 하고 질문을 안 낸 것)을 다시 열면
  //    여기가 빈칸을 집어 터졌고, 그 뒤 «질문 고치기» 가 통째로 멎었습니다.
  if (!q || !a) return;
  // 받아 적는 중이면 아직 확정 안 된 글까지 붙여서 저장합니다 (listen.js)
  if (typeof listenCut === 'function') listenCut(i);
  const { error } = await sb.from('interview_answers').upsert({
    interview_id: interviewId,
    seq: i + 1,
    competency: q.competency,
    question: q.text,
    seconds: a.seconds,
    good_tags: a.good,
    bad_tags: a.bad,
    rating: a.rating,
    memo: a.memo || '',
    transcript: a.transcript || '',   // 받아 적은 학생 답변 (listen.js)
    marks: a.marks || [],             // 들으면서 찍은 👍👎 — [{ t: 몇 초째, k: 'good'|'bad' }]
    areas: a.areas || {}              // 영역별 좋음·보통·아쉬움 — { 내용: '좋음', … }
  }, { onConflict: 'interview_id,seq' });
  if (error) toast('이 질문을 저장하지 못했습니다: ' + error.message, 'bad');
}

async function goToQuestion(i) {
  if (i === qIndex) return;
  await saveAnswer(qIndex);
  qIndex = i;
  showQuestion();
}

async function prevQuestion() {
  // 첫 질문에서는 «준비 화면» 으로 돌아갑니다.
  // 예전에는 여기서 아무 일도 안 일어나서, 질문을 고칠 길이 없었습니다.
  if (qIndex === 0) { await editQuestions(); return; }
  await saveAnswer(qIndex);
  qIndex--;
  showQuestion();
}

async function nextQuestion() {
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
  stopTicking();   // 마무리 화면에서는 시계가 멈춥니다
  document.getElementById('finish-who').textContent = target.student_no + ' ' + target.name;

  var spoken = answers.reduce(function (n, a) { return n + a.seconds; }, 0);
  document.getElementById('finish-total').textContent = mmss(totalSeconds);
  document.getElementById('finish-spoken').textContent = mmss(spoken);

  renderScoresheet();
  renderAnswerSummary();
  show('finish');
}

// 질문마다 «무슨 질문 / 학생이 말한 내용 / 찍은 순간» 을 보면서 평가를 매깁니다.
// 받아 적은 글이 있으면 그것이 평가의 바탕입니다. 요지는 선생님이 한두 줄로 — 학생 리포트에 그대로 갑니다.
function renderAnswerSummary() {
  document.getElementById('answer-summary').innerHTML =
    '<div class="rp-answers">' + questions.map(function (q, i) {
      return '<div class="ansrow edit" id="ansrow-' + i + '">' + answerRowHTML(i) + '</div>';
    }).join('') + '</div>';
}

function repaintAnswerRow(i) {
  var el = document.getElementById('ansrow-' + i);
  if (el) el.innerHTML = answerRowHTML(i);
}

function answerRowHTML(i) {
  var q = questions[i], a = answers[i];
  var marks = a.marks || [];
  return '<div class="anshead">' +
      '<span class="qno">' + (i + 1) + '</span>' +
      '<span class="qt">' + esc(q.text) + '</span>' +
      '<span class="secs">' + mmss(a.seconds) + '</span>' +
    '</div>' +
    (q.competency && q.competency !== '기타'
      ? '<div class="anscomp">' + esc(q.competency) + ' 질문</div>' : '') +
    // 학생이 말한 내용 — 받아 적은 것이 없으면 그 자리만 비워 둡니다
    (a.transcript
      ? '<div class="anssaid"><span class="cap">학생이 말한 내용 <span class="opt">받아 적은 것이라 틀린 데가 있을 수 있습니다</span></span>' +
          '<p>' + esc(a.transcript) + '</p></div>'
      : '') +
    (marks.length
      ? '<div class="ansmarks">' + esc(marksLine(marks)) + '</div>'
      : '') +
    '<div class="anseval">' +
      '<div class="areagrid">' + areasHTML(i) + '</div>' +
      '<div class="ratingrow">' + RATINGS.map(function (r) {
        return '<button class="rbtn" aria-pressed="' + (a.rating === r) + '"' +
               ' onclick="pickRatingAt(' + i + ', \'' + r + '\')">' + r + '</button>';
      }).join('') + '</div>' +
      tagPanelHTML(i) +
      '<textarea class="ansmemo-in" oninput="setMemoAt(' + i + ', this)" ' +
        'placeholder="평가 · 답변 요지 — 면접 중에 적은 것이 그대로 옵니다. 학생 리포트에 들어갑니다.">' +
        esc(a.memo || '') + '</textarea>' +
    '</div>';
}

function pickRatingAt(i, r) {
  answers[i].rating = (answers[i].rating === r) ? null : r;   // 다시 누르면 지움
  repaintAnswerRow(i);
  renderRailProgress();
}

function setMemoAt(i, el) { answers[i].memo = el.value; }

// 마무리 화면에서 매긴 것을 한 번에 저장합니다(질문 수만큼이 아니라 요청 한 번).
async function saveAllAnswers() {
  if (!questions.length) return true;
  var rows = questions.map(function (q, i) {
    var a = answers[i];
    return {
      interview_id: interviewId, seq: i + 1,
      competency: q.competency, question: q.text,
      seconds: a.seconds, good_tags: a.good, bad_tags: a.bad,
      rating: a.rating, memo: a.memo || '',
      transcript: a.transcript || '', marks: a.marks || [], areas: a.areas || {}
    };
  });
  const { error } = await sb.from('interview_answers').upsert(rows, { onConflict: 'interview_id,seq' });
  if (error) { toast('평가를 저장하지 못했습니다: ' + error.message, 'bad'); return false; }
  return true;
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
// 고치러 돌아올 때 시계를 저절로 켜지 않습니다.
// 면접이 이어지는 거라면 선생님이 «이어서» 를 누르면 됩니다.
function backToRun() {
  // 질문이 하나도 없는 면접이면 진행 화면에 보여줄 것이 없습니다.
  // 곧바로 준비 화면으로 보내 질문부터 만들게 합니다.
  if (!questions.length) { editQuestions(); return; }
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

  // 마무리 화면에서 매긴 평가·요지는 여기서 한꺼번에 저장합니다
  if (!(await saveAllAnswers())) { btn.disabled = false; btn.textContent = label; return; }

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
    // 시계를 한 번도 안 누르고 곧장 마무리한 경우에도 시작한 때는 남겨 둡니다.
    if (sheetId) patch.started_at = new Date().toISOString();
  }

  const { error } = await sb.from('interviews').update(patch).eq('id', interviewId);

  btn.disabled = false;
  btn.textContent = label;
  // 마무리했으면 더는 «질문지» 가 아닙니다.
  if (!error) { sheetId = null; sheetSavedAt = null; paintSheetNote(); }

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
  stopTicking();
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
  questions = putBackSlots(r.answers.map(function (a) {
    return { text: a.question, competency: a.competency };
  }));
  answers = r.answers.map(function (a) {
    return { seconds: a.seconds || 0, good: a.good_tags || [], bad: a.bad_tags || [],
             rating: a.rating || null, memo: a.memo || '',
             transcript: a.transcript || '', marks: a.marks || [], areas: a.areas || {} };
  });
  grades = r.interview.grades || {};
  totalSeconds = r.interview.total_seconds || 0;
  qIndex = 0;
  liveInterview = false;   // 지난 회차입니다. 시간이 더 흐르면 안 됩니다
  editingMid = false;
  startedOnce = false;
  stopTicking();
  paintTotal();

  openReport(id);
}
