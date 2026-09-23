// 답안 연습장 — 학생이 스스로 예상 질문·답변을 써 보는 공간.
//
// 면접(interviews)과는 다른 표(practice_answers · practice_categories · practice_comments)를
// 씁니다. 선생님은 학생을 고른 뒤 «답안 연습장» 탭에서 읽고 코멘트를 답니다
// (RLS 가 선생님 쪽의 답안 쓰기·지우기는 아예 막아 둡니다 — 코멘트는 따로 허락됩니다).
//
// ⚠️ 처음에는 학년·분류 칩을 «하나만 고르는» 것으로, 「전체」라는 학년까지 두고 만들었는데
//    써 보니 조회·수정 둘 다 불편했습니다 — 정확히 같은 학년·분류를 다시 찾아야만
//    쓴 게 보였습니다. 그래서 **칩은 «좁혀 보는 필터»** 로 바꿨습니다 —
//    여러 개를 골라도 되고, 아무것도 안 고르면 전체가 보입니다.
//    학년의 「전체」도 「공통」으로 이름을 바꿨습니다 — 학년을 «다 보여준다» 는 뜻이 아니라
//    «어느 학년에도 매이지 않는 질문」 이라는, 분류에 가까운 뜻이기 때문입니다.
//
// 학생 앱(index.html)과 교사 화면(teacher/index.html)이 함께 씁니다.
// esc() · SCHOOL_ID 는 report.js · config.js 가 먼저 실어 둡니다.

var PRACTICE_FIXED_CATS = ['인성', '자율', '진로', '동아리', '세특', '행발'];
var PRACTICE_GRADES = ['공통', '1', '2', '3'];

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

// 코멘트는 «지금 화면에 뜬 답안들» 것만 한 번에 불러옵니다. answerIds 가 비어 있으면
// 서버에 묻지 않습니다(교사 쪽 RLS 는 같은 학교 전체를 허락하므로, 안 거르면
// 다른 학생 것까지 섞여 옵니다).
async function fetchPracticeComments(answerIds) {
  if (!answerIds.length) return [];
  const { data, error } = await sb.from('practice_comments')
    .select('id, answer_id, teacher_name, content, created_at')
    .in('answer_id', answerIds)
    .order('created_at', { ascending: true });
  if (error) { console.warn('코멘트를 못 불러왔습니다:', error.message); return []; }
  return data || [];
}

function practiceGroupComments(list) {
  var by = {};
  (list || []).forEach(function (c) { (by[c.answer_id] = by[c.answer_id] || []).push(c); });
  return by;
}

