// 면접 후기 — 교육청 «수시모집전형 합격사례» 양식 (2026-10-07 선생님 말씀)
//
// 학생들은 면접을 본 뒤 후기를 써야 합니다(합격·불합격 모두). 학생은 웹에서 간단한 틀에 쓰고,
// 선생님은 그것을 **교육청 한글 양식에 채운 hwpx 파일**로 받습니다(한 명씩 · 반 전체 zip).
//
// ── 양식이 바뀌어도 코드를 고치지 않게 — «자리표» ──
// 한글로 연 양식의 칸마다 {{지원대학}} {{질문}} 같은 자리표를 적어 두고, 받을 때 그 자리에 학생 글을 넣습니다.
// 교육청 양식이 바뀌면 관리자가 새 양식에 자리표를 다시 쳐서 «데이터 관리 → 면접 후기 양식» 에 올리면 됩니다.
// 올린 양식이 없으면 앱에 들어 있는 기본 양식(assets/hwpx/hugi-template.hwpx — 2025학년도 자연계열 양식에서
// 학생 내용을 지우고 자리표를 넣은 것)을 씁니다. 자연·인문·예체능은 제목만 달라서 {{계열}} 하나로 씁니다.
//
// ── hwpx 는 압축(zip) 안의 XML 입니다 ──
// 한글 파일은 서버가 아니라 **브라우저에서** 만듭니다(JSZip). 서버에는 학생이 쓴 글자만 있습니다.
// 서버 요청: 학생 — 화면에 들어올 때 2번(내 학번 · 내 후기), 새 후기를 고를 때 1번(수시 지원), 저장할 때 1번.
//            선생님 — 받을 때 후기 읽기 1번 + 양식 1번(학교 양식이 없으면 기본 양식은 GitHub Pages 에서).
// 주기 확인은 없습니다(Supabase 무료 요금제 — docs/할-일.md «Supabase 로그 줄이기»).
//
// 학생 앱 · 선생님 화면 · 관리자 화면이 함께 씁니다. esc() 는 report.js(관리자는 admin-roster.js)가 먼저 실어 둡니다.

var HUGI_TRACKS = ['자연', '인문', '예체능'];
var HUGI_TYPES = [['종합', '학생부종합'], ['교과', '학생부교과(면접형)'], ['기타', '그 밖의 전형']];
var HUGI_RESULTS = [['', '아직 발표 전'], ['최초합격', '최초합격'], ['충원합격', '충원합격'], ['불합격', '불합격']];
var HUGI_COLS = 'id, student_id, plan_key, track, univ, major, adm_type, adm_name, result, wait_no, school_act, outside_act, ' +
                'qa, feeling, etc_note, consent, submitted_at, created_at, updated_at';
// 기본 양식 자리 — 이 파일(assets/js/hugi.js)에서 ../hwpx/ 로 찾습니다. 학생·선생님·관리자 화면의 깊이가 달라서요.
var HUGI_DEFAULT_URL = (function () {
  try { return new URL('../hwpx/hugi-template.hwpx', document.currentScript.src).href; }
  catch (e) { return 'assets/hwpx/hugi-template.hwpx'; }
})();

// 자리표 목록 — 관리자 화면에 «이렇게 적으세요» 로 보여 주고, 올린 양식을 검사할 때도 씁니다
var HUGI_FIELDS = [
  ['학년도', '입시 학년도 숫자(예: 2027) — 후기를 처음 쓴 날로 셉니다'],
  ['계열', '자연 · 인문 · 예체능'],
  ['동의', '개인 정보 동의 — 했으면 ☑(네모 안에 V), 안 했으면 □'],
  ['학번', ''], ['이름', ''],
  ['지원대학', ''], ['지원학과', ''], ['전형명', ''],
  ['전형유형', '학생부종합 · 학생부교과(면접형) · 그 밖의 전형 (글자로)'],
  ['학생부종합', '학생부종합이면 O'], ['학생부교과', '학생부교과(면접형)이면 O'],
  ['최초합격', '최초합격이면 O'], ['충원합격', '충원합격이면 O'],
  ['예비순위', '예비 번호. 불합격이면 「불합격」 을 덧붙입니다'],
  ['합격사항', '최초합격 · 충원합격 · 불합격 · 발표 전 (글자로)'],
  ['교내활동', ''], ['교외활동', ''],
  ['질문', '면접 질문 — 「1. … 2. …」 줄로'], ['답변', '답변 — 질문과 같은 번호로'],
  ['소감', '당락에 대한 개인적 소감'], ['기타', '타대학/학과 지원/합불 등']
];

function hugiSay(msg, kind) {
  if (typeof showToast === 'function') showToast(msg, kind === 'bad' ? 'error' : 'info');
  else if (typeof toast === 'function') toast(msg, kind || 'ok');
  else alert(msg);
}
function hugiTypeText(t) { var x = HUGI_TYPES.filter(function (p) { return p[0] === t; })[0]; return x ? x[1] : ''; }
function hugiResultText(r) { var x = HUGI_RESULTS.filter(function (p) { return p[0] === r; })[0]; return x ? x[1] : '아직 발표 전'; }
// 입시 학년도 — 9월에 원서를 쓰면 «다음 해» 학년도입니다(2026년 9월 → 2027학년도). 1·2월은 그해 학년도.
function hugiYear(sheet) {
  var d = new Date((sheet && sheet.created_at) || Date.now());
  return String(d.getMonth() + 1 >= 3 ? d.getFullYear() + 1 : d.getFullYear());
}
function hugiQa(sheet) {
  return (Array.isArray(sheet.qa) ? sheet.qa : []).filter(function (x) {
    return x && (String(x.q || '').trim() || String(x.a || '').trim());
  });
}
// 다 썼는가 — «다 썼어요» 를 누를 수 있는 조건(관리자 견본·선생님 화면에서도 같은 말을 씁니다)
function hugiMissing(sheet) {
  var miss = [];
  if (!sheet.track) miss.push('계열');
  if (!String(sheet.univ || '').trim()) miss.push('지원대학');
  if (!hugiQa(sheet).length) miss.push('면접 질문');
  if (!sheet.consent) miss.push('개인 정보 동의');
  return miss;
}

