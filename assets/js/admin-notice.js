// 관리자 공지 관리 — admin/index.html 전용.
//
// announcements 표는 학교마다 한 줄뿐입니다(school_id 가 기본키). 그래서 «올리기» 도
// «고치기» 도 늘 upsert 한 번입니다. 학생·교사 화면에 실제로 띄우는 쪽은 notice.js 입니다.

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
    toast('공지를 불러오지 못했습니다: ' + error.message, 'bad');
    return;
  }
  document.getElementById('notice-content').value = (data && data.content) || '';
  document.getElementById('notice-link').value = (data && data.link) || '';
}

function closeNoticeModal() {
  document.getElementById('notice-modal-overlay').style.display = 'none';
}

async function saveNotice() {
  var content = document.getElementById('notice-content').value.trim();
  var link = document.getElementById('notice-link').value.trim();
  if (!content) { toast('공지 내용을 입력하세요.', 'bad'); return; }

  const { error } = await sb.from('announcements').upsert({
    school_id: SCHOOL_ID, content: content, link: link || null,
    created_by_name: myLoginId || ''
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
  toast('공지를 지웠습니다.');
  closeNoticeModal();
}
