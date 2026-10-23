// 받아 적기 — 말하는 순간 바로 검은 글로, 굳은 글은 지우지 않기 (2026-10-23 선생님 말씀)
//
// 선생님 말씀: «학생이 말하는 그대로 적어 주는 게 좋은 게, 본인이 어떻게 말했는지 보여 주는 거라서 틀린 것도 다 적혀 있는 게 좋아.
//              최소한으로 없어지거나 텍스트 변환 손실 없게.»
//
// 크롬 음성 인식은 말하는 동안 «아직 다 못 알아들은 문장» 을 계속 고쳐 보내고(예전 화면의 회색), 말이 잠깐 끊기면 확정합니다.
// ⚠️ 예전(~2026-10-22)엔 확정된 글만 남겨서, 확정하며 크롬이 단어를 바꾸거나 **빼 버리면** 말한 것이 사라졌습니다.
// 🚨 2026-10-23 첫 판(.1)에서 크게 틀렸습니다 — 크롬이 보내는 «결과 칸» 마다 따로 견주고 한 번 적은 것은 절대 안 고쳤더니,
//    실제 한국어 크롬에서는 ① 아직 덜 굳은 문장을 **여러 칸으로 나눠** 보내고 낱말이 칸 사이를 옮겨 다녀서(«손» → «손실 을» → «손실을»)
//    같은 말이 옮길 때마다 또 붙었고, ② 맨 처음 짐작이 «받 아 적 기» 처럼 한 글자씩 띄어 와서 그 모양이 그대로 남았습니다.
//    선생님이 제가 쓴 글을 소리 내 읽어 보시고 «받 아 적 기 손 적기 손실 을 손 실을 손실 손실을…» 이 나온 화면을 보내 주셨습니다.
//    가짜 받아 적기(시험)는 한 칸에 낱말이 깔끔히 늘어나기만 해서 이걸 못 잡았습니다.
//
// 지금 방식
//   · 아직 확정 안 된 칸들은 **한 문장으로 이어 붙여** 봅니다(칸 사이를 옮겨 다녀도 같은 문장) — 겹침이 없어집니다
//   · 그 문장 가운데 이미 굳힌 데 뒤의 «꼬리» 는 화면에 **바로 검은 글로** 보여 주되, 아직 바뀔 수 있습니다(크롬이 고치면 따라 고침)
//   · 꼬리 앞부분이 **두 번 잇달아 같은 글자로** 오면 그 낱말까지 굳힙니다 → 굳은 글은 다시는 안 지웁니다(크롬이 나중에 빼 버려도 남음)
//   · 크롬이 문장을 확정하면, 듣기가 멈추면, 질문을 넘기면(저장할 때) 보이던 꼬리까지 **모두** 굳힙니다 — 보였던 말은 잃지 않습니다
//   · 굳힌 데가 크롬의 새 글 어디에 해당하는지는 띄어쓰기를 빼고 글자로 찾습니다(크롬이 «화학 공학» → «화학공학과에» 처럼 띄어쓰기를 자주 바꿔서)
//       ① 새 글이 굳힌 글로 시작하면 그 뒤가 꼬리 ② 아니면 굳힌 글의 끝 3~16글자를 새 글에서 찾아 그 뒤 ③ 못 찾으면 앞에서부터 같은 데까지 뒤
// 감수할 점: 두 번 잇달아 같게 온 잘못 들은 말은 남습니다(틀린 것도 그대로 — 학생이 어떻게 말했는지), 드물게 한두 글자가 겹칠 수 있습니다,
//            크롬이 처음부터 안 보낸 말(«음 · 어» 말버릇 등)은 못 남깁니다 — 그건 녹음 파일로
// 학생 앱(interview.js 의 모의 면접 받아 적기)과 선생님 화면(listen.js)이 같이 씁니다.

function sttStrip(t) { return String(t || '').replace(/\s+/g, ''); }

// 띄어쓰기를 뺀 글에서 n 번째 글자부터의 원래 글(띄어쓰기 있는)
function sttCutFrom(text, strippedAt) {
  var seen = 0;
  for (var i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    if (seen === strippedAt) return text.slice(i);
    seen++;
  }
  return '';
}

