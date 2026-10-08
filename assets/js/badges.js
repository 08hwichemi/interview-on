// 빨간 숫자·안읽음 점을 «요청 한 번» 으로 (2026-10-08)
//
// 앱을 열 때와 앱으로 돌아왔을 때(마지막 확인에서 5분이 지났으면), 아래를 서버 함수 하나(app_badges)로 한꺼번에 묻습니다.
//   · 🔔 지금 공지              (notice.js 의 noticeApply)
//   · 💬 안 읽은 톡 수 · 가장 새 톡 시각 (chat.js 의 chatApplyBadge — 바뀐 게 있을 때만 대화방 목록을 다시 받습니다)
//   · 학생만: 리포트 · 읽음 표시 (student-report.js 의 reportApply)
//            연습장 코멘트 · 받은 질문 (practice.js 의 practiceApplyBadge)
//
// ⚠️ 예전엔 저마다 따로 물었습니다 — 공지 · 톡 목록 · 리포트(+읽음) · 코멘트(+읽음) · 받은 질문.
//    브라우저는 요청마다 «보내도 되나요?» 확인(OPTIONS)을 먼저 보내서 서버 기록이 두 배로 쌓였고,
//    톡 목록은 1분만 벗어났다 와도 다시 받았습니다. Supabase 무료 요금제의 Log Ingestion(1GB, 두 방 합산)이
//    96% 까지 찼습니다(2026-10-08 선생님 대시보드). 로그를 1시간 읽어 보니 «API 요청 기록» 이 거의 전부였습니다.
//    → docs/할-일.md «Supabase 사용량 지켜보기»
//
// 서버 함수가 없거나 실패하면 예전처럼 따로 묻습니다(badgesFallback) — 빨간 숫자가 조용히 멈추면 안 되니까요.
// 실시간 알림(톡·공지)으로 오는 확인은 여기와 상관없이 그대로 바로 갑니다.
// 학생 앱(index.html)과 교사 화면(teacher/index.html)이 함께 씁니다. sb · SCHOOL_ID · throttleRefresh 는 config.js.

var badgesWatchOn = false;

async function badgesRefresh() {
  var res;
  try { res = await sb.rpc('app_badges', { p_school: SCHOOL_ID }); }
  catch (e) { res = { error: e }; }
  if (res.error || !res.data) {
    console.warn('빨간 숫자를 한 번에 못 받아 따로 묻습니다:', res.error && res.error.message);
    badgesFallback();
    return;
  }
  var d = res.data;
  if (typeof noticeApply === 'function') noticeApply(d.notice || null);
  if (typeof chatApplyBadge === 'function') chatApplyBadge(Number(d.chat_unread) || 0, d.chat_last || null);
  if (d.is_student) {
    if (typeof reportApply === 'function') reportApply(d.reports || [], d.report_reads || []);
    if (typeof practiceApplyBadge === 'function') practiceApplyBadge(Number(d.comments_unread) || 0, Number(d.offers_new) || 0);
  }
}

// 예전 길 — 저마다 따로 묻습니다(각 함수가 학생인지 등은 스스로 가립니다)
function badgesFallback() {
  if (typeof noticeCheckBadge === 'function') noticeCheckBadge();
  if (typeof loadChatRooms === 'function') loadChatRooms();
  if (typeof refreshReportBadge === 'function') refreshReportBadge();
  if (typeof practiceRefreshBadge === 'function') practiceRefreshBadge();
}

// 로그인 뒤 한 번 부릅니다. 바로 한 번 확인하고, 그 뒤로는 앱으로 돌아왔을 때 5분이 지났으면 한 번.
function badgesWatch() {
  if (badgesWatchOn) return;
  badgesWatchOn = true;
  var recheck = throttleRefresh(badgesRefresh, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', recheck);
  recheck();
}
