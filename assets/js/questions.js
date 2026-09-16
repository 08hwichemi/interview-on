// 🛡️ [수정] 연도/역량 필터 로직을 시원하게 날려버렸습니다.
function updateQFilters() {
  if (!selectedQUniv) return;
  filterQuestions(); 
}

async function filterQuestions() {
  if (!selectedQUniv) return;
  
  // 🛡️ [수정] 다른 조건은 묻지도 따지지도 않고 오직 '대학' 이름만 수파베이스로 보냅니다!
  var params = {
    '대학': selectedQUniv
  };

  document.getElementById('question-list').innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">데이터를 불러오는 중...</div>';
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