// 자리표에 들어갈 값. 배열은 «목록» — 칸에 자리표만 있으면 「1. …」 문단으로 하나씩 늘어놓습니다.
function hugiValues(sheet, student) {
  var qa = hugiQa(sheet);
  var wait = String(sheet.wait_no || '').trim();
  return {
    '학년도': hugiYear(sheet),
    '계열': sheet.track || '',
    // 처음엔 ■(까만 네모)였는데 «네모 안에 V 표시가 아니네?» 라는 말씀(2026-10-07) — ☑ 로
    '동의': sheet.consent ? '☑' : '□',
    '학번': (student && student.student_no) || '',
    '이름': (student && student.name) || '',
    '지원대학': sheet.univ || '', '지원학과': sheet.major || '', '전형명': sheet.adm_name || '',
    '전형유형': hugiTypeText(sheet.adm_type),
    '학생부종합': sheet.adm_type === '종합' ? 'O' : '',
    '학생부교과': sheet.adm_type === '교과' ? 'O' : '',
    '최초합격': sheet.result === '최초합격' ? 'O' : '',
    '충원합격': sheet.result === '충원합격' ? 'O' : '',
    // ⚠️ 양식에 «불합격» 칸이 따로 없습니다. 불합격한 학생도 써야 해서(2026-10-07 선생님 말씀) 예비순위 칸에 적습니다
    '예비순위': sheet.result === '불합격' ? (wait ? wait + ' (불합격)' : '불합격') : wait,
    '합격사항': sheet.result ? hugiResultText(sheet.result) : '발표 전',
    '교내활동': sheet.school_act || '', '교외활동': sheet.outside_act || '',
    '질문': qa.map(function (x) { return String(x.q || '').trim() || '(질문을 안 적음)'; }),
    '답변': qa.map(function (x) { return String(x.a || '').trim() || '(답을 안 적음)'; }),
    '소감': sheet.feeling || '', '기타': sheet.etc_note || ''
  };
}

// ══════════════ hwpx 채우기 ══════════════

var HUGI_JSZIP_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'   // 위가 막혔을 때
];
var hugiZipReady = null;
function hugiLoadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (hugiZipReady) return hugiZipReady;
  hugiZipReady = new Promise(function (ok, fail) {
    var i = 0;
    (function next() {
      if (i >= HUGI_JSZIP_URLS.length) { hugiZipReady = null; fail(new Error('JSZip 을 불러오지 못했습니다')); return; }
      var s = document.createElement('script');
      s.src = HUGI_JSZIP_URLS[i++];
      s.onload = function () { window.JSZip ? ok(window.JSZip) : next(); };
      s.onerror = next;
      document.head.appendChild(s);
    })();
  });
  return hugiZipReady;
}

var HUGI_HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
var HUGI_MARK = /\{\{\s*([^{}]+?)\s*\}\}/g;

function hugiKids(el, name) {
  var out = [];
  for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) out.push(c);
  return out;
}
// 이 문단에 «바로» 붙은 글자 조각들. 표는 글자 조각 안에 들어 있어서, 표 칸의 문단은 따로 돕니다.
function hugiParaTexts(p) {
  var ts = [];
  hugiKids(p, 'run').forEach(function (r) { ts = ts.concat(hugiKids(r, 't')); });
  return ts;
}
// 글이 바뀐 문단의 «줄 배치 기억» 은 낡으므로 뺍니다 — 한글이 파일을 열 때 다시 셉니다.
// (남겨 두면 글자가 겹쳐 보일 수 있습니다)
function hugiDropLines(p) { hugiKids(p, 'linesegarray').forEach(function (x) { p.removeChild(x); }); }
// 비게 된 글자 조각은 뺍니다 — 한글이 빈 문단을 저장하는 모양(<hp:run …/>) 그대로 두려고요
function hugiDropEmptyTexts(p) {
  hugiKids(p, 'run').forEach(function (r) {
    hugiKids(r, 't').forEach(function (t) { if (!t.firstElementChild && t.textContent === '') r.removeChild(t); });
  });
}

// 문단 하나 안의 자리표를 바꿉니다. 한글이 자리표 글자를 여러 조각으로 쪼개 저장하는 일이 있어서
// («{{지원」 + «대학}}»), 조각을 이어 붙인 글에서 찾고 걸친 조각들을 함께 고칩니다.
function hugiReplaceInPara(ts, values, found) {
  var texts = ts.map(function (t) { return t.textContent; });
  var joined = texts.join('');
  var marks = [], m;
  HUGI_MARK.lastIndex = 0;
  while ((m = HUGI_MARK.exec(joined))) marks.push({ at: m.index, end: m.index + m[0].length, name: m[1] });
  if (!marks.length) return false;
  var starts = [], acc = 0;
  texts.forEach(function (x) { starts.push(acc); acc += x.length; });
  function runAt(pos) { for (var i = starts.length - 1; i >= 0; i--) if (pos >= starts[i]) return i; return 0; }
  var changed = false;
  for (var k = marks.length - 1; k >= 0; k--) {
    var mk = marks[k];
    found[mk.name] = true;
    if (!(mk.name in values)) continue;          // 모르는 자리표는 그대로 둡니다(관리자 검사에서 알려 줌)
    var v = values[mk.name];
    if (Array.isArray(v)) v = v.map(function (x, i) { return (i + 1) + '. ' + x; }).join(' / ');
    v = String(v).replace(/\s*\n\s*/g, ' ');
    var rs = runAt(mk.at), re = runAt(mk.end - 1);
    var before = texts[rs].slice(0, mk.at - starts[rs]);
    var after = texts[re].slice(mk.end - starts[re]);
    if (rs === re) texts[rs] = before + v + after;
    else {
      texts[rs] = before + v;
      for (var j = rs + 1; j < re; j++) texts[j] = '';
      texts[re] = after;
    }
    changed = true;
  }
  ts.forEach(function (t, i) { if (t.textContent !== texts[i]) t.textContent = texts[i]; });
  return changed;
}

// 문단 하나를 여러 문단으로 — 칸에 자리표 «하나만» 있을 때 목록(질문·답변)이나 여러 줄 글(소감 등)을 늘어놓습니다
function hugiSpreadPara(p, ts, lines) {
  hugiDropLines(p);
  var at = p;
  lines.forEach(function (line, i) {
    var q = i === 0 ? p : p.cloneNode(true);
    var qts = hugiParaTexts(q);
    qts.forEach(function (t, k) { t.textContent = k === 0 ? line : ''; });
    hugiDropEmptyTexts(q);
    if (i > 0) { at.parentNode.insertBefore(q, at.nextSibling); at = q; }
  });
}

