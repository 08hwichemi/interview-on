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
