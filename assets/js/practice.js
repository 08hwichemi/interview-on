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

// «선생님 질문» — 선생님이 생기부에서 뽑아 보낸 질문을 학생이 «받은 질문» 에서 골라 넣으면 이 분류가 됩니다.
var PRACTICE_OFFER_CAT = '선생님 질문';
var PRACTICE_FIXED_CATS = ['인성', '자율', '진로', '동아리', '세특', '행발', PRACTICE_OFFER_CAT];
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

// ── 문제 번호 · 정렬 ──
// 번호는 «처음 쓴 순서» 대로 1, 2, 3… 이 자동으로 붙습니다(서버에 따로 적지 않고 화면에서 셉니다).
// 필터·정렬을 바꿔도, 선생님 화면과 학생 화면 어디서든 같은 답안은 같은 번호입니다 —
// 학생과 «5번 문제 말인데» 하고 이야기할 수 있게 한 것입니다.
// ⚠️ 번호는 그 학생의 답안 «전체» 에서 셉니다(필터로 좁힌 목록 안에서 세면 번호가 필터마다 달라집니다).
//    답안을 지우면 뒤 번호가 하나씩 당겨집니다.
function practiceNumbers(all) {
  var sorted = (all || []).slice().sort(function (a, b) {
    var d = new Date(a.created_at) - new Date(b.created_at);
    return d || (a.id < b.id ? -1 : 1);
  });
  var map = {};
  sorted.forEach(function (a, i) { map[a.id] = i + 1; });
  return map;
}

// 정렬: num(번호순 = 처음 쓴 순) · recent(최근 고친 순) · group(학년·분류순). 기기에 기억합니다.
var PRACTICE_SORTS = [
  { key: 'num', label: '번호순' },
  { key: 'recent', label: '최근 고친 순' },
  { key: 'group', label: '학년·분류순' }
];

function practiceSortKey() {
  var v = null;
  try { v = localStorage.getItem('practiceSort'); } catch (e) { /* 사생활 보호 모드면 막힐 수 있습니다 */ }
  return PRACTICE_SORTS.some(function (o) { return o.key === v; }) ? v : 'num';
}

function practiceSortList(list, nums) {
  var key = practiceSortKey();
  return list.slice().sort(function (x, y) {
    if (key === 'recent') return new Date(y.updated_at) - new Date(x.updated_at);
    if (key === 'group') {
      var gi = PRACTICE_GRADES.indexOf(x.grade) - PRACTICE_GRADES.indexOf(y.grade);
      if (gi) return gi;
      if (x.category !== y.category) return x.category < y.category ? -1 : 1;
    }
    return (nums[x.id] || 0) - (nums[y.id] || 0);
  });
}

function practiceSortChipsHTML() {
  var cur = practiceSortKey();
  return PRACTICE_SORTS.map(function (o) {
    return '<button class="prac-chip" aria-pressed="' + (o.key === cur) + '"' +
           ' onclick="practiceSetSort(\'' + o.key + '\')">' + o.label + '</button>';
  }).join('');
}

// 필터 상자 안의 «정렬» 칩을 그립니다. which = write · browse · teacher
function practicePaintSort(which) {
  var el = document.getElementById('prac-sort-' + which);
  if (el) el.innerHTML = practiceSortChipsHTML();
}

