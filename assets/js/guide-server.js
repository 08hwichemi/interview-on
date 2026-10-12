// 연습 모드의 가짜 서버 — 설명서(teacher/guide.html)의 «직접 해 보기» 에서만 씁니다.
//
// 주소 끝에 ?guide 가 붙으면 teacher/index.html 이 진짜 서버 대신 이 파일을 끼웁니다.
// 화면 · 단추 · 코드는 실제 면접 화면 그대로이고, **저장하는 곳만 이 브라우저의 기억**입니다.
//   · 실제 서버(Supabase)에는 아무것도 가지 않습니다 — 요청도, 로그도 없습니다
//   · 학생은 모두 가짜입니다(김연습 · 이보기 …). 실제 학생 이름이 나오지 않습니다
//   · 창을 새로 고치면 처음으로 돌아갑니다
//   · 마이크는 쓰지 않습니다. 받아 적기는 «예시 학생 목소리» 가 흘러나오는 흉내입니다(아래 FakeSpeech)
//
// 짜임은 화면 시험의 가짜 서버(tools/화면-시험/stub5.js)를 옮겨 온 것입니다.
// 앱이 새 표나 새 거르기(.gt 같은 것)를 쓰기 시작하면 여기에도 더해 주세요.

(function () {
  // ── 브라우저 기억(localStorage) 도 따로 ──
  // 연습하며 누른 것(태그 누른 횟수 · 접어 둔 칸 · 마지막에 적은 학교 …)이
  // 실제 면접 화면의 기억에 섞이지 않게, 연습 모드에서는 잠깐 쓰고 버리는 기억으로 바꿔 둡니다.
  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      clear: function () { m = {}; },
      key: function (i) { return Object.keys(m)[i] || null; },
      get length() { return Object.keys(m).length; }
    };
  }
  try {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: memoryStorage(), configurable: true });
  } catch (e) { /* 못 바꾸면 그냥 둡니다 — 연습은 그대로 됩니다 */ }

  // ── 받아 적기 흉내 ──
  // 설명서는 «보여 주는» 시뮬레이션이라(2026-10-12 선생님 말씀 — 마이크 녹음도 예시로 어떻게 되는지 보여 주고 싶다)
  // 크롬의 음성 인식 자리에 가짜를 끼웁니다. «답변 시작» 을 누르면 예시 답변이 한 낱말씩 회색(확정 전)으로 뜨다가
  // 몇 낱말마다 검은 글(확정)로 굳습니다 — 실제 받아 적기와 같은 모양. 마이크 허용도 묻지 않습니다.
  // 무엇을 말할지는 guide-coach.js 의 window.__guideSaid(질문 번호) 가 질문 글자를 보고 골라 줍니다.
  // 다 말하면 window.__guideSpoke[질문 번호] = true
  window.__guideSpoke = {};
  function FakeSpeech() { this.timer = null; }
  FakeSpeech.prototype.start = function () {
    var me = this;
    var qi = typeof window.qIndex === 'number' ? window.qIndex : 0;
    var said = window.__guideSaid || ['안녕하세요 저는 연습 학생입니다'];
    var line = typeof said === 'function' ? said(qi) : said[qi % said.length];
    if (window.__guideSpoke[qi]) return;              // 이 질문은 이미 다 말함 — 조용히 듣기만
    // 마이크 허용 창(연습용 그림, guide-coach.js)에서 «허용» 을 누르기 전에는 말하지 않습니다 — 실제 크롬도 그렇습니다
    if (!window.__guideMicOK) { me.timer = setTimeout(function () { me.start(); }, 200); return; }
    // 듣기가 끊겼다 다시 켜지면(질문 저장 등) 처음부터가 아니라 말하던 데서 잇습니다 — 끊길 때의 회색 글은 listen.js 가 이미 붙입니다
    window.__guideSpeechAt = window.__guideSpeechAt || {};
    var words = line.split(' '), at = window.__guideSpeechAt[qi] || 0, chunk = [];
    function emit(textNow, fin) {
      var r = [{ transcript: textNow }]; r.isFinal = fin;
      if (me.onresult) me.onresult({ resultIndex: 0, results: [r] });
    }
    (function next() {
      if (at >= words.length) {
        if (chunk.length) emit(chunk.join(' ') + ' ', true);
        window.__guideSpoke[qi] = true;
        return;
      }
      chunk.push(words[at++]);
      window.__guideSpeechAt[qi] = at;
      if (chunk.length >= 5) { emit(chunk.join(' ') + ' ', true); chunk = []; }
      else emit(chunk.join(' '), false);
      me.timer = setTimeout(next, 330);   // 한 낱말에 0.33초 — 실제 말하는 빠르기쯤(처음 0.23초는 너무 빨라 따라 읽기 어려웠음)
    })();
  };
  FakeSpeech.prototype.stop = FakeSpeech.prototype.abort = function () {
    var me = this;
    clearTimeout(me.timer);
    setTimeout(function () { if (me.onend) me.onend(); }, 0);
  };
  window.SpeechRecognition = FakeSpeech;
  window.webkitSpeechRecognition = FakeSpeech;

  var ME = 'guide-teacher';
  var now = Date.now();
  function ago(days) { return new Date(now - days * 86400000).toISOString(); }

  // ── 가짜 자료 ──
  // 김연습(30101)은 «지난 면접 1회차 · 수시 지원» 이 있어 준비 화면이 실제와 같은 모양으로 보입니다.
  var T = {
    profiles: [{ id: ME, role: 'teacher', name: '연습 선생님', login_id: '연습 선생님' }],
    students: [
      ['g01', '30101', '김연습'], ['g02', '30102', '이보기'], ['g03', '30103', '박미리'],
      ['g04', '30104', '최시범'], ['g05', '30105', '정예시'], ['g06', '30106', '한연습'],
      ['g07', '30201', '오보기'], ['g08', '30202', '서미리'], ['g09', '30203', '윤시범'],
      ['g10', '30204', '장예시'], ['g11', '30205', '임연습'], ['g12', '30206', '강보기']
    ].map(function (r) { return { id: r[0], student_no: r[1], name: r[2], auth_user_id: null, grade: 3 }; }),
    teacher_favorites: [],
    teacher_other_favorites: [],
    common_questions: [
      ['changche', '동아리 활동에서 맡은 역할과, 그 역할을 하며 배운 점을 말해 주세요.'],
      ['changche', '친구들과 의견이 달랐던 경험이 있다면 어떻게 풀었는지 말해 주세요.'],
      ['changche', '봉사 활동 가운데 가장 기억에 남는 것과 그 까닭은 무엇인가요?'],
      ['changche', '학급이나 학교를 위해 스스로 나서서 한 일이 있나요?'],
      ['changche', '자율 활동에서 가장 보람 있었던 일을 말해 주세요.'],
      ['major', '이 학과에 들어오면 가장 먼저 공부해 보고 싶은 것은 무엇인가요?'],
      ['major', '지원한 전공과 관련해 최근에 읽은 책이나 기사를 소개해 주세요.'],
      ['major', '고등학교에서 들은 과목 가운데 전공과 가장 이어지는 과목은 무엇인가요?'],
      ['major', '졸업한 뒤 어떤 일을 하고 싶은지, 그 까닭과 함께 말해 주세요.'],
      ['major', '전공 공부에서 가장 어려울 것 같은 점과 그것을 어떻게 준비하고 있는지 말해 주세요.']
    ].map(function (r, i) { return { id: 'cq' + i, category: r[0], content: r[1] }; }),
    susi_plans: [
      [1, '한빛대학교', '학생부종합', '면접형', '화학공학과', '2026/10/24'],
      [2, '누리대학교', '학생부종합', '활동우수형', '신소재공학과', ''],
      [3, '가람대학교', '학생부교과', '지역균형', '화학공학과', ''],
      [4, '새솔대학교', '학생부종합', '서류형', '에너지공학과', ''],
      [5, '하늬대학교', '학생부종합', '면접형', '화학과', '2026/11/07'],
      [6, '다솜대학교', '논술', '논술전형', '화학공학과', '']
    ].map(function (r) {
      return { student_no: '30101', area: 'main', slot: r[0], uni_name: r[1], type_name: r[2],
               admission_name: r[3], dept_name: r[4], interview_date: r[5], synced_at: ago(2) };
    }),
    interviews: [{
      id: 'guide-past-1', school_id: 'guide', student_id: 'g01', teacher_id: ME, teacher_name: '연습 선생님',
      status: '전달됨', started_at: ago(21), finished_at: ago(21), delivered_at: ago(21),
      total_seconds: 512, grades: { '학업태도': 'B', '탐구력': 'B', '진로 탐색 활동과 경험': 'A', '의사소통 능력': 'C' },
      overall_note: '경험은 풍부한데 결론을 먼저 말하는 연습이 필요합니다.'
    }],
    interview_answers: [
      { interview_id: 'guide-past-1', seq: 1, competency: '기타', question: '먼저 간단히 자기소개를 해 주세요.',
        seconds: 64, rating: '보통', memo: '첫 문장이 길었음. 이름과 관심 분야를 먼저.',
        transcript: '안녕하세요 저는 화학공학과에 지원한 김연습입니다 저는 어릴 때부터 실험을 좋아해서',
        good_tags: ['동기가 분명함'], bad_tags: ['결론이 맨 뒤에 나옴'], marks: [], areas: { '내용': '보통', '말하기': '아쉬움' } },
      { interview_id: 'guide-past-1', seq: 2, competency: '학업역량', question: '화학 세특에 적힌 탐구는 무엇이 궁금해서 시작했나요?',
        seconds: 118, rating: '우수', memo: '과정을 순서대로 잘 설명함.',
        transcript: '수업에서 반응 속도를 배우고 온도가 정말 그만큼 영향을 주는지 궁금해서 직접 실험을 설계했습니다',
        good_tags: ['과정을 순서대로 설명', '직접 한 일이 드러남'], bad_tags: [], marks: [], areas: { '내용': '좋음', '근거': '좋음' } },
      { interview_id: 'guide-past-1', seq: 3, competency: '기타', question: '마지막으로 하고 싶은 말이 있나요?',
        seconds: 40, rating: '보통', memo: '', transcript: '', good_tags: [], bad_tags: [], marks: [], areas: {} }
    ].map(function (r, i) { r.id = 'guide-pa-' + i; return r; }),
    chats: [], announcements: [], report_reads: [], practice_answers: [], practice_categories: [],
    practice_comments: [], practice_comment_reads: [], practice_offers: [], hugi_sheets: [], hugi_templates: []
  };
  var seq = 0;
  function newId(p) { seq += 1; return 'guide-' + p + '-' + seq; }
  function rowsOf(t) { return (T[t] = T[t] || []); }

  // 설명서 안내 칸(guide-coach.js)이 연습 자료를 넣고 볼 수 있게 열어 둡니다
  window.__guideDB = T;
  window.__guideMe = ME;

  function builder(table) {
    var st = { op: 'select', eq: {}, neq: {}, inn: {}, isNull: {}, notNull: {} };
    var b = {
      select: function (cols, opt) { if (opt && opt.count) st.wantCount = true; return b; },
      insert: function (v) {
        st.op = 'insert';
        st.made = (Array.isArray(v) ? v : [v]).map(function (r) {
          var row = Object.assign({ id: newId(table), created_at: new Date().toISOString() }, r);
          if (table === 'interviews' && !row.started_at) row.started_at = new Date().toISOString();
          rowsOf(table).push(row);
          return row;
        });
        return b;
      },
      upsert: function (v, opt) {
        st.op = 'upsert';
        var keys = ((opt && opt.onConflict) || 'id').split(',');
        st.made = [];
        (Array.isArray(v) ? v : [v]).forEach(function (r) {
          var hit = rowsOf(table).filter(function (x) {
            return keys.every(function (k) { return String(x[k]) === String(r[k]); });
          })[0];
          if (hit) { if (!(opt && opt.ignoreDuplicates)) { Object.assign(hit, r); st.made.push(hit); } }
          else {
            var row = Object.assign({ id: newId(table), created_at: new Date().toISOString() }, r);
            rowsOf(table).push(row); st.made.push(row);
          }
        });
        return b;
      },
      update: function (v) { st.op = 'update'; st.payload = v; return b; },
      delete: function () { st.op = 'delete'; return b; },
      eq: function (k, v) { st.eq[k] = v; return b; },
      neq: function (k, v) { st.neq[k] = v; return b; },
      in: function (k, vals) { st.inn[k] = vals; return b; },
      is: function (k, v) { if (v === null) st.isNull[k] = true; return b; },
      not: function (k, op, v) { if (op === 'is' && v === null) st.notNull[k] = true; return b; },
      or: function (expr) { st.or = expr; return b; },
      order: function (col, opts) { st.orderBy = col; st.orderAsc = !opts || opts.ascending !== false; return b; },
      limit: function (n) { st.limit = n; return b; },
      range: function (from, to) { st.rangeFrom = from; st.rangeTo = to; return b; },
      single: function () { return run().then(function (r) { return { data: (r.data || [])[0] || null, error: r.error }; }); },
      maybeSingle: function () { return b.single(); },
      then: function (res, rej) {
        return run().then(function (r) {
          if (st.wantCount) return { data: r.data, count: (r.data || []).length, error: r.error };
          return r;
        }).then(res, rej);
      }
    };

    function pick(list) {
      Object.keys(st.eq).forEach(function (k) { list = list.filter(function (r) { return String(r[k]) === String(st.eq[k]); }); });
      Object.keys(st.neq).forEach(function (k) { list = list.filter(function (r) { return String(r[k]) !== String(st.neq[k]); }); });
      Object.keys(st.inn).forEach(function (k) { list = list.filter(function (r) { return st.inn[k].indexOf(r[k]) > -1; }); });
      Object.keys(st.isNull).forEach(function (k) { list = list.filter(function (r) { return r[k] == null; }); });
      Object.keys(st.notNull).forEach(function (k) { list = list.filter(function (r) { return r[k] != null; }); });
      if (st.or) {
        var conds = st.or.split(',').map(function (c) {
          var m = c.match(/^(\w+)\.eq\.(.+)$/); return m ? { col: m[1], val: m[2] } : null;
        }).filter(Boolean);
        if (conds.length) list = list.filter(function (r) { return conds.some(function (c) { return String(r[c.col]) === c.val; }); });
      }
      return list;
    }

    // 진짜 서버처럼 «사본» 을 돌려줍니다 — 화면이 받은 것을 고쳐도 표가 같이 바뀌지 않게
    function copy(list) { return list.map(function (r) { return JSON.parse(JSON.stringify(r)); }); }

    function run() {
      if (st.op === 'insert' || st.op === 'upsert') return Promise.resolve({ data: copy(st.made), error: null });
      if (st.op === 'update') {
        var hit = pick(rowsOf(table));
        hit.forEach(function (r) { Object.assign(r, JSON.parse(JSON.stringify(st.payload))); });
        return Promise.resolve({ data: copy(hit), error: null });
      }
      if (st.op === 'delete') {
        var gone = pick(rowsOf(table));
        T[table] = rowsOf(table).filter(function (r) { return gone.indexOf(r) === -1; });
        // 면접 줄을 지우면 질문 · 평가도 같이 (진짜 서버의 on delete cascade)
        if (table === 'interviews') {
          var ids = gone.map(function (r) { return r.id; });
          T.interview_answers = rowsOf('interview_answers').filter(function (a) { return ids.indexOf(a.interview_id) === -1; });
          T.teacher_other_favorites = rowsOf('teacher_other_favorites').filter(function (f) { return ids.indexOf(f.interview_id) === -1; });
        }
        return Promise.resolve({ data: null, error: null });
      }
      var list = pick(rowsOf(table).slice());
      if (st.orderBy) {
        list.sort(function (a, z) {
          var x = a[st.orderBy], y = z[st.orderBy];
          if (x === y) return 0;
          return (x > y ? 1 : -1) * (st.orderAsc ? 1 : -1);
        });
      }
      if (st.limit) list = list.slice(0, st.limit);
      if (st.rangeFrom != null) list = list.slice(st.rangeFrom, st.rangeTo + 1);
      return Promise.resolve({ data: copy(list), error: null });
    }
    return b;
  }

  // 진짜 supabase-js 의 rpc 는 then 만 있는 빌더입니다 — 같은 모양으로 돌려줍니다(stub5.js 설명 참고)
  function result(data) {
    return { then: function (res, rej) { return Promise.resolve({ data: data, error: null }).then(res, rej); } };
  }

  window.supabase = {
    createClient: function () {
      return {
        auth: {
          getSession: function () { return Promise.resolve({ data: { session: { user: { id: ME } } }, error: null }); },
          getUser: function () { return Promise.resolve({ data: { user: { id: ME } }, error: null }); },
          onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
          signOut: function () { return Promise.resolve({}); }
        },
        from: builder,
        rpc: function (name) {
          if (name === 'app_badges') return result({ notice: null, chat_unread: 0, chat_last: null, is_student: false });
          return result(null);
        },
        functions: { invoke: function () { return Promise.resolve({ data: {}, error: null }); } },
        channel: function () { var ch = { on: function () { return ch; }, subscribe: function () { return ch; } }; return ch; },
        removeChannel: function () { return Promise.resolve(); }
      };
    }
  };
})();
