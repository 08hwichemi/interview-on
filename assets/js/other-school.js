// 타학교 면접 (2026-10-11)
//
// 다른 학교 학생을 우리 면접 화면 그대로(시계 둘 · 받아 적기 · 영역 평가 · 마무리 · 평가서) 모의면접합니다.
// 선생님 말씀: 아는 것은 이름 · 희망 전공뿐, 질문은 생기부를 따로 보고 직접 넣는다,
// 평가서는 QR 로 PDF 처럼 받게 — 휴대폰 번호를 받거나 따로 전해 줄 길이 없다, 평가서는 하루면 된다.
//
// 어떻게 돌아가나
//   · 타학교 학생은 우리 명단(students)에 없습니다. 계정도 안 만듭니다.
//     interviews 줄에 student_id 를 비우고 other_name(이름) · other_major(희망 전공)만 적습니다.
//     그래서 «타학교 목록» = other_name 이 있는 interviews 줄들입니다(같은 학교 선생님은 모두 봅니다)
//   · 질문지(준비중) → 면접(진행중) → 마무리(작성완료)까지는 우리 학생과 똑같은 코드(teacher-app.js)가 돕니다.
//     target 이 { other: true, ivId, name, major } 일 때만 몇 군데가 갈라집니다(whoLabel · keepSheet · loadSheet …)
//   · «학생에게 전달» 대신 «QR 로 평가서 주기» — 맞히기 어려운 긴 열쇠(share_key, 32자)를 만들고
//     r.html#열쇠 주소를 QR 로 띄웁니다. 학생이 폰으로 찍으면 로그인 없이 평가서가 열리고 PDF 로 저장합니다
//     (r.html · other-report-page.js). 서버 함수 other_report(k) 가 열쇠가 맞고 하루가 안 지났을 때만 내줍니다
//   · **QR 을 보여 준 때부터 하루(share_until)** 가 지나면 서버가 한 시간마다 지웁니다(pg_cron,
//     private.cleanup_other_interviews — 질문·평가·받아 적은 글까지). 만들어 두고 30일 안 쓴 것도 지웁니다
//   · 우리 학생 화면·통계에는 안 섞입니다 — 학생 쪽 권한(RLS)이 students 와 이어진 줄만 내주기 때문입니다

var railOther = false;    // 왼쪽 칸이 «타학교» 목록을 보이는 중인가
var otherRows = [];       // 타학교 목록 (interviews 줄)
var OTHER_HOURS = 24;     // QR 로 평가서가 열리는 시간 — 선생님 말씀 «하루면 돼»

// 서버 줄 → 화면의 target
function otherTarget(iv) {
  return { id: null, other: true, ivId: iv.id, name: iv.other_name || '', major: iv.other_major || '',
           school: iv.other_school || '', student_no: '' };
}

// ── 왼쪽 칸: 우리 학교 / 타학교 ──
function railShowOther(on) {
  if (editingMid) return;
  railOther = !!on;
  if (!target) show('empty'); else otherPaint();
  if (railOther) otherLoad();
}

// 화면을 바꿀 때마다(show) 부릅니다.
//   #page-interview.is-other — 타학교 학생을 보고 있음(아무도 안 골랐으면 타학교 목록을 보는 중)
//   #rail-students.other-mode — 왼쪽 칸이 타학교 목록
// 가리고 보이는 것은 CSS 의 .ours-only · .other-only 가 합니다.
function otherPaint() {
  var page = document.getElementById('page-interview');
  var rail = document.getElementById('rail-students');
  if (!page || !rail) return;
  page.classList.toggle('is-other', target ? !!target.other : railOther);
  rail.classList.toggle('other-mode', railOther);
  var a = document.getElementById('rail-tab-ours'), b = document.getElementById('rail-tab-other');
  if (a) a.setAttribute('aria-current', !railOther);
  if (b) b.setAttribute('aria-current', railOther);
  if (target && target.other) {
    var n = document.getElementById('other-name'), m = document.getElementById('other-major'), s = document.getElementById('other-school');
    // 치는 중인 칸은 건드리지 않습니다(커서가 튑니다)
    if (n && document.activeElement !== n) n.value = target.name || '';
    if (m && document.activeElement !== m) m.value = target.major || '';
    if (s && document.activeElement !== s) s.value = target.school || '';
  }
}

