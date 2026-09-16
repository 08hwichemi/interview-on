// 톡 — 학생과 선생님의 1:1 대화
//
// 이동수업 출석부 앱(부광고톡)과 같은 구조입니다.
//   ① 화면 위 「💬 톡」 단추 (안 읽은 수가 빨갛게 붙습니다)
//   ② 톡 목록 창 — «새로운 대화 시작하기» + «내 대화방 목록»
//   ③ 대화방 창 — 말풍선, 안 읽음 「1」, 아래 입력칸
//
// 방 번호는 두 사람 아이디를 정렬해 붙여 만듭니다.
// 누가 먼저 말을 걸든 늘 같은 방으로 들어갑니다.
//
// 학생 앱과 교사 화면이 같은 이 파일을 씁니다.

var chatMe = null;          // { id, role, name }
var chatRooms = [];         // 내 대화방 목록
var chatPartners = [];      // 말을 걸 수 있는 상대 (학생→선생님 / 교사→학생)
var chatRoomId = null;      // 지금 열어 둔 방
var chatPartner = null;     // { id, name }
var chatMsgs = [];
var chatListChannel = null;
var chatRoomChannel = null;
var chatPickedPartner = null;

function roomIdOf(a, b) {
  return [String(a), String(b)].sort().join('_');
}

// ══════════════ 시작하기 ══════════════
//
// 로그인이 끝난 뒤 한 번 부릅니다.
// who = { id, role:'student'|'teacher', name }
async function startChat(who) {
  chatMe = who;
  await loadPartners();
  await loadChatRooms();
  watchChatList();
}

// 말을 걸 수 있는 사람들.
//   학생 → 우리 학교 선생님 (teacher_directory 가 이름만 보여줍니다)
//   선생님 → 우리 학교 학생
async function loadPartners() {
  if (!chatMe) return;

  if (chatMe.role === 'student') {
    const { data, error } = await sb.from('teacher_directory').select('id, name').order('name');
    if (error) { console.warn('선생님 목록을 못 읽었습니다:', error.message); return; }
    chatPartners = (data || []).map(function (t) {
      return { id: t.id, name: (t.name || '') + ' 선생님', sort: t.name || '' };
    });
    return;
  }

  // 선생님 화면 — 학번과 이름으로 고릅니다. 계정이 없는 학생은 뺍니다.
  const { data, error } = await sb.from('students')
    .select('auth_user_id, student_no, name').order('student_no');
  if (error) { console.warn('학생 목록을 못 읽었습니다:', error.message); return; }
  chatPartners = (data || [])
    .filter(function (s) { return s.auth_user_id; })
    .map(function (s) {
      return { id: s.auth_user_id, name: s.student_no + ' ' + s.name, sort: String(s.student_no) };
    });
}

// ══════════════ 대화방 목록 ══════════════
//
// 주고받은 말을 훑어 «방마다 마지막 한 마디 + 안 읽은 수» 로 접습니다.
async function loadChatRooms() {
  if (!chatMe) return;

  const { data, error } = await sb.from('chats')
    .select('*')
    .or('sender_id.eq.' + chatMe.id + ',receiver_id.eq.' + chatMe.id)
    .order('created_at', { ascending: false });
  if (error) { console.warn('대화방을 못 읽었습니다:', error.message); return; }

  var byRoom = {};
  (data || []).forEach(function (m) {
    var mine = (m.sender_id === chatMe.id);
    if (!byRoom[m.room_id]) {
      byRoom[m.room_id] = {
        roomId: m.room_id,
        partnerId: mine ? m.receiver_id : m.sender_id,
        // 상대가 보낸 말에만 상대 이름이 적혀 있습니다.
        // 내가 먼저 걸었다면 아래에서 아는 사람 목록으로 채웁니다.
        partnerName: mine ? '' : (m.sender_name || ''),
        lastMessage: m.content,
        lastTime: m.created_at,
        unread: 0
      };
    }
    if (!byRoom[m.room_id].partnerName && !mine) byRoom[m.room_id].partnerName = m.sender_name || '';
    if (m.receiver_id === chatMe.id && !m.is_read) byRoom[m.room_id].unread++;
  });

  chatRooms = Object.keys(byRoom).map(function (k) { return byRoom[k]; });
  chatRooms.forEach(function (r) {
    // 아는 사람이면 그 이름을 씁니다. 말에 적힌 이름은 «이용휘» 처럼 맨이름이라
    // 학생 화면에서 «이용휘 선생님» 으로 보이지 않았습니다.
    var p = chatPartners.filter(function (x) { return x.id === r.partnerId; })[0];
    if (p) r.partnerName = p.name;
    else if (!r.partnerName) r.partnerName = '상대';
  });

  paintChatBadge();
  if (isChatListOpen()) renderChatRooms();
}

