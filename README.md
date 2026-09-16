# 면접ON — 스마트 면접 대비 앱

고등학생 대입 면접 준비를 돕는 웹앱(PWA). 대학별 면접 후기·기출 질문을 찾아보고, 실제 면접처럼 시간을 재며 답변을 녹음해 연습할 수 있습니다. 선생님이 모의면접을 진행하고 피드백을 돌려주는 기능을 만들고 있습니다.

**개발**: 이용휘

---

## 어디서든 코드 고치는 법

이 저장소를 깃허브에서 연 다음, 주소창에서 `github.com` → **`github.dev`** 로 바꾸면 (또는 파일 목록 화면에서 키보드 `.` 를 누르면) 브라우저 안에서 바로 VS Code가 열립니다. 설치할 것도 로그인할 것도 없고, 아이패드에서도 됩니다.

고친 뒤 왼쪽 소스 제어 탭에서 메시지를 쓰고 커밋하면 그대로 저장됩니다.

---

## 파일 구조

```
.
├── index.html              학생용 화면 (모바일)
├── teacher/index.html      교사·관리자용 화면 (PC)
├── manifest.json           PWA 설치 정보
├── sw.js                   서비스 워커 — 네트워크 우선, 오프라인일 때만 캐시
├── .nojekyll               GitHub Pages 가 파일을 건드리지 않게 하는 표식
├── docs/계정-구조.md        로그인 방식과 권한 설계
└── assets/
    ├── icon-192.png        앱 아이콘 (36KB)
    ├── icon-512.png        앱 아이콘 고해상도 (283KB)
    ├── icon-original.png   원본 (1372×1457, 크기 조절용 보관본)
    ├── css/
    │   ├── base.css        초기화·레이아웃·헤더·로그인·모달
    │   ├── app.css         카드·훈련 화면·토스트·푸터
    │   └── teacher.css     교사 화면 (PC 넓은 레이아웃)
    └── js/
        ├── config.js       수파베이스 연결, 학교 id, 전역 변수
        ├── utils.js        getFilteredList, populateSelect, toggleCard
        ├── api.js          supabaseRequest — 모든 서버 통신이 여기를 지납니다
        ├── ui.js           화면 전환, 토스트, 확인창, 대학 선택 모달
        ├── auth.js         로그인·비밀번호 변경·역할별 화면 분기
        ├── reviews.js      면접 후기 — 필터·조회·목록 그리기
        ├── questions.js    기출 질문 — 필터·조회·목록 그리기
        ├── interview.js    모의 면접 — 질문 세팅, 스톱워치, 녹음, 결과 리포트
        └── main.js         앱 시작점 (로그인 확인, 서비스 워커 등록)
```

### 고칠 곳 찾기

| 하고 싶은 일 | 볼 파일 |
|---|---|
| 면접 후기 목록 모양 바꾸기 | `assets/js/reviews.js` |
| 기출 질문 목록 모양 바꾸기 | `assets/js/questions.js` |
| 녹음·타이머 동작 바꾸기 | `assets/js/interview.js` |
| 로그인 화면 바꾸기 | `assets/js/auth.js`, `index.html` |
| 교사 화면 바꾸기 | `teacher/index.html`, `assets/css/teacher.css` |
| 색·글씨·여백 바꾸기 | `assets/css/base.css`, `assets/css/app.css` |
| 서버에서 가져오는 항목 바꾸기 | `assets/js/api.js` |

### ⚠️ 스크립트는 일반 `<script>` 입니다 — `type="module"` 로 바꾸지 마세요

화면의 버튼들이 `onclick="navigateTo('home')"` 처럼 **함수를 이름으로 직접 부릅니다.**
모듈로 바꾸면 함수가 전역에서 사라져 **모든 버튼이 한꺼번에 죽습니다.**

`index.html` 맨 아래 로딩 순서도 의미가 있습니다:
`Supabase SDK → config → utils → api → ui → auth → reviews → questions → interview → main`

---

## 로그인

