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

console.log('\n' + (실패 ? '✗ ' + 실패 + '군데 안 맞습니다' : '✓ 모두 맞습니다'));
process.exit(실패 ? 1 : 0);
