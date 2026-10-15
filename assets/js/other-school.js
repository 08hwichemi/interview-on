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
  // 목록과 내 즐겨찾기를 같이 받습니다(요청 두 번, 동시에)
  const [res, fav] = await Promise.all([
    sb.from('interviews')
      .select('id, other_name, other_major, other_school, status, teacher_name, started_at, share_until, sheet_name')
      .not('other_name', 'is', null),
    sb.from('teacher_other_favorites').select('interview_id').eq('teacher_id', me.id)
  ]);
  const { data, error } = res;
  if (error) { box.innerHTML = '<p class="empty">타학교 목록을 못 읽었습니다: ' + esc(error.message) + '</p>'; return; }
  // 즐겨찾기를 못 읽어도 목록은 씁니다(별만 꺼진 채)
  if (!fav.error) {
    otherFav = {};
    (fav.data || []).forEach(function (r) { otherFav[r.interview_id] = true; });
  }
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
  otherMerged().forEach(function (iv) {
    var s = iv.other_school || '';
    if (!(s in at)) { at[s] = out.length; out.push({ school: s, rows: [] }); }
    out[at[s]].rows.push(iv);
  });
  return out;
}

// 한 줄 — 고르는 단추 · ★ · 🗑. 담당 학생 칸에서는 희망 전공 앞에 학교도 적습니다
// 목록에 보일 줄 — 질문지(«준비중» 줄)가 여러 벌인 학생은 **한 줄로 묶습니다**.
// 2026-10-14 선생님 말씀: «질문지 2개를 만들었더니 왼쪽 목록에 사람이 왜 2명이 되는 거야? 명단은 1개로».
// 같은 학교 · 이름의 «준비중» 줄들을 하나로(가장 최근 것이 대표, ids 에 전부). 면접을 본 줄(진행중 · 작성완료 · 전달됨)은 회차라 따로.
function otherMerged() {
  var out = [], at = {};
  otherRows.forEach(function (iv) {
    if (iv.status !== '준비중') { out.push(Object.assign({ ids: [iv.id], nsheets: 1 }, iv)); return; }
    var key = (iv.other_school || '') + '\n' + (iv.other_name || '');
    if (key in at) {
      var m = out[at[key]];
      m.ids.push(iv.id); m.nsheets++;
      if ((iv.started_at || '') > (m.started_at || '')) {   // 더 최근 것을 대표로(누르면 이것이 열림)
        Object.assign(m, iv, { ids: m.ids, nsheets: m.nsheets });
      }
    } else { at[key] = out.length; out.push(Object.assign({ ids: [iv.id], nsheets: 1 }, iv)); }
  });
  return out;
}

