// netlify/functions/generate-unitprice.mjs
import ExcelJS from 'exceljs';

const thin = { style: 'thin', color: { argb: 'FF000000' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const numFmt = '#,##0';
const hFill = 'FFD9E2F3';
const gwFill = 'FFFEF2F2';
const sagubFill = 'FFFFF7ED';
const hFont = { name: 'Malgun Gothic', size: 9, bold: true };
const hAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };

function s(cell, opts = {}) {
  cell.border = border;
  if (opts.fill) cell.fill = { type: 'pattern', pattern: 'darkGray', fgColor: { argb: opts.fill } };
  if (opts.font) cell.font = opts.font;
  cell.alignment = opts.alignment || { vertical: 'middle', wrapText: true };
  if (opts.fmt) cell.numFmt = opts.fmt;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const { siteName, analysisData } = await req.json();
  const { items, materials } = analysisData;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('일위대가 단가산출서', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { width: 10 }, { width: 25 }, { width: 30 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 20 },
  ];

  // 제목
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = `일위대가 단가산출서 — 소규모주민숙원사업 (${siteName || '○○'})`;
  ws.getCell('A1').font = { name: 'Malgun Gothic', size: 14, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  // 헤더
  const headers = ['단가ID', '공종명', '규격', '합계', '노무비', '재료비', '경비', '단위', '단가출처'];
  const row2 = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = row2.getCell(i + 1);
    cell.value = h;
    s(cell, { fill: hFill, font: hFont, alignment: hAlign });
  });

  let row = 3;

  // 모든 적용 공종의 단가 출력
  const allCats = ['토공', '구조물공', '포장공', '부대공'];
  const seenIds = new Set();

  for (const cat of allCats) {
    for (const item of (items[cat] || [])) {
      const id = item.priceId || '';
      if (seenIds.has(id) && id) continue; // 중복 방지
      if (id) seenIds.add(id);

      const total = (item.labor || 0) + (item.material || 0) + (item.expense || 0);

      // 자재구분
      let matType = '해당없음';
      if (item.name.includes('레미콘') || item.name.includes('철근') || item.name.includes('석축') || item.name.includes('잡석')) matType = '관급';
      if (item.name.includes('거푸집') || item.name.includes('부직포')) matType = '사급';

      ws.getCell(row, 1).value = id;
      ws.getCell(row, 2).value = item.name;
      ws.getCell(row, 3).value = item.spec || '';
      ws.getCell(row, 4).value = total;
      ws.getCell(row, 5).value = item.labor || 0;
      ws.getCell(row, 6).value = item.material || 0;
      ws.getCell(row, 7).value = item.expense || 0;
      ws.getCell(row, 8).value = item.unit || '';
      ws.getCell(row, 9).value = item.priceSource || '2025 단가목록';

      for (let c = 1; c <= 9; c++) {
        s(ws.getCell(row, c), {
          font: { name: 'Malgun Gothic', size: 9 },
          alignment: { horizontal: [1,8,9].includes(c) ? 'center' : (c <= 3 ? 'left' : 'right'), vertical: 'middle' },
          fmt: [4,5,6,7].includes(c) ? numFmt : undefined,
        });
      }
      row++;
    }
  }

  // 주석
  row += 2;
  const notes = [
    '※ 본 일위대가표는 시공단가(노무비+재료비+경비)만 포함합니다.',
    '※ 관급자재(레미콘,철근,석재 등) 및 사급자재(거푸집자재,부직포 등)는 별도 산출합니다.',
    '※ 단가적용 원칙: ① 2025년 충청북도 단가목록 우선적용',
    '                   ② 해당 공종이 없을 경우 유사공종 단가 적용',
    '                   ③ 유사공종도 없을 경우 가격정보 또는 물가정보 단가 적용',
  ];
  notes.forEach(n => {
    ws.getCell(`A${row}`).value = n;
    ws.getCell(`A${row}`).font = { name: 'Malgun Gothic', size: 8, color: { argb: 'FF666666' } };
    row++;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="unitprice.xlsx"`,
    },
  });
};

export const config = { path: '/.netlify/functions/generate-unitprice' };
