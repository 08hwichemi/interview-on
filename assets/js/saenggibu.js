// 생기부에서 질문 뽑기
//
// ⚠️ 생기부는 브라우저 안에서만 읽고 버립니다. 서버로 보내지 않습니다.
//    남는 것은 선생님이 «낼 질문» 에 담은 질문 글자뿐입니다.
//
// 파일은 셋으로 나뉩니다.
//   ① 글자 꺼내기   pdf.js 로 PDF 에서 줄을 뽑습니다 (브라우저에서만 됩니다)
//   ② 자르기        영역과 학년으로 자릅니다        — 순수 함수, 시험하기 쉽습니다
//   ③ 질문 만들기   문장에서 이야깃거리를 찾아 틀에 끼웁니다 — 역시 순수 함수
//
// ②③ 은 브라우저가 없어도 돌아갑니다. tools/생기부-시험.js 가 그걸 시험합니다.

// ══════════════ ② 자르기 ══════════════

// 나이스 생기부의 영역 이름. 판마다 조금씩 달라서 여러 표기를 받아 둡니다.
var SG_SECTIONS = [
  { key: 'changche', title: '창의적 체험활동',
    heads: ['창의적 체험활동상황', '창의적체험활동상황', '창의적 체험활동 상황'] },
  { key: 'sesa',     title: '세부능력 및 특기사항',
    heads: ['세부능력 및 특기사항', '세부능력및특기사항', '교과학습발달상황'] },
  // ⚠️ 교과학습발달상황 안에는 성적표가 먼저 나옵니다.
  //    성적표 줄은 sgIsTableRow() 가 걸러 냅니다.
  { key: 'haengteuk', title: '행동특성 및 종합의견',
    heads: ['행동특성 및 종합의견', '행동특성및종합의견'] }
];

// 여기서 끊어야 하는 다른 영역들 (뒤에 붙는 내용이 섞이지 않게)
var SG_STOPS = [
  '인적·학적사항', '인적사항', '학적사항', '출결상황', '수상경력', '자격증취득상황',
  '진로희망사항', '독서활동상황', '봉사활동실적', '학교폭력'
];

// ══ 쪽 머리글·꼬리글 ══
//
// ⚠️ 이것 때문에 창체·행특 기록이 엉망이 됐습니다.
//    글이 쪽을 넘어가면 새 쪽 맨 위에 이런 줄이 들어갑니다 —
//      「부광고등학교  2026년 9월 17일  4 / 19  반 1 번호 9 성명 ○○○」
//    이걸 안 걷어내면 문장 한가운데에 그대로 끼어들고,
//      「…현실적인 해결책을[부광고등학교 …성명 ○○○]든든한 조력자…」
//    그 바람에 뒤따라오는 갈래(동아리활동)까지 앞 칸으로 딸려 들어갑니다.
//    세특은 쪽을 덜 넘어가서 멀쩡해 보였을 뿐입니다.
function sgIsPageFurniture(line) {
  var t = sgNorm(line);
  if (!t) return true;
  if (/^학교\s*생활\s*기록\s*부/.test(t)) return true;
  if (/^-?\s*\d{1,3}\s*-?$/.test(t)) return true;               // 쪽번호
  if (/^\s*-\s*\d{1,3}\s*-\s*$/.test(t)) return true;
  if (/성\s*명\s*[가-힣]{2,5}\s*$/.test(t) && t.length <= 40) return true;
  if (/(?:^|\s)반\s*\d+\s*번\s*호\s*\d+/.test(t)) return true;
  if (/[가-힣]{2,12}(?:초등학교|중학교|고등학교)\s*\d{4}\s*년/.test(t)) return true;
  // ⚠️ 칸을 나누면 꼬리글도 조각조각 흩어집니다 —
  //    「부광고등학교」 「2026년 9월 17일」 「부광고등학교/2026.09.17 08:28/」
  //    한 조각만 놓쳐도 그게 기록 끝에 들러붙습니다.
  if (/^[가-힣]{2,12}(?:초등학교|중학교|고등학교)\s*[\/·]?\s*$/.test(t)) return true;
  if (/^[가-힣]{2,12}(?:초등학교|중학교|고등학교)\s*\//.test(t)) return true;
  if (/^\d{4}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?\s*[.\-/]?\s*$/.test(t)) return true;
  if (/\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\s+\d{1,2}\s*:\s*\d{2}/.test(t)) return true;
  // 「4 / 19」 — 몇 쪽 가운데 몇 쪽. 짧은 줄일 때만 봅니다(성적표의 91/73.8 과 헷갈리지 않게)
  if (t.length <= 40 && /(?:^|\s)\d{1,3}\s*\/\s*\d{1,3}(?:\s|$)/.test(t)) return true;
  return false;
}

// 쪽 꼬리글인가 — 쪽번호(숫자 한두 자)는 뺍니다.
// ⚠️ 창체·행특 표에서는 숫자 한 자가 «학년» 입니다. 그것까지 꼬리글로 보면 안 됩니다.
function sgIsFooterish(text) {
  var t = sgNorm(text);
  if (/^[-\s]*\d{1,3}[-\s]*$/.test(t)) return false;
  return sgIsPageFurniture(t);
}

// 줄을 이어 붙인 뒤에도 머리글이 문장 사이에 끼어 있으면 도려냅니다.
// (pdf.js 가 머리글을 본문 줄과 같은 높이로 돌려주는 판이 있습니다)
var SG_FURNITURE_RUNS = [
  /[가-힣]{2,12}(?:초등학교|중학교|고등학교)\s*\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일[\s\S]{0,40}?성\s*명\s*[가-힣]{2,5}\s*(?:학년)?/g,
  /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*\d{1,3}\s*\/\s*\d{1,3}/g,
  /반\s*\d+\s*번\s*호\s*\d+\s*성\s*명\s*[가-힣]{2,5}/g,
  /\d{1,3}\s*\/\s*\d{1,3}\s*반\s*\d+\s*번\s*호\s*\d+/g
];
function sgScrubFurniture(text) {
  var t = String(text || '');
  SG_FURNITURE_RUNS.forEach(function (re) { t = t.replace(new RegExp(re.source, 'g'), ' '); });
  return sgNorm(t);
}

// 표에서 «칸이 바뀌는 자리» 에 끼워 두는 표시.
// 글에 절대 안 나오는 글자라 본문과 헷갈릴 일이 없습니다.
var SG_CELL_BREAK = '\u241E';

// 창의적 체험활동 안의 갈래
var SG_AREAS = ['자율활동', '동아리활동', '봉사활동', '진로활동'];

function sgNorm(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

// 이 줄이 «영역 제목» 인가.
//
// ⚠️ 예전에는 줄 «어디에든» 그 말이 있으면 제목으로 봤습니다.
//    그래서 진로활동 글의 「자격증 취득을 목표로…」, 행특 글의 「진로희망을…」에서
//    영역이 끊기고 그 뒤가 통째로 사라졌습니다.
//    나이스 제목은 「8. 행동특성 및 종합의견」처럼 그 줄에 제목뿐입니다.
//    그러니 «줄 전체가 그 제목일 때» 만 제목으로 봅니다.
function sgIsHeading(line, words) {
  var t = sgNorm(line).replace(/\s/g, '');
  // 앞의 번호(「8.」)와 괄호·쪽표시를 떼고 남는 알맹이만 견줍니다
  var core = t.replace(/^[0-9]{1,2}[.．)]/, '').replace(/[()[\]{}0-9.\-·]/g, '');
  for (var i = 0; i < words.length; i++) {
    var w = words[i].replace(/[\s·]/g, '');
    if (!w) continue;
    if (core.indexOf(w) !== 0) continue;
    // 제목 뒤에 남는 글자가 거의 없어야 제목입니다 (「과 목 세부능력 및 특기사항」 정도까지)
    if (core.length - w.length <= 3) return true;
  }
  return false;
}

// 성적표·이수 현황 표에만 나오는 말. 세특 글에는 안 나옵니다.
// (「성취도」 는 글에도 나오므로 넣지 않습니다 — 「성취도 향상에 기여함」)
var SG_SCORE_HEAD = /원점수|과목평균|석차등급|표준편차|수강자수|이수학점|이수단위|분포비율|학점수/;
function sgIsScoreHead(line) {
  var t = sgNorm(line);
  return t.length <= 40 && SG_SCORE_HEAD.test(t.replace(/\s/g, ''));
}

// 줄들을 영역별로 자릅니다.
// 반환: { changche:[줄...], sesa:[줄...], haengteuk:[줄...] }
//
// ⚠️ 교과학습발달상황은 «성적표 → 이수학점 합계 → 세부능력 및 특기사항 → 세특 글» 이
//    학기마다 되풀이됩니다. 성적표 칸들이 낱낱이 흩어져 오면
//      「국어」 「사회(역사/도덕포」 「기술・가정/제」 「교양」
//    같은 토막이 되는데, 한글이라 성적표 검사에 안 걸리고 세특 끝에 들러붙습니다.
//    그래서 «문» 을 둡니다 — 「세부능력 및 특기사항」 이 나오면 열고,
//    성적표 머리글이 나오면 닫습니다.
function sgSplitSections(lines) {
  var out = { changche: [], sesa: [], haengteuk: [] };
  var sesaAll = [];                 // 문이 한 번도 안 열리면 이걸 씁니다
  var sesaOpen = false, everOpened = false;
  var cur = null;

  (lines || []).forEach(function (raw) {
    var line = sgNorm(raw);
    if (!line) return;

    // 새 영역이 시작되는가
    // ⚠️ 「개인별 세부능력 및 특기사항」은 새 영역이 아니라 세특 «안» 의 칸입니다.
    //    이것도 영역 제목으로 보고 줄을 버리는 바람에, 개인별 기록이 통째로
    //    앞 과목에 붙어 버렸습니다.
    var started = null;
    if (line.replace(/\s/g, '').indexOf('개인별') === -1) {
      SG_SECTIONS.forEach(function (sec) {
        if (!started && sgIsHeading(line, sec.heads)) started = sec.key;
      });
    }
    if (started) {
      cur = started;
      if (started === 'sesa' && sgIsHeading(line, ['세부능력 및 특기사항'])) {
        sesaOpen = true; everOpened = true;
      }
      return;                       // 제목 줄 자체는 담지 않습니다
    }

    // 우리가 안 보는 영역이 시작되면 끊습니다
    if (sgIsHeading(line, SG_STOPS)) { cur = null; return; }

    if (line === SG_CELL_BREAK) { if (cur) { if (cur === 'sesa') sesaAll.push(line); out[cur].push(line); } return; }

    if (cur === 'sesa') {
      sesaAll.push(line);
      if (sgIsScoreHead(line)) { sesaOpen = false; return; }
      // 학년 표시는 문이 닫혀 있어도 흘려보내야 합니다. 안 그러면 학년이 안 갈립니다.
      if (sesaOpen || sgGradeMarkOf(line, false)) out.sesa.push(line);
      return;
    }
    if (cur) out[cur].push(line);
  });

  // 「세부능력 및 특기사항」 이라는 줄이 한 번도 없는 판이면 문을 안 씁니다
  if (!everOpened) out.sesa = sesaAll;
  return out;
}

// 줄 안에서 학년 표시를 찾습니다.
// 나이스 PDF 는 세 가지로 적습니다 — 「[1학년]」, 「1학년」, 그리고 표 안에서는
// 숫자 하나만 덩그러니 「1」. 마지막 것 때문에 애를 먹었습니다.
// 이 줄이 «학년 표시» 인가. 표시면 { grade, rest } 를, 아니면 null 을 돌려줍니다.
//
// ⚠️ 글 안에 학년이 나오는 일이 아주 흔합니다 —
//      「설문조사를 … 분석한 결과 1학년은 음의, 3학년은 양의 상관관계를 확인함」
//    예전에는 줄 «어디에든» 「N학년」 이 있으면 표시로 봤습니다. 그래서 3학년
//    자율활동의 이 한 줄이 1학년으로 건너가고, 다음 줄에 「3학년」 이 나오자
//    다시 3학년으로 돌아갔습니다 — 딱 한 줄만, 「음」 에서 잘린 채로.
//
//    학년 표시는 «표의 칸» 입니다. 줄에 그것만 있거나 줄 맨 앞에 옵니다.
function sgGradeMarkOf(line, bareOk) {
  var t = sgNorm(line);

  // 「[1학년] …」 — 대괄호로 묶였으면 뒤에 글이 따라와도 표시입니다
  var b = t.match(/^\[\s*(?:제)?\s*([1-3])\s*학\s*년\s*\]\s*/);
  if (b) return { grade: Number(b[1]), rest: sgNorm(t.slice(b[0].length)) };

  // 「1학년」 — 괄호가 없으면 그 줄에 그것만 있을 때입니다.
  //   「1학년은 음의…」 는 조사가 붙어 있으니 표시가 아닙니다.
  var m = t.match(/^(?:제)?\s*([1-3])\s*학\s*년\s*$/);
  if (m) return { grade: Number(m[1]), rest: '' };

  if (bareOk) {
    // 표의 맨 왼쪽 학년 칸 — 숫자 한 자
    var d = t.match(/^\[?\s*([1-3])\s*\]?\s*$/);
    if (d) return { grade: Number(d[1]), rest: '' };
    // 「1 자율활동 (34시간) 다양한…」 — 칸이 한 줄로 합쳐져 나올 때
    var l = t.match(/^\[?\s*([1-3])\s*\]?\s+(?=[가-힣])/);
    if (l) return { grade: Number(l[1]), rest: sgNorm(t.slice(l[0].length)) };
  }
  return null;
}

// 옛 이름 — 학년 숫자만 돌려줍니다
function sgGradeOf(line, bareOk) {
  var m = sgGradeMarkOf(line, bareOk);
  return m ? m.grade : null;
}

// 성적표 줄인가 — 「국어 국어 4 91/73.8(15.5) A(190) 2」 같은 것.
//
// ⚠️ 예전에는 «숫자·기호가 28% 넘으면 표» 로만 봤습니다.
//    그랬더니 날짜가 든 멀쩡한 문장이 통째로 버려졌습니다.
//      「창의과학드림캠프-생명공학 프로그램(2025.05.17)에 참여하여…」
//    그 줄이 사라지니 앞뒤가 붙어 「양하는 활동을」(다양한 ← 앞이 잘림) 이 됐습니다.
//
//    글은 한글이 대부분이고, 성적표 줄은 한글이 몇 자 안 됩니다.
//    그래서 «한글이 얼마나 되는가» 를 먼저 봅니다.
function sgIsTableRow(line) {
  var t = sgNorm(line);
  if (!t) return true;
  var hangul = (t.match(/[가-힣]/g) || []).length;
  // 「2025년 5월 17일에 참여함.」 은 숫자가 많아도 글입니다. 문턱을 낮게 잡습니다.
  // 진짜 성적표 줄은 한글이 10%대입니다.
  if (hangul / t.length >= 0.3) return false;
  var marks = (t.match(/[0-9./()%]/g) || []).length;
  return marks / t.length > 0.28;
}

// 표 머리글·갈래 이름처럼 되풀이되는 줄
var SG_NOISE = [
  '과 목', '세부능력 및 특기사항', '영역 시간 특기사항', '학년 행동특성 및 종합의견',
  '학기 교과 과목', '성취도', '석차등급', '표준편차', '수강자수', '창의적 체험활동상황'
];
function sgIsNoise(line) {
  var t = sgNorm(line);
  if (t.length > 40) return false;
  return SG_NOISE.some(function (w) { return t.indexOf(w) > -1; });
}

// 교과 이수 현황 표 — 「… 인공지능 기초 교양 이수학점 합계 15」
// 한글이 많아서 성적표 검사에 안 걸리는데, 세특이 아닙니다.
// 이걸 과목으로 잡는 바람에 「3학년 · 진로 선택 과목」 같은 칸이 생겼습니다.
function sgIsCourseTable(line) {
  var t = sgNorm(line).replace(/\s/g, '');
  if (/이수학점|이수단위|학점합계|단위합계/.test(t)) return true;
  // ⚠️ 표가 칸칸이 흩어져 오면 「이수학점 합계」 가 다른 줄로 가 버립니다.
  //    남은 조각이 세특 끝에 들러붙어 「<진로 선택 과목>사회(역사/도…」 가 됐습니다.
  //    교과 «구분» 이름이 보이면 그것도 이수 현황 표입니다.
  return /진로선택과목|일반선택과목|공통과목|융합선택과목|전문교과/.test(t);
}

// 「진로 선택」 「일반 선택」 「공통」 은 과목 이름이 아니라 «교과 구분» 입니다.
var SG_NOT_SUBJECT =
  /^(?:공통|일반선택|진로선택|융합선택|전문교과[ⅠⅡ12]?|보통교과|교과|과목|학기|학년|영역|구분|계|합계)(?:과목)?$/;

// 영역 안의 줄들을 학년별로 다시 자릅니다.
// 학년 표시가 없으면 «학년 모름(0)» 으로 모읍니다.
//
// ⚠️ 숫자 한 자(「1」)를 학년으로 볼지는 영역마다 다릅니다.
//    창체·행특 표에서는 맨 왼쪽 칸이 학년이라 「1」이 학년입니다.
//    그런데 교과학습발달상황 표에서는 「1」이 «학기» 입니다.
//    이걸 학년으로 읽는 바람에 1학년 과목(과학탐구실험)이 2학년으로 갔습니다.
//    세특은 「[1학년]」 처럼 또렷이 적힌 것만 봅니다.
//    한 번 「[1학년]」이 나오면 다음 학년 표시가 나올 때까지 계속 1학년입니다.
function sgSplitGrades(lines, sectionKey) {
  var bareOk = (sectionKey !== 'sesa');
  var byGrade = { 0: [], 1: [], 2: [], 3: [] };
  var cur = 0;
  // ⚠️ 안전판 — 학년 표시가 아직 안 나온 줄들은 손에 들고 있다가,
  //    첫 학년이 나오면 그 학년에 얹습니다.
  //    표의 맨 왼쪽이 학년 칸이라 그 «앞» 에 오는 글은 없습니다.
  //    선을 잘못 읽어 학년 표시가 늦게 잡혀도 자율활동이 통째로
  //    «학년 모름» 으로 빠지지 않게 하는 마지막 막음입니다.
  var pending = [];

  (lines || []).forEach(function (raw) {
    var line = sgNorm(raw);
    if (line === SG_CELL_BREAK) { (cur ? byGrade[cur] : pending).push(line); return; }

    var mark = sgGradeMarkOf(line, bareOk);
    if (mark) {
      cur = mark.grade;
      if (pending.length) { byGrade[cur] = byGrade[cur].concat(pending); pending = []; }
      line = mark.rest;                 // 표시를 떼고 남은 글만 담습니다
    }
    if (!line) return;
    if (cur) byGrade[cur].push(line); else pending.push(line);
  });

  // 끝까지 학년이 한 번도 안 나왔으면 «학년 모름» 으로 둡니다
  byGrade[0] = byGrade[0].concat(pending);
  return byGrade;
}

// 줄들을 한 덩어리 글로 잇습니다.
//
// ⚠️ 여기가 제일 중요합니다.
//    나이스 PDF 는 칸 너비에 맞춰 «낱말 가운데서» 줄을 끊습니다.
//      '…추진력이 뛰' / '어나며 수업에…'
//    줄을 띄어쓰기로 이으면 «뛰 어나며» 가 되어 말이 깨집니다.
//    그래서 앞 줄이 문장부호로 끝났을 때만 띄우고, 아니면 그냥 붙입니다.
function sgJoinLines(lines) {
  var text = '';
  (lines || []).forEach(function (line, i) {
    var t = sgNorm(line);
    if (!t) return;
    if (i > 0) text += /[.!?]$/.test(text) ? ' ' : '';
    text += t;
  });
  return text;
}

// 쪽번호·갈래 이름·시간 표시처럼 읽는 데 방해만 되는 것
function sgTidy(text) {
  return sgNorm(String(text || '')
    .replace(/\((?:\s*\d+\s*시간\s*)\)/g, ' ')
    .replace(/\s*-\s*\d+\s*-\s*/g, ' '));
}

// ══ 기록 «전문» ══
//
// ⚠️ 이건 질문을 뽑으려고 다듬는 길과 «따로» 가야 합니다.
//    선생님께 보여드리는 원문에서는 한 글자도 버리면 안 됩니다.
//    예전에는 질문용으로 다듬은 글을 원문이라고 보여줘서,
//    「또한 전기영동 장치를…」 처럼 문단 가운데부터 시작하고
//    「…기초 개념을 학습」 처럼 뒤가 잘렸습니다.
//
//    여기서 버리는 것은 성적표 줄과 표 머리글뿐입니다.
//    길이가 짧다고 버리지 않습니다.
function sgRecordText(lines) {
  var kept = (lines || []).filter(function (l) {
    if (l === SG_CELL_BREAK) return false;          // 칸 바뀜 표시는 글이 아닙니다
    // ⚠️ 표의 이름표 칸(「자율활동」 「1」)은 글이 아니라 «칸 이름» 입니다.
    //    묶음별 기록에서는 sgSplitAreas() 가 떼어 내지만, «원문 전체» 는
    //    줄을 그대로 이어 붙이므로 여기서 걸러야 합니다.
    //    안 그러면 「자율활동글쓰기 활동에 참여하여…」 처럼 앞에 눌어붙습니다.
    if (sgIsCellLabel(l)) return false;
    return !sgIsPageFurniture(l) && !sgIsNoise(l) &&
           !sgIsTableRow(l) && !sgIsCourseTable(l);
  });
  return sgScrubFurniture(sgTidy(sgJoinLines(kept)));
}

// ══ 원문 전체를 «갈래 → 글» 짝으로 ══
//
// 원문 전체는 그 학년 그 영역을 통째로 보여주는 안전판입니다.
// 줄을 그냥 이으면 「자율활동글쓰기 활동에 참여하여…」 처럼 이름표가 앞에 눌어붙습니다.
// 이름표에서 끊어 짝으로 돌려주면, 화면에서 색 네모로 구분해 보여줄 수 있습니다.
// 반환: [{ label, text }] — label 이 '' 이면 이름표가 없는 대목입니다.
function sgRecordParts(lines) {
  var out = [], cur = { label: '', lines: [] };
  (lines || []).forEach(function (raw) {
    var t = sgNorm(raw);
    // 한 자리 학년은 이름표라도 보여줄 것이 없습니다
    if (t && sgIsCellLabel(t) && !/^[1-3]$/.test(t)) {
      if (cur.lines.length) out.push(cur);
      cur = { label: t, lines: [] };
      return;
    }
    cur.lines.push(raw);
  });
  if (cur.lines.length) out.push(cur);

  return out.map(function (c) { return { label: c.label, text: sgRecordText(c.lines) }; })
            .filter(function (c) { return c.text; });
}

// ══ 질문 만들기용 — 문장으로 쪼갭니다 ══
// 생기부는 「~함.」 「~음.」 으로 끝나는 문장이 이어 붙어 있습니다.
// ⚠️ 날짜의 점은 문장 끝이 아닙니다. 「큐리어톤(2026.05.26.~2026.07.14.)에 참여해 …」 가
//    「14.」 에서 끊겨, 이야깃거리가 「)에 참여해 호기심에서출발한 질문」 이 됐습니다(2026-10-05).
//    숫자 뒤의 점은 잠깐 다른 글자로 바꿔 두고 문장을 나눈 뒤 되돌립니다.
var SG_DOT_HOLD = '\u2024';
function sgShieldDots(text) {
  return String(text || '').replace(/(\d)\.(?=\s*(?:\d|~|\)|$))/g, '$1' + SG_DOT_HOLD);
}
function sgUnshieldDots(text) {
  return String(text || '').split(SG_DOT_HOLD).join('.');
}