function otherAfterBack() {
  if (railOther) otherLoad();
}

async function otherLoad() {
  var box = document.getElementById('other-list');
  if (!box) return;
  if (!otherRows.length) box.innerHTML = '<p class="empty">불러오는 중...</p>';
  const { data, error } = await sb.from('interviews')
    .select('id, other_name, other_major, other_school, status, teacher_name, started_at, share_until')
    .not('other_name', 'is', null);
  if (error) { box.innerHTML = '<p class="empty">타학교 목록을 못 읽었습니다: ' + esc(error.message) + '</p>'; return; }
  // 학교 가나다 → 이름 가나다 (학교를 안 적은 학생은 맨 아래 묶음)
  otherRows = (data || []).sort(function (a, z) {
    var sa = a.other_school || '\uffff', sz = z.other_school || '\uffff';
    return sa.localeCompare(sz, 'ko') || String(a.other_name).localeCompare(String(z.other_name), 'ko');
  });
  otherRenderList();
}

// 「오후 3:20」 · 날이 다르면 「10월 16일 오후 3:20」
function otherWhen(iso) {
  if (!iso) return '';
  var d = new Date(iso), now = new Date();
  var h = d.getHours(), m = d.getMinutes();
  var t = (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m);
  if (d.toDateString() === now.toDateString()) return '오늘 ' + t;
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + t;
}

function otherOpenNow(iv) {
  return iv && iv.status === '전달됨' && iv.share_until && new Date(iv.share_until) > new Date();
}

function otherState(iv) {
  if (iv.status === '준비중') return '<span class="ost">질문 준비</span>';
  if (iv.status === '진행중') return '<span class="ost warn">면접 중</span>';
  if (iv.status === '작성완료') return '<span class="ost warn">QR 아직</span>';
  if (otherOpenNow(iv)) return '<span class="ost ok">QR 줌</span>';
  return '<span class="ost">QR 끝남</span>';
}

// ── 학교별로 묶어 접고 펴기 (2026-10-11 선생님 말씀: 학교명으로 정리, 아코디언처럼) ──
// 접힌 학교는 이 브라우저에 기억합니다(localStorage otherFold). 처음엔 모두 펴져 있습니다.
function otherFoldMap() {
  try { return JSON.parse(localStorage.getItem('otherFold') || '{}') || {}; } catch (e) { return {}; }
}
function otherToggleGroup(i) {
  var school = otherGroups()[i].school;
  var m = otherFoldMap();
  if (m[school]) delete m[school]; else m[school] = true;
  try { localStorage.setItem('otherFold', JSON.stringify(m)); } catch (e) { /* 막혀도 이번 화면에선 접힘 */ }
  otherFoldNow = m;
  otherRenderList();
}
var otherFoldNow = null;

function otherGroups() {
  var out = [], at = {};
  otherRows.forEach(function (iv) {
    var s = iv.other_school || '';
    if (!(s in at)) { at[s] = out.length; out.push({ school: s, rows: [] }); }
    out[at[s]].rows.push(iv);
  });
  return out;
}