function practiceSetSort(key) {
  try { localStorage.setItem('practiceSort', key); } catch (e) { /* 막히면 이번에만 */ }
  ['write', 'browse', 'teacher'].forEach(practicePaintSort);
  if (PB) practiceBrowseRender();
  if (PW && document.getElementById('prac-write-list')) practiceWriteRenderCards();
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
        (opts.num ? '<span class="prac-num">' + opts.num + '번</span>' : '') +
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
  practicePaintSort(PB.fboxKey);
  practicePaintFbox(PB.fboxKey, PB.grades, PB.cats);

  var nums = practiceNumbers(PB.answers);
  var list = practiceSortList(PB.answers.filter(function (a) {
    return practiceMatchFilter(a.grade, PB.grades) && practiceMatchFilter(a.category, PB.cats);
  }), nums);

  PB.els.list.innerHTML = list.length
    ? list.map(function (a) {
        return practiceCardViewHTML(a, PB.comments[a.id], { canComment: PB.canComment, editBtn: PB.editBtn, num: nums[a.id] });
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
  // 답안 id 를 먼저 받지 않고 코멘트를 바로 묻습니다(요청 2번 → 1번).
  // 학생 RLS(practice_comments_student_read)가 자기 답안에 달린 것만 돌려줍니다.
  const { data, error } = await sb.from('practice_comments').select('id');
  if (error) return;
  var comments = data || [];
  await practiceLoadCommentReads();
  practiceUnreadCount = comments.filter(function (c) { return !practiceCommentReads[c.id]; }).length;
  await practiceCountNewOffers();   // 선생님이 보낸 질문 가운데 아직 안 고른 것 — 같은 때 한 번만 셉니다
  practicePaintBadge();
}

var practiceUnreadCount = 0;
// 홈의 «답안 연습장» 숫자 = 안 읽은 코멘트 + 새로 받은 질문
function practicePaintBadge() {
  var el = document.getElementById('practice-badge');
  if (el) {
    var n = practiceUnreadCount + practiceNewOfferCount;
    el.textContent = n;
    el.hidden = n === 0;
  }
  var ob = document.getElementById('prac-offer-badge');
  if (ob) { ob.textContent = practiceNewOfferCount; ob.hidden = practiceNewOfferCount === 0; }
}

// 코멘트는 급하지 않아서 실시간·주기 확인은 두지 않습니다(student-report.js 와 같은 방식).
// 앱을 열 때 한 번, 앱으로 돌아왔을 때 마지막 확인에서 5분이 지났으면 한 번 —
// 2026-10-08 부터 그 확인은 badges.js 가 공지·톡·리포트와 한 번에 묻고 «안 읽은 코멘트 수 · 새로 받은 질문 수» 를 넘겨줍니다.
// (practiceRefreshBadge 는 묶음 확인이 실패했을 때 쓰는 예전 길입니다)
function practiceApplyBadge(unreadComments, newOffers) {
  practiceUnreadCount = unreadComments;
  practiceNewOfferCount = newOffers;
  practicePaintBadge();
}

// ══════════════ 받은 질문 — 선생님이 생기부에서 뽑아 보낸 질문 (2026-10-07) ══════════════
//
// 선생님 말씀: 선생님이 생기부로 뽑은 질문을 학생에게 보내되, 다 쓰게 할 필요는 없고 학생이 골라서
// 답을 써 보게. 고른 뒤에는 고쳐 쓸 수도 있게.
//   · 선생님은 생기부 화면의 「학생에게 보내기」로 practice_offers 에 넣습니다(같은 질문은 하나만)
//   · 학생은 「📥 받은 질문」 창에서 여러 개 체크 → 「고른 N개 넣기」 → «쓴 것들» 맨 위에 «선생님 질문» 카드
//   · 카드는 학생이 직접 만드는 practice_answers 줄이라, 질문 글자도 거기서 고칩니다(받은 원문은 그대로 남음)
//   · 안 쓸 질문은 「안 쓸래요」로 치웁니다. 치운 것은 창 아래에서 다시 꺼낼 수 있습니다
// 서버 요청: 앱을 열 때 숫자 세기 1번(코멘트와 같은 때) · 창을 열 때 1번 · 넣거나 치울 때 1~2번.
// 주기 확인은 두지 않습니다(Supabase 무료 요금제 — docs/할-일.md «Supabase 로그 줄이기»).
var practiceNewOfferCount = 0;
var PO = { list: [], picked: {} };      // 창을 연 동안의 받은 질문 · 체크한 것

async function practiceCountNewOffers() {
  const { data, error } = await sb.from('practice_offers').select('id').eq('status', '새로');
  if (error) return;     // 표가 없거나 막혀도 연습장은 그대로 씁니다
  practiceNewOfferCount = (data || []).length;
}

async function practiceOpenOffers() {
  var overlay = document.getElementById('prac-offer-overlay');
  var box = document.getElementById('prac-offer-list');
  if (!overlay || !box) return;
  PO = { list: [], picked: {} };
  box.innerHTML = '<p class="prac-empty">불러오는 중...</p>';
  overlay.style.display = 'flex';
  const { data, error } = await sb.from('practice_offers')
    .select('id, grade, area, subject, question, status, teacher_name, created_at')
    .order('created_at', { ascending: false });
  if (error) { box.innerHTML = '<p class="prac-empty">받은 질문을 불러오지 못했습니다.</p>'; return; }
  PO.list = data || [];
  practiceNewOfferCount = PO.list.filter(function (o) { return o.status === '새로'; }).length;
  practicePaintBadge();
  practicePaintOffers();
}
function practiceCloseOffers() {
  document.getElementById('prac-offer-overlay').style.display = 'none';
}

function practiceOfferGradeText(g) { return (g && g !== '공통') ? g + '학년' : '공통'; }

// ── 학년·영역으로 나눠 보기 (2026-10-07 선생님 말씀) ──
// 선생님은 생기부를 묶음(학년 × 자율·동아리·진로·과목·행특)별로 보며 보냅니다. 받는 쪽도 그렇게 나뉘어 보이고,
// 그것만 골라 볼 수 있게 합니다. 칩은 연습장 필터와 같은 방식 — 여러 개 고를 수 있고, 안 고르면 전부.
// 영역 칩·학년 칩은 «받은 것에 실제로 있는 것» 만 보입니다.
// 영역은 자율 · 동아리 · 봉사 · 진로 · 과세특 · 개세특 · 행발. 세특 과목은 묶지 않고 카드 안에만 적습니다
// (과목마다 묶었더니 묶음이 과목 수만큼 생겼습니다 — 2026-10-07 선생님 말씀).
var PO_GRADE_ORDER = ['1', '2', '3', '공통'];
var PO_AREA_ORDER = ['자율', '동아리', '봉사', '진로', '과세특', '개세특', '행발', '창체', ''];
// 잠깐 썼던 옛 이름도 새 이름으로 읽습니다(서버 자료는 2026-10-07 에 옮겼습니다)
var PO_AREA_OLD = { '자율활동': '자율', '동아리활동': '동아리', '봉사활동': '봉사', '진로활동': '진로', '행특': '행발' };
var POF = { grades: [], areas: [] };   // 받은 질문 창의 칩 — 창을 닫았다 열어도 그대로

function practiceOfferArea(o) {
  var a = o.area || '';
  if (PO_AREA_OLD[a]) return PO_AREA_OLD[a];
  if (a === '세특') return /^개인별/.test(o.subject || '') ? '개세특' : '과세특';
  return a;
}
function practiceOfferAreaText(a) { return a || '영역 모름'; }
function practiceOfferGroupKey(o) { return (o.grade || '공통') + '|' + practiceOfferArea(o); }
function practiceOfferGroupText(o) {
  return practiceOfferGradeText(o.grade) + ' · ' + practiceOfferAreaText(practiceOfferArea(o));
}
function practiceOfferSort(list) {
  return list.slice().sort(function (x, y) {
    return (PO_GRADE_ORDER.indexOf(x.grade) - PO_GRADE_ORDER.indexOf(y.grade)) ||
           (PO_AREA_ORDER.indexOf(practiceOfferArea(x)) - PO_AREA_ORDER.indexOf(practiceOfferArea(y))) ||
           String(x.subject || '').localeCompare(String(y.subject || '')) ||   // 과세특 안에서는 과목끼리 붙여 둡니다
           String(x.created_at).localeCompare(String(y.created_at)) ||
           String(x.question).localeCompare(String(y.question));
  });
}
function practiceOfferFresh() { return PO.list.filter(function (o) { return o.status === '새로'; }); }
// 칩에 걸리는(지금 보이는) 새 질문
function practiceOfferVisible() {
  return practiceOfferFresh().filter(function (o) {
    return practiceMatchFilter(o.grade, POF.grades) &&
           (!POF.areas.length || POF.areas.indexOf(practiceOfferAreaText(practiceOfferArea(o))) > -1);
  });
}
function practiceOfferToggleGrade(g) { practiceToggleIn(POF.grades, g); practicePaintOffers(); }
function practiceOfferToggleArea(a) { practiceToggleIn(POF.areas, a); practicePaintOffers(); }

function practicePaintOffers() {
  var box = document.getElementById('prac-offer-list');
  var fresh = practiceOfferFresh();
  var done = PO.list.filter(function (o) { return o.status === '넣음'; });
  var off = PO.list.filter(function (o) { return o.status === '안씀'; });
  // 받은 것에 없는 학년·영역을 골라 둔 채면 칩을 풉니다(다 넣어서 사라졌을 때 등)
  var gradesHere = PO_GRADE_ORDER.filter(function (g) { return fresh.some(function (o) { return (o.grade || '공통') === g; }); });
  var areasHere = PO_AREA_ORDER.filter(function (a) { return fresh.some(function (o) { return practiceOfferArea(o) === a; }); })
                               .map(practiceOfferAreaText);
  POF.grades = POF.grades.filter(function (g) { return gradesHere.indexOf(g) > -1; });
  POF.areas = POF.areas.filter(function (a) { return areasHere.indexOf(a) > -1; });

  var html = '';
  if (!PO.list.length) {
    html = '<p class="prac-empty">아직 선생님이 보낸 질문이 없습니다.</p>';
  } else if (!fresh.length) {
    html = '<p class="prac-empty">새로 받은 질문은 다 골랐습니다.</p>';
  } else {
    var visible = practiceOfferSort(practiceOfferVisible());
    html = '<p class="prac-hint">쓰고 싶은 질문을 골라 「넣기」를 누르면 «쓴 것들» 맨 위에 들어갑니다. ' +
           '질문 글자는 거기서 고쳐 써도 됩니다. 다 쓸 필요는 없습니다.</p>';
    // 학년·영역 칩 — 받은 것에 있는 것만. 하나뿐이어도 보여 줍니다(어느 영역 질문인지 한눈에 보이게)
    if (gradesHere.length || areasHere.length) {
      html += '<div class="prac-offer-filter">' +
        (gradesHere.length ? '<div class="prac-offer-frow"><span class="prac-offer-flabel">학년</span><div class="prac-chips">' +
          gradesHere.map(function (g) {
            var on = POF.grades.indexOf(g) > -1;
            return '<button class="prac-chip" aria-pressed="' + on + '" onclick="practiceOfferToggleGrade(\'' + g + '\')">' +
                   esc(practiceOfferGradeText(g)) + '</button>';
          }).join('') + '</div></div>' : '') +
        (areasHere.length ? '<div class="prac-offer-frow"><span class="prac-offer-flabel">영역</span><div class="prac-chips">' +
            practiceFilterChipsHTML(areasHere, POF.areas, 'practiceOfferToggleArea') + '</div></div>' : '') +
        '</div>';
    }
    // 전체 선택 — 지금 보이는 것만 고릅니다
    var narrowed = POF.grades.length || POF.areas.length;
    // ⚠️ 처음엔 오른쪽 끝의 작은 단추였는데 «별로» 라는 말씀(2026-10-07). 질문 체크칸과 같은 줄에 맞춘
    //    체크칸으로 바꿨습니다 — 몇 개만 고르면 «−» (일부) 표시가 됩니다.
    html += '<label class="prac-offer-bar"><input type="checkbox" id="prac-offer-all" onchange="practiceToggleAllOffers()">' +
              '<b>전체 선택</b><span>' + (narrowed ? '골라 본 질문 ' : '새로 받은 질문 ') + visible.length + '개' +
              (narrowed ? ' / 전체 ' + fresh.length + '개' : '') + '</span></label>';
    // 학년 · 영역 · 과목 묶음마다 머리줄
    var lastKey = null;
    visible.forEach(function (o) {
      var key = practiceOfferGroupKey(o);
      if (key !== lastKey) {
        var n = visible.filter(function (x) { return practiceOfferGroupKey(x) === key; }).length;
        html += '<p class="prac-offer-group">' + esc(practiceOfferGroupText(o)) + ' <span>' + n + '개</span></p>';
        lastKey = key;
      }
      var on = !!PO.picked[o.id];
      html += '<div class="prac-offer' + (on ? ' on' : '') + '" data-id="' + o.id + '">' +
        '<label class="prac-offer-pick"><input type="checkbox"' + (on ? ' checked' : '') +
          ' onchange="practiceToggleOffer(\'' + o.id + '\')">' +
          '<span class="prac-offer-q">' + esc(o.question) + '</span></label>' +
        '<div class="prac-offer-foot"><span>' + esc([o.subject, o.teacher_name ? o.teacher_name + ' 선생님' : ''].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="prac-offer-acts">' +
            '<button class="prac-offer-skip" onclick="practiceSkipOffer(\'' + o.id + '\')">안 쓸래요</button>' +
            '<button class="prac-offer-skip del" onclick="practiceDeleteOffers([\'' + o.id + '\'])">삭제</button>' +
          '</span></div>' +
        '</div>';
    });
  }
  if (done.length || off.length) {
    // ⚠️ 목록을 다시 그릴 때마다 이 접이식 칸이 닫혀서, 안 쓰기로 한 것을 하나씩 지울 때마다 다시 열어야 했습니다
    //    (2026-10-07 선생님 말씀). 열림 상태를 PO.oldOpen 에 기억해 두고 그대로 그립니다.
    html += '<details class="prac-offer-old" ontoggle="PO.oldOpen = this.open"' + (PO.oldOpen ? ' open' : '') + '>' +
      '<summary>넣은 것 ' + done.length + '개 · 안 쓰기로 한 것 ' + off.length + '개</summary>' +
      practiceOfferSort(done.concat(off)).map(function (o) {
        return '<div class="prac-offer gone">' +
          '<span class="prac-offer-q">' + esc(o.question) + '</span>' +
          '<div class="prac-offer-foot"><span>' + esc(practiceOfferGroupText(o)) + ' · ' + (o.status === '넣음' ? '넣음 ✓' : '안 쓰기로 함') + '</span>' +
          '<span class="prac-offer-acts">' +
            (o.status === '안씀' ? '<button class="prac-offer-skip" onclick="practiceRestoreOffer(\'' + o.id + '\')">다시 보기</button>' : '') +
            '<button class="prac-offer-skip del" onclick="practiceDeleteOffers([\'' + o.id + '\'])">삭제</button>' +
          '</span></div></div>';
      }).join('') + '</details>';
  }
  // 다시 그려도 읽던 자리가 맨 위로 튀지 않게 창 안의 스크롤을 지킵니다
  var keepTop = box.scrollTop;
  box.innerHTML = html;
  box.scrollTop = keepTop;
  practicePaintOfferBtn();
}

// 체크할 때마다 목록을 다시 그리면 창 안의 스크롤이 맨 위로 튑니다. 그 줄과 단추만 고칩니다.
function practiceToggleOffer(id) {
  if (PO.picked[id]) delete PO.picked[id]; else PO.picked[id] = true;
  var row = document.querySelector('.prac-offer[data-id="' + id + '"]');
  if (row) row.classList.toggle('on', !!PO.picked[id]);
  practicePaintOfferBtn();
}
// 전체 선택 ↔ 전체 해제. 새로 받은 것만 고릅니다(넣은 것·안 쓰기로 한 것은 빼고).
// 지금 보이는(칩에 걸린) 새 질문만 고르고 풉니다.
function practiceToggleAllOffers() {
  var fresh = practiceOfferVisible();
  var all = fresh.length && fresh.every(function (o) { return PO.picked[o.id]; });
  fresh.forEach(function (o) {
    if (all) delete PO.picked[o.id]; else PO.picked[o.id] = true;
    var row = document.querySelector('.prac-offer[data-id="' + o.id + '"]');
    if (row) {
      row.classList.toggle('on', !all);
      var box = row.querySelector('input[type="checkbox"]');
      if (box) box.checked = !all;
    }
  });
  practicePaintOfferBtn();
}

function practicePaintOfferBtn() {
  var allBtn = document.getElementById('prac-offer-all');
  if (allBtn) {
    var fresh = practiceOfferVisible();
    var some = fresh.filter(function (o) { return PO.picked[o.id]; }).length;
    allBtn.checked = fresh.length > 0 && some === fresh.length;
    allBtn.indeterminate = some > 0 && some < fresh.length;
  }
  var btn = document.getElementById('prac-offer-add');
  if (!btn) return;
  var n = Object.keys(PO.picked).length;
  btn.disabled = n === 0;
  btn.textContent = n ? '고른 ' + n + '개 넣기' : '넣을 질문을 고르세요';
  btn.hidden = !PO.list.some(function (o) { return o.status === '새로'; });
  // 체크한 것을 한꺼번에 지우는 단추 — 고른 게 있을 때만
  var del = document.getElementById('prac-offer-del');
  if (del) { del.hidden = n === 0 || btn.hidden; del.textContent = n + '개 삭제'; }
}

// ── 삭제 (2026-10-07 선생님 말씀: «안 쓸래요» 말고 지우는 것도) ──
// «안 쓸래요» 는 창 아래로 치워 두고 «다시 보기» 로 되살릴 수 있고, «삭제» 는 받은 질문에서 아주 지웁니다.
// 이미 «쓴 것들» 에 넣은 연습장 카드는 따로라 지워지지 않습니다. 한 번 묻습니다. 서버 요청 1번.
async function practiceDeleteOffers(ids) {
  ids = (ids || []).filter(function (id) { return PO.list.some(function (o) { return o.id === id; }); });
  if (!ids.length) return;
  var putIn = PO.list.filter(function (o) { return ids.indexOf(o.id) > -1 && o.status === '넣음'; }).length;
  if (!confirm((ids.length === 1 ? '이 질문을' : ids.length + '개를') + ' 받은 질문에서 지울까요?\n지우면 되살릴 수 없습니다.' +
               (putIn ? '\n\n(«쓴 것들» 에 이미 넣은 카드는 그대로 남습니다)' : ''))) return;
  const { error } = await sb.from('practice_offers').delete().in('id', ids);
  if (error) { toast_or_alert('지우지 못했습니다: ' + error.message); return; }
  PO.list = PO.list.filter(function (o) { return ids.indexOf(o.id) === -1; });
  ids.forEach(function (id) { delete PO.picked[id]; });
  practiceNewOfferCount = PO.list.filter(function (o) { return o.status === '새로'; }).length;
  practicePaintBadge();
  practicePaintOffers();
}
function practiceDeletePickedOffers() { practiceDeleteOffers(Object.keys(PO.picked)); }

async function practiceSetOfferStatus(ids, status) {
  const { error } = await sb.from('practice_offers').update({ status: status }).in('id', ids);
  if (error) { toast_or_alert('바꾸지 못했습니다: ' + error.message); return false; }
  PO.list.forEach(function (o) { if (ids.indexOf(o.id) > -1) o.status = status; });
  ids.forEach(function (id) { delete PO.picked[id]; });
  practiceNewOfferCount = PO.list.filter(function (o) { return o.status === '새로'; }).length;
  practicePaintBadge();
  return true;
}
async function practiceSkipOffer(id) { if (await practiceSetOfferStatus([id], '안씀')) practicePaintOffers(); }
async function practiceRestoreOffer(id) { if (await practiceSetOfferStatus([id], '새로')) practicePaintOffers(); }

// 고른 질문을 «선생님 질문» 카드로 한꺼번에 넣고(요청 1번), 받은 질문에 «넣음» 표시(요청 1번).
async function practiceAddOffers() {
  var ids = Object.keys(PO.picked);
  var picks = PO.list.filter(function (o) { return ids.indexOf(o.id) > -1 && o.status === '새로'; });
  if (!picks.length || !PW) return;
  var btn = document.getElementById('prac-offer-add');
  if (btn) btn.disabled = true;

  const { data, error } = await sb.from('practice_answers').insert(picks.map(function (o) {
    return { school_id: SCHOOL_ID, student_id: PW.studentId,
             grade: PRACTICE_GRADES.indexOf(o.grade) > -1 ? o.grade : '공통',
             category: PRACTICE_OFFER_CAT, question: o.question, answer: '' };
  })).select('id, grade, category, question, answer, created_at, updated_at');
  if (error) { toast_or_alert('넣지 못했습니다: ' + error.message); practicePaintOfferBtn(); return; }
  await practiceSetOfferStatus(picks.map(function (o) { return o.id; }), '넣음');

  practiceCloseOffers();
  if (practiceActiveTab !== 'write') { practiceGoTab('write'); return; }   // 작성 탭이 새로 불러옵니다
  // 지금 필터에 «선생님 질문» 이 안 걸리면 새 카드가 안 보이므로 필터를 풉니다
  if (PW.cats.length && PW.cats.indexOf(PRACTICE_OFFER_CAT) === -1) PW.cats = [];
  if (PW.grades.length && (data || []).some(function (a) { return PW.grades.indexOf(a.grade) === -1; })) PW.grades = [];
  PW.all = PW.all.concat(data || []);
  practiceWriteRenderChips();
  practiceWriteRenderCards();
  toast_or_alert(picks.length + '개를 «쓴 것들» 에 넣었습니다. 질문 글자도 고쳐 쓸 수 있습니다.');
  if (data && data[0]) practiceScrollToCard(data[0].id);
}

// ══════════════ 작성 — 학생만 씁니다 ══════════════
//
// 카드 하나 = practice_answers 한 줄. 빈 채로 만들어 두지 않고, 첫 글자를 쳐야
// 서버에 줄이 생깁니다(칸을 벗어날 때 · 앱을 떠날 때 · 계속 쓰면 2분마다 — 아래 «저장» 참고). 다 지워서 다시 비면
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
  await practiceRestoreDrafts();

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
  practicePaintSort('write');
  practicePaintFbox('write', PW.grades, PW.cats);
}

function practiceWriteFiltered() {
  var nums = practiceNumbers(PW.all);
  return practiceSortList((PW.all || []).filter(function (a) {
    return practiceMatchFilter(a.grade, PW.grades) && practiceMatchFilter(a.category, PW.cats);
  }), nums);
}

function practiceWriteRenderCards() {
  practiceFlushAll();   // 카드를 다시 그리기 전에, 쓰던 글을 PW.all 에 먼저 옮기고 서버로 보냅니다
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
          '<span class="prac-num" id="' + c.key + '-num"></span>' +
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
  // 번호는 서버에 처음 저장되면 붙습니다(저장 전 카드는 번호가 아직 없습니다)
  var numEl = document.getElementById(c.key + '-num');
  if (numEl) {
    var n = c.id ? practiceNumbers(PW.all)[c.id] : 0;
    numEl.textContent = n ? n + '번' : '';
    numEl.hidden = !n;
  }
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
                      question: '', answer: '', timer: null,
                      tmp: 'new-' + Date.now() + '-' + PW_KEY });   // 서버 id 가 생기기 전 임시본 이름
  practiceWriteDrawCards();
  var kv = practiceCardKV(PW.cards[0].key);
  if (kv) { kv.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); kv.q.focus(); }
}