// XML 글 하나(Contents/section0.xml 등)를 채웁니다. found 에 양식에서 본 자리표 이름이 모입니다.
function hugiFillXml(xml, values, found) {
  var head = (xml.match(/^<\?xml[^>]*\?>/) || [''])[0];
  var doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('양식 파일을 읽지 못했습니다(XML).');
  var ps = Array.prototype.slice.call(doc.getElementsByTagNameNS(HUGI_HP, 'p'));
  ps.forEach(function (p) {
    var ts = hugiParaTexts(p);
    if (!ts.length) return;
    var joined = ts.map(function (t) { return t.textContent; }).join('');
    if (joined.indexOf('{{') < 0) return;
    // 칸에 자리표 하나만 있으면 → 목록이나 여러 줄을 문단으로 펼칩니다
    var only = joined.trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (only && only[1] in values) {
      found[only[1]] = true;
      var v = values[only[1]];
      var lines;
      if (Array.isArray(v)) {
        // 「1. …」 사이에 빈 줄 하나 — 교육청 양식의 모양 그대로
        lines = [];
        v.forEach(function (x, i) { if (i) lines.push(''); lines.push((i + 1) + '. ' + String(x).replace(/\s*\n\s*/g, ' ')); });
        if (!lines.length) lines = [''];
      } else {
        lines = String(v).split(/\r?\n/);
      }
      hugiSpreadPara(p, ts, lines);
      return;
    }
    if (hugiReplaceInPara(ts, values, found)) { hugiDropLines(p); hugiDropEmptyTexts(p); }
  });
  // 머리말(<?xml …?>)은 원래 것을 글자 그대로 붙입니다
  var out = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  return head + out;
}

function hugiSectionNames(zip) {
  return Object.keys(zip.files).filter(function (n) { return /^Contents\/section\d+\.xml$/.test(n); }).sort();
}