function chatUnreadTotal() {
  return chatRooms.reduce(function (n, r) { return n + r.unread; }, 0);
}

function paintChatBadge() {
  var el = document.getElementById('chat-badge');
  if (!el) return;
  var n = chatUnreadTotal();
  el.textContent = n;
  el.hidden = (n === 0);
}

// 누가 말을 걸면 바로 알아채도록.
// 실시간이 조용히 끊기는 일이 있어서 화면을 다시 볼 때도 한 번 더 확인합니다.
function watchChatList() {
  if (chatListChannel) return;
  try {
    chatListChannel = sb.channel('chat-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' },
          function (payload) {
            var m = payload.new || payload.old;
            if (!m) return;
            if (m.sender_id === chatMe.id || m.receiver_id === chatMe.id) loadChatRooms();
          })
      .subscribe();
  } catch (e) {
    chatListChannel = null;
  }
  setInterval(loadChatRooms, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) loadChatRooms();
  });
}

// ══════════════ 톡 목록 창 ══════════════

function isChatListOpen() {
  var el = document.getElementById('chat-list-modal');
  return el && el.style.display === 'flex';
}

function openChatList() {
  chatPickedPartner = null;
  document.getElementById('chat-list-modal').style.display = 'flex';
  renderChatPartners();
  renderChatRooms();
  loadChatRooms();
}

function closeChatList() {
  document.getElementById('chat-list-modal').style.display = 'none';
}

function renderChatPartners() {
  var box = document.getElementById('chat-partners');
  if (!box) return;
  if (!chatPartners.length) {
    box.innerHTML = '<p class="chat-none">말을 걸 수 있는 사람이 없습니다.</p>';
    return;
  }
  box.innerHTML = chatPartners.map(function (p) {
    return '<button class="chat-pick" aria-pressed="' + (chatPickedPartner === p.id) + '"' +
           ' onclick="pickChatPartner(\'' + p.id + '\')">' + esc(p.name) + '</button>';
  }).join('');
  var btn = document.getElementById('chat-start-btn');
  var picked = chatPartners.filter(function (p) { return p.id === chatPickedPartner; })[0];
  btn.disabled = !picked;
  btn.textContent = picked ? picked.name + '과 대화 시작' : '상대를 먼저 고르세요';
}

function pickChatPartner(id) {
  chatPickedPartner = (chatPickedPartner === id) ? null : id;
  renderChatPartners();
}

function startPickedChat() {
  var p = chatPartners.filter(function (x) { return x.id === chatPickedPartner; })[0];
  if (!p) return;
  closeChatList();
  openChatRoom(p.id, p.name);
}

