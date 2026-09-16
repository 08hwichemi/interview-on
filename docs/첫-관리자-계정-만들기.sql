-- ════════════════════════════════════════════════════════════════
--  면접ON — 첫 관리자 계정 만들기
--
--  딱 한 번만 실행합니다. 이 계정으로 로그인한 뒤에는
--  교사·학생 계정을 앱 화면에서 만들 수 있습니다.
--
--  실행하는 곳: supabase.com/dashboard → SmartInterview 프로젝트
--                → 왼쪽 SQL Editor → 붙여넣고 Run
--
--  이메일은 필요 없습니다. 아이디는 한글로 쓰셔도 됩니다.
-- ════════════════════════════════════════════════════════════════

with input as (
  select
    -- ▼▼▼ 이 두 줄만 고치세요 ▼▼▼
    '관리자'::text          as login_id,   -- 로그인할 때 칠 아이디 (한글 가능)
    'Bakkuseyo-1234'::text  as password    -- 비밀번호 (8자 이상, 꼭 바꾸세요)
    -- ▲▲▲ 여기까지 ▲▲▲
),
sch as (
  select id from public.schools order by created_at limit 1
),
mail as (
  -- 앱과 똑같은 규칙으로 내부 주소를 만듭니다.
  -- 교사·관리자는 't', 학생은 's' 로 시작합니다.
  select
    i.login_id,
    i.password,
    't' || encode(convert_to(i.login_id, 'UTF8'), 'hex')
        || '@' || left((select id from sch)::text, 8)
        || '.interview-on.local' as email
  from input i
),
new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    m.email,
    extensions.crypt(m.password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('login_id', m.login_id)
  from mail m
  returning id, email
),
ident as (
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  select
    gen_random_uuid(), u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    'email', u.email, now(), now(), now()
  from new_user u
  returning user_id
),
prof as (
  insert into public.profiles (id, school_id, role, name, login_id, must_change_password)
  select
    u.id, (select id from sch), 'admin',
    (select login_id from input), (select login_id from input),
    false
  from new_user u
  returning id
)
select
  '관리자 계정이 만들어졌습니다'        as 결과,
  (select login_id from input)          as 아이디,
  (select count(*) from ident)          as 신원등록,
  (select count(*) from prof)           as 프로필등록;
