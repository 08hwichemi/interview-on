// 연습 모드의 안내 — 설명서(teacher/guide.html)의 «직접 해 보기» 에서만 뜹니다.
//
// **시뮬레이션**입니다 — 실제 면접 화면 위에서, 미리 준비된 내용으로 «어디를 눌러서 어떻게 되는지» 순서를 보여 줍니다.
// 선생님은 주황 테두리 단추만 누르고, 글자(질문 · 요지 · 총평 · 학교 · 이름)와 학생 답변(받아 적기)은 예시가 저절로 채워집니다.
// 2026-10-12 선생님 말씀이 두 번 있었습니다 —
//   ① «오른쪽 아래 다음 버튼처럼 말고 실제 버튼 누르는 것처럼» → 안내용 «다음» 단추 없이, 테두리 친 단추를 눌러야 넘어감
//   ② «직접 만져서 돌아가는 게 아니라 미리 내용이 있고, 버튼 누르면 내용은 자동으로 예시가 뜨게. 마이크 녹음도 예시로»
//      → 입력 · 마이크를 쓰지 않음. 칸을 누르면 예시가 쳐지고, 받아 적기는 가짜 음성 인식(guide-server.js)이 예시 답변을 «말함»
// 저장은 가짜 서버(guide-server.js)에만 됩니다.
//
//   · done 이 참이 되면 저절로 다음 걸음. 장이 끝나면 잠깐 알리고 다음 장으로
//   · 장(章)마다 setup 이 있어서 목차에서 바로 그 장으로 건너뛰어도 화면을 알맞게 맞춰 둡니다
//
// ⚠️ 화면의 단추 이름 · id 를 바꾸면 여기 설명도 같이 고쳐 주세요.
//    tools/화면-시험/check-guide.js 가 걸음마다 테두리 둘 곳이 화면에 있는지, 진짜 단추로 넘어가는지 확인합니다.