// ══════════════ 저장 — 입력 중에는 이 기기에만, 서버에는 필요할 때만 ══════════════
//
// 서버 요청 1건 = Supabase 로그 1줄입니다. 예전에는 1.5초만 멈춰도 서버에 저장해서,
// 한 학생이 한 시간 쓰는 동안 136번 저장된 적이 있습니다(2026-09-30 로그).
// 그래서 이렇게 나눕니다.
//   · 글자를 칠 때마다 → 이 기기의 브라우저(localStorage)에 임시본만 (서버 요청 없음)
//   · 서버에는 → 칸을 벗어날 때 · 앱/탭을 떠날 때 · 계속 쓰는 중이면 2분에 한 번
//   · 바뀐 게 없으면 보내지 않습니다
//   · 서버에 못 보낸 임시본은 다음에 답안 연습장을 열 때 올립니다(practiceRestoreDrafts)
// 휴대폰이든 컴퓨터든 «지금 쓰는 그 기기의 브라우저» 에 임시본이 남습니다.
// 서버에 올라가면 임시본은 바로 지웁니다 — 학교 공용 컴퓨터에 글이 남지 않게.
var PRACTICE_SAVE_EVERY_MS = 2 * 60 * 1000;   // 계속 쓰는 중일 때 서버에 보내는 간격

