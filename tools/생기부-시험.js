// 생기부에서 질문 뽑기 — 자르기·질문 만들기 시험
//
// PDF 없이 돌아갑니다. 글자를 꺼내는 일(pdf.js)은 브라우저 몫이고,
// 여기서는 «꺼낸 줄» 을 넣어 잘 잘리는지, 질문이 제대로 나오는지 봅니다.
//
//   node tools/생기부-시험.js

var sg = require('../assets/js/saenggibu.js');

// 나이스에서 뽑은 PDF 는 표라서 글자가 이렇게 흐트러져 나옵니다.
// 쪽번호, (00시간) 표시, 칸 나눔 세로줄이 줄 사이에 섞입니다.
var LINES = [
  '학교생활기록부 II',
  '1. 인적·학적사항',
  '성명: ○○○  성별: 남  주민등록번호: 000000-0000000',
  '2. 출결상황',
  '학년 수업일수 결석일수',
  '- 3 -',
  '5. 창의적 체험활동상황',
  '학년 영역 시간 특기사항',
  '1학년',
  '자율활동 (34시간)',
  '학급 회장으로서 학급 규칙을 다시 정하는 과정을 이끎. 「우리 반 생활 협약」을 주제로',
  '학급 회의를 세 차례 진행하여 합의안을 도출함. 반대 의견을 가진 학생들을 따로 만나',
  '조율하는 모습이 인상적임.',
  '동아리활동 (26시간)',
  '(과학탐구부) 「미세먼지와 식물 생장」에 대해 탐구를 진행함. 대조군을 두고 4주간',
  '관찰하여 자료를 정리함.',
  '- 4 -',
  '2학년',
  '진로활동 (21시간)',
  '진로 특강을 듣고 생명공학 분야에 관심을 가지게 됨. 「유전자 가위 기술의 명암」을',
  '주제로 보고서를 작성하여 발표함.',
  '봉사활동 (12시간)',
  '지역 아동센터에서 학습 도우미로 활동함.',
  '6. 교과학습발달상황',
  '세부능력 및 특기사항',
  '1학년',
  '[통합과학] 효소의 작용 단원에서 「온도와 효소 활성의 관계」 실험을 수행함.',
  '온도를 5단계로 나누어 반응 속도를 측정하고 그래프로 나타냄.',
  '2학년',
  '[생명과학Ⅰ] 「삼투압과 세포의 부피 변화」에 대해 탐구를 진행하였으며,',
  '적혈구를 이용한 관찰 결과를 스스로 해석하여 발표함.',
  '[화학Ⅰ] 산-염기 중화 반응을 주제로 실험을 설계함.',
  '7. 독서활동상황',
  '1학년 (공통) 「이기적 유전자」(리처드 도킨스)',
  '8. 행동특성 및 종합의견',
  '1학년',
  '맡은 일을 끝까지 해내는 책임감이 뛰어남. 친구들의 이야기를 먼저 듣고 정리하는',
  '의사소통 능력이 돋보임.',
  '2학년',
  '탐구심이 강하여 수업 중 나온 물음을 스스로 찾아보고 정리하는 모습을 자주 보임.'
];

function 제목(s) { console.log('\n── ' + s + ' ──'); }

var 실패 = 0;
function 확인(무엇, 참인가, 덧붙임) {
  console.log((참인가 ? '  ✓ ' : '  ✗ ') + 무엇 + (덧붙임 ? '  → ' + 덧붙임 : ''));
  if (!참인가) 실패++;
}

// ① 영역 자르기
제목('영역 자르기');
var sec = sg.sgSplitSections(LINES);
확인('창의적 체험활동만 골라냈는가', sec.changche.some(function (l) { return l.indexOf('학급 회장') > -1; }));
확인('인적사항은 안 들어왔는가', !sec.changche.concat(sec.sesa, sec.haengteuk)
     .some(function (l) { return l.indexOf('주민등록번호') > -1; }));
확인('독서활동은 세특에 안 섞였는가', !sec.sesa.some(function (l) { return l.indexOf('이기적 유전자') > -1; }));
확인('행동특성을 골라냈는가', sec.haengteuk.some(function (l) { return l.indexOf('책임감') > -1; }));

