// 서버 통신은 전부 이 파일을 지나갑니다.
// Supabase SDK 가 로그인 토큰을 자동으로 붙여주므로, 로그인하지 않았다면
// 서버가 빈 결과를 돌려줍니다 (RLS 정책).

async function supabaseRequest(table, params = {}) {
  let query = sb.from(table).select('*');

  Object.keys(params).forEach(function(key) {
    if (params[key] && params[key] !== '전체') {
      query = query.eq(key, params[key]);
    }
  });

  // 추천 질문 테이블에는 '년도' 컬럼이 없습니다
  if (table !== 'common_questions') {
    query = query.order('년도', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