(function () {
  var MAIN = 'g01';          // 김연습 — 지난 면접 · 수시 지원이 있는 가짜 학생 (guide-server.js)
  var RESUME = 'g02';        // 이보기 — «창이 닫혔을 때» 장에서 끝내지 못한 면접을 붙여 둡니다

  function $(s) { return document.querySelector(s); }
  function on(view) { var el = document.getElementById('view-' + view); return !!el && !el.hidden; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function cur() { return (typeof answers !== 'undefined' && answers[qIndex]) || null; }

  // 연습용 답변 — 마이크 없이 넘길 때 «학생이 말한 내용» 칸을 채웁니다
  var SAID = [
    '안녕하세요 저는 화학공학과에 지원한 김연습입니다 어릴 때부터 실험을 좋아했고 고등학교에서 반응 속도 탐구를 하면서 이 학과에 가고 싶다는 마음이 커졌습니다',
    '동아리에서 실험 기록을 맡았는데 처음에는 기록이 들쭉날쭉해서 실험을 다시 해야 했습니다 그래서 표 양식을 만들어 모두가 같은 방법으로 적게 했고 그 뒤로는 실험이 훨씬 빨라졌습니다',
    '의견이 다를 때는 먼저 친구가 왜 그렇게 생각하는지 끝까지 들었습니다 그리고 두 방법을 작게 한 번씩 해 보고 결과를 보고 정하자고 했습니다',
    '온도를 바꿔 가며 반응 속도를 쟀는데 온도계를 넣는 위치에 따라 값이 달라서 가장 어려웠습니다 같은 자리에 고정하는 틀을 만들어 해결했습니다',
    '감사합니다 오늘 면접을 준비하면서 제가 한 활동을 다시 정리할 수 있었고 대학에 가서도 궁금한 것을 직접 실험으로 확인하는 학생이 되겠습니다'
  ];

  // 꼬리 질문 예시와 그 답
  var FOLLOW_Q = '그 틀을 만들 생각은 어떻게 하게 됐나요?';
  var FOLLOW_A = '같은 실험을 세 번 했는데 값이 다 달라서 원인을 찾다가 온도계 위치가 매번 다르다는 걸 알았습니다 그래서 집게로 고정해 보자고 생각했습니다';
  // 받아 적기 흉내(guide-server.js)가 «몇 번째 질문의 답» 을 물으면, 질문 글자를 보고 알맞은 예시 답을 고릅니다.
  // 번호로만 고르면 꼬리 질문을 끼워 넣었을 때 답이 한 칸씩 어긋납니다
  function saidFor(i) {
    var q = (typeof questions !== 'undefined' && questions[i] && questions[i].text) || '';
    if (q === FOLLOW_Q || /꼬리 질문/.test(q)) return FOLLOW_A;
    if (/자기소개/.test(q)) return SAID[0];
    if (/동아리/.test(q)) return SAID[1];
    if (/의견/.test(q)) return SAID[2];
    if (/반응 속도|실험|탐구/.test(q)) return SAID[3];
    if (/마지막/.test(q)) return SAID[4];
    return SAID[i % SAID.length];
  }
  window.__guideSaid = saidFor;

  // 예시 글자를 한 자씩 쳐 넣습니다 — 칸의 oninput 이 그대로 불려 화면이 실제처럼 따라옵니다
  function typeInto(el, str) {
    return new Promise(function (done) {
      if (!el) { done(); return; }
      var i = 0;
      (function k() {
        i = Math.min(str.length, i + 2);
        el.value = str.slice(0, i);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        if (i < str.length) setTimeout(k, 40); else done();
      })();
    });
  }
  function choose(sel, value) {
    if (!sel) return;
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── 크롬의 «마이크 사용» 허용 창 흉내 ──
  // 진짜 창은 브라우저가 띄우는 것이라 테두리를 두를 수 없고, 연습에서 진짜로 허용 · 차단하면 그 컴퓨터 설정이 바뀝니다.
  // 그래서 모양만 그려 보여 줍니다(주소창 아래 왼쪽 — 크롬이 띄우는 자리). «허용» 을 누르면 받아 적기 흉내가 말하기 시작합니다
  function showMicAsk() {
    window.__guideMicOK = false;
    var old = document.getElementById('gd-mic'); if (old) old.remove();
    var host = location.hostname || '08hwichemi.github.io';
    var box = document.createElement('div');
    box.id = 'gd-mic'; box.className = 'gd-mic';
    box.innerHTML = '<p class="gd-mic-cap">크롬이 띄우는 창 (연습용 그림)</p>' +
      '<p class="gd-mic-q"><b>' + esc(host) + '</b>에서 다음 권한을 요청합니다</p>' +
      '<p class="gd-mic-what">🎤 마이크 사용</p>' +
      '<div class="gd-mic-btns"><button type="button" class="gd-mic-no">차단</button>' +
      '<button type="button" id="gd-mic-allow" class="gd-mic-yes">허용</button></div>';
    document.body.appendChild(box);
    document.getElementById('gd-mic-allow').addEventListener('click', function () {
      window.__guideMicOK = true;
      box.remove();
    });
  }

  // ── 화면을 처음 상태로 (묻는 창 없이) ──
  function home() {
    var mic = document.getElementById('gd-mic'); if (mic) mic.remove();
    if (typeof otherCloseQR === 'function') otherCloseQR();
    if (typeof closeStudentQs === 'function') closeStudentQs();
    stopTicking();
    liveInterview = false; editingMid = false; interviewId = null;
    goPage('interview');
    if (typeof railShowOther === 'function') railShowOther(false);
    pickedClass = ''; searchWord = '';
    var s = $('#search'); if (s) s.value = '';
    renderClassChips();
    backToList();
  }

  // 김연습을 고르고 질문지가 있게 — «면접 진행» 장을 바로 열 때
  async function readySetup() {
    if (on('setup') && target && composeQuestions().length > 1) return;
    home();
    await pickStudent(MAIN);
    await loadSheet();
    if (!midQuestions.length) {
      midQuestions.push({ text: '동아리 활동에서 맡은 역할과, 그 역할을 하며 배운 점을 말해 주세요.', competency: '공동체역량' });
      midQuestions.push({ text: '친구들과 의견이 달랐던 경험이 있다면 어떻게 풀었는지 말해 주세요.', competency: '공동체역량' });
      midQuestions.push({ text: '화학 세특의 반응 속도 탐구에서 가장 어려웠던 점은 무엇인가요?', competency: '학업역량' });
      renderQuestions();
    }
  }

  // 남은 질문을 연습용 답변으로 채우고 마무리 화면으로
  async function fastFinish() {
    if (on('setup')) await startInterview();
    if (!on('run') && !on('finish')) return;
    if (!startedOnce) toggleTimer();
    answers.forEach(function (a, i) {
      // 예시 학생이 아직 다 말하지 않은 질문은 예시 답변을 통째로 넣습니다
      if (!window.__guideSpoke[i]) { a.transcript = saidFor(i); window.__guideSpoke[i] = true; }
      if (!a.seconds) { a.seconds = 40 + (i * 17) % 50; totalSeconds += a.seconds + 15; }
    });
    stopTicking();
    if (!on('finish')) openFinish();
  }

  // «창이 닫혔을 때» — 이보기 학생의 면접을 «진행중» 으로 하나 넣어 둡니다(이미 있으면 그대로)
  function plantUnfinished() {
    var T = window.__guideDB, id = 'guide-resume';
    T.interviews = T.interviews.filter(function (r) { return r.id !== id; });
    T.interview_answers = T.interview_answers.filter(function (r) { return r.interview_id !== id; });
    T.interviews.push({ id: id, school_id: 'guide', student_id: RESUME, teacher_id: window.__guideMe,
      teacher_name: '연습 선생님', status: '진행중', started_at: new Date(Date.now() - 25 * 60000).toISOString(), grades: {} });
    [['먼저 간단히 자기소개를 해 주세요.', '기타', 58, '보통', SAID[0]],
     ['동아리 활동에서 맡은 역할과, 그 역할을 하며 배운 점을 말해 주세요.', '공동체역량', 95, '우수', SAID[1]],
     ['친구들과 의견이 달랐던 경험이 있다면 어떻게 풀었는지 말해 주세요.', '공동체역량', 0, null, ''],
     ['마지막으로 하고 싶은 말이 있나요?', '기타', 0, null, '']
    ].forEach(function (r, i) {
      T.interview_answers.push({ id: 'guide-ra-' + i, interview_id: id, seq: i + 1, question: r[0], competency: r[1],
        seconds: r[2], rating: r[3], transcript: r[4], memo: '', good_tags: [], bad_tags: [], marks: [], areas: {} });
    });
  }

  // 화면의 질문지가 가짜 서버에 그대로 저장돼 있는가 (질문 글자와 순서까지)
  function sheetSaved() {
    if (!sheetId) return false;
    var have = window.__guideDB.interview_answers
      .filter(function (a) { return a.interview_id === sheetId; })
      .sort(function (a, z) { return a.seq - z.seq; })
      .map(function (a) { return a.question; });
    var want = composeQuestions().map(function (q) { return q.text; });
    return have.length === want.length && want.every(function (w, i) { return have[i] === w; });
  }

  function rowOf(listSel, sid) {
    var b = document.querySelector(listSel + ' .railrow[onclick*="\'' + sid + '\'"]');
    return b ? b.closest('.srow') || b : null;
  }
  function kbd(k) { return '<kbd>' + k + '</kbd>'; }

  // ════════════════ 장과 걸음 ════════════════
  // 2026-10-12 선생님 말씀: 직접 입력해 보는 연습이 아니라 «시뮬레이션» — 미리 준비된 내용으로,
  // 어디 단추를 눌러서 어떻게 되는지 순서를 보여 주는 것. 그래서
  //   · 선생님은 주황 테두리 단추만 누릅니다. 테두리 밖을 누르거나 키보드를 쳐도 화면은 그대로입니다
  //   · real: 그 단추를 실제로 누른 것이 그대로 앱에 갑니다(면접 시작 · 저장 · 전달 …)
  //   · act:  눌렀을 때 예시를 대신 채웁니다(질문 · 요지 · 총평 · 학교 · 이름을 한 자씩 쳐 넣음, 고르기 칸)
  //   · after: 실제로 누른 뒤에 이어서 예시를 채웁니다(«＋ 직접 적기» → 빈 칸에 예시 질문)
  //   · watch: 누를 것 없이 보여 주기만 하고, 다 보이면 저절로 다음(예시 학생이 말하는 받아 적기)
  // 걸음 하나 = { t: 무엇을 누를지, b: 설명, at: 테두리를 두를 곳, done: 다 됐는가, 위의 셋 중 하나 }
  var EX_Q = '화학 세특의 반응 속도 탐구에서 가장 어려웠던 점은 무엇인가요?';
  var CH = [
    { title: '화면 둘러보기', setup: function () { home(); }, steps: [
      { at: '#rail-tab-other', real: true, t: '«🏫 타학교 면접» 을 눌러 보세요',
        done: function () { return railOther; },
        b: '왼쪽 칸은 <b>학생 목록</b>입니다. 이 탭으로 우리 학교 / 다른 학교 학생 목록을 바꿉니다.<br>' +
           '이 연습은 <b>주황 테두리 단추만 누르면</b> 됩니다. 글자 · 학생 답변은 예시가 저절로 채워집니다.' },
      { at: '#rail-tab-ours', real: true, t: '다시 «우리 학교» 를 누르세요',
        done: function () { return !railOther; },
        b: '오른쪽 칸에는 고른 학생의 <b>준비 → 진행 → 마무리 → 리포트</b>가 차례로 나옵니다.<br>' +
           '머리말 오른쪽 끝 <b>v2026-…</b> 은 판 번호입니다. 맨 위에 «새 버전이 있습니다» 띠가 뜨면 «새로고침».' }
    ] },

    { title: '질문지 만들기', setup: function () { home(); }, steps: [
      { at: function () { return $('#class-chips .chip:nth-child(2)'); }, real: true, t: '«1반» 을 누르세요',
        done: function () { return pickedClass === '301'; },
        b: '반 단추로 명단을 줄입니다. 위 칸에 학번 · 이름을 쳐서 찾아도 됩니다.' },
      // ★ 를 학생을 고르기 «전에» 누르게 합니다. 휴대폰(900px 아래)에서는 학생을 고르면 명단이 저절로 접혀
      // ★ 가 안 보였습니다 — 2026-10-12 선생님이 휴대폰으로 보시다 여기서 못 넘어가셨습니다
      { at: function () { var r = rowOf('#student-list', MAIN); return r && r.querySelector('.star'); }, real: true, t: '«30101 김연습» 옆 ★ 를 누르세요',
        show: { at: '#fav-box', t: '명단 맨 위 «★ 담당 학생» 에 담겼습니다' },
        done: function () { return favorites[MAIN] === true; },
        b: '맡은 학생은 ★ 로 담아 두면 명단 맨 위 «★ 담당 학생» 에 모입니다. 매번 찾지 않아도 되고, 계정에 남아 다른 컴퓨터에서도 같습니다.' },
      { at: function () { var b = rowOf('#student-list', MAIN); return b && b.querySelector('.railrow'); }, real: true, t: '«30101 김연습» 을 누르세요',
        show: { at: '#history-box', t: '이 학생의 지난 면접 · 수시 지원', b: '전에 본 면접(회차 — 누르면 그때 리포트)과, 그 아래 수시 지원 대학 · 학과 · 면접 날짜가 보입니다.' },
        done: function () { return target && target.id === MAIN && on('setup'); },
        b: '그 학생의 «면접 준비» 화면이 열립니다.' +
           '<p class="gd-more">위에는 이 학생의 <b>지난 면접</b>(회차 — 누르면 그때 리포트)과 <b>수시 지원</b>(대학 · 학과 · 면접 날짜)이 보입니다.</p>' },
      { at: '#opening-box .chip:nth-child(3)', real: true, t: '첫인사 «자기소개 + 지원동기» 를 누르세요',
        done: function () { return opening.on && opening.key === 'both'; },
        b: '면접을 여는 질문입니다. 문장은 그 자리에서 고쳐 써도 되고, 고른 것을 다시 누르면 첫인사를 뺍니다.' },
      { at: 'button[onclick^="loadCommon(\'changche\'"]', real: true, t: '«창체 질문 3개» 를 누르세요',
        show: { at: '#q-list', t: '«낼 질문» 에 질문 3개가 붙었습니다', b: '어느 단추로 더해도 여기 맨 아래에 붙습니다. 질문마다 오른쪽 칸에서 무엇을 보는 질문인지 고르고, 필요 없으면 «빼기».' },
        done: function () { return midQuestions.length >= 3; },
        b: '추천 질문 3개가 «낼 질문» 맨 아래에 붙습니다. «전공 질문 3개» 도 같습니다.' },
      { at: 'button[onclick^="addQuestion(\'\'"]', real: true, t: '«＋ 직접 적기» 를 누르세요',
        after: function () { var i = document.querySelectorAll('#q-list .qrow input'); return typeInto(i[i.length - 1], EX_Q); },
        done: function () { var q = midQuestions[midQuestions.length - 1]; return q && q.text === EX_Q; },
        b: '빈 칸이 «낼 질문» 맨 아래에 생기고, 거기에 질문을 적습니다. <span class="gd-ex">(연습에서는 예시 질문이 저절로 적힙니다)</span>' },
      { at: function () { var s = document.querySelectorAll('#q-list .qrow select'); return s[s.length - 1]; }, t: '무엇을 보는 질문인지 고르는 칸을 누르세요',
        act: function () { var s = document.querySelectorAll('#q-list .qrow select'); choose(s[s.length - 1], '학업역량'); },
        done: function () { var q = midQuestions[midQuestions.length - 1]; return q && q.competency === '학업역량'; },
        b: '<b>학업역량 · 진로역량 · 공동체역량 · 기타</b> 중 하나를 고릅니다. 리포트에서 역량별로 모아 보여 줍니다. ' +
           '<span class="gd-ex">(연습에서는 «학업역량» 이 골라집니다)</span>' },
      // 순서 바꾸기 ▲ ▼ (2026-10-12 더함)
      { at: function () {
          var rows = document.querySelectorAll('#q-list .qrow');
          for (var k = 0; k < rows.length; k++) if (rows[k].querySelector('input').value === EX_Q) return rows[k].querySelector('.qmove[data-d="-1"]');
          return null;
        }, real: true, t: '▲ 를 눌러 순서를 바꿔 보세요',
        done: function () { var k = midQuestions.map(function (q) { return q.text; }).indexOf(EX_Q); return k > -1 && k < midQuestions.length - 1; },
        b: '줄마다 <b>▲ ▼</b> 로 한 칸씩 옮깁니다. 첫인사 · 끝인사는 늘 맨 앞 · 맨 뒤입니다.' +
           '<p class="gd-more">면접 도중 «← 질문 고치기» 로 와서 순서를 바꿔도 매긴 평가는 그대로 남습니다.</p>' },
      { at: '#btn-save-sheet', real: true, t: '«질문지 저장» 을 누르세요',
        show: { at: '#sheet-note', t: '«미리 만들어 둔 질문지입니다»', b: '면접 날 이 학생을 고르면 이 표시와 함께 질문지가 그대로 뜹니다.' },
        done: sheetSaved,
        b: '<b>면접은 시작되지 않고</b> 질문만 남겨 둡니다. 면접 날에는 학생만 고르면 이 질문지가 그대로 뜹니다.' +
           '<p class="gd-more">다른 질문 단추 — <b>📄 생기부에서 뽑기</b>(PDF 를 이 브라우저 안에서만 읽어 질문 후보를 뽑음, 서버에 안 올라감) · ' +
           '<b>✍️ 학생 질문</b>(학생이 답안 연습장에 쓴 질문). 필요 없는 질문은 «빼기».</p>' }
    ] },

    { title: '면접 진행 · 받아 적기', setup: readySetup, steps: [
      { at: '#btn-start', real: true, t: '«질문 완료 · 면접 화면으로 →» 를 누르세요',
        done: function () { return on('run'); },
        b: '화면만 넘어갑니다 — <b>아직 면접이 시작된 것은 아닙니다.</b>' },
      { at: '#btn-timer', real: true, t: '«면접 시작» 을 누르세요',
        done: function () { return startedOnce; },
        b: '위가 지금 낼 질문, 왼쪽은 질문 진행 상황입니다. «면접 시작» 을 누르면 «면접 전체» 시계가 흐르고 <b>이때부터 진짜 면접</b>입니다.' +
           '<p class="gd-more">아래 받아 적기 단추가 «🎤 받아 적기 끄기» 로 보이면 켜져 있는 것입니다. 면접 날 이것부터 확인하세요.</p>' },
      { at: '#btn-answer', real: true, t: '질문을 읽어 준 뒤 «답변 시작» 을 누르세요',
        done: function () { return answering; },
        b: '선생님이 질문을 소리 내어 읽고, 학생이 말을 시작할 때 누릅니다(키보드 ' + kbd('Space') + '). ' +
           '«이 질문 답변» 시계와 <b>받아 적기</b>가 켜집니다. 선생님이 질문 읽는 소리는 안 적힙니다.' +
           '<p class="gd-more">«면접 시작» 을 깜빡했어도 «답변 시작» 하나로 두 시계가 같이 켜집니다.</p>' },
      // 마이크 허용 — 실제로는 크롬이 주소창 아래에 띄우는 창입니다. 연습에서는 그 모양을 그려 보여 줍니다(showMicAsk)
      { at: '#gd-mic-allow', real: true, t: '크롬이 마이크를 물으면 «허용»',
        enter: showMicAsk,
        done: function () { return !!window.__guideMicOK; },
        b: '<b>처음 한 번</b> 크롬이 주소창 아래에 «마이크 사용» 을 묻습니다. <b>«허용»</b> 을 누르세요 ' +
           '(크롬 판에 따라 «사이트 방문 중 허용» 처럼 보일 수 있습니다 — «허용» 이 든 단추). 한 번 허용하면 그 컴퓨터에서는 다시 안 묻습니다.' +
           '<p class="gd-more">잘못해서 «차단» 을 눌렀으면: 주소창 왼쪽 자물쇠(설정) 단추 → 마이크 «허용» → 받아 적기를 다시 켭니다. ' +
           '받아 적기는 <b>크롬 · 엣지</b>에서만 됩니다(파이어폭스 · 삼성 인터넷은 안 됨). 인터넷이 있어야 합니다.</p>' },
      { at: '#livebox', watch: true, t: '학생이 말하면 이렇게 적힙니다',
        done: function () { return !!window.__guideSpoke[qIndex] && !LISTEN.interim; },
        b: '<span class="gd-ex">(예시 학생 답변이 흘러나오는 중 — 잠깐 보세요)</span> 회색 글은 아직 알아듣는 중, 검은 글은 굳은 글입니다.' +
           '<ul><li>노트북 안의 마이크는 책상 건너편 목소리를 잘 못 잡습니다 → <b>USB · 블루투스 마이크를 학생 쪽에</b></li>' +
           '<li>스피커 소리(영상 등)는 안 적힙니다 · 인터넷이 있어야 합니다</li>' +
           '<li>받아 적은 글은 틀린 데가 있을 수 있습니다</li></ul>' },
      { at: '#rating-area', real: true, t: '«우수 · 보통 · 미흡» 중 하나를 누르세요',
        done: function () { return !!(cur() && cur().rating); },
        b: '들으면서 크게 하나만. 키보드 ' + kbd('1') + ' ' + kbd('2') + ' ' + kbd('3') + ' 도 됩니다. 다시 누르면 지워집니다. ' +
           '<b>안 눌러도 됩니다</b> — 끝난 뒤 받아 적은 글을 보며 매겨도 됩니다.' },
      { at: '#area-grid', real: true, t: '영역 줄에서 «좋음 · 보통 · 아쉬움» 하나를 누르세요',
        done: function () { return !!(cur() && Object.keys(cur().areas || {}).length); },
        b: '내용 · 근거 · 말하기 · 태도 · 전공 연결 — 눈에 띈 줄만 눌러도 됩니다.' },
      { at: '#answer-memo', t: '«평가 · 답변 요지» 칸을 누르세요',
        act: function () { return typeInto($('#answer-memo'), '지원 동기가 또렷함. 결론을 먼저 말하면 더 좋겠음.'); },
        done: function () { return !!(cur() && cur().memo === '지원 동기가 또렷함. 결론을 먼저 말하면 더 좋겠음.'); },
        b: '한두 줄 적습니다 — <b>학생 리포트에 그대로 들어갑니다.</b> 안 적어도 됩니다. <span class="gd-ex">(연습에서는 예시가 적힙니다)</span>' },
      // 꼬리 질문 (2026-10-12 더함)
      { at: '#btn-follow', real: true, t: '더 묻고 싶으면 «＋ 꼬리 질문»',
        done: function () { return !$('#follow-box').hidden; },
        b: '학생 답을 듣고 이어서 묻고 싶을 때 누릅니다. <b>지금 질문 바로 뒤</b>에 새 질문이 생깁니다.' },
      { at: '#follow-text', t: '꼬리 질문 칸을 누르세요',
        act: function () { return typeInto($('#follow-text'), FOLLOW_Q); },
        done: function () { return $('#follow-text').value === FOLLOW_Q; },
        b: '한 줄로 적습니다. 바쁘면 안 적고 «넣기» 만 눌러도 «꼬리 질문 (1번에 이어서)» 로 들어갑니다. <span class="gd-ex">(연습에서는 예시가 적힙니다)</span>' },
      { at: '#follow-add', real: true, t: '«넣기» 를 누르세요',
        show: { at: '#progress-list', t: '2번에 꼬리 질문이 들어갔습니다', b: '뒤 질문은 한 칸씩 밀리고, 위 질문 카드도 꼬리 질문으로 바뀌었습니다.' },
        done: function () { return qIndex === 1 && questions[1] && questions[1].text === FOLLOW_Q; },
        b: '칸에서 ' + kbd('Enter') + ' 도 됩니다. 앞 질문에 받아 적은 글 · 평가는 그대로 남습니다.' },
      { at: '#btn-answer', real: true, t: '꼬리 질문을 말하고 «답변 시작»',
        done: function () { return qIndex >= 1 && answering || on('finish'); },
        b: '받아 적기 · 평가는 다른 질문과 똑같이 붙습니다. «면접 전체» 는 계속 흐르고, «이 질문 답변» 은 질문마다 새로 잽니다.' +
           '<p class="gd-more">잠깐 멈출 일이 생기면 «일시정지» → «이어서». 질문을 고치려면 첫 질문의 «← 질문 고치기» — 매긴 평가는 그대로 남습니다.</p>' },
      { at: '#btn-next', real: true, t: '«다음 질문 →» 을 누르세요',
        done: function () { return qIndex >= 2 || on('finish'); },
        b: '키보드 ' + kbd('→') + ' 도 됩니다. 답변 시계와 받아 적기가 멈추고 다음 질문으로 갑니다.' },
      { at: '#btn-next', t: '남은 질문도 같은 순서 — «다음 질문 →» 을 누르세요',
        act: fastFinish,
        done: function () { return on('finish'); },
        b: '«답변 시작» → (학생 답변) → «다음 질문 →» 을 되풀이하고, 마지막 질문에서는 이 단추가 <b>«면접 마무리 →»</b> 로 바뀝니다. ' +
           '<span class="gd-ex">(연습에서는 남은 질문을 예시 답변으로 채우고 마무리 화면으로 갑니다)</span>' +
           '<p class="gd-more">키보드: ' + kbd('1') + kbd('2') + kbd('3') + ' 판정 · ' + kbd('Space') + ' 답변 시작/끝 · ' + kbd('→') + ' 다음 · ' + kbd('←') + ' 이전</p>' }
    ] },

    { title: '마무리 · 리포트 전달', setup: async function () {
        if (on('finish')) return;
        await readySetup();
        await fastFinish();
      }, steps: [
      { at: '#answer-summary .ansrow .eg-row', real: true, t: '좋았던 점 · 아쉬운 점 단추를 하나 누르세요',
        done: function () { return answers.some(function (a) { return a.good.length || a.bad.length; }); },
        b: '질문마다 위에 <b>«학생이 말한 내용(받아 적은 것)»</b> 이 있습니다. 그걸 보며 영역 줄마다 해당하는 단추를 누릅니다(다시 누르면 빠짐). ' +
           '면접 중에 누른 것은 그대로 와 있고, 아래 «이 답변은» · 요지 칸도 여기서 고칩니다.' },
      { at: '#scoresheet', real: true, t: '채점표에서 A ~ E 를 하나 누르세요',
        done: function () { return Object.keys(grades).length > 0; },
        b: '평가요소 6줄 — <b>다 안 찍어도 됩니다.</b>' },
      { at: '#finish-note', t: '«한 줄 총평» 칸을 누르세요',
        act: function () { return typeInto($('#finish-note'), '경험은 풍부한데 결론을 먼저 말하는 연습이 필요합니다.'); },
        done: function () { return $('#finish-note').value === '경험은 풍부한데 결론을 먼저 말하는 연습이 필요합니다.'; },
        b: '학생에게 남길 한마디입니다. 안 써도 됩니다. <span class="gd-ex">(연습에서는 예시가 적힙니다)</span>' },
      { at: '#btn-finish', real: true, t: '«면접 끝내기 · 리포트 보기 →» 를 누르세요',
        show: { at: '#report-body', top: true, ms: 4000, t: '학생이 받을 리포트 한 장', b: '질문마다 학생이 말한 내용 · 판정 · 요지, 아래에 채점표와 총평. 위 «인쇄» 로 종이 · PDF 로도 뽑습니다.' },
        done: function () { return on('report') && !!viewing; },
        b: '평가를 한꺼번에 저장하고 리포트 한 장으로 보여 줍니다. <b>아직 학생에게 가지 않습니다.</b>' },
      { at: '#btn-deliver', real: true, t: '«학생에게 전달» 을 누르세요',
        show: { at: '#report-state', t: '«학생이 보고 있습니다»', b: '이제 학생 휴대폰 «내 면접 리포트» 에 보입니다.' },
        done: function () { return !!(viewing && viewing.interview && viewing.interview.status === '전달됨'); },
        b: '위가 학생이 받을 리포트 그대로입니다(맨 위 «인쇄» 로 종이 · PDF, 고칠 것은 «← 채점표 고치기»). ' +
           '<b>전달을 눌러야 학생 폰 «내 면접 리포트» 에 보입니다.</b>' +
           '<p class="gd-more">보낸 뒤에 고치면 리포트에 «고친 날» 이 남습니다. 잘못 시작한 면접은 «이 리포트 지우기».</p>' }
    ] },

    { title: '창이 닫혔을 때', setup: async function () { plantUnfinished(); home(); await sleep(200); }, steps: [
      { at: '#unfinished-list button[onclick*="guide-resume"]', real: true, t: '«이보기 … 이어서 하기 →» 를 누르세요',
        done: function () { return on('run') && target && target.id === RESUME; },
        b: '면접 도중 창이 닫히거나 노트북이 꺼져도 괜찮습니다. 면접ON 을 다시 열면 첫 화면에 <b>«끝내지 못한 면접이 있습니다»</b> 가 뜹니다.' },
      { at: '#btn-timer', real: true, t: '«이어서» 를 누르세요',
        done: function () { return ticking; },
        b: '매긴 평가 · 받아 적은 글 · 질문은 그대로이고, <b>아직 안 매긴 질문</b>에 가 있습니다. 시계는 멈춰 있어서 «이어서» 를 눌러야 흐릅니다.' }
    ] },

    { title: '🏫 타학교 면접', setup: function () { home(); }, steps: [
      { at: '#rail-tab-other', real: true, t: '«🏫 타학교 면접» 을 누르세요',
        done: function () { return railOther; },
        b: '다른 학교 학생은 명단 · 계정 없이 <b>학교 · 이름 · 희망 전공</b>만 적고 같은 화면으로 면접합니다.' },
      { at: '.otheradd', real: true, t: '«＋ 타학교 학생 더하기» 를 누르세요',
        done: function () { return target && target.other && on('setup'); },
        b: '목록은 이 학교 선생님 모두가 같이 봅니다 — 면접 날 나눠 맡으시라고.' },
      { at: '.otherform', t: '학교 · 이름 · 희망 전공 칸을 누르세요',
        act: async function () {
          await typeInto($('#other-school'), '한빛고');
          await typeInto($('#other-name'), '홍길동');
          await typeInto($('#other-major'), '컴퓨터공학과');
        },
        done: function () { return target && target.other && target.name === '홍길동' && target.school === '한빛고' && target.major === '컴퓨터공학과'; },
        b: '세 칸을 적습니다. 이름은 꼭 있어야 합니다. <span class="gd-ex">(연습에서는 예시가 적힙니다)</span>' +
           '<p class="gd-more">다음 학생부터 학교 칸은 마지막에 적은 학교로 채워져 있습니다.</p>' },
      { at: '.otheracts .btn.solid', real: true, t: '«명단 저장» 을 누르세요',
        show: { at: '#other-list', t: '왼쪽 목록에 «한빛고 홍길동» 이 들어갔습니다', b: '학교별로 묶이고, 머리줄을 누르면 접힙니다. 줄마다 ★ · 🗑.' },
        done: function () { return target && target.other && !!target.ivId; },
        b: '칸에서 ' + kbd('Enter') + ' 도 됩니다. 여러 명을 넣을 땐 옆의 <b>«저장하고 다음 학생 ＋»</b> — 학교는 그대로 두고 이름 칸으로 갑니다.' },
      { at: '.btnrow button[onclick="otherTogglePaste()"]', real: true, t: '«📋 여러 질문 붙여넣기» 를 누르세요',
        done: function () { return !$('#other-paste').hidden; },
        b: '생기부로 따로 만들어 온 질문을 한꺼번에 넣는 단추입니다.' },
      { at: '#other-paste-text', t: '질문을 붙여 넣는 칸을 누르세요',
        act: function () { return typeInto($('#other-paste-text'), '1. 탐구 주제를 고른 까닭은 무엇인가요?\n2) 그 실험에서 가장 어려웠던 점은?\nQ3. 희망 전공과 이어지는 활동을 하나 소개해 주세요.'); },
        done: function () { return /Q3\. 희망 전공과 이어지는 활동을 하나 소개해 주세요\.$/.test($('#other-paste-text').value); },
        b: '따로 만들어 온 질문을 한 줄에 하나씩 붙여 넣습니다(한글 · 메모장에서 복사 → ' + kbd('Ctrl') + '+' + kbd('V') + '). ' +
           '<span class="gd-ex">(연습에서는 예시 질문 세 줄이 들어갑니다)</span>' },
      { at: '#other-paste .btn.solid', real: true, t: '««낼 질문» 에 넣기» 를 누르세요',
        show: { at: '#q-list', t: '번호를 뗀 질문 3개가 붙었습니다' },
        done: function () { return midQuestions.length >= 3; },
        b: '앞 번호(1. · 2) · Q3.)는 저절로 떼어지고, 같은 질문은 건너뜁니다.' },
      { at: '#btn-save-sheet', real: true, t: '«질문지 저장» 을 누르세요',
        done: sheetSaved,
        b: '면접 날 왼쪽 목록에서 학생을 누르기만 하면 이 질문지가 뜹니다.' +
           '<p class="gd-more">왼쪽 목록은 학교별로 묶여 접히고, 줄마다 ★(담당 학생) · 🗑(지우기) · 어디까지 했는지(질문 준비 / 면접 중 / QR 아직 / QR 줌)가 붙습니다.</p>' },
      { at: '#btn-start', t: '«질문 완료 · 면접 화면으로 →» 를 누르세요',
        act: fastFinish,
        done: function () { return on('finish'); },
        b: '면접 진행 · 받아 적기 · 마무리는 <b>우리 학교 면접과 똑같습니다</b>(2장 · 3장). ' +
           '<span class="gd-ex">(연습에서는 면접을 예시 답변으로 채우고 마무리 화면으로 건너뜁니다)</span>' },
      { at: '#btn-finish', real: true, t: '«면접 끝내기 · 리포트 보기 →» 를 누르세요',
        show: { at: '#report-body', top: true, ms: 3500, t: '학생에게 줄 평가서 한 장', b: '우리 학교 리포트와 같은 종이입니다. 이걸 QR 로 학생 휴대폰에 줍니다.' },
        done: function () { return on('report') && !!viewing; },
        b: '채점표 · 총평은 우리 학교와 같습니다. 끝내면 평가서 한 장이 나옵니다.' },
      { at: '#btn-deliver', real: true, t: '«📱 QR 로 평가서 주기» 를 누르세요',
        done: function () { return $('#qr-overlay').style.display === 'flex'; },
        b: '«학생에게 전달» 자리에 이 단추가 있습니다. 누르면 큰 QR 이 뜹니다.' },
      { at: '.qr-btns .btn.solid', real: true, t: '학생이 찍었으면 «닫기»', prefer: ['right', 'left', 'below'], tipBeside: '.qr-card',
        done: function () { return $('#qr-overlay').style.display !== 'flex'; },
        b: '학생이 휴대폰 <b>기본 카메라</b>로 QR 을 찍으면 로그인 없이 평가서가 열리고 «📄 PDF로 저장» 으로 받습니다 ' +
           '(카톡 · 네이버 앱 안에서는 PDF 저장이 안 될 수 있음 → «인쇄창으로 저장»).<br>' +
           '<b>QR 을 보여 준 때부터 24시간만</b> 열리고 그 뒤엔 서버에서 지워집니다 — 그 자리에서 바로 저장하게 해 주세요.' +
           '<p class="gd-warn">연습 QR 은 찍어도 열리지 않습니다(가짜 서버라서).</p>' },
      { at: '#btn-deliver', real: true, t: '못 찍었으면 — «📱 QR 다시 보기»',
        done: function () { return $('#qr-overlay').style.display === 'flex'; },
        b: '같은 QR 이 다시 뜨고, 그때부터 다시 24시간 열립니다.' },
      { at: '.qr-btns .btn.solid', real: true, t: '«닫기» 를 누르세요', prefer: ['right', 'left', 'below'], tipBeside: '.qr-card',
        done: function () { return $('#qr-overlay').style.display !== 'flex'; },
        b: '«이 리포트 지우기» 는 <b>평가만</b> 지우고 학생 · 질문은 남깁니다. 학생째 지우려면 목록의 🗑 또는 «○○고 N명 모두 지우기».' }
    ] }
  ];
  window.__guideChapters = CH;   // 화면 시험(check-guide.js)이 걸음마다 확인합니다

  // ════════════════ 말풍선 ════════════════
  // 눌러야 할 곳에 주황 테두리(.gd-ring), 그 바로 옆에 화살표 달린 말풍선(.gd-tip).
  // 넘어가는 것은 선생님이 테두리 친 곳을 눌렀을 때뿐 — «다음» 같은 안내용 단추는 없습니다.
  // 테두리 밖을 누르면 아무 일도 안 일어나고 말풍선이 한 번 흔들립니다. 키보드도 막아 둡니다(시뮬레이션이 흐트러지지 않게).
  // 왼쪽 아래 작은 띠(.gd-dock)에 지금 몇 장 몇 걸음 · «목차».
  var S = { ch: -1, st: 0, busy: false, flash: 0, doneCh: {}, place: '' };
  window.__guideState = function () { return { ch: S.ch, st: S.st, busy: S.busy || !!S.doneAt || !!S.showing, showing: !!S.showing, place: S.place }; };   // 화면 시험용 (busy = 아직 누를 때가 아님)
  window.__guideTarget = function () { return target_(); };
  var ring, tip, dock, panel;

  function build() {
    ring = document.createElement('div'); ring.className = 'gd-ring'; ring.hidden = true;
    tip = document.createElement('section'); tip.className = 'gd-tip'; tip.hidden = true; tip.setAttribute('aria-live', 'polite');
    dock = document.createElement('div'); dock.className = 'gd-dock';
    panel = document.createElement('section'); panel.className = 'gd-panel'; panel.hidden = true;
    [ring, tip, dock, panel].forEach(function (x) { document.body.appendChild(x); });
    [tip, dock, panel].forEach(function (x) { x.addEventListener('click', onClick); });

    // 머리말에 «연습 모드» 표시 · 로그아웃 대신 «연습 끝내기»
    var brand = $('.brand');
    if (brand) brand.insertAdjacentHTML('afterend', '<span class="gd-badge">연습 모드 · 저장 안 됨</span>');
    var out = document.querySelector('.top button[onclick="teacherLogout()"]');
    if (out) { out.textContent = '연습 끝내기'; out.id = 'gd-quit'; out.setAttribute('onclick', ''); out.onclick = quit; }
    var chat = $('#chat-open'); if (chat) chat.style.display = 'none';

    // ── 화면 만지기 거르기 — 테두리 친 곳만 ──
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach(function (kind) {
      document.addEventListener(kind, gate, true);
    });
    document.addEventListener('keydown', function (e) {
      if (mine(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
  }

  function mine(node) { return !!(node && node.closest && node.closest('.gd-tip, .gd-dock, .gd-panel, #gd-quit')); }
  function inTarget(node) { var el = target_(); return !!(el && node && (el === node || el.contains(node))); }

  function gate(e) {
    if (mine(e.target)) return;
    var s = step();
    var ok = s && !S.busy && !S.showing && panel.hidden && !s.watch && inTarget(e.target);
    if (ok && s.real) {
      // 실제로 누른 것을 그대로 앱에 보냅니다. 누른 뒤 이어서 채울 예시가 있으면(after) 그다음에
      if (e.type === 'click' && s.after) {
        S.busy = true;
        setTimeout(function () { Promise.resolve(s.after()).catch(console.error).then(function () { S.busy = false; }); }, 60);
      }
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type !== 'click') return;
    if (ok && s.act) {
      // 눌렀으니 예시를 채웁니다(글자 쳐 넣기 · 고르기 칸)
      S.busy = true;
      Promise.resolve(s.act()).catch(console.error).then(function () { S.busy = false; });
      return;
    }
    nudge();
  }

  // 테두리 밖을 눌렀을 때 — 말풍선이 «여기를 누르세요» 하고 한 번 흔들립니다
  function nudge() {
    if (tip.hidden) return;
    tip.classList.remove('gd-nudge'); void tip.offsetWidth; tip.classList.add('gd-nudge');
  }

  // 연습 끝내기 — 실제 면접 화면으로(로그인 안 했으면 로그인 화면이 뜹니다)
  function quit() { location.href = location.pathname; }

  function step() { return S.ch > -1 && CH[S.ch] ? CH[S.ch].steps[S.st] || null : null; }
  function text(v) { return typeof v === 'function' ? v() : (v || ''); }
  function isDone(s) { try { return !!(s && s.done && s.done()); } catch (e) { return false; } }
  // 테두리 둘 곳의 네모. 칸이 display:contents 면(마무리 화면의 영역 줄) 제 네모가 없어서 속 것들을 합쳐 잽니다
  function rectOf(el) {
    if (!el) return null;
    if (el.getClientRects().length) {
      var r = el.getBoundingClientRect();
      return r.width || r.height ? r : null;
    }
    var box = null;
    Array.prototype.forEach.call(el.querySelectorAll('*'), function (c) {
      if (!c.getClientRects().length) return;
      var q = c.getBoundingClientRect();
      if (!q.width && !q.height) return;
      box = box ? { left: Math.min(box.left, q.left), top: Math.min(box.top, q.top),
                    right: Math.max(box.right, q.right), bottom: Math.max(box.bottom, q.bottom) }
                : { left: q.left, top: q.top, right: q.right, bottom: q.bottom };
    });
    if (box) { box.width = box.right - box.left; box.height = box.bottom - box.top; }
    return box;
  }
  function target_() {
    var s = step(); if (!s || !s.at) return null;
    var el = S.showing && s.show ? $(s.show.at) : typeof s.at === 'function' ? s.at() : $(s.at);
    if (el && !rectOf(el)) { reveal(el); }
    return rectOf(el) ? el : null;
  }
  // 누를 곳이 접힌 칸 안에 숨어 있으면 그 칸을 폅니다. 휴대폰에서는 학생 명단 · 질문지 만들기 · 지난 면접이
  // 처음부터 접혀 있거나 학생을 고르면 접히는데, 연습에서는 테두리 밖(«펼치기»)을 누를 수 없어 막혔습니다
  function reveal(el) {
    if (el.closest('#rail-students') && railFolded) { railFolded = false; paintRailFold(); }
    if (el.closest('#qsect-body') && !qsectOpen) toggleQsect();
    if (el.closest('#history') && !historyAccOpen) toggleHistoryAcc();
    if (el.closest('#susi') && !susiOpen) toggleSusi();
  }

  function paintDock() {
    var s = step();
    dock.innerHTML = '<span class="gd-cap">🎓 연습 면접</span>' +
      (s ? '<span class="gd-where">' + S.ch + '. ' + esc(CH[S.ch].title) + ' · ' + (S.st + 1) + ' / ' + CH[S.ch].steps.length + '</span>' : '') +
      '<button class="gd-x" data-act="menu">목차</button>' +
      (s ? '<button class="gd-x" data-act="go" data-ch="' + S.ch + '">이 장 처음부터</button>' : '');
  }

  // 말풍선 글을 읽는 데 드는 시간 — 넉넉히 1초에 10자, 짧아도 8초 · 길어도 30초
  function readMs(s) {
    var d = document.createElement('div'); d.innerHTML = text(s.b) + ' ' + s.t;
    return Math.min(30000, Math.max(8000, d.textContent.replace(/\s+/g, '').length * 100));
  }
  // 보여 주기 걸음 — 언제 넘어가는지 얇은 막대로(받아 적기 · 읽는 시간 중 늦은 쪽)
  function paintWait(s) {
    var bar = tip.querySelector('.gd-wait i');
    if (!bar) return;
    var p = Math.min(1, (Date.now() - S.enteredAt) / readMs(s));
    if (!isDone(s)) p = Math.min(p, 0.9);
    bar.style.width = Math.round(p * 100) + '%';
  }

  function paintTip() {
    var s = step();
    if (!s) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.dataset.kind = '';
    tip.innerHTML = '<span class="gd-arrow"></span>' +
      '<h3 class="gd-t">' + (s.watch ? '👀 ' : '👉 ') + esc(s.t) + '</h3>' +
      '<div class="gd-b">' + text(s.b) + '</div>' +
      (s.watch ? '<div class="gd-wait"><i></i></div><p class="gd-waitcap">다 읽으실 시간을 드린 뒤 저절로 넘어갑니다</p>' : '');
    tip.dataset.flash = S.flash > Date.now() ? 'yes' : 'no';
  }

  // 가운데 창 — 목차 · 장이 끝났을 때 · 마지막
  function showPanel(html) { panel.innerHTML = html; panel.hidden = false; tip.hidden = true; ring.hidden = true; }
  function menuHTML() {
    return '<h3 class="gd-t">면접ON 따라 하기</h3>' +
      '<p class="gd-b">실제 면접 화면 그대로입니다. <b>주황 테두리 단추만 차례로 누르면</b> 면접 한 번이 처음부터 끝까지 흘러가며, ' +
      '어디를 눌러 무엇이 되는지 보입니다. 글자 · 학생 답변(받아 적기)은 예시가 저절로 채워지고, <b>실제 서버에는 아무것도 저장되지 않습니다.</b></p>' +
      '<div class="gd-btns" style="justify-content:flex-start"><button class="btn solid" data-act="go" data-ch="0">▶ 처음부터 따라 하기 (5분쯤)</button></div>' +
      '<p class="gd-b" style="margin-top:12px;font-size:13px">한 부분만 다시 보려면</p>' +
      '<ol class="gd-menu">' + CH.map(function (c, i) {
        return '<li><button data-act="go" data-ch="' + i + '">' +
          '<span class="n">' + i + '</span><span class="nm">' + esc(c.title) + '</span>' +
          '<span class="ok">' + (S.doneCh[i] ? '✓ 해 봄' : c.steps.length + '걸음') + '</span></button></li>';
      }).join('') + '</ol>';
  }

  async function goChapter(i) {
    S.busy = true;
    S.ch = i; S.st = 0;
    showPanel('<p class="gd-b" style="margin:4px 0">' + i + '. ' + esc(CH[i].title) + ' — 화면을 맞추는 중…</p>');
    try { await CH[i].setup(); } catch (e) { console.error(e); }
    await sleep(150);
    panel.hidden = true;
    S.busy = false;
    enter();
  }

  function enter() {
    var s = step();
    if (!s) return;
    S.doneAt = 0;
    S.showing = false;
    S.enteredAt = Date.now();
    if (s.enter) s.enter();
    lastDyn = text(s.b);
    paintDock();
    paintTip();
    // 누를 곳이 화면 밖이면 머리말 아래쪽으로 내려 보여 주고, 말풍선은 그 아래에 붙습니다
    var el = target_();
    if (el) {
      var r = rectOf(el);
      if (r.top < 72 || r.bottom > window.innerHeight - 24) window.scrollBy(0, r.top - 140);
    }
    place();
  }

  // 다 했으면 다음 걸음 — 장이 끝나면 잠깐 알리고 다음 장으로 이어 갑니다
  function advance() {
    S.flash = Date.now() + 700;
    S.st++;
    if (S.st < CH[S.ch].steps.length) { enter(); return; }
    S.doneCh[S.ch] = true;
    var nx = CH[S.ch + 1];
    paintDock();
    if (!nx) {
      // 글로 된 설명서를 따로 두지 않기로 해서(2026-10-12 선생님 말씀 «따라하기 하나로 충분»),
      // 따라 하기에 안 나오는 것만 여기 짧게 모읍니다
      showPanel('<h3 class="gd-t">✓ 따라 하기를 모두 마쳤습니다</h3>' +
        '<p class="gd-b">면접 날에는 이 화면 그대로, 실제 학생으로 하시면 됩니다.</p>' +
        '<ul class="gd-faq">' +
          '<li><b>면접 날 아침</b> — 크롬 · 엣지로 열기 · 마이크(USB · 블루투스)를 학생 쪽에 · 인터넷</li>' +
          '<li><b>마이크 시험</b>은 실제 화면에서 아무 학생으로 «답변 시작» 을 누르고 말해 보기 → 끝나면 «이 리포트 지우기»</li>' +
          '<li><b>받아 적기가 안 되면</b> 면접은 그대로 하고 «평가 · 답변 요지» 칸에 적으면 됩니다</li>' +
          '<li><b>화면이 옛날 같으면</b> 맨 위 «새 버전이 있습니다» 띠의 «새로고침», 안 되면 ' + kbd('Ctrl') + '+' + kbd('F5') + '</li>' +
          '<li><b>학생이 리포트가 안 보인대면</b> «학생에게 전달» 을 눌렀는지</li>' +
          '<li><b>비밀번호를 잊으면</b> 관리자 선생님께 초기화(123456) 부탁 → 로그인하면 새로 정함</li>' +
        '</ul>' +
        '<div class="gd-btns"><button class="ghost" data-act="menu">목차</button>' +
        '<button class="btn solid" data-act="quit">연습 끝내기</button></div>');
      return;
    }
    S.busy = true;
    showPanel('<h3 class="gd-t">✓ ' + S.ch + '장 «' + esc(CH[S.ch].title) + '» 끝</h3>' +
      '<p class="gd-b">이어서 <b>' + (S.ch + 1) + '. ' + esc(nx.title) + '</b> 로 갑니다…</p>');
    var next = S.ch + 1;
    setTimeout(function () { goChapter(next); }, 1800);
  }

  // 말풍선 · 아래 띠 · 가운데 창의 단추(목차 · 장 고르기 · 설명서로)
  function onClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b || S.busy) return;
    var act = b.dataset.act;
    if (act === 'menu') { S.ch = -1; paintDock(); showPanel(menuHTML()); return; }
    if (act === 'quit') { quit(); return; }
    if (act === 'go') { goChapter(Number(b.dataset.ch)); return; }
  }

  // ── 0.25초마다: 선생님이 눌렀으면 넘기고, 테두리 · 말풍선 자리를 맞춥니다 ──
  var lastDyn = '';
  function tick() {
    if (S.busy) return;
    var s = step();
    if (!s || !panel.hidden) return;
    // 다 됐으면 잠깐 두고 넘깁니다 — 예시가 채워진 걸음(글자 · 받아 적기)은 1초, 단추는 0.3초.
    // 바로 넘기면 다음 말풍선이 방금 적힌 예시를 덮어 무엇이 됐는지 못 봅니다
    if (S.showing) {
      // 결과 보여 주기가 끝나면 다음 걸음으로
      if (Date.now() >= S.showUntil) { S.showing = false; advance(); } else place();
      return;
    }
    if (s.watch) paintWait(s);
    if (isDone(s)) {
      if (!S.doneAt) S.doneAt = Date.now();
      var hold = s.act || s.after || s.watch ? 1000 : 300;
      // 보여 주기만 하는 걸음(받아 적기)은 말풍선 글을 다 읽을 시간까지 기다립니다 —
      // 2026-10-12 선생님 말씀: 받아 적기가 끝나자마자 넘어가 버려 설명을 다 못 읽는다
      var read = s.watch ? readMs(s) - (Date.now() - S.enteredAt) : 0;
      if (Date.now() - S.doneAt >= hold && read <= 0) { if (s.show) startShow(s); else advance(); }
      return;
    }
    S.doneAt = 0;
    // 설명이 화면 상태에 따라 바뀌는 걸음(마이크 안내 등)은 바뀌었을 때만 다시 씁니다
    if (typeof s.b === 'function') {
      var now = text(s.b);
      if (now !== lastDyn) { lastDyn = now; var box = tip.querySelector('.gd-b'); if (box) box.innerHTML = now; }
    }
    place();
  }

  // ── 누른 결과 보여 주기 ──
  // 2026-10-12 선생님 말씀: 단추를 누른 결과가 다른 곳에 생기면(«창체 질문 3개» → «낼 질문» 에 3개) 그쪽을 보여 주고
  // 다시 단추 쪽으로 가야 자연스럽다. 그래서 걸음에 show 가 있으면, 다 된 뒤 결과 자리로 화면을 옮겨
  // 초록 테두리 + «✓ …» 말풍선으로 잠깐(글 길이에 맞춰 2.5초~, 또는 ms) 보여 준 다음 다음 걸음으로 갑니다. 그동안은 누를 것이 없습니다
  function startShow(s) {
    var el = $(s.show.at);
    if (!el || !rectOf(el)) { if (el) reveal(el); }
    if (!el || !rectOf(el)) { advance(); return; }
    S.showing = true;
    var d = document.createElement('div'); d.innerHTML = s.show.t + ' ' + (s.show.b || '');
    S.showUntil = Date.now() + (s.show.ms || Math.max(2500, d.textContent.replace(/\s+/g, '').length * 90));
    var r = rectOf(el);
    if (s.show.top || r.top < 72 || r.bottom > window.innerHeight - 24) window.scrollBy(0, r.top - 120);
    tip.hidden = false;
    tip.innerHTML = '<span class="gd-arrow"></span><h3 class="gd-t">✓ ' + esc(s.show.t) + '</h3>' +
      (s.show.b ? '<div class="gd-b">' + s.show.b + '</div>' : '');
    tip.dataset.kind = 'show';
    place();
  }

  function place() { placeRing(); placeTip(); }

  function placeRing() {
    var el = !panel.hidden ? null : target_();
    if (!el) { ring.hidden = true; return; }
    var r = rectOf(el), pad = 6;
    ring.hidden = false;
    ring.style.top = (r.top - pad) + 'px';
    ring.style.left = (r.left - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px';
    ring.style.height = (r.height + pad * 2) + 'px';
    ring.dataset.kind = S.showing ? 'show' : '';
  }

  // 말풍선 자리 — 단추 아래 → 위 → 오른쪽 → 왼쪽 가운데 화면 안에 들어가는 곳. 어디에도 안 들어가면(아주 큰 칸) 오른쪽 아래 구석에
  function placeTip() {
    if (tip.hidden) return;
    var el = target_(), vw = window.innerWidth, vh = window.innerHeight, gap = 14, TOP = 72;
    var w = Math.min(340, vw - 24);
    tip.style.width = w + 'px';
    tip.style.maxHeight = '';
    var h = tip.offsetHeight, arrow = tip.querySelector('.gd-arrow');
    function put(where, left, top, ax, ay) {
      S.place = where;
      tip.dataset.place = where;
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
      if (!arrow) return;
      arrow.style.left = ax == null ? '' : Math.round(ax) + 'px';
      arrow.style.top = ay == null ? '' : Math.round(ay) + 'px';
    }
    function clamp(v, a, z) { return Math.max(a, Math.min(z, v)); }
    if (!el) { put('corner', vw - w - 16, vh - h - 56); return; }
    var r0 = rectOf(el);
    // tipBeside — 말풍선은 그 창 옆에 두고(테두리 · 화살표는 단추에). QR 창 가운데 아래 «닫기» 가 그렇습니다
    var side = step() && step().tipBeside ? rectOf($(step().tipBeside)) : null;
    function tryAt(r, order) {
      var anchorX = r.width > w ? r.left + 48 : r.left + r.width / 2;
      var left = clamp(anchorX - w / 2, 8, vw - 8 - w);
      var ax = clamp(anchorX - left - 8, 14, w - 30);
      var top = clamp(r.top + r.height / 2 - h / 2, TOP, vh - 8 - h);
      var ay = clamp(r.top + r.height / 2 - top - 8, 14, h - 30);
      var ways = {
        below: function () { return r.bottom + gap + h <= vh - 8 && (put('below', left, r.bottom + gap, ax, null), true); },
        above: function () { return r.top - gap - h >= TOP && (put('above', left, r.top - gap - h, ax, null), true); },
        right: function () { return r.right + gap + w <= vw - 8 && (put('right', r.right + gap, top, null, ay), true); },
        left:  function () { return r.left - gap - w >= 8 && (put('left', r.left - gap - w, top, null, ay), true); }
      };
      for (var i = 0; i < order.length; i++) if (ways[order[i]]()) return true;
      return false;
    }
    var normal = ['below', 'above', 'right', 'left'];
    // 걸음마다 먼저 볼 쪽을 정할 수 있습니다(QR 창의 «닫기» 는 옆으로 — 위로 붙이면 QR 그림을 가립니다)
    if (side && tryAt({ left: side.left, right: side.right, width: side.width, top: r0.top, bottom: r0.bottom, height: r0.height },
                      step().prefer || normal)) return;
    if (tryAt(r0, side ? normal : (step() && step().prefer) || normal)) return;
    // 어디에도 다 안 들어가면(휴대폰의 QR 창처럼) 누를 곳의 반대쪽 화면 끝에 — 누를 곳만은 가리지 않게
    var lowHalf = r0.top + r0.height / 2 > vh / 2;
    var room = lowHalf ? r0.top - TOP - 10 : vh - r0.bottom - 18;
    var hh = Math.min(h, Math.max(120, room));
    tip.style.maxHeight = hh + 'px';
    put('corner', 8, lowHalf ? TOP : vh - hh - 8);
  }

  function start() {
    build();
    var m = location.search.match(/[?&]guide=(\d+)/);
    var n = m ? Number(m[1]) : -1;
    if (n >= 0 && n < CH.length) goChapter(n);
    else { paintDock(); showPanel(menuHTML()); }
    setInterval(tick, 250);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
  }

  // 면접 화면이 다 뜬 뒤(로그인 확인 → 명단 읽기)에 시작합니다
  (function wait() {
    var app = document.getElementById('app');
    if (app && !app.hidden && typeof students !== 'undefined' && students.length) { start(); return; }
    setTimeout(wait, 100);
  })();
})();