// ② 학년 자르기
제목('학년 자르기');
var g = sg.sgSplitGrades(sec.changche);
확인('1학년에 학급 회장 이야기', g[1].some(function (l) { return l.indexOf('학급 회장') > -1; }));
확인('2학년에 진로 특강 이야기', g[2].some(function (l) { return l.indexOf('진로 특강') > -1; }));
확인('「1학년」만 적힌 줄은 버렸는가', !g[1].some(function (l) { return l.trim() === '1학년'; }));

// ③ 문장 쪼개기
제목('문장 쪼개기');
var sentences = sg.sgSentences(g[1]);
console.log('  1학년 창체 문장 ' + sentences.length + '개');
sentences.forEach(function (s) { console.log('    · ' + s); });
확인('(34시간) 같은 표시는 지웠는가', !sentences.some(function (s) { return s.indexOf('시간)') > -1; }));
확인('쪽번호(- 4 -)는 지웠는가', !sentences.some(function (s) { return /-\s*\d+\s*-/.test(s); }));

// ④ 이야깃거리 찾기
제목('이야깃거리 찾기');
[['「우리 반 생활 협약」을 주제로 학급 회의를 세 차례 진행하여 합의안을 도출함.', '우리 반 생활 협약'],
 ['「미세먼지와 식물 생장」에 대해 탐구를 진행함.', '미세먼지와 식물 생장'],
 ['산-염기 중화 반응을 주제로 실험을 설계함.', '산-염기 중화 반응']
].forEach(function (pair) {
  var got = sg.sgTopics(pair[0]).map(function (t) { return t.text; });
  확인('「' + pair[1] + '」을 찾았는가', got.indexOf(pair[1]) > -1, got.join(' / ') || '(못 찾음)');
});

제목('행동특성에서 칭찬하는 말 찾기');
[['맡은 일을 끝까지 해내는 책임감이 뛰어남.', '책임감'],
 ['의사소통 능력이 돋보임.', '의사소통 능력'],
 ['탐구심이 강하여 수업 중 나온 물음을 스스로 찾아봄.', '탐구심']
].forEach(function (pair) {
  var got = sg.sgTraits(pair[0]).map(function (t) { return t.text; });
  확인('「' + pair[1] + '」을 찾았는가', got.indexOf(pair[1]) > -1, got.join(' / ') || '(못 찾음)');
});

// ⑤ 통째로
제목('통째로 돌려 보기');
var r = sg.sgBuild(LINES);
console.log('  창체 ' + r.counts.changche + '개 · 세특 ' + r.counts.sesa +
            '개 · 행특 ' + r.counts.haengteuk + '개  (모두 ' + r.questions.length + '개)');
확인('세 영역에서 모두 질문이 나왔는가',
     r.counts.changche > 0 && r.counts.sesa > 0 && r.counts.haengteuk > 0);
확인('학년이 붙어 있는가', r.questions.every(function (q) { return q.grade >= 0 && q.grade <= 3; }));
확인('원문이 같이 있는가', r.questions.every(function (q) { return q.source && q.source.length > 10; }));
확인('같은 질문이 겹치지 않는가',
     new Set(r.questions.map(function (q) { return q.text; })).size === r.questions.length);

제목('나온 질문 (영역·학년별)');
['changche', 'sesa', 'haengteuk'].forEach(function (k) {
  var title = sg.SG_SECTIONS.filter(function (s) { return s.key === k; })[0].title;
  [1, 2, 3, 0].forEach(function (gr) {
    var qs = r.questions.filter(function (q) { return q.area === k && q.grade === gr; });
    if (!qs.length) return;
    console.log('\n  [' + title + ' · ' + (gr ? gr + '학년' : '학년 모름') + ']');
    qs.forEach(function (q) { console.log('    (' + q.competency + ') ' + q.text); });
  });
});

// ══ 글자 조각 잇기 ══
// pdf.js 는 글자를 낱개로 돌려줄 때가 많습니다.
// 이 층을 안 시험해서 「히 트 스 마 트 패 치」 가 그대로 나갔습니다.
제목('pdf.js 글자 조각 잇기');

