// 타학교 면접 (other-school.js · r.html · other-report-page.js) — 2026-10-11
//
// 선생님: 왼쪽 «🏫 타학교 면접» → 학생 더하기(이름 · 희망 전공) → 질문 붙여넣기 → 질문지 저장 →
//        목록에서 다시 열기 → 면접(받아 적기) → 마무리 → 평가서 → «QR 로 평가서 주기» → QR 이 그 주소인가(읽어 봄)
// 학생 폰: r.html#열쇠 → 평가서 · 틀린 열쇠/지난 열쇠/잘린 주소 · «PDF로 저장» 이 진짜 PDF 를 내려주는가
//
// QR 을 읽는 데 jsQR 이, PDF 를 보는 데 pdfinfo · pdftoppm 이 있어야 합니다.
//   jsQR 자리: 환경 변수 JSQR (없으면 이 검사만 건너뜀)
//   예) JSQR=/어딘가/node_modules/jsqr/dist/jsQR.js node check-other.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { execSync } = require('child_process');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
const ROOT = path.join(__dirname, '..', '..');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }
const 표 = (p, t) => p.evaluate(t => window.__T[t] || [], t);
const 보임 = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);
const 넘침 = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const SCHOOL = '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c';
const TEACHER_ROWS = () => ({
  profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘', school_id: SCHOOL, must_change_password: false }],
  students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'au1', grade: 3 }],
  interviews: [], interview_answers: []
});

const FAKE_SR = () => {
  window.__recs = [];
  function R() { this.started = false; window.__recs.push(this); }
  R.prototype.start = function () { this.started = true; };
  R.prototype.stop = R.prototype.abort = function () {
    this.started = false; var me = this; setTimeout(function () { me.onend && me.onend(); }, 0);
  };
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
  window.__say = function (text, final) {
    var r = window.__recs[window.__recs.length - 1];
    var one = [{ transcript: text }]; one.isFinal = !!final;
    r.onresult({ resultIndex: 0, results: [one] });
  };
};

async function 준비(b, rows, vw, vh, init) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, acceptDownloads: true });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  if (init) await ctx.addInitScript(init);
  await ctx.addInitScript((rows) => {
    window.__FAKE__ = { profile: { id: 'u1', name: '이용휘', login_id: '이용휘', role: 'teacher' }, rows: rows };
    try { localStorage.clear(); } catch (e) {}
  }, rows);
  const p = await ctx.newPage();
  p.__errs = []; p.on('pageerror', e => p.__errs.push(e.message));
  // 묻는 창(confirm) — 기본은 «예», p.__dialog = 'dismiss' 면 «아니오»
  p.__asked = []; p.on('dialog', d => { p.__asked.push(d.message()); p.__dialog === 'dismiss' ? d.dismiss() : d.accept(); });
  return { ctx, p };
}

