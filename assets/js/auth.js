// --- [보안] 입장 코드 검증 및 화면 전환 ---
async function checkEntryCode() {
  var input = document.getElementById('entry-code-input').value;
  document.getElementById('loading').style.display = 'flex'; // 로딩 표시

  try {
    // 무거운 라이브러리 대신, 기본 fetch 방식으로 수파베이스 로봇(RPC)에게 물어봅니다.
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input_pw: input })
    });

    const data = await response.json();
    document.getElementById('loading').style.display = 'none';

    if (data === true) {
      // 서버가 '맞다'고 하면 통과!
      document.getElementById('login-error-msg').style.display = 'none';
      navigateTo('home');
    } else {
      // 서버가 '틀리다'고 하거나 에러가 나면 차단
      var errorMsg = document.getElementById('login-error-msg');
      errorMsg.style.display = 'block';
      errorMsg.style.animation = 'none';
      setTimeout(() => { errorMsg.style.animation = 'shake 0.3s'; }, 10);
    }
  } catch (e) {
    console.error("인증 오류:", e);
    document.getElementById('loading').style.display = 'none';
    showToast("서버와 통신하는 중 문제가 발생했습니다.", "error");
  }
}