// 한 낱말을 낱글자로 쪼갠 뒤, 띄어쓰기 자리에만 틈을 벌려 흉내 냅니다.
function 조각내기(text, y) {
  var size = 10, x = 50, items = [];
  text.split('').forEach(function (ch) {
    if (ch === ' ') { x += size * 0.6; return; }        // 띄어쓰기 = 넓은 틈
    items.push({ str: ch, width: size, transform: [size, 0, 0, size, x, y] });
    x += size + 0.4;                                    // 낱글자 사이 = 아주 좁은 틈
  });
  return items;
}

var 조각 = 조각내기('히트스마트패치 활동을 통해', 700)
       .concat(조각내기('과학탐구실험: 산성화된 토양', 686));
var 이은줄 = sg.sgItemsToLines(조각);
console.log('  나온 줄:');
이은줄.forEach(function (l) { console.log('    · ' + l); });
확인('낱글자가 「히 트 스」로 벌어지지 않는가', 이은줄[0].indexOf('히트스마트패치') > -1, 이은줄[0]);
확인('진짜 띄어쓰기는 살아 있는가', 이은줄[0].indexOf('패치 활동') > -1);
확인('두 줄이 섞이지 않았는가', 이은줄.length === 2);
확인('아래 줄도 제대로', 이은줄[1].indexOf('과학탐구실험') > -1, 이은줄[1]);

// ══ 학년 가르기 ══
제목('학년 — 세특의 「1」은 학기이지 학년이 아닙니다');
var 세특줄 = ['[1학년]','학기 교과 과목 학점수','1','정보: 과학탐구실험 수업에서 「산성화된 토양」을 주제로 실험함.',
             '2','수학: 「함수의 그래프」를 탐구함.','[2학년]','2','물리학Ⅰ: 「등가속도 운동」을 실험함.'];
var 갈린것 = sg.sgSplitGrades(세특줄, 'sesa');
확인('과학탐구실험이 1학년인가',
     갈린것[1].join(' ').indexOf('과학탐구실험') > -1,
     갈린것[2].join(' ').indexOf('과학탐구실험') > -1 ? '2학년으로 갔습니다' : '');
확인('「함수의 그래프」도 1학년인가 (학기 「2」에 속으면 안 됩니다)',
     갈린것[1].join(' ').indexOf('함수의 그래프') > -1);
확인('등가속도 운동은 2학년인가', 갈린것[2].join(' ').indexOf('등가속도') > -1);

// 창체·행특 표에서는 숫자 한 자가 학년입니다
var 창체줄 = ['1','자율활동 64','학급 회장을 맡음.','2','진로활동 21','진로 특강을 들음.'];
var 창체갈림 = sg.sgSplitGrades(창체줄, 'changche');
확인('창체는 숫자 한 자를 학년으로 보는가',
     창체갈림[1].join(' ').indexOf('학급 회장') > -1 && 창체갈림[2].join(' ').indexOf('진로 특강') > -1);

// ══ 한 이야깃거리에 질문 하나 ══
제목('한 이야깃거리에 질문 하나만');
var 하나 = sg.sgMakeQuestions('sesa', 1, ['「삼투압과 세포의 부피 변화」에 대해 탐구를 진행함.']);
확인('두 줄로 늘어서지 않는가', 하나.length === 1, 하나.length + '개: ' + 하나.map(function(q){return q.text.slice(0,20);}).join(' | '));
확인('탐구는 과정을 묻는가', 하나.length === 1 && 하나[0].text.indexOf('무엇이 궁금해서') > -1, 하나[0] && 하나[0].text);

var 설명 = sg.sgMakeQuestions('sesa', 1, ['정보: 「자료구조」 단원을 배움.']);
확인('개념은 설명을 시키는가', 설명.length === 1 && 설명[0].text.indexOf('아는 대로 설명') > -1, 설명[0] && 설명[0].text);

console.log('\n' + (실패 ? '✗ ' + 실패 + '군데 안 맞습니다' : '✓ 모두 맞습니다'));
process.exit(실패 ? 1 : 0);