// 방 목록을 한 줄씩. 마지막 한 마디와 안 읽은 수가 같이 보입니다.
function renderChatRooms() {
  var box = document.getElementById('chat-rooms');
  if (!box) return;
  if (!chatRooms.length) {
    box.innerHTML = '<p class="chat-none">아직 진행 중인 대화가 없습니다.</p>';
    return;
  }
  box.innerHTML = chatRooms.map(function (r) {
    var d = new Date(r.lastTime);
    return '<button class="chat-room" onclick="openChatRoom(\'' + r.partnerId + '\', \'' +
             esc(r.partnerName).replace(/'/g, '&#39;') + '\')">' +
      '<span class="chat-face">' + (chatMe.role === 'student' ? '👩‍🏫' : '🧑‍🎓') + '</span>' +
      '<span class="chat-room-body">' +
        '<span class="chat-room-top">' +
          '<b>' + esc(r.partnerName) + '</b>' +
          '<span class="chat-room-when">' + (d.getMonth() + 1) + '. ' + d.getDate() + '</span>' +
        '</span>' +
        '<span class="chat-room-bot">' +
          '<span class="chat-last">' + esc(r.lastMessage) + '</span>' +
          (r.unread ? '<span class="chat-new">' + r.unread + '</span>' : '') +
        '</span>' +
      '</span></button>';
  }).join('');
}

// ══════════════ 대화방 창 ══════════════

async function openChatRoom(partnerId, partnerName) {
  if (!chatMe) return;
  chatPartner = { id: partnerId, name: partnerName };
  chatRoomId = roomIdOf(chatMe.id, partnerId);
  chatMsgs = [];

  document.getElementById('chat-room-who').textContent = partnerName;
  document.getElementById('chat-room-modal').style.display = 'flex';
  document.getElementById('chat-body').innerHTML = '<p class="chat-none">불러오는 중...</p>';

  // 방에 들어왔으니 «상대가 나에게 보낸» 안 읽은 말부터 읽음으로 바꿉니다.
  await sb.from('chats').update({ is_read: true })
    .eq('room_id', chatRoomId).eq('receiver_id', chatMe.id).eq('is_read', false);

  await reloadChatRoom();
  watchChatRoom();
  loadChatRooms();
  setTimeout(function () {
    var el = document.getElementById('chat-input');
    if (el) el.focus();
  }, 150);
}

async function reloadChatRoom() {
  if (!chatRoomId) return;
  const { data, error } = await sb.from('chats')
    .select('*').eq('room_id', chatRoomId).order('created_at');
  if (error) {
    document.getElementById('chat-body').innerHTML =
      '<p class="chat-none">대화를 못 읽었습니다.<br>' + esc(error.message) + '</p>';
    return;
  }
  chatMsgs = data || [];
  renderChatRoom();
}

function chatTime(iso) {
  var d = new Date(iso), h = d.getHours(), m = d.getMinutes();
  var hh = h % 12; if (hh === 0) hh = 12;
  return (h < 12 ? '오전 ' : '오후 ') + hh + ':' + (m < 10 ? '0' + m : m);
}

function chatDay(iso) {
  var d = new Date(iso);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

function renderChatRoom() {
  var box = document.getElementById('chat-body');
  if (!box) return;

  if (!chatMsgs.length) {
    box.innerHTML = '<p class="chat-none">' +
      (chatMe.role === 'student'
        ? '궁금한 것을 물어보세요.<br>선생님께 그대로 전해집니다.'
        : '아직 오간 말이 없습니다.') + '</p>';
    return;
  }

  var lastDay = '';
  box.innerHTML = chatMsgs.map(function (m) {
    var mine = (m.sender_id === chatMe.id);
    var day = chatDay(m.created_at);
    var sep = '';
    if (day !== lastDay) { lastDay = day; sep = '<p class="chat-day">' + esc(day) + '</p>'; }
    return sep +
      '<div class="chat-row' + (mine ? ' mine' : '') + '">' +
        '<div class="chat-bubble">' + esc(m.content).replace(/\n/g, '<br>') + '</div>' +
        '<span class="chat-meta">' +
          // 내가 보낸 말을 상대가 아직 안 읽었으면 「1」이 붙습니다
          (mine && !m.is_read ? '<b class="chat-1">1</b>' : '') +
          '<span class="chat-when">' + chatTime(m.created_at) + '</span>' +
        '</span>' +
      '</div>';
  }).join('');

  box.scrollTop = box.scrollHeight;
}

function watchChatRoom() {
  if (chatRoomChannel) { try { sb.removeChannel(chatRoomChannel); } catch (e) { /* 이미 닫힘 */ } }
  try {
    chatRoomChannel = sb.channel('chat-room-' + chatRoomId)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'chats', filter: 'room_id=eq.' + chatRoomId },
          async function (payload) {
            // 상대가 보낸 말은 보는 즉시 읽음으로 바꿉니다
            if (payload.eventType === 'INSERT' && payload.new.receiver_id === chatMe.id) {
              await sb.from('chats').update({ is_read: true }).eq('id', payload.new.id);
            }
            reloadChatRoom();
            loadChatRooms();
          })
      .subscribe();
  } catch (e) {
    chatRoomChannel = null;
  }
}

function closeChatRoom() {
  if (chatRoomChannel) { try { sb.removeChannel(chatRoomChannel); } catch (e) { /* 이미 닫힘 */ } }
  chatRoomChannel = null;
  chatRoomId = null;
  chatPartner = null;
  document.getElementById('chat-room-modal').style.display = 'none';
  loadChatRooms();
}

async function sendChat() {
  var input = document.getElementById('chat-input');
  var body = (input.value || '').trim();
  if (!body || !chatRoomId || !chatPartner) return;

  var btn = document.getElementById('chat-send');
  if (btn) btn.disabled = true;

  const { error } = await sb.from('chats').insert({
    room_id: chatRoomId,
    sender_id: chatMe.id,
    sender_name: chatMe.name,
    sender_role: chatMe.role,
    receiver_id: chatPartner.id,
    content: body
  });

  if (btn) btn.disabled = false;

  if (error) {
    // 쓴 글은 지우지 않습니다. 다시 누르면 그대로 보낼 수 있어야 합니다.
    chatToast('보내지 못했습니다: ' + error.message);
    return;
  }

  input.value = '';
  chatGrow(input);
  await reloadChatRoom();   // 실시간 방송을 기다리지 않고 내 화면부터
  loadChatRooms();
}

function chatToast(msg) {
  if (typeof toast === 'function') toast(msg, 'bad');
  else if (typeof showToast === 'function') showToast(msg, 'error');
  else alert(msg);
}

// 엔터로 보내고, 줄바꿈은 Shift+엔터.
function chatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function chatGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}
