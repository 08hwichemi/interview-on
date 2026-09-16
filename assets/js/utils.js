// 8. 유틸 함수
function getFilteredList(data, filters, targetKey) {
  var set = new Set();
  data.forEach(function(item) {
    var match = true;
    for (var k in filters) {
      // 🛡️ [수정] 양쪽을 모두 String(글자)으로 강제 변환하여 안전하게 비교
      if (filters[k] !== '전체' && String(item[k]) !== String(filters[k])) {
        match = false;
      }
    }
    // 🛡️ [수정] 하위 목록에 담을 때도 확실하게 글자로 바꿔서 담음
    if (match && item[targetKey]) {
      set.add(String(item[targetKey]));
    }
  });

  // 🛡️ [수정] 기본 정렬 후, 연도('y')인 경우에만 내림차순(최신순)으로 뒤집기
  var result = Array.from(set).sort();
  if (targetKey === 'y' || targetKey === '년도') {
    result.reverse();
  }
  return result;
}

function populateSelect(id, arr, label) {
  var el = document.getElementById(id);
  var currentVal = el.value;
  var html = '<option value="전체">' + label + ' (전체)</option>';
  arr.forEach(function(val) { html += '<option value="' + val + '">' + val + '</option>'; });
  el.innerHTML = html;
  
  // 🛡️ [수정] 아이폰 버그 해결: 값을 명시적으로 꽂아줍니다!
  if (arr.indexOf(currentVal) > -1) {
    el.value = currentVal;
  } else {
    el.value = '전체'; 
  }
}

function toggleCard(element) { element.classList.toggle('expanded'); }
