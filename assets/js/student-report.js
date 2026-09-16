// 학생 앱 — 내 면접 리포트
//
// 선생님이 «학생에게 전달» 을 누른 회차만 보입니다.
// 서버 정책(RLS)이 status='전달됨' 인 것만 내려주므로, 여기서 따로 거를 필요가 없습니다.
//
// 리포트를 그리는 일은 report.js 가 합니다. 선생님이 확인한 종이와 같은 종이입니다.

var myReports = [];
var viewingRound = null;   // 지금 열어 둔 회차 (PDF 파일 이름에 씁니다)
var reportReads = {};      // { interview_id: 읽은 시각 }

// ══════════════ 안 읽은 리포트 알리기 ══════════════
//
// 선생님이 보내셨는데 학생이 모르고 지나가면 소용이 없습니다.
// 홈 메뉴에 빨간 숫자를 붙이고, 목록에서도 안 읽은 회차에 NEW 를 답니다.
//
// «읽었다» 는 표시는 report_reads 에 남습니다. 폰이 아니라 계정에 붙어 있어서
// 학교 컴퓨터에서 읽으면 폰에서도 읽은 것이 됩니다.
//
// 선생님이 전달한 뒤 내용을 고치면 다시 안 읽은 것이 됩니다.
// 고친 리포트를 못 보고 넘어가면 안 되니까요.
function isUnread(iv) {
  var readAt = reportReads[iv.id];
  if (!readAt) return true;
  var newest = iv.edited_at || iv.delivered_at || iv.started_at;
  return new Date(readAt) < new Date(newest);
}

async function loadReportReads() {
  if (!currentUser) return;
  const { data, error } = await sb
    .from('report_reads').select('interview_id, read_at').eq('user_id', currentUser.id);
  if (error) { console.warn('읽음 표시를 못 읽었습니다:', error.message); return; }
  reportReads = {};
  (data || []).forEach(function (r) { reportReads[r.interview_id] = r.read_at; });
}

function paintBadge() {
  var el = document.getElementById('report-badge');
  if (!el) return;
  var n = myReports.filter(isUnread).length;
  el.textContent = n;
  el.hidden = (n === 0);
}

// 홈에 있을 때도 새 리포트를 알아채야 합니다.
// 목록 화면에 들어가지 않아도 숫자가 뜹니다.
async function refreshReportBadge() {
  if (!currentUser || currentUser.role !== 'student') return;
  const { data, error } = await sb
    .from('interviews').select('id, started_at, delivered_at, edited_at')
    .order('started_at', { ascending: false });
  if (error) return;
  myReports = data || [];
  await loadReportReads();
  paintBadge();
}

// 선생님이 «전달» 을 누른 순간 학생 폰에 뜨게 합니다.
//   1) 서버가 알려주는 실시간(Realtime)
//   2) 그게 막혀 있을 때를 대비해 1분마다, 그리고 화면을 다시 볼 때마다 확인
// 둘 다 두는 이유는 실시간이 조용히 끊기는 일이 있기 때문입니다.
var reportWatchOn = false;

function watchReports() {
  if (reportWatchOn || !currentUser || currentUser.role !== 'student') return;
  reportWatchOn = true;

  try {
    sb.channel('my-reports')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'interviews' },
          function () { refreshReportBadge(); })
      .subscribe();
  } catch (e) {
    console.warn('실시간 알림을 켜지 못했습니다:', e);   // 아래 확인으로도 충분합니다
  }

  setInterval(refreshReportBadge, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshReportBadge();
  });
  refreshReportBadge();
}

// ══════════════ 목록 ══════════════