function practiceDraftStoreKey() { return 'pracDraft:' + PW.studentId; }
function practiceDraftsRead() {
  try { return JSON.parse(localStorage.getItem(practiceDraftStoreKey()) || '{}') || {}; } catch (e) { return {}; }
}
function practiceDraftsWrite(all) {
  try {
    if (Object.keys(all).length) localStorage.setItem(practiceDraftStoreKey(), JSON.stringify(all));
    else localStorage.removeItem(practiceDraftStoreKey());
  } catch (e) { /* 사생활 보호 모드면 막힐 수 있습니다 — 그래도 서버 저장은 됩니다 */ }
}
function practiceDraftKey(c) { return c.id || c.tmp; }
function practiceDraftPut(c) {
  var all = practiceDraftsRead();
  all[practiceDraftKey(c)] = { id: c.id || null, grade: c.grade, category: c.category,
                               question: c.question, answer: c.answer, t: Date.now() };
  practiceDraftsWrite(all);
}
function practiceDraftDrop(k) {
  if (!k) return;
  var all = practiceDraftsRead();
  if (all[k]) { delete all[k]; practiceDraftsWrite(all); }
}

// 서버에 한 줄 저장(있으면 고치고, 없으면 새로). 성공하면 id 를 돌려줍니다.
async function practiceSaveRow(r) {
  if (r.id) {
    const { error } = await sb.from('practice_answers')
      .update({ question: r.question, answer: r.answer }).eq('id', r.id);
    if (error) throw error;
    return { id: r.id };
  }
  const { data, error } = await sb.from('practice_answers').insert({
    school_id: SCHOOL_ID, student_id: PW.studentId, grade: r.grade, category: r.category,
    question: r.question, answer: r.answer
  }).select('id, created_at, updated_at').single();
  if (error) throw error;
  return data;
}

