// 면접 리포트 — 교사 화면과 학생 앱이 함께 씁니다.
//
// 선생님이 보는 «확인용 리포트» 와 학생이 받는 리포트는 같은 종이여야 합니다.
// 두 곳에서 따로 그리면 반드시 한쪽이 달라집니다. 그래서 여기 한 곳에서 그립니다.
//
// 이 파일은 teacher-app.js · student-report.js 보다 먼저 불러야 합니다.

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

var GRADES = ['A', 'B', 'C', 'D', 'E'];

// ── 공용 도우미 ──
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mmss(s) {
  s = Number(s) || 0;
  var m = Math.floor(s / 60), r = s % 60;
  return (m < 10 ? '0' + m : m) + ':' + (r < 10 ? '0' + r : r);
}

// 「2026년 9월 16일」
function ymd(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

// ── 서버에서 한 회차 가져오기 ──
async function fetchReport(interviewId) {
  const { data: iv, error: e1 } = await sb
    .from('interviews').select('*').eq('id', interviewId).maybeSingle();
  if (e1) return { error: e1.message };
  if (!iv) return { error: '그 면접을 찾지 못했습니다.' };

  const { data: rows, error: e2 } = await sb
    .from('interview_answers').select('*').eq('interview_id', interviewId).order('seq');
  if (e2) return { error: e2.message };

  return { interview: iv, answers: rows || [] };
}

// ── 리포트 한 장 그리기 ──
// who   : '30101 고다윤' 처럼 머리에 적을 이름 (학생 앱에서는 비워도 됩니다)
// round : 몇 회차인지 (모르면 비웁니다)
function reportHTML(iv, answers, who, round) {
  var g = iv.grades || {};
  var spoken = (answers || []).reduce(function (n, a) { return n + (a.seconds || 0); }, 0);

  var head =
    '<div class="rp-head">' +
      '<div>' +
        '<p class="sec" style="margin:0">면접 리포트' + (round ? ' · ' + round + '회차' : '') + '</p>' +
        (who ? '<h2>' + esc(who) + '</h2>' : '') +
        '<p class="rp-when">' + ymd(iv.started_at) +
          (iv.teacher_name ? ' · ' + esc(iv.teacher_name) + ' 선생님' : '') + '</p>' +
      '</div>' +
      '<div class="rp-times">' +
        '<span><b>' + mmss(iv.total_seconds) + '</b>면접 전체</span>' +
        '<span><b>' + mmss(spoken) + '</b>답변 시간 합</span>' +
      '</div>' +
    '</div>' +
    (iv.edited_at
      ? '<p class="rp-edited">' + ymd(iv.edited_at) + '에 선생님이 내용을 고쳤습니다.</p>'
      : '');

  // 채점표 — 안 찍은 항목은 «—» 로 둡니다. 다 찍어야 하는 건 아닙니다.
  var sheet =
    '<p class="sec gap">채점표</p>' +
    '<div class="rp-sheet">' + SCORESHEET.map(function (r) {
      var got = g[r.item];
      return '<div class="rp-srow">' +
        '<span class="area">' + esc(r.area) + '</span>' +
        '<span class="item"><b>' + esc(r.item) + '</b><span class="desc">' + esc(r.desc) + '</span></span>' +
        '<span class="got' + (got ? '' : ' none') + '">' + (got ? esc(got) : '—') + '</span>' +
      '</div>';
    }).join('') + '</div>';

  var note = iv.overall_note
    ? '<p class="sec gap">선생님 총평</p><p class="rp-note">' + esc(iv.overall_note) + '</p>'
    : '';

  // 질문별 기록 — 무슨 질문을 받았고, 얼마나 말했고, 어땠는지
  var list =
    '<p class="sec gap">질문별 기록 <span class="opt">' +
      (answers || []).length + '문항</span></p>' +
    '<div class="rp-answers">' + (answers || []).map(function (a, i) {
      var good = a.good_tags || [], bad = a.bad_tags || [];
      return '<div class="ansrow">' +
        '<div class="anshead">' +
          '<span class="qno">' + (a.seq || i + 1) + '</span>' +
          '<span class="qt">' + esc(a.question) + '</span>' +
          (a.rating ? '<span class="pill rate">' + esc(a.rating) + '</span>' : '') +
          '<span class="secs">' + mmss(a.seconds) + '</span>' +
        '</div>' +
        (a.competency && a.competency !== '기타'
          ? '<div class="anscomp">' + esc(a.competency) + ' 질문</div>' : '') +
        (good.length || bad.length
          ? '<div class="anstags">' +
              good.map(function (t) { return '<span class="minitag good">' + esc(t) + '</span>'; }).join('') +
              bad.map(function (t) { return '<span class="minitag bad">' + esc(t) + '</span>'; }).join('') +
            '</div>'
          : '') +
        (a.memo ? '<p class="ansmemo">' + esc(a.memo) + '</p>' : '') +
        '</div>';
    }).join('') + '</div>';

  return head + list + sheet + note;
}

// ── 인쇄 · PDF ──
//
// 따로 PDF 만드는 라이브러리를 붙이지 않았습니다. 브라우저 인쇄창에서
// 프린터 대신 «PDF로 저장» 을 고르면 그대로 PDF 파일이 됩니다.
//   윈도우  Microsoft Print to PDF
//   맥·아이폰·안드로이드  PDF로 저장
// 학생은 PDF 로 받고 선생님은 종이로 뽑는 것뿐, 하는 일은 같습니다.
//
// 화면에 있는 리포트를 그대로 #print-root 로 옮겨 담고,
// 인쇄할 때는 report.css 의 @media print 가 그것만 남기고 다 가립니다.
function printReport(bodyId, title) {
  var src = document.getElementById(bodyId);
  if (!src || !src.innerHTML.trim()) return;

  var root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.className = 'report';
  root.innerHTML = src.innerHTML;
  fitToOnePage(root);

  // 인쇄창이 문서 제목을 파일 이름으로 씁니다.
  var was = document.title;
  if (title) document.title = title;

  var restored = false;
  function restore() {
    if (restored) return;
    restored = true;
    document.title = was;
    window.removeEventListener('afterprint', restore);
  }
  window.addEventListener('afterprint', restore);
  // afterprint 를 안 알려주는 브라우저가 있어서 시간으로도 되돌립니다.
  setTimeout(restore, 60000);

  window.print();
}

// ── 한 장에 맞추기 ──
//
// 상담할 때는 종이 한 장에 다 보이는 게 좋습니다. 두 장이 되면
// 질문은 앞장, 채점표는 뒷장이 되어 견주면서 이야기하기 어렵습니다.
//
// report.css 가 인쇄본을 이미 촘촘하게 잡아 두어 질문 8개쯤까지는 한 장에 듭니다.
// 그보다 조금 넘칠 때만 살짝 줄여서 한 장에 밀어 넣습니다.
// 많이 넘치면(글씨가 읽기 힘들어질 만큼) 줄이지 않고 두 장으로 갑니다.
// 그때는 칸이 가운데서 잘리지 않게만 합니다(@media print 의 break-inside).
var PAGE_W = 688;    // A4 가로 210mm − 좌우 여백 14mm씩 = 182mm ≒ 688px (96dpi)
var PAGE_H = 1017;   // A4 세로 297mm − 위아래 여백 14mm씩 = 269mm ≒ 1017px
var MIN_ZOOM = 0.72; // 이보다 더 줄이면 글씨가 작아서 못 읽습니다

function fitToOnePage(root) {
  root.style.cssText = '';   // 지난번에 줄여 놓은 값을 먼저 지웁니다

  // 화면에 안 보이게 두되, 인쇄될 폭 그대로 펴서 높이를 잽니다.
  // 화면 폭으로 재면 줄바꿈이 달라져서 전혀 다른 값이 나옵니다.
  root.style.cssText =
    'display:block;position:absolute;left:-10000px;top:0;visibility:hidden;width:' + PAGE_W + 'px';
  var h = root.scrollHeight;
  root.style.cssText = '';

  if (!h || h <= PAGE_H) return;            // 이미 한 장에 듭니다

  var z = PAGE_H / h;
  if (z < MIN_ZOOM) return;                 // 너무 많이 줄여야 합니다. 두 장으로 갑니다
  root.style.zoom = Math.floor(z * 100) / 100;
}

// 「30101 고다윤 면접 리포트 2회차」 — 저장할 때 이 이름이 붙습니다.
function reportFileName(who, round) {
  return (who ? who + ' ' : '') + '면접 리포트' + (round ? ' ' + round + '회차' : '');
}