// ── 필터 칩(여러 개 고를 수 있습니다) ──
// selected: 고른 값들의 배열. 안에 있으면 눌린 채로 그립니다.
// 아무것도 안 골랐으면 «전부 보여준다» 는 뜻이라, practiceMatchFilter() 에서 그렇게 다룹니다.
function practiceFilterChipsHTML(items, selected, onClick, extraHTML) {
  return items.map(function (v) {
    var on = selected.indexOf(v) > -1;
    return '<button class="prac-chip" aria-pressed="' + on + '"' +
           ' onclick="' + onClick + '(\'' + String(v).replace(/'/g, "\\'") + '\')">' +
           esc(v) + '</button>';
  }).join('') + (extraHTML || '');
}

function practiceToggleIn(arr, v) {
  var at = arr.indexOf(v);
  if (at > -1) arr.splice(at, 1); else arr.push(v);
}

// 골라 둔 게 있으면 그중 하나와 같아야 하고, 하나도 안 골랐으면 다 통과합니다.
function practiceMatchFilter(value, selected) {
  return !selected.length || selected.indexOf(value) > -1;
}

// ── 필터를 담는 접이식 상자 ──
// 학년·분류 칩이 자리를 많이 차지해서(휴대폰에서 메뉴처럼 찌그러짐), 상자 하나로
// 묶어 접었다 펼 수 있게 했습니다. 열고 닫은 마지막 상태는 기기에 기억해 두고
// (localStorage, «which» 별로 따로 — write · browse · teacher), 처음 쓸 때는
// 접힌 채로 시작합니다.
function practiceFboxKey(which) { return 'practiceFboxOpen:' + which; }

function practiceFboxIsOpen(which) {
  try { return localStorage.getItem(practiceFboxKey(which)) === '1'; } catch (e) { return false; }
}

function practiceToggleFbox(which) {
  var open = !practiceFboxIsOpen(which);
  try { localStorage.setItem(practiceFboxKey(which), open ? '1' : '0'); } catch (e) { /* 사생활 보호 모드면 막힐 수 있습니다 */ }
  practicePaintFboxOpen(which);
}

function practicePaintFboxOpen(which) {
  var head = document.getElementById('fbox-head-' + which);
  var body = document.getElementById('fbox-body-' + which);
  if (!head || !body) return;
  var open = practiceFboxIsOpen(which);
  head.setAttribute('aria-expanded', open);
  body.hidden = !open;
}

// 학년 · 분류 몇 개를 골라 뒀는지 접힌 채로도 알 수 있게 한 줄 요약.
function practiceFboxSummary(which, grades, cats) {
  var el = document.getElementById('fbox-summary-' + which);
  if (!el) return;
  var g = !grades.length ? '전체' : grades.length === 1 ? grades[0] : grades.length + '개';
  var c = !cats.length ? '전체' : cats.length === 1 ? cats[0] : cats.length + '개';
  el.textContent = '학년 ' + g + ' · 분류 ' + c;
}

function practicePaintFbox(which, grades, cats) {
  practicePaintFboxOpen(which);
  practiceFboxSummary(which, grades, cats);
}

// 카드 한 장(읽기 전용) — 교사 화면과 학생 «조회» 탭이 같이 씁니다.
// canComment 가 있으면(교사) 코멘트 입력칸도 붙습니다. editBtn 이 있으면(학생 조회) «수정» 단추가 붙습니다.
function practiceCardViewHTML(a, comments, opts) {
  opts = opts || {};
  return '<div class="prac-card">' +
    '<div class="prac-card-head">' +
      '<span class="prac-card-meta">' +
        '<span class="prac-badges"><span class="prac-badge">' + esc(a.grade) + '</span>' +
        '<span class="prac-badge cat">' + esc(a.category) + '</span></span>' +
        '<span class="prac-card-when">' + practiceWhen(a) + '</span>' +
      '</span>' +
      (opts.editBtn ? '<button class="prac-edit" onclick="practiceJumpToEdit(\'' +
        a.grade + '\',\'' + a.category.replace(/'/g, "\\'") + '\',\'' + a.id + '\')">수정</button>' : '') +
    '</div>' +
    '<p class="prac-q-view">' + esc(a.question || '(질문 없음)') + '</p>' +
    (a.answer ? '<p class="prac-a-view">' + esc(a.answer) + '</p>'
              : '<p class="prac-a-view" style="color:var(--ink-3)">(아직 답을 안 썼습니다)</p>') +
    practiceCommentsHTML(a.id, comments || [], !!opts.canComment) +
    '</div>';
}

// ── 코멘트 — 선생님만 답니다. 학생은 읽고, 열어 보면 읽음 표시가 남습니다 ──
function practiceCommentsHTML(answerId, comments, canWrite) {
  var unread = comments.filter(function (c) { return c.__unread; }).length;
  return '<div class="prac-comments">' +
    '<button class="prac-comment-toggle" onclick="practiceToggleComments(\'' + answerId + '\')">' +
      '💬 코멘트 ' + comments.length + '개' +
      (unread ? '<span class="prac-cbadge">' + unread + '</span>' : '') +
    '</button>' +
    '<div class="prac-comment-body" id="cm-body-' + answerId + '" hidden>' +
      (comments.length ? comments.map(function (c) {
        return '<div class="prac-comment">' +
          '<div class="prac-comment-head"><b>' + esc(c.teacher_name || '선생님') + '</b>' +
          '<span class="prac-comment-when">' + practiceWhen(c) + '</span></div>' +
          '<p>' + esc(c.content) + '</p></div>';
      }).join('') : '<p class="prac-empty" style="padding:10px 0">아직 코멘트가 없습니다.</p>') +
      (canWrite ? '<div class="prac-comment-form">' +
        '<textarea id="cm-input-' + answerId + '" rows="2" placeholder="이 답안에 코멘트를 남겨 보세요"></textarea>' +
        '<button class="ghost" onclick="practiceSendComment(\'' + answerId + '\')">코멘트 남기기</button>' +
      '</div>' : '') +
    '</div>' +
  '</div>';
}

function practiceToggleComments(answerId) {
  var box = document.getElementById('cm-body-' + answerId);
  if (!box) return;
  box.hidden = !box.hidden;
  if (!box.hidden) practiceMarkCommentsRead(answerId);
}

// ══════════════ 조회(읽기 전용) — 학생 «조회» 탭 + 교사 화면이 같이 씁니다 ══════════════
//
// els = { gradeBox, catBox, hintBox, list } — 각 앱의 실제 div id.
var PB = null;

async function practiceBrowseInit(studentId, els, opts) {
  opts = opts || {};
  PB = { studentId: studentId, els: els, grades: [], cats: [], allCats: [], answers: [],
         comments: {}, canComment: !!opts.canComment, editBtn: !!opts.editBtn,
         fboxKey: opts.fboxKey || 'browse' };

  els.list.innerHTML = '<p class="prac-empty">불러오는 중...</p>';

  var rows = await Promise.all([fetchPracticeCategories(studentId), fetchPracticeAnswers(studentId)]);
  PB.allCats = rows[0].map(function (c) { return c.name; });
  PB.answers = rows[1];
  await practiceBrowseLoadComments();

  practiceBrowseRender();
}

async function practiceBrowseLoadComments() {
  var list = await fetchPracticeComments(PB.answers.map(function (a) { return a.id; }));
  if (!PB.canComment) {
    // 학생 쪽에서는 «안 읽은 것» 을 가려 알려 줘야 합니다.
    await practiceLoadCommentReads();
    list.forEach(function (c) { c.__unread = !practiceCommentReads[c.id]; });
  }
  PB.comments = practiceGroupComments(list);
}

function practiceBrowseToggleGrade(g) { practiceToggleIn(PB.grades, g); practiceBrowseRender(); }
function practiceBrowseToggleCat(c) { practiceToggleIn(PB.cats, c); practiceBrowseRender(); }

function practiceBrowseRender() {
  if (!PB) return;
  PB.els.gradeBox.innerHTML = practiceFilterChipsHTML(PRACTICE_GRADES, PB.grades, 'practiceBrowseToggleGrade');
  PB.els.catBox.innerHTML = practiceFilterChipsHTML(PRACTICE_FIXED_CATS.concat(PB.allCats), PB.cats, 'practiceBrowseToggleCat');
  practicePaintFbox(PB.fboxKey, PB.grades, PB.cats);

  var list = PB.answers.filter(function (a) {
    return practiceMatchFilter(a.grade, PB.grades) && practiceMatchFilter(a.category, PB.cats);
  }).sort(function (x, y) { return new Date(y.updated_at) - new Date(x.updated_at); });

  PB.els.list.innerHTML = list.length
    ? list.map(function (a) {
        return practiceCardViewHTML(a, PB.comments[a.id], { canComment: PB.canComment, editBtn: PB.editBtn });
      }).join('')
    : '<p class="prac-empty">' + (PB.answers.length ? '이 조건에 맞는 답안이 없습니다.' : '아직 쓴 답안이 없습니다.') + '</p>';
}

// «수정» — 조회에서 작성 탭으로 넘어가 그 답안이 바로 보이게 필터를 맞춥니다.
function practiceJumpToEdit(grade, category, answerId) {
  practiceGoTab('write', { grades: [grade], cats: [category], scrollTo: answerId });
}

// ── 코멘트 쓰기(교사) ──
async function practiceSendComment(answerId) {
  var el = document.getElementById('cm-input-' + answerId);
  if (!el) return;
  var content = el.value.trim();
  if (!content) return;

  var meName = (typeof me !== 'undefined' && me && me.name) || '선생님';
  const { data, error } = await sb.from('practice_comments')
    .insert({ answer_id: answerId, teacher_id: me.id, teacher_name: meName, content: content })
    .select('id, answer_id, teacher_name, content, created_at').single();
  if (error) { toast_or_alert('코멘트를 남기지 못했습니다: ' + error.message); return; }

  (PB.comments[answerId] = PB.comments[answerId] || []).push(data);
  practiceBrowseRender();
  var box = document.getElementById('cm-body-' + answerId);
  if (box) box.hidden = false;
}

// ── 코멘트 읽음 표시(학생) ──
var practiceCommentReads = {};   // { comment_id: read_at }
var practiceCommentReadsLoaded = false;

async function practiceLoadCommentReads() {
  if (practiceCommentReadsLoaded) return;
  var uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
  if (!uid) return;
  const { data, error } = await sb.from('practice_comment_reads').select('comment_id, read_at').eq('user_id', uid);
  if (error) { console.warn('코멘트 읽음 표시를 못 불러왔습니다:', error.message); return; }
  practiceCommentReadsLoaded = true;
  (data || []).forEach(function (r) { practiceCommentReads[r.comment_id] = r.read_at; });
}

async function practiceMarkCommentsRead(answerId) {
  if (PB && PB.canComment) return;   // 교사 쪽엔 읽음 표시가 없습니다
  var list = (PB && PB.comments[answerId]) || [];
  var unread = list.filter(function (c) { return c.__unread; });
  if (!unread.length) return;
  var uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
  if (!uid) return;

  unread.forEach(function (c) { c.__unread = false; practiceCommentReads[c.id] = new Date().toISOString(); });
  practiceUnreadCount = Math.max(0, practiceUnreadCount - unread.length);
  practicePaintBadge();
  var rows = unread.map(function (c) { return { user_id: uid, comment_id: c.id }; });
  await sb.from('practice_comment_reads').upsert(rows, { onConflict: 'user_id,comment_id' });
}

// 홈 화면의 빨간 숫자 — 안 읽은 코멘트 개수. student-report.js 의 report-badge 와 같은 짜임입니다.
async function practiceRefreshBadge() {
  if (typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'student') return;
  const { data, error } = await sb.from('practice_answers').select('id');
  if (error) return;
  var ids = (data || []).map(function (a) { return a.id; });
  var comments = await fetchPracticeComments(ids);
  await practiceLoadCommentReads();
  practiceUnreadCount = comments.filter(function (c) { return !practiceCommentReads[c.id]; }).length;
  practicePaintBadge();
}

var practiceUnreadCount = 0;
function practicePaintBadge() {
  var el = document.getElementById('practice-badge');
  if (!el) return;
  el.textContent = practiceUnreadCount;
  el.hidden = practiceUnreadCount === 0;
}

var practiceWatchOn = false;
function practiceWatchComments() {
  if (practiceWatchOn || typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'student') return;
  practiceWatchOn = true;
  try {
    sb.channel('my-practice-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_comments' },
          function () { practiceRefreshBadge(); })
      .subscribe();
  } catch (e) { console.warn('실시간 알림을 켜지 못했습니다:', e); }
  setInterval(practiceRefreshBadge, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) practiceRefreshBadge(); });
  practiceRefreshBadge();
}

