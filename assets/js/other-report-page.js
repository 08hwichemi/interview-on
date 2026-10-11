// 타학교 면접 평가서 — 학생 폰에서 엽니다 (r.html)
//
// 선생님 화면이 띄운 QR = «r.html#긴열쇠». 열쇠는 주소의 # 뒤라 GitHub 서버에도 안 갑니다.
// 서버 함수 other_report(k) 가 열쇠가 맞고 하루가 안 지났을 때만 평가서를 내줍니다(로그인 없음).
// 평가서 모양은 우리 학생이 받는 것과 같은 종이입니다(report.js 의 reportHTML).
//
// «PDF로 저장» — 브라우저 인쇄창을 거치지 않고 이 폰에서 바로 PDF 파일을 만듭니다.
//   아이폰은 인쇄창에서 PDF 로 저장하는 길이 너무 멀어서입니다(공유 → 프린트 → 두 손가락으로 벌리기 …).
//   평가서를 칸(질문 하나, 채점표 한 줄 …)마다 그림으로 떠서(html2canvas) A4 에 차례로 붙입니다(jsPDF).
//   한 번에 통째로 뜨지 않는 까닭: 길면 그림이 너무 커져서 아이폰이 하얀 그림을 내놓습니다.
//   칸이 쪽 끝에 걸리면 다음 쪽으로 넘기고, 한 쪽보다 긴 칸(아주 긴 답변)만 잘라 이어 붙입니다.
//   도구 두 개(assets/vendor)는 단추를 누를 때만 받습니다.

var R = { iv: null, answers: [], who: '' };

function rToast(msg) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show';
  setTimeout(function () { el.className = 'toast'; }, 3500);
}

function rMsg(html) {
  var m = document.getElementById('r-msg');
  m.innerHTML = html;
  m.hidden = false;
}

// 「10월 16일(목) 오후 3:20」
function rWhen(iso) {
  var d = new Date(iso), h = d.getHours(), m = d.getMinutes();
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + '일월화수목금토'.charAt(d.getDay()) + ') ' +
    (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m);
}

(async function () {
  var key = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
  if (!key) {
    rMsg('<b>주소가 잘렸습니다.</b><br>선생님 화면의 QR 코드를 다시 찍어 주세요.');
    return;
  }
  if (typeof sb === 'undefined') {
    rMsg('<b>평가서를 불러오지 못했습니다.</b><br>인터넷 연결을 확인하고 새로고침해 주세요.');
    return;
  }
  var res;
  try { res = await sb.rpc('other_report', { k: key }); }
  catch (e) { res = { error: e }; }
  if (res.error) {
    rMsg('<b>평가서를 불러오지 못했습니다.</b><br>인터넷 연결을 확인하고 새로고침해 주세요.<br>' +
         '<span style="font-size:12px;color:var(--ink-3)">' + esc((res.error && res.error.message) || res.error) + '</span>');
    return;
  }
  var data = res.data;
  if (!data || !data.interview) {
    rMsg('<b>열 수 없는 평가서입니다.</b><br>평가서는 선생님이 QR 을 보여 준 때부터 <b>하루 동안만</b> 열리고 그 뒤에는 지워집니다.<br>' +
         '시간이 남았는데 이 글이 보이면 QR 을 다시 찍어 주세요.');
    return;
  }

  R.iv = data.interview;
  R.answers = data.answers || [];
  R.who = [R.iv.other_name, R.iv.other_school, R.iv.other_major ? R.iv.other_major + ' 희망' : '']
    .filter(function (x) { return x; }).join(' · ');
  document.title = (R.iv.other_name || '') + ' 면접 평가서 · 면접ON';
  document.getElementById('r-msg').hidden = true;
  document.getElementById('r-badge').hidden = false;
  document.getElementById('r-body').innerHTML = reportHTML(R.iv, R.answers, R.who, null);
  document.getElementById('r-until').innerHTML = R.iv.share_until
    ? '<b>' + esc(rWhen(R.iv.share_until)) + '</b>까지만 열립니다. 그 뒤에는 지워지니 지금 저장해 두세요.'
    : '';
  document.getElementById('r-save').hidden = false;
})();

function rFileName() {
  return '면접평가서_' + String((R.iv && R.iv.other_name) || '').replace(/[\\/:*?"<>|\s]+/g, '') ;
}

// 인쇄창으로 — PDF 단추가 안 먹는 브라우저(카카오톡 안 브라우저 등)를 위한 길
function otherPagePrint() {
  printReport('r-body', rFileName());
}

// ── PDF ──
var R_LIBS = ['assets/vendor/html2canvas.min.js', 'assets/vendor/jspdf.umd.min.js'];
var rLibsReady = null;
function rLoadLibs() {
  if (window.html2canvas && window.jspdf) return Promise.resolve();
  if (rLibsReady) return rLibsReady;
  rLibsReady = Promise.all(R_LIBS.map(function (src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = function () { fail(new Error(src + ' 을 받지 못했습니다')); };
      document.head.appendChild(s);
    });
  })).catch(function (e) { rLibsReady = null; throw e; });
  return rLibsReady;
}

// 쪽에 붙일 칸들 — 머리 · 소제목 · 질문 하나하나 · 채점표 한 줄 한 줄 · 총평
function rBlocks(root) {
  var out = [];
  Array.prototype.forEach.call(root.children, function (el) {
    if (el.classList.contains('rp-answers') || el.classList.contains('rp-sheet')) {
      Array.prototype.forEach.call(el.children, function (c) { out.push(c); });
    } else out.push(el);
  });
  return out;
}