// 서버에 못 보내고 남은 임시본을 올립니다. 다른 기기에서 그 뒤에 고친 게 있으면 그쪽이 이깁니다.
async function practiceRestoreDrafts() {
  var all = practiceDraftsRead();
  var keys = Object.keys(all);
  for (var i = 0; i < keys.length; i++) {
    var d = all[keys[i]];
    var row = d.id ? PW.all.filter(function (x) { return x.id === d.id; })[0] : null;
    if (d.id && !row) { practiceDraftDrop(keys[i]); continue; }                  // 그새 지워진 답안
    if (row && new Date(row.updated_at) >= new Date(d.t)) { practiceDraftDrop(keys[i]); continue; }
    if (row && row.question === d.question && row.answer === d.answer) { practiceDraftDrop(keys[i]); continue; }
    if (!(d.question || '').trim() && !(d.answer || '').trim()) { practiceDraftDrop(keys[i]); continue; }
    try {
      var saved = await practiceSaveRow(d);
      if (row) { row.question = d.question; row.answer = d.answer; row.updated_at = new Date().toISOString(); }
      else PW.all.push({ id: saved.id, grade: d.grade, category: d.category, question: d.question,
                         answer: d.answer, created_at: saved.created_at, updated_at: saved.updated_at });
      practiceDraftDrop(keys[i]);
    } catch (e) { /* 인터넷이 없으면 다음에 또 해 봅니다 — 임시본은 그대로 둡니다 */ }
  }
}

