// 학생 앱 — 내 면접 리포트
//
// 선생님이 «학생에게 전달» 을 누른 회차만 보입니다.
// 서버 정책(RLS)이 status='전달됨' 인 것만 내려주므로, 여기서 따로 거를 필요가 없습니다.
//
// 리포트를 그리는 일은 report.js 가 합니다. 선생님이 확인한 종이와 같은 종이입니다.

var myReports = [];

// 홈에서 «내 면접 리포트» 를 누르면 여기로 옵니다.
async function loadMyReports() {
  var box = document.getElementById('report-list');
  box.innerHTML = '<div class="guide-msg"><div class="text">불러오는 중...</div></div>';

  const { data, error } = await sb
    .from('interviews')
    .select('id, started_at, delivered_at, edited_at, teacher_name, total_seconds, grades')
    .order('started_at', { ascending: false });

  if (error) {
    box.innerHTML = '<div class="guide-msg"><div class="icon">⚠️</div>' +
      '<div class="text">리포트를 불러오지 못했습니다.<br>' + esc(error.message) + '</div></div>';
    return;
  }

  myReports = data || [];
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
    return '<div class="card" onclick="openMyReport(\'' + iv.id + '\', ' + round + ')">' +
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

async function openMyReport(id, round) {
  navigateTo('report-detail');
  var box = document.getElementById('report-detail-body');
  box.innerHTML = '<div class="guide-msg"><div class="text">불러오는 중...</div></div>';

  var r = await fetchReport(id);
  if (r.error) {
    box.innerHTML = '<div class="guide-msg"><div class="icon">⚠️</div>' +
      '<div class="text">리포트를 못 읽었습니다.<br>' + esc(r.error) + '</div></div>';
    return;
  }
  // 학생 화면에서는 이름을 다시 적지 않습니다. 본인 것만 보이니까요.
  box.innerHTML = reportHTML(r.interview, r.answers, '', round);
}
