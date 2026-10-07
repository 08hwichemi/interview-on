// 면접 후기 — 학생 쓰기 · 선생님 한글(hwpx) 받기 · 반 전체 압축 · 관리자 양식 올리기 (hugi.js)
//
// 한글 파일이 «한글에서 열리는지» 는 여기서 못 봅니다(한글 프로그램이 없음). 대신 받은 파일을 풀어
// ① 맨 앞 mimetype 이 압축 없이 들어 있는지 ② XML 이 깨지지 않았는지 ③ 자리표가 다 바뀌었는지 ④ 값이 제자리에 있는지 봅니다.
// 받은 견본은 이 폴더에 hugi-sample.hwpx 로 떨어집니다 — 한글에서 직접 열어 보세요.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SB = fs.readFileSync(path.join(__dirname, 'stub5.js'), 'utf8');
// cdnjs 가 막힌 곳에서도 돌게 JSZip 을 로컬에서 끼워 넣습니다(자리는 컨테이너에 따라 다를 수 있습니다)
const JSZIP_PATH = ['/opt/node-tools/node_modules/jszip/dist/jszip.min.js'].concat(
  (() => { try { return [require.resolve('jszip/dist/jszip.min.js')]; } catch (e) { return []; } })()).find(f => fs.existsSync(f));
const JSZIP = fs.readFileSync(JSZIP_PATH, 'utf8');
let 실패 = 0;
function 확인(무엇, ok, 덧) { console.log((ok ? '  ✓ ' : '  ✗ ') + 무엇 + (덧 ? '  → ' + 덧 : '')); if (!ok) 실패++; }
const SCHOOL = '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c';

