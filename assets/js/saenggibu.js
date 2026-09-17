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
  '인적', '학적사항', '출결상황', '수상경력', '자격증', '진로희망',
  '독서활동상황', '봉사활동실적', '학교폭력'
];

// 창의적 체험활동 안의 갈래
var SG_AREAS = ['자율활동', '동아리활동', '봉사활동', '진로활동'];

function sgNorm(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
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
    var started = null;
    SG_SECTIONS.forEach(function (sec) {
      if (started) return;
      sec.heads.forEach(function (h) {
        if (!started && line.replace(/\s/g, '').indexOf(h.replace(/\s/g, '')) > -1) started = sec.key;
      });
    });
    if (started) { cur = started; return; }   // 제목 줄 자체는 담지 않습니다

    // 우리가 안 보는 영역이 시작되면 끊습니다
    var stop = SG_STOPS.some(function (w) { return line.indexOf(w) > -1 && line.length < 40; });
    if (stop) { cur = null; return; }

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
// 숫자와 기호가 많으면 표입니다. 여기서 질문을 뽑을 수는 없습니다.
function sgIsTableRow(line) {
  var t = sgNorm(line);
  if (!t) return true;
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
  (lines || []).forEach(function (line) {
    var g = sgGradeOf(line, bareOk);
    if (g) {
      cur = g;
      // 「2학년」 「[2학년]」 「2」 처럼 표시만 있는 줄이면 버립니다.
      if (sgNorm(line).replace(/(?:제)?[1-3]\s*학\s*년/, '')
            .replace(/[0-9()\[\]|:\s]/g, '') === '') return;
    }
    byGrade[cur].push(line);
  });
  return byGrade;
}

// 문장으로 쪼갭니다.
// 생기부는 「~함.」 「~음.」 으로 끝나는 문장이 이어 붙어 있습니다.
function sgSentences(lines) {
  // ⚠️ 여기가 제일 중요합니다.
  //    나이스 PDF 는 칸 너비에 맞춰 «낱말 가운데서» 줄을 끊습니다.
  //      '…추진력이 뛰' / '어나며 수업에…'
  //    줄을 띄어쓰기로 이으면 «뛰 어나며» 가 되어 말이 깨집니다.
  //    그래서 앞 줄이 문장부호로 끝났을 때만 띄우고, 아니면 그냥 붙입니다.
  var kept = (lines || []).filter(function (l) {
    return !sgIsNoise(l) && !sgIsTableRow(l);
  });

  var text = '';
  kept.forEach(function (line, i) {
    var t = sgNorm(line);
    if (!t) return;
    if (i > 0) text += /[.!?]$/.test(text) ? ' ' : '';
    text += t;
  });

  // 갈래 이름과 시간(자율활동 64), 쪽번호를 걷어냅니다
  text = text.replace(/\((?:\s*\d+\s*시간\s*)\)/g, ' ')
             .replace(new RegExp('(' + SG_AREAS.join('|') + ')\\s*\\d*\\s*', 'g'), ' ')
             .replace(/\s*-\s*\d+\s*-\s*/g, ' ')
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
function sgItemsToLines(items) {
  var rows = [];
  (items || []).forEach(function (it) {
    var text = it.str;
    if (!text || !text.trim()) return;
    var y = Math.round(it.transform[5]);
    var size = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10;
    rows.push({ y: y, x: it.transform[4], w: it.width || 0, size: size, text: text });
  });

  // 세로 위치가 비슷하면 한 줄로 봅니다
  var lines = [];
  rows.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
  rows.forEach(function (r) {
    var line = lines.length ? lines[lines.length - 1] : null;
    if (!line || Math.abs(line.y - r.y) > 3) { line = { y: r.y, parts: [] }; lines.push(line); }
    line.parts.push(r);
  });

  return lines.map(function (line) {
    var parts = line.parts.sort(function (a, b) { return a.x - b.x; });
    var out = '';
    parts.forEach(function (p, i) {
      if (i > 0) {
        var prev = parts[i - 1];
        var gap = p.x - (prev.x + prev.w);
        // 글자 크기의 1/4 보다 넓게 벌어져 있으면 진짜 띄어쓰기입니다
        if (gap > p.size * 0.25) out += ' ';
      }
      out += p.text;
    });
    return out;
  });
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

// 한 영역·한 학년의 문장들에서 질문을 만듭니다.
// 반환: [{ text, competency, topic, subject, source, grade, area }]
function sgMakeQuestions(sectionKey, grade, sentences) {
  var made = [];
  var seen = {};

  var subject = '';         // 과목은 한 번 나오면 그 뒤 문장까지 이어집니다
  var seenSubjects = [];    // 이 학년에 나온 과목들
  var gotSubjects = {};     // 그 중 질문이 하나라도 나온 과목
  var subjectText = {};     // 과목마다 적힌 기록 전문 (못 찾은 과목에 보여줍니다)

  (sentences || []).forEach(function (sentence) {
    if (sectionKey === 'sesa') {
      var found = sgSubjectOf(sentence);
      if (found) {
        subject = found;
        if (seenSubjects.indexOf(found) === -1) seenSubjects.push(found);
      }
      if (subject) subjectText[subject] = (subjectText[subject] || '') + ' ' + sentence;
    }
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
      if (subject) gotSubjects[subject] = true;
    });
  });

  // ⚠️ 서술만 있고 따옴표도 «주제로» 도 없는 과목은 한 개도 안 나왔습니다.
  //    선생님은 «3학년 과목이 다 안 나온다» 고 느끼십니다.
  //    그런 과목은 «기록 전문» 을 그대로 보여주고, 선생님이 직접 질문을 적게 합니다.
  //    기계가 못 읽었다고 그 과목을 통째로 빼 버리면 안 됩니다.
  seenSubjects.forEach(function (subj) {
    if (gotSubjects[subj]) return;
    var text = '「' + subj + '」 수업에서 가장 기억에 남는 탐구나 활동은 무엇이었나요?';
    if (seen[text]) return;
    seen[text] = true;
    made.push({
      text: text, competency: '학업역량', topic: subj, subject: subj,
      blank: true,                                   // 직접 적는 칸으로 보여줍니다
      source: sgNorm(subjectText[subj] || ''),       // 기록을 통째로
      grade: grade, area: sectionKey
    });
  });

  return made;
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

// 줄 뭉치 하나를 통째로 받아 질문 목록을 돌려줍니다.
function sgBuild(lines) {
  var sections = sgSplitSections(lines);
  var all = [];
  var counts = {};

  SG_SECTIONS.forEach(function (sec) {
    var byGrade = sgSplitGrades(sections[sec.key], sec.key);
    counts[sec.key] = 0;
    [1, 2, 3, 0].forEach(function (g) {
      var sentences = sgSentences(byGrade[g]);
      if (!sentences.length) return;
      var qs = sgDropContained(sgMakeQuestions(sec.key, g, sentences));
      counts[sec.key] += qs.length;
      all = all.concat(qs);
    });
  });

  return { questions: all, counts: counts, sections: sections };
}

// 브라우저 밖(시험)에서도 쓸 수 있게 내보냅니다.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sgSplitSections: sgSplitSections, sgItemsToLines: sgItemsToLines, sgCleanTopic: sgCleanTopic,
                     sgIsTableRow: sgIsTableRow, sgBookOf: sgBookOf, sgSubjectOf: sgSubjectOf, sgIsNoise: sgIsNoise, sgGradeOf: sgGradeOf, sgSplitGrades: sgSplitGrades,
                     sgSentences: sgSentences, sgTopics: sgTopics, sgTraits: sgTraits,
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
var sgEdited = {};       // 선생님이 직접 고쳐 쓴 질문 { 번호: 글자 }
var sgPicked = {};       // { 번호: true } — 담을 것
// ⚠️ «모든 학년» 을 0 으로 두면 안 됩니다. 0 은 «학년 모름» 의 값입니다.
//    같은 값이라 「학년 모름」 단추가 늘 눌린 것처럼 보이고, 눌러도
//    걸러지지 않아 1학년·2학년 질문이 그대로 나왔습니다.
var sgGrade = null;      // null = 모든 학년, 0 = 학년 모름, 1~3 = 그 학년
var sgArea = '';         // '' = 모든 영역
var sgSubject = '';      // '' = 모든 과목 (세특일 때만 씁니다)
var SG_NO_SUBJECT = '(과목 모름)';
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

  // 세특은 과목이 많아 한 번에 훑기 어렵습니다. 과목으로 한 번 더 추립니다.
  if (sgArea === 'sesa') {
    var subs = {};
    sgFound.forEach(function (q) {
      if (q.area !== 'sesa') return;
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

  var list = sgVisible();
  body.innerHTML = chips + (list.length
    ? '<div class="sg-list">' + list.map(function (x) {
        var meta = (x.q.grade ? x.q.grade + '학년 · ' : '') +
                   (x.q.subject ? esc(x.q.subject) + ' · ' : '') + esc(x.q.competency);

        // 탐구 제목을 못 찾은 과목 — 기록을 통째로 보여주고 직접 적게 합니다
        if (x.q.blank) {
          return '<div class="sg-item blank' + (sgPicked[x.i] ? ' on' : '') +
                 '" data-i="' + x.i + '">' +
            '<input type="checkbox"' + (sgPicked[x.i] ? ' checked' : '') +
              ' onchange="toggleSgPick(' + x.i + ')" title="이 질문 담기">' +
            '<span class="sg-q">' +
              '<span class="sg-meta">' + meta +
                ' <b class="sg-warn">탐구 제목을 못 찾았습니다 — 아래 기록을 보고 직접 적어 주세요</b></span>' +
              '<input class="sg-write" type="text" value="' + esc(sgTextOf(x.i)) + '"' +
                ' oninput="setSgText(' + x.i + ', this.value)" placeholder="이 과목에 낼 질문을 적으세요">' +
              '<span class="sg-src full">' + esc(sgMaskText(x.q.source)) + '</span>' +
            '</span></div>';
        }

        return '<label class="sg-item' + (sgPicked[x.i] ? ' on' : '') + '">' +
          '<input type="checkbox"' + (sgPicked[x.i] ? ' checked' : '') +
            ' onchange="toggleSgPick(' + x.i + ')">' +
          '<span class="sg-q">' +
            '<span class="sg-qtext">' + esc(x.q.text) + '</span>' +
            '<span class="sg-meta">' + meta + '</span>' +
            '<span class="sg-src">' + esc(sgMaskText(x.q.source)) + '</span>' +
          '</span></label>';
      }).join('') + '</div>'
    : '<p class="sg-note">그 조건에 맞는 질문이 없습니다.</p>');

  paintSgFoot();
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
