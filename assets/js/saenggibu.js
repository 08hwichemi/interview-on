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
  // 「4 / 19」 — 몇 쪽 가운데 몇 쪽. 짧은 줄일 때만 봅니다(성적표의 91/73.8 과 헷갈리지 않게)
  if (t.length <= 40 && /(?:^|\s)\d{1,3}\s*\/\s*\d{1,3}(?:\s|$)/.test(t)) return true;
  return false;
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

// 줄들을 영역별로 자릅니다.
// 반환: { changche:[줄...], sesa:[줄...], haengteuk:[줄...] }
function sgSplitSections(lines) {
  var out = { changche: [], sesa: [], haengteuk: [] };
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
    if (started) { cur = started; return; }   // 제목 줄 자체는 담지 않습니다

    // 우리가 안 보는 영역이 시작되면 끊습니다
    if (sgIsHeading(line, SG_STOPS)) { cur = null; return; }

    if (cur) out[cur].push(line);
  });

  return out;
}

// 줄 안에서 학년 표시를 찾습니다.
// 나이스 PDF 는 세 가지로 적습니다 — 「[1학년]」, 「1학년」, 그리고 표 안에서는
// 숫자 하나만 덩그러니 「1」. 마지막 것 때문에 애를 먹었습니다.
function sgGradeOf(line, bareOk) {
  var t = sgNorm(line);
  // 「[1학년]」 「1학년」 — 어디서나 믿을 수 있습니다
  var m = t.match(/(?:^|[^0-9])([1-3])\s*학\s*년/);
  if (m) return Number(m[1]);
  // 숫자 한 자 — 창체·행특 표에서만 학년입니다
  if (bareOk && /^\[?\s*[1-3]\s*\]?$/.test(t)) return Number(t.replace(/[^0-9]/g, ''));
  return null;
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
  (lines || []).forEach(function (raw) {
    var line = sgNorm(raw);

    // ⚠️ 표의 맨 왼쪽 «학년» 칸이 줄 앞에 붙어 나오기도 합니다.
    //      「1 자율활동 (34시간) 다양한 활동을…」
    //    칸이 따로 떨어져 나올 때(「1」 한 줄)만 보다가 이걸 놓쳐서,
    //    창체가 통째로 «학년 모름» 으로 갔습니다.
    //    세특 표에서는 맨 왼쪽이 «학기» 라 여기서는 보지 않습니다.
    if (bareOk) {
      var lead = line.match(/^\[?\s*([1-3])\s*\]?\s+(?=[가-힣])/);
      if (lead) { cur = Number(lead[1]); line = sgNorm(line.slice(lead[0].length)); }
    }

    var g = sgGradeOf(line, bareOk);
    if (g) {
      cur = g;
      // 「2학년」 「[2학년]」 「2」 처럼 표시만 있는 줄이면 버립니다.
      if (line.replace(/(?:제)?[1-3]\s*학\s*년/, '')
              .replace(/[0-9()\[\]|:\s]/g, '') === '') return;
    }
    if (line) byGrade[cur].push(line);
  });
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
    return !sgIsPageFurniture(l) && !sgIsNoise(l) &&
           !sgIsTableRow(l) && !sgIsCourseTable(l);
  });
  return sgScrubFurniture(sgTidy(sgJoinLines(kept)));
}

