// 서버 연결 정보와 앱 전역 변수

const SUPABASE_URL = 'https://ymtahsghrkqdxalcvcau.supabase.co';

// 이 키는 공개되어도 되는 키입니다. 브라우저에 내려가는 게 정상이고,
// 실제 보호는 서버의 RLS 정책이 합니다. 로그인하지 않으면 아무것도 읽히지 않습니다.
const SUPABASE_KEY = 'sb_publishable_bLRKkEl16RtGsYsGGBGg-Q_F7mCwKVW';

// 우리 학교 id. 학생이 학번으로 로그인할 때 내부 주소를 만드는 데 씁니다.
// 학교가 여러 곳으로 늘어나면 로그인 화면에 학교 선택을 붙여야 합니다.
const SCHOOL_ID = '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c';

// Supabase 클라이언트. 로그인 세션 유지와 토큰 갱신을 알아서 처리합니다.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 서버 요청 1건 = Supabase 로그 1줄(Log Ingestion). 뱃지·접속 표시 같은 «다시 확인» 은
// 이걸로 감싸서 부릅니다 — 화면이 안 보이면 건너뛰고, 마지막 확인 뒤 minGapMs 가
// 안 지났으면 건너뜁니다. 폰에서 앱을 들락날락할 때마다 여러 기능이 한꺼번에
// 서버에 묻던 것을 막습니다. (실시간 알림으로 오는 확인은 감싸지 않고 바로 부릅니다.)
function throttleRefresh(fn, minGapMs) {
  var last = 0;
  return function () {
    if (document.hidden) return;
    var now = Date.now();
    if (now - last < minGapMs) return;
    last = now;
    return fn();
  };
}

// 현재 로그인한 사람의 정보 (auth.js 가 채웁니다)
var currentUser = null;     // { id, role, name, school_id, must_change_password }

var timerInterval;
var currentMockQuestions = [];
var appMeta = { rev: [], q: [] };

// --- [신규] 녹음 관련 전역 변수 ---
var mediaRecorder;
var audioChunks = [];
var audioUrls = []; // 각 질문별 녹음본 저장
var mediaStream = null; // 마이크 권한 유지용
var isRecordOptedIn = false; // 학생의 녹음 선택 여부
var isAutoStart = true; // [신규] 5초 자동 시작 모드 여부
var countdownInterval; // 5초 카운트다운 타이머
var selectedRevUniv = '';
var selectedQUniv = '';
var currentModalType = '';