function otherRenderList() {
  var box = document.getElementById('other-list');
  var cnt = document.getElementById('other-count');
  if (cnt) cnt.textContent = otherRows.length;
  if (!box) return;
  if (!otherRows.length) {
    box.innerHTML = '<p class="empty">아직 없습니다.<br>위 «＋ 타학교 학생 더하기» 로 학교 · 이름 · 희망 전공 · 질문을 넣어 두세요.</p>';
    return;
  }
  var fold = otherFoldNow || (otherFoldNow = otherFoldMap());
  box.innerHTML = otherGroups().map(function (g, gi) {
    var hasOpen = target && target.other && g.rows.some(function (iv) { return iv.id === target.ivId; });
    var shut = !!fold[g.school] && !hasOpen;      // 지금 보고 있는 학생의 학교는 접어도 펴 둡니다
    return '<div class="ogroup">' +
      '<button class="ohead" aria-expanded="' + !shut + '" onclick="otherToggleGroup(' + gi + ')">' +
        '<span class="chev" aria-hidden="true">▾</span>' +
        '<span class="sch">' + esc(g.school || '학교 안 적음') + '</span>' +
        '<span class="n">' + g.rows.length + '명</span>' +
      '</button>' +
      (shut ? '' :
        '<div class="obody">' + g.rows.map(function (iv) {
          var on = target && target.other && target.ivId === iv.id;
          return '<div class="srow">' +
            '<button class="railrow orow" aria-current="' + !!on + '" onclick="otherOpen(\'' + iv.id + '\')">' +
              '<span class="who"><span class="nm">' + esc(iv.other_name) + '</span>' +
                (iv.other_major ? '<span class="sub">' + esc(iv.other_major) + '</span>' : '') + '</span>' +
              otherState(iv) +
            '</button>' +
            '<button class="odel" title="이 학생 지우기" aria-label="' + esc(iv.other_name) + ' 지우기"' +
              ' onclick="otherDelete([\'' + iv.id + '\'])">🗑</button>' +
          '</div>';
        }).join('') +
        '<button class="linkbtn danger odelall" onclick="otherDeleteGroup(' + gi + ')">' +
          esc(g.school || '학교 안 적은 학생') + ' ' + g.rows.length + '명 모두 지우기</button>' +
        '</div>') +
    '</div>';
  }).join('');
}

// ── 지우기 — 한 명(🗑) 또는 한 학교 모두 ──
// 면접이 끝나면 QR 을 보여 준 때부터 하루 뒤 서버가 알아서 지웁니다. 그 전에 지우고 싶을 때, 또는 QR 을
// 안 보여 준 학생(질문지만 만든 학생 등)을 치울 때 씁니다. 질문 · 평가 · 받아 적은 글이 같이 지워지고(on delete cascade),
// QR 로 연 평가서도 더는 안 열립니다. 요청은 몇 명이든 한 번입니다.
async function otherDelete(ids, label) {
  if (editingMid || !ids.length) return;
  var rows = otherRows.filter(function (r) { return ids.indexOf(r.id) > -1; });
  if (!rows.length) return;
  var who = label || rows.map(function (r) { return r.other_name; }).join(', ');
  var sent = rows.filter(otherOpenNow).length;
  var msg = who + ' — 지울까요?\n\n질문 · 평가 · 받아 적은 글이 모두 지워지고, 되돌릴 수 없습니다.' +
            (sent ? '\nQR 로 평가서를 열 수 있는 학생 ' + sent + '명은 더는 열리지 않습니다.' : '');
  if (!confirm(msg)) return;
  const { error } = await sb.from('interviews').delete().in('id', ids);
  if (error) { toast('지우지 못했습니다: ' + error.message, 'bad'); return; }
  toast(rows.length + '명을 지웠습니다.', 'ok');
  var wasOpen = target && target.other && ids.indexOf(target.ivId) > -1;
  otherRows = otherRows.filter(function (r) { return ids.indexOf(r.id) === -1; });
  if (wasOpen) { liveInterview = false; interviewId = null; backToList(); }   // 보고 있던 학생이면 첫 화면으로
  else otherRenderList();
}

