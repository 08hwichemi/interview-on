// 관리자 공지 관리 — admin/index.html 과 teacher/index.html(관리자에게만 보이는 단추)
// 둘 다 씁니다. 학생·교사 화면에 실제로 띄우는 쪽은 notice.js 입니다.
//
// announcements 표 하나에 모든 공지가 쌓이고, active 표시로 «지금 뜨는 줄» 딱
// 하나만 가립니다(교체하면 이전 것은 자동으로 꺼집니다).
//   - 위 입력칸은 «완전히 새로운 내용을 쓸 때» 만 씁니다 → 「새 공지로 올리기」
//     누르면 새 줄이 생기고 그 줄이 active 가 됩니다.
//   - 아래 「지난 공지」목록의 각 줄에는 «수정»(그 줄 내용만 그 자리에서 고침 —
//     active 줄이면 배너도 바로 바뀝니다) · «공지로 올리기»(내용은 그대로 두고
//     이 줄을 active 로만 바꿈 — 예전 공지를 다시 띄울 때) · «지우기»(완전 삭제)
//     가 있습니다. «수정»과 «공지로 올리기»를 일부러 나눴습니다 — 둘 다 한 버튼
//     이면, 지금 뜨는 걸 고치기만 해도 되는지 새로 발행해야 하는지 헷갈렸습니다.

async function openNoticeModal() {
  var overlay = document.getElementById('notice-modal-overlay');
  overlay.style.display = 'flex';
  document.getElementById('notice-content').value = '';
  document.getElementById('notice-link').value = '';
  renderNoticePreview();
  loadNoticeHistory();
}

function closeNoticeModal() {
  document.getElementById('notice-modal-overlay').style.display = 'none';
}

// 실제로 뜰 모양 그대로 미리 보여줍니다(줄바꿈·링크). notice.js 의 noticeLinkHTML() 과
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

// teacher/index.html 에는 머리말 🔔 단추(notice.js)가 같이 있습니다 — 안읽음 점을
// 바로 갱신합니다. admin/index.html 에는 그 단추가 없어 이 함수 자체가 없습니다.
function noticeRefreshBell() {
  if (typeof noticeCheckBadge === 'function') noticeCheckBadge();
}

// ── 새 공지로 올리기 ──
async function postNewNotice() {
  var content = document.getElementById('notice-content').value.trim();
  var link = document.getElementById('notice-link').value.trim();
  if (!content) { toast('공지 내용을 입력하세요.', 'bad'); return; }
  var who = noticeWhoAmI();

  const cur = await sb.from('announcements').update({ active: false })
    .eq('school_id', SCHOOL_ID).eq('active', true);
  if (cur.error) { toast('올리지 못했습니다: ' + cur.error.message, 'bad'); return; }

  const { error } = await sb.from('announcements').insert({
    school_id: SCHOOL_ID, content: content, link: link || null, created_by_name: who, active: true
  });
  if (error) { toast('올리지 못했습니다: ' + error.message, 'bad'); return; }

  document.getElementById('notice-content').value = '';
  document.getElementById('notice-link').value = '';
  renderNoticePreview();
  toast('새 공지를 올렸습니다.');
  loadNoticeHistory();
  noticeRefreshBell();
}

// ── 지금 공지 끄기 — 기록은 남기고 배너만 끕니다 ──
async function turnOffNotice() {
  if (!confirm('지금 뜨고 있는 공지를 끌까요? (기록은 「지난 공지」에 그대로 남습니다)')) return;
  const { error } = await sb.from('announcements').update({ active: false })
    .eq('school_id', SCHOOL_ID).eq('active', true);
  if (error) { toast('끄지 못했습니다: ' + error.message, 'bad'); return; }
  toast('공지를 껐습니다.');
  loadNoticeHistory();
  noticeRefreshBell();
}

// ── 지난 공지 목록 ── 최근 30개까지, 새 것부터. 지금 뜨는 줄도 여기 함께 있습니다.
var noticeHistoryRows = {};   // id -> {content, link} — 수정 칸을 원래 값으로 채우려고 기억해 둡니다