// 양식(ArrayBuffer) + 학생 후기 → 채운 hwpx (Blob)
async function hugiMakeHwpx(templateBuf, sheet, student) {
  var JSZip = await hugiLoadJSZip();
  var zip = await JSZip.loadAsync(templateBuf);
  var values = hugiValues(sheet, student), found = {};
  var names = hugiSectionNames(zip);
  if (!names.length) throw new Error('한글(hwpx) 양식이 아닙니다.');
  for (var i = 0; i < names.length; i++) {
    var xml = await zip.file(names[i]).async('string');
    zip.file(names[i], hugiFillXml(xml, values, found), { createFolders: false });   // 한글이 쓰는 짜임 그대로(폴더 항목을 더하지 않음)
  }
  return hugiZipOut(zip);
}
// ⚠️ hwpx 는 맨 앞 «mimetype» 을 압축하지 않은 채 두어야 한글이 엽니다(전자책 epub 과 같은 규칙)
async function hugiZipOut(zip, type) {
  var mt = zip.file('mimetype');
  if (mt) zip.file('mimetype', await mt.async('string'), { compression: 'STORE', createFolders: false });
  return zip.generateAsync({ type: type || 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
}

// 올린 양식에서 자리표를 찾아 봅니다 → { known: [...], unknown: [...], missing: [...] }
async function hugiScanTemplate(buf) {
  var JSZip = await hugiLoadJSZip();
  var zip = await JSZip.loadAsync(buf);
  var names = hugiSectionNames(zip);
  if (!names.length) throw new Error('한글(hwpx) 양식이 아닙니다. 한글에서 «다른 이름으로 저장 → HWPX» 로 저장해 주세요.');
  var found = {};
  for (var i = 0; i < names.length; i++) {
    var xml = await zip.file(names[i]).async('string');
    hugiFillXml(xml, {}, found);       // 값 없이 돌리면 «본 자리표» 만 모입니다
  }
  var all = HUGI_FIELDS.map(function (f) { return f[0]; });
  var names2 = Object.keys(found);
  return {
    known: all.filter(function (n) { return found[n]; }),
    unknown: names2.filter(function (n) { return all.indexOf(n) === -1; }),
    missing: all.filter(function (n) { return !found[n]; })
  };
}

// 파일 이름 — 「30224_홍길동_수원대학교_전기전자공학부.hwpx」. 쓰는 중이면 끝에 «(쓰는중)»
function hugiFileName(sheet, student) {
  var parts = [(student && student.student_no) || '', (student && student.name) || '', sheet.univ || '대학 모름', sheet.major || '']
    .map(function (x) { return String(x).trim().replace(/[\\\/:*?"<>|\s]+/g, ''); }).filter(Boolean);
  return parts.join('_') + (sheet.submitted_at ? '' : '(쓰는중)') + '.hwpx';
}
function hugiSaveBlob(blob, name) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ── 양식 가져오기 — 학교가 올린 것, 없으면 기본 양식. 한 화면에서 한 번만 받아 둡니다 ──
var hugiTemplateCache = null;   // { buf, from: 'school'|'default', name, updated_at }
function hugiB64ToBuf(b64) {
  var bin = atob(b64), u = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function hugiBufToB64(buf) {
  var u = new Uint8Array(buf), s = '';
  for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
async function hugiDefaultTemplate() {
  var res = await fetch(HUGI_DEFAULT_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error('기본 양식을 받지 못했습니다.');
  return res.arrayBuffer();
}
async function hugiGetTemplate(fresh) {
  if (hugiTemplateCache && !fresh) return hugiTemplateCache;
  const { data, error } = await sb.from('hugi_templates').select('file_b64, file_name, updated_at').maybeSingle();
  if (!error && data && data.file_b64) {
    hugiTemplateCache = { buf: hugiB64ToBuf(data.file_b64), from: 'school', name: data.file_name, updated_at: data.updated_at };
  } else {
    hugiTemplateCache = { buf: await hugiDefaultTemplate(), from: 'default', name: '기본 양식' };
  }
  return hugiTemplateCache;
}

// 후기 하나 받기
async function hugiDownloadOne(sheet, student) {
  try {
    var tpl = await hugiGetTemplate();
    var blob = await hugiMakeHwpx(tpl.buf, sheet, student);
    hugiSaveBlob(blob, hugiFileName(sheet, student));
  } catch (e) { hugiSay('한글 파일을 만들지 못했습니다: ' + e.message, 'bad'); }
}
// 여러 개를 zip 하나로 — 이름이 겹치면 (2) (3) 을 붙입니다
async function hugiDownloadMany(pairs, zipName) {
  var JSZip = await hugiLoadJSZip();
  var tpl = await hugiGetTemplate();
  var out = new JSZip(), used = {};
  for (var i = 0; i < pairs.length; i++) {
    var blob = await hugiMakeHwpx(tpl.buf, pairs[i].sheet, pairs[i].student);
    var name = hugiFileName(pairs[i].sheet, pairs[i].student);
    if (used[name]) { used[name]++; name = name.replace(/\.hwpx$/, ' (' + used[name] + ').hwpx'); } else used[name] = 1;
    out.file(name, blob);
  }
  hugiSaveBlob(await out.generateAsync({ type: 'blob', compression: 'DEFLATE' }), zipName);
}

// 한 장을 화면에 읽기 전용으로 — 선생님 화면에서 씁니다
function hugiSheetViewHTML(s) {
  function row(k, v) { return v ? '<div class="hg-vrow"><b>' + esc(k) + '</b><span>' + esc(v) + '</span></div>' : ''; }
  var qa = hugiQa(s);
  return row('계열', s.track) + row('전형', [hugiTypeText(s.adm_type), s.adm_name].filter(Boolean).join(' · ')) +
    row('합격사항', s.result ? hugiResultText(s.result) + (s.wait_no ? ' (예비 ' + s.wait_no + ')' : '') : '아직 발표 전' + (s.wait_no ? ' (예비 ' + s.wait_no + ')' : '')) +
    row('교내활동', s.school_act) + row('교외활동', s.outside_act) +
    (qa.length ? '<div class="hg-vqa">' + qa.map(function (x, i) {
      return '<p class="q">' + (i + 1) + '. ' + esc(x.q || '') + '</p><p class="a">' + esc(x.a || '') + '</p>';
    }).join('') + '</div>' : '') +
    row('소감', s.feeling) + row('기타', s.etc_note);
}

// ══════════════ 학생 — «🗒️ 면접 후기 쓰기» ══════════════
//
// 면접을 본 대학마다 한 장. 첫 화면에 **내 수시 지원(susi_plans) 카드가 그대로** 떠서, 누르면 그 대학 후기를 쓰고·고칩니다
// (2026-10-07 선생님 말씀 — 처음엔 «새 후기 → 대학 고르기» 두 단계였는데, 지원 카드를 바로 누르는 게 편하다고).
// 목록에 없는 대학은 맨 아래 «직접 쓰기». 후기는 plan_key(대학|학과|전형명)로 지원 카드에 붙어 있어서
// 학생이 대학 이름을 고쳐 써도 카드에서 떨어지지 않습니다.
// 두 번에 나눠 쓰는 일이 흔합니다 — 면접 직후 질문·답변(기억이 생생할 때), 발표 뒤 합격사항.
// 그래서 «저장» 은 언제든, «다 썼어요» 는 계열·대학·질문·동의가 있어야 눌립니다(그 뒤에도 고칠 수 있습니다).
// 저장 전에 화면을 벗어나도 글이 안 날아가게, 쓰는 동안 이 기기에 적어 둡니다(localStorage).
var HG = { me: null, list: [], cur: null, plans: null, dirty: false };

// ⚠️ 미리보기(raw.githack)는 고친 직후 몇 분 동안 «새 화면 + 옛 스크립트» 를 줄 때가 있습니다. 2026-10-07 그 탓에
//    목록이 비고 «직접 쓰기» 가 안 먹혔습니다(옛 스크립트가 없어진 칸을 찾다 멈춤). 그래서 칸이 없어도 멈추지 않게 하고,
//    멈추면 조용히 넘어가지 말고 화면에 까닭과 «Ctrl+F5» 를 적습니다.
function hugiShow(id, on) { var el = document.getElementById(id); if (el) el.hidden = !on; }
async function hugiStudentEnter() {
  var box = document.getElementById('hugi-list');
  if (!box) return;
  try { await hugiStudentLoad(box); }
  catch (e) {
    box.innerHTML = '<p class="prac-empty">화면을 그리지 못했습니다: ' + esc(e.message) + '<br>Ctrl+F5(휴대폰은 앱을 껐다 켜기)로 새로 받아 보세요.</p>';
  }
}
async function hugiStudentLoad(box) {
  hugiShowList();
  box.innerHTML = '<p class="prac-empty">불러오는 중...</p>';
  if (!HG.me) {
    // 로그인한 계정의 학생 줄 — RLS 가 자기 줄만 주지만, 계정으로 한 번 더 좁힙니다
    var q = sb.from('students').select('id, student_no, name');
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) q = q.eq('auth_user_id', currentUser.id);
    const r = await q.maybeSingle();
    if (r.error || !r.data) { box.innerHTML = '<p class="prac-empty">내 학번을 찾지 못했습니다' + (r.error ? '(' + esc(r.error.message) + ')' : '') + '. 다시 로그인해 보세요.</p>'; return; }
    HG.me = r.data;
  }
  // 내 후기 · 내 수시 지원(처음 한 번만) — 둘을 같이 묻습니다
  var jobs = [sb.from('hugi_sheets').select(HUGI_COLS).eq('student_id', HG.me.id).order('created_at', { ascending: true })];
  if (!HG.plans) jobs.push(sb.from('susi_plans').select('slot, uni_name, dept_name, type_name, admission_name, interview_date')
    .eq('student_no', HG.me.student_no).order('slot'));
  var res = await Promise.all(jobs);
  if (res[0].error) { box.innerHTML = '<p class="prac-empty">후기를 불러오지 못했습니다: ' + esc(res[0].error.message) + '</p>'; return; }
  HG.list = res[0].data || [];
  if (res[1]) HG.plans = res[1].error ? [] : (res[1].data || []);
  hugiPaintList();
}

function hugiShowList() { hugiShow('hugi-home', true); hugiShow('hugi-edit', false); }

function hugiPlanKey(p) { return [p.uni_name || '', p.dept_name || '', p.admission_name || ''].join('|'); }
// 이 지원 카드에 붙은 후기 — plan_key 로, 없으면(옛 줄) 대학·학과 이름으로
function hugiSheetOfPlan(p) {
  var key = hugiPlanKey(p);
  return HG.list.filter(function (s) { return s.plan_key === key; })[0] ||
         HG.list.filter(function (s) { return !s.plan_key && s.univ === p.uni_name && s.major === (p.dept_name || ''); })[0] || null;
}
function hugiStateChip(s) {
  if (!s) return '<span class="hg-state none">아직 안 씀</span>';
  return s.submitted_at ? '<span class="hg-state done">다 씀 ✓</span>' : '<span class="hg-state">쓰는 중</span>';
}
function hugiSheetLine(s) {
  return s ? '면접 질문 ' + hugiQa(s).length + '개 · ' + (s.result ? hugiResultText(s.result) : '발표 전') + ' · 눌러서 고치기' : '눌러서 후기 쓰기';
}

function hugiPaintList() {
  var box = document.getElementById('hugi-list');
  var used = {};
  var html = '';
  if (HG.plans.length) {
    html += '<p class="prac-label" style="margin-top:0">내 수시 지원 <span class="hg-opt">면접 본 곳만 쓰면 됩니다</span></p>';
    html += HG.plans.map(function (p, i) {
      var s = hugiSheetOfPlan(p);
      if (s) used[s.id] = true;
      return '<button class="hg-card' + (s ? '' : ' empty') + '" onclick="hugiOpenPlan(' + i + ')">' +
        '<span class="hg-card-top"><b>' + esc(p.uni_name || '대학 이름 없음') + '</b>' + hugiStateChip(s) + '</span>' +
        '<span class="hg-card-sub">' + esc([p.dept_name, p.type_name, p.admission_name].filter(Boolean).join(' · ')) +
          (p.interview_date ? ' · 면접 ' + esc(p.interview_date) : '') + '</span>' +
        '<span class="hg-card-sub go">' + hugiSheetLine(s) + '</span></button>';
    }).join('');
  } else {
    html += '<p class="prac-hint">내 학번(' + esc(HG.me.student_no) + ')으로 들어온 수시 지원 자료가 아직 없습니다. ' +
            '선생님이 수시 지원 자료를 받아 오면 여기에 6곳이 뜹니다. 그동안은 아래 «직접 쓰기» 로 써 주세요.</p>';
  }
  // 수시 지원 카드에 안 붙은 후기(직접 쓴 것)
  var own = HG.list.filter(function (s) { return !used[s.id]; });
  if (own.length) {
    html += '<p class="prac-label">직접 쓴 후기</p>' + own.map(function (s) {
      return '<button class="hg-card" onclick="hugiOpen(\'' + s.id + '\')">' +
        '<span class="hg-card-top"><b>' + esc(s.univ || '대학을 안 적음') + '</b>' + hugiStateChip(s) + '</span>' +
        '<span class="hg-card-sub">' + esc([s.major, hugiTypeText(s.adm_type), s.adm_name].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="hg-card-sub go">' + hugiSheetLine(s) + '</span></button>';
    }).join('');
  }
  box.innerHTML = html;
}

function hugiTypeFromSusi(t) { return t === '종합' ? '종합' : t === '교과' ? '교과' : t ? '기타' : ''; }
function hugiBlank() {
  return { id: null, student_id: HG.me.id, plan_key: '', track: '', univ: '', major: '', adm_type: '', adm_name: '', result: '', wait_no: '',
           school_act: '', outside_act: '', qa: [{ q: '', a: '' }, { q: '', a: '' }, { q: '', a: '' }],
           feeling: '', etc_note: '', consent: false, submitted_at: null, created_at: null };
}
// 지원 카드를 누르면 — 쓴 게 있으면 열고, 없으면 그 지원으로 미리 채워 새로
function hugiOpenPlan(i) {
  var p = HG.plans[i];
  if (!p) return;
  var s = hugiSheetOfPlan(p);
  if (s) { hugiOpen(s.id); return; }
  hugiStartFrom(i);
}
function hugiStartFrom(i) {
  if (!HG.me) { hugiSay('내 학번을 아직 못 불러왔습니다. 화면을 새로 받아(Ctrl+F5) 다시 들어와 주세요.', 'bad'); return; }
  var s = hugiBlank();
  if (i !== null && i !== undefined && HG.plans[i]) {
    var p = HG.plans[i];
    s.plan_key = hugiPlanKey(p);
    s.univ = p.uni_name || ''; s.major = p.dept_name || ''; s.adm_name = p.admission_name || '';
    s.adm_type = hugiTypeFromSusi(p.type_name);
  }
  hugiEdit(s);
}
function hugiOpen(id) {
  var s = HG.list.filter(function (x) { return x.id === id; })[0];
  if (!s) return;
  var copy = JSON.parse(JSON.stringify(s));
  if (!Array.isArray(copy.qa) || !copy.qa.length) copy.qa = [{ q: '', a: '' }];
  hugiEdit(copy);
}

// ── 쓰는 동안 이 기기에 적어 두기 ──
function hugiDraftKey(s) { return 'hugiDraft:' + HG.me.id + ':' + (s.id || 'new:' + (s.plan_key || '')); }
function hugiDraftPut() {
  try { localStorage.setItem(hugiDraftKey(HG.cur), JSON.stringify({ at: Date.now(), sheet: HG.cur })); } catch (e) { /* 사생활 보호 모드 */ }
}
function hugiDraftDrop(s) { try { localStorage.removeItem(hugiDraftKey(s || HG.cur)); } catch (e) { /* */ } }
function hugiDraftGet(s) {
  try { var v = JSON.parse(localStorage.getItem(hugiDraftKey(s)) || 'null'); return v && v.sheet ? v : null; } catch (e) { return null; }
}

function hugiEdit(s) {
  var d = hugiDraftGet(s);
  var serverAt = s.updated_at ? new Date(s.updated_at).getTime() : 0;
  if (d && d.at > serverAt && confirm('저장하지 않고 나간 글이 있습니다. 이어서 쓸까요?\n(「취소」를 누르면 지웁니다)')) {
    s = d.sheet; HG.dirty = true;
  } else { if (d) hugiDraftDrop(s); HG.dirty = false; }
  HG.cur = s;
  hugiShow('hugi-home', false);
  hugiShow('hugi-edit', true);
  hugiPaintEdit();
  window.scrollTo(0, 0);
}

function hugiChips(items, cur, fn) {
  return items.map(function (it) {
    var v = Array.isArray(it) ? it[0] : it, label = Array.isArray(it) ? it[1] : it;
    return '<button type="button" class="prac-chip" aria-pressed="' + (cur === v) + '" onclick="' + fn + '(\'' + v + '\')">' + esc(label) + '</button>';
  }).join('');
}
function hugiField(label, key, ph, rows) {
  var v = HG.cur[key] || '';
  return '<p class="prac-label">' + label + '</p>' + (rows
    ? '<textarea class="hg-in" rows="' + rows + '" placeholder="' + esc(ph || '') + '" oninput="hugiSet(\'' + key + '\', this.value)">' + esc(v) + '</textarea>'
    : '<input class="hg-in" type="text" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '" oninput="hugiSet(\'' + key + '\', this.value)">');
}

function hugiPaintEdit() {
  var s = HG.cur;
  var box = document.getElementById('hugi-form');
  var html =
    '<p class="prac-label" style="margin-top:0">계열</p><div class="prac-chips">' + hugiChips(HUGI_TRACKS, s.track, 'hugiPick_track') + '</div>' +
    hugiField('지원대학', 'univ', '예: 수원대학교') +
    hugiField('지원학과', 'major', '예: 전기전자공학부') +
    '<p class="prac-label">전형유형</p><div class="prac-chips">' + hugiChips(HUGI_TYPES, s.adm_type, 'hugiPick_adm_type') + '</div>' +
    hugiField('전형명', 'adm_name', '예: 고교추천전형') +
    '<p class="prac-label">합격사항 <span class="hg-opt">발표 뒤에 다시 와서 고르면 됩니다</span></p>' +
      '<div class="prac-chips">' + hugiChips(HUGI_RESULTS, s.result, 'hugiPick_result') + '</div>' +
    hugiField('예비순위', 'wait_no', '예비 번호를 받았으면 숫자만 (예: 12)') +
    hugiField('교내활동 <span class="hg-opt">(동아리, 창체 등)</span>', 'school_act', '면접에 도움이 된 교내 활동', 2) +
    hugiField('교외활동 <span class="hg-opt">(교육청 등)</span>', 'outside_act', '교육청 프로그램 등', 2) +
    '<p class="prac-label">면접 질문과 내 답변</p>' +
    '<p class="prac-hint">받은 질문마다 한 칸씩. 답변은 «어떻게 답했는지» 를 짧게 적어도 됩니다.</p>' +
    '<div id="hugi-qa">' + hugiQaHTML() + '</div>' +
    '<button type="button" class="hg-addq" onclick="hugiAddQ()">＋ 질문 더하기</button>' +
    '<p class="hg-fit" id="hugi-fit"></p>' +
    hugiField('당락에 대한 개인적 소감', 'feeling', '후배에게 해 주고 싶은 말도 좋습니다', 3) +
    hugiField('기타 <span class="hg-opt">(다른 대학·학과 지원, 합불 등)</span>', 'etc_note', '예: 가천대 금융빅데이터학부, 경기대 산업경영공학과', 2) +
    '<label class="hg-consent"><input type="checkbox"' + (s.consent ? ' checked' : '') + ' onchange="hugiSet(\'consent\', this.checked)">' +
      '<span>본인은 이 합격 사례 양식에 포함된 <b>개인 정보의 수집 및 이용에 동의</b>합니다.</span></label>';
  box.innerHTML = html;
  hugiPaintState();
}
function hugiQaHTML() {
  return HG.cur.qa.map(function (x, i) {
    return '<div class="hg-qa">' +
      '<div class="hg-qa-head"><b>질문 ' + (i + 1) + '</b>' +
        (HG.cur.qa.length > 1 ? '<button type="button" class="prac-offer-skip del" onclick="hugiDelQ(' + i + ')">빼기</button>' : '') + '</div>' +
      '<textarea class="hg-in" rows="2" placeholder="받은 질문" oninput="hugiSetQ(' + i + ', \'q\', this.value)">' + esc(x.q || '') + '</textarea>' +
      '<textarea class="hg-in" rows="3" placeholder="내가 한 답변" oninput="hugiSetQ(' + i + ', \'a\', this.value)">' + esc(x.a || '') + '</textarea>' +
      '</div>';
  }).join('');
}
function hugiTouch() { HG.dirty = true; hugiDraftPut(); hugiPaintState(); }

// ── 한글 파일 한 쪽에 들어가는 양(어림) ──
// 교육청 양식의 질문 칸은 8pt 글씨로 한 줄 약 47자 × 16줄, 답변 칸은 × 20줄쯤입니다(번호 사이 빈 줄 빼고).
// 넘어도 표가 다음 쪽으로 이어질 뿐 잘리지는 않지만, 한 쪽에 맞추려면 이만큼이 좋다고 알려 줍니다.
var HUGI_FIT = { q: 600, a: 800 };
function hugiPaintFit() {
  var el = document.getElementById('hugi-fit');
  if (!el || !HG.cur) return;
  var q = 0, a = 0;
  HG.cur.qa.forEach(function (x) { q += String(x.q || '').trim().length; a += String(x.a || '').trim().length; });
  var over = q > HUGI_FIT.q || a > HUGI_FIT.a;
  el.className = 'hg-fit' + (over ? ' over' : '');
  el.textContent = '한글 파일 한 쪽에 맞추려면 질문 합쳐 ' + HUGI_FIT.q + '자 · 답변 합쳐 ' + HUGI_FIT.a + '자쯤까지 — 지금 질문 ' + q + '자 · 답변 ' + a + '자' +
    (over ? ' (넘으면 표가 다음 쪽으로 이어집니다. 줄여 쓸 수 있으면 줄여 주세요)' : '');
}
function hugiSet(key, v) { HG.cur[key] = v; hugiTouch(); }
function hugiPick(key, v) { HG.cur[key] = HG.cur[key] === v && key !== 'result' ? '' : v; hugiTouch(); hugiPaintEdit(); }
function hugiPick_track(v) { hugiPick('track', v); }
function hugiPick_adm_type(v) { hugiPick('adm_type', v); }
function hugiPick_result(v) { hugiPick('result', v); }
function hugiSetQ(i, k, v) { HG.cur.qa[i][k] = v; hugiTouch(); }
function hugiAddQ() {
  HG.cur.qa.push({ q: '', a: '' });
  document.getElementById('hugi-qa').innerHTML = hugiQaHTML();
  hugiTouch();
  var ins = document.querySelectorAll('#hugi-qa textarea');
  if (ins.length > 1) { ins[ins.length - 2].scrollIntoView({ block: 'center' }); ins[ins.length - 2].focus({ preventScroll: true }); }
}
function hugiDelQ(i) {
  var x = HG.cur.qa[i];
  if ((String(x.q || '').trim() || String(x.a || '').trim()) && !confirm('질문 ' + (i + 1) + '을(를) 뺄까요?')) return;
  HG.cur.qa.splice(i, 1);
  document.getElementById('hugi-qa').innerHTML = hugiQaHTML();
  hugiTouch();
}

function hugiPaintState() {
  var s = HG.cur, miss = hugiMissing(s);
  hugiPaintFit();
  var st = document.getElementById('hugi-state');
  st.textContent = HG.dirty ? '저장하지 않은 글이 있습니다' : s.submitted_at ? '다 썼어요 ✓ (고쳐도 됩니다)' : s.id ? '저장됨 · 쓰는 중' : '';
  st.className = 'hg-savestate' + (HG.dirty ? ' dirty' : '');
  var done = document.getElementById('hugi-done');
  done.disabled = miss.length > 0;
  done.textContent = s.submitted_at ? (HG.dirty ? '고친 것 저장' : '다 썼어요 ✓') : '다 썼어요';
  document.getElementById('hugi-miss').textContent = miss.length ? '«다 썼어요» 를 누르려면: ' + miss.join(' · ') : '';
  document.getElementById('hugi-del').hidden = !s.id;
}

async function hugiSave(submit) {
  var s = HG.cur;
  if (submit && hugiMissing(s).length) return;
  var row = {
    school_id: SCHOOL_ID, student_id: HG.me.id, plan_key: s.plan_key || '',
    track: s.track || '', univ: String(s.univ || '').trim(), major: String(s.major || '').trim(),
    adm_type: s.adm_type || '', adm_name: String(s.adm_name || '').trim(), result: s.result || '',
    wait_no: String(s.wait_no || '').trim(), school_act: s.school_act || '', outside_act: s.outside_act || '',
    qa: (s.qa || []).map(function (x) { return { q: String(x.q || '').trim(), a: String(x.a || '').trim() }; })
                    .filter(function (x) { return x.q || x.a; }),
    feeling: s.feeling || '', etc_note: s.etc_note || '', consent: !!s.consent,
    updated_at: new Date().toISOString()
  };
  if (submit || s.submitted_at) row.submitted_at = s.submitted_at || new Date().toISOString();
  var btns = document.querySelectorAll('#hugi-edit .hg-actions button');
  btns.forEach(function (b) { b.disabled = true; });
  var res = s.id
    ? await sb.from('hugi_sheets').update(row).eq('id', s.id).select(HUGI_COLS).single()
    : await sb.from('hugi_sheets').insert(row).select(HUGI_COLS).single();
  btns.forEach(function (b) { b.disabled = false; });
  if (res.error) { hugiSay('저장하지 못했습니다: ' + res.error.message, 'bad'); hugiPaintState(); return false; }
  hugiDraftDrop(s);
  var saved = res.data;
  HG.list = HG.list.filter(function (x) { return x.id !== saved.id; }).concat([saved])
    .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
  var qa = s.qa;     // 빈 칸은 화면에 남겨 둡니다(계속 쓰는 중일 수 있으니)
  HG.cur = JSON.parse(JSON.stringify(saved));
  HG.cur.qa = qa.length ? qa : [{ q: '', a: '' }];
  HG.dirty = false;
  hugiPaintState();
  hugiSay(submit ? '다 썼어요! 선생님이 한글 파일로 받습니다.' : '저장했습니다.');
  return true;
}

async function hugiDelete() {
  var s = HG.cur;
  if (!s.id || !confirm('이 후기를 지울까요? 되살릴 수 없습니다.')) return;
  const { error } = await sb.from('hugi_sheets').delete().eq('id', s.id);
  if (error) { hugiSay('지우지 못했습니다: ' + error.message, 'bad'); return; }
  hugiDraftDrop(s);
  HG.list = HG.list.filter(function (x) { return x.id !== s.id; });
  HG.dirty = false;
  hugiBack(true);
}

function hugiBack(force) {
  if (!force && HG.dirty && !document.getElementById('hugi-edit').hidden &&
      !confirm('저장하지 않은 글이 있습니다. 그래도 목록으로 갈까요?\n(이 기기에는 적어 두었으니 다시 열면 이어서 쓸 수 있습니다)')) return;
  HG.dirty = false;
  HG.cur = null;
  hugiShowList();
  hugiPaintList();
  window.scrollTo(0, 0);
}

// 휴대폰 뒤로가기·머리줄 «뒤로» — 쓰는 중이면 목록으로. 목록이면 false(홈으로 갑니다)
function hugiHandleBack() {
  if (!document.getElementById('hugi-edit').hidden) { hugiBack(); return true; }
  return false;
}

// ══════════════ 선생님 — 학생 한 명 «📝 면접 후기» 탭 ══════════════
var HGT = { student: null, list: [] };
async function hugiTeacherTab(student) {
  var box = document.getElementById('t-hugi-list');
  if (!box || !student) return;
  HGT.student = student;
  box.innerHTML = '<p class="empty">불러오는 중...</p>';
  const { data, error } = await sb.from('hugi_sheets').select(HUGI_COLS)
    .eq('student_id', student.id).order('created_at', { ascending: true });
  if (HGT.student !== student) return;
  if (error) { box.innerHTML = '<p class="empty">후기를 불러오지 못했습니다: ' + esc(error.message) + '</p>'; return; }
  HGT.list = data || [];
  document.getElementById('t-hugi-all').hidden = HGT.list.length < 2;
  if (!HGT.list.length) {
    box.innerHTML = '<p class="empty">이 학생은 아직 면접 후기를 쓰지 않았습니다.</p>';
    return;
  }
  box.innerHTML = HGT.list.map(function (s) {
    var done = !!s.submitted_at;
    return '<div class="hg-tcard">' +
      '<div class="hg-tcard-head"><div><b>' + esc(s.univ || '대학을 안 적음') + '</b> ' + esc(s.major || '') +
        ' <span class="hg-state' + (done ? ' done' : '') + '">' + (done ? '다 씀' : '쓰는 중') + '</span></div>' +
        '<button class="ghost" onclick="hugiTeacherOne(\'' + s.id + '\')">⬇️ 한글로 받기</button></div>' +
      hugiSheetViewHTML(s) + '</div>';
  }).join('');
}
function hugiTeacherOne(id) {
  var s = HGT.list.filter(function (x) { return x.id === id; })[0];
  if (s) hugiDownloadOne(s, HGT.student);
}
async function hugiTeacherAll() {
  if (!HGT.list.length) return;
  var st = HGT.student;
  await hugiDownloadMany(HGT.list.map(function (s) { return { sheet: s, student: st }; }),
    '면접후기_' + st.student_no + '_' + st.name + '.zip');
}

// ══════════════ 선생님 — 반 전체 한꺼번에 ══════════════
// 왼쪽 명단에서 고른 반(또는 전체)의 학생들 후기를 한 번에 읽어(요청 1번) zip 하나로 받습니다.
async function hugiDownloadClass(list, label) {
  if (!list || !list.length) { hugiSay('받을 학생이 없습니다.', 'bad'); return; }
  var btn = document.getElementById('btn-hugi-class');
  if (btn) btn.disabled = true;
  try {
    var q = sb.from('hugi_sheets').select(HUGI_COLS).order('created_at', { ascending: true });
    // 반을 골랐으면 그 학생들만. 전체면 거르지 않습니다(같은 학교 것만 읽힙니다 — 주소가 너무 길어지지 않게)
    if (list.length <= 80) q = q.in('student_id', list.map(function (s) { return s.id; }));
    const { data, error } = await q;
    if (error) { hugiSay('후기를 불러오지 못했습니다: ' + error.message, 'bad'); return; }
    var byId = {};
    list.forEach(function (s) { byId[s.id] = s; });
    var rows = (data || []).filter(function (r) { return byId[r.student_id]; });
    var none = list.filter(function (s) { return !rows.some(function (r) { return r.student_id === s.id; }); });
    if (!rows.length) { hugiSay(label + ' 학생들이 아직 면접 후기를 쓰지 않았습니다.', 'bad'); return; }
    var done = rows.filter(function (r) { return r.submitted_at; }).length;
    var msg = label + ' 면접 후기 ' + rows.length + '개를 한글 파일로 받습니다(압축 파일 하나).\n' +
              '다 씀 ' + done + '개 · 쓰는 중 ' + (rows.length - done) + '개 — 쓰는 중인 것은 파일 이름 끝에 «(쓰는중)» 이 붙습니다.';
    if (none.length) msg += '\n\n아직 안 쓴 학생 ' + none.length + '명: ' +
      none.slice(0, 12).map(function (s) { return s.name; }).join(', ') + (none.length > 12 ? ' 외' : '');
    if (!confirm(msg)) return;
    rows.sort(function (a, b) {
      return String(byId[a.student_id].student_no).localeCompare(String(byId[b.student_id].student_no)) ||
             String(a.created_at).localeCompare(String(b.created_at));
    });
    var d = new Date();
    await hugiDownloadMany(rows.map(function (r) { return { sheet: r, student: byId[r.student_id] }; }),
      '면접후기_' + label.replace(/\s+/g, '') + '_' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + '.zip');
  } catch (e) {
    hugiSay('한글 파일을 만들지 못했습니다: ' + e.message, 'bad');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ══════════════ 관리자 — «면접 후기 양식» ══════════════
// 교육청 양식이 바뀌면: 기본 양식(또는 새 양식)을 한글에서 열어 칸마다 자리표를 적고 HWPX 로 저장 → 여기에 올리기.
// 올리기 전에 어떤 자리표를 찾았는지 보여 주고, 견본(가짜 학생)으로 한 장 받아 볼 수 있습니다.
var HUGI_SAMPLE = {
  track: '자연', univ: '○○대학교', major: '○○공학과', adm_type: '종합', adm_name: '○○인재전형', result: '불합격', wait_no: '12',
  school_act: '과학탐구 동아리에서 1년 동안 ○○ 실험', outside_act: '교육청 ○○ 캠프',
  qa: [{ q: '지원한 동기를 말해 주세요.', a: '어릴 때부터 ○○에 관심이 있었고…' },
       { q: '동아리에서 한 실험 중 기억에 남는 것은?', a: '변인을 바꿔 가며 ○○를 쟀습니다…' }],
  feeling: '전공 관련 이슈를 한두 개 알아 두면 좋겠습니다.', etc_note: '○○대 ○○학과 지원(합격)', consent: true,
  submitted_at: '2026-10-07T00:00:00Z', created_at: new Date().toISOString()
};
var HUGI_SAMPLE_STUDENT = { student_no: '30000', name: '견본학생' };

async function hugiAdminPaint() {
  var box = document.getElementById('hugi-admin-state');
  if (!box) return;
  box.textContent = '불러오는 중...';
  try {
    var t = await hugiGetTemplate(true);
    box.innerHTML = t.from === 'school'
      ? '지금 쓰는 양식: <b>' + esc(t.name || '올린 양식') + '</b> (' + esc(String(t.updated_at || '').slice(0, 10)) + ' 올림)'
      : '지금 쓰는 양식: <b>기본 양식</b> (2025학년도 합격사례 양식에 자리표를 넣은 것)';
    document.getElementById('btn-hugi-reset').hidden = t.from !== 'school';
  } catch (e) { box.textContent = '양식을 확인하지 못했습니다: ' + e.message; }
}
function hugiAdminFieldsHTML() {
  return '<table class="hg-ftable"><tbody>' + HUGI_FIELDS.map(function (f) {
    return '<tr><td><code>{{' + esc(f[0]) + '}}</code></td><td>' + esc(f[1]) + '</td></tr>';
  }).join('') + '</tbody></table>';
}
async function hugiAdminDownloadBase() {
  try {
    var t = await hugiGetTemplate();
    hugiSaveBlob(new Blob([t.buf], { type: 'application/hwp+zip' }), t.from === 'school' ? (t.name || '면접후기-양식.hwpx') : '면접후기-기본양식.hwpx');
  } catch (e) { hugiSay('양식을 받지 못했습니다: ' + e.message, 'bad'); }
}
async function hugiAdminSample() {
  try {
    var t = await hugiGetTemplate();
    hugiSaveBlob(await hugiMakeHwpx(t.buf, HUGI_SAMPLE, HUGI_SAMPLE_STUDENT), '면접후기-견본.hwpx');
  } catch (e) { hugiSay('견본을 만들지 못했습니다: ' + e.message, 'bad'); }
}
async function hugiAdminUpload(input) {
  var f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  if (!/\.hwpx$/i.test(f.name)) { hugiSay('hwpx 파일만 올릴 수 있습니다. 한글에서 «다른 이름으로 저장 → HWPX» 로 저장해 주세요.', 'bad'); return; }
  if (f.size > 3 * 1024 * 1024) { hugiSay('파일이 너무 큽니다(3MB 까지). 그림이 들어 있으면 빼 주세요.', 'bad'); return; }
  try {
    var buf = await f.arrayBuffer();
    var r = await hugiScanTemplate(buf);
    if (!r.known.length) { hugiSay('이 양식에서 자리표({{지원대학}} 같은 것)를 하나도 못 찾았습니다.', 'bad'); return; }
    var msg = '«' + f.name + '» 에서 찾은 자리표 ' + r.known.length + '개:\n' + r.known.join(', ');
    if (r.unknown.length) msg += '\n\n⚠️ 모르는 자리표(그대로 남습니다): ' + r.unknown.join(', ');
    if (r.missing.length) msg += '\n\n이 양식에 없는 것(괜찮으면 그냥 두세요): ' + r.missing.join(', ');
    msg += '\n\n이 양식으로 바꿀까요? 선생님들이 받는 한글 파일이 이 양식으로 나옵니다.';
    if (!confirm(msg)) return;
    const { error } = await sb.from('hugi_templates').upsert({
      school_id: SCHOOL_ID, file_b64: hugiBufToB64(buf), file_name: f.name, fields: r.known, updated_at: new Date().toISOString()
    }, { onConflict: 'school_id' });
    if (error) { hugiSay('올리지 못했습니다: ' + error.message, 'bad'); return; }
    hugiSay('양식을 바꿨습니다. «견본 받기» 로 한 장 열어 확인해 보세요.');
    hugiAdminPaint();
  } catch (e) { hugiSay('양식을 읽지 못했습니다: ' + e.message, 'bad'); }
}
async function hugiAdminReset() {
  if (!confirm('올린 양식을 지우고 기본 양식으로 되돌릴까요?')) return;
  const { error } = await sb.from('hugi_templates').delete().eq('school_id', SCHOOL_ID);
  if (error) { hugiSay('되돌리지 못했습니다: ' + error.message, 'bad'); return; }
  hugiSay('기본 양식으로 되돌렸습니다.');
  hugiAdminPaint();
}