// «이 리포트 지우기» (타학교) — 평가만 지우고 학생 · 질문은 남겨 «질문 준비» 로 되돌립니다.
// 시간 · 판정 · 영역 · 태그 · 요지 · 받아 적은 글 · 채점표 · 총평을 비우고, QR 열쇠도 지워서 찍어 둔 평가서는 더는 안 열립니다.
// 요청 두 번(질문 줄들을 한꺼번에 비우기 + 학생 줄 되돌리기)
async function otherResetReport() {
  var iv = viewing && viewing.interview;
  var msg = whoLabel(target) + ' 학생의 면접 평가를 지웁니다.\n\n' +
            '시간 · 평가 · 받아 적은 글 · 채점표 · 총평이 지워지고 되돌릴 수 없습니다.\n' +
            '학교 · 이름 · 희망 전공 · 질문은 남아 «질문 준비» 로 돌아갑니다(다시 면접할 수 있습니다).' +
            (otherOpenNow(iv) ? '\nQR 로 연 평가서도 더는 열리지 않습니다.' : '') +
            '\n\n학생까지 지우려면 왼쪽 목록의 🗑 을 누르세요.';
  if (!confirm(msg)) return;
  var id = interviewId;
  var a = await sb.from('interview_answers').update({
    seconds: 0, good_tags: [], bad_tags: [], rating: null, memo: '', transcript: '', marks: [], areas: {}
  }).eq('interview_id', id);
  if (a.error) { toast('지우지 못했습니다: ' + a.error.message, 'bad'); return; }
  var b = await sb.from('interviews').update({
    status: '준비중', started_at: new Date().toISOString(), finished_at: null, delivered_at: null, edited_at: null,
    total_seconds: 0, grades: {}, overall_note: '', share_key: null, share_until: null
  }).eq('id', id);
  if (b.error) { toast('지우지 못했습니다: ' + b.error.message, 'bad'); return; }

  stopTicking();
  liveInterview = false;
  viewing = null;
  document.getElementById('finish-note').value = '';
  toast('평가를 지웠습니다. 학생과 질문은 그대로 있습니다.', 'ok');
  var t = Object.assign({}, target);
  railOther = true;
  otherSetup(t);           // 그 학생의 준비 화면(질문지)으로
  await loadSheet();
  otherLoad();             // 왼쪽 목록의 상태를 «질문 준비» 로
}

function otherDeleteGroup(gi) {
  var g = otherGroups()[gi];
  if (!g) return;
  otherDelete(g.rows.map(function (r) { return r.id; }), (g.school || '학교 안 적은 학생') + ' ' + g.rows.length + '명 모두');
}

// 준비 화면을 타학교 학생으로 엽니다 (pickStudent 의 타학교 판)
function otherSetup(t) {
  target = t;
  railFolded = isNarrowRail();
  paintRailFold();
  document.getElementById('target-name').textContent = whoLabel(target);
  document.getElementById('btn-talk').hidden = true;
  midQuestions = [];
  questions = [];
  interviewId = null;
  sheetId = null; sheetSavedAt = null;
  resetGreetings();
  renderGreetings();
  renderQuestions();
  var keep = teacherLastGoTab;     // 우리 학생을 고를 때 이어 갈 탭은 그대로 둡니다
  setupGoTab('prep');
  teacherLastGoTab = keep;
  document.getElementById('other-paste').hidden = true;
  show('setup');
  paintQsect();
  paintSheetNote();
  otherRenderList();
}

// «＋ 타학교 학생 더하기»
// 학교 칸은 마지막에 적은 학교로 채워 둡니다 — 한 학교 학생을 줄줄이 넣으실 테니까요
function otherNew() {
  if (editingMid) return;
  var last = '';
  try { last = localStorage.getItem('otherLastSchool') || ''; } catch (e) { /* 없으면 빈칸 */ }
  otherSetup({ id: null, other: true, ivId: null, name: '', major: '', school: last, student_no: '' });
  var n = document.getElementById('other-name');
  if (n) n.focus();
}

// 타학교 목록에서 한 명을 누름 — 어디까지 했는지에 따라 준비 · 이어서 하기 · 평가서
async function otherOpen(id) {
  if (editingMid) return;
  var iv = otherRows.filter(function (r) { return r.id === id; })[0];
  if (!iv) return;
  if (iv.status === '준비중') {
    otherSetup(otherTarget(iv));
    await loadSheet();
    return;
  }
  if (iv.status === '진행중') { await resumeInterview(id); return; }
  target = otherTarget(iv);
  await openPast(id, null);
}

