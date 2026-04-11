// netlify/functions/generate-excel.mjs
import ExcelJS from 'exceljs';

const thin = { style: 'thin', color: { argb: 'FF000000' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const numFmt = '#,##0';

function s(cell, opts = {}) {
  cell.border = border;
  if (opts.fill) cell.fill = { type: 'pattern', pattern: 'darkGray', fgColor: { argb: opts.fill } };
  if (opts.font) cell.font = opts.font;
  cell.alignment = opts.alignment || { vertical: 'middle', wrapText: true };
  if (opts.fmt) cell.numFmt = opts.fmt;
}

const hFill = 'FFD9E2F3';
const catFill = 'FFDBEAFE';
const sagubFill = 'FFFFF7ED';
const gwFill = 'FFFEF2F2';
const totalFill = 'FFD6DCE4';
const navyFill = 'FF1E3A5F';
const hFont = { name: 'Malgun Gothic', size: 9, bold: true };
const hAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const { siteName, riverBank, analysisData } = await req.json();
  const { items, materials } = analysisData;
  const feeRate = 0.015;

  const wb = new ExcelJS.Workbook();

  // ===== 시트1: 설계내역서 (13열 2단 헤더) =====
  const ws = wb.addWorksheet('설계내역서', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { width: 8 }, { width: 24 }, { width: 28 }, { width: 8 }, { width: 6 },
    { width: 12 }, { width: 14 }, { width: 12 }, { width: 14 },
    { width: 12 }, { width: 14 }, { width: 12 }, { width: 14 },
  ];

  // 제목
  ws.mergeCells('A1:M1');
  ws.getCell('A1').value = `설계내역서 — ${siteName || '○○천'} 하천 수해복구 (${riverBank || '좌안'})`;
  ws.getCell('A1').font = { name: 'Malgun Gothic', size: 14, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  // 2단 헤더
  ['A2:A3','B2:B3','C2:C3','D2:D3','E2:E3'].forEach(r => ws.mergeCells(r));
  ['F2:G2','H2:I2','J2:K2','L2:M2'].forEach(r => ws.mergeCells(r));

  const h1 = ['공종','품 명','규 격','수량','단위','합 계','','노 무 비','','재 료 비','','경 비',''];
  h1.forEach((v, i) => { const c = ws.getCell(2, i+1); c.value = v; s(c, { fill: hFill, font: hFont, alignment: hAlign }); });
  const sub = [null,null,null,null,null,'단 가','금 액','단 가','금 액','단 가','금 액','단 가','금 액'];
  sub.forEach((v, i) => { if(v){ const c = ws.getCell(3, i+1); c.value = v; s(c, { fill: hFill, font: hFont, alignment: hAlign }); }});

  let row = 4;
  const sunRow = row;
  ws.mergeCells(`A${row}:E${row}`);
  ws.getCell(`A${row}`).value = '순 공 사 비';
  for(let c=1;c<=13;c++) s(ws.getCell(row,c), { fill: totalFill, font: { name: 'Malgun Gothic', size: 10, bold: true }, alignment: c<=5 ? hAlign : { horizontal: 'right', vertical: 'middle' }, fmt: c>=6?numFmt:undefined });
  row++;

  const categories = [
    { num: '1.', name: '토공', key: '토공' },
    { num: '2.', name: '구조물공', key: '구조물공' },
    { num: '3.', name: '포장공', key: '포장공' },
    { num: '4.', name: '부대공', key: '부대공' },
  ];
  const catRows = {};

  for (const cat of categories) {
    const catRow = row;
    ws.getCell(row,1).value = cat.num;
    ws.getCell(row,2).value = cat.name;
    for(let c=1;c<=13;c++) s(ws.getCell(row,c), { fill: catFill, font: hFont, alignment: c<=2?{horizontal:c===1?'center':'left',vertical:'middle'}:{horizontal:'right',vertical:'middle'}, fmt:c>=6?numFmt:undefined });
    row++;

    const startItem = row;
    const catItems = items[cat.key] || [];
    for (const item of catItems) {
      const totalUnit = (item.labor||0) + (item.material||0) + (item.expense||0);
      ws.getCell(row,2).value = item.name;
      ws.getCell(row,3).value = `${item.spec||''} ${item.priceId||''}`;
      ws.getCell(row,4).value = item.qty;
      ws.getCell(row,5).value = item.unit;
      ws.getCell(row,8).value = item.labor||0;
      ws.getCell(row,10).value = item.material||0;
      ws.getCell(row,12).value = item.expense||0;
      ws.getCell(row,6).value = { formula: `H${row}+J${row}+L${row}` };
      ws.getCell(row,7).value = { formula: `D${row}*F${row}` };
      ws.getCell(row,9).value = { formula: `D${row}*H${row}` };
      ws.getCell(row,11).value = { formula: `D${row}*J${row}` };
      ws.getCell(row,13).value = { formula: `D${row}*L${row}` };
      for(let c=1;c<=13;c++) s(ws.getCell(row,c), { font:{name:'Malgun Gothic',size:9}, alignment:{horizontal:c<=3?(c===1?'center':'left'):(c<=5?'center':'right'),vertical:'middle',wrapText:c<=3}, fmt:c>=4&&c!==5?numFmt:undefined });
      row++;
    }
    const endItem = row - 1;
    if (startItem <= endItem) {
      for(const col of [7,9,11,13]) {
        const L = ['','A','B','C','D','E','F','G','H','I','J','K','L','M'][col];
        ws.getCell(catRow,col).value = { formula: `SUM(${L}${startItem}:${L}${endItem})` };
      }
    }
    catRows[cat.key] = { catRow };
  }

  // 순공사비 수식
  for(const col of [7,9,11,13]) {
    const L = ['','A','B','C','D','E','F','G','H','I','J','K','L','M'][col];
    const refs = categories.filter(c=>catRows[c.key]).map(c=>`${L}${catRows[c.key].catRow}`).join('+');
    ws.getCell(sunRow,col).value = { formula: refs };
  }

  // 사급자재대
  const sagubCatRow = row;
  ws.getCell(row,1).value = '5.'; ws.getCell(row,2).value = '사급자재대';
  for(let c=1;c<=13;c++) s(ws.getCell(row,c), { fill: sagubFill, font: hFont, fmt:c>=6?numFmt:undefined });
  row++;
  const sagubStart = row;
  for(const m of (materials?.사급||[])) {
    ws.getCell(row,2).value = m.name; ws.getCell(row,3).value = m.spec;
    ws.getCell(row,4).value = m.qty; ws.getCell(row,5).value = m.unit;
    ws.getCell(row,6).value = m.unitPrice;
    ws.getCell(row,7).value = { formula: `D${row}*F${row}` };
    for(let c=1;c<=13;c++) s(ws.getCell(row,c), { font:{name:'Malgun Gothic',size:9}, fmt:c>=4&&c!==5?numFmt:undefined });
    row++;
  }
  if(sagubStart<=row-1) ws.getCell(sagubCatRow,7).value = { formula: `SUM(G${sagubStart}:G${row-1})` };

  // 관급자재대
  const gwCatRow = row;
  ws.getCell(row,1).value = '6.'; ws.getCell(row,2).value = '관급자재대';
  for(let c=1;c<=13;c++) s(ws.getCell(row,c), { fill: gwFill, font: hFont, fmt:c>=6?numFmt:undefined });
  row++;
  const gwStart = row;
  for(const m of (materials?.관급||[])) {
    ws.getCell(row,2).value = m.name; ws.getCell(row,3).value = m.spec;
    ws.getCell(row,4).value = m.qty; ws.getCell(row,5).value = m.unit;
    ws.getCell(row,6).value = m.unitPrice;
    ws.getCell(row,7).value = { formula: `D${row}*F${row}` };
    for(let c=1;c<=13;c++) s(ws.getCell(row,c), { font:{name:'Malgun Gothic',size:9}, fmt:c>=4&&c!==5?numFmt:undefined });
    row++;
  }
  if(gwStart<=row-1) ws.getCell(gwCatRow,7).value = { formula: `SUM(G${gwStart}:G${row-1})` };

  // 관급수수료
  const feeRow = row;
  ws.getCell(row,2).value = '관급수수료 (1.5%)';
  ws.getCell(row,7).value = { formula: `ROUND(G${gwCatRow}*0.015,0)` };
  for(let c=1;c<=13;c++) s(ws.getCell(row,c), { fill: gwFill, font: hFont, fmt:c>=6?numFmt:undefined });
  row++;

  // 총공사비
  ws.mergeCells(`A${row}:E${row}`);
  ws.getCell(`A${row}`).value = '총 공 사 비';
  ws.getCell(row,7).value = { formula: `G${sunRow}+G${sagubCatRow}+G${gwCatRow}+G${feeRow}` };
  for(let c=1;c<=13;c++) s(ws.getCell(row,c), { fill: navyFill, font: { name:'Malgun Gothic', size:10, bold:true, color:{argb:'FFFFFFFF'} }, alignment: c<=5?hAlign:{horizontal:'right',vertical:'middle'}, fmt:c>=6?numFmt:undefined });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="estimate.xlsx"`,
    },
  });
};

export const config = { path: '/.netlify/functions/generate-excel' };