// 홈에서 «내 면접 리포트» 를 누르면 여기로 옵니다.
async function loadMyReports() {
  var box = document.getElementById('report-list');
  box.innerHTML = '<div class="guide-msg"><div class="text">불러오는 중...</div></div>';

  const [{ data, error }] = await Promise.all([
    sb.from('interviews')
      .select('id, started_at, delivered_at, edited_at, teacher_name, total_seconds, grades')
      .order('started_at', { ascending: false }),
    loadReportReads()
  ]);

  if (error) {
    box.innerHTML = '<div class="guide-msg"><div class="icon">⚠️</div>' +
      '<div class="text">리포트를 불러오지 못했습니다.<br>' + esc(error.message) + '</div></div>';
    return;
  }

  myReports = data || [];
  paintBadge();

  if (!myReports.length) {
    box.innerHTML = '<div class="guide-msg"><div class="icon">📋</div>' +
      '<div class="text">아직 받은 리포트가 없습니다.<br>' +
      '<span style="font-size:13px;font-weight:400">면접을 보고 선생님이 보내주시면 여기에 쌓입니다.</span></div></div>';
    return;
  }

  // 날짜별로 계속 쌓입니다. 지난 회차도 언제든 다시 읽을 수 있습니다.
  box.innerHTML = myReports.map(function (iv, i) {
    var round = myReports.length - i;
    var d = new Date(iv.started_at);
    var g = iv.grades || {};
    var got = SCORESHEET.map(function (r) { return g[r.item]; }).filter(Boolean);
    return '<div class="card' + (isUnread(iv) ? ' unread' : '') +
             '" onclick="openMyReport(\'' + iv.id + '\', ' + round + ')">' +
      '<div class="card-header"><div>' +
        '<div class="card-title">' + round + '회차 · ' +
          d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '</div>' +
        '<div class="card-tags">' +
          (iv.teacher_name ? '<span class="tag">' + esc(iv.teacher_name) + ' 선생님</span>' : '') +
          '<span class="tag">' + mmss(iv.total_seconds) + '</span>' +
          (got.length ? '<span class="tag">' + got.join(' ') + '</span>' : '') +
          (iv.edited_at ? '<span class="tag">고쳐짐</span>' : '') +
        '</div>' +
      '</div><div class="arrow">▶</div></div></div>';
  }).join('');
}

// 학번과 이름. 화면에서는 굳이 없어도 되지만, PDF 로 뽑아서
// 선생님께 내거나 상담 때 들고 가면 누구 것인지 적혀 있어야 합니다.
function myName() {
  if (!currentUser) return '';
  return ((currentUser.login_id || '') + ' ' + (currentUser.name || '')).trim();
}

async function openMyReport(id, round) {
  navigateTo('report-detail');
  viewingRound = round;
  var box = document.getElementById('report-detail-body');
  box.innerHTML = '<div class="guide-msg"><div class="text">불러오는 중...</div></div>';

  markRead(id);   // 열었으면 읽은 것입니다. 답을 기다리지 않습니다

  var r = await fetchReport(id);
  if (r.error) {
    box.innerHTML = '<div class="guide-msg"><div class="icon">⚠️</div>' +
      '<div class="text">리포트를 못 읽었습니다.<br>' + esc(r.error) + '</div></div>';
    return;
  }
  box.innerHTML = reportHTML(r.interview, r.answers, myName(), round);

  // 궁금한 것은 머리말의 「💬 톡」 으로 물어봅니다.
  // 리포트마다 질문 단추를 따로 두면 같은 일이 두 군데가 됩니다.
}

async function markRead(id) {
  if (!currentUser) return;
  var now = new Date().toISOString();
  reportReads[id] = now;   // 화면부터 먼저 고칩니다
  paintBadge();

  const { error } = await sb.from('report_reads')
    .upsert({ user_id: currentUser.id, interview_id: id, read_at: now },
            { onConflict: 'user_id,interview_id' });
  if (error) console.warn('읽음 표시를 저장하지 못했습니다:', error.message);
}

// 브라우저 인쇄창을 엽니다. 거기서 프린터 대신 «PDF로 저장» 을 고르면 됩니다.
function printMyReport() {
  printReport('report-detail-body', reportFileName(myName(), viewingRound));
}
