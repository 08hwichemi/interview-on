// 학생 접속 표시 — 교사 화면 학생 명단에 초록 점.
//
// 실시간(Realtime)은 안 씁니다. 공지 기능(notice.js)이 이미 로그인한 사람마다
// 실시간 연결을 하나씩 열어 두는데, 학교 학생이 200명에 가까워서(무료 요금제
// 동시 접속 200개) 거기에 더 얹으면 여유가 없습니다. 그래서 학생이 화면을 열어
// 둔 동안 60초마다 "저 여기 있어요" 라고 시각만 하나 서버에 찍어 두고(하트비트),
// 교사 화면은 45초마다 그 시각들을 다시 읽어서 90초 안이면 온라인으로 봅니다.
// (온라인 기준을 하트비트 간격의 1.5배로 잡아, 네트워크가 잠깐 끊겨도 바로
// 회색으로 안 꺼지게 여유를 둡니다.)
//
// 화면이 안 보일 때(다른 탭으로 옮겼을 때)는 하트비트를 건너뜁니다 — 정말 보고
// 있을 때만 "접속 중"으로 칩니다.

var PRESENCE_HEARTBEAT_MS = 60000;      // 학생: 60초마다 하트비트
var PRESENCE_POLL_MS = 45000;           // 교사: 45초마다 다시 읽기
var PRESENCE_ONLINE_WITHIN_MS = 90000;  // 마지막 하트비트가 90초 안이면 온라인

// ── 학생 쪽: 하트비트 보내기 ──
var presenceHeartbeatTimer = null;
function startHeartbeat() {
  if (presenceHeartbeatTimer) return;
  function tick() {
    if (document.hidden) return;   // 이 탭을 안 보고 있으면 건너뜁니다
    sb.rpc('student_heartbeat').catch(function () { /* 한 번 놓쳐도 다음에 또 보냅니다 */ });
  }
  tick();
  presenceHeartbeatTimer = setInterval(tick, PRESENCE_HEARTBEAT_MS);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) tick();   // 탭으로 돌아오면 바로 한 번 찍습니다
  });
}

// ── 교사 쪽: 학생 명단에 온라인 점 ──
function isStudentOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  return (Date.now() - new Date(lastSeenAt).getTime()) < PRESENCE_ONLINE_WITHIN_MS;
}

var presencePollTimer = null;
async function refreshOnlineStatus() {
  if (typeof students === 'undefined' || !students || !students.length) return;
  const { data, error } = await sb.from('students').select('id, last_seen_at');
  if (error || !data) return;
  var seenAt = {};
  data.forEach(function (r) { seenAt[r.id] = r.last_seen_at; });
  students.forEach(function (s) { s.last_seen_at = seenAt[s.id]; });
  if (typeof renderStudents === 'function') renderStudents();
}

function startOnlineWatch() {
  if (presencePollTimer) return;
  refreshOnlineStatus();
  presencePollTimer = setInterval(refreshOnlineStatus, PRESENCE_POLL_MS);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshOnlineStatus();
  });
}