function otherRowHTML(iv, withSchool) {
  var ids = iv.ids || [iv.id];
  var on = target && target.other && ids.indexOf(target.ivId) > -1;
  var fav = ids.some(function (id) { return otherFav[id] === true; });
  var sub = [withSchool ? iv.other_school : '', iv.other_major, iv.nsheets > 1 ? '질문지 ' + iv.nsheets + '벌' : '']
    .filter(function (x) { return x; }).join(' · ');
  return '<div class="srow">' +
    '<button class="railrow orow" aria-current="' + !!on + '" onclick="otherOpen(\'' + iv.id + '\')">' +
      '<span class="who"><span class="nm">' + esc(iv.other_name) + '</span>' +
        (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span>' +
      otherState(iv) +
    '</button>' +
    '<button class="star" aria-pressed="' + fav + '" onclick="otherToggleFav(\'' + iv.id + '\')"' +
      ' title="' + (fav ? '담당 학생에서 빼기' : '담당 학생으로 담기') + '">★</button>' +
    '<button class="odel" title="이 학생 지우기" aria-label="' + esc(iv.other_name) + ' 지우기"' +
      ' onclick="otherDelete(' + esc(JSON.stringify(ids)) + ')">🗑</button>' +
  '</div>';
}

function otherRenderList() {
  var box = document.getElementById('other-list');
  var merged = otherMerged();
  var cnt = document.getElementById('other-count');
  if (cnt) cnt.textContent = merged.length;
  if (!box) return;
  if (!merged.length) {
    box.innerHTML = '<p class="empty">아직 없습니다.<br>위 «＋ 타학교 학생 더하기» 로 학교 · 이름 · 희망 전공 · 질문을 넣어 두세요.</p>';
    return;
  }
  // ★ 담당 학생 — 학교 묶음과 상관없이 맨 위에 늘 펴 둡니다(우리 학교 명단과 같은 모양)
  var favs = merged.filter(function (iv) { return iv.ids.some(function (id) { return otherFav[id]; }); });
  var favHTML = favs.length
    ? '<div class="favbox ofav"><p class="sec">★ 담당 학생 ' + favs.length + '명</p>' +
        '<div class="favlist">' + favs.map(function (iv) { return otherRowHTML(iv, true); }).join('') + '</div></div>'
    : '';
  var fold = otherFoldNow || (otherFoldNow = otherFoldMap());
  box.innerHTML = favHTML + otherGroups().map(function (g, gi) {
    var hasOpen = target && target.other && g.rows.some(function (iv) { return iv.ids.indexOf(target.ivId) > -1; });
    var shut = !!fold[g.school] && !hasOpen;      // 지금 보고 있는 학생의 학교는 접어도 펴 둡니다
    return '<div class="ogroup">' +
      '<button class="ohead" aria-expanded="' + !shut + '" onclick="otherToggleGroup(' + gi + ')">' +
        '<span class="chev" aria-hidden="true">▾</span>' +
        '<span class="sch">' + esc(g.school || '학교 안 적음') + '</span>' +
        '<span class="n">' + g.rows.length + '명</span>' +
      '</button>' +
      (shut ? '' :
        '<div class="obody">' + g.rows.map(function (iv) { return otherRowHTML(iv, false); }).join('') +
        '<button class="linkbtn danger odelall" onclick="otherDeleteGroup(' + gi + ')">' +
          esc(g.school || '학교 안 적은 학생') + ' ' + g.rows.length + '명 모두 지우기</button>' +
        '</div>') +
    '</div>';
  }).join('');
}

// ── ★ 담당 학생(즐겨찾기) — 2026-10-11 선생님 말씀 «타학교에도 즐겨찾기» ──
// 우리 학교 별표(teacher_favorites)처럼 계정에 붙여 둡니다(teacher_other_favorites) — 다른 컴퓨터에서 열어도 그대로.
// 학생 줄이 지워지면(🗑 · 하루 뒤 정리) 별도 같이 지워집니다.
var otherFav = {};          // { interview_id: true }

async function otherToggleFav(id) {
  var wasOn = otherFav[id] === true;
  otherFav[id] = !wasOn;    // 누르자마자 화면부터
  otherRenderList();
  var res = wasOn
    ? await sb.from('teacher_other_favorites').delete().eq('teacher_id', me.id).eq('interview_id', id)
    : await sb.from('teacher_other_favorites')
        .upsert({ teacher_id: me.id, interview_id: id }, { onConflict: 'teacher_id,interview_id' });
  if (res.error) {
    otherFav[id] = wasOn;   // 서버가 거절하면 되돌립니다
    otherRenderList();
    toast('담당 학생을 저장하지 못했습니다: ' + res.error.message, 'bad');
  }
}

// ── «명단 저장» — 질문 없이 학교 · 이름 · 희망 전공만 먼저 (2026-10-11 선생님 말씀) ──
// 예전엔 «질문지 저장» 을 눌러야 목록에 생겼습니다. 이제 맨 위 세 칸 옆 단추로 바로 명단에 넣습니다.
//   · 새 학생: 줄을 만들고, 지금 화면의 첫인사 · 끝인사(와 적어 둔 질문)도 같이 남깁니다 — 안 남기면 다시 열 때 첫인사가 꺼진 채로 뜹니다
//   · 이미 있는 학생: 세 칸만 고칩니다(질문은 «질문지 저장» 으로)
//   · next=true(«저장하고 다음 학생») — 저장한 뒤 빈 칸으로(학교는 그대로) 바로 다음 학생
//   · 같은 학교에 같은 이름이 이미 있으면 한 번 묻습니다(두 번 눌러 겹치는 것 막기)
async function otherSaveRoster(next) {
  if (!target || !target.other) return;
  if (!otherCheckName()) return;
  var f = otherFields();
  var btns = document.querySelectorAll('.otheracts button');
  function busy(on) { Array.prototype.forEach.call(btns, function (b) { b.disabled = on; }); }

  if (!target.ivId) {
    var same = otherRows.filter(function (r) { return r.other_name === f.other_name && (r.other_school || '') === f.other_school; });
    if (same.length && !confirm((f.other_school || '학교 안 적음') + ' ' + f.other_name + ' 학생이 이미 명단에 있습니다.\n그래도 한 명 더 넣을까요?')) return;
    busy(true);
    var list = composeQuestions();
    var ok;
    if (list.length) ok = await keepSheet(list);
    else {
      var ins = await sb.from('interviews').insert(Object.assign({
        school_id: SCHOOL_ID, student_id: null, teacher_id: me.id, teacher_name: me.name || '', status: '준비중'
      }, f)).select('id, started_at').single();
      ok = !ins.error;
      if (ins.error) toast('명단에 넣지 못했습니다: ' + ins.error.message, 'bad');
      else { sheetId = ins.data.id; sheetSavedAt = ins.data.started_at; sheetName = ''; target.ivId = sheetId; sheets.unshift({ id: sheetId, started_at: sheetSavedAt, sheet_name: '' }); paintSheetNote(); otherLoad(); }
    }
    busy(false);
    if (!ok) return;
  } else {
    busy(true);
    // 질문지가 여러 벌이면 그 줄들 모두 같은 학생이니 함께 고칩니다
    var ids = sheets.length > 1 ? sheets.map(function (s) { return s.id; }) : [target.ivId];
    const up = await sb.from('interviews').update(f).in('id', ids);
    busy(false);
    if (up.error) { toast('명단을 고치지 못했습니다: ' + up.error.message, 'bad'); return; }
    otherLoad();
  }
  toast(whoLabel(target) + ' — 명단에 저장했습니다.' + (next ? ' 다음 학생을 적으세요.' : ' 질문은 나중에 넣어도 됩니다.'), 'ok');
  if (next) otherNew();
}

// 세 칸에서 Enter = «명단 저장» (한글 입력 중의 Enter 는 글자 확정이라 건너뜁니다)
function otherFormKey(e) {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  otherSaveRoster(false);
}

// ── 지우기 — 한 명(🗑) 또는 한 학교 모두 ──
// 면접이 끝나면 QR 을 보여 준 때부터 하루 뒤 서버가 알아서 지웁니다. 그 전에 지우고 싶을 때, 또는 QR 을
// 안 보여 준 학생(질문지만 만든 학생 등)을 치울 때 씁니다. 질문 · 평가 · 받아 적은 글이 같이 지워지고(on delete cascade),
// QR 로 연 평가서도 더는 안 열립니다. 요청은 몇 명이든 한 번입니다.
async function otherDelete(ids, label) {
  if (editingMid || !ids.length) return;
  var rows = otherRows.filter(function (r) { return ids.indexOf(r.id) > -1; });
  if (!rows.length) return;
  var names = rows.map(function (r) { return r.other_name; }).filter(function (n, i, a) { return a.indexOf(n) === i; });   // 질문지가 여러 벌이면 같은 이름이 여럿
  var who = label || names.join(', ');
  var sent = rows.filter(otherOpenNow).length;
  var msg = who + ' — 지울까요?\n\n질문 · 평가 · 받아 적은 글이 모두 지워지고, 되돌릴 수 없습니다.' +
            (sent ? '\nQR 로 평가서를 열 수 있는 학생 ' + sent + '명은 더는 열리지 않습니다.' : '');
  if (!confirm(msg)) return;
  const { error } = await sb.from('interviews').delete().in('id', ids);
  if (error) { toast('지우지 못했습니다: ' + error.message, 'bad'); return; }
  toast(names.length + '명을 지웠습니다.', 'ok');
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
  var ids = [];
  g.rows.forEach(function (r) { ids = ids.concat(r.ids || [r.id]); });
  otherDelete(ids, (g.school || '학교 안 적은 학생') + ' ' + g.rows.length + '명 모두');
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
  sheetId = null; sheetSavedAt = null; sheetName = ''; sheets = [];
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
// 처음엔 타학교 전용이었는데 2026-10-15 부터 우리 학교 학생도 씁니다(이름은 그대로 other… 로 둡니다 —
// 따라 하기 · 시험이 이 이름을 가리킵니다). 우리 학교 학생이면 아래 pasteSendToStudent 로 학생에게 보낼 수도 있습니다.
// mode: 없으면 «낼 질문» 에 넣기, 'send' 면 학생에게 보내기(우리 학교 학생만 — «📨 질문 보내기» 단추).
// 같은 단추를 다시 누르면 닫고, 다른 단추를 누르면 적어 둔 글은 그대로 두고 칸의 쓰임만 바꿉니다.
function otherTogglePaste(mode) {
  mode = (mode === 'send' && target && !target.other) ? 'send' : 'add';
  var box = document.getElementById('other-paste');
  if (!box.hidden && box.dataset.mode === mode) { box.hidden = true; return; }
  box.dataset.mode = mode;
  if (mode === 'send') document.getElementById('paste-send-who').textContent = (target.name || '학생') + ' 학생';
  box.hidden = false;
  document.getElementById('other-paste-text').focus();
}
function otherClosePaste() { document.getElementById('other-paste').hidden = true; }

function otherCleanLine(s) {
  return String(s || '')
    .replace(/^\s*(?:[-•·*▶▷○●□■◦]\s*)+/, '')
    .replace(/^\s*(?:Q\s*)?\d{1,2}\s*[.)\]:번]\s*/i, '')
    .replace(/^\s*\(\s*\d{1,2}\s*\)\s*/, '')
    .trim();
}