function sgSentences(lines) {
  var text = sgShieldDots(sgRecordText(lines))
    // 갈래 이름이 문장 앞에 붙어 오면 이야깃거리로 잘못 잡힙니다
    .replace(new RegExp('(' + SG_AREAS.join('|') + ')\\s*\\d*\\s*', 'g'), ' ')
    .replace(/\s+/g, ' ');

  return text.split(/(?<=[.!?])\s+/)
    .map(function (s) { return sgNorm(sgUnshieldDots(s)); })
    .filter(function (s) { return s.length >= 12; });   // 토막 글자는 버립니다
}

// ⚠️ pdf.js 는 글자를 «낱개» 로 돌려줄 때가 많습니다.
//    「히트스마트패치」가 '히','트','스',… 일곱 조각으로 옵니다.
//    이걸 띄어쓰기로 이으면 「히 트 스 마 트 패 치」가 됩니다.
//
//    그래서 조각 사이의 «가로 틈» 을 봅니다.
//    앞 조각이 끝난 자리와 다음 조각이 시작하는 자리가 거의 붙어 있으면
//    한 낱말이니 그냥 붙이고, 뚝 떨어져 있을 때만 띄웁니다.
// 이 칸이 «글» 칸인가 — 이름표 칸인가.
//
// ⚠️ 가로 위치만 보면 안 됩니다. 칸 나누기가 빗나가 「64 에 관심을 가지게…」 처럼
//    시간 칸과 글이 한 덩이가 되면, 왼쪽에 있다는 이유로 이름표로 오해받아
//    글까지 통째로 맨 위로 끌려 올라갑니다.
//    이름표는 짧습니다. 길면 글로 봅니다.
// 표 «머리글» 칸 — 「학년」 「영역」 「시간」 「특기사항」 같은 한 낱말.
//
// ⚠️ 예전에는 「학년 영역 시간 특기사항」 이 한 줄이라 sgIsNoise() 가 걸렀습니다.
//    칸을 나누기 시작하면서 낱낱이 흩어졌고, 그러면 「특기사항」 이 글 칸에 있어서
//    표의 «맨 위» 로 잡힙니다. 그 한 줄 때문에 칸 경계가 통째로 한 줄씩 밀립니다.
//    글자가 똑같을 때만 버립니다 (「1학년」 같은 글은 건드리지 않습니다).
var SG_HEAD_CELLS = [
  '학년', '영역', '시간', '특기사항', '과목', '학기', '교과', '구분', '단위', '학점',
  '비고', '이수시간', '활동내용', '수상명', '등급'
];
function sgIsHeadCell(text) {
  return SG_HEAD_CELLS.indexOf(sgNorm(text).replace(/\s/g, '')) > -1;
}

// 옮겨도 되는 «아는 이름표» 인가 — 창체 갈래 이름이나 한 자리 학년.
function sgIsCellLabel(text) {
  var t = sgNorm(text).replace(/\s/g, '');
  if (/^[1-3]$/.test(t)) return true;
  return SG_AREAS.some(function (a) { return t === a.replace(/\s/g, ''); });
}

function sgIsProseCell(cell, proseX) {
  if (cell.x >= proseX - 6) return true;
  return sgNorm(cell.text).length > 14;
}

// 표의 가로선(괘선) 사이를 «띠» 로 봅니다. 이름표가 든 띠가 곧 그 칸입니다.
//
// ⚠️ 여기가 창체를 정확히 가르는 열쇠입니다.
//    세특은 글 안에 「화학Ⅱ:」 처럼 과목이 적혀 있어 글만 보고 자를 수 있지만,
//    창체는 영역 이름이 «표의 다른 칸» 에 세로 가운데로 놓여 있습니다.
//    「가운데」 라는 셈으로 되짚을 수도 있는데, 칸이 다음 쪽으로 이어지면 그 셈이
//    깨집니다 — 이어지는 쪽 맨 위는 앞 칸인데 거기에 다음 이름표를 붙여 버려서,
//    동아리 내용이 진로활동으로 들어갔습니다.
//    선을 읽으면 추측할 일이 없습니다. 선 사이가 곧 칸입니다.
// ⚠️ 선이 «가로로 어디까지» 뻗었는지 같이 봐야 합니다.
//    나이스 창체 표에서 학년 칸은 자율·동아리·진로 세 칸을 아우릅니다(세로 병합).
//    그래서 자율↔동아리를 가르는 선은 «학년 칸을 지나가지 않습니다».
//    그걸 학년 칸의 경계로 착각하면, 세 칸 가운데에 놓인 학년 「1」 이
//    동아리 칸 맨 위에서 시작하고 그 위의 자율활동이 통째로 «학년 모름» 으로 빠집니다.
//    그 칸을 지나가는 선만으로 띠를 만듭니다.
function sgBandOf(rules, y, x) {
  if (!rules || rules.length < 2) return null;
  var mine = [];
  rules.forEach(function (r) {
    if (typeof r === 'number') { mine.push(r); return; }   // 가로 범위를 모르면 다 씁니다
    if (x === undefined || x === null) { mine.push(r.y); return; }
    if (x >= r.x0 - 4 && x <= r.x1 + 4) mine.push(r.y);
  });
  if (mine.length < 2) return null;
  mine.sort(function (a, b) { return b - a; });
  for (var i = 0; i < mine.length - 1; i++) {
    if (y <= mine[i] && y > mine[i + 1]) return { top: mine[i], bottom: mine[i + 1] };
  }
  return null;
}

