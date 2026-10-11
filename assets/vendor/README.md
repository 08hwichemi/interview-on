# 남이 만든 도구 (그대로 넣어 둔 것)

타학교 면접 평가서(QR · PDF)에 씁니다. **CDN 에서 부르지 않고 여기 넣어 둔 까닭**:
면접 날 CDN 주소가 막히거나 틀리면 QR 도 PDF 도 안 됩니다. 여기 두면 GitHub Pages 가
화면과 같이 내보내니 늘 같이 있습니다. 한 번 넣고 고치지 않습니다.

| 파일 | 무엇 | 판 | 사용 허락 |
|---|---|---|---|
| `qrcode.js` | QR 코드 그리기 (qrcode-generator, Kazuhiko Arase) | 1.4.4 | MIT |
| `jspdf.umd.min.js` | PDF 만들기 (jsPDF) | 2.5.1 | MIT |
| `html2canvas.min.js` | 화면을 그림으로 (html2canvas) | 1.4.1 | MIT |

- `qrcode.js` 는 선생님 화면(`teacher/index.html`)이 처음부터 부릅니다
- `jspdf` · `html2canvas` 는 학생 폰의 평가서(`r.html`)에서 «PDF로 저장» 을 누를 때만 부릅니다
  (`assets/js/other-report-page.js`)
- 각 파일 맨 위에 원래 저작권 글이 그대로 있습니다