async function loadNoticeHistory() {
  var box = document.getElementById('notice-history');
  if (!box) return;
  box.innerHTML = '<p class="hint">불러오는 중...</p>';

  const { data, error } = await sb.from('announcements')
    .select('id, content, link, active, created_by_name, created_at')
    .eq('school_id', SCHOOL_ID).order('created_at', { ascending: false }).limit(30);

  if (error) { box.innerHTML = '<p class="hint">지난 공지를 불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }

  document.getElementById('btn-notice-off').disabled = !(data || []).some(function (r) { return r.active; });

  if (!data || !data.length) { box.innerHTML = '<p class="hint">아직 올린 공지가 없습니다.</p>'; return; }

  noticeHistoryRows = {};
  data.forEach(function (r) { noticeHistoryRows[r.id] = { content: r.content, link: r.link || '' }; });

  box.innerHTML = data.map(function (r) {
    var d = new Date(r.created_at);
    var when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var link = (r.link || '').trim();
    var safeLink = link ? (/^https?:\/\//i.test(link) ? link : 'https://' + link) : '';
    return '<div class="notice-history-row' + (r.active ? ' active' : '') + '" data-id="' + r.id + '">' +
      '<div class="notice-history-when">' + when + (r.created_by_name ? ' · ' + esc(r.created_by_name) : '') +
        (r.active ? ' · <b>지금 뜨는 중</b>' : '') + '</div>' +
      '<div class="notice-history-body" id="nh-view-' + r.id + '">' + esc(r.content).replace(/\n/g, '<br>') +
        (link ? '<br><a href="' + esc(safeLink) + '" target="_blank" rel="noopener">' + esc(link) + '</a>' : '') +
      '</div>' +
      '<div class="notice-history-edit" id="nh-edit-' + r.id + '" hidden>' +
        '<textarea id="nh-content-' + r.id + '"></textarea>' +
        '<input type="text" id="nh-link-' + r.id + '" placeholder="링크(선택)">' +
        '<div class="notice-history-acts">' +
          '<button class="linkbtn" onclick="noticeRowSaveEdit(\'' + r.id + '\')">저장</button>' +
          '<button class="linkbtn" onclick="noticeRowCancelEdit(\'' + r.id + '\')">취소</button>' +
        '</div>' +
      '</div>' +
      '<div class="notice-history-acts" id="nh-acts-' + r.id + '">' +
        '<button class="linkbtn" onclick="noticeRowStartEdit(\'' + r.id + '\')">수정</button>' +
        (r.active ? '' : '<button class="linkbtn" onclick="noticeRowActivate(\'' + r.id + '\')">📢 공지로 올리기</button>') +
        '<button class="linkbtn danger" onclick="noticeRowDelete(\'' + r.id + '\')">지우기</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function noticeRowStartEdit(id) {
  var row = noticeHistoryRows[id];
  if (!row) return;
  document.getElementById('nh-content-' + id).value = row.content;
  document.getElementById('nh-link-' + id).value = row.link;
  document.getElementById('nh-view-' + id).hidden = true;
  document.getElementById('nh-acts-' + id).hidden = true;
  document.getElementById('nh-edit-' + id).hidden = false;
}

function noticeRowCancelEdit(id) {
  document.getElementById('nh-edit-' + id).hidden = true;
  document.getElementById('nh-view-' + id).hidden = false;
  document.getElementById('nh-acts-' + id).hidden = false;
}

// 그 줄 내용만 그 자리에서 고칩니다 — 새 줄은 안 생깁니다. active 인 줄이면
// 이 저장 한 번으로 배너도 바로 바뀝니다(같은 줄이니까).
async function noticeRowSaveEdit(id) {
  var content = document.getElementById('nh-content-' + id).value.trim();
  var link = document.getElementById('nh-link-' + id).value.trim();
  if (!content) { toast('내용을 입력하세요.', 'bad'); return; }

  const { error } = await sb.from('announcements')
    .update({ content: content, link: link || null }).eq('id', id);
  if (error) { toast('고치지 못했습니다: ' + error.message, 'bad'); return; }

  toast('고쳤습니다.');
  loadNoticeHistory();
  noticeRefreshBell();
}

// 내용은 그대로 두고, 이 줄만 지금 공지(active)로 바꿉니다 — 예전 공지를 다시 띄울 때.
async function noticeRowActivate(id) {
  const off = await sb.from('announcements').update({ active: false })
    .eq('school_id', SCHOOL_ID).eq('active', true);
  if (off.error) { toast('올리지 못했습니다: ' + off.error.message, 'bad'); return; }

  const { error } = await sb.from('announcements').update({ active: true }).eq('id', id);
  if (error) { toast('올리지 못했습니다: ' + error.message, 'bad'); return; }

  toast('지금 공지로 올렸습니다.');
  loadNoticeHistory();
  noticeRefreshBell();
}

async function noticeRowDelete(id) {
  if (!confirm('이 기록을 완전히 지울까요? 되돌릴 수 없습니다.')) return;
  const { error } = await sb.from('announcements').delete().eq('id', id);
  if (error) { toast('지우지 못했습니다: ' + error.message, 'bad'); return; }
  toast('지웠습니다.');
  loadNoticeHistory();
  noticeRefreshBell();
}