function sgItemsToLines(items, rules) {
  var rows = [];
  (items || []).forEach(function (it) {
    var text = it.str;
    if (!text || !text.trim()) return;
    var y = Math.round(it.transform[5]);
    var size = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10;
    rows.push({ y: y, x: it.transform[4], w: it.width || 0, size: size, text: text });
  });
  if (!rows.length) return [];

  // 세로 위치가 비슷하면 한 줄로 봅니다
  var lines = [];
  rows.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
  rows.forEach(function (r) {
    var line = lines.length ? lines[lines.length - 1] : null;
    if (!line || Math.abs(line.y - r.y) > 3) { line = { y: r.y, parts: [] }; lines.push(line); }
    line.parts.push(r);
  });

  // ── 줄을 표의 «칸» 으로 나눕니다 ──
  //
  // ⚠️ 예전에는 한 줄을 통째로 이어 붙였습니다. 그래서 표의 왼쪽 칸(학년·영역·시간)이
  //    오른쪽 글에 그대로 눌어붙었습니다 — 「눈동아리활동 41 물의 종류와…」
  //    칸이 바뀌는 자리는 글자 두세 개 너비로 벌어집니다. 다만 양쪽 정렬된 글도
  //    틈이 벌어지므로, 왼쪽에 쌓인 글이 짧을 때만 칸이 바뀐 것으로 봅니다.
  var grid = lines.map(function (line) {
    var parts = line.parts.sort(function (a, b) { return a.x - b.x; });
    var cells = [], cur = null;
    parts.forEach(function (p, i) {
      if (i > 0 && cur) {
        var prev = parts[i - 1];
        var gap = p.x - (prev.x + prev.w);
        // ⚠️ 문턱을 2.2로 잡았더니 «시간» 칸(64·41)이 좁아서 글과 안 떨어졌습니다.
        //    그러면 「64 에 관심을 가지게 되었으며…」 한 덩이가 되고,
        //    그게 왼쪽 칸이라 이름표로 오해받아 글까지 맨 위로 끌려 올라갔습니다.
        if (gap > p.size * 1.5 && cur.text.length <= 14) { cells.push(cur); cur = null; }
        else if (gap > p.size * 0.25) cur.text += ' ';   // 글자 크기의 1/4 넘게 벌어지면 띄어쓰기
      }
      if (!cur) cur = { x: p.x, text: '' };
      cur.text += p.text;
    });
    if (cur) cells.push(cur);
    return { y: line.y, cells: cells.filter(function (c) { return !sgIsHeadCell(c.text); }) };
  });

  // ── 글이 실린 세로줄(특기사항 칸)이 어디인지 찾습니다 ──
  var tally = {}, proseX = null, best = 0;
  grid.forEach(function (L) {
    L.cells.forEach(function (c) {
      if (c.text.length < 20) return;
      var k = Math.round(c.x / 4) * 4;
      tally[k] = (tally[k] || 0) + 1;
      if (tally[k] > best) { best = tally[k]; proseX = k; }
    });
  });

  // 표가 아니면(글만 있는 쪽) 예전처럼 순서대로 이어 붙입니다
  if (proseX === null || best < 3) {
    return grid.map(function (L) {
      return L.cells.map(function (c) { return c.text; }).join(' ');
    });
  }

  // ── 세로 가운데 정렬된 이름표를 제 칸 «맨 위» 로 옮깁니다 ──
  //
  // ⚠️ 이것이 창체·행특이 엉망이 되던 진짜 까닭입니다.
  //    나이스 표는 「학년 | 영역 | 시간 | 특기사항」 인데 왼쪽 세 칸이 «세로 가운데» 에
  //    놓입니다. 그래서 「동아리활동 41」 이 글 한가운데 줄과 같은 높이로 옵니다.
  //    그걸 칸의 시작으로 보면
  //      · 앞 칸이 「…구성함. 눈」 에서 끊기고 다음 칸이 「물의 종류와」 로 시작하고
  //      · 학년 「1」 앞에 있던 자율활동이 통째로 «학년 모름» 으로 빠집니다
  //
  //    이름표가 «칸 한가운데» 라는 것을 되짚으면 칸의 시작을 알 수 있습니다.
  //      칸이 [위 … 아래] 이고 이름표가 가운데면   아래 = 2 × 이름표 − 위
  // ⚠️ «표가 시작하는 자리» 를 찾는 것이라, 글 칸에 «딱» 맞는 줄만 셉니다.
  //    쪽 제목(「6. 창의적 체험활동상황」)이나 표 머리글까지 세면 표 위쪽이
  //    실제보다 높게 잡혀서, 되짚은 칸 경계가 통째로 어긋납니다.
  var proseYs = [];
  grid.forEach(function (L) {
    if (L.cells.some(function (c) { return Math.abs(c.x - proseX) <= 6; })) proseYs.push(L.y);
  });
  proseYs.sort(function (a, b) { return b - a; });

  // ⚠️ 칸의 «가장자리» 를 써야 합니다. 첫 줄의 밑선을 쓰면 반 줄이 어긋나서
  //    칸 경계가 한 줄씩 밀립니다 (「고민함.」 이 다음 칸으로 넘어갔습니다).
  var gaps = [];
  for (var gi = 1; gi < proseYs.length; gi++) {
    var d = proseYs[gi - 1] - proseYs[gi];
    if (d > 1) gaps.push(d);
  }
  gaps.sort(function (a, b) { return a - b; });
  var lineH = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;
  var top = proseYs.length ? proseYs[0] + lineH / 2 : null;

  // ⚠️ 아는 이름표만 옮깁니다.
  //    표 머리글(「학년」 「영역」 「시간」)이나 시간 숫자까지 옮기면
  //    줄 순서가 뒤엉킵니다. 저것들은 어차피 뒤에서 걸러집니다.
  var byCol = {}, stay = [];
  grid.forEach(function (L) {
    L.cells.forEach(function (c) {
      if (sgIsProseCell(c, proseX)) return;       // 글 칸은 이름표가 아닙니다
      if (!sgIsCellLabel(c.text)) { stay.push({ y: L.y, text: c.text }); return; }
      var k = Math.round(c.x / 8) * 8;            // 비슷한 가로 위치는 같은 세로줄
      (byCol[k] = byCol[k] || []).push({ y: L.y, x: c.x, text: c.text });
    });
  });

  // ── 이름표를 제 칸 맨 위로 ──
  //
  // ① 표의 가로선이 있으면 그것이 답입니다 (추측 없음)
  // ② 선을 못 읽으면 «이름표는 칸 한가운데» 라는 셈으로 되짚습니다.
  //    한 세로줄이라도 셈이 어긋나면 그 줄은 통째로 제자리에 둡니다 —
  //    반만 옮기면 글이 통째로 앞으로 튀어나옵니다.
  var moved = stay;
  var haveRules = !!(rules && rules.length >= 2);

  Object.keys(byCol).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (k) {
    var col = byCol[k].sort(function (a, b) { return b.y - a.y; });

    if (haveRules) {
      col.forEach(function (m) {
        var band = sgBandOf(rules, m.y, m.x);
        moved.push({ y: band ? band.top + 0.5 : m.y, text: m.text });
      });
      return;
    }

    var edge = top, plan = [], okay = (top !== null);
    col.forEach(function (m) {
      if (!okay) return;
      var bottom = 2 * m.y - edge;
      // 되짚은 칸이 이름표를 품어야 하고, 칸은 아래로만 자라야 합니다
      if (!(bottom < m.y && m.y <= edge)) { okay = false; return; }
      plan.push({ y: edge + 0.5, text: m.text });
      edge = bottom;
    });
    if (okay && plan.length === col.length) moved = moved.concat(plan);
    else col.forEach(function (m) { moved.push({ y: m.y, text: m.text }); });
  });

  // 글 줄과 옮긴 이름표를 세로 순서대로 다시 늘어놓습니다
  var out = [];
  grid.forEach(function (L) {
    var prose = L.cells.filter(function (c) { return sgIsProseCell(c, proseX); })
                       .map(function (c) { return c.text; }).join(' ');
    if (sgNorm(prose)) out.push({ y: L.y, text: prose, prose: true });
  });
  moved.forEach(function (m) { if (sgNorm(m.text)) out.push(m); });
  out.sort(function (a, b) { return b.y - a.y; });

  // ── 칸이 바뀌는 자리에 표시를 남깁니다 ──
  //
  // ⚠️ 세특 표는 과목이 바뀔 때 «줄 간격이 두 배» 가 됩니다 (14 → 28).
  //    선을 안 긋고 여백으로만 나눕니다. 그래서 과목 이름이 없는 칸
  //    (개인별 세부능력 및 특기사항) 은 앞 과목에 통째로 붙어 버렸습니다.
  //    간격이 벌어지는 자리에 표시를 끼워 두면 뒤에서 칸을 나눌 수 있습니다.
  //    ⚠️ 쪽 꼬리글(학교 이름·날짜·성명)은 글 아래쪽에 뚝 떨어져 있습니다.
  //       그것까지 글로 세면 쪽마다 가짜 «칸 바뀜» 이 생기고, 다음 쪽으로 이어지던
  //       과목이 «이름 없는 칸» 으로 잘려 개인별 세특으로 둔갑했습니다.
  var marked = [], prevY = null;
  out.forEach(function (o) {
    var real = o.prose && !sgIsFooterish(o.text);
    if (real && prevY !== null && (prevY - o.y) > lineH * 1.7) marked.push(SG_CELL_BREAK);
    if (real) prevY = o.y;
    marked.push(o.text);
  });
  return marked;
}


// ══════════════ ③ 질문 만들기 ══════════════

// 문장에서 «이야깃거리» 를 찾습니다.
// 「」 '' 안의 제목, ~을 주제로, ~에 대해 탐구/조사/발표 …
var SG_QUOTES = '「」『』"\'\u201c\u201d\u2018\u2019';
var SG_TOPIC_RULES = [
  // ⚠️ 길이를 30자로 막아 뒀더니 실제 생기부의 탐구 제목이 줄줄이 버려졌습니다.
  //    「포물선의 반사 성질은 광촉매 반응기의 효율을 어떻게 높일까?」 가 33자입니다.
  //    길어서 나쁜 게 아니라, 욕심 많은 규칙이 문장을 통째로 삼키는 게 문제였습니다.
  //    그건 아래 sgLooksJunk() 의 «절 잇는 말» 검사가 막아 주므로 넉넉히 받습니다.
  { re: /[「『"'\u2018\u201c]([^」』"'\u2019\u201d]{3,80})[」』"'\u2019\u201d]/g,    kind: '제목' },
  { re: /([^,.\s][^,.]{2,70}?)(?:을|를)\s*주제로/g,              kind: '주제' },
  { re: /([^,.\s][^,.]{2,70}?)에\s*(?:대해|관해|대하여)\s*(?:탐구|조사|발표|실험|연구|분석)/g, kind: '탐구' },
  { re: /([^,.\s][^,.]{2,70}?\s*(?:탐구|실험|프로젝트|캠페인|활동))(?:을|를|에)?\s*(?:진행|수행|기획|참여)/g, kind: '활동' },
  // 「~을 탐구함 / 분석함 / 조사함」 — 사이에 «심화·자발적으로» 같은 말이 끼기도 합니다
  { re: /([^,.\s][^,.]{3,70}?)(?:을|를)\s*(?:[^,.\s]{1,5}\s*){0,2}(?:탐구|탐색|분석|조사|발표|연구|고찰)(?:함|하여|하고|하며|하였|해)/g, kind: '탐구' },

  // ── 스스로 품은 «물음» ──
  // 생기부에서 제일 값진 대목인데, 따옴표 없이 적히는 일이 아주 많습니다.
  //   「…오직 온도만이 평형 상수를 변화시키는 원리」에 의문을 품고
  //   「…경제적 최적 운전 온도를 결정하는 방법」에 대한 깊이 있는 후속 질문을 도출
  { re: /([^,.\s][^,.]{3,70}?)에\s*(?:대한\s*)?(?:의문|궁금증)(?:을|를)\s*(?:품|가지|갖)/g, kind: '의문' },
  { re: /([^,.\s][^,.]{3,70}?)(?:이|가)\s*궁금(?:하여|해서|해져)/g,                        kind: '의문' },
  { re: /([^,.\s][^,.]{3,70}?)에\s*대한\s*(?:[^,.]{0,12}?\s*)?질문(?:을|를)\s*(?:도출|던지|제기|만들)/g, kind: '의문' },
  { re: /([^,.\s][^,.]{3,70}?)(?:라는|이라는)\s*(?:후속\s*)?(?:질문|물음)/g,                kind: '물음' },
  // 「…무엇일까?를 핵심 질문으로 설정해 탐구함」 — 따옴표가 없어도 물음입니다(2026-10-05 진로활동 기록)
  { re: /([^,.\s][^,.]{3,70}?)(?:을|를)\s*(?:핵심|탐구|연구|중심|주요)?\s*(?:질문|물음)으로\s*(?:설정|삼|정하|선정|세우|잡|두)/g, kind: '물음' },

  // ── 끝까지 파고든 흔적 ──
  { re: /([^,.\s][^,.]{3,70}?)(?:을|를)\s*(?:설계|고안|제작|개발|구현)/g,  kind: '활동' },
  { re: /([^,.\s][^,.]{3,70}?)(?:을|를)\s*(?:탐색|고찰|규명|입증)/g,      kind: '탐구' },
  { re: /([^,.\s][^,.]{3,70}?)(?:와|과)\s*연계하여\s*탐구/g,             kind: '탐구' },
  { re: /([^,.\s][^,.]{3,70}?(?:음|함))(?:을|를)\s*(?:파악|확인|이해)/g,   kind: '개념' }
];

// 창체 갈래 이름·과목 꼬리표가 앞에 붙어 오면 떼어 냅니다.
// 「동아리활동 (과학탐구부) 미세먼지와 식물 생장」 처럼 통째로 잡히면
// 질문이 우스워집니다.
// ══ 이야기 나누기 ══
//
// 한 갈래(진로활동 한 해치) 기록에는 보통 활동이 여럿 이어집니다 —
//   「큐리어톤 프로젝트에 참여해 … 탐구함. 이전 동아리의 … 발전시킴. 선행연구로 … 분석함.」
//   「진로독서 프로젝트로 「나노 화학」을 읽고 … 토론하며 … 다짐함.」
// 예전엔 문장을 하나씩 따로 봐서 어느 활동 이야기인지 몰랐습니다(선생님 말씀: «새 내용으로
// 넘어가는 걸 인식하나? 주제별로 나누면 오류가 줄지 않을까» — 2026-10-05).
// 그래서 «새 활동을 여는 문장» 을 찾아 이야기(story)로 묶습니다.
//   · 새 활동을 여는 말이 있으면 새 이야기 — 참여·프로젝트·특강·캠프·대회·수업·독서·강연…
//   · 다만 「이를 …」 「이전 …」 「또한 …」 처럼 앞 문장을 받는 말로 시작하면 이어지는 이야기
// 이야기 이름은 여는 문장에서 그 말 둘레의 낱말 두 개로 짓습니다 — 「프로젝트 큐리어톤」 「진로독서 프로젝트」
var SG_STORY_CUE = /(참여|참가|프로젝트|특강|캠프|대회|수업|독서|읽고|강연|탐방|체험|발표회|축제|행사|동아리|부스|멘토링|봉사|캠페인|공모전|워크숍|박람회|주간|세미나|견학|실습|토론회|경진|페스티벌|톤\b)/;
var SG_STORY_CONT = /^(?:이를|이전|이후|이어|이어서|또한|또|그\s|그러한|그런|그러나|그래서|그 결과|이에|이러한|이런|나아가|특히|한편|아울러|더불어|이때|여기서|결과적으로|끝으로|마지막으로|먼저|후속|추가로|같은|해당|위|이\s|본인|자신|스스로|더\s|덧붙여|뿐만|한발|한 걸음)/;

var SG_STORY_PREV_WEAK = /^(?:기반|관련|다양한|여러|각종|교내|교외|학교|학급|지역|주제|탐구|진로|자율|동아리|봉사|연계|융합|심화|기초|공동|단체|개인)/;
function sgStoryWord(w) {
  // 낱말 하나를 이름에 쓸 수 있는 꼴로 — 괄호·따옴표·토씨를 뗍니다
  var t = sgUnshieldDots(String(w || ''))
    .replace(/\([^)]*\)?/g, '')
    .replace(/[「『"'\u2018\u201c\u2019\u201d」』.,]/g, '');
  // ⚠️ 토씨는 떼고도 두 글자 넘게 남을 때만 뗍니다 — 「진로」의 «로» 를 떼면 「진」이 됩니다
  var cut = t.replace(/(?:에서|에게|으로|로|에|을|를|은|는|이|가|의|와|과|도)$/, '');
  return cut.length >= 2 ? cut : t;
}
function sgStoryLabel(sentence, n) {
  var words = sgShieldDots(sentence).split(/\s+/);
  var at = -1;
  for (var i = 0; i < words.length; i++) {
    if (SG_STORY_CUE.test(words[i])) { at = i; break; }
  }
  var pick = [];
  if (at >= 0) {
    var cue = sgStoryWord(words[at]);
    var prev = at > 0 ? sgStoryWord(words[at - 1]) : '';
    var next = at + 1 < words.length ? words[at + 1] : '';
    // 다음 낱말이 «이름» 처럼 생겼으면(따옴표 없고 서술어 아님) 그쪽을 씁니다 — 「프로젝트 큐리어톤」
    var nextOK = next && !/[「『"'\u2018\u201c]/.test(next) &&
                 !/(?:함|됨|임|음|해|하여|고|며|서|자|여|면|든|던)$/.test(sgUnshieldDots(next).replace(/[.,)]+$/, '')) &&
                 (sgStoryWord(next).match(/[가-힣A-Za-z]/g) || []).length >= 2;
    var prevOK = !!prev && (prev.match(/[가-힣A-Za-z]/g) || []).length >= 2;
    if (nextOK && (!prevOK || SG_STORY_PREV_WEAK.test(prev))) pick = [cue, sgStoryWord(next)];
    else if (prevOK) pick = [prev, cue];
    else pick = [cue];
  }
  var label = pick.join(' ')
    .replace(/\([^)]*\)?/g, '')                                 // 괄호(날짜 등)
    .replace(/[「『"'\u2018\u201c\u2019\u201d」』]/g, '')
    .replace(/(?:에서|에게|으로|로|에|을|를|은|는|이|가|의|와|과|하여|해|하고|한|들|도)$/, '')
    .replace(/(?:에서|에게|으로|로|에|을|를|은|는|이|가|의|와|과)$/, '');
  label = sgUnshieldDots(sgNorm(label));
  if (label.length < 2 || label.length > 18) label = '';
  return label || ('이야기 ' + n);
}

// 반환: [{ n, label, head, from, to }] — from/to 는 문장 번호(끝은 포함하지 않음)
function sgStories(sentences) {
  var out = [];
  (sentences || []).forEach(function (sen, i) {
    var opens = i === 0 || (SG_STORY_CUE.test(sgShieldDots(sen)) && !SG_STORY_CONT.test(sen));
    if (opens) out.push({ n: out.length + 1, label: '', head: sen, from: i, to: i + 1 });
    else out[out.length - 1].to = i + 1;
  });
  out.forEach(function (st) { st.label = sgStoryLabel(st.head, st.n); });
  return out;
}

function sgCleanTopic(raw) {
  var t = sgNorm(raw);

  // 따옴표가 섞여 있으면 그 «안쪽» 만 씁니다. 바깥은 군더더기입니다.
  var inner = t.match(/[「『"'\u2018\u201c]([^」』"'\u2019\u201d]{3,80})[」』"'\u2019\u201d]/);
  if (inner) t = sgNorm(inner[1]);

  // 남은 따옴표·괄호 묶음을 떼어 냅니다
  t = t.replace(new RegExp('^[' + SG_QUOTES + '\\s]+'), '')
       .replace(new RegExp('[' + SG_QUOTES + '\\s]+$'), '')
       .replace(/^\([^)]*\)\s*/, '')            // (과학탐구부)
       .replace(/^\[[^\]]*\]\s*/, '');         // [생명과학Ⅰ]

  // 앞 절을 떼어 냅니다 (「…을 바탕으로 …」 → 뒤쪽만)
  t = sgTrimClause(t);

  // 문장을 여는 부사는 제목의 일부가 아닙니다 — 「나아가 수처리 공정 기술」
  t = t.replace(/^(?:나아가|또한|특히|한편|아울러|그리고|이후|이를|먼저|끝으로|더불어|이에|또|우선|이어서|선행\s*연구로|후속\s*연구로)\s+/, '');
  // 「…탐색하고자 Kerry…」 처럼 앞말의 꼬리 한 글자가 떨어져 나와 붙기도 합니다
  t = t.replace(/^(?:자|서|고|며|여|면|워|해|돼)\s+/, '');

  // 앞에 붙은 갈래 이름 떼기
  SG_AREAS.forEach(function (a) {
    t = t.replace(new RegExp('^' + a + '\\s*(\\([^)]*\\))?\\s*'), '');
  });
  t = sgNorm(t).replace(/^\([^)]*\)\s*/, '');

  return sgNorm(t);
}

