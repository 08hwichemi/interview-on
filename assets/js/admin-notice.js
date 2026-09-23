// 관리자 공지 관리 — admin/index.html 과 teacher/index.html(관리자에게만 보이는 단추)
// 둘 다 씁니다. 학생·교사 화면에 실제로 띄우는 쪽은 notice.js 입니다.
//
// announcements 표는 학교마다 한 줄뿐입니다(school_id 가 기본키) — «지금 뜨고 있는
// 공지» 딱 하나만 담습니다. 새로 올리거나 지우면 그 전 내용은 사라지므로,
// «무엇을 올렸었는지» 는 announcement_log 에 한 줄씩 따로 쌓아 둡니다(지우지 않는 기록).

async function openNoticeModal() {
  var overlay = document.getElementById('notice-modal-overlay');
  overlay.style.display = 'flex';
  document.getElementById('notice-content').value = '불러오는 중...';
  document.getElementById('notice-content').disabled = true;

  const { data, error } = await sb.from('announcements')
    .select('content, link').eq('school_id', SCHOOL_ID).maybeSingle();

  document.getElementById('notice-content').disabled = false;
  if (error) {
    document.getElementById('notice-content').value = '';
    document.getElementById('notice-link').value = '';
    renderNoticePreview();
    toast('공지를 불러오지 못했습니다: ' + error.message, 'bad');
    return;
  }
  document.getElementById('notice-content').value = (data && data.content) || '';
  document.getElementById('notice-link').value = (data && data.link) || '';
  renderNoticePreview();
  loadNoticeHistory();
}

function closeNoticeModal() {
  document.getElementById('notice-modal-overlay').style.display = 'none';
}

// 실제로 뜰 모양 그대로 미리 보여줍니다(줄바꿈·링크). notice.js 의 noticeCheck() 와
// 같은 규칙입니다 — 여기서는 저장 전 값이라 서버 없이 그 자리에서 그립니다.
function renderNoticePreview() {
  var box = document.getElementById('notice-preview');
  if (!box) return;
  var content = document.getElementById('notice-content').value.trim();
  var link = document.getElementById('notice-link').value.trim();
  if (!content) {
    box.innerHTML = '<span style="color:var(--ink-3)">내용을 입력하면 여기에 보여집니다.</span>';
    return;
  }
  var safeLink = link ? (/^https?:\/\//i.test(link) ? link : 'https://' + link) : '';
  box.innerHTML = esc(content).replace(/\n/g, '<br>') +
    (link ? '<br><a href="' + esc(safeLink) + '" target="_blank" rel="noopener">' + esc(link) + '</a>' : '');
}

// 지금 로그인한 사람 이름. admin/index.html 에는 myLoginId 가, teacher/index.html 에는
// me 가 있습니다 — 둘 다 대비합니다.
function noticeWhoAmI() {
  return (typeof myLoginId !== 'undefined' && myLoginId) ||
         (typeof me !== 'undefined' && me && me.name) || '';
}

async function saveNotice() {
  var content = document.getElementById('notice-content').value.trim();
  var link = document.getElementById('notice-link').value.trim();
  if (!content) { toast('공지 내용을 입력하세요.', 'bad'); return; }
  var who = noticeWhoAmI();

  const { error } = await sb.from('announcements').upsert({
    school_id: SCHOOL_ID, content: content, link: link || null, created_by_name: who
  }, { onConflict: 'school_id' });

  if (error) { toast('올리지 못했습니다: ' + error.message, 'bad'); return; }

  // 지금 뜨는 공지와는 별개로, «지난 공지» 에서 다시 볼 수 있게 한 줄 남깁니다.
  // 이 기록이 실패해도 공지 자체는 이미 올라갔으니 사용자에게는 알리지 않습니다.
  await sb.from('announcement_log').insert({
    school_id: SCHOOL_ID, content: content, link: link || null, created_by_name: who
  });

  toast('공지를 올렸습니다.');
  closeNoticeModal();
  // teacher/index.html 에는 머리말 🔔 단추(notice.js)가 같이 있습니다 — 안읽음 점을
  // 바로 갱신합니다. admin/index.html 에는 그 단추가 없어 이 함수 자체가 없습니다.
  if (typeof noticeCheckBadge === 'function') noticeCheckBadge();
}

async function clearNotice() {
  if (!confirm('지금 뜨고 있는 공지를 지울까요? (지난 공지 기록에는 남습니다)')) return;
  const { error } = await sb.from('announcements').delete().eq('school_id', SCHOOL_ID);
  if (error) { toast('지우지 못했습니다: ' + error.message, 'bad'); return; }
  document.getElementById('notice-content').value = '';
  document.getElementById('notice-link').value = '';
  renderNoticePreview();
  toast('공지를 지웠습니다.');
  closeNoticeModal();
  if (typeof noticeCheckBadge === 'function') noticeCheckBadge();
}

// ── 지난 공지 ── 최근 30개까지, 새 것부터.
async function loadNoticeHistory() {
  var box = document.getElementById('notice-history');
  if (!box) return;
  box.innerHTML = '<p class="hint">불러오는 중...</p>';

  const { data, error } = await sb.from('announcement_log')
    .select('content, link, created_by_name, created_at')
    .eq('school_id', SCHOOL_ID).order('created_at', { ascending: false }).limit(30);

  if (error) { box.innerHTML = '<p class="hint">지난 공지를 불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
  if (!data || !data.length) { box.innerHTML = '<p class="hint">아직 올린 공지가 없습니다.</p>'; return; }

  box.innerHTML = data.map(function (r) {
    var d = new Date(r.created_at);
    var when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var link = (r.link || '').trim();
    var safeLink = link ? (/^https?:\/\//i.test(link) ? link : 'https://' + link) : '';
    return '<div class="notice-history-row">' +
      '<div class="notice-history-when">' + when + (r.created_by_name ? ' · ' + esc(r.created_by_name) : '') + '</div>' +
      '<div class="notice-history-body">' + esc(r.content).replace(/\n/g, '<br>') +
        (link ? '<br><a href="' + esc(safeLink) + '" target="_blank" rel="noopener">' + esc(link) + '</a>' : '') +
      '</div></div>';
  }).join('');
}
