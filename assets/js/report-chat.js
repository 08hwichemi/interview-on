// 리포트에 딸린 이야기 — 학생 ↔ 선생님
//
// 학생이 리포트를 보다가 «이 평가는 무슨 뜻인가요?» 하고 물으면
// 그 리포트를 써 준 선생님이 답합니다. 리포트마다 따로 쌓입니다.
//
// 학생 앱과 교사 화면이 같은 이 파일을 씁니다.
// report.js 보다 나중에, 각 화면 코드보다 먼저 불러야 합니다.
//
// 누가 무엇을 할 수 있는지는 서버(RLS)가 정합니다.
//   학생   — «전달됨» 인 자기 리포트만 읽고, 자기 이름으로만 씁니다
//   선생님 — 우리 학교 면접에 달린 이야기를 읽고 씁니다

var chatInterviewId = null;   // 지금 열어 둔 이야기
var chatMessages = [];
var chatBoxId = null;         // 이야기를 그릴 칸의 id
var chatChannel = null;

// 나는 누구인가 — 학생 앱은 currentUser, 교사 화면은 me 를 씁니다.
function chatWho() {
  if (typeof currentUser !== 'undefined' && currentUser) {
    return { id: currentUser.id,
             role: currentUser.role === 'student' ? 'student' : 'teacher',
             name: currentUser.name || currentUser.login_id || '' };
  }
  if (typeof me !== 'undefined' && me) {
    return { id: me.id, role: 'teacher', name: me.name || '' };
  }
  return null;
}

function chatTime(iso) {
  var d = new Date(iso), h = d.getHours(), m = d.getMinutes();
  var ampm = h < 12 ? '오전' : '오후';
  var hh = h % 12; if (hh === 0) hh = 12;
  return ampm + ' ' + hh + ':' + (m < 10 ? '0' + m : m);
}

function chatDay(iso) {
  var d = new Date(iso);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

// ── 그리기 ──
function renderChat() {
  var box = document.getElementById(chatBoxId);
  if (!box) return;
  var who = chatWho();
  if (!who) return;

  if (!chatMessages.length) {
    box.innerHTML = '<p class="chat-empty">' +
      (who.role === 'student'
        ? '리포트를 보다가 궁금한 것이 있으면 물어보세요.<br>선생님께 그대로 전해집니다.'
        : '아직 오간 이야기가 없습니다.') + '</p>';
    return;
  }

  var lastDay = '';
  box.innerHTML = chatMessages.map(function (m) {
    var mine = (m.sender_id === who.id);
    var day = chatDay(m.created_at);
    var sep = '';
    if (day !== lastDay) {
      lastDay = day;
      sep = '<p class="chat-day">' + esc(day) + '</p>';
    }
    return sep +
      '<div class="chat-row' + (mine ? ' mine' : '') + '">' +
        (mine ? '' : '<span class="chat-name">' + esc(m.sender_name || '상대') +
                     (m.sender_role === 'teacher' ? ' 선생님' : '') + '</span>') +
        '<div class="chat-line">' +
          '<div class="chat-bubble">' + esc(m.body).replace(/\n/g, '<br>') + '</div>' +
          '<span class="chat-when">' + chatTime(m.created_at) + '</span>' +
        '</div>' +
      '</div>';
  }).join('');

  box.scrollTop = box.scrollHeight;   // 늘 마지막 말이 보이게
}

// ── 열기 ──
// boxId  이야기를 그릴 칸, inputId 글 쓰는 칸
async function openChat(interviewId, boxId) {
  chatInterviewId = interviewId;
  chatBoxId = boxId;
  chatMessages = [];

  var box = document.getElementById(boxId);
  if (box) box.innerHTML = '<p class="chat-empty">불러오는 중...</p>';

  await reloadChat();
  watchChat();
}

async function reloadChat() {
  if (!chatInterviewId) return;
  const { data, error } = await sb
    .from('report_messages')
    .select('id, sender_id, sender_role, sender_name, body, created_at')
    .eq('interview_id', chatInterviewId)
    .order('created_at');

  if (error) {
    var box = document.getElementById(chatBoxId);
    if (box) box.innerHTML = '<p class="chat-empty">이야기를 못 읽었습니다.<br>' +
      esc(error.message) + '</p>';
    return;
  }
  chatMessages = data || [];
  renderChat();
}

// 상대가 답하면 바로 뜨게 합니다. 실시간이 막혀 있어도
// 화면을 다시 볼 때 한 번 더 확인하므로 놓치지 않습니다.
function watchChat() {
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch (e) { /* 이미 닫혔습니다 */ } }
  try {
    chatChannel = sb.channel('chat-' + chatInterviewId)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'report_messages',
            filter: 'interview_id=eq.' + chatInterviewId },
          function () { reloadChat(); })
      .subscribe();
  } catch (e) {
    chatChannel = null;   // 아래 visibilitychange 로도 충분합니다
  }
}

function closeChat() {
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch (e) { /* 이미 닫혔습니다 */ } }
  chatChannel = null;
  chatInterviewId = null;
}

// ── 보내기 ──
async function sendChat(inputId, btnId) {
  var input = document.getElementById(inputId);
  var body = (input.value || '').trim();
  if (!body || !chatInterviewId) return;

  var who = chatWho();
  if (!who) return;

  var btn = btnId && document.getElementById(btnId);
  if (btn) btn.disabled = true;

  const { error } = await sb.from('report_messages').insert({
    interview_id: chatInterviewId,
    sender_id: who.id,
    sender_role: who.role,
    sender_name: who.name,
    body: body
  });

  if (btn) btn.disabled = false;

  if (error) {
    // 쓴 글은 지우지 않습니다. 다시 누르면 그대로 보낼 수 있어야 합니다.
    if (typeof toast === 'function') toast('보내지 못했습니다: ' + error.message, 'bad');
    else if (typeof showToast === 'function') showToast('보내지 못했습니다.\n' + error.message, 'error');
    return;
  }

  input.value = '';
  autoGrow(input);
  await reloadChat();
}

// 엔터로 보내고, 줄바꿈은 Shift+엔터.
function chatKey(e, inputId, btnId) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat(inputId, btnId);
  }
}

// 여러 줄을 쓰면 칸이 같이 늘어납니다 (최대 5줄쯤).
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