// ══ 질문 만들기용 — 문장으로 쪼갭니다 ══
// 생기부는 「~함.」 「~음.」 으로 끝나는 문장이 이어 붙어 있습니다.
function sgSentences(lines) {
  var text = sgRecordText(lines)
    // 갈래 이름이 문장 앞에 붙어 오면 이야깃거리로 잘못 잡힙니다
    .replace(new RegExp('(' + SG_AREAS.join('|') + ')\\s*\\d*\\s*', 'g'), ' ')
    .replace(/\s+/g, ' ');

  return text.split(/(?<=[.!?])\s+/)
    .map(sgNorm)
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

function sgItemsToLines(items) {
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
      (byCol[k] = byCol[k] || []).push({ y: L.y, text: c.text });
    });
  });

  // ⚠️ 한 세로줄이라도 셈이 어긋나면 그 줄은 통째로 제자리에 둡니다.
  //    반만 옮기면 줄 순서가 뒤엉켜서, 글이 통째로 앞으로 튀어나옵니다.
  var moved = stay;
  Object.keys(byCol).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (k) {
    var col = byCol[k].sort(function (a, b) { return b.y - a.y; });
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
    if (sgNorm(prose)) out.push({ y: L.y, text: prose });
  });
  moved.forEach(function (m) { if (sgNorm(m.text)) out.push(m); });
  out.sort(function (a, b) { return b.y - a.y; });

  return out.map(function (o) { return o.text; });
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

  // ── 끝까지 파고든 흔적 ──
  { re: /([^,.\s][^,.]{3,70}?)(?:을|를)\s*(?:설계|고안|제작|개발|구현)/g,  kind: '활동' },
  { re: /([^,.\s][^,.]{3,70}?)(?:을|를)\s*(?:탐색|고찰|규명|입증)/g,      kind: '탐구' },
  { re: /([^,.\s][^,.]{3,70}?)(?:와|과)\s*연계하여\s*탐구/g,             kind: '탐구' },
  { re: /([^,.\s][^,.]{3,70}?(?:음|함))(?:을|를)\s*(?:파악|확인|이해)/g,   kind: '개념' }
];

// 창체 갈래 이름·과목 꼬리표가 앞에 붙어 오면 떼어 냅니다.
// 「동아리활동 (과학탐구부) 미세먼지와 식물 생장」 처럼 통째로 잡히면
// 질문이 우스워집니다.
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
  t = t.replace(/^(?:나아가|또한|특히|한편|아울러|그리고|이후|이를|먼저|끝으로|더불어|이에|또)\s+/, '');
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
var SG_JOINERS = /(?:바탕으로|토대로|중심으로|비롯하여|통하여|통해|위하여|위해|활용하여|이용하여|연계하여|접목하여|주목하여|배운\s*후|하고자|하고서)\s+/g;

function sgTrimClause(t) {
  var last = -1, m;
  var re = new RegExp(SG_JOINERS.source, 'g');
  while ((m = re.exec(t)) !== null) last = m.index + m[0].length;
  return last > -1 ? sgNorm(t.slice(last)) : sgNorm(t);
}

// 잘라 내고도 서술로 끝나면 제목이 아닙니다.
var SG_CLAUSE = /(?:하면서|하며$|하고$|하여$|면서$|보며$|으며$|는데$|지만$|고자$)/;

function sgLooksJunk(t) {
  if (SG_JUNK_HEAD.test(t)) return true;
  if (SG_CLAUSE.test(t)) return true;
  // 한글이 거의 없으면 표에서 흘러든 조각입니다
  var hangul = (t.match(/[가-힣]/g) || []).length;
  return hangul < 2;
}