// 따옴표가 줄을 넘어가며 잘리면 「라는 인물을 새로 설정하고」 처럼
// 토씨로 시작하는 토막이 잡힙니다. 질문으로 쓸 수 없습니다.
var SG_JUNK_HEAD = /^(?:라는|이라는|라고|이라고|하는|되는|하여|으로|로서|에서|에게|및|와|과|의|을|를|은|는|이|가|도|만)\s/;

// 규칙이 넓게 걸리다 보면 앞 절까지 끌고 옵니다.
//   「식수 환경에 대한 관심을 바탕으로 한국수자원공사의 공공데이터를 활용하여
//    수도권 정수장의 월별 수질을 분석하고 시각화하는 프로젝트」
// 여기서 쓸 것은 마지막 절뿐입니다. 통째로 버리면 그 과목이 아예 빠지므로,
// «절을 잇는 말» 뒤만 잘라 씁니다.
var SG_JOINERS = /(?:바탕으로|토대로|중심으로|비롯하여|통하여|통해|위하여|위해|활용하여|이용하여|연계하여|접목하여|주목하여|배운\s*후|하고자|하고서|위한|참여하여|참여해|참가하여|참가해|읽고|듣고|거쳐|마치고|맡아|시작해|이어)\s+/g;

function sgTrimClause(t) {
  var last = -1, m;
  var re = new RegExp(SG_JOINERS.source, 'g');
  while ((m = re.exec(t)) !== null) last = m.index + m[0].length;
  return last > -1 ? sgNorm(t.slice(last)) : sgNorm(t);
}

// 잘라 내고도 서술로 끝나면 제목이 아닙니다.
var SG_CLAUSE = /(?:하면서|하며$|하고$|하여$|면서$|보며$|으며$|는데$|지만$|고자$)/;

