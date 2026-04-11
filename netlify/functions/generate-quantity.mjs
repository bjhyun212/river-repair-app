// netlify/functions/generate-quantity.mjs
import ExcelJS from 'exceljs';

const thin = { style: 'thin', color: { argb: 'FF000000' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const numFmt = '#,##0';
const numFmt2 = '#,##0.00';
const numFmt3 = '#,##0.000';
const hFill = 'FFD9E2F3';
const catFill = 'FFDBEAFE';
const sagubFill = 'FFFFF7ED';
const gwFill = 'FFFEF2F2';
const hFont = { name: 'Malgun Gothic', size: 9, bold: true };
const hAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };

function s(cell, opts = {}) {
  cell.border = border;
  if (opts.fill) cell.fill = { type: 'pattern', pattern: 'darkGray', fgColor: { argb: opts.fill } };
  if (opts.font) cell.font = opts.font;
  cell.alignment = opts.alignment || { vertical: 'middle', wrapText: true };
  if (opts.fmt) cell.numFmt = opts.fmt;
}

function qtyFmt(unit) {
  if (unit === 'ton') return numFmt3;
  if (['㎥','㎡','m','hr'].includes(unit)) return numFmt2;
  return numFmt;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const { siteName, riverBank, analysisData } = await req.json();
  const { items, materials } = analysisData;
  const feeRate = 0.015;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('수량산출서', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { width: 7 }, { width: 22 }, { width: 28 }, { width: 7 }, { width: 12 },
    { width: 65 }, { width: 12 }, { width: 25 },
  ];

  // 제목
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = `수량산출서 — 소규모주민숙원사업 (${siteName || '○○'})`;
  ws.getCell('A1').font = { name: 'Malgun Gothic', size: 14, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  // 헤더
  const headers = ['번호', '공종명(ID)', '규격', '단위', '자재구분', '산출근거 (상세 계산식)', '설계수량', '비고'];
  const row2 = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = row2.getCell(i + 1);
    cell.value = h;
    s(cell, { fill: hFill, font: hFont, alignment: hAlign });
  });

  let row = 3;
  let num = 1;

  const allCats = [
    { key: '토공', label: '1. 토공' },
    { key: '구조물공', label: '2. 구조물공' },
    { key: '포장공', label: '3. 포장공' },
    { key: '부대공', label: '4. 부대공' },
  ];

  for (const cat of allCats) {
    // 대분류 행
    ws.mergeCells(`A${row}:H${row}`);
    ws.getCell(`A${row}`).value = cat.label;
    s(ws.getCell(`A${row}`), { fill: catFill, font: hFont });
    row++;

    for (const item of (items[cat.key] || [])) {
      // 자재구분 판정
      let matType = '해당없음';
      const gwNames = (materials?.관급 || []).map(m => m.name);
      const sgNames = (materials?.사급 || []).map(m => m.name);
      if (gwNames.some(n => item.name.includes(n.replace('(자재)', '').split('(')[0]))) matType = '관급';
      if (sgNames.some(n => item.name.includes(n.replace('(자재)', '').split('(')[0]))) matType = '사급';
      if (item.name.includes('레미콘') || item.name.includes('철근') || item.name.includes('석축') || item.name.includes('잡석')) matType = '관급';
      if (item.name.includes('거푸집') || item.name.includes('부직포')) matType = '사급';

      ws.getCell(row, 1).value = num++;
      ws.getCell(row, 2).value = `${item.name} (${item.priceId || ''})`;
      ws.getCell(row, 3).value = item.spec || '';
      ws.getCell(row, 4).value = item.unit || '';
      ws.getCell(row, 5).value = matType;
      ws.getCell(row, 6).value = item.note || '';
      ws.getCell(row, 7).value = item.qty || 0;
      ws.getCell(row, 8).value = item.priceSource || '';

      for (let c = 1; c <= 8; c++) {
        s(ws.getCell(row, c), {
          font: { name: 'Malgun Gothic', size: 9 },
          alignment: { horizontal: [1,4,5].includes(c) ? 'center' : (c === 7 ? 'right' : 'left'), vertical: 'middle', wrapText: true },
          fmt: c === 7 ? qtyFmt(item.unit) : undefined,
        });
      }
      row++;
    }
  }

  // 사급자재
  row++;
  ws.mergeCells(`A${row}:H${row}`);
  ws.getCell(`A${row}`).value = '[ 사급자재 ]';
  s(ws.getCell(`A${row}`), { fill: sagubFill, font: hFont });
  row++;
  for (const m of (materials?.사급 || [])) {
    ws.getCell(row, 2).value = m.name;
    ws.getCell(row, 3).value = m.spec;
    ws.getCell(row, 4).value = m.unit;
    ws.getCell(row, 5).value = '사급';
    ws.getCell(row, 6).value = m.note || '';
    ws.getCell(row, 7).value = m.qty;
    for (let c = 1; c <= 8; c++) s(ws.getCell(row, c), { font: { name: 'Malgun Gothic', size: 9 }, fmt: c === 7 ? qtyFmt(m.unit) : undefined });
    row++;
  }

  // 관급자재
  row++;
  ws.mergeCells(`A${row}:H${row}`);
  ws.getCell(`A${row}`).value = '[ 관급자재 ]';
  s(ws.getCell(`A${row}`), { fill: gwFill, font: hFont });
  row++;
  for (const m of (materials?.관급 || [])) {
    ws.getCell(row, 2).value = m.name;
    ws.getCell(row, 3).value = m.spec;
    ws.getCell(row, 4).value = m.unit;
    ws.getCell(row, 5).value = '관급';
    ws.getCell(row, 6).value = m.note || '';
    ws.getCell(row, 7).value = m.qty;
    for (let c = 1; c <= 8; c++) s(ws.getCell(row, c), { font: { name: 'Malgun Gothic', size: 9 }, fmt: c === 7 ? qtyFmt(m.unit) : undefined });
    row++;
  }

  // 관급수수료
  row++;
  ws.getCell(row, 2).value = '관급수수료 (1.5%)';
  const gwTotal = (materials?.관급 || []).reduce((s, m) => s + Math.round((m.unitPrice||0) * (m.qty||0)), 0);
  ws.getCell(row, 6).value = `관급자재비 합계 ${gwTotal.toLocaleString()}원 × 1.5% = ${Math.round(gwTotal * feeRate).toLocaleString()}원`;
  ws.getCell(row, 7).value = Math.round(gwTotal * feeRate);
  ws.getCell(row, 8).value = '보관·하역·소운반 포함';
  for (let c = 1; c <= 8; c++) s(ws.getCell(row, c), { fill: gwFill, font: hFont, fmt: c === 7 ? numFmt : undefined });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="quantity.xlsx"`,
    },
  });
};

export const config = { path: '/.netlify/functions/generate-quantity' };
