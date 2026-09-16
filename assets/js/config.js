// 1. 전역 변수 및 수파베이스 설정
const SUPABASE_URL = 'https://ymtahsghrkqdxalcvcau.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltdGFoc2docmtxZHhhbGN2Y2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzQ4MjcsImV4cCI6MjA5MjQxMDgyN30.N6xmSTWwmGcCRAPMp469BPV6M-7Kk_Gi1HYta7Wx6kk';

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