// 「호기심에서 출발한 질문」 「탐구 결과」 처럼 무엇을 가리키는지 없는 뭉뚱그린 말은 제목이 아닙니다.
var SG_GENERIC_TAIL = /(?:^|\s)(?:질문|물음|결과|내용|과정|태도|자세|능력|모습|경험|방법|방안|의미|가치|점)$/;
function sgLooksJunk(t) {
  if (SG_JUNK_HEAD.test(t)) return true;
  if (SG_CLAUSE.test(t)) return true;
  if (/^[)\]」』'"]/.test(t)) return true;                         // 괄호 뒤부터 잘린 토막
  if ((t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length) return true;   // 괄호가 안 맞음
  if (SG_GENERIC_TAIL.test(t) && !/[「『]/.test(t)) return true;
  // 한글이 거의 없으면 표에서 흘러든 조각입니다
  var hangul = (t.match(/[가-힣]/g) || []).length;
  return hangul < 2;
}

function sgTopics(sentence) {
  var found = [];
  var text = sgShieldDots(sentence);   // 규칙은 «점이 없는 구간» 을 찾습니다. 날짜의 점은 숨깁니다
  SG_TOPIC_RULES.forEach(function (rule) {
    var re = new RegExp(rule.re.source, 'g');
    var m;
    while ((m = re.exec(text)) !== null) {
      var t = sgCleanTopic(sgUnshieldDots(m[1]));
      if (t.length < 3 || t.length > 80) continue;
      // 아직도 따옴표가 남아 있으면 제대로 못 잘린 것입니다. 버립니다.
      if (new RegExp('[' + SG_QUOTES + ']').test(t)) continue;
      if (sgLooksJunk(t)) continue;

      // 같은 말이 규칙 여럿에 걸리면 «더 구체적인» 쪽을 씁니다.
      // 「…에 대해 탐구를 진행함」은 따옴표 규칙에도, 탐구 규칙에도 걸리는데
      // 탐구인 줄 알아야 «무엇이 궁금해서 시작했나» 를 물을 수 있습니다.
      var already = found.filter(function (f) { return f.text === t; })[0];
      if (already) {
        if (already.kind === '제목' && (rule.kind === '탐구' || rule.kind === '활동')) {
          already.kind = rule.kind;
        }
        continue;
      }
      found.push({ text: t, kind: rule.kind });
    }
  });
  return found;
}

// 「1984(조지 오웰)」 처럼 괄호 안이 사람 이름이면 읽은 책입니다.
// 책은 「제목 (지은이)」 꼴로 적힙니다. 책에는 책에 맞는 틀을 씁니다.
function sgBookOf(topic) {
  var m = String(topic).match(/^(.{2,40}?)\s*\(([가-힣]{2,4}(?:\s[가-힣]{1,10})?)\)$/);
  return m ? { title: sgNorm(m[1]), author: sgNorm(m[2]) } : null;
}

// ══ 토씨 ══ — 「T」 뒤에 «을/를» «이/가» 를 받침에 맞춰 붙입니다.
// 받침이 있으면 을·이, 없으면 를·가. 한글이 아니면(영어·숫자) 둘 다 적습니다.
function sgJosa(word, withBatchim, without) {
  var t = String(word || '').replace(/[」』"'’”\s)]+$/, '');
  var ch = t.charCodeAt(t.length - 1);
  if (ch >= 0xAC00 && ch <= 0xD7A3) return ((ch - 0xAC00) % 28) ? withBatchim : without;
  if (ch >= 0x30 && ch <= 0x39) return (/[013678]$/.test(t)) ? withBatchim : without;   // 1·3·6·7·8·0 은 받침
  return withBatchim + '(' + without + ')';
}
function 을(t) { return sgJosa(t, '을', '를'); }
function 이(t) { return sgJosa(t, '이', '가'); }
function 은(t) { return sgJosa(t, '은', '는'); }

// ══ 질문 틀 ══
//
// 2026-10-05 에 틀 8개에서 이렇게 늘렸습니다. 선생님 말씀: 규칙으로 뽑은 질문이
// AI 에 넣은 것보다 훨씬 못하다 — 돈 안 드는 길로, 지금보다 나으면 된다.
// 틀은 앱에 들어 있는 대학별 기출 질문 2,360줄(questions 표)을 읽고 그 말투를 따랐습니다.
//   · 「…했다고 기록되어 있습니다. ~을 설명하고, ~도 말해 주세요.」 — 본 질문 + 꼬리 질문을 한 줄에
//   · 묻는 것: 내용 · 고른 이유(계기) · 과정과 어려움 · 결론과 근거 · 다시 한다면 · 지원 분야와의 연결
// 이야깃거리의 «생김새»(실험·발표·역할·진로·책·물음…)에 따라 틀 묶음을 고르고,
// 한 묶음 안에서는 틀을 돌려 가며 써서 같은 말이 줄줄이 나오지 않게 합니다.
//
// ⚠️ 틀은 기록을 «이해» 하지 못합니다. 「평형상수의 원리를 설명해 보세요」 까지는 되지만
//    「압력은 왜 평형상수를 못 바꾸나」 같은 내용 질문은 못 합니다. 그건 언어 모델 몫입니다
//    (노트북 AI 는 내장 그래픽에서 안 돌아 접었습니다 — docs/할-일.md).
//
// 틀 안의 {S} 는 자리말(「화학Ⅰ 시간에」 「동아리활동에서」), {T} 는 이야깃거리입니다.
// 토씨는 틀 안에 «{T}을» «{T}이» «{T}은» 으로 적으면 받침에 맞춰 바뀝니다.
var SG_FRAMES = {
  // 세특 — 탐구·조사·분석
  '탐구': { comp: '학업역량', frames: [
    '{S}「{T}」{T}을 탐구했다고 기록되어 있습니다. 탐구한 주요 내용을 설명하고, 그 주제를 고르게 된 계기를 말해 주세요.',
    '{S}「{T}」{T}을 탐구했는데, 어떤 자료나 방법으로 알아봤고 그 과정에서 가장 어려웠던 점은 무엇이었나요?',
    '{S}「{T}」에 대해 탐구했다고 되어 있습니다. 탐구 끝에 무엇을 알게 되었고, 그것이 지원하려는 분야와 어떻게 이어지나요?',
    '{S}「{T}」 탐구에서 본인이 내린 결론은 무엇이며, 그 결론을 뒷받침하는 근거는 무엇인가요?',
    '{S}「{T}」{T}을 탐구했다고 기록되어 있습니다. 지금 다시 한다면 어떤 점을 보완하고 싶은지, 그 이유와 함께 말해 주세요.'
  ] },
  // 세특·창체 — 실험·측정·관찰
  '실험': { comp: '학업역량', frames: [
    '{S}「{T}」 실험을 했다고 기록되어 있습니다. 실험의 원리와 과정을 설명하고, 결과를 어떻게 해석했는지 말해 주세요.',
    '{S}「{T}」 실험에서 변인은 어떻게 통제했고, 오차가 있었다면 그 원인은 무엇이라고 보나요?',
    '{S}「{T}」 실험 결과가 예상과 달랐던 부분이 있었나요? 있었다면 그것을 어떻게 설명했는지 말해 주세요.',
    '{S}「{T}」 실험을 했다고 되어 있는데, 거기서 쓴 원리를 다른 사례에 적용해 설명해 보세요.'
  ] },
  // 발표·보고서·카드뉴스·토론
  '발표': { comp: '학업역량', frames: [
    '{S}「{T}」{T}을 주제로 발표했다고 기록되어 있습니다. 발표의 핵심 주장과 그 근거를 설명해 주세요.',
    '{S}「{T}」{T}을 발표했는데, 준비하며 가장 공들인 부분과 듣는 사람에게 꼭 전하고 싶었던 한 가지는 무엇이었나요?',
    '{S}「{T}」 발표에서 받은 질문이나 반론이 있었나요? 어떻게 답했는지 말해 주세요.',
    '{S}「{T}」{T}을 주제로 발표했다고 되어 있습니다. 그 주제를 고른 이유와, 조사하며 새로 알게 된 사실을 하나만 말해 주세요.'
  ] },
  // 토론·토의 — 발표와 달리 «찬반·반론» 을 묻습니다.
  // ⚠️ 2026-10-05 진로활동 기록의 「…을 토론하며 …」 가 발표 틀에 걸려 «주제로 발표했다고» 라고 나왔습니다.
  '토론': { comp: '학업역량', frames: [
    '{S}「{T}」{T}을 토론했다고 기록되어 있습니다. 본인은 어느 쪽 입장이었고, 그 근거는 무엇이었나요?',
    '{S}「{T}」 토론에서 상대편의 가장 강한 반론은 무엇이었고, 거기에 어떻게 답했나요?',
    '{S}「{T}」{T}을 토론한 뒤 생각이 달라진 점이 있나요? 있었다면 무엇이 그렇게 만들었는지 말해 주세요.'
  ] },
  // 세특 — 배운 개념
  '개념': { comp: '학업역량', frames: [
    '{S}「{T}」{T}을 배웠다고 기록되어 있습니다. 이 개념을 처음 듣는 사람에게 설명하듯 말해 주세요.',
    '{S}「{T}」{T}이 기록에 나옵니다. 이 개념이 실생활이나 지원 분야에 어떻게 쓰이는지 예를 들어 설명해 주세요.',
    '{S}「{T}」{T}을 공부하며 가장 헷갈렸던 부분은 무엇이었고, 어떻게 이해하게 되었나요?'
  ] },
  // 스스로 던진 물음 (「…할까?」)
  '물음': { comp: '학업역량', frames: [
    '{S}「{T}」 — 이 물음을 스스로 던졌다고 기록되어 있습니다. 어떤 답을 찾았고, 무엇이 아직 풀리지 않았나요?',
    '{S}「{T}」라는 물음은 어디에서 비롯됐나요? 답을 찾으려고 무엇을 했는지 순서대로 말해 주세요.',
    '{S}「{T}」 — 이 물음에 지금 다시 답한다면 그때와 달라진 점이 있나요?'
  ] },
  // 의문을 품음
  '의문': { comp: '학업역량', frames: [
    '{S}「{T}」에 의문을 품었다고 적혀 있습니다. 무엇이 궁금했고, 어떻게 확인했나요?',
    '{S}「{T}」에 의문을 가졌다고 기록되어 있습니다. 그 의문이 풀렸는지, 풀렸다면 핵심은 무엇이었는지 말해 주세요.',
    '{S}「{T}」에 의문을 품게 된 계기는 무엇이고, 그 뒤 어떤 자료를 찾아봤나요?'
  ] },
  // 책
  '책': { comp: '학업역량', frames: [
    '{S}「{T}」{T}을 읽었다고 기록되어 있습니다. 책의 핵심 내용과 본인이 내린 결론을 설명해 주세요.',
    '{S}「{T}」{T}을 읽었군요. 어떤 대목이 가장 기억에 남고, 그것이 본인의 생각을 어떻게 바꿨나요?',
    '{S}「{T}」{T}을 읽었다고 되어 있는데, 이 책을 고른 기준은 무엇이었고 읽은 뒤 더 알아본 것이 있나요?',
    '{S}읽은 「{T}」에서 지은이의 주장에 동의하지 않는 부분이 있었나요? 있었다면 어떤 근거로 그렇게 생각했는지 말해 주세요.'
  ] },
  // 창체 — 활동 일반
  '활동': { comp: '공동체역량', frames: [
    '{S}「{T}」 활동이 기록되어 있습니다. 이 활동을 시작하게 된 계기와 본인이 실제로 한 일을 설명해 주세요.',
    '{S}「{T}」 활동에서 본인이 맡은 역할은 무엇이었고, 준비하면서 어떤 점을 가장 고려했나요?',
    '{S}「{T}」 활동을 하며 가장 어려웠던 판단은 무엇이었고, 어떻게 결정했나요?',
    '{S}「{T}」 활동을 지금 다시 한다면 어떤 점을 보완하고 싶은지, 그 이유와 함께 말해 주세요.',
    '{S}「{T}」 활동으로 새로 배운 점은 무엇이고, 그 뒤 어떤 활동으로 이어졌나요?'
  ] },
  // 창체 — 여럿이 함께·이끎
  '역할': { comp: '공동체역량', frames: [
    '{S}「{T}」{T}을 사람들과 함께했다고 기록되어 있습니다. 본인의 역할은 무엇이었고, 협력을 위해 구체적으로 어떤 행동을 했나요?',
    '{S}「{T}」 과정에서 의견이 갈렸던 적이 있나요? 어떻게 조율했는지 말해 주세요.',
    '{S}「{T}」{T}을 이끌었다고 되어 있는데, 함께한 사람들은 본인을 어떻게 평가했을 것 같나요? 그렇게 생각하는 이유는요?'
  ] },
  // 창체 — 진로와 이어지는 활동
  '진로': { comp: '진로역량', frames: [
    '{S}「{T}」{T}이 진로와 관련된 활동으로 기록되어 있습니다. 이 활동이 진로를 정하는 데 어떤 영향을 주었나요?',
    '{S}「{T}」{T}을 통해 알게 된 것 가운데 지원하려는 학과와 이어지는 것은 무엇인가요?',
    '{S}「{T}」 뒤에 진로 생각이 달라진 점이 있나요? 있었다면 무엇이 그렇게 만들었나요?'
  ] },
  // 행특 — 선생님의 칭찬하는 말
  '칭찬': { comp: '공동체역량', frames: [
    '{S}선생님이 「{T}」이라고 적어 주셨습니다. 그렇게 보였을 장면을 하나 들어 주세요.',
    '{S}「{T}」이라는 평가를 받게 된 이유가 무엇이라고 생각하나요? 구체적인 사례로 말해 주세요.',
    '{S}「{T}」이라고 기록되어 있는데, 스스로는 그 평가에 얼마나 동의하나요? 반대로 그렇지 못했던 순간이 있었다면 말해 주세요.'
  ] },
  // 행특 — 따옴표로 묶인 활동 이름
  '활동명': { comp: '공동체역량', frames: [
    '{S}「{T}」 이야기가 적혀 있습니다. 어떻게 시작했고 본인이 맡은 몫은 무엇이었나요?',
    '{S}「{T}」{T}을 하면서 주변 친구들에게 어떤 영향을 주었다고 생각하나요?'
  ] }
};

// 문장을 보고 이야깃거리의 생김새를 정합니다. 위 SG_FRAMES 의 열쇠 가운데 하나를 돌려줍니다.
var SG_CUE_EXPERIMENT = /실험|측정|관찰|대조군|변인|검증/;
var SG_CUE_PRESENT = /발표|카드뉴스|보고서|작성|제작|기고|제안/;
var SG_CUE_DEBATE = /토론|토의|논쟁|찬반|디베이트/;
var SG_CUE_ROLE = /회장|부회장|부장|조장|반장|멘토|리더|주도|기획|이끌|역할|협력|모둠|팀원|팀을|함께|소통|조율/;
var SG_CUE_CAREER = /진로|직업|학과|전공|장래|꿈/;
var SG_CUE_INQUIRY = /탐구|조사|분석|연구|고찰|탐색/;
var SG_CUE_CONCEPT = /배움|배우|학습|이해|단원|개념|원리|정리|파악|익힘/;
function sgShapeOf(sectionKey, sentence, topic, book, groupLabel) {
  // ⚠️ 낱말은 이야깃거리를 뺀 나머지 문장에서 찾습니다. 「대조군 설정의 중요성」을 주제로
  //    발표한 것이, 제목 안의 «대조군» 때문에 실험으로 잡혔습니다.
  sentence = String(sentence || '').split(topic.text).join(' ');
  if (book) return '책';
  if (topic.kind === '물음' || /[?？]\s*$/.test(topic.text)) return '물음';
  if (topic.kind === '의문') return '의문';
  if (sectionKey === 'haengteuk') return (topic.kind === '제목') ? '활동명' : '칭찬';
  if (sectionKey === 'changche') {
    if (SG_CUE_ROLE.test(sentence)) return '역할';
    if (SG_CUE_EXPERIMENT.test(sentence)) return '실험';
    if (SG_CUE_DEBATE.test(sentence)) return '토론';
    if (SG_CUE_PRESENT.test(sentence)) return '발표';
    if (SG_CUE_INQUIRY.test(sentence)) return '탐구';     // 진로활동·동아리에서 한 탐구도 탐구로 묻습니다
    // 탐구·발표가 아닌 진로활동 기록(특강을 듣고 관심을 가짐 등)만 진로와 이어 묻습니다
    if (sgNorm(groupLabel || '').indexOf('진로') === 0 || SG_CUE_CAREER.test(sentence)) return '진로';
    return '활동';
  }
  // 세특
  if (SG_CUE_EXPERIMENT.test(sentence)) return '실험';
  if (SG_CUE_DEBATE.test(sentence) && topic.kind !== '개념') return '토론';
  if (SG_CUE_PRESENT.test(sentence) && topic.kind !== '개념') return '발표';
  if (topic.kind === '개념') return '개념';
  if (SG_CUE_INQUIRY.test(sentence)) return '탐구';
  // 「…단원을 배움」 「…의 원리를 이해함」 — 탐구가 아니라 배운 개념입니다
  if (SG_CUE_CONCEPT.test(sentence)) return '개념';
  return '탐구';
}

// 자리말 — 「화학Ⅰ 시간에」 「동아리활동에서」. 과목을 모르면 비웁니다.
// 자리말 — 모든 질문이 «어디 내용인지» 로 시작합니다(선생님 말씀, 2026-10-06):
//   「3학년 동아리활동에서 「이차전지의 환경오염」에 의문을 품었다고 적혀 있습니다.」
//   「2학년 화학Ⅰ 시간에 …」 「1학년 행동특성 및 종합의견에서 선생님이 …」
// 창체에서 한 묶음에 활동(이야기)이 여럿이면 활동 이름도 같이 —
//   「3학년 진로활동 프로젝트 큐리어톤에서 「유가식 발효와 산성도 조절 방식」을 탐구했는데」.
// 이름을 못 지은 이야기(「이야기 2」)는 뺍니다. 학년을 모르면 학년은 뺍니다.
function sgPlaceOf(sectionKey, subject, storyLabel, grade) {
  var g = grade ? grade + '학년 ' : '';
  if (sectionKey === 'haengteuk') return g + '행동특성 및 종합의견에서 ';
  if (sectionKey === 'sesa') return subject ? g + subject + ' 시간에 ' : (g ? g + '수업에서 ' : '');
  if (sectionKey === 'changche') {
    var name = (storyLabel && !/^이야기 \d+$/.test(storyLabel)) ? ' ' + storyLabel : '';
    return subject ? g + subject + name + '에서 ' : (g ? g + '창의적 체험활동에서 ' : '');
  }
  return g;
}

// 틀에 이야깃거리와 자리말을 끼웁니다. 「{T}」 뒤에 붙은 {T}을 같은 토씨 표시는 받침에 맞춰 바뀝니다.
function sgFill(frame, topic, place) {
  return frame
    .replace(/\{S\}/g, place || '')
    .replace(/「\{T\}」\{T\}을/g, '「' + topic + '」' + 을(topic))
    .replace(/「\{T\}」\{T\}이/g, '「' + topic + '」' + 이(topic))
    .replace(/「\{T\}」\{T\}은/g, '「' + topic + '」' + 은(topic))
    .replace(/\{T\}/g, topic);
}

// 행동특성은 «칭찬하는 말» 자체가 이야깃거리입니다.
// 따옴표가 없을 때가 많아서 서술어를 보고 찾습니다.
//
// ⚠️ 앞말을 끌고 오지 않도록 «띄어쓰기 없는 한 마디» 또는 «두 마디» 까지만 봅니다.
//    안 그러면 «맡은 일을 끝까지 해내는 책임감» 이 통째로 잡힙니다.
var SG_TRAIT_RE =
  /([가-힣]{1,6}(?:\s[가-힣]{1,6})?(?:력|성|심|감|태도|자세|리더십|능력|역량|의지|열정|노력|경청|배려|소통|책임))(?:이|가|은|는|을|를)?\s*(?:뛰어남|뛰어나|돋보임|돋보이|우수함|우수하|강함|강하|탁월|있음|보임|보여|발휘)/g;

// 「해내는 책임감」 처럼 앞에 꾸밈말이 붙어 나오면 떼어 냅니다.
// 꾸밈말은 «-는 / -은 / -한 / -된» 처럼 끝납니다.
// 「의사소통 능력」 같은 한 덩어리 말은 그대로 둡니다.
var SG_MODIFIER_END = /(?:는|은|ㄴ|한|된|인|워|며|고|게|이|히)$/;

function sgTrimTrait(t) {
  var v = sgNorm(t);
  // 줄이 낱말 가운데서 끊겨 붙어 버린 꾸밈말 — 「정리하는의사소통 능력」
  v = v.replace(/^[가-힣]{1,4}(?:하는|되는|지는|기는|리는|는|은|한|된|인)(?=[가-힣]{2,})/, '');
  var parts = v.split(' ');
  if (parts.length === 2 && SG_MODIFIER_END.test(parts[0])) return parts[1];
  return sgNorm(v);
}

function sgTraits(sentence) {
  var out = [], m;
  var re = new RegExp(SG_TRAIT_RE.source, 'g');
  while ((m = re.exec(sentence)) !== null) {
    var t = sgTrimTrait(m[1]);
    if (t.length >= 2 && !out.some(function (x) { return x.text === t; })) {
      out.push({ text: t, kind: '평가' });
    }
  }
  return out;
}

// 세특 문장은 「정보: 계획적이고…」 처럼 과목 이름으로 시작합니다.
// 과목을 붙여 두면 선생님이 «정보 세특» 만 골라 볼 수 있습니다.
function sgSubjectOf(sentence) {
  var m = sgNorm(sentence).match(/^([가-힣A-Za-zⅠⅡ·\s]{2,14}?)\s*[:：]\s*\S/);
  if (!m) return '';
  var subj = sgNorm(m[1]);
  return (subj.length <= 12) ? subj : '';
}

// 과목 이름을 못 읽은 세특 기록도 묶음 하나로 봅니다.
// ⚠️ 이 값은 화면에서 거르기에도 쓰입니다. 빈 글자로 두면 거르기가 안 먹습니다.
var SG_NO_SUBJECT = '(과목 모름)';

// 묶음마다 맨 위에 놓는 «직접 적기» 칸의 미리 채워 둘 질문.
// 기계가 무엇을 뽑았든, 선생님은 기록을 직접 보고 물으실 수 있어야 합니다.
function sgBlankText(sectionKey, label, grade) {
  var g = grade ? grade + '학년 ' : '';
  if (sectionKey === 'haengteuk')
    return g + '행동특성 및 종합의견에 선생님이 적어 주신 것 가운데, 본인을 가장 잘 나타낸다고 생각하는 대목은 어디인가요?';
  if (label === SG_NO_SUBJECT)
    return (g ? g + '기록에서' : '이 기록에서') + ' 가장 깊이 물어보고 싶은 것은 무엇인가요?';
  if (sectionKey === 'changche')
    return g + label + '에서 본인이 가장 공들인 활동은 무엇이었나요?';
  return g + label + ' 시간에 가장 기억에 남는 탐구나 활동은 무엇이었나요?';
}

// 묶음 하나(한 영역·한 학년·한 과목/갈래)에서 질문을 만듭니다.
//
// ⚠️ 여기서는 더 이상 과목을 찾지 않습니다. 자르는 일은 sgChunks() 가 미리 합니다.
//    한 곳에서만 자르는 편이 낫습니다. 예전에는 문장마다 과목을 다시 찾느라
//    과목 이름이 «문장 맨 앞» 에 없으면 그 과목이 통째로 새 버렸습니다.
//
// 반환: [{ text, competency, topic, subject, source, grade, area }]
function sgMakeQuestions(sectionKey, grade, sentences, groupLabel, stories) {
  var made = [];
  var seen = {};
  var turn = {};          // 생김새마다 몇 번째 틀을 쓸 차례인지
  var label = groupLabel || SG_NO_SUBJECT;
  var subject = (label === SG_NO_SUBJECT) ? '' : label;
  stories = stories || sgStories(sentences);
  var storyOf = {};       // 문장 번호 → 이야기 번호
  var labelOf = {};       // 이야기 번호 → 이야기 이름 (활동이 여럿일 때만 자리말에 씁니다)
  stories.forEach(function (st) {
    for (var k = st.from; k < st.to; k++) storyOf[k] = st.n;
    if (stories.length > 1) labelOf[st.n] = st.label;
  });

  (sentences || []).forEach(function (sentence, si) {
    var topics;
    if (sectionKey === 'haengteuk') {
      // 칭찬하는 말 + 따옴표로 묶인 활동 이름만. «독서 토론 등의 다양한» 같은
      // 토막이 활동 규칙에 걸려 들어오는 것을 막습니다.
      topics = sgTraits(sentence).concat(
        sgTopics(sentence).filter(function (t) { return t.kind === '제목'; }));
    } else {
      topics = sgTopics(sentence);
    }

    topics.forEach(function (topic) {
      var book = (sectionKey === 'haengteuk') ? null : sgBookOf(topic.text);

      // ⚠️ 이야깃거리 하나에 질문 하나만 냅니다.
      //    두 틀을 나란히 내면 같은 말이 두 줄로 늘어서 고르기만 번거롭습니다.
      //    담은 뒤에 글자를 고칠 수 있으니 하나면 됩니다.
      var shape = sgShapeOf(sectionKey, sentence, topic, book, label);
      var bank = SG_FRAMES[shape];
      if (!bank) return;
      // 한 묶음 안에서는 같은 생김새의 틀을 돌려 가며 씁니다 (1번, 2번, 3번 … 다시 1번)
      turn[shape] = (turn[shape] || 0);
      var frame = bank.frames[turn[shape] % bank.frames.length];
      turn[shape]++;
      var tpl = { comp: bank.comp };

      var text = sgFill(frame, book ? book.title : topic.text, sgPlaceOf(sectionKey, subject, labelOf[storyOf[si] || 1], grade));
      if (seen[text]) return;
      seen[text] = true;
      made.push({
        text: text,
        competency: tpl.comp,
        topic: book ? book.title : topic.text,
        kind: book ? '제목' : topic.kind,
        shape: shape,
        story: storyOf[si] || 1,  // 몇 번째 이야기(활동)에서 나온 질문인지
        subject: subject,
        source: sentence,        // 원문을 같이 보여줍니다. 이상하면 바로 알아채도록
        grade: grade,
        area: sectionKey
      });
    });
  });

  return made;
}

// 묶음마다 맨 위에 놓는 «기록 보고 직접 적기» 칸.
//
// ⚠️ 기계가 뽑는 것은 어차피 완벽하지 않습니다. 그래서 묶음마다 하나씩 둡니다.
//    source 에는 질문용으로 다듬은 글이 아니라 «기록 전문» 이 들어갑니다.
function sgBlankItem(sectionKey, grade, label, record, gotAny) {
  return {
    text: sgBlankText(sectionKey, label, grade),
    // 역량은 COMPETENCIES 안의 값이어야 합니다. 없는 값을 넣으면
    // «낼 질문» 의 고르는 칸이 엉뚱한 것으로 잡힙니다.
    competency: (sectionKey === 'sesa') ? '학업역량' : '공동체역량',
    topic: label,
    subject: (label === SG_NO_SUBJECT) ? '' : label,
    blank: true,               // 직접 적는 칸으로 보여줍니다
    lonely: !gotAny,           // 이 묶음에서 하나도 못 뽑았는가
    source: record,            // 기록을 통째로 — 한 글자도 버리지 않습니다
    grade: grade, area: sectionKey
  };
}

// 한쪽이 다른 쪽에 통째로 들어 있으면 같은 이야기입니다. 하나만 남깁니다.
//
// ⚠️ 무턱대고 «긴 쪽» 을 남기면 안 됩니다.
//    「…평형 상수를 변화시키는 원리」(의문)  ← 이게 좋은 것인데
//    「…원리에 의문을 품고 수처리 공정의 친환경 흡착제 최적 조건」(탐구)
//    이 더 길다고 남으면 질문이 뭉개집니다.
//    그래서 «더 또렷한 규칙으로 잡힌 쪽» 을 먼저 봅니다.
//    따옴표·물음·의문은 또렷하고, 「…와 연계하여 탐구」 같은 건 넓게 걸립니다.
var SG_KIND_RANK = { '제목': 3, '물음': 3, '의문': 3, '주제': 2, '개념': 1, '탐구': 1, '활동': 1 };

// ══ 이야기별로 줄 세우기 ══
//
// 한 묶음(진로활동 한 해치)에 활동이 여럿이면, 한 활동의 잔가지(「유가식 발효와 산성도 조절 방식」
// 「기질 공급량」…)가 다른 활동의 핵심(「나노 화학」 책)보다 앞에 늘어서 처음 5개에 그 활동이 아예 안 보였습니다.
// 그래서 이야기마다 또렷한 것(따옴표·물음·의문 > 주제 > 나머지)부터 하나씩 돌아가며 뽑아 줄을 세웁니다.
// 1번 이야기의 첫째 → 2번 이야기의 첫째 → 1번의 둘째 → … 화면은 이 순서대로 보여 주고, 처음엔 5개만.
function sgOrderByStory(questions) {
  var byStory = {}, keys = [];
  questions.forEach(function (q, i) {
    var n = q.story || 1;
    if (!byStory[n]) { byStory[n] = []; keys.push(n); }
    byStory[n].push({ q: q, i: i });
  });
  keys.forEach(function (n) {
    byStory[n].sort(function (a, b) {
      return (SG_KIND_RANK[b.q.kind] || 1) - (SG_KIND_RANK[a.q.kind] || 1) || (a.i - b.i);
    });
  });
  var out = [], left = true;
  while (left) {
    left = false;
    keys.forEach(function (n) {
      var x = byStory[n].shift();
      if (x) { out.push(x.q); left = true; }
    });
  }
  out.forEach(function (q, i) { q.order = i; });   // 화면은 이 번호대로 늘어놓습니다
  return out;
}

function sgDropContained(questions) {
  var buried = {};
  questions.forEach(function (a) {
    questions.forEach(function (b) {
      // «직접 적기» 칸은 묶음마다 하나씩 반드시 남습니다.
      // topic 이 과목 이름이라 다른 제목 안에 들어 있기 쉬워, 안 막으면 사라집니다.
      if (a.blank || b.blank) return;
      if (a === b || !a.topic || !b.topic || a.topic === b.topic) return;
      if (b.topic.indexOf(a.topic) === -1) return;   // a 가 b 안에 들어 있을 때만
      var ra = SG_KIND_RANK[a.kind] || 1, rb = SG_KIND_RANK[b.kind] || 1;
      if (ra > rb) buried[b.topic] = true;           // 또렷한 쪽(a)을 남깁니다
      else if (rb > ra) buried[a.topic] = true;
      else buried[a.topic] = true;                   // 같은 급이면 긴 쪽(b)을
    });
  });
  return questions.filter(function (q) { return !buried[q.topic || '']; });
}

// ══ 묶음으로 자르기 ══
//
// 영역 안을 다시 «갈래(창체)» 나 «과목(세특)» 으로 자릅니다.
// 이 묶음 하나가 화면의 칸 하나이고, 기록 전문도 이 단위로 보여줍니다.
//
// 반환: [{ label, lines }]

// 묶음 이름을 표에서 찾아 줄을 자르는 공통 틀.
// marks: [{ name, re }] — re 는 줄 어디에서든 이름을 찾는 정규식
function sgChunkBy(lines, marks, fallbackLabel) {
  var order = [], by = {}, cur = null;

  function into(name) {
    if (!by[name]) { by[name] = { label: name, lines: [] }; order.push(by[name]); }
    return by[name];
  }
  function push(t) {
    // 「1 자율활동 (34시간) …」 의 맨 앞 «1» 은 표의 학년 칸입니다.
    // 한글이 없는 토막은 글이 아니므로 앞 묶음에 얹지 않습니다.
    if (!t || !/[가-힣]/.test(t)) return;
    if (!cur) cur = into(fallbackLabel);   // 이름이 아직 안 나온 대목
    cur.lines.push(t);
  }

  (lines || []).forEach(function (raw) {
    var line = sgNorm(raw);
    if (!line || line === SG_CELL_BREAK) return;   // 창체는 갈래 이름으로 가릅니다

    // 줄 «맨 앞» 만 보면 표에서 학년·시간 칸이 먼저 올 때 빗나갑니다 —
    //   「1 동아리활동 (26시간) (과학탐구부)…」
    // 그래서 줄 안에서 찾되, «앞머리» 에 있을 때만 받습니다.
    //
    // ⚠️ 글 한가운데서 자르면 안 됩니다.
    //    「…체험 활동을 구성함. 눈물의 종류와…」 를 가운데서 자르는 바람에
    //    앞 칸이 「…구성함. 눈」 으로 끝나고 다음 칸이 「물의 종류와」 로 시작했습니다.
    //    이름 앞에 «한글 글자» 가 있으면 그건 이름이 아니라 그냥 글입니다.
    var best = null;
    marks.forEach(function (mk) {
      var m = line.match(mk.re);
      if (!m) return;
      var head = line.slice(0, m.index);
      if (/[가-힣]/.test(head)) return;               // 앞에 글이 있으면 자르지 않습니다
      if (!best || m.index < best.at) best = { name: mk.name, at: m.index, len: m[0].length };
    });

    if (!best) { push(line); return; }

    cur = into(best.name);
    var rest = sgNorm(line.slice(best.at + best.len));
    if (rest) cur.lines.push(rest);
  });

  return order.filter(function (c) { return c.lines.length; });
}

// 창의적 체험활동 — 자율·동아리·봉사·진로
// ⚠️ sgSentences() 가 갈래 이름을 지워 버리므로 그 전에 잘라야 합니다.
function sgSplitAreas(lines) {
  var marks = SG_AREAS.map(function (a) {
    // 「자율활동 (34시간)」 「자율 활동 64」 — 뒤에 붙는 시간 표시까지 같이 떼어 냅니다
    var spaced = a.split('').join('\\s*');
    return { name: a, re: new RegExp(spaced + '\\s*(?:\\(\\s*\\d+\\s*시간\\s*\\)|\\(\\s*\\d+\\s*\\)|\\b\\d{1,3}\\b)?\\s*') };
  });
  return sgChunkBy(lines, marks, '창의적 체험활동');
}

// 교과학습발달상황 — 과목별 세특, 그리고 «개인별 세부능력 및 특기사항»
var SG_PERSONAL = '개인별 세부능력 및 특기사항';

function sgSplitSubjects(lines) {
  var marks = [
    // 나이스 판마다 다릅니다 — 「국어: …」 「[생명과학Ⅰ] …」 「〈화학Ⅰ〉 …」
    { name: null, re: /(?:^|\s)([가-힣A-Za-zⅠⅡⅢ·\s]{2,14}?)\s*[:：]\s*(?=\S)/ },
    { name: null, re: /(?:^|\s)[\[〈<]\s*([가-힣A-Za-zⅠⅡⅢ·\s]{2,14}?)\s*[\]〉>]\s*/ }
  ];
  var order = [], by = {}, cur = null;

  function into(name) {
    if (!by[name]) { by[name] = { label: name, lines: [] }; order.push(by[name]); }
    return by[name];
  }
  function push(t) {
    if (!t || !/[가-힣]/.test(t)) return;   // 표의 학기·학점 칸은 글이 아닙니다
    if (!cur) cur = into(SG_NO_SUBJECT);
    cur.lines.push(t);
  }

  var pendingBreak = false, namedSeen = false;

  (lines || []).forEach(function (raw) {
    var line = sgNorm(raw);
    if (!line) return;

    // ⚠️ 세특 표는 과목이 바뀔 때 줄 간격이 두 배가 됩니다. 선을 안 긋습니다.
    //    그래서 «과목 이름이 없는 칸» (개인별 세부능력 및 특기사항) 이
    //    앞 과목(영어 독해와 작문)에 통째로 붙어 버렸습니다.
    if (line === SG_CELL_BREAK) { pendingBreak = true; return; }

    // ⚠️ 칸을 나누기 시작하면서 「개인별」 과 「세부능력 및 특기사항」 이 따로 떨어져
    //    나옵니다. 그러면 뒤엣것은 영역 제목으로 먹히고 「개인별」 만 남아,
    //    개인별 기록이 통째로 앞 과목(영어 독해와 작문)에 붙어 버렸습니다.
    if (/^개인별$/.test(line.replace(/\s/g, ''))) { cur = into(SG_PERSONAL); return; }

    // 「개인별 세부능력 및 특기사항」 은 과목이 아니라 따로 적는 칸입니다
    var pi = line.replace(/\s/g, '').indexOf(SG_PERSONAL.replace(/\s/g, ''));
    if (pi > -1) {
      var plain = line.replace(/\s/g, '');
      var head = plain.slice(0, pi), tail = plain.slice(pi + SG_PERSONAL.replace(/\s/g, '').length);
      if (head) push(line.slice(0, line.length - (plain.length - pi)));
      cur = into(SG_PERSONAL);
      if (tail) cur.lines.push(sgNorm(line.slice(line.length - tail.length)));
      return;
    }

    // 과목 이름도 «줄 앞머리» 에 있을 때만 받습니다.
    // 글 한가운데의 콜론(「목표: 환경 개선」)에서 자르면 문장이 두 동강 납니다.
    var best = null;
    marks.forEach(function (mk) {
      var m = line.match(mk.re);
      if (!m) return;
      var name = sgNorm(m[1]);
      if (!name || name.length > 12) return;
      // 「진로 선택」 「공통」 은 교과 구분이지 과목이 아닙니다
      if (SG_NOT_SUBJECT.test(name.replace(/\s/g, ''))) return;
      if (/[가-힣]/.test(line.slice(0, m.index))) return;
      if (!best || m.index < best.at) best = { name: name, at: m.index, len: m[0].length };
    });

    if (!best) {
      // 칸이 바뀌었는데 과목 이름이 없습니다.
      // 나이스에서 과목 이름 없이 마지막에 오는 칸은 «개인별 세부능력 및 특기사항» 입니다.
      if (pendingBreak) {
        cur = into(namedSeen ? SG_PERSONAL : SG_NO_SUBJECT);
        pendingBreak = false;
      }
      push(line);
      return;
    }
    pendingBreak = false;
    namedSeen = true;
    cur = into(best.name);
    var rest = sgNorm(line.slice(best.at + best.len));
    if (rest) cur.lines.push(rest);
  });

  return order.filter(function (c) { return c.lines.length; });
}

// 영역 하나를 묶음들로 자릅니다.
function sgChunks(sectionKey, lines) {
  if (sectionKey === 'changche') return sgSplitAreas(lines);
  if (sectionKey === 'sesa')     return sgSplitSubjects(lines);
  return [{ label: '행동특성 및 종합의견', lines: lines || [] }]
    .filter(function (c) { return c.lines.length; });
}

function sgBuild(lines) {
  var sections = sgSplitSections(lines);
  var all = [];
  var counts = {};
  // ⚠️ 마지막 안전판입니다.
  //    칸을 아무리 잘 잘라도 나이스 판이 바뀌면 또 어긋납니다.
  //    그래서 «영역 × 학년» 통째 원문을 따로 들고 있다가 화면 맨 위에 둡니다.
  //    칸 나누기가 틀려도 선생님이 못 보는 글은 없어야 합니다.
  var wholes = {};

  SG_SECTIONS.forEach(function (sec) {
    var byGrade = sgSplitGrades(sections[sec.key], sec.key);
    counts[sec.key] = 0;
    [1, 2, 3, 0].forEach(function (g) {
      // 세특은 과목마다 기록이 또렷하게 갈려서 안전판이 필요 없습니다.
      // 전 과목을 다시 이어 붙여 보여주면 같은 글만 두 번 읽게 됩니다.
      if (sec.key !== 'sesa') {
        var whole = sgRecordParts(byGrade[g]);
        if (whole.length) wholes[g + '|' + sec.key] = whole;
      }
      sgChunks(sec.key, byGrade[g]).forEach(function (c) {
        // ⚠️ 길이 두 개를 따로 냅니다.
        //    record   — 선생님께 보여드리는 기록 전문. 한 글자도 버리지 않습니다
        //    sentences — 질문을 뽑으려고 다듬은 글. 토막은 버립니다
        var record = sgRecordText(c.lines);
        if (!record) return;

        var sents = sgSentences(c.lines);
        var stories = sgStories(sents);
        var qs = sgOrderByStory(sgDropContained(
          sgMakeQuestions(sec.key, g, sents, c.label, stories)));
        counts[sec.key] += qs.length;

        // 「기록 보고 직접 적기」 칸이 묶음마다 맨 위에 옵니다
        var blank = sgBlankItem(sec.key, g, c.label || SG_NO_SUBJECT, record, qs.length > 0);
        blank.stories = stories.map(function (st) { return { n: st.n, label: st.label, head: st.head }; });
        all.push(blank);
        all = all.concat(qs);
      });
    });
  });

  return { questions: all, counts: counts, sections: sections, wholes: wholes };
}

// 브라우저 밖(시험)에서도 쓸 수 있게 내보냅니다.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sgSplitSections: sgSplitSections, sgItemsToLines: sgItemsToLines, sgCleanTopic: sgCleanTopic,
                     sgIsTableRow: sgIsTableRow, sgBookOf: sgBookOf, sgSubjectOf: sgSubjectOf, sgIsNoise: sgIsNoise, sgGradeOf: sgGradeOf, sgGradeMarkOf: sgGradeMarkOf, sgSplitGrades: sgSplitGrades,
                     sgSentences: sgSentences, sgTopics: sgTopics, sgTraits: sgTraits,
                     sgSplitAreas: sgSplitAreas, sgSplitSubjects: sgSplitSubjects,
                     sgChunks: sgChunks, sgRecordText: sgRecordText, sgBlankItem: sgBlankItem,
                     sgRecordParts: sgRecordParts,
                     sgIsPageFurniture: sgIsPageFurniture, sgIsHeading: sgIsHeading,
                     sgIsCourseTable: sgIsCourseTable, sgScrubFurniture: sgScrubFurniture,
                     sgIsHeadCell: sgIsHeadCell, sgIsCellLabel: sgIsCellLabel,
                     sgIsScoreHead: sgIsScoreHead, SG_CELL_BREAK: SG_CELL_BREAK,
                     sgMakeQuestions: sgMakeQuestions, sgBuild: sgBuild,
                     sgSentences: sgSentences, sgStories: sgStories, sgStoryLabel: sgStoryLabel,
                     sgOrderByStory: sgOrderByStory, sgDropContained: sgDropContained,
                     SG_SECTIONS: SG_SECTIONS };
}

// ══════════════ ① 글자 꺼내기 (브라우저) ══════════════
//
// pdf.js 로 PDF 에서 줄을 뽑습니다.
// ⚠️ 파일은 브라우저 메모리에서만 다룹니다. 서버로 보내지 않습니다.
//    아래 어디에도 fetch/upload 가 없습니다.

var SG_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
var SG_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
var sgPdfReady = null;

function sgLoadPdfJs() {
  if (sgPdfReady) return sgPdfReady;
  sgPdfReady = new Promise(function (ok, fail) {
    if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
    var s = document.createElement('script');
    s.src = SG_PDFJS;
    s.onload = function () {
      if (!window.pdfjsLib) { fail(new Error('pdf.js 를 불러오지 못했습니다.')); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = SG_WORKER;
      ok(window.pdfjsLib);
    };
    s.onerror = function () { fail(new Error('pdf.js 를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.')); };
    document.head.appendChild(s);
  });
  return sgPdfReady;
}

// PDF 한 쪽의 글자 조각을 «줄» 로 묶습니다.
// 표라서 조각이 뿔뿔이 나오므로, 세로 위치(y)가 비슷하면 한 줄로 봅니다.
// 파일 하나를 읽어 줄 목록을 돌려줍니다.
async function sgReadPdf(file) {
  var pdfjsLib = await sgLoadPdfJs();
  var buf = await file.arrayBuffer();
  var pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  var lines = [];
  for (var i = 1; i <= pdf.numPages; i++) {
    var page = await pdf.getPage(i);
    var content = await page.getTextContent();
    var rules = await sgPageRules(page, pdfjsLib);
    lines = lines.concat(sgItemsToLines(content.items, rules));
  }
  return lines;
}

// ══ 표의 가로선 읽기 ══
//
// 창체·행특은 표입니다. 영역 이름이 글 안에 없고 «옆 칸» 에 있어서,
// 글만 봐서는 어느 줄이 어느 칸인지 알 수 없습니다.
// PDF 에는 표의 선이 그림 명령으로 들어 있습니다. 그걸 읽으면 칸 경계가 나옵니다.
//
// ⚠️ 못 읽어도 괜찮게 만들어 둡니다. 실패하면 빈 배열을 돌려주고,
//    그러면 예전처럼 «이름표는 칸 한가운데» 라는 셈으로 되짚습니다.
function sgMul(m, n) {
  return [m[0]*n[0]+m[1]*n[2], m[0]*n[1]+m[1]*n[3],
          m[2]*n[0]+m[3]*n[2], m[2]*n[1]+m[3]*n[3],
          m[4]*n[0]+m[5]*n[2]+n[4], m[4]*n[1]+m[5]*n[3]+n[5]];
}
function sgApply(m, x, y) { return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]]; }

