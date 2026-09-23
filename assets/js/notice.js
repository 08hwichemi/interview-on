// 관리자 공지 — 관리자 화면에서 올린 안내를 학생·교사 홈 화면에 보여줍니다.
//
// 학교마다 하나만 있습니다(announcements.school_id 가 기본키) — 관리자가 새로 올리면
// 그 한 자리를 덮어씁니다(그래서 «올리기» 도 «고치기» 도 그냥 upsert 한 번입니다).
// 닫으면 그 공지(updated_at 로 구분)는 이 기기에서 다시 안 뜹니다. 새 공지가 올라오면
// updated_at 이 달라지므로 다시 뜹니다.
//
// 학생 앱(index.html)과 교사 화면(teacher/index.html)이 함께 씁니다.
// esc() · sb · SCHOOL_ID 는 report.js · config.js 가 먼저 실어 둡니다.

async function noticeCheck() {
  var box = document.getElementById('notice-box');
  if (!box) return;

  const { data, error } = await sb.from('announcements')
    .select('content, link, updated_at').eq('school_id', SCHOOL_ID).maybeSingle();
  if (error || !data || !data.content) { box.hidden = true; return; }

  var dismissedAt = null;
  try { dismissedAt = localStorage.getItem('noticeDismissedAt'); } catch (e) { /* 사생활 보호 모드면 막힐 수 있습니다 */ }
  if (dismissedAt === data.updated_at) { box.hidden = true; return; }

  box.innerHTML = '<button type="button" class="notice-x" aria-label="닫기" onclick="noticeDismiss(\'' +
      data.updated_at + '\')">&times;</button>' +
    '<div class="notice-body">' + esc(data.content).replace(/\n/g, '<br>') +
    (data.link ? '<br><a href="' + noticeSafeLink(data.link) + '" target="_blank" rel="noopener">' +
      esc(data.link) + '</a>' : '') +
    '</div>';
  box.hidden = false;
}

// javascript: 같은 위험한 스킴을 막고, http(s) 가 아니면 https:// 를 붙여 줍니다.
// (공지는 관리자만 쓸 수 있지만, 그래도 링크는 한 번 다듬어 둡니다)
function noticeSafeLink(url) {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return esc(url);
}

function noticeDismiss(updatedAt) {
  try { localStorage.setItem('noticeDismissedAt', updatedAt); } catch (e) { /* 위와 같습니다 */ }
  var box = document.getElementById('notice-box');
  if (box) box.hidden = true;
}

var noticeWatchOn = false;
function noticeWatch() {
  if (noticeWatchOn) return;
  noticeWatchOn = true;
  noticeCheck();
  try {
    sb.channel('school-announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, function () { noticeCheck(); })
      .subscribe();
  } catch (e) { console.warn('공지 실시간 알림을 켜지 못했습니다:', e); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) noticeCheck(); });
}
