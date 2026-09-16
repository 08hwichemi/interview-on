// 로그인 / 가입 / 비밀번호 변경
//
// 학생은 이메일이 없으므로 학번을 내부 주소로 바꿔서 로그인합니다.
// (Edge Function 의 studentEmail() 과 같은 규칙이어야 합니다 — 한쪽만 고치면 로그인이 깨집니다)
function studentEmail(studentNo) {
  return 's' + String(studentNo).trim() + '@' + SCHOOL_ID.slice(0, 8) + '.students.invalid';
}

// --- 화면 전환 ---
function showLoginTab(which) {
  document.getElementById('login-student-form').style.display = which === 'student' ? 'block' : 'none';
  document.getElementById('login-teacher-form').style.display = which === 'teacher' ? 'block' : 'none';
  document.getElementById('signup-teacher-form').style.display = which === 'signup' ? 'block' : 'none';

  document.getElementById('tab-student').classList.toggle('active', which === 'student');
  document.getElementById('tab-teacher').classList.toggle('active', which !== 'student');
  hideLoginError();
}

function showLoginError(msg) {
  var el = document.getElementById('login-error-msg');
  el.innerHTML = msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  setTimeout(function() { el.style.animation = 'shake 0.3s'; }, 10);
}

function hideLoginError() {
  document.getElementById('login-error-msg').style.display = 'none';
}

function setBusy(on) {
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
}

// --- 학생 로그인 (학번 + 비밀번호) ---
async function loginStudent() {
  var studentNo = document.getElementById('student-no-input').value.trim();
  var password = document.getElementById('student-pw-input').value;

  if (!studentNo || !password) {
    showLoginError('학번과 비밀번호를 모두 입력해 주세요.');
    return;
  }

  setBusy(true);
  const { error } = await sb.auth.signInWithPassword({
    email: studentEmail(studentNo),
    password: password
  });
  setBusy(false);

  if (error) {
    showLoginError('학번 또는 비밀번호가 올바르지 않습니다.');
    return;
  }
  await afterLogin();
}

// --- 교사 로그인 (이메일 + 비밀번호) ---
async function loginTeacher() {
  var email = document.getElementById('teacher-email-input').value.trim();
  var password = document.getElementById('teacher-pw-input').value;

  if (!email || !password) {
    showLoginError('이메일과 비밀번호를 모두 입력해 주세요.');
    return;
  }

  setBusy(true);
  const { error } = await sb.auth.signInWithPassword({ email: email, password: password });
  setBusy(false);

  if (error) {
    showLoginError('이메일 또는 비밀번호가 올바르지 않습니다.');
    return;
  }
  await afterLogin();
}

// --- 교사 가입 (초대 코드 필요) ---
async function signupTeacher() {
  var code = document.getElementById('signup-code-input').value.trim();
  var name = document.getElementById('signup-name-input').value.trim();
  var email = document.getElementById('signup-email-input').value.trim();
  var password = document.getElementById('signup-pw-input').value;

  if (!code || !name || !email || !password) {
    showLoginError('모든 항목을 입력해 주세요.');
    return;
  }
  if (password.length < 8) {
    showLoginError('비밀번호는 8자 이상이어야 합니다.');
    return;
  }

  setBusy(true);

  const { error: signUpErr } = await sb.auth.signUp({ email: email, password: password });
  if (signUpErr) {
    setBusy(false);
    showLoginError(signUpErr.message.indexOf('already') >= 0
      ? '이미 가입된 이메일입니다. 로그인해 주세요.'
      : '가입에 실패했습니다: ' + signUpErr.message);
    return;
  }

  // 메일 확인이 켜져 있으면 이 시점에 세션이 없습니다.
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    setBusy(false);
    showToast('가입 확인 메일을 보냈습니다.\n메일을 열어 확인한 뒤 로그인해 주세요.', 'info');
    showLoginTab('teacher');
    return;
  }

  // 초대 코드로 학교에 소속시킵니다
  const { error: claimErr } = await sb.rpc('claim_teacher_profile', {
    invite_code: code,
    teacher_name: name
  });
  setBusy(false);

  if (claimErr) {
    showLoginError(claimErr.message || '초대 코드가 올바르지 않습니다.');
    await sb.auth.signOut();
    return;
  }

  showToast('가입이 완료되었습니다.', 'success');
  await afterLogin();
}

// --- 최초 로그인 시 비밀번호 변경 ---
async function submitPasswordChange() {
  var pw1 = document.getElementById('newpw-input').value;
  var pw2 = document.getElementById('newpw-confirm-input').value;
  var errEl = document.getElementById('newpw-error');

  function fail(msg) { errEl.innerText = msg; errEl.style.display = 'block'; }
  errEl.style.display = 'none';

  if (pw1.length < 8) { fail('비밀번호는 8자 이상이어야 합니다.'); return; }
  if (pw1 !== pw2)    { fail('두 비밀번호가 서로 다릅니다.'); return; }

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
  enterApp();
}

// --- 로그아웃 ---
async function logout() {
  showConfirm('로그아웃 하시겠습니까?', async function() {
    await sb.auth.signOut();
    currentUser = null;
    appMeta = { rev: [], q: [] };
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
    .select('id, role, name, school_id, must_change_password')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    setBusy(false);
    await sb.auth.signOut();
    showLoginError('계정에 학교 정보가 없습니다.<br>선생님께 문의해 주세요.');
    return;
  }

  currentUser = profile;

  // 초기 비밀번호를 쓰고 있으면 먼저 바꾸게 합니다
  if (profile.must_change_password) {
    setBusy(false);
    navigateTo('change-password');
    return;
  }

  await enterApp();
}

// --- 앱 본 화면으로 ---
async function enterApp() {
  setBusy(true);
  try {
    const [revData, qData] = await Promise.all([
      supabaseRequest('reviews'),
      supabaseRequest('questions')
    ]);
    appMeta.rev = revData.map(d => ({ y: d['년도'], u: d['대학'], t: d['세부유형'], m: d['모집단위'] }));
    appMeta.q   = qData.map(d => ({ y: d['년도'], u: d['대학'], t1: d['전형/역량1'], t2: d['역량2'] }));
  } catch (e) {
    console.error('데이터를 불러오지 못했습니다:', e);
    showToast('자료를 불러오지 못했습니다.\n인터넷 연결을 확인해 주세요.', 'error');
  }
  setBusy(false);
  navigateTo('home');
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