function practiceQueueSave(key) {
  var c = practiceCard(key);
  if (!c) return;
  var kv = practiceCardKV(key);
  if (!kv) return;
  c.question = kv.q.value; c.answer = kv.a.value;
  c.dirty = true;
  practiceDraftPut(c);
  if (kv.hint) { kv.hint.textContent = '쓰는 중 · 칸을 벗어나면 저장됩니다'; kv.hint.className = 'prac-savehint'; }
  // 계속 쓰기만 하고 칸을 안 벗어나도 2분에 한 번은 서버로 보냅니다(선생님 화면에도 보이도록)
  if (!c.timer) c.timer = setTimeout(function () { practiceFlush(key); }, PRACTICE_SAVE_EVERY_MS);
}

async function practiceFlush(key) {
  var c = practiceCard(key);
  if (!c) return;
  if (c.timer) { clearTimeout(c.timer); c.timer = null; }
  if (!c.dirty) return;                                   // 바뀐 게 없으면 보내지 않습니다
  if (c.saving) { c.again = true; return; }               // 보내는 중이면 끝난 뒤 한 번 더
  var kv = practiceCardKV(key);
  var q = kv ? kv.q.value : c.question, a = kv ? kv.a.value : c.answer;
  c.question = q; c.answer = a;
  c.dirty = false;
  var draftKey = practiceDraftKey(c);

  // 화면을 다시 그려도 쓴 글이 보이도록 PW.all 부터 먼저 고칩니다(서버 답을 기다리지 않고)
  var row = c.id ? PW.all.filter(function (x) { return x.id === c.id; })[0] : null;
  if (row) { row.question = q; row.answer = a; row.updated_at = new Date().toISOString(); }

  // 둘 다 비면 저장할 것이 없습니다. 서버에 줄이 있었다면 지웁니다(빈 줄을 남겨 두지 않습니다).
  if (!q.trim() && !a.trim()) {
    if (c.id) {
      await sb.from('practice_answers').delete().eq('id', c.id);
      PW.all = PW.all.filter(function (x) { return x.id !== c.id; });
      c.id = null;
    }
    practiceDraftDrop(draftKey);
    if (kv) { kv.hint.textContent = ''; kv.hint.className = 'prac-savehint'; }
    practiceCardPaintWhen(c);
    return;
  }

  if (kv) { kv.hint.textContent = '저장하는 중...'; kv.hint.className = 'prac-savehint saving'; }
  c.saving = true;
  try {
    var saved = await practiceSaveRow({ id: c.id, grade: c.grade, category: c.category, question: q, answer: a });
    if (!c.id) {
      c.id = saved.id;
      if (kv) kv.el.setAttribute('data-id', saved.id);
      PW.all.push({ id: c.id, grade: c.grade, category: c.category, question: q, answer: a,
                    created_at: saved.created_at, updated_at: saved.updated_at });
      // 저장되는 사이에 필터를 눌러 카드들을 다시 그렸다면, 이 새 카드는 그 목록에 없었습니다
      if (!practiceCard(key)) { practiceDraftDrop(draftKey); practiceWriteRenderCards(); return; }
    }
    practiceDraftDrop(draftKey);
    if (c.dirty) practiceDraftPut(c);   // 보내는 사이에 또 쓴 게 있으면 새 이름(id)으로 임시본을 다시 둡니다
    kv = practiceCardKV(key);
    if (kv) { kv.hint.textContent = '저장됨'; kv.hint.className = 'prac-savehint saved'; }
    practiceCardPaintWhen(c);
  } catch (error) {
    c.dirty = true;                     // 못 보냈으니 임시본은 그대로 두고 다음에 또 보냅니다
    kv = practiceCardKV(key);
    if (kv) { kv.hint.textContent = '저장하지 못했습니다(이 기기에 보관 중): ' + (error.message || ''); kv.hint.className = 'prac-savehint'; }
  } finally {
    c.saving = false;
    if (c.again) { c.again = false; c.dirty = true; practiceFlush(key); }
  }
}

