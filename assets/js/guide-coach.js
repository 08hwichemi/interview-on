// 연습 모드의 안내 — 설명서(teacher/guide.html)의 «직접 해 보기» 에서만 뜹니다.
//
// 실제 면접 화면에서 눌러야 할 단추에 주황 테두리를 두르고, 그 바로 옆에 말풍선으로 무엇을 누를지 적습니다.
// 선생님이 그 단추를 **실제로 누르면** 다음 걸음으로 넘어갑니다(화면의 상태를 보고 알아챕니다).
// «다음 →» 같은 안내용 단추는 두지 않습니다 — 2026-10-12 선생님 말씀 «오른쪽 아래 다음 버튼처럼 말고 실제 버튼 누르는 것처럼».
// 저장은 가짜 서버(guide-server.js)에만 됩니다.
//
// 걸음 하나 = { t: 무엇을 누를지, b: 설명, at: 테두리를 두를 곳, done: 눌렀는가, auto: 대신 해 주기 }
//   · done 이 참이 되면 저절로 다음 걸음. 장이 끝나면 잠깐 알리고 다음 장으로
//   · 막히면 말풍선 안의 작은 «대신 해 주기» — 그 단추를 대신 눌러 다음 걸음이 꼬이지 않게 합니다
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

  // ── 화면을 처음 상태로 (묻는 창 없이) ──
  function home() {
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
      if (!a.transcript) a.transcript = SAID[i % SAID.length];
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
  // 걸음마다 «실제 단추» 하나를 누르게 합니다(2026-10-12 선생님 말씀: 오른쪽 아래 «다음» 단추 말고 실제 단추를 누르는 것처럼).
  // 그래서 읽기만 하는 걸음은 두지 않고, 알아 둘 것은 그다음 누를 단추의 설명에 붙였습니다.
  var CH = [
    { title: '화면 둘러보기', setup: function () { home(); }, steps: [
      { at: '#rail-tab-other', t: '«🏫 타학교 면접» 을 눌러 보세요',
        done: function () { return railOther; }, auto: function () { railShowOther(true); },
        b: '왼쪽 칸은 <b>학생 목록</b>입니다. 이 탭으로 우리 학교 / 다른 학교 학생 목록을 바꿉니다.<br>' +
           '연습은 이렇게 갑니다 — <b>주황 테두리 단추를 직접 누르면</b> 다음으로 넘어갑니다.' },
      { at: '#rail-tab-ours', t: '다시 «우리 학교» 를 누르세요',
        done: function () { return !railOther; }, auto: function () { railShowOther(false); },
        b: '오른쪽 칸에는 고른 학생의 <b>준비 → 진행 → 마무리 → 리포트</b>가 차례로 나옵니다.<br>' +
           '머리말 오른쪽 끝 <b>v2026-…</b> 은 판 번호입니다. 맨 위에 «새 버전이 있습니다» 띠가 뜨면 «새로고침».' }
    ] },

    { title: '질문지 만들기', setup: function () { home(); }, steps: [
      { at: '#class-chips', t: '«1반» 을 누르세요', done: function () { return pickedClass === '301'; },
        auto: function () { pickClass('301'); },
        b: '반 단추로 명단을 줄입니다. 위 칸에 학번 · 이름을 쳐서 찾아도 됩니다.' },
      { at: function () { return rowOf('#student-list', MAIN); }, t: '«30101 김연습» 을 누르세요',
        done: function () { return target && target.id === MAIN && on('setup'); },
        auto: function () { return pickStudent(MAIN); },
        b: '오른쪽에 그 학생의 «면접 준비» 화면이 열립니다.' },
      { at: function () { var r = rowOf('#student-list', MAIN); return r && r.querySelector('.star'); }, t: '이름 옆 ★ 를 누르세요',
        done: function () { return favorites[MAIN] === true; }, auto: function () { return toggleFavorite(MAIN); },
        b: '맡은 학생은 ★ 로 담아 두면 명단 맨 위 «★ 담당 학생» 에 모입니다(계정에 남아 다른 컴퓨터에서도 같음).' +
           '<p class="gd-more">오른쪽 위에는 이 학생의 <b>지난 면접</b>(회차 — 누르면 그때 리포트)과 <b>수시 지원</b>(대학 · 학과 · 면접 날짜)이 보입니다.</p>' },
      { at: '#opening-box', t: '첫인사 «자기소개 + 지원동기» 를 누르세요',
        done: function () { return opening.on && opening.key === 'both'; }, auto: function () { pickOpening('both'); },
        b: '면접을 여는 질문입니다. 문장은 그 자리에서 고쳐 써도 되고, 고른 것을 다시 누르면 첫인사를 뺍니다.' },
      { at: 'button[onclick^="loadCommon(\'changche\'"]', t: '«창체 질문 3개» 를 누르세요',
        done: function () { return midQuestions.length >= 3; }, auto: function () { return loadCommon('changche', '공동체역량'); },
        b: '추천 질문 3개가 «낼 질문» 맨 아래에 붙습니다. «전공 질문 3개» 도 같습니다.' },
      { at: 'button[onclick^="addQuestion(\'\'"]', t: '«＋ 직접 적기» 를 누르고 질문을 적으세요',
        enter: function () { S.mark = midQuestions.length; },
        done: function () { var q = midQuestions[midQuestions.length - 1]; return midQuestions.length > S.mark && q && q.text.trim().length >= 4; },
        auto: function () { addQuestion('화학 세특의 반응 속도 탐구에서 가장 어려웠던 점은 무엇인가요?', '기타'); },
        b: '빈 칸이 «낼 질문» 맨 아래에 생기고 커서가 갑니다. 질문을 하나 적어 보세요.' },
      { at: function () { var s = document.querySelectorAll('#q-list .qrow select'); return s[s.length - 1]; }, t: '무엇을 보는 질문인지 고르세요',
        done: function () { var q = midQuestions[midQuestions.length - 1]; return q && q.competency !== '기타'; },
        auto: function () { setQComp(midQuestions.length - 1, '학업역량'); renderQuestions(); },
        b: '방금 적은 질문 오른쪽 칸에서 <b>학업역량 · 진로역량 · 공동체역량</b> 중 하나. 리포트에서 역량별로 모아 보여 줍니다. 필요 없는 질문은 «빼기».' },
      { at: '#btn-save-sheet', t: '«질문지 저장» 을 누르세요',
        done: sheetSaved, auto: function () { return saveSheet(); },
        b: '<b>면접은 시작되지 않고</b> 질문만 남겨 둡니다. 면접 날에는 학생만 고르면 이 질문지가 그대로 뜹니다.' +
           '<p class="gd-more">다른 질문 단추 — <b>📄 생기부에서 뽑기</b>(PDF 를 이 브라우저 안에서만 읽어 질문 후보를 뽑음, 서버에 안 올라감) · ' +
           '<b>✍️ 학생 질문</b>(학생이 답안 연습장에 쓴 질문). 맨 아래 끝인사 «마지막으로 하고 싶은 말» 은 붙박이입니다.</p>' }
    ] },

    { title: '면접 진행 · 마이크', setup: readySetup, steps: [
      { at: '#btn-start', t: '«질문 완료 · 면접 화면으로 →» 를 누르세요',
        done: function () { return on('run'); }, auto: function () { return startInterview(); },
        b: '화면만 넘어갑니다 — <b>아직 면접이 시작된 것은 아닙니다.</b>' },
      { at: '#btn-timer', t: '«면접 시작» 을 누르세요',
        done: function () { return startedOnce; }, auto: function () { toggleTimer(); },
        b: function () {
          return '위가 지금 낼 질문, 왼쪽은 질문 진행 상황입니다. «면접 시작» 을 누르면 «면접 전체» 시계가 흐르고 <b>이때부터 진짜 면접</b>입니다.' +
            (!listenCtor() ? '<p class="gd-warn">이 브라우저에는 받아 적기가 없습니다. <b>크롬이나 엣지</b>로 열어 주세요(면접은 받아 적기 없이도 됩니다).</p>'
              : listenWanted() ? '<p class="gd-more">아래 받아 적기 단추가 «🎤 받아 적기 끄기» 로 보이면 켜져 있는 것입니다. 면접 날 이것부터 확인하세요.</p>'
              : '<p class="gd-warn">받아 적기가 꺼져 있습니다. 아래 «🎤 받아 적기 켜기» 를 눌러 켜 주세요.</p>');
        } },
      { at: '#btn-answer', t: '질문을 읽고 «답변 시작» 을 누르세요',
        done: function () { return answering || (cur() && cur().seconds > 0); }, auto: function () { toggleAnswer(); },
        b: '질문을 소리 내어 읽은 뒤, 학생이 말을 시작할 때 누릅니다(키보드 ' + kbd('Space') + '). 그때부터 «이 질문 답변» 시계와 받아 적기가 켜집니다. ' +
           '선생님이 질문 읽는 소리는 안 적힙니다.<p class="gd-more"><b>처음 한 번은 크롬이 «마이크 사용» 을 묻습니다 → «허용».</b></p>' },
      { at: '#livebox', t: '학생인 셈 치고 말해 보세요', autoLabel: '마이크가 없어요 · 건너뛰기',
        done: function () { return !!(cur() && cur().transcript); },
        auto: function () { listenAppend(qIndex, SAID[0]); listenPaint(); },
        b: function () {
          // 마이크가 막혀 꺼진 것이면 «왜» 를 먼저(listen.js 의 LISTEN.hint — 자물쇠 → 허용)
          var warn = !listenCtor() ? '이 브라우저에는 받아 적기가 없습니다 — 크롬 · 엣지에서 해 보세요.'
                   : LISTEN.hint ? LISTEN.hint + (listenWanted() ? '' : ' 그다음 «🎤 받아 적기 켜기».')
                   : !listenWanted() ? '받아 적기가 꺼져 있습니다. «🎤 받아 적기 켜기» 를 누르세요.' : '';
          return (warn ? '<p class="gd-warn">' + warn + '</p>' : '') +
            '«안녕하세요, 저는 …» 하고 말해 보세요. 이 칸에 글이 뜨면 마이크가 잘 되는 것입니다.' +
            '<ul><li>노트북 안의 마이크는 책상 건너편 목소리를 잘 못 잡습니다 → <b>USB · 블루투스 마이크를 학생 쪽에</b></li>' +
            '<li>스피커 소리(영상 등)는 안 적힙니다 · 인터넷이 있어야 합니다</li>' +
            '<li>받아 적은 글은 틀린 데가 있을 수 있습니다</li></ul>';
        } },
      { at: '#rating-area', t: '«우수 · 보통 · 미흡» 중 하나를 누르세요',
        done: function () { return !!(cur() && cur().rating); }, auto: function () { pickRating('보통'); },
        b: '들으면서 크게 하나만. 키보드 ' + kbd('1') + ' ' + kbd('2') + ' ' + kbd('3') + ' 도 됩니다. 다시 누르면 지워집니다. ' +
           '<b>안 눌러도 됩니다</b> — 끝난 뒤 받아 적은 글을 보며 매겨도 됩니다.' },
      { at: '#area-grid', t: '영역 줄에서 «좋음 · 보통 · 아쉬움» 하나를 누르세요',
        done: function () { return !!(cur() && Object.keys(cur().areas || {}).length); },
        auto: function () { pickArea(qIndex, '내용', '좋음'); },
        b: '내용 · 근거 · 말하기 · 태도 · 전공 연결 — 눈에 띈 줄만 눌러도 됩니다.' },
      { at: '#answer-memo', t: '평가 · 답변 요지를 한 줄 적어 보세요', autoLabel: '안 적고 넘어가기',
        done: function () { return !!(cur() && cur().memo && cur().memo.trim()); },
        auto: function () { var m = $('#answer-memo'); m.value = '동기가 또렷함. 결론을 먼저 말하면 더 좋겠음.'; setMemo(m); },
        b: '<b>학생 리포트에 그대로 들어갑니다.</b> 안 적어도 됩니다.' },
      { at: '#btn-next', t: '«다음 질문 →» 을 누르세요',
        done: function () { return qIndex >= 1 || on('finish'); }, auto: function () { return nextQuestion(); },
        b: '키보드 ' + kbd('→') + ' 도 됩니다. 답변 시계와 받아 적기가 멈추고 다음 질문으로 갑니다.' },
      { at: '#btn-answer', t: '새 질문을 읽고 다시 «답변 시작»',
        done: function () { return qIndex >= 1 && (answering || (cur() && cur().seconds > 0)) || on('finish'); },
        auto: function () { toggleAnswer(); },
        b: '«면접 전체» 는 계속 흐르고, «이 질문 답변» 은 멈춘 채 기다립니다.' +
           '<p class="gd-more">잠깐 멈출 일이 생기면 «일시정지» → «이어서». 면접 도중 질문을 더하거나 고치려면 첫 질문의 «← 질문 고치기» — 매긴 평가는 그대로 남습니다.</p>' },
      { at: '#btn-next', t: '끝까지 가서 «면접 마무리 →» 를 누르세요', autoLabel: '남은 질문 건너뛰고 마무리로',
        done: function () { return on('finish'); }, auto: fastFinish,
        b: '남은 질문도 «답변 시작» → (학생 답변) → «다음 질문 →». 마지막 질문에서는 이 단추가 <b>«면접 마무리 →»</b> 로 바뀝니다.' +
           '<p class="gd-more">키보드: ' + kbd('1') + kbd('2') + kbd('3') + ' 판정 · ' + kbd('Space') + ' 답변 시작/끝 · ' + kbd('→') + ' 다음 · ' + kbd('←') + ' 이전 ' +
           '(글자 칸에 커서가 있으면 글자로 들어감)</p>' }
    ] },

    { title: '마무리 · 리포트 전달', setup: async function () {
        if (on('finish')) return;
        await readySetup();
        await fastFinish();
      }, steps: [
      { at: '#answer-summary .ansrow .eg-row', t: '좋았던 점 · 아쉬운 점 단추를 하나 누르세요',
        done: function () { return answers.some(function (a) { return a.good.length || a.bad.length; }); },
        auto: function () { var c = $('#answer-summary .eg-chips .chip.good'); if (c) c.click(); },
        b: '질문마다 위에 <b>«학생이 말한 내용(받아 적은 것)»</b> 이 있습니다. 그걸 보며 영역 줄마다 해당하는 단추를 누릅니다(다시 누르면 빠짐). ' +
           '면접 중에 누른 것은 그대로 와 있고, 아래 «이 답변은» · 요지 칸도 여기서 고칩니다.' },
      { at: '#scoresheet', t: '채점표에서 A ~ E 를 하나 누르세요',
        done: function () { return Object.keys(grades).length > 0; },
        auto: function () { var g = document.querySelectorAll('#scoresheet .scorerow .gbtn')[1]; if (g) g.click(); },
        b: '평가요소 6줄 — <b>다 안 찍어도 됩니다.</b>' },
      { at: '#finish-note', t: '한 줄 총평을 적어 보세요', autoLabel: '안 쓰고 넘어가기',
        done: function () { return !!$('#finish-note').value.trim(); },
        auto: function () { $('#finish-note').value = '경험은 풍부한데 결론을 먼저 말하는 연습이 필요합니다.'; },
        b: '학생에게 남길 한마디입니다. 안 써도 됩니다.' },
      { at: '#btn-finish', t: '«면접 끝내기 · 리포트 보기 →» 를 누르세요',
        done: function () { return on('report') && !!viewing; }, auto: function () { return finishInterview(); },
        b: '평가를 한꺼번에 저장하고 리포트 한 장으로 보여 줍니다. <b>아직 학생에게 가지 않습니다.</b>' },
      { at: '#btn-deliver', t: '«학생에게 전달» 을 누르세요',
        done: function () { return !!(viewing && viewing.interview && viewing.interview.status === '전달됨'); },
        auto: function () { return deliverReport(); },
        b: '위가 학생이 받을 리포트 그대로입니다(맨 위 «인쇄» 로 종이 · PDF, 고칠 것은 «← 채점표 고치기»). ' +
           '<b>전달을 눌러야 학생 폰 «내 면접 리포트» 에 보입니다.</b>' +
           '<p class="gd-more">보낸 뒤에 고치면 리포트에 «고친 날» 이 남습니다. 잘못 시작한 면접은 «이 리포트 지우기».</p>' }
    ] },

    { title: '창이 닫혔을 때', setup: async function () { plantUnfinished(); home(); await sleep(200); }, steps: [
      { at: '#unfinished', t: '«이보기 … 이어서 하기 →» 를 누르세요',
        done: function () { return on('run') && target && target.id === RESUME; },
        auto: function () { return resumeInterview('guide-resume'); },
        b: '면접 도중 창이 닫히거나 노트북이 꺼져도 괜찮습니다. 면접ON 을 다시 열면 첫 화면에 <b>«끝내지 못한 면접이 있습니다»</b> 가 뜹니다.' },
      { at: '#btn-timer', t: '«이어서» 를 누르세요',
        done: function () { return ticking; }, auto: function () { toggleTimer(); },
        b: '매긴 평가 · 받아 적은 글 · 질문은 그대로이고, <b>아직 안 매긴 질문</b>에 가 있습니다. 시계는 멈춰 있어서 «이어서» 를 눌러야 흐릅니다.' }
    ] },

    { title: '🏫 타학교 면접', setup: function () { home(); }, steps: [
      { at: '#rail-tab-other', t: '«🏫 타학교 면접» 을 누르세요',
        done: function () { return railOther; }, auto: function () { railShowOther(true); },
        b: '다른 학교 학생은 명단 · 계정 없이 <b>학교 · 이름 · 희망 전공</b>만 적고 같은 화면으로 면접합니다.' },
      { at: '.otheradd', t: '«＋ 타학교 학생 더하기» 를 누르세요',
        done: function () { return target && target.other && on('setup'); }, auto: function () { otherNew(); },
        b: '목록은 이 학교 선생님 모두가 같이 봅니다 — 면접 날 나눠 맡으시라고.' },
      { at: '.otherform', t: '학교 · 이름 · 희망 전공을 적으세요',
        done: function () { return target && target.other && String(target.name).trim() && String(target.school).trim(); },
        auto: function () {
          [['other-school', '한빛고', otherSetSchool], ['other-name', '홍길동', otherSetName], ['other-major', '컴퓨터공학과', otherSetMajor]]
            .forEach(function (f) { var el = document.getElementById(f[0]); if (!el.value.trim()) el.value = f[1]; f[2](el); });
        },
        b: '예: 한빛고 · 홍길동 · 컴퓨터공학과. 이름은 꼭 있어야 합니다. 다음 학생부터 학교 칸은 마지막에 적은 학교로 채워져 있습니다.' },
      { at: '.otheracts', t: '«명단 저장» 을 누르세요',
        done: function () { return target && target.other && !!target.ivId; }, auto: function () { return otherSaveRoster(false); },
        b: '칸에서 ' + kbd('Enter') + ' 도 됩니다. 여러 명을 넣을 땐 <b>«저장하고 다음 학생 ＋»</b> — 학교는 그대로 두고 이름 칸으로 갑니다.' },
      { at: '.btnrow button[onclick="otherTogglePaste()"]', t: '«📋 여러 질문 붙여넣기» 를 누르세요',
        done: function () { return !$('#other-paste').hidden || midQuestions.length >= 2; }, auto: function () { otherTogglePaste(); },
        b: '생기부로 따로 만들어 온 질문을 한꺼번에 넣는 단추입니다.' },
      { at: '#other-paste', t: '질문을 붙여 넣고 ««낼 질문» 에 넣기» 를 누르세요',
        done: function () { return midQuestions.length >= 2; },
        extra: { label: '예시 질문 붙여 넣기', fn: function () {
          $('#other-paste-text').value = '1. 탐구 주제를 고른 까닭은 무엇인가요?\n2) 그 실험에서 가장 어려웠던 점은?\nQ3. 희망 전공과 이어지는 활동을 하나 소개해 주세요.';
        } },
        auto: function () {
          var ta = $('#other-paste-text');
          if (!ta.value.trim()) ta.value = '1. 탐구 주제를 고른 까닭은 무엇인가요?\n2) 그 실험에서 가장 어려웠던 점은?';
          if ($('#other-paste').hidden) otherTogglePaste();
          otherPasteAdd();
        },
        b: '한 줄에 질문 하나씩. 앞 번호(1. 2) Q3.)는 저절로 떼어지고, 같은 질문은 건너뜁니다.' },
      { at: '#btn-save-sheet', t: '«질문지 저장» 을 누르세요',
        done: sheetSaved, auto: function () { return saveSheet(); },
        b: '면접 날 왼쪽 목록에서 학생을 누르기만 하면 이 질문지가 뜹니다.' +
           '<p class="gd-more">왼쪽 목록은 학교별로 묶여 접히고, 줄마다 ★(담당 학생) · 🗑(지우기) · 어디까지 했는지(질문 준비 / 면접 중 / QR 아직 / QR 줌)가 붙습니다.</p>' },
      { at: '#btn-start', t: '면접은 우리 학교와 똑같습니다', autoLabel: '마무리 화면까지 빨리 넘기기',
        done: function () { return on('finish'); }, auto: fastFinish,
        b: '«질문 완료 · 면접 화면으로 →» → «면접 시작» → «답변 시작» … 직접 해 보셔도 되고, 앞 장에서 해 보셨다면 아래로 마무리 화면까지 건너뛰세요.' },
      { at: '#btn-finish', t: '«면접 끝내기 · 리포트 보기 →» 를 누르세요',
        done: function () { return on('report') && !!viewing; }, auto: function () { return finishInterview(); },
        b: '채점표 · 총평은 우리 학교와 같습니다. 끝내면 평가서 한 장이 나옵니다.' },
      { at: '#btn-deliver', t: '«📱 QR 로 평가서 주기» 를 누르세요',
        done: function () { return $('#qr-overlay').style.display === 'flex'; }, auto: function () { return deliverReport(); },
        b: '«학생에게 전달» 자리에 이 단추가 있습니다. 누르면 큰 QR 이 뜹니다.' },
      { at: '.qr-btns .btn.solid', t: '학생이 찍었으면 «닫기»', prefer: ['right', 'left', 'below'], tipBeside: '.qr-card',
        done: function () { return $('#qr-overlay').style.display !== 'flex'; }, auto: function () { otherCloseQR(); },
        b: '학생이 휴대폰 <b>기본 카메라</b>로 QR 을 찍으면 로그인 없이 평가서가 열리고 «📄 PDF로 저장» 으로 받습니다 ' +
           '(카톡 · 네이버 앱 안에서는 PDF 저장이 안 될 수 있음 → «인쇄창으로 저장»).<br>' +
           '<b>QR 을 보여 준 때부터 24시간만</b> 열리고 그 뒤엔 서버에서 지워집니다 — 그 자리에서 바로 저장하게 해 주세요.' +
           '<p class="gd-warn">연습 QR 은 찍어도 열리지 않습니다(가짜 서버라서).</p>' },
      { at: '#btn-deliver', t: '못 찍었으면 — «📱 QR 다시 보기»',
        done: function () { return $('#qr-overlay').style.display === 'flex'; }, auto: function () { return deliverReport(); },
        b: '같은 QR 이 다시 뜨고, 그때부터 다시 24시간 열립니다.' },
      { at: '.qr-btns .btn.solid', t: '«닫기» 를 누르세요', prefer: ['right', 'left', 'below'], tipBeside: '.qr-card',
        done: function () { return $('#qr-overlay').style.display !== 'flex'; }, auto: function () { otherCloseQR(); },
        b: '«이 리포트 지우기» 는 <b>평가만</b> 지우고 학생 · 질문은 남깁니다. 학생째 지우려면 목록의 🗑 또는 «○○고 N명 모두 지우기».' }
    ] }
  ];
  window.__guideChapters = CH;   // 화면 시험(check-guide.js)이 걸음마다 확인합니다

  // ════════════════ 말풍선 ════════════════
  // 눌러야 할 단추에 주황 테두리(.gd-ring)를 두르고, 그 바로 옆에 말풍선(.gd-tip)을 붙입니다 — 화살표가 단추를 가리킵니다.
  // 넘어가는 것은 오직 선생님이 그 단추를 실제로 눌렀을 때(화면 상태가 바뀐 것을 보고 압니다).
  // 막히면 말풍선 안의 작은 «대신 해 주기». 왼쪽 아래 작은 띠(.gd-dock)에 «목차 · 안내 숨기기».
  var S = { ch: -1, st: 0, hide: false, busy: false, flash: 0, doneCh: {}, mark: 0, place: '' };
  window.__guideState = function () { return { ch: S.ch, st: S.st, busy: S.busy, place: S.place }; };   // 화면 시험용
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
    if (out) { out.textContent = '연습 끝내기'; out.setAttribute('onclick', ''); out.onclick = quit; }
    var chat = $('#chat-open'); if (chat) chat.style.display = 'none';
  }

  function quit() { location.href = 'guide.html'; }

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
    var el = typeof s.at === 'function' ? s.at() : $(s.at);
    return rectOf(el) ? el : null;
  }

  function paintDock() {
    var s = step();
    dock.innerHTML = '<span class="gd-cap">🎓 연습 면접</span>' +
      (s ? '<span class="gd-where">' + S.ch + '. ' + esc(CH[S.ch].title) + ' · ' + (S.st + 1) + ' / ' + CH[S.ch].steps.length + '</span>' : '') +
      '<button class="gd-x" data-act="menu">목차</button>' +
      (s ? '<button class="gd-x" data-act="hide">' + (S.hide ? '안내 보이기' : '안내 숨기기') + '</button>' : '');
  }

  function paintTip() {
    var s = step();
    if (!s || S.hide) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.innerHTML = '<span class="gd-arrow"></span>' +
      '<h3 class="gd-t">👉 ' + esc(s.t) + '</h3>' +
      '<div class="gd-b">' + text(s.b) + '</div>' +
      (s.extra ? '<button class="gd-extra" data-act="extra">' + esc(s.extra.label) + '</button>' : '') +
      '<div class="gd-foot"><button class="gd-auto" data-act="auto">' + esc(s.autoLabel || '잘 안 되면 · 대신 해 주기') + '</button></div>';
    tip.dataset.flash = S.flash > Date.now() ? 'yes' : 'no';
  }

  // 가운데 창 — 목차 · 장이 끝났을 때 · 마지막
  function showPanel(html) { panel.innerHTML = html; panel.hidden = false; tip.hidden = true; ring.hidden = true; }
  function menuHTML() {
    return '<h3 class="gd-t">어디부터 해 볼까요?</h3>' +
      '<p class="gd-b">실제 면접 화면 그대로입니다. 가짜 학생으로 연습하고, <b>실제 서버에는 아무것도 저장되지 않습니다.</b> ' +
      '주황 테두리가 둘러진 단추를 직접 누르면 다음으로 넘어갑니다.</p>' +
      '<ol class="gd-menu">' + CH.map(function (c, i) {
        return '<li><button data-act="go" data-ch="' + i + '">' +
          '<span class="n">' + i + '</span><span class="nm">' + esc(c.title) + '</span>' +
          '<span class="ok">' + (S.doneCh[i] ? '✓ 해 봄' : c.steps.length + '걸음') + '</span></button></li>';
      }).join('') + '</ol>';
  }

  async function goChapter(i) {
    S.busy = true;
    S.ch = i; S.st = 0; S.hide = false;
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
      showPanel('<h3 class="gd-t">✓ 연습을 모두 마쳤습니다</h3>' +
        '<p class="gd-b">면접 날에는 이 화면 그대로, 실제 학생으로 하시면 됩니다. 궁금한 것은 설명서의 «자주 묻는 것» 을 보세요.</p>' +
        '<div class="gd-btns"><button class="ghost" data-act="menu">목차</button>' +
        '<button class="btn solid" data-act="quit">설명서로 돌아가기</button></div>');
      return;
    }
    S.busy = true;
    showPanel('<h3 class="gd-t">✓ ' + S.ch + '장 «' + esc(CH[S.ch].title) + '» 끝</h3>' +
      '<p class="gd-b">이어서 <b>' + (S.ch + 1) + '. ' + esc(nx.title) + '</b> 로 갑니다…</p>');
    var next = S.ch + 1;
    setTimeout(function () { goChapter(next); }, 1800);
  }

  async function onClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b || S.busy) return;
    var act = b.dataset.act, s = step();
    if (act === 'hide') { S.hide = !S.hide; paintDock(); paintTip(); place(); return; }
    if (act === 'menu') { S.ch = -1; paintDock(); showPanel(menuHTML()); return; }
    if (act === 'quit') { quit(); return; }
    if (act === 'go') { goChapter(Number(b.dataset.ch)); return; }
    if (act === 'extra' && s && s.extra) { s.extra.fn(); return; }
    if (act === 'auto' && s) {
      S.busy = true;
      try { await s.auto(); } catch (err) { console.error(err); }
      await sleep(250);
      S.busy = false;
      if (isDone(s)) advance();
    }
  }

  // ── 0.25초마다: 선생님이 눌렀으면 넘기고, 테두리 · 말풍선 자리를 맞춥니다 ──
  var lastDyn = '';
  function tick() {
    if (S.busy) return;
    var s = step();
    if (!s || !panel.hidden) return;
    if (isDone(s)) { advance(); return; }
    // 설명이 화면 상태에 따라 바뀌는 걸음(마이크 안내 등)은 바뀌었을 때만 다시 씁니다
    if (typeof s.b === 'function' && !S.hide) {
      var now = text(s.b);
      if (now !== lastDyn) { lastDyn = now; var box = tip.querySelector('.gd-b'); if (box) box.innerHTML = now; }
    }
    place();
  }

  function place() { placeRing(); placeTip(); }

  function placeRing() {
    var el = (S.hide || !panel.hidden) ? null : target_();
    if (!el) { ring.hidden = true; return; }
    var r = rectOf(el), pad = 6;
    ring.hidden = false;
    ring.style.top = (r.top - pad) + 'px';
    ring.style.left = (r.left - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px';
    ring.style.height = (r.height + pad * 2) + 'px';
  }

  // 말풍선 자리 — 단추 아래 → 위 → 오른쪽 → 왼쪽 가운데 화면 안에 들어가는 곳. 어디에도 안 들어가면(아주 큰 칸) 오른쪽 아래 구석에
  function placeTip() {
    if (tip.hidden) return;
    var el = target_(), vw = window.innerWidth, vh = window.innerHeight, gap = 14, TOP = 72;
    var w = Math.min(340, vw - 24);
    tip.style.width = w + 'px';
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
    var r = rectOf(el);
    // tipBeside — 말풍선은 그 창 옆에 두고(테두리 · 화살표는 단추에). QR 창 가운데 아래 «닫기» 가 그렇습니다
    var side = step() && step().tipBeside ? rectOf($(step().tipBeside)) : null;
    if (side) r = { left: side.left, right: side.right, width: side.width, top: r.top, bottom: r.bottom, height: r.height };
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
    // 걸음마다 먼저 볼 쪽을 정할 수 있습니다(QR 창의 «닫기» 는 옆으로 — 위로 붙이면 QR 그림을 가립니다)
    var order = (step() && step().prefer) || ['below', 'above', 'right', 'left'];
    for (var i = 0; i < order.length; i++) if (ways[order[i]]()) return;
    put('corner', vw - w - 16, vh - h - 56);
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
