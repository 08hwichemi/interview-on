// 자료 둘러보기 — 「실전 면접 후기」와 「대학별 기출 질문」의 공통 뼈대
//
// 학생 앱(index.html)과 교사 화면(teacher/) 이 함께 씁니다.
// 실제로 목록을 그리는 일은 reviews.js · questions.js 가 합니다.
// 이 파일은 그 앞에 와야 합니다.
//
// 담아 두는 곳(appMeta, selectedRevUniv, selectedQUniv, currentModalType)은
// config.js 에 있습니다. 두 화면 다 config.js 를 먼저 읽습니다.

// 대학·년도·전형·학과 목록을 만들려면 전체 자료를 한 번 훑어야 합니다.
// 로그인한 뒤 한 번만 받아 두고, 그 뒤로는 화면에서 고를 때마다 이걸 씁니다.
async function loadBrowseMeta() {
  const [revData, qData] = await Promise.all([
    supabaseRequest('reviews'),
    supabaseRequest('questions')
  ]);
  appMeta.rev = revData.map(function (d) {
    return { y: d['년도'], u: d['대학'], t: d['세부유형'], m: d['모집단위'] };
  });
  appMeta.q = qData.map(function (d) {
    return { y: d['년도'], u: d['대학'], t1: d['전형/역량1'], t2: d['역량2'] };
  });
}

// ── 대학 고르기 팝업 ──
function openUnivModal(type) {
  currentModalType = type;
  var univs = getFilteredList(appMeta[type], {}, 'u');   // 이 갈래의 모든 대학

  var html = '<button class="univ-list-btn" style="background:var(--surface-2); color:var(--ink-2);"' +
             ' onclick="selectUniv(\'전체\')">🌐 모든 대학 (전체 보기)</button>';
  html += univs.map(function (u) {
    return '<button class="univ-list-btn" onclick="selectUniv(\'' + u + '\')">' + u + '</button>';
  }).join('');

  document.getElementById('univ-modal-list').innerHTML = html;
  document.getElementById('univ-modal').style.display = 'flex';
}

function closeUnivModal() {
  document.getElementById('univ-modal').style.display = 'none';
}

function selectUniv(univName) {
  if (currentModalType === 'rev') {
    selectedRevUniv = univName;
    document.getElementById('rev-main-univ-btn').innerHTML =
      '<span>🏫 ' + univName + '</span><span>▼</span>';
    document.getElementById('rev-sub-filters').style.display = 'block';   // 세부 필터 잠금 해제
    updateRevFilters('univ');
  } else {
    selectedQUniv = univName;
    document.getElementById('q-main-univ-btn').innerHTML =
      '<span>🏫 ' + univName + '</span><span>▼</span>';
    document.getElementById('q-sub-filters').style.display = 'block';   // 세부 필터 잠금 해제
    updateQFilters('univ');
  }
  closeUnivModal();
}