// 굳힌 글(seen, 띄어쓰기 뺀 것)이 새 글(w) 어디까지에 해당하는지 — w 의 그 자리 뒤가 꼬리입니다
function sttAlign(seen, w) {
  if (!seen) return 0;
  if (w.indexOf(seen) === 0) return seen.length;                       // ① 이어서
  for (var k = Math.min(seen.length, 16); k >= 3; k--) {               // ② 끝 몇 글자로 찾기
    var at = w.lastIndexOf(seen.slice(-k));
    if (at > -1) return at + k;
  }
  var same = 0;                                                         // ③ 앞에서부터 같은 데까지(뒤는 크롬이 갈아 끼운 말 — 새 말로)
  while (same < seen.length && same < w.length && seen[same] === w[same]) same++;
  return same;
}

// 듣기 한 번(start ~ end) 동안의 상태
function sttKeepNew() { return { start: 0, seen: '', prev: '', live: '', lastDone: '' }; }

// 크롬의 onresult 한 번을 받아 { add: 굳혀서 붙일 글, live: 아직 안 굳은 꼬리(화면에만) } 를 돌려줍니다
function sttKeepResult(st, ev) {
  var res = ev.results, raw = '', allFinal = true;
  // 이미 끝낸 칸 번호를 다시 쓰면(크롬은 안 그러지만 다른 브라우저 · 시험 흉내) 그 칸부터 새 말로 봅니다
  if (ev.resultIndex < st.start || st.start > res.length) { st.start = Math.min(ev.resultIndex, res.length); st.seen = ''; st.prev = ''; st.live = ''; }
  for (var i = st.start; i < res.length; i++) {
    raw += ((res[i] && res[i][0] && res[i][0].transcript) || '') + ' ';
    if (!(res[i] && res[i].isFinal)) allFinal = false;
  }
  raw = raw.replace(/\s+/g, ' ').trim();
  var w = sttStrip(raw);
  // ⚠️ 안드로이드 크롬은 새 문장에 앞 문장을 통째로 다시 담아 보내기도 합니다 — 그러면 앞 문장은 이미 굳힌 것으로 칩니다
  if (!st.seen && st.lastDone && w.indexOf(st.lastDone) === 0) st.seen = st.lastDone;
  var tail = sttCutFrom(raw, sttAlign(st.seen, w)).trim();
  var t = sttStrip(tail);
  var keep;   // 이번에 굳힐 글자 수(띄어쓰기 뺀 것)
  if (allFinal) keep = t.length;             // 크롬이 확정 — 다 굳힘
  else {
    keep = 0;                                // 지난번 꼬리와 앞에서부터 같은 데까지만
    while (keep < t.length && keep < st.prev.length && t[keep] === st.prev[keep]) keep++;
    if (keep < t.length) {                   // 낱말 중간에서 자르지 않게 — 그 낱말은 다음 번에
      var cut = sttCutFrom(tail, keep);
      var before = tail.slice(0, tail.length - cut.length);
      if (cut && !/\s$/.test(before)) {
        var sp = before.lastIndexOf(' ');
        keep = sp > -1 ? sttStrip(before.slice(0, sp)).length : 0;
      }
    }
  }
  var add = keep ? tail.slice(0, tail.length - sttCutFrom(tail, keep).length).trim() : '';
  var live = sttCutFrom(tail, keep).trim();
  st.seen += sttStrip(add);
  st.prev = sttStrip(live);
  st.live = live;
  if (allFinal) {   // 이 문장은 끝 — 다음 말은 새 칸부터
    st.lastDone = w; st.start = res.length; st.seen = ''; st.prev = ''; st.live = '';
  }
  return { add: add, live: st.live };
}

// 아직 안 굳은 꼬리까지 지금 굳힙니다(듣기가 멈출 때 · 질문을 저장할 때). 굳힐 글을 돌려줍니다.
// 크롬이 이 문장을 이어 보내면 굳힌 글 뒤부터 이어 붙습니다(겹치지 않게).
function sttKeepFlush(st) {
  var add = st.live || '';
  st.seen += sttStrip(add);
  st.prev = ''; st.live = '';
  return add;
}
