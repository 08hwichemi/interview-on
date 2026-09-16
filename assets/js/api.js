// 수파베이스 통신 전용 함수
async function supabaseRequest(table, params = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  Object.keys(params).forEach(key => {
    if (params[key] && params[key] !== '전체') {
      url += `&${encodeURIComponent(key)}=eq.${encodeURIComponent(params[key])}`;
    }
  });
  
  // [수정됨] 추천 질문 테이블이 아닐 때만 년도 정렬 적용
  if (table !== 'common_questions') {
    url += `&order=년도.desc`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
}
