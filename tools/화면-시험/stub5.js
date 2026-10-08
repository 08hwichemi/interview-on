// 가짜 서버 (stub5) — 표를 «진짜 표처럼» 여러 줄로 둡니다.
//
// stub4 는 면접을 한 건만 들고 있어서, «미리 만들어 둔 질문지 + 지난 회차»처럼
// 여러 줄이 필요한 검사를 못 합니다. 그래서 이 판은 표를 통째로 흉내 냅니다.
// eq · neq · in · or · order · limit · single 까지 받습니다.
window.__calls = [];
window.__T = {
  profiles: [], students: [], interviews: [], interview_answers: [],
  teacher_favorites: [], common_questions: [], chats: [], report_reads: [],
  susi_plans: []
};
window.__seq = 0;
function __id(p) { window.__seq += 1; return p + '-' + window.__seq; }

window.supabase = {
  createClient: function () {
    const F = window.__FAKE__ || { profile: null, rows: {} };
    Object.keys(F.rows || {}).forEach(function (t) {
      window.__T[t] = (F.rows[t] || []).map(function (r) { return Object.assign({}, r); });
    });

    function rowsOf(t) { return (window.__T[t] = window.__T[t] || []); }

    function builder(table) {
      const st = { table: table, op: 'select', eq: {}, neq: {}, inn: {} };
      const b = {
        select(cols, opt) { if (opt && opt.count) st.wantCount = true; return b; },
        insert(v) {
          st.op = 'insert'; st.payload = v;
          window.__calls.push({ table: table, op: 'insert', v: v });
          st.made = (Array.isArray(v) ? v : [v]).map(function (r) {
            const row = Object.assign({ id: __id(table), created_at: new Date().toISOString() }, r);
            if (table === 'interviews' && !row.started_at) row.started_at = new Date().toISOString();
            rowsOf(table).push(row);
            return row;
          });
          return b;
        },
        upsert(v, opt) {
          st.op = 'upsert';
          window.__calls.push({ table: table, op: 'upsert', v: v });
          const keys = ((opt && opt.onConflict) || 'id').split(',');
          // ignoreDuplicates — 진짜 서버의 «on conflict do nothing». 이미 있는 줄은 건드리지 않고,
          // .select() 로 받는 것은 «새로 들어간 줄» 뿐입니다
          st.made = [];
          (Array.isArray(v) ? v : [v]).forEach(function (r) {
            const at = rowsOf(table).findIndex(function (x) {
              return keys.every(function (k) { return String(x[k]) === String(r[k]); });
            });
            if (at > -1) { if (!(opt && opt.ignoreDuplicates)) { Object.assign(rowsOf(table)[at], r); st.made.push(rowsOf(table)[at]); } }
            else {
              const row = Object.assign({ id: __id(table), created_at: new Date().toISOString() }, r);
              rowsOf(table).push(row); st.made.push(row);
            }
          });
          return b;
        },
        update(v) { st.op = 'update'; st.payload = v; window.__calls.push({ table: table, op: 'update', v: v }); return b; },
        delete() { st.op = 'delete'; window.__calls.push({ table: table, op: 'delete' }); return b; },
        eq(k, v) { st.eq[k] = v; return b; },
        neq(k, v) { st.neq[k] = v; return b; },
        in(k, vals) { st.inn[k] = vals; return b; },
        or(expr) { st.or = expr; return b; },
        order(col, opts) { st.orderBy = col; st.orderAsc = !opts || opts.ascending !== false; return b; },
        limit(n) { st.limit = n; return b; },
        range(from, to) { st.rangeFrom = from; st.rangeTo = to; return b; },
        single() { return run().then(function (r) { return { data: (r.data || [])[0] || null, error: r.error }; }); },
        maybeSingle() { return b.single(); },
        then(res, rej) {
          return run().then(function (r) {
            if (st.wantCount) return { data: r.data, count: (r.data || []).length, error: r.error };
            return r;
          }).then(res, rej);
        }
      };

      function 거르기(list) {
        Object.keys(st.eq).forEach(function (k) {
          list = list.filter(function (r) { return String(r[k]) === String(st.eq[k]); });
        });
        Object.keys(st.neq).forEach(function (k) {
          list = list.filter(function (r) { return String(r[k]) !== String(st.neq[k]); });
        });
        Object.keys(st.inn).forEach(function (k) {
          list = list.filter(function (r) { return st.inn[k].indexOf(r[k]) > -1; });
        });
        if (st.or) {
          const conds = st.or.split(',').map(function (c) {
            const m = c.match(/^(\w+)\.eq\.(.+)$/); return m ? { col: m[1], val: m[2] } : null;
          }).filter(Boolean);
          list = list.filter(function (r) {
            return conds.some(function (c) { return String(r[c.col]) === c.val; });
          });
        }
        return list;
      }

      function run() {
        if (st.op === 'insert') return Promise.resolve({ data: st.made, error: null });
        if (st.op === 'upsert') return Promise.resolve({ data: st.made, error: null });
        if (st.op === 'update') {
          const hit = 거르기(rowsOf(table));
          hit.forEach(function (r) { Object.assign(r, st.payload); });
          return Promise.resolve({ data: hit, error: null });
        }
        if (st.op === 'delete') {
          const hit = 거르기(rowsOf(table));
          window.__T[table] = rowsOf(table).filter(function (r) { return hit.indexOf(r) === -1; });
          return Promise.resolve({ data: null, error: null });
        }
        let list = 거르기(rowsOf(table).slice());
        if (st.orderBy) {
          list.sort(function (a, z) {
            const x = a[st.orderBy], y = z[st.orderBy];
            if (x === y) return 0;
            return (x > y ? 1 : -1) * (st.orderAsc ? 1 : -1);
          });
        }
        if (st.limit) list = list.slice(0, st.limit);
        if (st.rangeFrom != null) list = list.slice(st.rangeFrom, st.rangeTo + 1);
        return Promise.resolve({ data: list, error: null });
      }

      return b;
    }

    return {
      auth: {
        getSession() { return Promise.resolve({ data: { session: { user: { id: 'u1' } } } }); },
        getUser() { return Promise.resolve({ data: { user: { id: 'u1' } } }); },
        signOut() { return Promise.resolve({}); }
      },
      from: builder,
      // 서버 함수 (rpc). 지금은 «톡 개수» 하나만 씁니다 —
      // 관리자는 남의 톡 «내용» 은 못 읽고 개수만 봅니다.
      //
      // ⚠️ 진짜 supabase-js 의 sb.rpc(...) 는 진짜 Promise 가 아니라 «then 만 있는»
      //    빌더입니다. 여기서 그냥 Promise.resolve(...) 를 돌려주면(진짜 Promise라
      //    .catch 가 있음) 화면 쪽 코드가 실수로 .catch() 를 이어 붙여도 시험에서는
      //    안 걸리고 실제 배포에서만 "catch is not a function" 으로 터집니다
      //    (실제로 한 번 이렇게 겪었습니다 — presence.js 의 하트비트). 그래서 일부러
      //    then() 만 있는 얇은 객체로 감싸 돌려줍니다.
      rpc(name) {
        window.__calls.push({ table: '__rpc', op: name });
        function 결과(data, error) {
          return { then(res, rej) { return Promise.resolve({ data: data, error: error || null }).then(res, rej); } };
        }
        if (name === 'admin_chat_count')
          return 결과((window.__T.chats || []).length);
        // 수시지원계획서 앱에서 받아 오기. 진짜는 서버가 다른 방에 물어봅니다.
        if (name === 'sync_susi_plans') {
          // 진짜 서버는 «수시 6장» 만 받아 옵니다 (area='main')
          window.__T.susi_plans = ((window.__FAKE__ && window.__FAKE__.susiFetched) || [])
            .filter(function (r) { return r.area === 'main'; });
          return 결과({ rows: window.__T.susi_plans.length,
                       matched_students: new Set(window.__T.susi_plans.map(function (r) {
                         return r.student_no; })).size });
        }
        if (name === 'admin_wipe_chats') {
          const n = (window.__T.chats || []).length;
          window.__T.chats = [];
          return 결과(n);
        }
        // 빨간 숫자 한꺼번에(badges.js · 2026-10-08) — 진짜 서버 함수 public.app_badges 를 흉내 냅니다.
        // 로그인은 늘 u1 입니다. 학생 몫은 u1 이 학생일 때만, 진짜 RLS 처럼 «내 것» 만 셉니다.
        if (name === 'app_badges') {
          if (window.__noBadgesRpc) return 결과(null, { message: 'function app_badges does not exist' });
          const T = window.__T, uid = 'u1';
          const meS = (T.students || []).find(function (s) { return s.auth_user_id === uid; });
          const mine = (T.chats || []).filter(function (c) { return c.sender_id === uid || c.receiver_id === uid; });
          const ann = (T.announcements || []).find(function (a) { return a.active; });
          const out = {
            notice: ann ? { content: ann.content, link: ann.link, updated_at: ann.updated_at } : null,
            chat_unread: mine.filter(function (c) { return c.receiver_id === uid && !c.is_read; }).length,
            chat_last: mine.reduce(function (m, c) { return !m || c.created_at > m ? c.created_at : m; }, null),
            is_student: !!meS
          };
          if (meS) {
            // 예전 가짜 서버는 RLS 없이 표를 통째로 줬습니다 — 검사 자료가 그걸 믿고 있어서, 학생·상태가 적혀 있을 때만 거릅니다
            out.reports = (T.interviews || []).filter(function (i) {
                return (!i.student_id || i.student_id === meS.id) && (!i.status || i.status === '전달됨'); })
              .sort(function (a, z) { return String(z.started_at).localeCompare(String(a.started_at)); })
              .map(function (i) { return { id: i.id, started_at: i.started_at, delivered_at: i.delivered_at, edited_at: i.edited_at }; });
            out.report_reads = (T.report_reads || []).filter(function (r) { return r.user_id === uid; })
              .map(function (r) { return { interview_id: r.interview_id, read_at: r.read_at }; });
            const read = (T.practice_comment_reads || []).filter(function (r) { return r.user_id === uid; }).map(function (r) { return r.comment_id; });
            out.comments_unread = (T.practice_comments || []).filter(function (c) { return read.indexOf(c.id) === -1; }).length;
            out.offers_new = (T.practice_offers || []).filter(function (o) { return o.status === '새로' && (!o.student_id || o.student_id === meS.id); }).length;
          }
          return 결과(out);
        }
        // 학생 접속 표시(presence.js) — 로그인한 학생 본인 줄의 last_seen_at 만 찍습니다
        if (name === 'student_heartbeat') {
          const me = (window.__T.students || []).find(function (s) { return s.auth_user_id === 'u1'; });
          if (me) me.last_seen_at = new Date().toISOString();
          return 결과(null);
        }
        return 결과(null);
      },
      functions: {
        invoke(name, opts) {
          // Edge Function 은 계정을 지웁니다. 무엇을 보냈는지 남겨 두고,
          // 표에서도 그 사람들을 지워 진짜처럼 굴게 합니다.
          const body = (opts && opts.body) || {};
          window.__fnBody = body;
          window.__calls.push({ table: '__fn', op: name, v: body });
          if (body.action === 'delete') {
            const ids = body.login_ids || [], done = [];
            ids.forEach(function (id) {
              const pr = (window.__T.profiles || []).filter(function (x) { return x.login_id === id; })[0];
              const st = (window.__T.students || []).filter(function (x) { return String(x.student_no) === String(id); })[0];
              if (!pr && !st) return;
              window.__T.profiles = (window.__T.profiles || []).filter(function (x) { return x.login_id !== id; });
              window.__T.students = (window.__T.students || []).filter(function (x) { return String(x.student_no) !== String(id); });
              done.push({ login_id: id });
            });
            return Promise.resolve({ data: { action: 'delete', done: done, failed: [] }, error: null });
          }
          return Promise.resolve({ data: {}, error: null });
        }
      },
      channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; },
      removeChannel() { return Promise.resolve(); }
    };
  }
};