// 긴 칸을 쪽 끝에서 자를 자리 — from(화면 px)부터 len 만큼 들어가는데, 그 끝이 글줄을 가로지르면
// 위로 올라가며 «진한 점이 하나도 없는 줄»(글줄 사이 틈)을 찾아 거기서 자릅니다. 못 찾으면 그대로.
// 처음엔 그냥 잘라서 한 줄이 위아래 쪽에 반씩 나뉘어 찍혔습니다(2026-10-11 시험 그림).
function rLineGap(cv, sc, from, len) {
  var g = cv.getContext('2d');
  var w = cv.width, end = Math.round((from + len) * sc), stop = Math.round((from + len - 60) * sc);
  for (var y = end; y > stop && y > Math.round(from * sc); y--) {
    var row = g.getImageData(0, y, w, 1).data, dark = false;
    for (var x = 0; x < row.length; x += 8) {           // 두 칸씩 건너 봅니다(4값 × 2)
      if (row[x] * 0.3 + row[x + 1] * 0.59 + row[x + 2] * 0.11 < 170) { dark = true; break; }
    }
    if (!dark) return y / sc - from;
  }
  return len;
}

async function otherPagePdf() {
  if (!R.iv) return;
  var btn = document.getElementById('r-pdf');
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'PDF 만드는 중... (몇 초 걸립니다)';
  var root = null;
  try {
    await rLoadLibs();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    // 인쇄본과 같은 촘촘한 모양(report.css 의 #print-root)을 종이 폭(688px)으로 화면 밖에 폅니다
    root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.className = 'report';
    root.innerHTML = reportHTML(R.iv, R.answers, R.who, null);
    root.style.cssText = 'display:block;position:absolute;left:-10000px;top:0;width:' + PAGE_W + 'px;background:#fff;zoom:1';

    var JsPDF = window.jspdf.jsPDF;
    var pdf = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
    var M = 14, W = 210 - M * 2;           // 여백 14mm, 글 폭 182mm — 인쇄본(@page)과 같습니다
    var k = W / PAGE_W;                    // 1px → mm
    var H = PAGE_H;                        // 한 쪽에 들어가는 높이(px)

    var box0 = root.getBoundingClientRect();
    var blocks = rBlocks(root).map(function (el) {
      var r = el.getBoundingClientRect();
      return { el: el, top: r.top - box0.top, bottom: r.bottom - box0.top,
               left: r.left - box0.left, width: r.width, sec: el.classList.contains('sec') };
    });

    var pageStart = blocks.length ? blocks[0].top : 0;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      // 소제목은 다음 칸과 같이 넘깁니다(소제목만 쪽 끝에 홀로 남지 않게)
      var need = b.bottom;
      if (b.sec && blocks[i + 1]) need = Math.min(blocks[i + 1].bottom, b.bottom + 120);
      if (need - pageStart > H && b.top > pageStart) { pdf.addPage(); pageStart = b.top; }

      var cv = await window.html2canvas(b.el, { scale: 2, backgroundColor: '#ffffff', logging: false });
      var sc = cv.height / Math.max(1, b.bottom - b.top);   // 그림 px / 화면 px
      var h = b.bottom - b.top, done = 0;
      while (done < h - 0.5) {
        var y = b.top + done - pageStart;
        var room = H - y;
        if (room < 24) { pdf.addPage(); pageStart = b.top + done; y = 0; room = H; }
        var part = Math.min(room, h - done);
        // 쪽 끝에서 자를 때는 글줄 한가운데가 아니라 줄 사이 빈 틈에서 자릅니다
        if (part < h - done) part = rLineGap(cv, sc, done, part);
        var piece = cv;
        if (part < h || done > 0) {
          // 한 쪽보다 긴 칸 — 이 쪽에 들어갈 만큼만 잘라 붙입니다
          piece = document.createElement('canvas');
          piece.width = cv.width;
          piece.height = Math.max(1, Math.round(part * sc));
          piece.getContext('2d').drawImage(cv, 0, Math.round(done * sc), cv.width, piece.height, 0, 0, cv.width, piece.height);
        }
        pdf.addImage(piece.toDataURL('image/jpeg', 0.92), 'JPEG', M + b.left * k, M + y * k, b.width * k, part * k);
        done += part;
      }
    }

    // 쪽 번호 (한글 글꼴을 PDF 에 넣지 않으려고 숫자만)
    var n = pdf.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(p + ' / ' + n, 210 / 2, 297 - 7, { align: 'center' });
    }
    // 내려받기 고리를 직접 만들어 누릅니다 — 「면접평가서_홍길동.pdf」
    var url = URL.createObjectURL(pdf.output('blob'));
    var a = document.createElement('a');
    a.href = url;
    a.download = rFileName() + '.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 60000);
    rToast('PDF 를 저장했습니다. «다운로드» 또는 «파일» 에서 찾으세요.');
  } catch (e) {
    console.error(e);
    rToast('PDF 를 만들지 못했습니다. 아래 «인쇄창으로 저장» 을 눌러 주세요.');
  } finally {
    if (root) { root.style.cssText = ''; root.innerHTML = ''; }
    btn.disabled = false;
    btn.textContent = label;
  }
}
