# 면접ON — 스마트 면접 대비 앱

고등학생 대입 면접 준비를 돕는 웹앱(PWA). 대학별 면접 후기·기출 질문을 찾아보고, 실제 면접처럼 시간을 재며 답변을 녹음해 연습할 수 있습니다.

**개발**: 이용휘

---

## 어디서든 코드 고치는 법

이 저장소를 깃허브에서 연 다음, 주소창에서 `github.com` → **`github.dev`** 로 바꾸면 (또는 파일 목록 화면에서 키보드 `.` 를 누르면) 브라우저 안에서 바로 VS Code가 열립니다. 설치할 것도 로그인할 것도 없고, 아이패드에서도 됩니다.

고친 뒤 왼쪽 소스 제어 탭에서 메시지를 쓰고 커밋하면 그대로 저장됩니다.

---

## 파일 구조

```
.
├── index.html              화면 마크업 (270줄)
├── manifest.json           PWA 설치 정보
├── sw.js                   서비스 워커 — 네트워크 우선, 오프라인일 때만 캐시
├── .nojekyll               GitHub Pages 가 파일을 건드리지 않게 하는 표식
└── assets/
    ├── icon-192.png        앱 아이콘 (36KB)
    ├── icon-512.png        앱 아이콘 고해상도 (283KB)
    ├── icon-original.png   원본 (1372×1457, 크기 조절용 보관본)
    ├── css/
    │   ├── base.css        초기화·레이아웃·헤더·로그인·모달
    │   └── app.css         카드·훈련 화면·토스트·푸터
    └── js/
        ├── config.js       수파베이스 주소/키, 전역 변수
        ├── utils.js        getFilteredList, populateSelect, toggleCard
        ├── api.js          supabaseRequest — 모든 서버 통신이 여기를 지납니다
        ├── ui.js           화면 전환, 토스트, 확인창, 대학 선택 모달
        ├── auth.js         입장 코드 검증
        ├── reviews.js      면접 후기 — 필터·조회·목록 그리기
        ├── questions.js    기출 질문 — 필터·조회·목록 그리기
        ├── interview.js    모의 면접 — 질문 세팅, 스톱워치, 녹음, 결과 리포트
        └── main.js         앱 시작점 (초기 데이터 로딩, 서비스 워커 등록)
```

### 고칠 곳 찾기

| 하고 싶은 일 | 볼 파일 |
|---|---|
| 면접 후기 목록 모양 바꾸기 | `assets/js/reviews.js` |
| 기출 질문 목록 모양 바꾸기 | `assets/js/questions.js` |
| 녹음·타이머 동작 바꾸기 | `assets/js/interview.js` |
| 색·글씨·여백 바꾸기 | `assets/css/base.css`, `assets/css/app.css` |
| 버튼·화면 추가하기 | `index.html` |
| 서버에서 가져오는 항목 바꾸기 | `assets/js/api.js` |

### ⚠️ 스크립트는 일반 `<script>` 입니다 — `type="module"` 로 바꾸지 마세요

화면의 버튼들이 `onclick="navigateTo('home')"` 처럼 **함수를 이름으로 직접 부릅니다.**
모듈로 바꾸면 함수가 전역에서 사라져 **모든 버튼이 한꺼번에 죽습니다.**

`index.html` 맨 아래 로딩 순서도 의미가 있습니다:
`config → utils → api → ui → auth → reviews → questions → interview → main`

---

## 데이터베이스 (Supabase)

프로젝트: `ymtahsghrkqdxalcvcau` (REST API 직접 호출, SDK 미사용)

| 테이블 | 용도 | 주요 컬럼 | 행 수 |
|---|---|---|---|
| `reviews` | 면접 후기 | `년도`, `대학`, `세부유형`, `모집단위`, `합불` | 814 |
| `questions` | 기출 질문 | `년도`, `대학`, `전형/역량1`, `역량2` | 722 |
| `common_questions` | AI 추천 질문 | `category` (`changche` / `major`) | — |

**컬럼명이 한글입니다.** REST 쿼리에서 `encodeURIComponent` 로 감싸 처리합니다 (`assets/js/api.js` 참고).

### 🔴 보안: RLS 미적용 (해결 필요)

현재 `reviews` 테이블은 **anon 키만 있으면 누구나 814행 전체를 읽을 수 있습니다.** 입장 코드는 화면만 가릴 뿐 데이터를 보호하지 못합니다. anon 키는 `assets/js/config.js` 에 들어 있고, 배포된 사이트에서 브라우저 개발자도구로 바로 보입니다.

→ 수파베이스 Auth 계정 로그인 도입과 **함께** RLS 정책을 걸어야 합니다. 로그인 없이 RLS만 켜면 앱이 통째로 멈춥니다.

**이 문제가 해결되기 전까지 저장소를 공개(public)로 바꾸지 마세요.**

---

## 로컬에서 실행하기

`file://` 로 직접 열면 서비스 워커와 마이크 권한이 동작하지 않습니다. 반드시 로컬 서버로 띄우세요.

```bash
npx serve
```

---

## 배포

GitHub Pages 예정 (`https://08hwichemi.github.io/interview-on/`). 위 RLS 문제를 해결하고 저장소를 공개로 전환한 뒤 켭니다. 그 전까지는 기존 네트리파이 주소를 사용합니다.

하위 경로(`/interview-on/`)에서 서비스되므로 **모든 경로는 상대 경로**여야 합니다. `manifest.json` 의 `start_url`/`scope` 가 `"./"` 이고 서비스 워커 등록이 `'./sw.js'` 인 이유입니다. 절대 경로(`/sw.js`)로 바꾸면 PWA 설치가 깨집니다.

---

## 알려진 문제

- **RLS 미적용** (위 참고) — 최우선 과제
- 초기 데이터 로딩이 실패해도 화면에 아무 안내가 없음 (`main.js` 의 `catch` 가 콘솔에만 기록)
- 마이크 녹음 중 화면이 꺼지거나 다른 앱으로 전환하면 녹음이 끊김 (모바일 브라우저 제약, 앱 내 경고문으로 안내 중)
- 교사↔학생 실시간 피드백 기능 미구현
