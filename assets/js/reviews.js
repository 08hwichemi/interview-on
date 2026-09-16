// 5. 연쇄 필터 로직 (대학이 마스터 키)
function updateRevFilters(changedLevel) {
  if (!selectedRevUniv) return;
  
  if (!changedLevel || changedLevel === 'univ') {
    populateSelect('rev-year', getFilteredList(appMeta.rev, {u: selectedRevUniv}, 'y'), '년도');
  }
  var y = document.getElementById('rev-year').value;
  
  if (!changedLevel || changedLevel === 'univ' || changedLevel === 'year') {
    populateSelect('rev-type', getFilteredList(appMeta.rev, {u: selectedRevUniv, y: y}, 't'), '전형');
  }
  var t = document.getElementById('rev-type').value;

  if (!changedLevel || changedLevel === 'univ' || changedLevel === 'year' || changedLevel === 'type') {
    populateSelect('rev-major', getFilteredList(appMeta.rev, {u: selectedRevUniv, y: y, t: t}, 'm'), '학과');
  }
  filterReviews(); // 데이터 요청
}

// 6. 서버에 데이터 요청하기
async function filterReviews() {
  if (!selectedRevUniv) return;
  var params = {
    '대학': selectedRevUniv,
    '년도': document.getElementById('rev-year').value,
    '세부유형': document.getElementById('rev-type').value,
    '모집단위': document.getElementById('rev-major').value
  };

  document.getElementById('review-list').innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">데이터를 불러오는 중...</div>';
  document.getElementById('review-empty').style.display = 'none';

  var data = await supabaseRequest('reviews', params);
  
  // 수파베이스 컬럼명과 기존 화면 렌더링 키값 맞추기
  data = data.map(function(item) {
    item['전형'] = item['세부유형'];
    item['학과'] = item['모집단위'];
    return item;
  });
  
  renderReviewList(data);
}

// 7. 리스트 화면에 그리기 (스마트 분할 렌더링 적용)
function renderReviewList(data) {
  var container = document.getElementById('review-list');
  var emptyMsg = document.getElementById('review-empty');
  container.innerHTML = '';
  
  if (!data || data.length === 0) {
    emptyMsg.style.display = 'block'; return;
  }
  emptyMsg.style.display = 'none';

  var i = 0;
  // 한 번에 다 그리지 않고 15개씩 잘라서 그리는 내부 함수
  function drawChunk() {
    var html = '';
    var end = Math.min(i + 15, data.length); // 15개씩 끊기
    
    for (; i < end; i++) {
      var item = data[i];
      var passClass = (item['합불'] && item['합불'].indexOf('합격') > -1) ? 'tag-pass' : 'tag-fail';

      html += '<div class="card" onclick="toggleCard(this)">';
      html += '  <div class="card-header"><div>';
      html += '      <div class="card-title">' + (item['대학'] || '') + ' ' + (item['학과'] || '') + '</div>';
      html += '      <div class="card-tags">';
      if (item['년도']) html += '<span class="tag">' + item['년도'] + '</span>';
      if (item['전형']) html += '<span class="tag">' + item['전형'] + '</span>';
      if (item['합불']) html += '<span class="tag ' + passClass + '">' + item['합불'] + '</span>';
      html += '      </div></div><div class="arrow">▶</div></div>';
      html += '  <div class="card-body">';
      html += '    <div class="content-block"><div class="content-title">Q. 면접 질문</div><div class="content-text">' + (item['질문'] || '내용 없음') + '</div></div>';
      html += '    <div class="content-block"><div class="content-title">A. 나의 답변</div><div class="content-text">' + (item['답변'] || '내용 없음') + '</div></div>';
      if (item['팁']) html += '    <div class="content-block"><div class="content-title">💡 소감 및 팁</div><div class="content-text">' + item['팁'] + '</div></div>';
      html += '  </div></div>';
    }
    
    // 기존 화면을 지우지 않고 밑에 이어 붙이기
    container.insertAdjacentHTML('beforeend', html);

    // 아직 그릴 데이터가 남았다면?
    if (i < data.length) {
      // 폰이 다른 터치나 스크롤에 반응할 수 있도록 딱 0.05초(50ms)만 쉬었다가 다음 15개를 그림
      setTimeout(drawChunk, 50); 
    }
  }
  
  // 첫 15개 그리기 시작!
  drawChunk();
}
