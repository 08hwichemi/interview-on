// 관리자 공지 관리 — admin/index.html 과 teacher/index.html(관리자에게만 보이는 단추)
// 둘 다 씁니다. 학생·교사 화면에 실제로 띄우는 쪽은 notice.js 입니다.
//
// announcements 표는 학교마다 한 줄뿐입니다(school_id 가 기본키) — «지금 뜨고 있는
// 공지» 딱 하나만 담습니다. 새로 올리거나 지우면 그 전 내용은 사라지므로,
// «무엇을 올렸었는지» 는 announcement_log 에 한 줄씩 따로 쌓아 둡니다. 이 기록도
// 관리자가 줄마다 고치거나 지울 수 있습니다(잘못 올린 걸 나중에 바로잡으려는 용도) —
// 다만 지금 뜨는 공지와는 별개라, 여기서 고쳐도 이미 뜬 배너는 안 바뀝니다.

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

// ── 지난 공지 ── 최근 30개까지, 새 것부터. 관리자는 여기서 개별 줄을 고치거나
// 지울 수 있습니다(실수로 잘못 올린 것을 나중에 확인하다 바로잡으려는 용도) —
// 지금 뜨는 공지(announcements)와는 별개라, 여기서 고쳐도 이미 뜬 배너는 안 바뀝니다.
var noticeHistoryRows = {};   // id -> {content, link} — 수정 창을 원래 값으로 채우려고 기억해 둡니다

async function loadNoticeHistory() {
  var box = document.getElementById('notice-history');
  if (!box) return;
  box.innerHTML = '<p class="hint">불러오는 중...</p>';

  const { data, error } = await sb.from('announcement_log')
    .select('id, content, link, created_by_name, created_at')
    .eq('school_id', SCHOOL_ID).order('created_at', { ascending: false }).limit(30);

  if (error) { box.innerHTML = '<p class="hint">지난 공지를 불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
  if (!data || !data.length) { box.innerHTML = '<p class="hint">아직 올린 공지가 없습니다.</p>'; return; }

  noticeHistoryRows = {};
  data.forEach(function (r) { noticeHistoryRows[r.id] = { content: r.content, link: r.link || '' }; });

  box.innerHTML = data.map(function (r) {
    var d = new Date(r.created_at);
    var when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var link = (r.link || '').trim();
    var safeLink = link ? (/^https?:\/\//i.test(link) ? link : 'https://' + link) : '';
    return '<div class="notice-history-row" data-id="' + r.id + '">' +
      '<div class="notice-history-when">' + when + (r.created_by_name ? ' · ' + esc(r.created_by_name) : '') + '</div>' +
      '<div class="notice-history-body" id="nh-view-' + r.id + '">' + esc(r.content).replace(/\n/g, '<br>') +
        (link ? '<br><a href="' + esc(safeLink) + '" target="_blank" rel="noopener">' + esc(link) + '</a>' : '') +
      '</div>' +
      '<div class="notice-history-edit" id="nh-edit-' + r.id + '" hidden>' +
        '<textarea id="nh-content-' + r.id + '"></textarea>' +
        '<input type="text" id="nh-link-' + r.id + '" placeholder="링크(선택)">' +
        '<div class="notice-history-acts">' +
          '<button class="linkbtn" onclick="noticeHistorySave(\'' + r.id + '\')">저장</button>' +
          '<button class="linkbtn" onclick="noticeHistoryCancelEdit(\'' + r.id + '\')">취소</button>' +
        '</div>' +
      '</div>' +
      '<div class="notice-history-acts" id="nh-acts-' + r.id + '">' +
        '<button class="linkbtn" onclick="noticeHistoryStartEdit(\'' + r.id + '\')">수정</button>' +
        '<button class="linkbtn danger" onclick="noticeHistoryDelete(\'' + r.id + '\')">지우기</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function noticeHistoryStartEdit(id) {
  var row = noticeHistoryRows[id];
  if (!row) return;
  document.getElementById('nh-content-' + id).value = row.content;
  document.getElementById('nh-link-' + id).value = row.link;
  document.getElementById('nh-view-' + id).hidden = true;
  document.getElementById('nh-acts-' + id).hidden = true;
  document.getElementById('nh-edit-' + id).hidden = false;
}

function noticeHistoryCancelEdit(id) {
  document.getElementById('nh-edit-' + id).hidden = true;
  document.getElementById('nh-view-' + id).hidden = false;
  document.getElementById('nh-acts-' + id).hidden = false;
}

async function noticeHistorySave(id) {
  var content = document.getElementById('nh-content-' + id).value.trim();
  var link = document.getElementById('nh-link-' + id).value.trim();
  if (!content) { toast('내용을 입력하세요.', 'bad'); return; }

  const { error } = await sb.from('announcement_log')
    .update({ content: content, link: link || null }).eq('id', id);
  if (error) { toast('고치지 못했습니다: ' + error.message, 'bad'); return; }

  toast('지난 공지를 고쳤습니다.');
  loadNoticeHistory();
}

async function noticeHistoryDelete(id) {
  if (!confirm('이 지난 공지 기록을 완전히 지울까요? 되돌릴 수 없습니다.')) return;
  const { error } = await sb.from('announcement_log').delete().eq('id', id);
  if (error) { toast('지우지 못했습니다: ' + error.message, 'bad'); return; }
  toast('지난 공지를 지웠습니다.');
  loadNoticeHistory();
}