// ══════════════ 작성 — 학생만 씁니다 ══════════════
//
// 카드 하나 = practice_answers 한 줄. 빈 채로 만들어 두지 않고, 첫 글자를 쳐야
// 서버에 줄이 생깁니다(멈춘 뒤 1.5초, 또는 칸을 벗어날 때). 다 지워서 다시 비면
// 그 줄은 지우고, 카드는 화면에 그대로 두어 계속 쓸 수 있게 합니다.
//
// ⚠️ 학년·분류 칩은 «필터» 입니다 — 답안 자체의 학년·분류가 아닙니다.
//    답안의 학년·분류는 «+ 새 질문 쓰기» 를 누를 때 작은 창에서 한 번만 정합니다.
var PW = null;             // { studentId, grades, cats, allCats, all, cards: [...] }
var PW_KEY = 0;

async function practiceWriteInit(studentId, myGrade, preset) {
  PW = { studentId: studentId, myGrade: myGrade || '공통',
         grades: (preset && preset.grades) || [], cats: (preset && preset.cats) || [],
         allCats: [], all: [], cards: [] };
  document.getElementById('prac-write-list').innerHTML = '<p class="prac-empty">불러오는 중...</p>';

  var rows = await Promise.all([fetchPracticeCategories(studentId), fetchPracticeAnswers(studentId)]);
  PW.allCats = rows[0].map(function (c) { return c.name; });
  PW.all = rows[1];

  practiceWriteRenderChips();
  practiceWriteRenderCards();
  if (preset && preset.scrollTo) practiceScrollToCard(preset.scrollTo);
}

