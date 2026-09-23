// 관리자 공지 — 학생·교사 머리말의 🔔 단추로 봅니다.
//
// ⚠️ 처음에는 홈 화면 위에 상자로 박아 넣었는데, 두 가지 문제가 있었습니다.
//    ① 그만큼 자리를 차지해서, 휴대폰에서는 메뉴 버튼 5개가 찌그러졌습니다.
//    ② 한 번 닫으면(또는 새 공지로 덮어써지면) 다시 볼 방법이 없었습니다 — 관리자
//       말고는 지난 공지를 아예 못 봤습니다.
//    그래서 머리말의 작은 종 단추 + 안읽음 점(배지)으로 바꾸고, 눌러서 열면
//    지금 공지와 지난 공지(누구나 읽을 수 있습니다, announcement_log)를 같이 보여줍니다.
//    학생 앱(index.html)과 교사 화면(teacher/index.html)이 함께 씁니다.
// esc() · sb · SCHOOL_ID 는 report.js · config.js 가 먼저 실어 둡니다.

var noticeCurrent = null;   // 지금 뜨는 공지 { content, link, updated_at } — 없으면 null

async function noticeCheckBadge() {
  var btn = document.getElementById('notice-open');
  if (!btn) return;

  const { data, error } = await sb.from('announcements')
    .select('content, link, updated_at').eq('school_id', SCHOOL_ID).maybeSingle();
  if (error) return;
  noticeCurrent = (data && data.content) ? data : null;

  var seenAt = null;
  try { seenAt = localStorage.getItem('noticeSeenAt'); } catch (e) { /* 사생활 보호 모드면 막힐 수 있습니다 */ }
  var dot = document.getElementById('notice-dot');
  if (dot) dot.hidden = !noticeCurrent || seenAt === noticeCurrent.updated_at;
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

  // 열어 봤다는 뜻으로 지금 공지를 «읽음» 처리합니다(배지만 없어집니다 — 내용은
  // 아래에서 계속 보실 수 있습니다).
  if (noticeCurrent && noticeCurrent.updated_at) {
    try { localStorage.setItem('noticeSeenAt', noticeCurrent.updated_at); } catch (e) { /* 위와 같습니다 */ }
    var dot = document.getElementById('notice-dot');
    if (dot) dot.hidden = true;
  }

  var nowHTML = noticeCurrent
    ? '<p class="prac-label">지금 공지</p>' +
      '<div class="' + noticeBoxClass() + '">' + esc(noticeCurrent.content).replace(/\n/g, '<br>') +
        noticeLinkHTML(noticeCurrent.link) + '</div>'
    : '<p class="prac-label">지금 공지</p><p class="prac-empty">지금 뜨는 공지가 없습니다.</p>';

  const { data, error } = await sb.from('announcement_log')
    .select('content, link, created_by_name, created_at')
    .eq('school_id', SCHOOL_ID).order('created_at', { ascending: false }).limit(30);

  var histHTML = '<p class="prac-label" style="margin-top:18px">지난 공지</p>';
  if (error) {
    histHTML += '<p class="prac-empty">지난 공지를 불러오지 못했습니다.</p>';
  } else if (!data || !data.length) {
    histHTML += '<p class="prac-empty">아직 올라온 공지가 없습니다.</p>';
  } else {
    histHTML += '<div class="notice-history">' + data.map(function (r) {
      var d = new Date(r.created_at);
      var when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      return '<div class="notice-history-row">' +
        '<div class="notice-history-when">' + when + (r.created_by_name ? ' · ' + esc(r.created_by_name) : '') + '</div>' +
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
