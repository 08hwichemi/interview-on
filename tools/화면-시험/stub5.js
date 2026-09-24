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
          (Array.isArray(v) ? v : [v]).forEach(function (r) {
            const at = rowsOf(table).findIndex(function (x) {
              return keys.every(function (k) { return String(x[k]) === String(r[k]); });
            });
            if (at > -1) Object.assign(rowsOf(table)[at], r);
            else rowsOf(table).push(Object.assign({ id: __id(table) }, r));
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
        if (st.op === 'upsert') return Promise.resolve({ data: null, error: null });
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
      rpc(name) {
        window.__calls.push({ table: '__rpc', op: name });
        if (name === 'admin_chat_count')
          return Promise.resolve({ data: (window.__T.chats || []).length, error: null });
        // 수시지원계획서 앱에서 받아 오기. 진짜는 서버가 다른 방에 물어봅니다.
        if (name === 'sync_susi_plans') {
          // 진짜 서버는 «수시 6장» 만 받아 옵니다 (area='main')
          window.__T.susi_plans = ((window.__FAKE__ && window.__FAKE__.susiFetched) || [])
            .filter(function (r) { return r.area === 'main'; });
          return Promise.resolve({
            data: { rows: window.__T.susi_plans.length,
                    matched_students: new Set(window.__T.susi_plans.map(function (r) {
                      return r.student_no; })).size },
            error: null
          });
        }
        if (name === 'admin_wipe_chats') {
          const n = (window.__T.chats || []).length;
          window.__T.chats = [];
          return Promise.resolve({ data: n, error: null });
        }
        // 학생 접속 표시(presence.js) — 로그인한 학생 본인 줄의 last_seen_at 만 찍습니다
        if (name === 'student_heartbeat') {
          const me = (window.__T.students || []).find(function (s) { return s.auth_user_id === 'u1'; });
          if (me) me.last_seen_at = new Date().toISOString();
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
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