// 저장 안 된 카드를 모두 서버로. 앱/탭을 떠날 때 · 카드를 다시 그리기 전에 부릅니다.
function practiceFlushAll() {
  if (!PW || !PW.cards) return;
  PW.cards.forEach(function (c) {
    var kv = practiceCardKV(c.key);
    if (kv && (kv.q.value !== c.question || kv.a.value !== c.answer)) { c.question = kv.q.value; c.answer = kv.a.value; c.dirty = true; }
    if (c.dirty) practiceFlush(c.key);
  });
}
document.addEventListener('visibilitychange', function () { if (document.hidden) practiceFlushAll(); });
window.addEventListener('pagehide', practiceFlushAll);

async function practiceDeleteCard(key) {
  var c = practiceCard(key);
  if (!c) return;
  if ((c.question || c.answer) && !confirm('이 질문·답변을 지울까요?')) return;
  if (c.timer) { clearTimeout(c.timer); c.timer = null; }
  c.dirty = false;
  practiceDraftDrop(practiceDraftKey(c));
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

// 엑셀 꾸미기(줄바꿈·테두리·머리글 색·틀 고정·필터)는 SheetJS 무료판이 파일에 못 씁니다.
// 그래서 내려받기만 ExcelJS 로 만듭니다. 크기가 1MB 가까이 되어서, 페이지를 열 때가 아니라
// «엑셀로 저장» 을 처음 누를 때 불러옵니다. (학생 명단 엑셀 읽기는 그대로 SheetJS)
var PRACTICE_EXCELJS_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'   // 위가 막혔을 때
];
var practiceExcelReady = null;
function practiceLoadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (practiceExcelReady) return practiceExcelReady;
  practiceExcelReady = new Promise(function (ok, fail) {
    var i = 0;
    (function next() {
      if (i >= PRACTICE_EXCELJS_URLS.length) { practiceExcelReady = null; fail(new Error('load')); return; }
      var s = document.createElement('script');
      s.src = PRACTICE_EXCELJS_URLS[i++];
      s.onload = function () { window.ExcelJS ? ok(window.ExcelJS) : next(); };
      s.onerror = next;
      document.head.appendChild(s);
    })();
  });
  return practiceExcelReady;
}

// 칸:            A(여백)  B 연번  C 학년  D 종류  E 질문  F 답변
var PRACTICE_XLSX_WIDTHS = [2, 6, 7, 10, 42, 90];
var PRACTICE_XLSX_FONT = '맑은 고딕';
var PRACTICE_XLSX_LINE_PT = 15;   // 10pt 글씨 한 줄 높이(대략)