async function sgPageRules(page, pdfjsLib) {
  try {
    var ops = await page.getOperatorList();
    var OPS = pdfjsLib.OPS;
    var ctm = [1, 0, 0, 1, 0, 0], stack = [], segs = [];

    for (var k = 0; k < ops.fnArray.length; k++) {
      var fn = ops.fnArray[k], a = ops.argsArray[k];
      if (fn === OPS.save) { stack.push(ctm.slice()); continue; }
      if (fn === OPS.restore) { ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
      if (fn === OPS.transform) { ctm = sgMul(a, ctm); continue; }
      if (fn !== OPS.constructPath) continue;

      var subOps = a[0], co = a[1], ci = 0, cx = 0, cy = 0;
      for (var si = 0; si < subOps.length; si++) {
        var op = subOps[si];
        if (op === OPS.moveTo) { cx = co[ci]; cy = co[ci + 1]; ci += 2; }
        else if (op === OPS.lineTo) {
          var p1 = sgApply(ctm, cx, cy), p2 = sgApply(ctm, co[ci], co[ci + 1]);
          segs.push({ y0: p1[1], y1: p2[1], w: Math.abs(p2[0] - p1[0]),
                      x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]) });
          cx = co[ci]; cy = co[ci + 1]; ci += 2;
        }
        else if (op === OPS.rectangle) {
          var x = co[ci], yy = co[ci + 1], w = co[ci + 2], h = co[ci + 3];
          var q1 = sgApply(ctm, x, yy), q2 = sgApply(ctm, x + w, yy + h);
          var rx0 = Math.min(q1[0], q2[0]), rx1 = Math.max(q1[0], q2[0]);
          segs.push({ y0: q1[1], y1: q1[1], w: rx1 - rx0, x0: rx0, x1: rx1 });
          segs.push({ y0: q2[1], y1: q2[1], w: rx1 - rx0, x0: rx0, x1: rx1 });
          ci += 4;
        }
        else if (op === OPS.curveTo) ci += 6;
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) ci += 4;
      }
    }

    // 가로선만, 그리고 표를 가로지르는 «긴» 것만 씁니다.
    // 짧은 선은 「희망분야 | 생명」 같은 칸 속 칸이라 칸 경계가 아닙니다.
    var hor = segs.filter(function (s) { return Math.abs(s.y1 - s.y0) < 2; });
    if (!hor.length) return [];
    var widest = 0;
    hor.forEach(function (s) { if (s.w > widest) widest = s.w; });
    // 같은 높이에 토막토막 그어진 선은 하나로 봅니다 (가로 범위를 넓혀 가며)
    var ys = {};
    hor.forEach(function (s) {
      if (s.w < widest * 0.25) return;            // 너무 짧은 것은 칸 속 칸입니다
      var key = Math.round((s.y0 + s.y1) / 2);
      var cur = ys[key];
      if (!cur) ys[key] = { y: key, x0: s.x0, x1: s.x1 };
      else { cur.x0 = Math.min(cur.x0, s.x0); cur.x1 = Math.max(cur.x1, s.x1); }
    });
    return Object.keys(ys).map(function (k) { return ys[k]; })
             .sort(function (a, b) { return b.y - a.y; });
  } catch (e) {
    return [];   // 선을 못 읽어도 «가운데» 셈으로 돌아갑니다
  }
}