(async () => {
  // ⚠️ 이 작업 환경은 언어 설정(LANG)이 비어 있어서, 크롬이 한글 파일 이름을 «download» 로 바꿔 버립니다
  //    (폰·선생님 컴퓨터에서는 안 그럽니다). 그래서 크롬만 UTF-8 로 띄웁니다
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    env: Object.assign({}, process.env, { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }) });

  // ══ 1. 선생님 화면 ══
  console.log('\n── 선생님: 타학교 목록 · 학생 더하기 ──');
  let { ctx, p } = await 준비(b, TEACHER_ROWS(), 1512, 1000, FAKE_SR);
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(async () => { me = { id: 'u1', name: '이용휘' }; await loadStudents(); });
  확인('처음엔 «우리 학교» 탭 · 명단이 보임', await 보임(p, '#student-list') && !(await 보임(p, '#other-list')));
  await p.click('#rail-tab-other'); await p.waitForTimeout(200);
  확인('«타학교 면접» 탭을 누르면 명단 대신 타학교 목록', !(await 보임(p, '#student-list')) && await 보임(p, '#other-head'));
  확인('비었을 때 안내', (await p.textContent('#other-list')).indexOf('아직 없습니다') > -1);
  확인('오른쪽 첫 화면이 타학교 안내로', await 보임(p, '#view-empty .other-only') && !(await 보임(p, '#view-empty .ours-only')));

  await p.click('.otheradd'); await p.waitForTimeout(200);
  확인('준비 화면 + 이름 칸에 커서', await p.evaluate(() => !document.getElementById('view-setup').hidden && document.activeElement.id === 'other-name'));
  for (const [sel, 무엇] of [['#btn-talk', '톡'], ['.prac-tabs.ours-only', '답안 연습장·후기 탭'], ['#history-box', '지난 면접'], ['#susi-box', '수시 지원']]) {
    확인('우리 학교 것은 가려짐: ' + 무엇, !(await 보임(p, sel)));
  }
  확인('생기부 뽑기 · 학생 질문 단추는 가려지고 «여러 질문 붙여넣기» 가 보임',
       await p.evaluate(() => {
         const btns = Array.from(document.querySelectorAll('#qsect-body .btnrow button')).filter(x => x.offsetParent);
         const t = btns.map(x => x.textContent).join('|');
         return t.indexOf('생기부') === -1 && t.indexOf('학생 질문') === -1 && t.indexOf('붙여넣기') > -1 && t.indexOf('직접 적기') > -1;
       }));

  console.log('\n── 질문 붙여넣기 ──');
  await p.click('text=📋 여러 질문 붙여넣기');
  await p.fill('#other-paste-text', '1. 탐구 주제를 고른 까닭은 무엇인가요?\n2) 실험에서 가장 어려웠던 점은?\n\n- 탐구 주제를 고른 까닭은 무엇인가요?\nQ3. 우리 학과에 와서 하고 싶은 공부는?');
  await p.click('text=«낼 질문» 에 넣기'); await p.waitForTimeout(100);
  const mid = await p.evaluate(() => midQuestions.map(q => q.text));
  확인('번호를 떼고 3개만 들어감(같은 것은 건너뜀)', JSON.stringify(mid) === JSON.stringify(['탐구 주제를 고른 까닭은 무엇인가요?', '실험에서 가장 어려웠던 점은?', '우리 학과에 와서 하고 싶은 공부는?']), JSON.stringify(mid));
  확인('붙여넣기 칸은 닫힘', !(await 보임(p, '#other-paste')));

  console.log('\n── 이름 없이는 저장 안 됨 → 이름 적고 저장 ──');
  await p.click('#btn-save-sheet'); await p.waitForTimeout(200);
  확인('이름이 없으면 저장하지 않고 이름 칸으로', (await 표(p, 'interviews')).length === 0 && await p.evaluate(() => document.activeElement.id === 'other-name'));
  await p.fill('#other-name', '홍길동'); await p.fill('#other-major', '컴퓨터공학과');
  확인('학교를 안 적으면 머리에 «타학교 홍길동»', (await p.textContent('#target-name')) === '타학교 홍길동');
  await p.fill('#other-school', '한빛고');
  확인('학교를 적으면 머리에 «한빛고 홍길동»', (await p.textContent('#target-name')) === '한빛고 홍길동');
  await p.click('#btn-save-sheet'); await p.waitForTimeout(300);
  let ivs = await 표(p, 'interviews');
  확인('질문지 줄 하나 — 학생 칸은 비고 이름·희망 전공이 들어감',
       ivs.length === 1 && ivs[0].student_id === null && ivs[0].other_name === '홍길동' && ivs[0].other_major === '컴퓨터공학과' && ivs[0].status === '준비중',
       JSON.stringify(ivs[0]));
  확인('학교도 저장', ivs[0].other_school === '한빛고');
  확인('질문 5개 저장(첫인사 + 3 + 끝인사)', (await 표(p, 'interview_answers')).filter(a => a.interview_id === ivs[0].id).length === 5);
  확인('목록에 «홍길동 · 컴퓨터공학과 · 질문 준비»', (await p.textContent('#other-list')).replace(/\s+/g, '').indexOf('홍길동컴퓨터공학과질문준비') > -1, await p.textContent('#other-list'));
  // 이름을 고쳐 다시 저장하면 같은 줄이 고쳐짐
  await p.fill('#other-major', '소프트웨어학과'); await p.click('#btn-save-sheet'); await p.waitForTimeout(300);
  ivs = await 표(p, 'interviews');
  확인('다시 저장하면 새 줄이 아니라 그 줄이 고쳐짐', ivs.length === 1 && ivs[0].other_major === '소프트웨어학과');

  console.log('\n── 둘째 학생 · 목록에서 다시 열기 ──');
  await p.click('.otheradd'); await p.waitForTimeout(150);
  확인('새 학생은 이름이 빈 칸 · 학교는 마지막에 적은 «한빛고»',
       await p.evaluate(() => document.getElementById('other-name').value === '' && document.getElementById('other-school').value === '한빛고' && midQuestions.length === 0));
  await p.fill('#other-school', '새솔고'); await p.fill('#other-name', '김철수'); await p.click('text=＋ 직접 적기'); await p.keyboard.type('자기 장점을 말해 보세요.');
  await p.click('#btn-save-sheet'); await p.waitForTimeout(300);
  확인('학교별로 묶임(새솔고 1명 → 한빛고 1명)', await p.evaluate(() => Array.from(document.querySelectorAll('#other-list .ohead')).map(x => x.textContent).join(',')) === '▾새솔고1명,▾한빛고1명',
       await p.evaluate(() => Array.from(document.querySelectorAll('#other-list .ohead')).map(x => x.textContent).join(',')));
  console.log('\n── 학교 묶음 접고 펴기 ──');
  await p.click('#other-list .ohead:has-text("새솔고")'); await p.waitForTimeout(100);
  확인('보고 있는 학생(김철수)의 학교는 눌러도 펴 둠', await p.evaluate(() => document.querySelector('#other-list .ohead').getAttribute('aria-expanded') === 'true'));
  await p.click('#other-list .orow:has-text("홍길동")'); await p.waitForTimeout(300);
  확인('다른 학생으로 옮기면 새솔고가 접힘(김철수 줄이 안 보임)', await p.evaluate(() => !document.querySelector('#other-list .nm') || Array.from(document.querySelectorAll('#other-list .nm')).map(x => x.textContent).join(',') === '홍길동'));
  await p.evaluate(() => otherLoad()); await p.waitForTimeout(150);
  확인('목록을 새로 받아도 접힌 채(브라우저에 기억)', await p.evaluate(() => JSON.parse(localStorage.getItem('otherFold'))['새솔고'] === true && document.querySelector('#other-list .ohead').getAttribute('aria-expanded') === 'false'));
  await p.click('#other-list .ohead:has-text("새솔고")'); await p.waitForTimeout(100);
  확인('다시 누르면 펴짐', (await p.textContent('#other-list')).indexOf('김철수') > -1);

  console.log('\n── «명단 저장» — 질문 없이 학교 · 이름 · 희망 전공만 ──');
  await p.click('.otheradd'); await p.waitForTimeout(150);
  await p.fill('#other-school', '다온고'); await p.fill('#other-name', '이영희'); await p.fill('#other-major', '수학과');
  let n0 = (await 표(p, 'interviews')).length;
  await p.press('#other-major', 'Enter'); await p.waitForTimeout(400);
  let yi = (await 표(p, 'interviews')).find(x => x.other_name === '이영희');
  확인('Enter 로 명단 저장 — 학교 · 이름 · 희망 전공 · 질문 준비', (await 표(p, 'interviews')).length === n0 + 1 && yi && yi.other_school === '다온고' && yi.other_major === '수학과' && yi.status === '준비중', JSON.stringify(yi));
  확인('첫인사 · 끝인사도 같이 남김(다시 열 때 꺼지지 않게)', (await 표(p, 'interview_answers')).filter(a => a.interview_id === yi.id).length === 2);
  확인('목록에 바로 뜨고 그 학생이 골라진 채', await p.evaluate((id) => target.ivId === id && !!document.querySelector('#other-list .orow[aria-current="true"]') && document.querySelector('#other-list .orow[aria-current="true"]').textContent.indexOf('이영희') > -1, yi.id));
  await p.fill('#other-major', '수학교육과'); await p.click('.otheracts .btn.solid'); await p.waitForTimeout(300);
  확인('이미 있는 학생은 «명단 저장» 이 그 줄만 고침', (await 표(p, 'interviews')).length === n0 + 1 && (await 표(p, 'interviews')).find(x => x.id === yi.id).other_major === '수학교육과');
  await p.click('.otheradd'); await p.waitForTimeout(150);
  await p.fill('#other-name', '최민수');
  await p.click('text=저장하고 다음 학생'); await p.waitForTimeout(400);
  확인('«저장하고 다음 학생» — 저장되고, 이름은 빈 칸 · 학교는 «다온고» 그대로 · 이름 칸에 커서',
       (await 표(p, 'interviews')).some(x => x.other_name === '최민수' && x.other_school === '다온고') &&
       await p.evaluate(() => document.getElementById('other-name').value === '' && document.getElementById('other-school').value === '다온고' && document.activeElement.id === 'other-name' && !target.ivId));
  p.__dialog = 'dismiss';
  await p.fill('#other-name', '최민수'); await p.press('#other-name', 'Enter'); await p.waitForTimeout(300);
  확인('같은 학교에 같은 이름이면 묻고, «아니오» 면 안 넣음',
       p.__asked.slice(-1)[0].indexOf('이미 명단에') > -1 && (await 표(p, 'interviews')).filter(x => x.other_name === '최민수').length === 1);
  p.__dialog = 'accept';

  console.log('\n── ★ 담당 학생 ──');
  await p.click('#other-list .obody .srow:has-text("이영희") .star'); await p.waitForTimeout(300);
  확인('별을 누르면 계정에 저장', (await 표(p, 'teacher_other_favorites')).some(r => r.interview_id === yi.id && r.teacher_id === 'u1'));
  확인('맨 위 «★ 담당 학생 1명» 에 학교 · 희망 전공과 함께', await p.evaluate(() => {
    const b = document.querySelector('#other-list .ofav'); return !!b && b.textContent.indexOf('담당 학생 1명') > -1 && b.textContent.indexOf('다온고 · 수학교육과') > -1; }));
  await p.evaluate(() => { otherFav = {}; return otherLoad(); }); await p.waitForTimeout(200);
  확인('목록을 새로 받아도 별이 켜진 채', await p.evaluate(() => document.querySelector('#other-list .obody .srow .star[aria-pressed="true"]') !== null && !!document.querySelector('#other-list .ofav')));
  await p.click('#other-list .ofav .star'); await p.waitForTimeout(300);
  확인('다시 누르면 빠지고 담당 학생 칸도 사라짐', !(await 표(p, 'teacher_other_favorites')).length && !(await p.$('#other-list .ofav')));
  // 뒤 검사를 위해 다온고 두 명은 치웁니다
  await p.click('#other-list .ohead:has-text("다온고") ~ .obody .odelall'); await p.waitForTimeout(300);
  확인('다온고 두 명 모두 지우기', !(await 표(p, 'interviews')).some(x => x.other_school === '다온고'));
  await p.click('#other-list .orow:has-text("홍길동")'); await p.waitForTimeout(300);
  확인('홍길동을 누르면 이름·전공·질문이 그대로',
       await p.evaluate(() => document.getElementById('other-name').value === '홍길동' && document.getElementById('other-major').value === '소프트웨어학과' && midQuestions.length === 3 && !document.getElementById('sheet-note').hidden));

  console.log('\n── 면접 · 마무리 ──');
  await p.click('#btn-start'); await p.waitForTimeout(300);
  확인('진행 화면', await p.evaluate(() => !document.getElementById('view-run').hidden));
  await p.click('#btn-answer'); await p.waitForTimeout(150);
  await p.evaluate(() => window.__say('저는 소프트웨어로 사람을 돕고 싶은 홍길동입니다.', true));
  확인('면접 시작 → 진행중 · 시작한 선생님이 적힘', await p.evaluate(() => { const iv = window.__T.interviews.find(x => x.other_name === '홍길동'); return iv.status === '진행중' && iv.teacher_id === 'u1'; }));
  await p.keyboard.press('1');
  for (let i = 0; i < 5; i++) { await p.click('#btn-next'); await p.waitForTimeout(150); }
  확인('마무리 화면 · 이름이 «한빛고 홍길동»', await p.evaluate(() => !document.getElementById('view-finish').hidden && document.getElementById('finish-who').textContent === '한빛고 홍길동'));
  확인('마무리 안내가 QR 로', await 보임(p, '#view-finish .note.other-only') && !(await 보임(p, '#view-finish .note.ours-only')));
  await p.click('#scoresheet .gbtn >> nth=0');
  await p.fill('#finish-note', '결론부터 말하는 연습이 필요합니다.');
  await p.click('#btn-finish'); await p.waitForTimeout(400);
  확인('평가서 화면 · 받아 적은 글이 들어감', await p.evaluate(() => !document.getElementById('view-report').hidden && document.getElementById('report-body').textContent.indexOf('사람을 돕고 싶은') > -1));
  확인('«아직 QR 을 안 보여 줬습니다» · 단추 «QR 로 평가서 주기»',
       (await p.textContent('#report-state')).indexOf('아직 QR') > -1 && (await p.textContent('#btn-deliver')).indexOf('QR 로 평가서 주기') > -1);

  console.log('\n── QR ──');
  const t0 = Date.now();
  await p.click('#btn-deliver'); await p.waitForTimeout(300);
  let iv = (await 표(p, 'interviews')).find(x => x.other_name === '홍길동');
  확인('전달됨 · 열쇠 32자 · 하루 뒤까지', iv.status === '전달됨' && /^[A-Za-z0-9_-]{32}$/.test(iv.share_key) &&
       Math.abs(new Date(iv.share_until) - (t0 + 24 * 3600e3)) < 60e3, iv.share_key + ' ' + iv.share_until);
  확인('QR 창이 뜸', await p.evaluate(() => document.getElementById('qr-overlay').style.display === 'flex'));
  const url = await p.textContent('#qr-url');
  확인('주소 = r.html#열쇠', url === 'http://127.0.0.1:8777/r.html#' + iv.share_key, url);
  확인('QR 이 화면에 크게(300px 넘게)', await p.evaluate(() => document.querySelector('#qr-box svg').getBoundingClientRect().width > 300));
  if (process.env.JSQR) {
    await p.addScriptTag({ path: process.env.JSQR });
    const read = await p.evaluate(async () => {
      const svg = document.querySelector('#qr-box svg');
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      await new Promise(ok => { img.onload = ok; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
      const c = document.createElement('canvas'); c.width = c.height = 400;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 400); g.drawImage(img, 0, 0, 400, 400);
      const d = g.getImageData(0, 0, 400, 400);
      const r = jsQR(d.data, 400, 400);
      return r && r.data;
    });
    확인('QR 을 읽으면 그 주소가 나옴(jsQR)', read === url, read);
  } else console.log('  · JSQR 가 없어 QR 읽기는 건너뜀');
  await p.keyboard.press('Escape');
  확인('Esc 로 닫힘', await p.evaluate(() => document.getElementById('qr-overlay').style.display === 'none'));
  확인('상태가 «QR 로 여는 중» · 단추 «QR 다시 보기»', (await p.textContent('#report-state')).indexOf('QR 로 여는 중') > -1 && (await p.textContent('#btn-deliver')).indexOf('다시 보기') > -1);
  const key1 = iv.share_key;
  await p.evaluate(() => { window.__T.interviews.find(x => x.other_name === '홍길동').share_until = new Date(Date.now() + 3600e3).toISOString(); viewing.interview.share_until = window.__T.interviews.find(x => x.other_name === '홍길동').share_until; });
  await p.click('#btn-deliver'); await p.waitForTimeout(300);
  iv = (await 표(p, 'interviews')).find(x => x.other_name === '홍길동');
  확인('다시 보기 — 열쇠는 그대로, 시간은 지금부터 다시 하루', iv.share_key === key1 && new Date(iv.share_until) - Date.now() > 23.9 * 3600e3);
  await p.click('.qr-btns .btn.solid');
  await p.click('#rail-progress .backbtn'); await p.waitForTimeout(300);
  확인('목록으로 돌아오면 «QR 줌»', (await p.textContent('#other-list')).indexOf('QR 줌') > -1);

  console.log('\n── 🗑 한 명 지우기 ──');
  p.__dialog = 'dismiss';
  await p.click('#other-list .srow:has-text("김철수") .odel'); await p.waitForTimeout(200);
  확인('«아니오» 면 그대로', (await 표(p, 'interviews')).some(x => x.other_name === '김철수') && p.__asked.slice(-1)[0].indexOf('김철수') > -1);
  p.__dialog = 'accept';
  await p.click('#other-list .srow:has-text("김철수") .odel'); await p.waitForTimeout(300);
  확인('«예» 면 서버에서 지워지고 새솔고 묶음도 사라짐',
       !(await 표(p, 'interviews')).some(x => x.other_name === '김철수') && (await p.textContent('#other-list')).indexOf('새솔고') === -1);
  p.__dialog = 'dismiss';
  await p.click('#other-list .srow:has-text("홍길동") .odel'); await p.waitForTimeout(200);
  확인('QR 을 준 학생을 지울 땐 «더는 열리지 않습니다» 를 같이 묻고, «아니오» 면 그대로',
       p.__asked.slice(-1)[0].indexOf('더는 열리지 않습니다') > -1 && (await 표(p, 'interviews')).some(x => x.other_name === '홍길동'));
  p.__dialog = 'accept';
  // 우리 학교 쪽은 그대로인가
  await p.click('#rail-tab-ours'); await p.waitForTimeout(150);
  await p.click('#student-list .railrow'); await p.waitForTimeout(300);
  확인('우리 학생을 고르면 톡·탭·지난 면접이 보이고 이름 칸은 숨음',
       await 보임(p, '#btn-talk') && await 보임(p, '.prac-tabs.ours-only') && await 보임(p, '#history-box') && !(await 보임(p, '.otherform')));
  확인('우리 학생 머리는 «30101 고다윤»', (await p.textContent('#target-name')) === '30101 고다윤');
  확인('콘솔 오류 없음', p.__errs.length === 0, p.__errs.join(' | '));
  const shared = (await 표(p, 'interviews')).find(x => x.other_name === '홍길동');
  const sharedAns = (await 표(p, 'interview_answers')).filter(a => a.interview_id === shared.id);

  console.log('\n── 타학교 «이 리포트 지우기» — 학생 · 질문은 남고 평가만 ──');
  await p.click('#rail-tab-other'); await p.waitForTimeout(300);
  await p.click('#other-list .orow:has-text("홍길동")'); await p.waitForTimeout(400);
  확인('평가서가 열림', await p.evaluate(() => !document.getElementById('view-report').hidden));
  p.__dialog = 'dismiss';
  await p.click('text=이 리포트 지우기'); await p.waitForTimeout(200);
  확인('묻는 글에 «학생과 질문은 남는다» · «QR 도 안 열림» · 🗑 안내',
       ['질문 준비', '더는 열리지 않습니다', '🗑'].every(w => p.__asked.slice(-1)[0].indexOf(w) > -1), p.__asked.slice(-1)[0]);
  확인('«아니오» 면 그대로', (await 표(p, 'interviews')).find(x => x.other_name === '홍길동').status === '전달됨');
  p.__dialog = 'accept';
  await p.click('text=이 리포트 지우기'); await p.waitForTimeout(400);
  const rz = (await 표(p, 'interviews')).find(x => x.other_name === '홍길동');
  const ra = (await 표(p, 'interview_answers')).filter(a => a.interview_id === (rz && rz.id));
  확인('학생은 남고 «질문 준비» · 열쇠 · 채점표 · 총평이 비워짐',
       !!rz && rz.status === '준비중' && rz.share_key === null && rz.share_until === null && Object.keys(rz.grades).length === 0 && rz.overall_note === '' && rz.other_school === '한빛고',
       JSON.stringify(rz));
  확인('질문 5개는 그대로, 받아 적은 글 · 시간 · 판정은 비워짐',
       ra.length === 5 && ra.every(a => a.question && a.transcript === '' && a.seconds === 0 && a.rating === null));
  확인('그 학생의 준비 화면(질문지)으로 · 목록은 «질문 준비»',
       await p.evaluate(() => !document.getElementById('view-setup').hidden && document.getElementById('other-name').value === '홍길동' && sheetId && midQuestions.length === 3) &&
       (await p.textContent('#other-list .srow:has-text("홍길동")')).indexOf('질문 준비') > -1);
  확인('콘솔 오류 없음', p.__errs.length === 0, p.__errs.join(' | '));
  await ctx.close();

  // ══ 2. 끝내지 못한 타학교 면접 이어서 하기 ══
  console.log('\n── 끝내지 못한 타학교 면접 ──');
  const R2 = TEACHER_ROWS();
  R2.interviews = [{ id: 'ivx', student_id: null, other_name: '박영희', other_major: '간호학과', teacher_id: 'u1', teacher_name: '이용휘', status: '진행중', started_at: '2026-10-14T01:00:00Z' }];
  R2.interview_answers = [{ id: 'ax', interview_id: 'ivx', seq: 1, competency: '기타', question: '자기소개를 해 주세요.', seconds: 30, good_tags: [], bad_tags: [], rating: null, memo: '' }];
  ({ ctx, p } = await 준비(b, R2, 1512, 1000));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(async () => { me = { id: 'u1', name: '이용휘' }; await loadStudents(); await loadUnfinished(); });
  await p.waitForTimeout(200);
  확인('첫 화면 «끝내지 못한 면접» 에 «타학교 박영희»', (await p.textContent('#unfinished-list')).indexOf('타학교 박영희') > -1);
  await p.click('#unfinished-list button'); await p.waitForTimeout(300);
  확인('이어서 열리고 진행 상황에 «타학교 박영희»', await p.evaluate(() => !document.getElementById('view-run').hidden && target.other && document.getElementById('progress-who').textContent === '타학교 박영희'));
  console.log('\n── 한 학교 모두 지우기 ──');
  await p.click('#rail-progress .backbtn'); await p.waitForTimeout(300);     // «면접을 접고 목록으로?» → 예
  await p.click('#rail-tab-other'); await p.waitForTimeout(300);
  확인('학교를 안 적은 학생은 «학교 안 적음» 묶음', (await p.textContent('#other-list .ohead')).indexOf('학교 안 적음') > -1);
  await p.click('#other-list .odelall'); await p.waitForTimeout(300);
  확인('«학교 안 적은 학생 1명 모두» 를 묻고 지움', p.__asked.slice(-1)[0].indexOf('1명 모두') > -1 && (await 표(p, 'interviews')).length === 0 &&
       (await p.textContent('#other-list')).indexOf('아직 없습니다') > -1);
  확인('콘솔 오류 없음', p.__errs.length === 0, p.__errs.join(' | '));
  await ctx.close();

  // ══ 3. 휴대폰 400px — 선생님 화면 ══
  console.log('\n── 선생님 화면 400px ──');
  ({ ctx, p } = await 준비(b, TEACHER_ROWS(), 400, 800));
  await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
  await p.evaluate(async () => { me = { id: 'u1', name: '이용휘' }; await loadStudents(); });
  await p.click('#rail-tab-other'); await p.click('.otheradd'); await p.waitForTimeout(200);
  확인('옆으로 넘치지 않음', (await 넘침(p)) <= 0, String(await 넘침(p)));
  확인('이름·희망 전공 칸이 위아래로', await p.evaluate(() => { const a = document.getElementById('other-name').getBoundingClientRect(), c = document.getElementById('other-major').getBoundingClientRect(); return c.top > a.bottom; }));
  await ctx.close();

  // ══ 4. 학생 폰 — r.html ══
  console.log('\n── 학생 폰: 평가서 ──');
  const longSaid = '저는 고등학교 때 데이터로 사람을 돕는 일을 해 보고 싶어서 '.repeat(260);   // 한 쪽보다 길게 — 잘라 이어 붙이는지
  const PHONE = {
    profiles: [], students: [],
    interviews: [Object.assign({}, shared, { share_until: new Date(Date.now() + 5 * 3600e3).toISOString() }),
                 { id: 'old', student_id: null, other_name: '지난학생', other_major: '', status: '전달됨', teacher_name: '이용휘', started_at: '2026-10-01T00:00:00Z',
                   share_key: 'OLDKEYOLDKEYOLDKEYOLDKEYOLDKEY12', share_until: new Date(Date.now() - 3600e3).toISOString() }],
    interview_answers: sharedAns.map((a, i) => i === 1 ? Object.assign({}, a, { transcript: longSaid }) : a)
  };
  ({ ctx, p } = await 준비(b, PHONE, 390, 844));
  await p.goto('http://127.0.0.1:8777/r.html#' + key1); await p.waitForTimeout(600);
  확인('이름 · 학교 · 희망 전공이 머리에', (await p.textContent('#r-body h2')) === '홍길동 · 한빛고 · 소프트웨어학과 희망', await p.textContent('#r-body h2'));
  확인('받아 적은 글 · 총평 · 채점표가 보임', await p.evaluate(() => { const t = document.getElementById('r-body').textContent; return t.indexOf('사람을 돕고 싶은') > -1 && t.indexOf('결론부터 말하는 연습') > -1 && t.indexOf('채점표') > -1; }));
  확인('«언제까지 열립니다» 안내', (await p.textContent('#r-until')).indexOf('까지만 열립니다') > -1);
  확인('옆으로 넘치지 않음(390px)', (await 넘침(p)) <= 0, String(await 넘침(p)));
  확인('rpc 한 번만 부름', await p.evaluate(() => window.__calls.filter(c => c.table === '__rpc').length === 1));

  console.log('\n── PDF ──');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#r-pdf')]);
  const out = path.join(os.tmpdir(), 'other-report-test.pdf');
  await dl.saveAs(out);
  const head = fs.readFileSync(out).slice(0, 5).toString();
  확인('파일 이름 «면접평가서_홍길동.pdf»', dl.suggestedFilename() === '면접평가서_홍길동.pdf', dl.suggestedFilename());
  확인('진짜 PDF', head === '%PDF-', head);
  let pages = 0;
  try { pages = Number((execSync('pdfinfo ' + JSON.stringify(out)).toString().match(/Pages:\s+(\d+)/) || [])[1]); } catch (e) { /* pdfinfo 없음 */ }
  확인('한 쪽보다 긴 답변을 잘라 이어 붙여 3쪽 이상', pages >= 3, pages + '쪽');
  try {
    execSync('pdftoppm -r 50 -png ' + JSON.stringify(out) + ' ' + JSON.stringify(path.join(os.tmpdir(), 'other-pdf')));
    console.log('  · 쪽 그림: ' + path.join(os.tmpdir(), 'other-pdf-*.png') + ' (눈으로 보세요)');
  } catch (e) { /* pdftoppm 없음 */ }
  확인('PDF 를 만든 뒤 단추가 돌아옴', (await p.textContent('#r-pdf')) === '📄 PDF로 저장');
  확인('콘솔 오류 없음', p.__errs.length === 0, p.__errs.join(' | '));

  console.log('\n── 열 수 없는 주소 ──');
  for (const [무엇, hash, 말] of [['틀린 열쇠', '#' + 'x'.repeat(32), '열 수 없는'], ['하루 지난 열쇠', '#OLDKEYOLDKEYOLDKEYOLDKEYOLDKEY12', '열 수 없는'], ['# 뒤가 잘린 주소', '', '주소가 잘렸습니다']]) {
    const q = await ctx.newPage();
    await q.goto('http://127.0.0.1:8777/r.html' + hash); await q.waitForTimeout(400);
    확인(무엇 + ' → «' + 말 + '»', (await q.textContent('#r-msg')).indexOf(말) > -1 && await q.evaluate(() => document.getElementById('r-save').hidden && !document.getElementById('r-body').textContent));
    await q.close();
  }
  await ctx.close();

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