// 엑셀은 파일을 열 때 줄바꿈된 행의 높이를 스스로 맞춰 주지 않습니다.
// 그래서 글자 수로 몇 줄이 될지 어림해서 높이를 직접 정합니다.
// 한글·한자 같은 넓은 글자는 숫자·영문 한 글자의 약 1.9배 폭입니다.
function practiceXlsxLines(text, colWidth) {
  var usable = colWidth - 1.5;
  return String(text || '').split(/\r?\n/).reduce(function (n, para) {
    var w = 0;
    for (var i = 0; i < para.length; i++) w += /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿︰-﹏＀-￯]/.test(para[i]) ? 1.9 : 1;
    return n + Math.max(1, Math.ceil(w / usable));
  }, 0);
}

async function practiceDownloadExcel(studentId, label) {
  var all = await fetchPracticeAnswers(studentId);
  var nums = practiceNumbers(all);
  var list = practiceExportSort(all);
  if (!list.length) { toast_or_alert('내려받을 답안이 없습니다.'); return; }

  var ExcelJS;
  try { ExcelJS = await practiceLoadExcelJS(); }
  catch (e) { toast_or_alert('엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); return; }

  var wb = new ExcelJS.Workbook();
  var ws = wb.addWorksheet('면접 질문지', {
    // 머리글(3행)까지 고정 — 아래로 내려도 연번·학년·종류·질문·답변 줄이 보입니다
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'B4', showGridLines: false }],
    pageSetup: {
      paperSize: 9, orientation: 'landscape',            // A4 가로
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,    // 가로는 한 장 폭에 맞추고, 세로는 필요한 만큼
      printTitlesRow: '3:3', horizontalCentered: true,   // 쪽마다 머리글 반복
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    }
  });
  ws.columns = PRACTICE_XLSX_WIDTHS.map(function (w) { return { width: w }; });

  var thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  var box = { top: thin, left: thin, bottom: thin, right: thin };

  // 1행 제목, 2행 누구 것·언제
  ws.mergeCells('B1:F1');
  ws.getCell('B1').value = '면접 질문지';
  ws.getCell('B1').font = { name: PRACTICE_XLSX_FONT, size: 16, bold: true };
  ws.getCell('B1').alignment = { vertical: 'middle' };
  ws.getRow(1).height = 30;
  ws.mergeCells('B2:F2');
  var d = new Date();
  ws.getCell('B2').value = (label ? label + ' · ' : '') + '답안 ' + list.length + '개 · ' +
    d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' 내려받음';
  ws.getCell('B2').font = { name: PRACTICE_XLSX_FONT, size: 10, color: { argb: 'FF808080' } };
  ws.getRow(2).height = 20;

  // 3행 머리글
  var head = ws.getRow(3);
  head.values = ['', '연번', '학년', '종류', '질문', '답변'];
  head.height = 24;
  for (var c = 2; c <= 6; c++) {
    var h = head.getCell(c);
    h.font = { name: PRACTICE_XLSX_FONT, size: 10, bold: true, color: { argb: 'FF1F3864' } };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE7F3' } };
    h.alignment = { horizontal: 'center', vertical: 'middle' };
    h.border = box;
  }

  // 4행부터 답안 — 줄바꿈 켜고, 위쪽 정렬, 질문·답변 중 긴 쪽에 맞춘 높이
  list.forEach(function (a, i) {
    var row = ws.getRow(4 + i);
    row.values = ['', nums[a.id], a.grade, a.category, a.question || '', a.answer || ''];
    var lines = Math.max(practiceXlsxLines(a.question, PRACTICE_XLSX_WIDTHS[4]),
                         practiceXlsxLines(a.answer, PRACTICE_XLSX_WIDTHS[5]));
    row.height = Math.min(409, Math.max(22, lines * PRACTICE_XLSX_LINE_PT + 8));   // 409 는 엑셀 최대
    for (var c = 2; c <= 6; c++) {
      var cell = row.getCell(c);
      cell.font = { name: PRACTICE_XLSX_FONT, size: 10 };
      cell.alignment = { vertical: 'top', horizontal: c <= 4 ? 'center' : 'left', wrapText: true };
      cell.border = box;
      if (i % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };   // 한 줄 건너 옅은 색
    }
  });

  // 머리글에 필터 단추
  ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: 3 + list.length, column: 6 } };

  var buf = await wb.xlsx.writeBuffer();
  var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = (label || '면접질문지') + '_면접질문지.xlsx';
  document.body.appendChild(link);
  link.click();
  // 바로 떼어 내거나 주소를 지우면 브라우저가 파일 이름을 잃고 «download» 로 저장하기도 합니다
  setTimeout(function () { link.remove(); URL.revokeObjectURL(url); }, 10000);
}

function practicePrintRowsHTML(list, nums) {
  return list.map(function (a) {
    return '<tr><td>' + nums[a.id] + '</td><td>' + esc(a.grade) + '</td><td>' + esc(a.category) + '</td>' +
      '<td>' + esc(a.question || '').replace(/\n/g, '<br>') + '</td>' +
      '<td>' + esc(a.answer || '').replace(/\n/g, '<br>') + '</td></tr>';
  }).join('');
}

async function practicePrintView(studentId, label) {
  var all = await fetchPracticeAnswers(studentId);
  var nums = practiceNumbers(all);
  var list = practiceExportSort(all);
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
    '<tbody>' + practicePrintRowsHTML(list, nums) + '</tbody></table>' +
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
