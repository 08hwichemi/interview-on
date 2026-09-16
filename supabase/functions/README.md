# Edge Function

`create-student-accounts` — 교사·학생 계정을 일괄로 만듭니다.

실제로 돌아가는 코드는 **Supabase에 배포된 것**이고, 여기는 무엇을 하는 함수인지 기록해 두는 자리입니다. 코드를 보거나 고치려면:

- 보기: Supabase 대시보드 → Edge Functions → create-student-accounts
- 고치기: 클로드에게 말하면 바로 배포합니다

## 하는 일

1. 부른 사람이 교사/관리자인지 확인 (아니면 거부)
2. **교사 계정은 관리자만** 만들 수 있음 — 교사가 교사를 늘리지 못하게
3. 아이디가 이미 있으면 건너뜀 (비밀번호 덮어쓰기 방지)
4. 초기 비밀번호 **숫자 6자리** 무작위 생성 (`000000`, `123456` 같은 건 피함)
5. 계정 + 프로필 + (학생이면) 명단 생성. 중간에 실패하면 되돌림
6. 초기 비밀번호는 **응답으로 한 번만** 돌려주고 어디에도 저장하지 않음

`service_role` 키가 필요한 작업이라 브라우저가 아닌 서버에서만 돕니다.

## 요청 형식

```js
await sb.functions.invoke('create-student-accounts', {
  body: {
    role: 'student',          // 또는 'teacher' (관리자만)
    people: [
      { student_no: '20301', name: '홍길동', grade: 3, class_no: 1 },
    ]
  }
});
```

교사는 `name` 이 곧 아이디입니다 (`student_no` 불필요).

## 주의

아이디 → 내부 주소 변환 규칙이 `assets/js/auth.js` 의 `toInternalEmail()` 과 **똑같아야** 합니다. 한쪽만 고치면 모든 로그인이 깨집니다.