async function 준비(b, rows, size) {
  const ctx = await b.newContext({ viewport: size || { width: 1400, height: 950 }, acceptDownloads: true });
  await ctx.route('**/supabase-js*/**', r => r.fulfill({ contentType: 'application/javascript', body: SB }));
  await ctx.route('**/pretendard*', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('**/jszip*', r => r.fulfill({ contentType: 'application/javascript', body: JSZIP }));
  await ctx.addInitScript(r => { window.__FAKE__ = { rows: r }; }, rows);
  // ⚠️ 시험용 크로뮴은 한글 파일 이름을 «download» 로 바꿔 버립니다(진짜 크롬은 괜찮음 — check-practice-export.js 와 같은 사정).
  //    그래서 누르는 순간의 a.download 를 적어 두고 그것으로 봅니다
  await ctx.addInitScript(() => {
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlName = this.download; return click.call(this); };
  });
  return ctx;
}
// 받은 hwpx(파일 경로) → 페이지 안에서 풀어 section0.xml 글과 앞머리 검사 결과
async function 풀기(p, file) {
  const b64 = fs.readFileSync(file).toString('base64');
  return p.evaluate(async b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const name = new TextDecoder().decode(u.slice(30, 30 + (u[26] | (u[27] << 8))));
    const method = u[8] | (u[9] << 8);
    const zip = await JSZip.loadAsync(u.buffer);
    const xml = await zip.file('Contents/section0.xml').async('string');
    const bad = new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length;
    const mt = await zip.file('mimetype').async('string');
    return { first: name, method, xml, bad, mt, files: Object.keys(zip.files) };
  }, b64);
}
// 문단마다 글 한 줄 — 빈 문단은 ''
const 글만 = xml => (xml.match(/<hp:p\b[^>]*>(?:(?!<hp:p\b)[\s\S])*?<\/hp:p>/g) || [])
  .map(p => (p.match(/<hp:t>([^<]*)<\/hp:t>/g) || []).map(t => t.replace(/<\/?hp:t>/g, '')).join(''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ════════════ 1. 채우는 엔진 ════════════
  console.log('\n════ 1. 한글 양식 채우기 ════');
  {
    const ctx = await 준비(b, { profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘', school_id: SCHOOL, must_change_password: false }] });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');

    // 견본(가짜 학생)으로 기본 양식을 채워 받습니다 — 학생 글에 < & " 를 섞어 봅니다
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => {
      HUGI_SAMPLE.feeling = '첫 줄 <b>&"따옴표"\n둘째 줄';
      return hugiAdminSample();
    })]);
    const file = path.join(__dirname, 'hugi-sample.hwpx');
    await dl.saveAs(file);
    확인('파일 이름이 «면접후기-견본.hwpx»', (await p.evaluate(() => window.__dlName)) === '면접후기-견본.hwpx');
    const r = await 풀기(p, file);
    확인('맨 앞이 mimetype 이고 압축하지 않았는가(한글이 여는 규칙)', r.first === 'mimetype' && r.method === 0, r.first + ' / ' + r.method);
    확인('mimetype 글이 그대로인가', r.mt === 'application/hwp+zip');
    확인('파일 짜임이 양식과 같은가(폴더 항목을 더하지 않음)', JSON.stringify(r.files) === JSON.stringify(['mimetype', 'version.xml', 'Contents/header.xml',
      'Contents/section0.xml', 'Preview/PrvText.txt', 'settings.xml', 'Preview/PrvImage.png', 'META-INF/container.rdf', 'Contents/content.hpf',
      'META-INF/container.xml', 'META-INF/manifest.xml']), JSON.stringify(r.files));
    확인('XML 이 깨지지 않았는가', r.bad === 0);
    확인('자리표가 하나도 안 남았는가', r.xml.indexOf('{{') === -1);
    const t = 글만(r.xml);
    확인('제목 — 「2027학년도 … 합격사례」 + 「(자연계열)」', t.indexOf('2027학년도 수시모집전형 합격사례(자연계열)') > -1, t.slice(0, 4).join(' | '));
    확인('동의 ■', t.some(x => /동의합니다\. ■$/.test(x)) && !t.some(x => x.indexOf('□') > -1));
    확인('지원대학 · 학과 · 전형명', ['○○대학교', '○○공학과', '○○인재전형'].every(x => t.indexOf(x) > -1));
    확인('학생부종합에만 O (교과 칸은 빈칸)', t.filter(x => x === 'O').length === 1);
    확인('불합격 + 예비 12 → 예비순위 칸 «12 (불합격)»', t.indexOf('12 (불합격)') > -1);
    확인('질문이 「1. …」「2. …」 문단으로 나뉘고 사이에 빈 줄', (() => {
      const i = t.indexOf('1. 지원한 동기를 말해 주세요.');
      return i > -1 && t[i + 1] === '' && t[i + 2] === '2. 동아리에서 한 실험 중 기억에 남는 것은?';
    })(), t.filter(x => /^\d\. /.test(x)).join(' | '));
    확인('답변도 같은 번호로', t.indexOf('1. 어릴 때부터 ○○에 관심이 있었고…') > -1 && t.indexOf('2. 변인을 바꿔 가며 ○○를 쟀습니다…') > -1);
    확인('여러 줄 소감은 문단 둘로 · < & " 는 안전하게', r.xml.indexOf('<hp:t>첫 줄 &lt;b&gt;&amp;"따옴표"</hp:t>') > -1 && t.indexOf('둘째 줄') > -1,
         (r.xml.match(/<hp:t>첫 줄[^<]*<\/hp:t>/) || [''])[0]);
    확인('고친 문단의 줄 배치 기억(linesegarray)을 뺐는가', !/○○대학교<\/hp:t><\/hp:run><hp:linesegarray>/.test(r.xml));
    확인('실제 학생(30224) 내용이 기본 양식에 안 남았는가', ['수원', '전기전자', '버킷리스트', '가천대'].every(x => r.xml.indexOf(x) === -1));

    console.log('\n── 자리표가 글자 조각 여럿에 걸쳐 쪼개져 있어도 ──');
    const 쪼갬 = await p.evaluate(() => {
      const HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
      const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec xmlns:hs="x" xmlns:hp="' + HP + '">' +
        '<hp:p><hp:run charPrIDRef="1"><hp:t>대학: {{지원</hp:t></hp:run><hp:run charPrIDRef="2"><hp:t>대학}} / {{모르는칸}}</hp:t></hp:run>' +
        '<hp:linesegarray><hp:lineseg/></hp:linesegarray></hp:p></hs:sec>';
      const found = {};
      const out = hugiFillXml(xml, { '지원대학': '가나대학교' }, found);
      return { out, found: Object.keys(found) };
    });
    확인('두 조각에 걸친 {{지원대학}} 이 바뀌는가', 쪼갬.out.indexOf('<hp:t>대학: 가나대학교</hp:t>') > -1 && 쪼갬.out.indexOf('<hp:t> / {{모르는칸}}</hp:t>') > -1, 쪼갬.out);
    확인('모르는 자리표는 그대로 두고 «찾은 것» 에 들어가는가', 쪼갬.found.indexOf('모르는칸') > -1);
    확인('XML 머리말이 그대로인가', 쪼갬.out.indexOf('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>') === 0);

    const scan = await p.evaluate(async () => { const t = await hugiGetTemplate(); return hugiScanTemplate(t.buf); });
    확인('기본 양식 검사 — 17개 찾음, 모르는 것 없음', scan.known.length === 17 && !scan.unknown.length, JSON.stringify(scan));
    확인('기본 양식에 없는 것은 학번·이름·전형유형·합격사항', JSON.stringify(scan.missing) === JSON.stringify(['학번', '이름', '전형유형', '합격사항']), JSON.stringify(scan.missing));
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ════════════ 2. 학생 — 쓰기 ════════════
  console.log('\n════ 2. 학생 — 면접 후기 쓰기 (420px) ════');
  {
    const ctx = await 준비(b, {
      profiles: [{ id: 'u1', role: 'student', name: '고다윤', login_id: '30101', school_id: SCHOOL, must_change_password: false }],
      students: [{ id: 's1', student_no: '30101', name: '고다윤', auth_user_id: 'u1', grade: 3 }],
      reviews: [], questions: [], practice_answers: [], practice_comments: [], practice_offers: [],
      hugi_sheets: [],
      susi_plans: [
        { school_id: SCHOOL, student_no: '30101', slot: 1, uni_name: '수원대학교', dept_name: '전기전자공학부', type_name: '교과', admission_name: '고교추천전형' },
        { school_id: SCHOOL, student_no: '30101', slot: 2, uni_name: '가천대학교', dept_name: '금융빅데이터학부', type_name: '종합', admission_name: '가천바람개비' }
      ]
    }, { width: 420, height: 900 });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const 물음 = []; p.on('dialog', async d => { 물음.push(d.message()); await d.accept(); });
    await p.goto('http://127.0.0.1:8777/'); await p.waitForSelector('#screen-home.active', { timeout: 15000 });

    확인('홈에 «면접 후기 쓰기» 메뉴', await p.isVisible('.menu-btn:has-text("면접 후기 쓰기")'));
    await p.click('.menu-btn:has-text("면접 후기 쓰기")');
    await p.waitForSelector('#screen-hugi.active'); await p.waitForTimeout(300);
    확인('머리줄 제목', (await p.textContent('#app-title')) === '면접 후기 쓰기');
    확인('«아직 쓴 후기가 없습니다»', /아직 쓴 후기가 없습니다/.test(await p.textContent('#hugi-list')));

    await p.click('#hugi-home button:has-text("새 후기 쓰기")'); await p.waitForTimeout(300);
    확인('내 수시 지원 두 곳이 고르는 칸에', await p.evaluate(() => document.querySelectorAll('#hugi-pick-list .hg-card').length === 2));
    await p.click('#hugi-pick-list .hg-card:has-text("수원대학교")'); await p.waitForTimeout(200);
    확인('대학·학과·전형명이 미리 채워짐', await p.evaluate(() => {
      const v = [...document.querySelectorAll('#hugi-form input.hg-in')].map(x => x.value);
      return v[0] === '수원대학교' && v[1] === '전기전자공학부' && v[2] === '고교추천전형';
    }));
    확인('교과 → «학생부교과(면접형)» 가 눌림', (await p.textContent('#hugi-form .prac-chip[aria-pressed="true"]')) === '학생부교과(면접형)');
    확인('질문 칸이 처음에 셋', await p.evaluate(() => document.querySelectorAll('#hugi-qa .hg-qa').length === 3));
    확인('처음엔 «다 썼어요» 가 막혀 있고 무엇이 빠졌는지 알려 줌', await p.evaluate(() =>
      document.getElementById('hugi-done').disabled && /계열.*면접 질문.*개인 정보 동의/.test(document.getElementById('hugi-miss').textContent)));

    await p.fill('#hugi-qa .hg-qa:nth-child(1) textarea >> nth=0', '대학교에서 이루고 싶은 버킷리스트는?');
    await p.fill('#hugi-qa .hg-qa:nth-child(1) textarea >> nth=1', '기후 변화에 대처하는 전기 장치를 만들고 싶다고 답함');
    확인('쓰면 «저장하지 않은 글이 있습니다»', /저장하지 않은 글/.test(await p.textContent('#hugi-state')));
    확인('쓰는 동안 이 기기에 적어 둠', await p.evaluate(() => !!localStorage.getItem('hugiDraft:s1:new')));
    await p.click('#hugi-edit button:has-text("저장")'); await p.waitForTimeout(300);
    const 표1 = await p.evaluate(() => window.__T.hugi_sheets);
    확인('저장 → 서버에 한 줄(쓰는 중)', 표1.length === 1 && !표1[0].submitted_at && 표1[0].univ === '수원대학교' && 표1[0].adm_type === '교과' && 표1[0].school_id === '9bf9d65d-9cb0-428b-90a5-0c4b868dc40c');
    확인('빈 질문 칸은 서버에 안 들어감', 표1[0].qa.length === 1);
    확인('화면에는 빈 칸이 그대로(계속 쓸 수 있게)', await p.evaluate(() => document.querySelectorAll('#hugi-qa .hg-qa').length === 3));
    확인('저장하면 기기에 적어 둔 것은 지움', await p.evaluate(() => !localStorage.getItem('hugiDraft:s1:new')));

    await p.click('#hugi-form .prac-chip:has-text("자연")');
    await p.click('#hugi-form .prac-chip:has-text("불합격")');
    await p.fill('#hugi-form input[placeholder^="예비"]', '12');
    await p.click('#hugi-form .hg-consent input');
    await p.click('#hugi-edit .hg-addq'); await p.waitForTimeout(100);
    확인('«질문 더하기» 로 넷째 칸', await p.evaluate(() => document.querySelectorAll('#hugi-qa .hg-qa').length === 4));
    확인('계열·질문·동의를 채우면 «다 썼어요» 가 눌림', await p.evaluate(() => !document.getElementById('hugi-done').disabled));
    await p.click('#hugi-done'); await p.waitForTimeout(300);
    const 표2 = await p.evaluate(() => window.__T.hugi_sheets);
    확인('다 썼어요 → 같은 줄을 고침(새 줄 아님) · 다 쓴 때가 남음', 표2.length === 1 && !!표2[0].submitted_at && 표2[0].result === '불합격' && 표2[0].wait_no === '12' && 표2[0].consent === true && 표2[0].track === '자연');

    console.log('\n── 뒤로가기 ──');
    await p.fill('#hugi-form textarea[placeholder^="후배"]', '전기 관련 이슈를 알아 두면 좋습니다');
    물음.length = 0;
    await p.click('#backBtn'); await p.waitForTimeout(200);
    확인('쓰다가 «뒤로» → 홈이 아니라 목록, 저장 안 했으면 물어봄', await p.evaluate(() =>
      document.getElementById('screen-hugi').classList.contains('active') && !document.getElementById('hugi-home').hidden) && 물음.length === 1);
    확인('목록에 «다 씀 ✓» 카드', /수원대학교[\s\S]*다 씀 ✓/.test(await p.textContent('#hugi-list')));
    await p.click('#hugi-list .hg-card'); await p.waitForTimeout(200);
    확인('다시 열면 «저장 안 한 글» 을 이어 쓸지 물어봄', 물음.some(m => /저장하지 않고 나간 글/.test(m)));
    확인('이어 쓰면 소감이 살아 있음', (await p.inputValue('#hugi-form textarea[placeholder^="후배"]')) === '전기 관련 이슈를 알아 두면 좋습니다');
    await p.click('#hugi-done'); await p.waitForTimeout(300);
    await p.click('#backBtn'); await p.waitForTimeout(200);
    await p.click('#backBtn'); await p.waitForTimeout(200);
    확인('목록에서 «뒤로» → 홈', await p.evaluate(() => document.getElementById('screen-home').classList.contains('active')));

    console.log('\n── 둘째 후기 · 지우기 ──');
    await p.click('.menu-btn:has-text("면접 후기 쓰기")'); await p.waitForTimeout(300);
    await p.click('#hugi-home button:has-text("새 후기 쓰기")'); await p.waitForTimeout(200);
    확인('이미 쓴 대학에 «이미 씀»', /수원대학교\s*이미 씀/.test(await p.textContent('#hugi-pick-list')));
    await p.click('#hugi-pick button:has-text("직접 쓰기")'); await p.waitForTimeout(200);
    await p.fill('#hugi-form input.hg-in >> nth=0', '한국외국어대학교');
    await p.click('#hugi-edit button:has-text("저장")'); await p.waitForTimeout(300);
    확인('직접 쓴 후기가 둘째 줄로', (await p.evaluate(() => window.__T.hugi_sheets.length)) === 2);
    await p.click('#hugi-del'); await p.waitForTimeout(300);
    확인('지우기 → 한 장만 남고 목록으로', (await p.evaluate(() => window.__T.hugi_sheets.length)) === 1 && await p.evaluate(() => !document.getElementById('hugi-home').hidden));
    확인('360px 에서 옆으로 안 넘침', await (async () => {
      await p.setViewportSize({ width: 360, height: 800 });
      await p.click('#hugi-list .hg-card'); await p.waitForTimeout(200);
      return p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    })());
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ════════════ 3. 선생님 — 한 명 · 반 전체 ════════════
  console.log('\n════ 3. 선생님 — 받기 ════');
  {
    const S = (id, no, name) => ({ id, student_no: no, name, auth_user_id: null, grade: 3 });
    const H = (id, sid, univ, done, extra) => Object.assign({ id, student_id: sid, school_id: SCHOOL, track: '인문', univ, major: '국어국문학과',
      adm_type: '종합', adm_name: '학교장추천', result: '최초합격', wait_no: '', school_act: '', outside_act: '',
      qa: [{ q: '지원 동기?', a: '책을 좋아해서' }], feeling: '', etc_note: '', consent: true,
      submitted_at: done ? '2026-10-06T00:00:00Z' : null, created_at: '2026-10-0' + (id.length % 5 + 1) + 'T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' }, extra || {});
    const ctx = await 준비(b, {
      profiles: [{ id: 'u1', role: 'teacher', name: '이용휘', login_id: '이용휘', school_id: SCHOOL, must_change_password: false }],
      students: [S('s1', '30101', '고다윤'), S('s2', '30102', '김서준'), S('s3', '30201', '이하늘')],
      practice_answers: [], practice_comments: [], practice_categories: [],
      hugi_sheets: [H('h1', 's1', '한국외국어대학교', true), H('h2', 's1', '중앙대학교', false, { result: '' }), H('h3', 's3', '경희대학교', true)]
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const 물음 = []; p.on('dialog', async d => { 물음.push(d.message()); await d.accept(); });
    await p.goto('http://127.0.0.1:8777/teacher/'); await p.waitForSelector('#app:not([hidden])');
    await p.evaluate(async () => { me = { id: 't1', name: '이용휘' }; await loadStudents(); });
    await p.waitForTimeout(200);

    확인('명단 아래 «전체 면접 후기 받기» 단추', (await p.textContent('#btn-hugi-class')).indexOf('전체 면접 후기 받기') > -1);
    await p.click('#class-chips .chip:has-text("1반")'); await p.waitForTimeout(100);
    확인('반을 고르면 «3학년 1반 면접 후기 받기»', (await p.textContent('#btn-hugi-class')).indexOf('3학년 1반 면접 후기 받기') > -1);

    const [dz] = await Promise.all([p.waitForEvent('download'), p.click('#btn-hugi-class')]);
    확인('반 전체 → 묻는 글에 개수·쓰는 중·안 쓴 학생', 물음.length === 1 && /후기 2개/.test(물음[0]) && /쓰는 중 1개/.test(물음[0]) && /안 쓴 학생 1명: 김서준/.test(물음[0]), 물음[0]);
    확인('압축 파일 이름 «면접후기_3학년1반_날짜.zip»', /^면접후기_3학년1반_\d{4}-\d\d-\d\d\.zip$/.test(await p.evaluate(() => window.__dlName)), await p.evaluate(() => window.__dlName));
    const zf = path.join(__dirname, 'hugi-class.zip'); await dz.saveAs(zf);
    const inner = await p.evaluate(async b64 => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const z = await JSZip.loadAsync(u.buffer);
      const out = [];
      for (const n of Object.keys(z.files)) {
        const hz = await JSZip.loadAsync(await z.file(n).async('arraybuffer'));
        const x = await hz.file('Contents/section0.xml').async('string');
        out.push({ n, ok: x.indexOf('{{') === -1 && x.indexOf('(인문계열)') > -1 });
      }
      return out;
    }, fs.readFileSync(zf).toString('base64'));
    확인('안에 한글 파일 2개 — 학번_이름_대학_학과, 쓰는 중은 «(쓰는중)»', JSON.stringify(inner.map(x => x.n).sort()) === JSON.stringify(
      ['30101_고다윤_중앙대학교_국어국문학과(쓰는중).hwpx', '30101_고다윤_한국외국어대학교_국어국문학과.hwpx']), JSON.stringify(inner.map(x => x.n)));
    확인('둘 다 채워졌고 제목이 «(인문계열)»', inner.every(x => x.ok));
    const 반요청 = await p.evaluate(() => window.__calls.filter(c => c.table === 'hugi_sheets' || c.table === 'hugi_templates').length);
    확인('서버에 쓰는 요청은 없음(읽기만)', 반요청 === 0);
    fs.unlinkSync(zf);

    console.log('\n── 학생 한 명 «🗒️ 면접 후기» 탭 ──');
    await p.evaluate(async () => { await pickStudent('s1'); }); await p.waitForTimeout(200);
    await p.click('#setup-tab-hugi'); await p.waitForTimeout(300);
    확인('그 학생 후기 두 장이 읽기로', await p.evaluate(() => document.querySelectorAll('#t-hugi-list .hg-tcard').length === 2));
    확인('질문·답변이 보임', /1\. 지원 동기\?[\s\S]*책을 좋아해서/.test(await p.textContent('#t-hugi-list')));
    확인('두 장이면 «모두 받기» 단추', await p.isVisible('#t-hugi-all'));
    const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#t-hugi-list .hg-tcard:has-text("한국외국어대학교") button')]);
    확인('한 장 받기 — 파일 이름', (await p.evaluate(() => window.__dlName)) === '30101_고다윤_한국외국어대학교_국어국문학과.hwpx', await p.evaluate(() => window.__dlName));
    await p.evaluate(async () => { await pickStudent('s2'); }); await p.waitForTimeout(300);
    확인('다른 학생을 골라도 후기 탭을 이어 가고, 안 쓴 학생이면 안내', /아직 면접 후기를 쓰지 않았습니다/.test(await p.textContent('#t-hugi-list')) &&
      await p.evaluate(() => !document.getElementById('setup-hugi').hidden));
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ════════════ 4. 관리자 — 양식 올리기 ════════════
  console.log('\n════ 4. 관리자 — 양식 올리기 ════');
  {
    const ctx = await 준비(b, {
      profiles: [{ id: 'u1', role: 'admin', name: '관리자', login_id: 'admin', school_id: SCHOOL, must_change_password: false }],
      students: [], hugi_templates: []
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const 물음 = []; p.on('dialog', async d => { 물음.push(d.message()); await d.accept(); });
    await p.goto('http://127.0.0.1:8777/admin/'); await p.waitForTimeout(1200);
    await p.click('#tab-data'); await p.waitForTimeout(500);
    확인('지금 쓰는 양식: 기본 양식', /기본 양식/.test(await p.textContent('#hugi-admin-state')));
    확인('자리표 목록 21개', await p.evaluate(() => document.querySelectorAll('#hugi-admin-fields tr').length === 21));
    확인('처음엔 «기본 양식으로 되돌리기» 가 숨어 있음', await p.evaluate(() => document.getElementById('btn-hugi-reset').hidden));

    // 새 양식 = 기본 양식에 «{{이름}}» 을 하나 더하고 «{{없는칸}}» 을 넣은 것
    const 새양식 = path.join(__dirname, 'hugi-new.hwpx');
    const b64 = await p.evaluate(async () => {
      const t = await hugiGetTemplate();
      const z = await (await hugiLoadJSZip()).loadAsync(t.buf);
      let x = await z.file('Contents/section0.xml').async('string');
      x = x.replace('<hp:t>{{지원대학}}</hp:t>', '<hp:t>{{지원대학}} ({{이름}}) {{없는칸}}</hp:t>');
      z.file('Contents/section0.xml', x);
      return hugiZipOut(z, 'base64');
    });
    fs.writeFileSync(새양식, Buffer.from(b64, 'base64'));
    물음.length = 0;
    // ⚠️ 경로에 한글(«화면-시험»)이 있으면 Playwright 가 파일을 못 붙입니다 — 내용으로 넘깁니다
    await p.setInputFiles('#hugi-admin-file', { name: 'hugi-new.hwpx', mimeType: 'application/hwp+zip', buffer: fs.readFileSync(새양식) });
    await p.waitForTimeout(600);
    확인('올리기 전에 찾은 자리표 · 모르는 자리표를 보여 주고 물음', 물음.length === 1 && /찾은 자리표 18개/.test(물음[0]) && /모르는 자리표.*없는칸/.test(물음[0]), 물음[0]);
    const 양식표 = await p.evaluate(() => window.__T.hugi_templates);
    확인('서버에 학교 양식 한 줄(파일·이름·찾은 자리표)', 양식표.length === 1 && 양식표[0].file_name === 'hugi-new.hwpx' && 양식표[0].fields.indexOf('이름') > -1 && 양식표[0].file_b64.length > 1000);
    확인('지금 쓰는 양식이 올린 것으로', /hugi-new\.hwpx/.test(await p.textContent('#hugi-admin-state')) && await p.evaluate(() => !document.getElementById('btn-hugi-reset').hidden));
    const [ds] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("견본 받기")')]);
    const sf = path.join(__dirname, 'hugi-new-sample.hwpx'); await ds.saveAs(sf);
    const rs = await 풀기(p, sf);
    확인('올린 양식으로 견본이 나옴 — {{이름}} 채움, 모르는 칸은 그대로', rs.xml.indexOf('<hp:t>○○대학교 (견본학생) {{없는칸}}</hp:t>') > -1);
    fs.unlinkSync(sf); fs.unlinkSync(새양식);
    await p.click('#btn-hugi-reset'); await p.waitForTimeout(400);
    확인('되돌리기 → 서버 줄 지움 · 다시 기본 양식', (await p.evaluate(() => window.__T.hugi_templates.length)) === 0 && /기본 양식/.test(await p.textContent('#hugi-admin-state')));
    물음.length = 0;
    await p.setInputFiles('#hugi-admin-file', { name: 'x.hwp', mimeType: 'application/octet-stream', buffer: Buffer.from('abc') });
    await p.waitForTimeout(200);
    확인('hwp(옛 형식)는 안 받음 — 물음 없이 안내만', 물음.length === 0 && (await p.evaluate(() => window.__T.hugi_templates.length)) === 0);
    확인('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(실패 ? '\n❌ ' + 실패 + '개 실패' : '\n✅ 모두 통과');
  process.exit(실패 ? 1 : 0);
})();
