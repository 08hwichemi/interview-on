// 관리자 공지 — 학생·교사 머리말의 🔔 단추로 봅니다.
//
// ⚠️ 처음에는 홈 화면 위에 상자로 박아 넣었는데, 두 가지 문제가 있었습니다.
//    ① 그만큼 자리를 차지해서, 휴대폰에서는 메뉴 버튼 5개가 찌그러졌습니다.
//    ② 한 번 닫으면(또는 새 공지로 덮어써지면) 다시 볼 방법이 없었습니다 — 관리자
//       말고는 지난 공지를 아예 못 봤습니다.
//    그래서 머리말의 작은 종 단추 + 안읽음 점(배지)으로 바꾸고, 눌러서 열면
//    지금 공지와 지난 공지를 같이 보여줍니다(누구나 읽을 수 있습니다).
//
// ⚠️ 표를 두 개(지금 뜨는 것 하나짜리 · 지난 기록 여러 줄)로 나눴다가, «지난 공지
//    목록에서 고쳤는데 배너는 안 바뀐다» 는 혼란을 겪었습니다 — 서로 다른 표였기
//    때문입니다. 그래서 표 하나(announcements)로 합치고 active 로 «지금 뜨는 줄»
//    딱 하나만 가립니다. 고치는 줄이 active 면 배너도 같은 줄이라 바로 반영됩니다.
//    학생 앱(index.html)과 교사 화면(teacher/index.html)이 함께 씁니다.
// esc() · sb · SCHOOL_ID 는 report.js · config.js 가 먼저 실어 둡니다.

var noticeCurrent = null;   // 지금 뜨는 공지 { content, link, updated_at } — 없으면 null

async function noticeCheckBadge() {
  var btn = document.getElementById('notice-open');
  if (!btn) return;

  const { data, error } = await sb.from('announcements')
    .select('content, link, updated_at').eq('school_id', SCHOOL_ID).eq('active', true).maybeSingle();
  if (error) return;
  noticeCurrent = (data && data.content) ? data : null;

  var seenAt = null;
  try { seenAt = localStorage.getItem('noticeSeenAt'); } catch (e) { /* 사생활 보호 모드면 막힐 수 있습니다 */ }
  var isUnseen = !!noticeCurrent && seenAt !== noticeCurrent.updated_at;

  var dot = document.getElementById('notice-dot');
  var wasHidden = !dot || dot.hidden;
  if (dot) dot.hidden = !isUnseen;

  // 안읽음 점이 «막 켜진» 순간(처음 들어왔을 때 포함)에만 토스트로도 한 번 알려 줍니다.
  // 매번 확인할 때마다(3분마다·탭 돌아올 때마다) 뜨면 성가시므로, 켜져 있던 채로
  // 다시 확인한 것뿐이면 안 띄웁니다. 관리자가 고치거나(수정) 다른 줄을 다시
  // 올려도(공지로 올리기) updated_at 이 새로 찍혀 다시 안읽음이 되므로, 토스트도
  // 다시 뜹니다.
  if (isUnseen && wasHidden) noticeToast('📢 새 공지가 있습니다. 🔔 를 눌러 확인하세요.');
}

// 학생 앱에는 showToast(), 교사 화면에는 toast() 가 있어 그걸 씁니다.
function noticeToast(msg) {
  if (typeof showToast === 'function') showToast(msg, 'info');
  else if (typeof toast === 'function') toast(msg);
}

function noticeSafeLink(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return esc(url);
}

function noticeLinkHTML(link) {
  link = (link || '').trim();
  return link ? '<br><a href="' + noticeSafeLink(link) + '" target="_blank" rel="noopener">' + esc(link) + '</a>' : '';
}

async function noticeOpenPanel() {
  document.getElementById('notice-panel-overlay').style.display = 'flex';
  var body = document.getElementById('notice-panel-body');
  body.innerHTML = '<p class="prac-empty">불러오는 중...</p>';

  const { data, error } = await sb.from('announcements')
    .select('content, link, active, created_by_name, created_at, updated_at')
    .eq('school_id', SCHOOL_ID).order('created_at', { ascending: false }).limit(30);

  if (error) { body.innerHTML = '<p class="prac-empty">공지를 불러오지 못했습니다.</p>'; return; }

  var current = (data || []).filter(function (r) { return r.active; })[0] || null;

  // 열어 봤다는 뜻으로 지금 공지를 «읽음» 처리합니다(배지만 없어집니다 — 내용은
  // 아래에서 계속 보실 수 있습니다).
  if (current) {
    try { localStorage.setItem('noticeSeenAt', current.updated_at); } catch (e) { /* 위와 같습니다 */ }
    var dot = document.getElementById('notice-dot');
    if (dot) dot.hidden = true;
  }

  var nowHTML = current
    ? '<p class="prac-label">지금 공지</p>' +
      '<div class="' + noticeBoxClass() + '">' + esc(current.content).replace(/\n/g, '<br>') +
        noticeLinkHTML(current.link) + '</div>'
    : '<p class="prac-label">지금 공지</p><p class="prac-empty">지금 뜨는 공지가 없습니다.</p>';

  var histHTML = '<p class="prac-label" style="margin-top:18px">지난 공지</p>';
  if (!data || !data.length) {
    histHTML += '<p class="prac-empty">아직 올라온 공지가 없습니다.</p>';
  } else {
    histHTML += '<div class="notice-history">' + data.map(function (r) {
      var d = new Date(r.created_at);
      var when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      return '<div class="notice-history-row">' +
        '<div class="notice-history-when">' + when + (r.created_by_name ? ' · ' + esc(r.created_by_name) : '') +
          (r.active ? ' · <b>지금 뜨는 중</b>' : '') + '</div>' +
        '<div class="notice-history-body">' + esc(r.content).replace(/\n/g, '<br>') + noticeLinkHTML(r.link) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  body.innerHTML = nowHTML + histHTML;
}

// 「지금 공지」 상자는 각 화면이 이미 쓰던 강조 상자 모양을 그대로 빌립니다 —
// 학생 앱(index.html)은 .notice-banner, 교사 화면(teacher/index.html)은 .note.warn 입니다.
function noticeBoxClass() {
  return location.pathname.indexOf('/teacher/') > -1 ? 'note warn' : 'notice-banner';
}

function noticeClosePanel() {
  document.getElementById('notice-panel-overlay').style.display = 'none';
}

var noticeWatchOn = false;
function noticeWatch() {
  if (noticeWatchOn) return;
  noticeWatchOn = true;
  noticeCheckBadge();
  try {
    sb.channel('school-announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, function () { noticeCheckBadge(); })
      .subscribe();
  } catch (e) { console.warn('공지 실시간 알림을 켜지 못했습니다:', e); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) noticeCheckBadge(); });
}
