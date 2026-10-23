// 받아 적기 — 말하는 순간 바로 검은 글로, 한 번 적은 글은 지우지 않기 (2026-10-23 선생님 말씀)
//
// 선생님 말씀: «학생이 말하는 그대로 적어 주는 게 좋은 게, 본인이 어떻게 말했는지 보여 주는 거라서 틀린 것도 다 적혀 있는 게 좋아.
//              최소한으로 없어지거나 텍스트 변환 손실 없게.»
//
// 크롬 음성 인식은 말하는 동안 «지금까지 들은 문장» 을 통째로 계속 고쳐 보내고(회색 · 확정 전), 말이 잠깐 끊기면 확정합니다.
// ⚠️ 예전엔 회색 글은 보여 주기만 하고 «확정» 된 글만 남겼습니다. 그런데 확정하면서 크롬이 단어를 바꾸거나 **빼 버려서**
//    (예: 회색일 땐 «어릴 때부터 실험을» 이 있었는데 확정 글엔 «실험을» 만) 말한 것이 사라졌습니다. 길게 말하면 중간이 통째로 빠지기도 했습니다.
// 이제는 크롬이 글을 보낼 때마다 **이미 적은 것 뒤로 새로 늘어난 부분만** 바로 이어 붙이고, 적은 글은 절대 지우거나 고치지 않습니다.
//   · 회색 글이 없습니다 — 들리는 대로 바로 검은 글
//   · 크롬이 나중에 앞 단어를 고쳐도 처음 들은 대로 남습니다(틀린 것도 그대로 — 학생이 어떻게 말했는지)
//   · 크롬이 확정하며 빼 버린 말도 남습니다
//   · 대신 띄어쓰기를 다시 나누는 곳에서 «화학 공학 과에» 처럼 한 낱말이 쪼개지거나, 드물게 한두 글자가 겹칠 수 있습니다
//   · 크롬이 처음부터 안 보낸 말(«음 · 어» 같은 말버릇 등)은 남길 수 없습니다 — 그건 녹음 파일로
//
// 견주는 방법: 띄어쓰기를 빼고 글자로 견줍니다(크롬이 «화학 공학» → «화학공학과에» 처럼 띄어쓰기를 자주 바꿔서).
//   ① 새 글이 이미 적은 글로 시작하면 → 그 뒤만 붙입니다
//   ② 아니면(앞이 고쳐졌거나 빠졌으면) → 이미 적은 글의 끝 몇 글자를 새 글에서 찾아 그 뒤만 붙입니다
//   ③ 그것도 못 찾으면(뒷부분을 다른 말로 갈아 끼움) → 두 글이 같은 데까지 견주고 거기서부터의 새 글을 통째로 붙입니다(잃지 않는 쪽)
// 학생 앱(interview.js 의 모의 면접 받아 적기)과 선생님 화면(listen.js)이 같이 씁니다.

function sttStrip(t) { return String(t || '').replace(/\s+/g, ''); }

// 띄어쓰기를 뺀 글에서 n 번째 글자가 원래 글의 몇 번째인지 — 붙일 때는 원래 글(띄어쓰기 있는)을 잘라 씁니다
function sttCutFrom(text, strippedAt) {
  var seen = 0;
  for (var i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    if (seen === strippedAt) return text.slice(i);
    seen++;
  }
  return '';
}

// seen: 이 덩어리(크롬의 결과 한 칸)에서 지금까지 적은 글(띄어쓰기 뺀 것). text: 크롬이 지금 보낸 그 칸의 글.
// 돌려주는 것: { add: 이어 붙일 글(띄어쓰기 있는 그대로, 없으면 ''), seen: 새로 적어 둘 seen }
function sttKeepAdd(seen, text) {
  seen = seen || '';
  var w = sttStrip(text);
  if (!w) return { add: '', seen: seen };
  if (!seen) return { add: String(text).trim(), seen: w };
  // ① 이어서 늘어났을 때(가장 흔함)
  if (w.indexOf(seen) === 0) {
    return w.length > seen.length ? { add: sttCutFrom(text, seen.length).trim(), seen: w } : { add: '', seen: seen };
  }
  // ② 앞이 고쳐졌거나 빠졌을 때 — 이미 적은 글의 끝(길게부터 3글자까지)을 새 글에서 찾아 그 뒤만
  for (var k = Math.min(seen.length, 16); k >= 3; k--) {
    var tail = seen.slice(-k);
    var at = w.lastIndexOf(tail);
    if (at > -1) {
      var from = at + k;
      if (from >= w.length) return { add: '', seen: seen };   // 새로 늘어난 것이 없음
      var add = sttCutFrom(text, from).trim();
      return { add: add, seen: seen + sttStrip(add) };
    }
  }
  // ③ 못 찾으면 — 크롬이 뒷부분을 다른 말로 갈아 끼운 것(예: «…김연습입니다 어릴 때부터» → «…김연습입니다 실험을 좋아했고»).
  //    두 글이 같은 데까지(앞에서부터) 견주고, 거기서부터의 새 글을 통째로 붙입니다. 적은 것(«어릴 때부터»)도 남고 새 말도 안 잃습니다.
  //    ⚠️ 처음엔 «길어진 글자 수만큼만» 붙였더니 «실험을 좋아» 가 빠지고 «했고» 만 붙었습니다(2026-10-23 시험에서 발견) — 잃는 것보다 겹치는 게 낫다(선생님 말씀)
  var same = 0;
  while (same < seen.length && same < w.length && seen[same] === w[same]) same++;
  if (same < w.length) {
    var add2 = sttCutFrom(text, same).trim();
    return { add: add2, seen: seen + sttStrip(add2) };
  }
  return { add: '', seen: seen };
}

// 크롬의 onresult 한 번을 받아, 이어 붙일 글을 돌려줍니다. state 는 듣기 한 번(start ~ end) 동안의 { seen: { 칸 번호: 글 } }
function sttKeepResult(state, ev) {
  var out = [];
  for (var i = ev.resultIndex; i < ev.results.length; i++) {
    var r = ev.results[i];
    var t = (r && r[0] && r[0].transcript) || '';
    // ⚠️ 안드로이드 크롬은 새 칸에 앞 칸 글을 통째로 다시 담아 보내기도 합니다 — 그러면 앞 칸 글은 이미 적은 것으로 칩니다(두 번 안 붙게)
    if (!state.seen[i] && i > 0 && state.seen[i - 1] && sttStrip(t).indexOf(state.seen[i - 1]) === 0) state.seen[i] = state.seen[i - 1];
    // 이미 확정했던 칸에 전혀 다른 글이 오면(크롬은 안 그러지만 다른 브라우저 · 시험 흉내가 칸 번호를 다시 쓸 때) 새 말로 봅니다 — 엉뚱하게 잘라 붙이지 않게
    state.fin = state.fin || {};
    if (state.fin[i] && state.seen[i] && sttStrip(t).indexOf(state.seen[i]) !== 0) { state.seen[i] = ''; state.fin[i] = false; }
    var res = sttKeepAdd(state.seen[i], t);
    state.seen[i] = res.seen;
    if (r && r.isFinal) state.fin[i] = true;
    if (res.add) out.push(res.add);
  }
  return out.join(' ');
}
