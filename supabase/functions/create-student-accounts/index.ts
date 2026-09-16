// 계정 만들기 / 비밀번호 초기화 / 삭제 — 관리자 전용
//
// 초기 비밀번호는 학교에서 정한 값 하나로 통일합니다(INITIAL_PASSWORD).
// 선생님이 한 명 한 명 비밀번호를 나눠줄 필요 없이 "처음엔 123456" 한마디면 되고,
// 첫 로그인 때 본인 비밀번호로 반드시 바꾸게 되어 있습니다(must_change_password).
//
// 계정 생성에는 service_role 키가 필요한데, 이 키는 절대 브라우저에 들어가면 안 되므로
// 반드시 여기(서버)에서만 씁니다.
//
// 아이디 -> 내부 주소 변환 규칙은 assets/js/auth.js 의 toInternalEmail() 과
// 반드시 같아야 합니다. 한쪽만 고치면 모든 로그인이 깨집니다.

import { createClient } from 'jsr:@supabase/supabase-js@2';

// 학교에서 정한 초기 비밀번호. 여기만 고치면 전체가 따라갑니다.
// 화면 쪽 assets/js/admin-roster.js 의 INITIAL_PW 도 같이 고쳐야 단추 글자가 맞습니다.
const INITIAL_PASSWORD = '123456';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// 한글 아이디를 16진수로 바꿔 이메일 형태의 내부 주소를 만듭니다.
// 교사·관리자는 't', 학생은 's' 로 시작해 서로 부딪치지 않습니다.
function toInternalEmail(loginId: string, role: string, schoolId: string): string {
  const prefix = role === 'student' ? 's' : 't';
  const hex = Array.from(new TextEncoder().encode(loginId.trim()))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}${hex}@${schoolId.slice(0, 8)}.interview-on.local`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST 요청만 받습니다' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // 1. 부른 사람이 누구인지 확인합니다.
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !user) return json({ error: '로그인이 필요합니다' }, 401);

  const { data: profile } = await asCaller
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle();

  // 계정을 만들고 · 되돌리고 · 지우는 일은 전부 관리자 몫입니다.
  // 교사 화면에는 이 기능이 아예 없고, 서버에서도 한 번 더 막습니다.
  if (!profile || profile.role !== 'admin') {
    return json({ error: '관리자만 쓸 수 있습니다' }, 403);
  }
  const schoolId: string = profile.school_id;

  let body: {
    action?: string;
    role?: string;
    people?: Array<Record<string, unknown>>;
    login_ids?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다' }, 400);
  }

  // 2. 여기서부터 관리자 권한. 반드시 위 확인을 통과한 뒤에만 씁니다.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ──────────────────────────────────────────────
  // 비밀번호 초기화
  // ──────────────────────────────────────────────
  if (body.action === 'reset') {
    const ids = Array.isArray(body.login_ids) ? body.login_ids : [];
    if (!ids.length) return json({ error: '초기화할 아이디가 없습니다' }, 400);
    if (ids.length > 500) return json({ error: '한 번에 500명까지만 됩니다' }, 400);

    const done: Array<Record<string, string>> = [];
    const failed: Array<Record<string, string>> = [];

    for (const raw of ids) {
      const loginId = String(raw ?? '').trim();
      if (!loginId) continue;

      const { data: target } = await admin
        .from('profiles')
        .select('id, role, name')
        .eq('school_id', schoolId)
        .eq('login_id', loginId)
        .maybeSingle();

      if (!target) {
        failed.push({ login_id: loginId, reason: '그런 아이디가 없습니다' });
        continue;
      }

      const { error: pwErr } = await admin.auth.admin.updateUserById(target.id, {
        password: INITIAL_PASSWORD,
      });
      if (pwErr) {
        failed.push({ login_id: loginId, reason: pwErr.message });
        continue;
      }

      // 초기 비밀번호로 돌아갔으니 다음 로그인 때 다시 바꾸게 합니다.
      await admin.from('profiles').update({ must_change_password: true }).eq('id', target.id);

      done.push({ login_id: loginId, name: target.name });
    }

    return json({
      action: 'reset',
      initial_password: INITIAL_PASSWORD,
      done,
      failed,
      done_count: done.length,
      failed_count: failed.length,
    });
  }

  // ──────────────────────────────────────────────
  // 계정 삭제
  // ──────────────────────────────────────────────
  if (body.action === 'delete') {
    const ids = Array.isArray(body.login_ids) ? body.login_ids : [];
    if (!ids.length) return json({ error: '지울 아이디가 없습니다' }, 400);
    if (ids.length > 500) return json({ error: '한 번에 500명까지만 됩니다' }, 400);

    const done: Array<Record<string, string>> = [];
    const failed: Array<Record<string, string>> = [];

    for (const raw of ids) {
      const loginId = String(raw ?? '').trim();
      if (!loginId) continue;

      const { data: target } = await admin
        .from('profiles')
        .select('id, role, name')
        .eq('school_id', schoolId)
        .eq('login_id', loginId)
        .maybeSingle();

      if (!target) {
        failed.push({ login_id: loginId, reason: '그런 아이디가 없습니다' });
        continue;
      }

      // 실수로 자기 계정을 지우고 아무도 관리할 수 없게 되는 것을 막습니다
      if (target.id === user.id) {
        failed.push({ login_id: loginId, reason: '지금 로그인한 본인 계정은 지울 수 없습니다' });
        continue;
      }

      // 명단 -> 프로필 -> 계정 순서. 반대로 하면 남은 줄이 없는 사람을 가리킵니다.
      if (target.role === 'student') {
        await admin.from('students').delete().eq('auth_user_id', target.id);
      }
      await admin.from('profiles').delete().eq('id', target.id);

      const { error: delErr } = await admin.auth.admin.deleteUser(target.id);
      if (delErr) {
        failed.push({ login_id: loginId, reason: delErr.message });
        continue;
      }

      done.push({ login_id: loginId, name: target.name });
    }

    return json({
      action: 'delete',
      done,
      failed,
      done_count: done.length,
      failed_count: failed.length,
    });
  }

  // ──────────────────────────────────────────────
  // 계정 만들기
  // ──────────────────────────────────────────────
  const targetRole = body.role === 'teacher' ? 'teacher' : 'student';
  const people = body.people;

  if (!Array.isArray(people) || people.length === 0) {
    return json({ error: '등록할 사람이 없습니다' }, 400);
  }
  if (people.length > 500) {
    return json({ error: '한 번에 500명까지만 등록할 수 있습니다' }, 400);
  }

  const created: Array<Record<string, string>> = [];
  const skipped: Array<Record<string, string>> = [];

  for (const row of people) {
    // 학생은 학번이 아이디, 교사는 이름이 아이디
    const loginId = String(
      targetRole === 'student' ? (row.student_no ?? '') : (row.name ?? ''),
    ).trim();
    const name = String(row.name ?? '').trim();

    if (!loginId || !name) {
      skipped.push({ login_id: loginId, name, reason: '아이디와 이름은 비울 수 없습니다' });
      continue;
    }

    // 이미 있는 아이디는 건드리지 않습니다.
    // 비밀번호를 덮어쓰면 본인이 바꿔 둔 것이 날아갑니다.
    // (일부러 되돌리려면 위의 '비밀번호 초기화'를 씁니다)
    const { data: dup } = await admin
      .from('profiles')
      .select('id')
      .eq('school_id', schoolId)
      .eq('login_id', loginId)
      .maybeSingle();

    if (dup) {
      skipped.push({ login_id: loginId, name, reason: '이미 계정이 있습니다' });
      continue;
    }

    const email = toInternalEmail(loginId, targetRole, schoolId);

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: INITIAL_PASSWORD,
      email_confirm: true, // 확인 메일을 보내지 않습니다
      user_metadata: { login_id: loginId, name },
    });

    if (createErr || !newUser?.user) {
      skipped.push({ login_id: loginId, name, reason: createErr?.message ?? '계정 생성 실패' });
      continue;
    }

    const userId = newUser.user.id;

    const { error: profileErr } = await admin.from('profiles').insert({
      id: userId,
      school_id: schoolId,
      role: targetRole,
      name,
      login_id: loginId,
      must_change_password: true, // 첫 로그인 때 반드시 바꾸게 합니다
    });

    if (profileErr) {
      await admin.auth.admin.deleteUser(userId);
      skipped.push({ login_id: loginId, name, reason: profileErr.message });
      continue;
    }

    // 학생은 명단(students)에도 올립니다. 교사가 면접할 때 고를 수 있게.
    if (targetRole === 'student') {
      const { error: rosterErr } = await admin.from('students').upsert({
        school_id: schoolId,
        student_no: loginId,
        name,
        grade: row.grade ? Number(row.grade) : null,
        class_no: row.class_no ? Number(row.class_no) : null,
        auth_user_id: userId,
      }, { onConflict: 'school_id,student_no' });

      if (rosterErr) {
        await admin.from('profiles').delete().eq('id', userId);
        await admin.auth.admin.deleteUser(userId);
        skipped.push({ login_id: loginId, name, reason: rosterErr.message });
        continue;
      }
    }

    created.push({ login_id: loginId, name });
  }

  return json({
    role: targetRole,
    initial_password: INITIAL_PASSWORD,
    created,
    skipped,
    created_count: created.length,
    skipped_count: skipped.length,
  });
});