**이메일을 쓰지 않습니다.** 학생은 **학번**, 교사는 **이름**으로 로그인하고, 계정은 관리자가 전부 만듭니다. 스스로 가입하는 길은 없습니다.

| | 아이디 | 로그인 후 |
|---|---|---|
| 학생 | 학번 (`20301`) | `index.html` 모바일 앱 |
| 교사 | 이름 (`이용휘`) | `teacher/` PC 화면 |
| 관리자 | 이름 | `teacher/` + 계정 관리 |

첫 로그인 때는 관리자가 준 초기 비밀번호를 쓰고, 반드시 본인 비밀번호로 바꾸게 되어 있습니다.

한글 아이디가 어떻게 동작하는지, 권한이 어떻게 갈리는지는 **[docs/계정-구조.md](docs/계정-구조.md)** 에 있습니다. 로그인 규칙을 고칠 일이 생기면 **반드시 먼저 읽으세요** — 변환 규칙이 앱과 서버 두 곳에 있어서 한쪽만 고치면 모든 로그인이 깨집니다.

---

## 데이터베이스 (Supabase)

프로젝트: `ymtahsghrkqdxalcvcau` (SmartInterview)

| 테이블 | 용도 | 주요 컬럼 | 행 수 |
|---|---|---|---|
| `reviews` | 면접 후기 | `년도`, `대학`, `세부유형`, `모집단위`, `합불` | 814 |
| `questions` | 기출 질문 | `년도`, `대학`, `전형/역량1`, `역량2` | 722 |
| `common_questions` | AI 추천 질문 | `category` (`changche` / `major`) | 60 |
| `schools` | 학교 | `name` | 1 |
| `profiles` | 계정 (교사·학생 공통) | `login_id`, `role`, `name` | — |
| `students` | 학생 명단 | `student_no`, `name`, `grade`, `class_no` | — |

**컬럼명이 한글입니다.** `assets/js/api.js` 의 `supabaseRequest()` 가 처리합니다.

**로그인하지 않으면 아무 자료도 읽히지 않습니다.** 모든 테이블의 RLS 가 `authenticated` 로 잠겨 있습니다. 확인 방법:

```bash
curl -s "https://ymtahsghrkqdxalcvcau.supabase.co/rest/v1/reviews?select=*&limit=3" \
  -H "apikey: sb_publishable_bLRKkEl16RtGsYsGGBGg-Q_F7mCwKVW"
```

`[]` 가 나와야 정상입니다.

### Edge Function

`create-student-accounts` — 교사·학생 계정 일괄 생성. `service_role` 키가 필요해 서버에서만 돕니다. 자세한 내용은 [docs/계정-구조.md](docs/계정-구조.md).

---

## 로컬에서 실행하기

`file://` 로 직접 열면 서비스 워커와 마이크 권한이 동작하지 않습니다. 반드시 로컬 서버로 띄우세요.

```bash
npx serve
```

---

## 배포

GitHub Pages 예정 (`https://08hwichemi.github.io/interview-on/`). RLS 가 잠겼으므로 저장소를 공개로 전환해도 됩니다.

하위 경로(`/interview-on/`)에서 서비스되므로 **모든 경로는 상대 경로**여야 합니다. `manifest.json` 의 `start_url`/`scope` 가 `"./"` 이고 서비스 워커 등록이 `'./sw.js'` 인 이유입니다. 절대 경로(`/sw.js`)로 바꾸면 PWA 설치가 깨집니다.

---

## 알려진 문제

- Supabase 대시보드에서 **Leaked Password Protection** 이 꺼져 있음 (Authentication → Policies). 켜면 이미 유출된 비밀번호를 학생들이 못 쓰게 막습니다
- 초기 데이터 로딩이 실패해도 화면에 안내가 약함 (`auth.js` 의 `enterApp` 이 토스트만 띄움)
- 마이크 녹음 중 화면이 꺼지거나 다른 앱으로 전환하면 녹음이 끊김 (모바일 브라우저 제약, 앱 내 경고문으로 안내 중)
- 교사 화면은 아직 뼈대만 있음 (명단 관리·면접 진행·리포트 미구현)
