// 답안 연습장 — 학생이 스스로 예상 질문·답변을 써 보는 공간.
//
// 면접(interviews)과는 다른 표(practice_answers · practice_categories)를 씁니다.
// 선생님이 매기지 않고, 학생 혼자 씁니다. 선생님은 학생을 고른 뒤 «답안 연습장»
// 탭에서 읽기만 합니다 (RLS 가 선생님 쪽 쓰기를 아예 막아 둡니다).
//
// 학생 앱(index.html)과 교사 화면(teacher/index.html)이 함께 씁니다.
// esc() · SCHOOL_ID 는 report.js · config.js 가 먼저 실어 둡니다.

var PRACTICE_FIXED_CATS = ['인성', '자율', '진로', '동아리', '세특', '행발'];
var PRACTICE_GRADES = ['1', '2', '3', '전체'];

function practiceWhen(a) {
  var d = new Date(a.updated_at || a.created_at);
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

// ── 서버 ──
async function fetchPracticeCategories(studentId) {
  const { data, error } = await sb.from('practice_categories')
    .select('id, name').eq('student_id', studentId).order('created_at');
  if (error) { console.warn('분류를 못 불러왔습니다:', error.message); return []; }
  return data || [];
}

async function fetchPracticeAnswers(studentId) {
  const { data, error } = await sb.from('practice_answers')
    .select('id, grade, category, question, answer, created_at, updated_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('답안을 못 불러왔습니다:', error.message); return []; }
  return data || [];
}

// 학년·분류 칩 한 줄. active 와 같은 값이면 눌린 채로 그립니다.
// extraHTML 은 맨 뒤에 그냥 덧붙입니다 (조회에는 없고, 작성에서 «+ 새 분류» 를 붙일 때 씁니다).
function practiceChipsHTML(items, active, onClick, extraHTML) {
  return items.map(function (v) {
    var on = v === active;
    return '<button class="prac-chip" aria-pressed="' + on + '"' +
           ' onclick="' + onClick + '(\'' + String(v).replace(/'/g, "\\'") + '\')">' +
           esc(v) + '</button>';
  }).join('') + (extraHTML || '');
}

// 카드 한 장(읽기 전용) — 교사 화면과 학생 «조회» 탭이 같이 씁니다.
function practiceCardViewHTML(a) {
  return '<div class="prac-card">' +
    '<div class="prac-card-head"><span class="prac-card-when">' + practiceWhen(a) + '</span></div>' +
    '<p class="prac-q-view">' + esc(a.question || '(질문 없음)') + '</p>' +
    (a.answer ? '<p class="prac-a-view">' + esc(a.answer) + '</p>'
              : '<p class="prac-a-view" style="color:var(--ink-3)">(아직 답을 안 썼습니다)</p>') +
    '</div>';
}

// ══════════════ 조회(읽기 전용) — 학생 «조회» 탭 + 교사 화면이 같이 씁니다 ══════════════
//
// els = { gradeBox, catBox, list } — 각 앱의 실제 div id. 상태는 studentId 별로 따로 두지
// 않고 하나만 둡니다 — 교사 화면은 학생을 한 번에 하나만 보고, 학생 앱은 자기 것만 보므로
// 동시에 두 학생을 볼 일이 없습니다.
var PB = null;

async function practiceBrowseInit(studentId, els, defaultGrade) {
  PB = { studentId: studentId, els: els, grade: defaultGrade || '전체', cat: PRACTICE_FIXED_CATS[0], cats: [], answers: [] };
  els.list.innerHTML = '<p class="prac-empty">불러오는 중...</p>';

  var rows = await Promise.all([fetchPracticeCategories(studentId), fetchPracticeAnswers(studentId)]);
  PB.cats = rows[0].map(function (c) { return c.name; });
  PB.answers = rows[1];

  practiceBrowseRender();
}

function practiceBrowsePickGrade(g) { PB.grade = g; practiceBrowseRender(); }
function practiceBrowsePickCat(c) { PB.cat = c; practiceBrowseRender(); }

function practiceBrowseRender() {
  if (!PB) return;
  PB.els.gradeBox.innerHTML = practiceChipsHTML(PRACTICE_GRADES, PB.grade, 'practiceBrowsePickGrade');
  PB.els.catBox.innerHTML = practiceChipsHTML(PRACTICE_FIXED_CATS.concat(PB.cats), PB.cat, 'practiceBrowsePickCat');

  var list = PB.answers.filter(function (a) { return a.grade === PB.grade && a.category === PB.cat; });
  PB.els.list.innerHTML = list.length
    ? list.map(practiceCardViewHTML).join('')
    : '<p class="prac-empty">이 학년·분류로 쓴 답안이 없습니다.</p>';
}

// ══════════════ 작성 — 학생만 씁니다 ══════════════
//
// 카드 하나 = practice_answers 한 줄. 빈 채로 만들어 두지 않고, 첫 글자를 쳐야
// 서버에 줄이 생깁니다(멈춘 뒤 1.5초, 또는 칸을 벗어날 때). 다 지워서 다시 비면
// 그 줄은 지우고, 카드는 화면에 그대로 두어 계속 쓸 수 있게 합니다.
var PW = null;             // { studentId, grade, cat, cats, cards: [{key,id,question,answer,timer}] }
var PW_KEY = 0;

async function practiceWriteInit(studentId, myGrade) {
  PW = { studentId: studentId, grade: myGrade || '전체', cat: PRACTICE_FIXED_CATS[0], cats: [], cards: [] };
  document.getElementById('prac-write-list').innerHTML = '<p class="prac-empty">불러오는 중...</p>';

  var rows = await Promise.all([fetchPracticeCategories(studentId), fetchPracticeAnswers(studentId)]);
  PW.cats = rows[0].map(function (c) { return c.name; });
  PW.all = rows[1];   // 전체 답안 — 학년·분류를 바꿀 때마다 새로 안 부르고 여기서 추립니다

  practiceWriteRenderChips();
  practiceWriteRenderCards();
}

function practiceWritePickGrade(g) { PW.grade = g; practiceWriteRenderChips(); practiceWriteRenderCards(); }
function practiceWritePickCat(c) { PW.cat = c; practiceWriteRenderChips(); practiceWriteRenderCards(); }

function practiceWriteRenderChips() {
  var addBtn = '<button class="prac-chip add" onclick="practiceAddCategory()">＋ 새 분류</button>';
  document.getElementById('prac-write-grade').innerHTML =
    practiceChipsHTML(PRACTICE_GRADES, PW.grade, 'practiceWritePickGrade');

  // 학생이 만든 분류에는 이름 옆에 작은 «수정» 단추를 붙입니다. 기본 6개는 못 건드립니다.
  var fixedHTML = practiceChipsHTML(PRACTICE_FIXED_CATS, PW.cat, 'practiceWritePickCat');
  var customHTML = PW.cats.map(function (name) {
    var on = name === PW.cat;
    return '<span class="prac-chip-wrap">' +
      '<button class="prac-chip" aria-pressed="' + on + '"' +
      ' onclick="practiceWritePickCat(\'' + name.replace(/'/g, "\\'") + '\')">' + esc(name) + '</button>' +
      '<button class="prac-chip-edit" title="이름 바꾸기·지우기"' +
      ' onclick="practiceEditCategory(\'' + name.replace(/'/g, "\\'") + '\')">✎</button>' +
      '</span>';
  }).join('');
  document.getElementById('prac-write-cat').innerHTML = fixedHTML + customHTML + addBtn;
}

function practiceWriteRenderCards() {
  var list = (PW.all || []).filter(function (a) { return a.grade === PW.grade && a.category === PW.cat; });
  PW.cards = list.map(function (a) {
    return { key: 'k' + (++PW_KEY), id: a.id, question: a.question || '', answer: a.answer || '', timer: null };
  });
  practiceWriteDrawCards();
}

function practiceWriteDrawCards() {
  var box = document.getElementById('prac-write-list');
  if (!PW.cards.length) { box.innerHTML = '<p class="prac-empty">아직 쓴 것이 없습니다. 아래 단추로 새로 써 보세요.</p>'; return; }
  box.innerHTML = PW.cards.map(function (c) {
    return '<div class="prac-card" data-key="' + c.key + '">' +
      '<div class="prac-card-head">' +
        '<span class="prac-card-when" id="' + c.key + '-when"></span>' +
        '<button class="prac-del" onclick="practiceDeleteCard(\'' + c.key + '\')">삭제</button>' +
      '</div>' +
      '<textarea class="prac-q-input" rows="2" placeholder="질문을 적어보세요 (한두 줄)"' +
      ' oninput="practiceQueueSave(\'' + c.key + '\')" onblur="practiceFlush(\'' + c.key + '\')">' +
      esc(c.question) + '</textarea>' +
      '<textarea class="prac-a-input" rows="8" placeholder="이 질문에 대한 내 답을 적어보세요"' +
      ' oninput="practiceQueueSave(\'' + c.key + '\')" onblur="practiceFlush(\'' + c.key + '\')">' +
      esc(c.answer) + '</textarea>' +
      '<p class="prac-savehint" id="' + c.key + '-save"></p>' +
      '</div>';
  }).join('');
  PW.cards.forEach(practiceCardPaintWhen);
}

function practiceCardKV(key) {
  var el = document.querySelector('.prac-card[data-key="' + key + '"]');
  if (!el) return null;
  return { el: el, q: el.querySelector('.prac-q-input'), a: el.querySelector('.prac-a-input'),
           hint: document.getElementById(key + '-save') };
}

function practiceCard(key) {
  for (var i = 0; i < PW.cards.length; i++) if (PW.cards[i].key === key) return PW.cards[i];
  return null;
}

function practiceCardPaintWhen(c) {
  var el = document.getElementById(c.key + '-when');
  if (!el) return;
  el.textContent = c.id ? practiceWhen({ updated_at: new Date() }) + ' 씀' : '아직 저장 전';
}

// «+ 새 질문 쓰기» — 화면에 빈 카드만 하나 더합니다. 서버에는 아직 안 씁니다.
function practiceNewCard() {
  PW.cards.push({ key: 'k' + (++PW_KEY), id: null, question: '', answer: '', timer: null });
  practiceWriteDrawCards();
  var last = PW.cards[PW.cards.length - 1];
  var kv = practiceCardKV(last.key);
  if (kv) kv.q.focus();
}

// 입력을 멈추고 1.5초가 지나면 저장합니다. 칸을 벗어나면(onblur) 곧바로 저장합니다.
function practiceQueueSave(key) {
  var c = practiceCard(key);
  if (!c) return;
  var kv = practiceCardKV(key);
  if (kv && kv.hint) { kv.hint.textContent = '입력 중...'; kv.hint.className = 'prac-savehint'; }
  if (c.timer) clearTimeout(c.timer);
  c.timer = setTimeout(function () { practiceFlush(key); }, 1500);
}

async function practiceFlush(key) {
  var c = practiceCard(key);
  if (!c) return;
  if (c.timer) { clearTimeout(c.timer); c.timer = null; }
  var kv = practiceCardKV(key);
  if (!kv) return;

  var q = kv.q.value, a = kv.a.value;
  c.question = q; c.answer = a;

  // 둘 다 비면 저장할 것이 없습니다. 서버에 줄이 있었다면 지웁니다(빈 줄을 남겨 두지 않습니다).
  if (!q.trim() && !a.trim()) {
    if (c.id) {
      await sb.from('practice_answers').delete().eq('id', c.id);
      c.id = null;
    }
    kv.hint.textContent = ''; kv.hint.className = 'prac-savehint';
    practiceCardPaintWhen(c);
    return;
  }

  kv.hint.textContent = '저장하는 중...'; kv.hint.className = 'prac-savehint saving';

  if (c.id) {
    const { error } = await sb.from('practice_answers')
      .update({ question: q, answer: a }).eq('id', c.id);
    if (error) { kv.hint.textContent = '저장하지 못했습니다: ' + error.message; kv.hint.className = 'prac-savehint'; return; }
  } else {
    const { data, error } = await sb.from('practice_answers').insert({
      school_id: SCHOOL_ID, student_id: PW.studentId, grade: PW.grade, category: PW.cat,
      question: q, answer: a
    }).select('id').single();
    if (error) { kv.hint.textContent = '저장하지 못했습니다: ' + error.message; kv.hint.className = 'prac-savehint'; return; }
    c.id = data.id;
    // 전체 목록에도 더해 둡니다 — 학년·분류를 옮겼다 되돌아와도 그대로 보이게.
    PW.all.push({ id: c.id, grade: PW.grade, category: PW.cat, question: q, answer: a,
                  created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  kv.hint.textContent = ''; kv.hint.className = 'prac-savehint saved';
  kv.hint.textContent = '저장됨';
  practiceCardPaintWhen(c);
}

async function practiceDeleteCard(key) {
  var c = practiceCard(key);
  if (!c) return;
  if ((c.question || c.answer) && !confirm('이 질문·답변을 지울까요?')) return;
  if (c.id) {
    await sb.from('practice_answers').delete().eq('id', c.id);
    PW.all = PW.all.filter(function (a) { return a.id !== c.id; });
  }
  PW.cards = PW.cards.filter(function (x) { return x.key !== key; });
  practiceWriteDrawCards();
}

// ── 학생이 만드는 분류 ──
function practiceAddCategory() {
  var name = prompt('새 분류 이름을 입력하세요 (예: 창체, 자기소개서 등)');
  if (!name) return;
  name = name.trim();
  if (!name) return;
  if (PRACTICE_FIXED_CATS.indexOf(name) > -1 || PW.cats.indexOf(name) > -1) {
    toast_or_alert('이미 있는 분류입니다.'); return;
  }
  sb.from('practice_categories').insert({ school_id: SCHOOL_ID, student_id: PW.studentId, name: name })
    .select('id, name').single().then(function (res) {
      if (res.error) { toast_or_alert('분류를 만들지 못했습니다: ' + res.error.message); return; }
      PW.cats.push(name);
      PW.cat = name;
      practiceWriteRenderChips();
      practiceWriteRenderCards();
    });
}

// 이름 바꾸기 / 지우기. 학생이 만든 분류에만 있습니다(기본 6개는 못 건드립니다).
async function practiceEditCategory(name) {
  var choice = prompt('"' + name + '" — 새 이름을 적으면 바꾸고, 빈 채로 확인을 누르면 아래에서 지울지 물어봅니다.', name);
  if (choice === null) return;
  choice = choice.trim();

  if (choice && choice !== name) {
    if (PRACTICE_FIXED_CATS.indexOf(choice) > -1 || PW.cats.indexOf(choice) > -1) {
      toast_or_alert('이미 있는 분류 이름입니다.'); return;
    }
    var upd = await sb.from('practice_categories').update({ name: choice })
      .eq('student_id', PW.studentId).eq('name', name);
    if (upd.error) { toast_or_alert('이름을 바꾸지 못했습니다: ' + upd.error.message); return; }
    // 그 분류로 이미 써 둔 답안들도 새 이름을 따라가게 합니다.
    await sb.from('practice_answers').update({ category: choice })
      .eq('student_id', PW.studentId).eq('category', name);
    PW.cats = PW.cats.map(function (n) { return n === name ? choice : n; });
    (PW.all || []).forEach(function (a) { if (a.category === name) a.category = choice; });
    if (PW.cat === name) PW.cat = choice;
    practiceWriteRenderChips();
    practiceWriteRenderCards();
    return;
  }

  if (!choice) {
    var used = (PW.all || []).some(function (a) { return a.category === name; });
    if (used) { toast_or_alert('이 분류로 쓴 답안이 있어서 지울 수 없습니다. 먼저 그 답안들을 지우거나 다른 분류로 옮기세요.'); return; }
    if (!confirm('"' + name + '" 분류를 지울까요?')) return;
    var del = await sb.from('practice_categories').delete().eq('student_id', PW.studentId).eq('name', name);
    if (del.error) { toast_or_alert('지우지 못했습니다: ' + del.error.message); return; }
    PW.cats = PW.cats.filter(function (n) { return n !== name; });
    if (PW.cat === name) PW.cat = PRACTICE_FIXED_CATS[0];
    practiceWriteRenderChips();
    practiceWriteRenderCards();
  }
}

// 학생 앱에는 toast(), 교사 화면에도 toast() 가 있어 그걸 씁니다. 둘 다 없으면 alert 로.
function toast_or_alert(msg) {
  if (typeof showToast === 'function') showToast(msg, 'error');
  else if (typeof toast === 'function') toast(msg, 'bad');
  else alert(msg);
}

// ══════════════ 학생 앱 — 화면 들어올 때 ══════════════
//
// «답안 연습장» 화면(screen-practice)에 처음 들어올 때 한 번, 내 students.id 를
// 알아 둡니다(교사 화면과 달리 학생은 자기 자신뿐이라 한 번만 물으면 됩니다).
var practiceMyStudentId = null;
var practiceMyGrade = '전체';
var practiceActiveTab = 'write';

async function practiceStudentEnter() {
  if (!practiceMyStudentId) {
    const { data, error } = await sb.from('students').select('id, grade').maybeSingle();
    if (error || !data) { toast_or_alert('내 학생 정보를 불러오지 못했습니다.'); return; }
    practiceMyStudentId = data.id;
    practiceMyGrade = data.grade ? String(data.grade) : '전체';
  }
  practiceGoTab('write');
}

function practiceGoTab(which) {
  practiceActiveTab = which;
  document.getElementById('prac-tab-write').setAttribute('aria-current', which === 'write');
  document.getElementById('prac-tab-browse').setAttribute('aria-current', which === 'browse');
  document.getElementById('prac-write').hidden = which !== 'write';
  document.getElementById('prac-browse').hidden = which !== 'browse';
  if (which === 'write') {
    practiceWriteInit(practiceMyStudentId, practiceMyGrade);
  } else {
    practiceBrowseInit(practiceMyStudentId, {
      gradeBox: document.getElementById('prac-browse-grade'),
      catBox: document.getElementById('prac-browse-cat'),
      list: document.getElementById('prac-browse-list')
    }, practiceMyGrade);
  }
}