function sgTopics(sentence) {
  var found = [];
  SG_TOPIC_RULES.forEach(function (rule) {
    var re = new RegExp(rule.re.source, 'g');
    var m;
    while ((m = re.exec(sentence)) !== null) {
      var t = sgCleanTopic(m[1]);
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
// 책에 「아는 대로 설명해 보세요」 는 안 맞습니다.
function sgBookOf(topic) {
  var m = String(topic).match(/^(.{2,40}?)\s*\(([가-힣]{2,4}(?:\s[가-힣]{1,10})?)\)$/);
  return m ? { title: sgNorm(m[1]), author: sgNorm(m[2]) } : null;
}

// ⚠️ 한 이야깃거리에 질문 하나만 냅니다. 여럿이면 같은 말이 두 줄로 늘어섭니다.
var SG_BOOK_TEMPLATE =
  { comp: '학업역량',
    make: function (b) { return '「' + b.title + '」을(를) 읽었군요. 어떤 대목이 가장 기억에 남고, 왜 그랬나요?'; } };

// 영역마다 다른 질문 틀입니다.
// 영역마다 질문 틀 하나씩.
var SG_TEMPLATES = {
  changche:
    { comp: '공동체역량',
      make: function (t) { return '「' + t + '」 기록이 있습니다. 그때 본인이 실제로 한 일과, 가장 어려웠던 판단은 무엇이었나요?'; } },
  sesa:
    { comp: '학업역량',
      make: function (t) { return '「' + t + '」이(가) 기록에 나옵니다. 아는 대로 설명해 보세요.'; } },
  haengteuk:
    { comp: '공동체역량',
      make: function (t) { return '선생님이 「' + t + '」이라고 적어 주셨습니다. 그렇게 보였을 장면을 하나 들어 주세요.'; } }
};

// 「…어떻게 높일까?」 처럼 물음으로 된 제목에 «아는 대로 설명해 보세요» 는 어색합니다.
var SG_QUESTION_TEMPLATE =
  { comp: '학업역량',
    make: function (t) { return '「' + t + '」 이 물음을 스스로 던졌군요. 어떤 답을 찾았고, 무엇이 아직 안 풀렸나요?'; } };

// 스스로 품은 물음은 면접에서 제일 좋은 재료입니다. 그대로 되물어 봅니다.
var SG_WONDER_TEMPLATE =
  { comp: '학업역량',
    make: function (t) { return '「' + t + '」에 의문을 품었다고 적혀 있습니다. 무엇이 궁금했고, 어떻게 확인했나요?'; } };

// 「…임을 파악함」 처럼 알아낸 것은 그 자리에서 설명을 시킵니다.
var SG_CONCEPT_TEMPLATE =
  { comp: '학업역량',
    make: function (t) { return '「' + t + '」 — 이것을 어떻게 알게 되었는지, 근거와 함께 설명해 보세요.'; } };

// 세특에서 «탐구·실험» 으로 잡힌 것은 과정을 묻는 편이 낫습니다.
var SG_SESA_INQUIRY =
  { comp: '학업역량',
    make: function (t) { return '「' + t + '」은(는) 무엇이 궁금해서 시작했고, 결과를 어떻게 확인했나요?'; } };


// 행동특성에 따옴표로 묶인 것은 «칭찬하는 말» 이 아니라 활동 이름입니다.
// 「30분의 기적」에 «이라고 적어 주셨습니다» 를 붙이면 말이 안 됩니다.
var SG_HT_ACT_TEMPLATE =
  { comp: '공동체역량',
    make: function (t) { return '「' + t + '」 이야기가 있습니다. 어떻게 시작했고 본인이 맡은 몫은 무엇이었나요?'; } };

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
function sgBlankText(sectionKey, label) {
  if (sectionKey === 'haengteuk')
    return '선생님이 적어 주신 기록 가운데, 본인을 가장 잘 나타낸다고 생각하는 대목은 어디인가요?';
  if (label === SG_NO_SUBJECT)
    return '이 기록에서 가장 깊이 물어보고 싶은 것은 무엇인가요?';
  if (sectionKey === 'changche')
    return '「' + label + '」에서 본인이 가장 공들인 활동은 무엇이었나요?';
  return '「' + label + '」 수업에서 가장 기억에 남는 탐구나 활동은 무엇이었나요?';
}

// 묶음 하나(한 영역·한 학년·한 과목/갈래)에서 질문을 만듭니다.
//
// ⚠️ 여기서는 더 이상 과목을 찾지 않습니다. 자르는 일은 sgChunks() 가 미리 합니다.
//    한 곳에서만 자르는 편이 낫습니다. 예전에는 문장마다 과목을 다시 찾느라
//    과목 이름이 «문장 맨 앞» 에 없으면 그 과목이 통째로 새 버렸습니다.
//
// 반환: [{ text, competency, topic, subject, source, grade, area }]
function sgMakeQuestions(sectionKey, grade, sentences, groupLabel) {
  var made = [];
  var seen = {};
  var label = groupLabel || SG_NO_SUBJECT;
  var subject = (label === SG_NO_SUBJECT) ? '' : label;

  (sentences || []).forEach(function (sentence) {
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
      //    「…아는 대로 설명해 보세요」 와 「…무엇이 궁금해서 시작했고…」 가
      //    나란히 나오면 같은 말이 두 줄로 늘어서 고르기만 번거롭습니다.
      //    담은 뒤에 글자를 고칠 수 있으니 하나면 됩니다.
      var tpl;
      if (book) tpl = SG_BOOK_TEMPLATE;
      else if (sectionKey === 'haengteuk')
        tpl = (topic.kind === '제목') ? SG_HT_ACT_TEMPLATE : SG_TEMPLATES.haengteuk;
      else if (sectionKey === 'sesa') {
        // 물음이면 답을 묻고, 탐구·실험이면 과정을 묻고, 개념·제목이면 설명을 시킵니다
        if (topic.kind === '물음' || /[?？]\s*$/.test(topic.text)) tpl = SG_QUESTION_TEMPLATE;
        else if (topic.kind === '의문') tpl = SG_WONDER_TEMPLATE;
        else if (topic.kind === '개념') tpl = SG_CONCEPT_TEMPLATE;
        else if (topic.kind === '탐구' || topic.kind === '활동') tpl = SG_SESA_INQUIRY;
        else tpl = SG_TEMPLATES.sesa;
      }
      else tpl = SG_TEMPLATES[sectionKey];
      if (!tpl) return;

      var text = book ? tpl.make(book) : tpl.make(topic.text);
      if (seen[text]) return;
      seen[text] = true;
      made.push({
        text: text,
        competency: tpl.comp,
        topic: book ? book.title : topic.text,
        kind: book ? '제목' : topic.kind,
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
    text: sgBlankText(sectionKey, label),
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
    if (!line) return;

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

  (lines || []).forEach(function (raw) {
    var line = sgNorm(raw);
    if (!line) return;

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

    if (!best) { push(line); return; }
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
        var whole = sgRecordText(byGrade[g]);
        if (whole) wholes[g + '|' + sec.key] = whole;
      }
      sgChunks(sec.key, byGrade[g]).forEach(function (c) {
        // ⚠️ 길이 두 개를 따로 냅니다.
        //    record   — 선생님께 보여드리는 기록 전문. 한 글자도 버리지 않습니다
        //    sentences — 질문을 뽑으려고 다듬은 글. 토막은 버립니다
        var record = sgRecordText(c.lines);
        if (!record) return;

        var qs = sgDropContained(
          sgMakeQuestions(sec.key, g, sgSentences(c.lines), c.label));
        counts[sec.key] += qs.length;

        // 「기록 보고 직접 적기」 칸이 묶음마다 맨 위에 옵니다
        all.push(sgBlankItem(sec.key, g, c.label || SG_NO_SUBJECT, record, qs.length > 0));
        all = all.concat(qs);
      });
    });
  });

  return { questions: all, counts: counts, sections: sections, wholes: wholes };
}

// 브라우저 밖(시험)에서도 쓸 수 있게 내보냅니다.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sgSplitSections: sgSplitSections, sgItemsToLines: sgItemsToLines, sgCleanTopic: sgCleanTopic,
                     sgIsTableRow: sgIsTableRow, sgBookOf: sgBookOf, sgSubjectOf: sgSubjectOf, sgIsNoise: sgIsNoise, sgGradeOf: sgGradeOf, sgSplitGrades: sgSplitGrades,
                     sgSentences: sgSentences, sgTopics: sgTopics, sgTraits: sgTraits,
                     sgSplitAreas: sgSplitAreas, sgSplitSubjects: sgSplitSubjects,
                     sgChunks: sgChunks, sgRecordText: sgRecordText, sgBlankItem: sgBlankItem,
                     sgIsPageFurniture: sgIsPageFurniture, sgIsHeading: sgIsHeading,
                     sgIsCourseTable: sgIsCourseTable, sgScrubFurniture: sgScrubFurniture,
                     sgIsHeadCell: sgIsHeadCell, sgIsCellLabel: sgIsCellLabel,
                     sgMakeQuestions: sgMakeQuestions, sgBuild: sgBuild,
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
    lines = lines.concat(sgItemsToLines(content.items));
  }
  return lines;
}

// ══════════════ 화면 (교사) ══════════════

var sgFound = [];        // 뽑은 질문들
var sgWholes = {};       // 「학년|영역」 통째 원문 — 칸 나누기가 틀려도 볼 수 있게
var sgEdited = {};       // 선생님이 직접 고쳐 쓴 질문 { 번호: 글자 }
var sgPicked = {};       // { 번호: true } — 담을 것
// ⚠️ «모든 학년» 을 0 으로 두면 안 됩니다. 0 은 «학년 모름» 의 값입니다.
//    같은 값이라 「학년 모름」 단추가 늘 눌린 것처럼 보이고, 눌러도
//    걸러지지 않아 1학년·2학년 질문이 그대로 나왔습니다.
var sgGrade = null;      // null = 모든 학년, 0 = 학년 모름, 1~3 = 그 학년
var sgArea = '';         // '' = 모든 영역
var sgSubject = '';      // '' = 모든 과목·갈래
var sgMask = true;       // 개인정보 가림

function openSaenggibu() {
  sgFound = []; sgPicked = {}; sgEdited = {}; sgGrade = null; sgArea = ''; sgSubject = '';
  document.getElementById('sg-modal').style.display = 'flex';
  document.getElementById('sg-file').value = '';
  renderSaenggibu();
}

function closeSaenggibu() {
  document.getElementById('sg-modal').style.display = 'none';
  sgFound = []; sgPicked = {};   // 화면을 닫으면 읽은 내용도 버립니다
}

async function onSaenggibuFile(input) {
  var file = input.files && input.files[0];
  if (!file) return;

  var body = document.getElementById('sg-body');
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
    sgEdited = {};

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
function pickSgGrade(g) { sgGrade = (sgGrade === g) ? null : g; renderSaenggibu(); }
function pickSgArea(a) { sgArea = (sgArea === a) ? '' : a; sgSubject = ''; renderSaenggibu(); }
function pickSgSubject(x) { sgSubject = (sgSubject === x) ? '' : x; renderSaenggibu(); }

// 못 찾은 과목은 선생님이 직접 적습니다. 적기 시작하면 저절로 담깁니다.
// ⚠️ 여기서 목록을 다시 그리면 글자 한 자 칠 때마다 커서가 맨 뒤로 튑니다.
//    그래서 아래 단추와 이 줄의 겉모습만 손으로 고칩니다.
function setSgText(i, v) {
  sgEdited[i] = v;
  if (v.trim()) sgPicked[i] = true; else delete sgPicked[i];
  var row = document.querySelector('.sg-item[data-i="' + i + '"]');
  if (row) {
    row.classList.toggle('on', !!sgPicked[i]);
    var box = row.querySelector('input[type="checkbox"]');
    if (box) box.checked = !!sgPicked[i];
  }
  paintSgFoot();
}

function sgTextOf(i) {
  return (sgEdited[i] !== undefined) ? sgEdited[i] : sgFound[i].text;
}

function toggleSgPick(i) {
  if (sgPicked[i]) delete sgPicked[i]; else sgPicked[i] = true;
  renderSaenggibu();
}

function sgVisible() {
  return sgFound.map(function (q, i) { return { q: q, i: i }; })
    .filter(function (x) {
      if (sgGrade !== null && x.q.grade !== sgGrade) return false;
      if (sgArea && x.q.area !== sgArea) return false;
      // 「(과목 모름)」도 골라 볼 수 있어야 합니다. 빈 값이면 거르기가 안 먹습니다.
      if (sgSubject && (x.q.subject || SG_NO_SUBJECT) !== sgSubject) return false;
      return true;
    });
}

function renderSaenggibu() {
  var body = document.getElementById('sg-body');
  var foot = document.getElementById('sg-foot');

  if (!sgFound.length) {
    body.innerHTML =
      '<p class="sg-note">나이스에서 뽑은 <b>생기부 PDF</b> 를 고르세요.<br>' +
      '<b>파일은 이 브라우저 안에서만 읽고 바로 버립니다.</b> 서버에 올라가지 않습니다.</p>';
    foot.hidden = true;
    return;
  }

  // 걸러 보기 — 학년·영역
  var grades = {};
  sgFound.forEach(function (q) { grades[q.grade] = (grades[q.grade] || 0) + 1; });
  var chips = '<div class="chat-picks cls-row">' +
    [1, 2, 3, 0].filter(function (g) { return grades[g]; }).map(function (g) {
      return '<button class="chat-pick cls" aria-pressed="' + (sgGrade === g) + '"' +
             ' onclick="pickSgGrade(' + g + ')">' + (g ? g + '학년' : '학년 모름') +
             '<span class="n">' + grades[g] + '</span></button>';
    }).join('') + '</div>' +
    '<div class="chat-picks cls-row">' + SG_SECTIONS.map(function (sec) {
      var n = sgFound.filter(function (q) { return q.area === sec.key; }).length;
      if (!n) return '';
      return '<button class="chat-pick cls" aria-pressed="' + (sgArea === sec.key) + '"' +
             ' onclick="pickSgArea(\'' + sec.key + '\')">' + sec.title +
             '<span class="n">' + n + '</span></button>';
    }).join('') +
    '<button class="chat-pick" aria-pressed="' + sgMask + '" onclick="toggleSgMask()">개인정보 가림</button>' +
    '</div>';

  // 세특은 과목이, 창체는 갈래(자율·동아리·진로)가 많아 한 번에 훑기 어렵습니다.
  // 영역을 고르면 그 안에서 한 번 더 추립니다.
  if (sgArea) {
    var subs = {};
    sgFound.forEach(function (q) {
      if (q.area !== sgArea) return;
      if (sgGrade !== null && q.grade !== sgGrade) return;
      var k = q.subject || SG_NO_SUBJECT;
      subs[k] = (subs[k] || 0) + 1;
    });
    var keys = Object.keys(subs).sort();
    if (keys.length > 1) {
      chips += '<div class="chat-picks cls-row">' + keys.map(function (k) {
        return '<button class="chat-pick cls" aria-pressed="' + (sgSubject === k) + '"' +
               ' onclick="pickSgSubject(\'' + k.replace(/'/g, "\\'") + '\')">' + esc(k) +
               '<span class="n">' + subs[k] + '</span></button>';
      }).join('') + '</div>';
    }
  }

  var groups = sgGroups(sgVisible());
  // 영역·학년이 바뀌는 자리마다 «통째 원문» 을 한 번 끼워 넣습니다
  var seenWhole = {}, html = '';
  groups.forEach(function (g) {
    var wk = g.grade + '|' + g.area;
    if (!seenWhole[wk]) { seenWhole[wk] = true; html += sgWholeHTML(g, wk); }
    html += sgGroupHTML(g);
  });
  body.innerHTML = chips + (groups.length
    ? html
    : '<p class="sg-note">그 조건에 맞는 질문이 없습니다.</p>');

  paintSgFoot();
}

// 학년 · 과목(또는 갈래) 으로 묶습니다.
// 묶음마다 «기록 보고 직접 적기» 칸이 맨 위, 뽑힌 질문이 그 아래입니다.
function sgGroups(list) {
  var order = [], by = {};
  list.forEach(function (x) {
    var k = x.q.grade + '|' + x.q.area + '|' + (x.q.subject || SG_NO_SUBJECT);
    if (!by[k]) {
      by[k] = { grade: x.q.grade, area: x.q.area, label: x.q.subject || SG_NO_SUBJECT,
                blanks: [], items: [] };
      order.push(by[k]);
    }
    (x.q.blank ? by[k].blanks : by[k].items).push(x);
  });
  return order;
}

function sgSectionTitle(key) {
  var hit = SG_SECTIONS.filter(function (s) { return s.key === key; })[0];
  return hit ? hit.title : '';
}

// ⚠️ 마지막 안전판 — 칸(갈래·과목) 나누기가 어긋나도 원문은 다 보이게 합니다.
//    나이스 판이 조금만 달라져도 칸이 어긋나는데, 그때마다 선생님이
//    «내용이 잘렸다» 고 느끼셔야 할 까닭이 없습니다. 접어 두고, 펴면 다 나옵니다.
function sgWholeHTML(g, wk) {
  var whole = sgWholes[wk];
  if (!whole) return '';
  var title = (g.grade ? g.grade + '학년' : '학년 모름') + ' ' + sgSectionTitle(g.area);
  return '<details class="sg-whole">' +
    '<summary>' + esc(title) + ' <b>원문 전체</b>' +
      '<span class="n">' + String(whole.length).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '자</span>' +
    '</summary>' +
    '<div class="sg-wholetext">' + esc(sgMaskText(whole)) + '</div>' +
    '</details>';
}

function sgGroupHTML(g) {
  var head = (g.grade ? g.grade + '학년' : '학년 모름') + ' · ' + esc(g.label);
  // 행특은 묶음 이름이 곧 영역 이름이라 두 번 쓰지 않습니다
  if (g.label !== sgSectionTitle(g.area)) head += ' <span class="sg-gsec">' + esc(sgSectionTitle(g.area)) + '</span>';

  return '<section class="sg-group">' +
    '<p class="sg-gtitle">' + head +
      '<span class="n">뽑은 질문 ' + g.items.length + '개</span></p>' +
    '<div class="sg-list">' +
      g.blanks.map(sgBlankHTML).join('') +
      g.items.map(sgItemHTML).join('') +
    '</div></section>';
}

// 기록을 통째로 펼쳐 놓고 그 자리에서 직접 적는 칸
function sgBlankHTML(x) {
  var note = x.q.lonely
    ? '<b class="sg-warn">여기서는 탐구 제목을 못 찾았습니다 — 기록을 보고 직접 적어 주세요</b>'
    : '<b class="sg-own">기록을 보고 직접 물으셔도 됩니다</b>';
  // 글자 수를 적어 둡니다. 잘렸는지 아닌지 선생님이 바로 보실 수 있게.
  note += ' <span class="sg-len">· 기록 ' +
          String((x.q.source || '').length).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '자</span>';
  return '<div class="sg-item blank' + (sgPicked[x.i] ? ' on' : '') + '" data-i="' + x.i + '">' +
    '<input type="checkbox"' + (sgPicked[x.i] ? ' checked' : '') +
      ' onchange="toggleSgPick(' + x.i + ')" title="이 질문 담기">' +
    '<span class="sg-q">' +
      '<span class="sg-meta">' + note + '</span>' +
      '<input class="sg-write" type="text" value="' + esc(sgTextOf(x.i)) + '"' +
        ' oninput="setSgText(' + x.i + ', this.value)" placeholder="여기에 낼 질문을 적으세요">' +
      '<span class="sg-src full">' + esc(sgMaskText(x.q.source)) + '</span>' +
    '</span></div>';
}

function sgItemHTML(x) {
  return '<label class="sg-item' + (sgPicked[x.i] ? ' on' : '') + '">' +
    '<input type="checkbox"' + (sgPicked[x.i] ? ' checked' : '') +
      ' onchange="toggleSgPick(' + x.i + ')">' +
    '<span class="sg-q">' +
      '<span class="sg-qtext">' + esc(x.q.text) + '</span>' +
      '<span class="sg-meta">' + esc(x.q.competency) + '</span>' +
      '<span class="sg-src">' + esc(sgMaskText(x.q.source)) + '</span>' +
    '</span></label>';
}

// 글자를 고칠 때마다 목록을 통째로 다시 그리면 커서가 튑니다.
// 아래 단추만 고쳐 그립니다.
function paintSgFoot() {
  var foot = document.getElementById('sg-foot');
  var btn = document.getElementById('sg-add');
  if (!foot || !btn) return;
  var n = Object.keys(sgPicked).length;
  foot.hidden = !sgFound.length;
  btn.disabled = (n === 0);
  btn.textContent = n ? n + '개를 「낼 질문」에 담기' : '담을 질문을 고르세요';
}

// 고른 질문을 면접 준비 화면의 «낼 질문» 으로 옮깁니다.
// 여기서부터는 평범한 질문 글자일 뿐입니다. 생기부 원문은 따라가지 않습니다.
function addSaenggibuPicks() {
  var picked = Object.keys(sgPicked).map(Number).sort(function (a, b) { return a - b; });
  if (!picked.length) return;

  picked.forEach(function (i) {
    var q = sgFound[i];
    var text = sgTextOf(i).trim();
    if (!text) return;
    midQuestions.push({ text: text, competency: q.competency });
  });
  renderQuestions();
  closeSaenggibu();
  toast(picked.length + '개를 「낼 질문」에 담았습니다. 글자는 고쳐 쓰셔도 됩니다.', 'ok');
}
