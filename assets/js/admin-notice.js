// 관리자 공지 관리 — admin/index.html 과 teacher/index.html(관리자에게만 보이는 단추)
// 둘 다 씁니다. 학생·교사 화면에 실제로 띄우는 쪽은 notice.js 입니다.
//
// announcements 표는 학교마다 한 줄뿐입니다(school_id 가 기본키). 그래서 «올리기» 도
// «고치기» 도 늘 upsert 한 번입니다.

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

async function saveNotice() {
  var content = document.getElementById('notice-content').value.trim();
  var link = document.getElementById('notice-link').value.trim();
  if (!content) { toast('공지 내용을 입력하세요.', 'bad'); return; }

  // admin/index.html 에는 myLoginId 가, teacher/index.html 에는 me 가 있습니다 — 둘 다 대비합니다.
  var who = (typeof myLoginId !== 'undefined' && myLoginId) ||
            (typeof me !== 'undefined' && me && me.name) || '';

  const { error } = await sb.from('announcements').upsert({
    school_id: SCHOOL_ID, content: content, link: link || null, created_by_name: who
  }, { onConflict: 'school_id' });

  if (error) { toast('올리지 못했습니다: ' + error.message, 'bad'); return; }
  toast('공지를 올렸습니다.');
  closeNoticeModal();
}

async function clearNotice() {
  if (!confirm('지금 뜨고 있는 공지를 지울까요?')) return;
  const { error } = await sb.from('announcements').delete().eq('school_id', SCHOOL_ID);
  if (error) { toast('지우지 못했습니다: ' + error.message, 'bad'); return; }
  document.getElementById('notice-content').value = '';
  document.getElementById('notice-link').value = '';
  renderNoticePreview();
  toast('공지를 지웠습니다.');
  closeNoticeModal();
}