// 붙여 넣은 칸의 글을 질문 목록으로 — 번호를 떼고, 빈 줄과 같은 글자는 한 번만
function otherPasteLines() {
  var seen = {}, out = [];
  String(document.getElementById('other-paste-text').value || '').split(/\r?\n/).forEach(function (line) {
    var q = otherCleanLine(line);
    if (!q || seen[q]) return;
    seen[q] = true;
    out.push(q);
  });
  return out;
}

function otherPasteAdd() {
  var ta = document.getElementById('other-paste-text');
  var have = {};
  midQuestions.forEach(function (q) { have[q.text.trim()] = true; });
  var added = 0, same = 0;
  otherPasteLines().forEach(function (q) {
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

// ── 직접 적은 질문을 학생에게 보내기 (2026-10-15 선생님 말씀) ──
// 예전엔 생기부 화면(「📄 생기부에서 뽑기」)에서 뽑은 질문만 학생에게 보낼 수 있었습니다.
// 이제 «📨 질문 보내기» 단추로 연 칸에 적은 질문도 그 학생의 답안 연습장 «받은 질문»(practice_offers)으로 보냅니다.
// 생기부 화면의 «학생에게 보내기» 와 같은 표 · 같은 규칙입니다(saenggibu.js 의 sendSaenggibuPicks):
//   같은 학생에게 같은 질문을 또 보내면 서버가 하나만 남기고, 다른 계정으로 로그인돼 있으면 막습니다.
// 학년은 «공통», 영역은 «직접» 으로 보냅니다 — 학생 창에서는 «공통 · 선생님 직접» 묶음으로 보입니다.
// 타학교 학생은 계정이 없어 보낼 곳이 없으므로 «📨 질문 보내기» 단추를 가립니다(.ours-only).
async function pasteSendToStudent() {
  if (typeof target === 'undefined' || !target || target.other) return;
  var list = otherPasteLines();
  if (!list.length) { toast('보낼 질문이 없습니다. 한 줄에 하나씩 적으세요.', 'bad'); return; }
  var who = target.name || target.student_no || '학생';
  if (!confirm(list.length + '개를 ' + who + ' 학생의 답안 연습장으로 보냅니다.\n' +
               '학생이 «받은 질문» 에서 골라 답을 써 봅니다.')) return;
  if (!(await sgSameLogin())) return;

  var rows = list.map(function (q) {
    return { school_id: SCHOOL_ID, student_id: target.id,
             teacher_id: me.id, teacher_name: (me && me.name) || '',
             grade: '공통', area: '직접', subject: '', question: q };
  });
  var btn = document.getElementById('paste-send');
  if (btn) btn.disabled = true;
  const { data, error } = await sb.from('practice_offers')
    .upsert(rows, { onConflict: 'student_id,question', ignoreDuplicates: true })
    .select('id');
  if (btn) btn.disabled = false;
  if (error) {
    if (/row-level security/.test(error.message || '')) alert(SG_OTHER_LOGIN_MSG);
    else toast('보내지 못했습니다: ' + error.message, 'bad');
    return;
  }
  var made = (data || []).length;
  document.getElementById('other-paste-text').value = '';
  document.getElementById('other-paste').hidden = true;
  toast(made + '개를 ' + who + ' 학생에게 보냈습니다.' +
        (rows.length > made ? ' (이미 보낸 ' + (rows.length - made) + '개는 건너뜀)' : ''), 'ok');
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