// ══════════════ 화면 (교사) ══════════════

var sgFound = [];        // 뽑은 질문들 (묶음마다 «직접 적는 칸» 하나 + 규칙이 뽑은 질문들)
var sgWholes = {};       // 「학년|영역」 통째 원문 — 칸 나누기가 틀려도 볼 수 있게
var sgEdited = {};       // 선생님이 직접 고쳐 쓴 질문 { 번호: 글자 }
var sgPicked = {};       // { 번호: true } — 체크한 것
// 체크한 질문이 가는 곳은 둘입니다(2026-10-07):
//   «학생에게 보내기» — 그 학생의 답안 연습장 «받은 질문» 으로. 화면은 그대로 남습니다
//   «「낼 질문」으로 올리기» — 오늘 면접 질문지로. 한 번 묻고 나서 화면을 닫습니다
// ⚠️ 예전엔 «담아 두기» 단추가 따로 있었는데(2026-10-05) 거의 안 쓰셨습니다. «올리기» 를 누르면
//    한 번 묻기 때문에 실수로 닫히는 일은 그것만으로 막혀서, 담아 두기는 뺐습니다.
var sgSent = {};         // { 번호: true } — 학생에게 보낸 것. 줄에 «학생에게 보냄» 꼬리표
var sgCur = null;        // 지금 보고 있는 묶음 (sgGroupList() 의 차례)
var sgRailGrade = null;  // 왼쪽 목록에 보이는 학년 (null 이면 지금 묶음의 학년을 따라감)
var sgMore = {};         // { 묶음키: true } — 최대 개수 너머 질문까지 펼쳐 둔 묶음
var sgMask = true;       // 개인정보 가림

// 묶음마다 처음에 보여 주는 질문 수. 열 개 넘게 늘어놓으면 고르기가 더 힘듭니다(선생님 말씀).
// 또렷한 규칙으로 잡힌 것(따옴표 제목·스스로 던진 물음)부터 보여 주고, 나머지는 「더 보기」 뒤에 둡니다.
var SG_MAX_SHOW = 5;

// ══ 화면 짜임 (2026-10-05 에 바꿈) ══
//
// 예전엔 학년·영역 칩으로 걸러서 모든 묶음을 한 줄로 늘어놓고, 질문마다 근거 문장을
// 따로 붙였습니다. 선생님 말씀: «질문마다 원문을 보는 게 아니라, 원문을 먼저 보고
// 그 아래에서 질문을 고르고 싶다. 대신 원문이 기니까 자율·동아리·진로(학년별)로
// 하나씩 골라 보게.»  그래서 지금은
//   왼쪽  : 묶음 목록 (영역 → 학년 · 갈래/과목)   ← 2 : 8 로 나눕니다
//   오른쪽: 고른 묶음의 기록 전문 → 그 아래 질문(체크) → 맨 아래 직접 적는 칸
// 휴대폰처럼 좁으면 왼쪽 목록 대신 위에 고르는 칸(select)이 뜹니다.

// 준비 화면 자리에 통째로 바꿔 끼웁니다 (떠 있는 창은 작아서 불편하다는 말씀 — 2026-10-05).
// 왼쪽 학생 명단은 그대로, 오른쪽 칸 전체가 이 화면이 됩니다.
function openSaenggibu() {
  sgFound = []; sgPicked = {}; sgSent = {}; sgEdited = {}; sgCur = null; sgMore = {}; sgRailGrade = null;
  show('saenggibu');      // teacher-app.js — 오른쪽 칸의 다른 화면을 다 감추고 이것만 보입니다
  document.getElementById('sg-file').value = '';
  var who = document.getElementById('sg-who');
  if (who) who.textContent = (typeof target !== 'undefined' && target) ? '· ' + target.student_no + ' ' + target.name : '';
  renderSaenggibu();
  window.scrollTo(0, 0);
}

// 「← 준비 화면으로」 단추에서 부릅니다. 체크해 둔 것이 있으면 한 번 묻습니다 — 실수로 닫는 일을 막습니다.
// 올린 뒤에 닫을 때는 force 로 묻지 않습니다.
function closeSaenggibu(force) {
  var n = Object.keys(sgPicked).length;
  if (!force && n > 0 &&
      !confirm('체크한 질문 ' + n + '개를 아직 보내거나 올리지 않았습니다.\n그래도 나갈까요? (나가면 버려집니다)')) return;
  show('setup');
  sgFound = []; sgPicked = {}; sgSent = {};   // 화면을 닫으면 읽은 내용도 버립니다
}

async function onSaenggibuFile(input) {
  var file = input.files && input.files[0];
  if (!file) return;

  var body = document.getElementById('sg-body');
  body.classList.remove('split');
  body.innerHTML = '<p class="sg-note">읽는 중입니다...</p>';

  try {
    var lines = await sgReadPdf(file);

    // 글자가 없는 PDF(스캔본)면 여기서 알려줍니다
    var letters = lines.join('').replace(/[\s\d\-|()]/g, '').length;
    if (letters < 50) {
      body.innerHTML = '<p class="sg-note bad">이 파일은 <b>글자가 없는 PDF</b> 입니다.<br>' +
        '사진으로 찍거나 스캔한 파일은 글자를 꺼낼 수 없습니다.<br>' +
        '나이스에서 <b>PDF 로 저장</b>한 파일을 넣어 주세요.</p>';
      return;
    }

    var r = sgBuild(lines);
    sgFound = r.questions;
    sgWholes = r.wholes || {};
    sgPicked = {};
    sgSent = {};
    sgEdited = {};
    sgCur = null;
    sgMore = {};
    sgRailGrade = null;

    if (!sgFound.length) {
      body.innerHTML = '<p class="sg-note bad">질문을 만들 만한 대목을 못 찾았습니다.<br>' +
        '생기부 판이 달라 자르는 자리가 안 맞을 수 있습니다. 선생님께 알려 주세요.</p>';
      return;
    }
    renderSaenggibu();
  } catch (e) {
    body.innerHTML = '<p class="sg-note bad">파일을 읽지 못했습니다.<br>' +
      esc((e && e.message) || String(e)) + '</p>';
  }
}

// 이름·학번이 원문에 섞여 있을 수 있어 가려서 보여줍니다.
function sgMaskText(s) {
  if (!sgMask) return s;
  return String(s)
    .replace(/\d{5,}/g, '●●●●●')                                   // 학번·전화
    .replace(/\d{6}\s*-\s*\d{7}/g, '●●●●●●-●●●●●●●');              // 주민번호
}

function toggleSgMask() { sgMask = !sgMask; renderSaenggibu(); }

// 못 찾은 과목은 선생님이 직접 적습니다. 적기 시작하면 저절로 담깁니다.
// ⚠️ 여기서 목록을 다시 그리면 글자 한 자 칠 때마다 커서가 맨 뒤로 튑니다.
//    그래서 아래 단추와 이 줄의 겉모습만 손으로 고칩니다.
function setSgText(i, v) {
  sgEdited[i] = v;
  if (v.trim()) sgPicked[i] = true; else delete sgPicked[i];
  sgPaintItem(i);
  paintSgRail();
  paintSgFoot();
}

function sgTextOf(i) {
  return (sgEdited[i] !== undefined) ? sgEdited[i] : sgFound[i].text;
}

// ⚠️ 체크 하나 눌렀다고 화면을 통째로 다시 그리면 기록을 읽던 자리가 맨 위로 튑니다.
//    그 줄과 왼쪽 목록의 숫자만 고칩니다.
function toggleSgPick(i) {
  if (sgPicked[i]) delete sgPicked[i]; else sgPicked[i] = true;
  sgPaintItem(i);
  paintSgRail();
  paintSgFoot();
}

function sgPaintItem(i) {
  var row = document.querySelector('.sg-item[data-i="' + i + '"]');
  if (!row) return;
  row.classList.toggle('on', !!sgPicked[i]);
  row.classList.toggle('sent', !!sgSent[i]);
  var box = row.querySelector('input[type="checkbox"]');
  if (box) box.checked = !!sgPicked[i];
}

// ══ 묶음 ══ — 학년 · 영역 · 갈래(또는 과목) 하나가 한 묶음입니다.
// sgBuild 가 묶음마다 «직접 적는 칸»(blank) 을 맨 앞에 두고 질문을 뒤에 붙여 두었습니다.
function sgGroupList() {
  var order = [], by = {};
  sgFound.forEach(function (q, i) {
    var k = q.grade + '|' + q.area + '|' + (q.subject || SG_NO_SUBJECT);
    if (!by[k]) {
      by[k] = { key: k, grade: q.grade, area: q.area, label: q.subject || SG_NO_SUBJECT, blank: null, items: [] };
      order.push(by[k]);
    }
    if (q.blank) by[k].blank = { q: q, i: i };
    else by[k].items.push({ q: q, i: i });
  });
  return order;
}

function sgSectionTitle(key) {
  var hit = SG_SECTIONS.filter(function (s) { return s.key === key; })[0];
  return hit ? hit.title : '';
}

function sgGradeText(g) { return g ? g + '학년' : '학년 모름'; }

// 묶음 이름 — 행특은 갈래 이름이 곧 영역 이름이라 두 번 쓰지 않습니다
function sgGroupName(g) {
  var sub = (g.label === sgSectionTitle(g.area)) ? '' : g.label;
  return sgGradeText(g.grade) + (sub ? ' · ' + sub : '');
}

// 또렷한 규칙으로 잡힌 질문부터. 같은 등급이면 기록에 나온 차례대로.
// 안쪽(sgOrderByStory)에서 이야기별로 돌아가며 매긴 번호대로. 번호가 없으면(옛 자료) 또렷한 것부터.
function sgRanked(items) {
  return items.slice().sort(function (a, b) {
    var oa = (a.q.order === undefined) ? 1e9 : a.q.order, ob = (b.q.order === undefined) ? 1e9 : b.q.order;
    return (oa - ob) || (SG_KIND_RANK[b.q.kind] || 1) - (SG_KIND_RANK[a.q.kind] || 1) || (a.i - b.i);
  });
}

function sgPickedCount(g) {
  var n = g.items.filter(function (x) { return sgPicked[x.i]; }).length;
  if (g.blank && sgPicked[g.blank.i]) n++;
  return n;
}

function pickSgGroup(i) {
  sgCur = i;
  sgMore = {};
  sgRailGrade = null;     // 왼쪽 목록은 고른 묶음의 학년을 따라갑니다
  renderSaenggibu();
  var main = document.querySelector('.sg-main');
  if (main) main.scrollTop = 0;
}

function sgStep(d) {
  var n = sgGroupList().length;
  if (!n) return;
  pickSgGroup(Math.max(0, Math.min(n - 1, (sgCur || 0) + d)));
}

function toggleSgMore(key) {
  if (sgMore[key]) delete sgMore[key]; else sgMore[key] = true;
  renderSaenggibu();
}

function renderSaenggibu() {
  var body = document.getElementById('sg-body');
  var foot = document.getElementById('sg-foot');

  if (!sgFound.length) {
    body.classList.remove('split');
    body.innerHTML =
      '<p class="sg-note">나이스에서 뽑은 <b>생기부 PDF</b> 를 고르세요.<br>' +
      '<b>파일은 이 브라우저 안에서만 읽고 바로 버립니다.</b> 서버에 올라가지 않습니다.</p>';
    foot.hidden = true;
    return;
  }

  var groups = sgGroupList();
  if (sgCur === null || sgCur >= groups.length) sgCur = 0;

  body.classList.add('split');
  body.innerHTML =
    '<nav class="sg-rail" id="sg-rail">' + sgRailHTML(groups) + '</nav>' +
    '<div class="sg-main">' + sgJumpHTML(groups) + sgMainHTML(groups[sgCur], groups) + '</div>';

  paintSgFoot();
}

