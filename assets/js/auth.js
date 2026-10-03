// 로그인 / 비밀번호 변경
//
// 계정은 관리자가 전부 만듭니다. 스스로 가입하는 길은 없습니다.
// 로그인은 두 갈래입니다.
//   학생   : 학번 + 비밀번호  ->  모바일 앱 화면
//   선생님 : 이름 + 비밀번호  ->  PC용 교사 페이지
//
// ── 아이디를 내부 주소로 바꾸는 이유 ──
// 서버(Supabase Auth)는 계정을 이메일 형태로만 구분하는데, 이메일 주소에는
// 한글을 쓸 수 없습니다. 그래서 아이디를 16진수로 바꿔 내부 주소를 만듭니다.
//   이용휘(교사) -> tec9db4ec9aa9ed9c98@9bf9d65d.interview-on.local
//   20301(학생)  -> s3230333031@9bf9d65d.interview-on.local
// 앞의 t / s 가 교사와 학생의 공간을 갈라 놓기 때문에, 교사 이름과 학번이
// 어쩌다 같아도 서로 부딪히지 않습니다.
//
// 이 주소는 화면에 절대 보이지 않습니다. 선생님은 이름만, 학생은 학번만 칩니다.
//
// ⚠️ 이 규칙은 계정을 만드는 쪽(관리자 기능 / 부트스트랩 SQL)과 반드시 같아야
//    합니다. 한쪽만 고치면 모든 로그인이 깨집니다.
function toInternalEmail(loginId, role) {
  const prefix = (role === 'student') ? 's' : 't';
  const bytes = new TextEncoder().encode(String(loginId).trim());
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return prefix + hex + '@' + SCHOOL_ID.slice(0, 8) + '.interview-on.local';
}

// 로그인 화면의 학생 / 선생님 탭
var loginMode = 'student';

function showLoginTab(which) {
  loginMode = which;

  document.getElementById('tab-student').classList.toggle('active', which === 'student');
  document.getElementById('tab-teacher').classList.toggle('active', which === 'teacher');

  var input = document.getElementById('login-id-input');
  input.placeholder = (which === 'student') ? '학번' : '이름';
  input.setAttribute('inputmode', which === 'student' ? 'numeric' : 'text');
  input.value = '';
  document.getElementById('login-pw-input').value = '';

  document.getElementById('login-help-student').style.display = which === 'student' ? 'block' : 'none';
  document.getElementById('login-help-teacher').style.display = which === 'teacher' ? 'block' : 'none';
  document.getElementById('login-error-msg').style.display = 'none';
  input.focus();
}

function showLoginError(msg) {
  var el = document.getElementById('login-error-msg');
  el.innerHTML = msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  setTimeout(function() { el.style.animation = 'shake 0.3s'; }, 10);
}

function setBusy(on) {
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
}

// --- 로그인 ---
async function login() {
  var loginId = document.getElementById('login-id-input').value.trim();
  var password = document.getElementById('login-pw-input').value;

  if (!loginId || !password) {
    showLoginError((loginMode === 'student' ? '학번' : '이름') + '과 비밀번호를 모두 입력해 주세요.');
    return;
  }

  setBusy(true);
  const { error } = await sb.auth.signInWithPassword({
    email: toInternalEmail(loginId, loginMode),
    password: password
  });
  setBusy(false);

  if (error) {
    showLoginError(loginMode === 'student'
      ? '학번 또는 비밀번호가 올바르지 않습니다.'
      : '이름 또는 비밀번호가 올바르지 않습니다.');
    return;
  }
  await afterLogin();
}