function otherSetName(el) {
  if (!target || !target.other) return;
  target.name = el.value;
  document.getElementById('target-name').textContent = whoLabel(target);
}
function otherSetMajor(el) {
  if (!target || !target.other) return;
  target.major = el.value;
}
function otherSetSchool(el) {
  if (!target || !target.other) return;
  target.school = el.value;
  document.getElementById('target-name').textContent = whoLabel(target);
}
// 저장할 때 서버에 보낼 세 칸 (keepSheet 가 씁니다). 학교는 다음 학생 칸에 미리 채우려고 기억해 둡니다
function otherFields() {
  var school = String(target.school || '').trim();
  try { localStorage.setItem('otherLastSchool', school); } catch (e) { /* 기억 못 해도 저장은 됩니다 */ }
  return { other_name: String(target.name || '').trim(), other_major: String(target.major || '').trim(), other_school: school };
}

// 저장 · 면접 화면으로 넘어가기 전에 — 이름이 없으면 막습니다
function otherCheckName() {
  if (String(target.name || '').trim()) return true;
  toast('타학교 학생 이름을 먼저 적어 주세요.', 'bad');
  var n = document.getElementById('other-name');
  if (n) { n.scrollIntoView({ block: 'center' }); n.focus({ preventScroll: true }); }
  return false;
}

// ── 질문 여러 개 한꺼번에 붙여넣기 ──
// 생기부로 질문을 따로 만들어 오신다고 해서(2026-10-11), 한 줄에 하나씩 붙여 넣으면 «낼 질문» 에 차례로 붙습니다.
// 앞의 번호(「1.」 「2)」 「Q3.」 「- 」 「•」)는 떼어 냅니다. 이미 있는 질문과 글자가 같으면 건너뜁니다.
function otherTogglePaste() {
  var box = document.getElementById('other-paste');
  box.hidden = !box.hidden;
  if (!box.hidden) document.getElementById('other-paste-text').focus();
}

function otherCleanLine(s) {
  return String(s || '')
    .replace(/^\s*(?:[-•·*▶▷○●□■◦]\s*)+/, '')
    .replace(/^\s*(?:Q\s*)?\d{1,2}\s*[.)\]:번]\s*/i, '')
    .replace(/^\s*\(\s*\d{1,2}\s*\)\s*/, '')
    .trim();
}

function otherPasteAdd() {
  var ta = document.getElementById('other-paste-text');
  var have = {};
  midQuestions.forEach(function (q) { have[q.text.trim()] = true; });
  var added = 0, same = 0;
  String(ta.value || '').split(/\r?\n/).forEach(function (line) {
    var q = otherCleanLine(line);
    if (!q) return;
    if (have[q]) { same++; return; }
    have[q] = true;
    midQuestions.push({ text: q, competency: '기타' });
    added++;
  });
  if (!added) { toast(same ? '모두 이미 «낼 질문» 에 있습니다.' : '넣을 질문이 없습니다. 한 줄에 하나씩 붙여 넣으세요.', 'bad'); return; }
  renderQuestions();
  ta.value = '';
  document.getElementById('other-paste').hidden = true;
  toast('질문 ' + added + '개를 «낼 질문» 에 넣었습니다.' + (same ? ' (같은 것 ' + same + '개는 건너뜀)' : '') +
        ' 무엇을 보는 질문인지 골라 두세요.', 'ok');
}

// ── 평가서 화면 — QR ──
function otherPaintReport(iv) {
  var open = otherOpenNow(iv);
  var st = document.getElementById('report-state');
  st.innerHTML = open
    ? '<span class="pill ok2">QR 로 여는 중 · ' + esc(otherWhen(iv.share_until)) + '까지</span>'
    : iv.status === '전달됨'
      ? '<span class="pill warn">QR 시간이 지났습니다</span>'
      : '<span class="pill warn">아직 QR 을 안 보여 줬습니다</span>';
  var d = document.getElementById('btn-deliver');
  d.hidden = false;
  d.textContent = iv.share_key ? '📱 QR 다시 보기' : '📱 QR 로 평가서 주기';
  document.getElementById('report-note').textContent =
    '학생이 휴대폰 카메라로 QR 을 찍으면 로그인 없이 이 평가서가 열리고 PDF 로 저장할 수 있습니다. ' +
    'QR 을 보여 준 때부터 ' + OTHER_HOURS + '시간 동안만 열리고, 그 뒤에는 서버에서 지워집니다' +
    (iv.share_key ? ' (다시 보기를 누르면 그때부터 다시 ' + OTHER_HOURS + '시간).' : '.');
}