// ── 왼쪽: 묶음 목록 ──
//
// ⚠️ 실제 생기부는 묶음이 50개 넘게 나옵니다(과목이 많아서). 한 줄로 늘어놓으면 3학년은
//    맨 밑에 묻혀서 스크롤해야 보였습니다(선생님 말씀). 그래서 맨 위에 학년 단추를 두고
//    그 학년 것만 보입니다 — 창체 4개 + 과목 10여 개 + 행특 1개면 스크롤 없이 다 들어갑니다.
function sgRailGradeNow(groups) {
  if (sgRailGrade !== null) return sgRailGrade;
  return groups[sgCur] ? groups[sgCur].grade : (groups[0] ? groups[0].grade : 1);
}

function sgRailHTML(groups) {
  var g0 = sgRailGradeNow(groups);

  // 학년 단추 — 있는 학년만. 담은 수가 있으면 숫자를 붙입니다
  var grades = [];
  groups.forEach(function (g) { if (grades.indexOf(g.grade) === -1) grades.push(g.grade); });
  grades.sort(function (a, b) { return (a || 9) - (b || 9); });   // 「학년 모름」(0)은 맨 뒤
  var html = '<div class="sg-grades">' + grades.map(function (gr) {
    var n = 0;
    groups.forEach(function (g) { if (g.grade === gr) n += sgPickedCount(g); });
    return '<button class="sg-gbtn" aria-pressed="' + (gr === g0) + '" onclick="pickSgRailGrade(' + gr + ')">' +
      esc(sgGradeText(gr)) + (n ? '<b>' + n + '</b>' : '') + '</button>';
  }).join('') + '</div>';

  // 그 학년의 묶음 — 영역마다 머리줄
  var lastArea = null;
  groups.forEach(function (g, i) {
    if (g.grade !== g0) return;
    if (g.area !== lastArea) {
      lastArea = g.area;
      html += '<p class="sg-rhead">' + esc(sgSectionTitle(g.area)) + '</p>';
    }
    var picked = sgPickedCount(g);
    var sub = (g.label === sgSectionTitle(g.area)) ? '전체' : g.label;
    html += '<button class="sg-rentry' + (g.items.length ? '' : ' none') + '" aria-current="' + (i === sgCur) + '"' +
              ' onclick="pickSgGroup(' + i + ')">' +
      '<span class="nm">' + esc(sub) + '</span>' +
      '<span class="n">' + (picked ? '<b>' + picked + '</b>' : '') + '</span>' +
      '</button>';
  });
  return html;
}

// 학년 단추 — 그 학년의 첫 묶음으로 갑니다 (지금 보던 묶음이 그 학년이면 그대로)
function pickSgRailGrade(gr) {
  var groups = sgGroupList();
  if (groups[sgCur] && groups[sgCur].grade === gr) { sgRailGrade = gr; paintSgRail(); return; }
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].grade === gr) { pickSgGroup(i); return; }
  }
}

function paintSgRail() {
  var rail = document.getElementById('sg-rail');
  if (rail) rail.innerHTML = sgRailHTML(sgGroupList());
}

// 좁은 화면에서는 왼쪽 목록 대신 위에 고르는 칸
function sgJumpHTML(groups) {
  var grades = [];
  groups.forEach(function (g) { if (grades.indexOf(g.grade) === -1) grades.push(g.grade); });
  grades.sort(function (a, b) { return (a || 9) - (b || 9); });
  return '<select class="sg-jump" onchange="pickSgGroup(+this.value)" aria-label="묶음 고르기">' +
    grades.map(function (gr) {
      return '<optgroup label="' + esc(sgGradeText(gr)) + '">' +
        groups.map(function (g, i) {
          if (g.grade !== gr) return '';
          var sub = (g.label === sgSectionTitle(g.area)) ? '' : ' · ' + g.label;
          return '<option value="' + i + '"' + (i === sgCur ? ' selected' : '') + '>' +
            esc(sgSectionTitle(g.area) + sub) + '</option>';
        }).join('') + '</optgroup>';
    }).join('') + '</select>';
}

// ── 오른쪽: 기록 전문 → 질문(체크) → 직접 적는 칸 ──
// ⚠️ 기록을 이야기(활동)별 문단으로 자르고 질문에도 이야기 머리글을 붙여 봤다가 뺐습니다(2026-10-05).
//    선생님 말씀: 형광펜만으로 충분히 보이고, 억지로 주제별로 나눠 보여 주니 불편하다.
//    이야기 나누기는 «질문을 더 잘 고르는» 안쪽 일(줄 세우기·자리말)에만 씁니다 — sgOrderByStory.
function sgMainHTML(g, groups) {
  var record = g.blank ? g.blank.q.source : '';
  var ranked = sgRanked(g.items);
  var topics = ranked.map(function (x) { return x.q.topic; });
  var open = sgMore[g.key] || ranked.length <= SG_MAX_SHOW;
  var shown = open ? ranked : ranked.slice(0, SG_MAX_SHOW);
  var hidden = ranked.length - shown.length;

  var html =
    '<div class="sg-head">' +
      '<p class="sg-gtitle">' + esc(sgSectionTitle(g.area)) + ' <b>' + esc(sgGroupName(g)) + '</b>' +
        '<span class="n">' + (sgCur + 1) + ' / ' + groups.length + '</span></p>' +
      '<div class="sg-nav">' +
        '<button class="chat-pick" aria-pressed="' + sgMask + '" onclick="toggleSgMask()">개인정보 가림</button>' +
        '<button class="chat-pick" onclick="sgStep(-1)"' + (sgCur === 0 ? ' disabled' : '') + '>← 앞 묶음</button>' +
        '<button class="chat-pick" onclick="sgStep(1)"' + (sgCur === groups.length - 1 ? ' disabled' : '') + '>다음 묶음 →</button>' +
      '</div>' +
    '</div>';

  // 기록 전문 — 질문이 가리키는 대목은 색을 입혀 둡니다. 어디서 나온 질문인지 바로 보이게.
  html += '<p class="sg-rlabel">기록 <span class="sg-len">' +
            String(record.length).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '자</span></p>' +
          '<div class="sg-record">' + sgMarkRecord(sgMaskText(record), topics.map(sgMaskText)) + '</div>';

  // 질문
  html += '<p class="sg-rlabel">질문 <span class="sg-len">' +
            (ranked.length ? ranked.length + '개 뽑음' : '못 뽑음') + '</span></p>' +
          '<div class="sg-list">' + shown.map(sgItemHTML).join('');
  if (hidden > 0) {
    html += '<button class="sg-more" onclick="toggleSgMore(\'' + g.key.replace(/'/g, "\\'") + '\')">' +
            hidden + '개 더 보기</button>';
  } else if (ranked.length > SG_MAX_SHOW) {
    html += '<button class="sg-more" onclick="toggleSgMore(\'' + g.key.replace(/'/g, "\\'") + '\')">접기</button>';
  }
  if (g.blank) html += sgBlankHTML(g.blank);
  html += '</div>';
  return html;
}

// 질문이 가리키는 구절(topic)에 <mark> 를 입힙니다. 긴 구절부터, 한 번씩만.
function sgMarkRecord(text, topics) {
  var out = esc(text);
  var done = {};
  topics.slice().sort(function (a, b) { return String(b).length - String(a).length; })
    .forEach(function (t) {
      t = esc(String(t || '').trim());
      if (t.length < 2 || done[t]) return;
      done[t] = true;
      var at = out.indexOf(t);
      if (at < 0) return;
      // 이미 색을 입힌 자리 안이면 건너뜁니다 (겹치면 태그가 깨집니다)
      var before = out.slice(0, at);
      var opens = (before.match(/<mark>/g) || []).length, closes = (before.match(/<\/mark>/g) || []).length;
      if (opens !== closes) return;
      out = before + '<mark>' + t + '</mark>' + out.slice(at + t.length);
    });
  return out;
}

// 「원문 전체」(학년 × 영역의 모든 갈래를 통째로) 접이식은 2026-10-05 에 뺐습니다 —
// 묶음마다 그 기록이 위에 다 보이니 같은 글을 두 번 보는 셈이라는 말씀.
// sgBuild 가 돌려주는 wholes(sgWholes) 는 그대로 두었습니다. 칸 나누기가 어긋나는 일이
// 다시 생기면 그때 다시 꺼내 쓰면 됩니다.

// 기록을 보고 직접 적는 칸 — 묶음의 맨 아래
function sgBlankHTML(x) {
  var note = x.q.lonely
    ? '<b class="sg-warn">여기서는 탐구 제목을 못 찾았습니다 — 기록을 보고 직접 적어 주세요</b>'
    : '<b class="sg-own">기록을 보고 직접 물으셔도 됩니다</b>';
  return '<div class="sg-item blank' + (sgPicked[x.i] ? ' on' : '') + (sgSent[x.i] ? ' sent' : '') + '" data-i="' + x.i + '">' +
    '<input type="checkbox"' + (sgPicked[x.i] ? ' checked' : '') +
      ' onchange="toggleSgPick(' + x.i + ')" title="이 질문 담기">' +
    '<span class="sg-q">' +
      '<span class="sg-meta">' + note + '</span>' +
      '<input class="sg-write" type="text" value="' + esc(sgTextOf(x.i)) + '"' +
        ' oninput="setSgText(' + x.i + ', this.value)" placeholder="여기에 낼 질문을 적으세요">' +
    '</span></div>';
}

// 질문 한 줄 — 원문은 위 기록에서 색으로 표시되므로 여기엔 짧은 근거만 둡니다
function sgItemHTML(x) {
  return '<label class="sg-item' + (sgPicked[x.i] ? ' on' : '') + (sgSent[x.i] ? ' sent' : '') + '" data-i="' + x.i + '">' +
    '<input type="checkbox"' + (sgPicked[x.i] ? ' checked' : '') +
      ' onchange="toggleSgPick(' + x.i + ')">' +
    '<span class="sg-q">' +
      '<span class="sg-qtext">' + esc(x.q.text) + '</span>' +
      '<span class="sg-meta">' + esc(x.q.competency) +
        (x.q.topic ? ' · 「' + esc(sgMaskText(x.q.topic)) + '」' : '') + '</span>' +
    '</span></label>';
}

// 글자를 고칠 때마다 목록을 통째로 다시 그리면 커서가 튑니다.
// 아래 단추만 고쳐 그립니다.
// 단추 둘: «학생에게 보내기» 는 보내고 화면에 남습니다. «올리기» 는 묻고 나서 닫습니다.
function paintSgFoot() {
  var foot = document.getElementById('sg-foot');
  var send = document.getElementById('sg-send');
  var btn = document.getElementById('sg-add');
  var note = document.getElementById('sg-foot-note');
  if (!foot || !btn) return;
  var n = Object.keys(sgPicked).length;
  var sent = Object.keys(sgSent).length;
  foot.hidden = !sgFound.length;
  if (send) {
    send.disabled = (n === 0);
    send.textContent = n ? n + '개 학생에게 보내기' : '학생에게 보내기';
  }
  btn.disabled = (n === 0);
  btn.textContent = n ? n + '개 「낼 질문」으로 올리기' : '「낼 질문」으로 올리기';
  if (note) {
    note.textContent = '체크한 질문을 학생 답안 연습장으로 보내거나, 오늘 면접의 「낼 질문」으로 올립니다.' +
      (sent ? ' · 지금까지 학생에게 보낸 질문 ' + sent + '개' : '');
  }
}

// ⚠️ 학생 앱(/)과 선생님 화면(/teacher/)은 주소가 같아서, 한 브라우저에서는 로그인을 «하나만» 기억합니다.
//    선생님 화면을 열어 둔 채 다른 탭에서 학생으로 로그인하면, 이 탭의 요청도 학생으로 나갑니다.
//    2026-10-07 실제 시험에서 이렇게 «new row violates row-level security policy» 가 떴습니다
//    (서버에서는 선생님·관리자 계정 12개 모두 넣기가 됐습니다). 보내기 전에 로그인이 그대로인지 봅니다.
//    getSession 은 이 기기에 저장된 것을 읽을 뿐이라 서버 요청이 안 늡니다.
var SG_OTHER_LOGIN_MSG =
  '이 브라우저가 지금 다른 계정(학생 등)으로 로그인돼 있어서 보낼 수 없습니다.\n\n' +
  '학생 앱과 선생님 화면은 한 브라우저에서 로그인을 하나만 기억합니다. ' +
  '학생 화면을 확인할 때는 시크릿 창이나 다른 브라우저를 써 주세요.\n\n' +
  '이 화면을 새로고침해서 선생님으로 다시 로그인하면 보낼 수 있습니다.';
async function sgSameLogin() {
  try {
    var r = await sb.auth.getSession();
    var uid = r && r.data && r.data.session && r.data.session.user && r.data.session.user.id;
    if (uid && me && uid === me.id) return true;
  } catch (e) { /* 아래 안내로 */ }
  alert(SG_OTHER_LOGIN_MSG);
  return false;
}

// 체크한 질문을 지금 고른 학생의 답안 연습장 «받은 질문» 으로 보냅니다(practice_offers).
// 학생이 골라서 «선생님 질문» 카드로 넣고 답을 써 봅니다. 화면은 닫지 않습니다.
// 같은 학생에게 같은 질문을 또 보내면 서버가 하나만 남깁니다(onConflict + ignoreDuplicates).
// 서버에 올라가는 것은 질문 글자뿐입니다. 생기부 원문은 따라가지 않습니다.
async function sendSaenggibuPicks() {
  var picked = Object.keys(sgPicked).map(Number).sort(function (a, b) { return a - b; });
  if (!picked.length) return;
  if (typeof target === 'undefined' || !target) { toast('학생을 먼저 고르세요.', 'bad'); return; }
  var who = target.name || target.student_no || '학생';
  if (!confirm(picked.length + '개를 ' + who + ' 학생의 답안 연습장으로 보냅니다.\n' +
               '학생이 «받은 질문» 에서 골라 답을 써 봅니다.')) return;
  if (!(await sgSameLogin())) return;

  var rows = [];
  picked.forEach(function (i) {
    var q = sgFound[i];
    var text = sgTextOf(i).trim();
    if (!text) return;
    rows.push({ school_id: SCHOOL_ID, student_id: target.id,
                teacher_id: me.id, teacher_name: (me && me.name) || '',
                grade: (q.grade >= 1 && q.grade <= 3) ? String(q.grade) : '공통',
                question: text });
  });
  if (!rows.length) return;
  var btn = document.getElementById('sg-send');
  if (btn) btn.disabled = true;
  const { data, error } = await sb.from('practice_offers')
    .upsert(rows, { onConflict: 'student_id,question', ignoreDuplicates: true })
    .select('id');
  if (error) {
    if (/row-level security/.test(error.message || '')) alert(SG_OTHER_LOGIN_MSG);
    else toast('보내지 못했습니다: ' + error.message, 'bad');
    paintSgFoot(); return;
  }

  var made = (data || []).length;
  picked.forEach(function (i) { sgSent[i] = true; delete sgPicked[i]; sgPaintItem(i); });
  paintSgRail();
  paintSgFoot();
  toast(made + '개를 ' + who + ' 학생에게 보냈습니다.' +
        (rows.length > made ? ' (이미 보낸 ' + (rows.length - made) + '개는 건너뜀)' : ''), 'ok');
}

// 체크한 질문을 면접 준비 화면의 «낼 질문» 으로 옮기고 화면을 닫습니다. 닫기 전에 한 번 묻습니다.
// 여기서부터는 평범한 질문 글자일 뿐입니다. 생기부 원문은 따라가지 않습니다.
function addSaenggibuPicks() {
  var picked = Object.keys(sgPicked).map(Number).sort(function (a, b) { return a - b; });
  if (!picked.length) return;
  if (!confirm(picked.length + '개를 「낼 질문」으로 올리고 생기부 화면을 닫습니다.' +
               '\n\n다른 묶음에서 더 고르려면 「취소」를 누르세요.')) return;

  picked.forEach(function (i) {
    var q = sgFound[i];
    var text = sgTextOf(i).trim();
    if (!text) return;
    midQuestions.push({ text: text, competency: q.competency });
  });
  renderQuestions();
  closeSaenggibu(true);
  toast(picked.length + '개를 「낼 질문」에 올렸습니다. 글자는 고쳐 쓰셔도 됩니다.', 'ok');
}