// --- 최초 로그인 시 비밀번호 변경 ---
async function submitPasswordChange() {
  var pw1 = document.getElementById('newpw-input').value;
  var pw2 = document.getElementById('newpw-confirm-input').value;
  var errEl = document.getElementById('newpw-error');

  function fail(msg) { errEl.innerText = msg; errEl.style.display = 'block'; }
  errEl.style.display = 'none';

  // 학생들이 외우기 쉽도록 숫자 6자리 이상으로 받습니다.
  if (!/^[0-9]+$/.test(pw1)) { fail('비밀번호는 숫자만 쓸 수 있습니다.'); return; }
  if (pw1.length < 6)        { fail('비밀번호는 숫자 6자리 이상이어야 합니다.'); return; }
  if (pw1 !== pw2)           { fail('두 비밀번호가 서로 다릅니다.'); return; }

  setBusy(true);
  const { error: pwErr } = await sb.auth.updateUser({ password: pw1 });
  if (pwErr) { setBusy(false); fail('변경에 실패했습니다: ' + pwErr.message); return; }

  const { error: flagErr } = await sb
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', currentUser.id);
  setBusy(false);

  if (flagErr) { fail('저장에 실패했습니다: ' + flagErr.message); return; }

  currentUser.must_change_password = false;
  showToast('비밀번호가 변경되었습니다.', 'success');
  await enterApp();
}

// --- 로그아웃 ---
async function logout() {
  showConfirm('로그아웃 하시겠습니까?', async function() {
    await sb.auth.signOut();
    currentUser = null;
    appMeta = { rev: [], q: [] };
    // 일부러 나가는 길입니다 — 뒤로가기 막음이 «나가시겠습니까?» 를 묻지 않게 합니다
    if (typeof allowLeaving === 'function') allowLeaving();
    location.reload();
  });
}

// --- 로그인 직후 공통 처리 ---
async function afterLogin() {
  setBusy(true);

  const { data: { user } } = await sb.auth.getUser();
  if (!user) { setBusy(false); showLoginError('로그인 정보를 확인하지 못했습니다.'); return; }

  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, role, name, login_id, school_id, must_change_password')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    setBusy(false);
    await sb.auth.signOut();
    showLoginError('계정 정보를 찾을 수 없습니다.<br>선생님께 문의해 주세요.');
    return;
  }

  currentUser = profile;

  // 관리자가 준 초기 비밀번호를 쓰고 있으면 먼저 바꾸게 합니다
  if (profile.must_change_password) {
    setBusy(false);
    navigateTo('change-password');
    return;
  }

  await enterApp();
}

// --- 앱 본 화면으로 ---
async function enterApp() {
  // 학생은 이 모바일 앱, 선생님은 면접 화면으로 갑니다.
  // 관리자는 «명단 관리» 가 본업이라 곧바로 그 화면으로 보냅니다.
  // (면접도 보시므로 거기 머리말에서 면접 화면으로 건너갈 수 있습니다)
  // 다른 화면으로 옮겨 가는 길입니다 — 뒤로가기 막음이 가로막지 않게 합니다
  if (currentUser.role === 'admin')   { if (typeof allowLeaving === 'function') allowLeaving(); location.replace('admin/');   return; }
  if (currentUser.role !== 'student') { if (typeof allowLeaving === 'function') allowLeaving(); location.replace('teacher/'); return; }

  setBusy(true);

  var nameEl = document.getElementById('header-user-name');
  if (nameEl) nameEl.innerText = currentUser.name || currentUser.login_id || '';

  try {
    await loadBrowseMeta();   // browse.js — 교사 화면도 같은 함수를 씁니다
  } catch (e) {
    console.error('데이터를 불러오지 못했습니다:', e);
    showToast('자료를 불러오지 못했습니다.\n인터넷 연결을 확인해 주세요.', 'error');
  }

  setBusy(false);
  navigateTo('home');
  watchReports();   // 선생님이 리포트를 보내면 홈에 빨간 숫자가 붙습니다
  practiceWatchComments();   // 선생님이 답안 연습장에 코멘트를 달면 홈에 빨간 숫자가 붙습니다
  noticeWatch();    // 머리말 🔔 단추에 안읽음 점을 켜 둡니다

  // 톡은 어느 화면에서나 쓸 수 있게 머리말에 있습니다
  document.getElementById('chat-open').hidden = false;
  startChat({ id: currentUser.id, role: 'student',
              name: (currentUser.login_id || '') + ' ' + (currentUser.name || '') });
}

// --- 앱 시작 시 이미 로그인돼 있는지 확인 ---
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await afterLogin();
  } else {
    setBusy(false);
    navigateTo('login');
  }
}