// 맞히기 어려운 열쇠 — 24바이트 = 32글자(영문·숫자·-_). 주소에 그대로 들어갑니다
function otherNewKey() {
  var b = new Uint8Array(24);
  crypto.getRandomValues(b);
  var s = '';
  for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 선생님 화면(teacher/) 옆의 r.html — 미리보기 주소에서 열어도 같은 자리를 가리킵니다
function otherReportUrl(key) {
  return new URL('../r.html', location.href).href.split('#')[0] + '#' + key;
}

// «QR 로 평가서 주기» / «QR 다시 보기» — 열쇠는 처음 한 번만 만들고(이미 찍은 학생도 계속 열리게),
// 여는 시간은 누를 때마다 지금부터 하루로 다시 맞춥니다.
async function otherDeliver() {
  var iv = viewing && viewing.interview;
  if (!iv || !interviewId) return;
  var btn = document.getElementById('btn-deliver');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'QR 만드는 중...';

  var now = new Date();
  var patch = {
    share_key: iv.share_key || otherNewKey(),
    share_until: new Date(now.getTime() + OTHER_HOURS * 3600 * 1000).toISOString()
  };
  if (iv.status !== '전달됨') { patch.status = '전달됨'; patch.delivered_at = now.toISOString(); }
  const { error } = await sb.from('interviews').update(patch).eq('id', interviewId);

  btn.disabled = false;
  btn.textContent = label;
  if (error) { toast('QR 을 만들지 못했습니다: ' + error.message, 'bad'); return; }
  Object.assign(iv, patch);
  otherPaintReport(iv);
  otherShowQR(patch.share_key, patch.share_until);
}

function otherShowQR(key, until) {
  var url = otherReportUrl(key);
  var box = document.getElementById('qr-box');
  if (typeof qrcode !== 'function') {
    box.innerHTML = '<p class="empty">QR 도구(assets/vendor/qrcode.js)를 못 읽었습니다. Ctrl+F5 로 새로고침해 주세요.<br>' +
                    '그동안은 아래 주소를 학생에게 보여 주세요.</p>';
  } else {
    var qr = qrcode(0, 'M');     // 0 = 크기 알아서, M = 조금 가려져도 읽힘
    qr.addData(url);
    qr.make();
    // ⚠️ margin 은 칸 수가 아니라 px 입니다. 둘레 흰 테두리가 칸 4개는 되어야 폰이 잘 읽습니다(8px × 4)
    box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
  }
  document.getElementById('qr-who').textContent = target
    ? [target.name, target.school, target.major].filter(function (x) { return x; }).join(' · ') : '';
  document.getElementById('qr-until').textContent = otherWhen(until) + '까지 열립니다. 그 뒤에는 지워지니 바로 PDF 로 저장하게 해 주세요.';
  document.getElementById('qr-url').textContent = url;
  document.getElementById('qr-overlay').style.display = 'flex';
}

function otherCloseQR() { document.getElementById('qr-overlay').style.display = 'none'; }

async function otherCopyUrl() {
  var url = document.getElementById('qr-url').textContent;
  try { await navigator.clipboard.writeText(url); toast('주소를 복사했습니다.', 'ok'); }
  catch (e) { toast('복사가 막혔습니다. 주소를 손으로 골라 복사해 주세요.', 'bad'); }
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var o = document.getElementById('qr-overlay');
  if (o && o.style.display === 'flex') otherCloseQR();
});
