// 「전형_역량1」 칸은 원본 자료가 대학마다 달라서, 전형 이름 대신 이런
// 역량 이름이 그대로 들어간 대학이 있습니다(15곳 안팎). 전형 목록에서는
// 이런 값을 뺍니다 — 전형이 아니라서 섞이면 헷갈립니다. (자료 자체는 그대로
// 두고 목록에서만 뺍니다 — 「전체」를 고르면 그 질문도 그대로 나옵니다.)
var Q_NOT_A_TYPE = ['인성', '전공적합성', '진로역량', '발전가능성', '학업역량', '공동체역량', '지원동기'];

// 연쇄 필터 로직 (대학이 마스터 키) — reviews.js 와 같은 구조
function updateQFilters(changedLevel) {
  if (!selectedQUniv) return;

  if (!changedLevel || changedLevel === 'univ') {
    populateSelect('q-year', getFilteredList(appMeta.q, {u: selectedQUniv}, 'y'), '년도');
  }
  var y = document.getElementById('q-year').value;

  if (!changedLevel || changedLevel === 'univ' || changedLevel === 'year') {
    var types = getFilteredList(appMeta.q, {u: selectedQUniv, y: y}, 't1')
      .filter(function (t) { return Q_NOT_A_TYPE.indexOf(t) === -1; });
    populateSelect('q-type1', types, '전형');
  }
  var t1 = document.getElementById('q-type1').value;

  if (!changedLevel || changedLevel === 'univ' || changedLevel === 'year' || changedLevel === 'type1') {
    populateSelect('q-type2', getFilteredList(appMeta.q, {u: selectedQUniv, y: y, t1: t1}, 't2'), '역량2');
  }
  filterQuestions(); // 데이터 요청
}

async function filterQuestions() {
  if (!selectedQUniv) return;

  var params = {
    '대학': selectedQUniv,
    '년도': document.getElementById('q-year').value,
    '전형_역량1': document.getElementById('q-type1').value,
    '역량2': document.getElementById('q-type2').value
  };

  document.getElementById('question-list').innerHTML = '<div style="text-align:center; padding:40px; color:var(--ink-3);">데이터를 불러오는 중...</div>';
  document.getElementById('question-empty').style.display = 'none';

  var data = await supabaseRequest('questions', params);
  
  // 수파베이스 컬럼명과 기존 화면 렌더링 키값 맞추기
  data = data.map(function(item) {
    item['c1'] = item['전형_역량1']; 
    item['c2'] = item['역량2'];
    return item;
  });
  
  renderQuestionList(data);
}

// 같은 대학·연도·전형이면 질문이 여러 개라도 카드 하나로 묶습니다.
// (예: 가천대 2027 「학생부종합 – 가천바람개비, 가천 의약학, ...」 한 카테고리에
// 질문 17개 — 예전엔 카드 17개를 하나하나 눌러 펴야 했습니다.)
function groupQuestions(data) {
  var order = [];
  var groups = {};
  data.forEach(function (item) {
    var key = (item['년도'] || '') + '|' + (item['c1'] || '');
    if (!groups[key]) {
      groups[key] = { 대학: item['대학'], 년도: item['년도'], c1: item['c1'], items: [] };
      order.push(key);
    }
    groups[key].items.push(item);
  });
  return order.map(function (k) { return groups[k]; });
}

function renderQuestionList(data) {
  var container = document.getElementById('question-list');
  var emptyMsg = document.getElementById('question-empty');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    emptyMsg.style.display = 'block'; return;
  }
  emptyMsg.style.display = 'none';

  var groups = groupQuestions(data);
  var i = 0;
  function drawChunk() {
    var html = '';
    var end = Math.min(i + 15, groups.length);

    for (; i < end; i++) {
      var g = groups[i];
      html += '<div class="card" onclick="toggleCard(this)">';
      html += '  <div class="card-header"><div>';
      html += '      <div class="card-title">' + (g.대학 || '') + '</div>';
      html += '      <div class="card-tags">';
      if (g.년도) html += '<span class="tag">' + g.년도 + '</span>';
      if (g.c1) html += '<span class="tag">' + g.c1 + '</span>';
      html += '      </div></div><div class="arrow">▶</div></div>';
      html += '  <div class="card-body">';
      html += g.items.map(function (item, idx) {
        var c2tag = item['c2'] ? ' <span class="tag">' + item['c2'] + '</span>' : '';
        return '<div class="qline"><span class="qn">' + (idx + 1) + '.</span> ' +
               '<span class="qtext">' + (item['질문'] || '내용 없음') + '</span>' + c2tag + '</div>';
      }).join('');
      html += '  </div></div>';
    }

    container.insertAdjacentHTML('beforeend', html);

    if (i < groups.length) {
      setTimeout(drawChunk, 50);
    }
  }

  drawChunk();
}
