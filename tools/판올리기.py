#!/usr/bin/env python3
"""판 올리기 — 새 판을 올릴 때 이것만 돌리면 됩니다.

    python3 tools/판올리기.py            # 오늘 날짜로 다음 번호
    python3 tools/판올리기.py 2026-09-17.1

왜 필요한가
-----------
GitHub Pages 는 .js .css 를 브라우저에 10분쯤 쥐고 있게 합니다.
그래서 version.txt(항상 새로 받음)만 새것이 되고 js 는 옛것이 남아,
«새 버전» 띠가 뜨는데 새로고침을 눌러도 안 사라지는 일이 생깁니다.

그래서 파일 주소 뒤에 ?v=판번호 를 붙입니다. 판이 바뀌면 주소가 바뀌니
브라우저가 쥐고 있던 옛 파일을 쓸 수 없습니다.

고쳐야 할 곳이 세 군데라 손으로 하면 반드시 한 곳을 빠뜨립니다.
  1. version.txt
  2. assets/js/update-bar.js 의 BUILD_ID
  3. 각 화면(html)이 부르는 우리 파일 주소의 ?v=
"""
import datetime
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ['index.html', 'teacher/index.html', 'admin/index.html']

# 우리 파일만 손댑니다. cdn 주소는 그대로 둡니다.
ASSET = re.compile(r'((?:src|href)=")((?:\.\./)*(?:assets/|manifest\.json)[^"?]*)(\?v=[^"]*)?(")')


def next_version(today):
    cur = (ROOT / 'version.txt').read_text(encoding='utf-8').strip()
    if cur.startswith(today):
        try:
            return '%s.%d' % (today, int(cur.rsplit('.', 1)[1]) + 1)
        except (IndexError, ValueError):
            pass
    return today + '.1'


def main():
    today = datetime.date.today().isoformat()
    ver = sys.argv[1] if len(sys.argv) > 1 else next_version(today)

    (ROOT / 'version.txt').write_text(ver + '\n', encoding='utf-8')

    ub = ROOT / 'assets/js/update-bar.js'
    t = ub.read_text(encoding='utf-8')
    t, n = re.subn(r"var BUILD_ID = '[^']*';", "var BUILD_ID = '%s';" % ver, t)
    if n != 1:
        sys.exit('update-bar.js 에서 BUILD_ID 를 찾지 못했습니다')
    ub.write_text(t, encoding='utf-8')

    total = 0
    for name in HTML:
        p = ROOT / name
        t = p.read_text(encoding='utf-8')
        t, n = ASSET.subn(lambda m: m.group(1) + m.group(2) + '?v=' + ver + m.group(4), t)
        p.write_text(t, encoding='utf-8')
        print('%-20s %d곳' % (name, n))
        total += n

    print('판 %s — 파일 주소 %d곳, version.txt, BUILD_ID 까지 맞췄습니다.' % (ver, total))


if __name__ == '__main__':
    main()