function practiceWriteToggleGrade(g) { practiceToggleIn(PW.grades, g); practiceWriteRenderChips(); practiceWriteRenderCards(); }
function practiceWriteToggleCat(c) { practiceToggleIn(PW.cats, c); practiceWriteRenderChips(); practiceWriteRenderCards(); }

function practiceWriteRenderChips() {
  document.getElementById('prac-write-grade').innerHTML =
    practiceFilterChipsHTML(PRACTICE_GRADES, PW.grades, 'practiceWriteToggleGrade');

  // 학생이 만든 분류에는 이름 옆에 작은 «수정» 단추를 붙입니다. 기본 6개는 못 건드립니다.
  var fixedHTML = practiceFilterChipsHTML(PRACTICE_FIXED_CATS, PW.cats, 'practiceWriteToggleCat');
  var customHTML = PW.allCats.map(function (name) {
    var on = PW.cats.indexOf(name) > -1;
    return '<span class="prac-chip-wrap">' +
      '<button class="prac-chip" aria-pressed="' + on + '"' +
      ' onclick="practiceWriteToggleCat(\'' + name.replace(/'/g, "\\'") + '\')">' + esc(name) + '</button>' +
      '<button class="prac-chip-edit" title="이름 바꾸기·지우기"' +
      ' onclick="practiceEditCategory(\'' + name.replace(/'/g, "\\'") + '\')">✎</button>' +
      '</span>';
  }).join('');
  document.getElementById('prac-write-cat').innerHTML = fixedHTML + customHTML;
  practicePaintFbox('write', PW.grades, PW.cats);
}

function practiceWriteFiltered() {
  return (PW.all || []).filter(function (a) {
    return practiceMatchFilter(a.grade, PW.grades) && practiceMatchFilter(a.category, PW.cats);
  }).sort(function (x, y) { return new Date(y.updated_at) - new Date(x.updated_at); });
}

function practiceWriteRenderCards() {
  var list = practiceWriteFiltered();
  PW.cards = list.map(function (a) {
    return { key: 'k' + (++PW_KEY), id: a.id, grade: a.grade, category: a.category,
             question: a.question || '', answer: a.answer || '', timer: null };
  });
  practiceWriteDrawCards();
}

function practiceWriteDrawCards() {
  var box = document.getElementById('prac-write-list');
  if (!PW.cards.length) {
    box.innerHTML = '<p class="prac-empty">' +
      ((PW.all || []).length ? '이 조건에 맞는 답안이 없습니다.' : '아직 쓴 것이 없습니다. 아래 단추로 새로 써 보세요.') +
      '</p>';
    return;
  }
  box.innerHTML = PW.cards.map(function (c) {
    return '<div class="prac-card" data-key="' + c.key + '" data-id="' + (c.id || '') + '">' +
      '<div class="prac-card-head">' +
        '<span class="prac-card-meta">' +
          '<span class="prac-badges"><span class="prac-badge">' + esc(c.grade) + '</span>' +
          '<span class="prac-badge cat">' + esc(c.category) + '</span></span>' +
          '<span class="prac-card-when" id="' + c.key + '-when"></span>' +
        '</span>' +
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

function practiceScrollToCard(answerId) {
  var el = document.querySelector('.prac-card[data-id="' + answerId + '"]');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(function () { el.classList.remove('flash'); }, 1600);
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

// ── «+ 새 질문 쓰기» — 학년·분류를 먼저 정하는 작은 창 ──
var pracNewGrade = null, pracNewCat = null;

function practiceOpenNewModal() {
  pracNewGrade = PW.myGrade;
  pracNewCat = PRACTICE_FIXED_CATS[0];
  practicePaintNewModal();
  document.getElementById('prac-modal-overlay').style.display = 'flex';
}
function practiceCloseNewModal() {
  document.getElementById('prac-modal-overlay').style.display = 'none';
}
function practicePickNewGrade(g) { pracNewGrade = g; practicePaintNewModal(); }
function practicePickNewCat(c) { pracNewCat = c; practicePaintNewModal(); }
function practicePaintNewModal() {
  document.getElementById('prac-modal-grade').innerHTML = PRACTICE_GRADES.map(function (g) {
    return '<button class="prac-chip" aria-pressed="' + (g === pracNewGrade) + '"' +
           ' onclick="practicePickNewGrade(\'' + g + '\')">' + esc(g) + '</button>';
  }).join('');
  document.getElementById('prac-modal-cat').innerHTML = PRACTICE_FIXED_CATS.concat(PW.allCats).map(function (c) {
    return '<button class="prac-chip" aria-pressed="' + (c === pracNewCat) + '"' +
           ' onclick="practicePickNewCat(\'' + c.replace(/'/g, "\\'") + '\')">' + esc(c) + '</button>';
  }).join('') + '<button class="prac-chip add" onclick="practiceAddCategory()">＋ 새 분류</button>';
}

// 창에서 «만들기» — 화면에 빈 카드만 하나 더합니다. 서버에는 아직 안 씁니다(첫 글자를 쳐야 씁니다).
function practiceConfirmNewCard() {
  practiceCloseNewModal();
  // 지금 필터에 안 걸리는 학년·분류를 골랐으면, 새 카드가 안 보이지 않게 필터를 맞춥니다.
  if (PW.grades.length && PW.grades.indexOf(pracNewGrade) === -1) PW.grades = [];
  if (PW.cats.length && PW.cats.indexOf(pracNewCat) === -1) PW.cats = [];
  practiceWriteRenderChips();

  PW.cards.unshift({ key: 'k' + (++PW_KEY), id: null, grade: pracNewGrade, category: pracNewCat,
                      question: '', answer: '', timer: null });
  practiceWriteDrawCards();
  var kv = practiceCardKV(PW.cards[0].key);
  if (kv) { kv.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); kv.q.focus(); }
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
      PW.all = PW.all.filter(function (x) { return x.id !== c.id; });
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
    var row = PW.all.filter(function (x) { return x.id === c.id; })[0];
    if (row) { row.question = q; row.answer = a; row.updated_at = new Date().toISOString(); }
  } else {
    const { data, error } = await sb.from('practice_answers').insert({
      school_id: SCHOOL_ID, student_id: PW.studentId, grade: c.grade, category: c.category,
      question: q, answer: a
    }).select('id, created_at, updated_at').single();
    if (error) { kv.hint.textContent = '저장하지 못했습니다: ' + error.message; kv.hint.className = 'prac-savehint'; return; }
    c.id = data.id;
    kv.el.setAttribute('data-id', data.id);
    PW.all.push({ id: c.id, grade: c.grade, category: c.category, question: q, answer: a,
                  created_at: data.created_at, updated_at: data.updated_at });
  }
  kv.hint.textContent = '저장됨'; kv.hint.className = 'prac-savehint saved';
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
  if (PRACTICE_FIXED_CATS.indexOf(name) > -1 || PW.allCats.indexOf(name) > -1) {
    toast_or_alert('이미 있는 분류입니다.'); return;
  }
  sb.from('practice_categories').insert({ school_id: SCHOOL_ID, student_id: PW.studentId, name: name })
    .select('id, name').single().then(function (res) {
      if (res.error) { toast_or_alert('분류를 만들지 못했습니다: ' + res.error.message); return; }
      PW.allCats.push(name);
      // 새 카드 창이 열려 있는 중이었다면 거기서 바로 고른 상태로 이어 줍니다.
      var overlay = document.getElementById('prac-modal-overlay');
      if (overlay && overlay.style.display === 'flex') { pracNewCat = name; practicePaintNewModal(); }
      else { PW.cats.push(name); practiceWriteRenderChips(); practiceWriteRenderCards(); }
    });
}

// 이름 바꾸기 / 지우기. 학생이 만든 분류에만 있습니다(기본 6개는 못 건드립니다).
async function practiceEditCategory(name) {
  var choice = prompt('"' + name + '" — 새 이름을 적으면 바꾸고, 빈 채로 확인을 누르면 아래에서 지울지 물어봅니다.', name);
  if (choice === null) return;
  choice = choice.trim();

  if (choice && choice !== name) {
    if (PRACTICE_FIXED_CATS.indexOf(choice) > -1 || PW.allCats.indexOf(choice) > -1) {
      toast_or_alert('이미 있는 분류 이름입니다.'); return;
    }
    var upd = await sb.from('practice_categories').update({ name: choice })
      .eq('student_id', PW.studentId).eq('name', name);
    if (upd.error) { toast_or_alert('이름을 바꾸지 못했습니다: ' + upd.error.message); return; }
    // 그 분류로 이미 써 둔 답안들도 새 이름을 따라가게 합니다.
    await sb.from('practice_answers').update({ category: choice })
      .eq('student_id', PW.studentId).eq('category', name);
    PW.allCats = PW.allCats.map(function (n) { return n === name ? choice : n; });
    (PW.all || []).forEach(function (a) { if (a.category === name) a.category = choice; });
    PW.cats = PW.cats.map(function (n) { return n === name ? choice : n; });
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
    PW.allCats = PW.allCats.filter(function (n) { return n !== name; });
    PW.cats = PW.cats.filter(function (n) { return n !== name; });
    practiceWriteRenderChips();
    practiceWriteRenderCards();
  }
}

// ══════════════ 내려받기 — 엑셀로 저장 · 인쇄 (학생·교사 화면 공통) ══════════════
//
// 선생님이 이미 쓰시던 "면접 질문지" 엑셀 양식(연번·학년·종류·질문·답변)에 맞춰
// 내려받습니다. 지금 걸어 둔 필터와 상관없이 그 학생의 답안 전부를 담습니다.
function practiceExportSort(list) {
  return list.slice().sort(function (a, b) {
    var gi = PRACTICE_GRADES.indexOf(a.grade) - PRACTICE_GRADES.indexOf(b.grade);
    if (gi) return gi;
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

async function practiceDownloadExcel(studentId, label) {
  if (!window.XLSX) { toast_or_alert('엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); return; }
  var list = practiceExportSort(await fetchPracticeAnswers(studentId));
  if (!list.length) { toast_or_alert('내려받을 답안이 없습니다.'); return; }

  var aoa = [['', '면접 질문지'], [], ['', '연번', '학년', '종류', '질문', '답변']];
  list.forEach(function (a, i) { aoa.push(['', i + 1, a.grade, a.category, a.question || '', a.answer || '']); });

  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 1 }, e: { r: 0, c: 5 } }];
  ws['!cols'] = [{ wch: 2 }, { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 40 }, { wch: 60 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '면접 질문지');
  XLSX.writeFile(wb, (label || '면접질문지') + '_면접질문지.xlsx');
}

function practicePrintRowsHTML(list) {
  return list.map(function (a, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + esc(a.grade) + '</td><td>' + esc(a.category) + '</td>' +
      '<td>' + esc(a.question || '').replace(/\n/g, '<br>') + '</td>' +
      '<td>' + esc(a.answer || '').replace(/\n/g, '<br>') + '</td></tr>';
  }).join('');
}

async function practicePrintView(studentId, label) {
  var list = practiceExportSort(await fetchPracticeAnswers(studentId));
  if (!list.length) { toast_or_alert('인쇄할 답안이 없습니다.'); return; }
  var win = window.open('', '_blank');
  if (!win) { toast_or_alert('팝업이 막혀 있습니다. 팝업 차단을 풀고 다시 시도해 주세요.'); return; }
  win.document.write(
    '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(label || '면접 질문지') + '</title>' +
    '<style>' +
      'body{font-family:"Malgun Gothic",sans-serif;padding:24px;color:#111}' +
      'h1{font-size:18px;margin:0 0 4px}' +
      'p.sub{color:#666;margin:0 0 16px;font-size:13px}' +
      'table{width:100%;border-collapse:collapse;table-layout:fixed}' +
      'th,td{border:1px solid #999;padding:6px 8px;font-size:12px;vertical-align:top;word-break:break-word}' +
      'th{background:#f2f2f2}' +
      'td:nth-child(1),td:nth-child(2),td:nth-child(3){text-align:center}' +
      '@media print{@page{size:A4 landscape;margin:14mm}}' +
    '</style></head><body>' +
    '<h1>면접 질문지</h1><p class="sub">' + esc(label || '') + '</p>' +
    // table-layout:fixed 는 첫 줄(머리글) 셀 너비를 기준으로 칸을 나누므로, td 에만
    // 너비를 줘 봐야 안 먹습니다. colgroup 으로 직접 칸 너비를 정해야 질문·답변이
    // 실제로 넓게 인쇄됩니다.
    '<table><colgroup><col style="width:6%"><col style="width:7%"><col style="width:11%">' +
      '<col style="width:30%"><col style="width:46%"></colgroup>' +
    '<thead><tr><th>연번</th><th>학년</th><th>종류</th><th>질문</th><th>답변</th></tr></thead>' +
    '<tbody>' + practicePrintRowsHTML(list) + '</tbody></table>' +
    '<script>window.onload = function () { window.print(); };<\/script>' +
    '</body></html>'
  );
  win.document.close();
}

// 학생 앱에는 showToast(), 교사 화면에는 toast() 가 있어 그걸 씁니다. 둘 다 없으면 alert 로.
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
var practiceMyGrade = '공통';
var practiceActiveTab = 'write';

// 내려받기 파일 이름에 쓸 이름표.
function practiceMyLabel() {
  return (typeof currentUser !== 'undefined' && currentUser && (currentUser.name || currentUser.login_id)) || '나';
}

async function practiceStudentEnter() {
  if (!practiceMyStudentId) {
    const { data, error } = await sb.from('students').select('id, grade').maybeSingle();
    if (error || !data) { toast_or_alert('내 학생 정보를 불러오지 못했습니다.'); return; }
    practiceMyStudentId = data.id;
    practiceMyGrade = data.grade ? String(data.grade) : '공통';
  }
  practiceGoTab('write');
}

function practiceGoTab(which, preset) {
  practiceActiveTab = which;
  document.getElementById('prac-tab-write').setAttribute('aria-current', which === 'write');
  document.getElementById('prac-tab-browse').setAttribute('aria-current', which === 'browse');
  document.getElementById('prac-write').hidden = which !== 'write';
  document.getElementById('prac-browse').hidden = which !== 'browse';
  if (which === 'write') {
    practiceWriteInit(practiceMyStudentId, practiceMyGrade, preset);
  } else {
    practiceBrowseInit(practiceMyStudentId, {
      gradeBox: document.getElementById('prac-browse-grade'),
      catBox: document.getElementById('prac-browse-cat'),
      list: document.getElementById('prac-browse-list')
    }, { editBtn: true });
  }
}
