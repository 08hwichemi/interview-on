// 연쇄 필터 로직 (대학이 마스터 키) — reviews.js 와 같은 구조
function updateQFilters(changedLevel) {
  if (!selectedQUniv) return;

  if (!changedLevel || changedLevel === 'univ') {
    populateSelect('q-year', getFilteredList(appMeta.q, {u: selectedQUniv}, 'y'), '년도');
  }
  var y = document.getElementById('q-year').value;

  if (!changedLevel || changedLevel === 'univ' || changedLevel === 'year') {
    populateSelect('q-type1', getFilteredList(appMeta.q, {u: selectedQUniv, y: y}, 't1'), '전형');
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
    '전형/역량1': document.getElementById('q-type1').value,
    '역량2': document.getElementById('q-type2').value
  };

  document.getElementById('question-list').innerHTML = '<div style="text-align:center; padding:40px; color:var(--ink-3);">데이터를 불러오는 중...</div>';
  document.getElementById('question-empty').style.display = 'none';

  var data = await supabaseRequest('questions', params);
  
  // 수파베이스 컬럼명과 기존 화면 렌더링 키값 맞추기
  data = data.map(function(item) {
    item['c1'] = item['전형/역량1']; 
    item['c2'] = item['역량2'];
    return item;
  });
  
  renderQuestionList(data);
}

function renderQuestionList(data) {
  var container = document.getElementById('question-list');
  var emptyMsg = document.getElementById('question-empty');
  container.innerHTML = '';
  
  if (!data || data.length === 0) {
    emptyMsg.style.display = 'block'; return;
  }
  emptyMsg.style.display = 'none';

  var i = 0;
  function drawChunk() {
    var html = '';
    var end = Math.min(i + 15, data.length);
    
    for (; i < end; i++) {
      var item = data[i];
      html += '<div class="card" onclick="toggleCard(this)">';
      html += '  <div class="card-header"><div>';
      html += '      <div class="card-title">' + (item['대학'] || '') + '</div>';
      html += '      <div class="card-tags">';
      if (item['년도']) html += '<span class="tag">' + item['년도'] + '</span>';
      if (item['c1']) html += '<span class="tag">' + item['c1'] + '</span>';
      if (item['c2']) html += '<span class="tag">' + item['c2'] + '</span>';
      html += '      </div></div><div class="arrow">▶</div></div>';
      html += '  <div class="card-body">';
      html += '    <div class="content-text">' + (item['질문'] || '내용 없음') + '</div>';
      html += '  </div></div>';
    }
    
    container.insertAdjacentHTML('beforeend', html);

    if (i < data.length) {
      setTimeout(drawChunk, 50);
    }
  }
  
  drawChunk();
}
