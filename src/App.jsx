import { useState, useRef, useCallback, useMemo, Fragment } from "react";

/* ============================================================
   소규모주민숙원사업 종합검토보고서 v7.4
   ① 엑셀: 2단헤더 + 색상 + 수식 (xlsx-js-style)
   ② "피해현황" → "설계물량" 명칭 변경
   ③ 설계물량 체크박스 삭제/추가 → 내역서 재계산
   ④ 단위 드롭다운 + 새 공종 자유입력
   ⑤ 브라우저 직접 생성 (서버 불필요)
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const UNITS = ["m²","m³","m","hr","ton","일","식","본","개소","km"];

const PRICE_DB = {
  "#.19":{name:"표토제거(답)",spec:"불도저19ton,T=20CM",unit:"m²",labor:225,material:144,expense:135,total:504},
  "#.22":{name:"표토제거(답외)",spec:"T=20CM,굴삭기0.7㎥",unit:"m²",labor:191,material:59,expense:80,total:330},
  "#.28":{name:"흙깍기",spec:"보통토사,소규모",unit:"m³",labor:1472,material:774,expense:747,total:2993},
  "#.36":{name:"토사깍기",spec:"굴삭기0.7㎥",unit:"m³",labor:887,material:277,expense:373,total:1537},
  "#.57":{name:"구조물터파기",spec:"육상토사,기계100%",unit:"m³",labor:1035,material:323,expense:435,total:1793},
  "#.68":{name:"뒤채움 및 다짐",spec:"소형장비",unit:"m³",labor:9507,material:1337,expense:1467,total:12311},
  "#.70":{name:"되메우기 및 다짐",spec:"소형장비",unit:"m³",labor:8044,material:1131,expense:1241,total:10416},
  "#.77":{name:"기초지정(잡석)",spec:"잡석",unit:"m³",labor:9421,material:956,expense:1360,total:11737},
  "#.87":{name:"절토사면 녹화",spec:"T=10㎝",unit:"m²",labor:28320,material:22842,expense:4324,total:55486},
  "#.127":{name:"사토운반",spec:"토사,L=5.0KM",unit:"m³",labor:4001,material:1876,expense:1525,total:7402},
  "#.155":{name:"석축쌓기",spec:"찰쌓기,T=35cm이하",unit:"m²",labor:50146,material:4625,expense:8819,total:63590},
  "#.156":{name:"석축쌓기",spec:"찰쌓기,T=55cm이하",unit:"m²",labor:45214,material:4476,expense:8534,total:58224},
  "#.171":{name:"레미콘타설(장비)",spec:"무근구조물",unit:"m³",labor:22627,material:2611,expense:3360,total:28598},
  "#.172":{name:"레미콘타설(장비)",spec:"철근구조물",unit:"m³",labor:25892,material:2982,expense:3837,total:32711},
  "#.193":{name:"레미콘타설(펌프차)",spec:"철근(S:8-12cm),TYPE-Ⅱ",unit:"m³",labor:17078,material:2556,expense:4540,total:24174},
  "#.204":{name:"합판거푸집",spec:"(4회) 보통",unit:"m²",labor:37861,material:14845,expense:0,total:52706},
  "#.205":{name:"합판거푸집",spec:"(6회) 간단",unit:"m²",labor:34075,material:13018,expense:0,total:47093},
  "#.216":{name:"철근가공 및 조립",spec:"TYPE-1-1",unit:"ton",labor:763584,material:46877,expense:0,total:810461},
  "#.276":{name:"콘크리트양생",spec:"습윤양생",unit:"m²",labor:1426,material:472,expense:231,total:2129},
  "#.280":{name:"부직포설치",spec:"",unit:"m²",labor:279,material:1693,expense:17,total:1989},
  "#.281":{name:"비닐깔기",spec:"",unit:"m²",labor:32,material:647,expense:0,total:679},
  "#.282":{name:"물푸기",spec:"",unit:"hr",labor:1139,material:2463,expense:635,total:4237},
  "#.326":{name:"절삭후아스팔트덧씌우기",spec:"B-Type(1회절삭,1회포장)",unit:"m²",labor:1873,material:919,expense:1189,total:3981},
  "#.481":{name:"교통통제및안전처리",spec:"500M미만",unit:"일",labor:339608,material:0,expense:0,total:339608},
};

let _nid = 100;
const nid = () => ++_nid;

const makeItems = () => [
  {id:1,cat:"1.",name:"표토제거",spec:"T=20CM,굴삭기0.7㎥(답외)",unit:"m²",qty:35,priceId:"#.22",enabled:true},
  {id:2,cat:"1.",name:"흙깍기",spec:"보통토사,소규모",unit:"m³",qty:40,priceId:"#.28",enabled:true},
  {id:3,cat:"1.",name:"구조물터파기",spec:"육상토사,기계100%",unit:"m³",qty:51,priceId:"#.57",enabled:true},
  {id:4,cat:"2.",name:"기초지정(잡석)",spec:"잡석",unit:"m³",qty:26,priceId:"#.77",enabled:true},
  {id:5,cat:"2.",name:"레미콘타설(펌프차)",spec:"철근(S:8-12cm),TYPE-Ⅱ",unit:"m³",qty:51,priceId:"#.193",enabled:true},
  {id:6,cat:"2.",name:"석축쌓기",spec:"찰쌓기,T=35cm이하",unit:"m²",qty:51,priceId:"#.155",enabled:true},
  {id:7,cat:"2.",name:"합판거푸집",spec:"(4회) 보통",unit:"m²",qty:41,priceId:"#.204",enabled:true},
  {id:8,cat:"2.",name:"철근가공 및 조립",spec:"TYPE-1-1",unit:"ton",qty:2.6,priceId:"#.216",enabled:true},
  {id:9,cat:"2.",name:"콘크리트양생",spec:"습윤양생",unit:"m²",qty:92,priceId:"#.276",enabled:true},
  {id:10,cat:"4.",name:"부직포설치",spec:"",unit:"m²",qty:72,priceId:"#.280",enabled:true},
  {id:11,cat:"4.",name:"비닐깔기",spec:"",unit:"m²",qty:51,priceId:"#.281",enabled:true},
  {id:12,cat:"1.",name:"뒤채움 및 다짐",spec:"소형장비",unit:"m³",qty:35,priceId:"#.68",enabled:true},
  {id:13,cat:"1.",name:"되메우기 및 다짐",spec:"소형장비",unit:"m³",qty:20,priceId:"#.70",enabled:true},
  {id:14,cat:"1.",name:"절토사면 녹화",spec:"T=10㎝",unit:"m²",qty:45,priceId:"#.87",enabled:true},
  {id:15,cat:"1.",name:"사토운반",spec:"토사,L=5.0KM",unit:"m³",qty:308,priceId:"#.127",enabled:true},
  {id:16,cat:"4.",name:"교통통제및안전처리",spec:"500M미만",unit:"일",qty:5,priceId:"#.481",enabled:true},
  {id:17,cat:"4.",name:"물푸기",spec:"",unit:"hr",qty:24,priceId:"#.282",enabled:true},
  {id:18,cat:"3.",name:"절삭후아스팔트덧씌우기",spec:"B-Type(1회절삭,1회포장)",unit:"m²",qty:40,priceId:"#.326",enabled:true},
];
const makeSagub = () => [{id:101,name:"합판거푸집(자재)",spec:"합판,유로폼",unit:"m²",qty:41,unitPrice:12000},{id:102,name:"부직포(자재)",spec:"부직포 원단",unit:"m²",qty:72,unitPrice:1500}];
const makeGwangub = () => [{id:201,sub:"6.1",name:"레미콘",spec:"25-210-12",unit:"m³",qty:51,unitPrice:75000},{id:202,sub:"6.2",name:"이형철근(SD400)",spec:"HD13",unit:"ton",qty:2.6,unitPrice:950000},{id:203,sub:"6.3",name:"석재",spec:"자연석,석축용",unit:"m²",qty:51,unitPrice:45000},{id:204,sub:"6.3",name:"잡석",spec:"25-40mm",unit:"m³",qty:24,unitPrice:22000}];
const FEE_RATE = 0.015;
const makeDmg = () => [{id:1,item:"석축 붕괴",basis:"붕괴 연장 약 20m × 높이 약 2.5m",qty:50,unit:"㎡",enabled:true},{id:2,item:"도로 포장 파손",basis:"파손 연장 약 20m × 폭 약 2.0m",qty:40,unit:"㎡",enabled:true},{id:3,item:"기초 세굴",basis:"세굴 연장 약 20m × 폭 2.5m × 깊이 1.0m",qty:50,unit:"㎥",enabled:true},{id:4,item:"토사 퇴적/유실",basis:"하천 내 토석 퇴적 및 사면 유실",qty:80,unit:"㎥",enabled:true},{id:5,item:"매설관 노출",basis:"노출 연장 약 15m",qty:15,unit:"m",enabled:true},{id:6,item:"사면 붕괴",basis:"도로 상부 사면 붕괴 면적",qty:30,unit:"㎡",enabled:true}];
const DMG_MAP={1:[{did:6,f:1.02}],2:[{did:18,f:1.0}],3:[{did:3,f:1.02},{did:5,f:1.02}],4:[{did:15,f:3.85}],6:[{did:14,f:1.5}]};

/* ============================================================
   xlsx-js-style 로드 (색상+수식+병합 지원)
   ============================================================ */
const loadXLSX = () => new Promise((res, rej) => {
  if (window.XLSX) { res(window.XLSX); return; }
  // xlsx-js-style = SheetJS fork with style support
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
  s.onload = () => { if (window.XLSX) res(window.XLSX); else rej(new Error("XLSX 로드 실패")); };
  s.onerror = () => {
    // fallback to plain SheetJS
    const s2 = document.createElement("script");
    s2.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s2.onload = () => res(window.XLSX);
    s2.onerror = () => rej(new Error("SheetJS CDN 로드 실패"));
    document.head.appendChild(s2);
  };
  document.head.appendChild(s);
});

/* 스타일 헬퍼 */
const hdrStyle = { font:{bold:true,color:{rgb:"FFFFFF"},sz:10}, fill:{fgColor:{rgb:"4472C4"}}, border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true} };
const catStyle = (rgb) => ({ font:{bold:true,sz:10}, fill:{fgColor:{rgb}}, border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}}, alignment:{horizontal:"center",vertical:"center"} });
const numStyle = { numFmt:"#,##0", border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}}, alignment:{horizontal:"right"} };
const txtStyle = { border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}}, alignment:{wrapText:true} };
const totalStyle = (rgb,fontRgb="000000") => ({font:{bold:true,color:{rgb:fontRgb},sz:11},fill:{fgColor:{rgb}},border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"center"},numFmt:"#,##0"});

function sc(ws,r,c,v,s){
  const ref = window.XLSX.utils.encode_cell({r,c});
  if(!ws[ref]) ws[ref] = {};
  ws[ref].v = v;
  if(typeof v === "number") ws[ref].t = "n";
  else if(typeof v === "string" && v.startsWith("=")) { ws[ref].f = v.slice(1); ws[ref].t = "n"; delete ws[ref].v; }
  else ws[ref].t = "s";
  if(s) ws[ref].s = s;
}

/* ============================================================
   설계내역서 엑셀 (13열 2단 헤더 + 색상 + 수식)
   ============================================================ */
async function genDesignXL(items, sagub, gwangub, fr) {
  try {
    const X = await loadXLSX();
    const wb = X.utils.book_new();
    const act = items.filter(i => i.enabled);
    const ws = {};

    // 열 폭
    ws["!cols"] = [{wch:8},{wch:24},{wch:28},{wch:10},{wch:6},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14}];

    // 행0: 제목
    sc(ws,0,0,"설 계 내 역 서 (소규모주민숙원사업)",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});
    ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:12}}];

    // 행1: 단가근거
    sc(ws,1,0,"단가근거: 2025년 충청북도 일위대가 목록표",{font:{sz:9,color:{rgb:"666666"}},alignment:{horizontal:"center"}});
    ws["!merges"].push({s:{r:1,c:0},e:{r:1,c:12}});

    // 행2-3: 2단 헤더
    const h1 = ["공종","품 명","규 격","수량","단위","합 계","","노 무 비","","재 료 비","","경 비",""];
    const h2 = ["","","","","","단가","금액","단가","금액","단가","금액","단가","금액"];
    h1.forEach((v,c) => sc(ws,2,c,v,hdrStyle));
    h2.forEach((v,c) => { if(c>=5) sc(ws,3,c,v,hdrStyle); });
    // rowspan for A-E
    for(let c=0;c<5;c++) ws["!merges"].push({s:{r:2,c},e:{r:3,c}});
    // colspan for 합계/노무비/재료비/경비
    ws["!merges"].push({s:{r:2,c:5},e:{r:2,c:6}});
    ws["!merges"].push({s:{r:2,c:7},e:{r:2,c:8}});
    ws["!merges"].push({s:{r:2,c:9},e:{r:2,c:10}});
    ws["!merges"].push({s:{r:2,c:11},e:{r:2,c:12}});

    let r = 4;
    const cats = ["1.","2.","3.","4."];
    const cn = {"1.":"토공","2.":"구조물공","3.":"포장공","4.":"부대공"};
    const catRows = {};

    // 순공사비 행 (위치 기록용)
    const sunRow = r; r++;

    cats.forEach(cc => {
      const ci = act.filter(i => i.cat === cc);
      if (!ci.length) return;
      const catR = r; r++;
      catRows[cc] = { row: catR, items: [] };
      sc(ws,catR,0,cc,catStyle("DBEAFE"));
      sc(ws,catR,1,cn[cc],catStyle("DBEAFE"));
      for(let c=2;c<13;c++) sc(ws,catR,c,"",catStyle("DBEAFE"));

      ci.forEach(item => {
        const p = PRICE_DB[item.priceId] || {total:0,labor:0,material:0,expense:0};
        const ir = r; r++;
        catRows[cc].items.push(ir);
        sc(ws,ir,0,"",txtStyle);
        sc(ws,ir,1,item.name,txtStyle);
        sc(ws,ir,2,item.spec||"",txtStyle);
        sc(ws,ir,3,item.qty,{...numStyle,numFmt:"#,##0.0##"});
        sc(ws,ir,4,item.unit,{...txtStyle,alignment:{horizontal:"center"}});
        // 수식: F=H+J+L, G=D*F, I=D*H, K=D*J, M=D*L
        sc(ws,ir,5,`=H${ir+1}+J${ir+1}+L${ir+1}`,numStyle);
        sc(ws,ir,6,`=D${ir+1}*F${ir+1}`,numStyle);
        sc(ws,ir,7,p.labor,numStyle);
        sc(ws,ir,8,`=D${ir+1}*H${ir+1}`,numStyle);
        sc(ws,ir,9,p.material,numStyle);
        sc(ws,ir,10,`=D${ir+1}*J${ir+1}`,numStyle);
        sc(ws,ir,11,p.expense,numStyle);
        sc(ws,ir,12,`=D${ir+1}*L${ir+1}`,numStyle);
      });

      // 대분류 SUM
      const irs = catRows[cc].items;
      if(irs.length){
        [6,8,10,12].forEach(c => {
          const col = String.fromCharCode(65+c);
          sc(ws,catR,c,`=SUM(${col}${irs[0]+1}:${col}${irs[irs.length-1]+1})`,{...catStyle("DBEAFE"),numFmt:"#,##0"});
        });
      }
    });

    // 순공사비 행
    const sunS = totalStyle("D6DCE4");
    sc(ws,sunRow,0,"",sunS); sc(ws,sunRow,1,"순 공 사 비",sunS);
    for(let c=2;c<13;c++) sc(ws,sunRow,c,"",sunS);
    ws["!merges"].push({s:{r:sunRow,c:0},e:{r:sunRow,c:1}});
    const catCols = ["1.","2.","3.","4."].filter(c=>catRows[c]);
    [6,8,10,12].forEach(c => {
      const col = String.fromCharCode(65+c);
      const refs = catCols.map(cc => `${col}${catRows[cc].row+1}`).join("+");
      sc(ws,sunRow,c,`=${refs}`,{...sunS,numFmt:"#,##0"});
    });

    // 사급
    const sagubRow = r; r++;
    const sagubS = catStyle("FFF7ED");
    sc(ws,sagubRow,0,"5.",sagubS); sc(ws,sagubRow,1,"사급자재대",sagubS);
    for(let c=2;c<13;c++) sc(ws,sagubRow,c,"",sagubS);
    const sagubItemRows = [];
    sagub.forEach(item => {
      const ir = r; r++; sagubItemRows.push(ir);
      sc(ws,ir,0,"",txtStyle); sc(ws,ir,1,item.name,txtStyle); sc(ws,ir,2,item.spec,txtStyle);
      sc(ws,ir,3,item.qty,numStyle); sc(ws,ir,4,item.unit,{...txtStyle,alignment:{horizontal:"center"}});
      sc(ws,ir,5,item.unitPrice,numStyle); sc(ws,ir,6,`=D${ir+1}*F${ir+1}`,numStyle);
      for(let c=7;c<13;c++) sc(ws,ir,c,"",txtStyle);
    });
    if(sagubItemRows.length) sc(ws,sagubRow,6,`=SUM(G${sagubItemRows[0]+1}:G${sagubItemRows[sagubItemRows.length-1]+1})`,{...sagubS,numFmt:"#,##0"});

    // 관급
    const gwRow = r; r++;
    const gwS = catStyle("FEF2F2");
    sc(ws,gwRow,0,"6.",gwS); sc(ws,gwRow,1,"관급자재대",gwS);
    for(let c=2;c<13;c++) sc(ws,gwRow,c,"",gwS);
    const gwItemRows = [];
    gwangub.forEach(item => {
      const ir = r; r++; gwItemRows.push(ir);
      sc(ws,ir,0,item.sub||"",txtStyle); sc(ws,ir,1,item.name,txtStyle); sc(ws,ir,2,item.spec,txtStyle);
      sc(ws,ir,3,item.qty,numStyle); sc(ws,ir,4,item.unit,{...txtStyle,alignment:{horizontal:"center"}});
      sc(ws,ir,5,item.unitPrice,numStyle); sc(ws,ir,6,`=D${ir+1}*F${ir+1}`,numStyle);
      for(let c=7;c<13;c++) sc(ws,ir,c,"",txtStyle);
    });
    if(gwItemRows.length) sc(ws,gwRow,6,`=SUM(G${gwItemRows[0]+1}:G${gwItemRows[gwItemRows.length-1]+1})`,{...gwS,numFmt:"#,##0"});

    // 관급수수료
    const feeRow = r; r++;
    const feeS = catStyle("FEF2F2");
    sc(ws,feeRow,0,"",feeS); sc(ws,feeRow,1,"관급수수료 (1.5%)",feeS);
    for(let c=2;c<13;c++) sc(ws,feeRow,c,"",feeS);
    sc(ws,feeRow,6,`=ROUND(G${gwRow+1}*0.015,0)`,{...feeS,numFmt:"#,##0"});

    // 총공사비
    const grandRow = r; r++;
    const grandS = totalStyle("1E3A5F","FFFFFF");
    sc(ws,grandRow,0,"",grandS); sc(ws,grandRow,1,"총 공 사 비",grandS);
    for(let c=2;c<13;c++) sc(ws,grandRow,c,"",grandS);
    ws["!merges"].push({s:{r:grandRow,c:0},e:{r:grandRow,c:1}});
    sc(ws,grandRow,6,`=G${sunRow+1}+G${sagubRow+1}+G${gwRow+1}+G${feeRow+1}`,{...grandS,numFmt:"#,##0"});

    ws["!ref"] = X.utils.encode_range({s:{r:0,c:0},e:{r:r,c:12}});
    X.utils.book_append_sheet(wb, ws, "내역서");
    X.writeFile(wb, `설계내역서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
  } catch(e) { alert("엑셀 생성 오류: " + e.message); console.error(e); }
}

/* 수량산출서 (색상 + 서식) */
async function genQtyXL(items, gwangub, fr) {
  try {
    const X = await loadXLSX();
    const wb = X.utils.book_new();
    const act = items.filter(i => i.enabled);
    const ws = {};
    ws["!cols"] = [{wch:7},{wch:22},{wch:28},{wch:7},{wch:12},{wch:55},{wch:10},{wch:15}];

    sc(ws,0,0,"수 량 산 출 서 (소규모주민숙원사업)",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});
    ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:7}}];

    ["번호","공종명","규격","단위","자재구분","산출근거","수량","비고"].forEach((v,c) => sc(ws,1,c,v,hdrStyle));

    act.forEach((item,i) => {
      const r = i+2;
      let mt = "해당없음";
      if(["기초지정","레미콘","석축","철근"].some(n=>item.name.includes(n))) mt="관급";
      if(["합판거푸집","부직포"].some(n=>item.name.includes(n))) mt="사급";
      const mtS = mt==="관급"?{...txtStyle,font:{color:{rgb:"DC2626"}}}:mt==="사급"?{...txtStyle,font:{color:{rgb:"EA580C"}}}:txtStyle;
      sc(ws,r,0,i+1,{...txtStyle,alignment:{horizontal:"center"}});
      sc(ws,r,1,item.name,txtStyle);
      sc(ws,r,2,item.spec||"",txtStyle);
      sc(ws,r,3,item.unit,{...txtStyle,alignment:{horizontal:"center"}});
      sc(ws,r,4,mt,mtS);
      sc(ws,r,5,`설계수량 ${item.qty}${item.unit}`,txtStyle);
      sc(ws,r,6,item.qty,numStyle);
      sc(ws,r,7,item.priceId,txtStyle);
    });

    const gT = gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
    const fee = Math.round(gT*fr);
    const lr = act.length+2;
    sc(ws,lr,0,act.length+1,{...txtStyle,alignment:{horizontal:"center"}});
    sc(ws,lr,1,"관급수수료",txtStyle);
    sc(ws,lr,2,"관급자재비×1.5%",txtStyle);
    sc(ws,lr,3,"식",{...txtStyle,alignment:{horizontal:"center"}});
    sc(ws,lr,4,"관급",{...txtStyle,font:{color:{rgb:"DC2626"}}});
    sc(ws,lr,5,`${fmt(gT)}원 × 1.5% = ${fmt(fee)}원`,txtStyle);
    sc(ws,lr,6,1,numStyle);
    sc(ws,lr,7,"",txtStyle);

    ws["!ref"] = X.utils.encode_range({s:{r:0,c:0},e:{r:lr,c:7}});
    X.utils.book_append_sheet(wb, ws, "수량산출서");
    X.writeFile(wb, `수량산출서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
  } catch(e) { alert("엑셀 오류: "+e.message); }
}

/* 일위대가 (색상 + 서식) */
async function genUnitXL(items) {
  try {
    const X = await loadXLSX();
    const wb = X.utils.book_new();
    const pids = [...new Set(items.filter(i=>i.enabled).map(i=>i.priceId))];
    const ws = {};
    ws["!cols"] = [{wch:10},{wch:25},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:20}];
    sc(ws,0,0,"일위대가 단가목록 (2025년 충청북도)",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});
    ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:8}}];
    ["단가ID","공종명","규격","합계","노무비","재료비","경비","자재구분","비고"].forEach((v,c) => sc(ws,1,c,v,hdrStyle));

    pids.forEach((pid,i) => {
      const p = PRICE_DB[pid]; if(!p) return;
      const r = i+2;
      let mt = "해당없음";
      if(["기초지정","레미콘","석축","철근"].some(n=>p.name.includes(n))) mt="관급(별도)";
      if(["합판거푸집","부직포"].some(n=>p.name.includes(n))) mt="사급(별도)";
      sc(ws,r,0,pid,{...txtStyle,alignment:{horizontal:"center"},font:{color:{rgb:"2563EB"}}});
      sc(ws,r,1,p.name,txtStyle);
      sc(ws,r,2,p.spec,txtStyle);
      sc(ws,r,3,p.total,numStyle);
      sc(ws,r,4,p.labor,numStyle);
      sc(ws,r,5,p.material,numStyle);
      sc(ws,r,6,p.expense,numStyle);
      sc(ws,r,7,mt,mt.includes("관급")?{...txtStyle,font:{color:{rgb:"DC2626"}}}:mt.includes("사급")?{...txtStyle,font:{color:{rgb:"EA580C"}}}:txtStyle);
      sc(ws,r,8,"",txtStyle);
    });

    ws["!ref"] = X.utils.encode_range({s:{r:0,c:0},e:{r:pids.length+1,c:8}});
    X.utils.book_append_sheet(wb, ws, "일위대가");
    X.writeFile(wb, `일위대가_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
  } catch(e) { alert("엑셀 오류: "+e.message); }
}

/* ============================================================ MAIN */
export default function App() {
  const [view, setView] = useState("analysis");
  const [items, setItems] = useState(makeItems());
  const [dmg, setDmg] = useState(makeDmg());
  const [sagub] = useState(makeSagub());
  const [gwangub] = useState(makeGwangub());
  const [editMode, setEditMode] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoModal, setPhotoModal] = useState(false);
  const [comment, setComment] = useState("");
  const [xlLoad, setXlLoad] = useState(null);
  const fileRef = useRef(null);
  const jsonRef = useRef(null);

  const syncDmg = useCallback(nd => { setItems(prev => { const nx = prev.map(d => ({...d})); nd.forEach(dm => { if (!dm.enabled) return; const maps = DMG_MAP[dm.id]; if (!maps) return; maps.forEach(m => { const idx = nx.findIndex(d => d.id === m.did); if (idx >= 0) nx[idx].qty = Math.ceil(dm.qty * m.f); }); }); return nx; }); }, []);
  const updDmgQty = (id, v) => { const u = dmg.map(d => d.id === id ? {...d, qty: Number(v) || 0} : d); setDmg(u); syncDmg(u); };

  const allD = dmg.every(d => d.enabled), someD = dmg.some(d => d.enabled);
  const toggleAllD = () => setDmg(p => p.map(d => ({...d, enabled: !allD})));
  const toggleD = id => setDmg(p => p.map(d => d.id === id ? {...d, enabled: !d.enabled} : d));

  const allI = items.every(d => d.enabled), someI = items.some(d => d.enabled);
  const toggleAllI = () => setItems(p => p.map(d => ({...d, enabled: !allI})));
  const toggleI = id => setItems(p => p.map(d => d.id === id ? {...d, enabled: !d.enabled} : d));

  const updField = (id, f, v) => setItems(p => p.map(d => d.id === id ? {...d, [f]: f === "qty" ? (Number(v) || 0) : v} : d));
  const addItem = () => setItems(p => [...p, {id: nid(), cat: "4.", name: "", spec: "", unit: "m²", qty: 1, priceId: "", enabled: true}]);
  const delUnchecked = () => { if (!window.confirm("체크 해제 항목 삭제?")) return; setItems(p => p.filter(d => d.enabled)); };

  const act = useMemo(() => items.filter(i => i.enabled), [items]);
  const calcCat = useCallback(c => act.filter(i => i.cat === c).reduce((s, i) => { const p = PRICE_DB[i.priceId] || {total:0,labor:0,material:0,expense:0}; return {g:s.g+Math.round(i.qty*p.total),i:s.i+Math.round(i.qty*p.labor),k:s.k+Math.round(i.qty*p.material),m:s.m+Math.round(i.qty*p.expense)}; }, {g:0,i:0,k:0,m:0}), [act]);

  const t1=calcCat("1."),t2=calcCat("2."),t3=calcCat("3."),t4=calcCat("4.");
  const sunG=t1.g+t2.g+t3.g+t4.g, sunI=t1.i+t2.i+t3.i+t4.i, sunK=t1.k+t2.k+t3.k+t4.k, sunM=t1.m+t2.m+t3.m+t4.m;
  const sT = sagub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gT = gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gF = Math.round(gT*FEE_RATE), grand = sunG+sT+gT+gF;

  const saveJ = () => { const b=new Blob([JSON.stringify({v:"7.4",items,dmg,sagub,gwangub,comment,at:new Date().toISOString()},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`소규모주민숙원_${new Date().toISOString().slice(0,10)}.json`; a.click(); };
  const loadJ = e => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.items)setItems(d.items);if(d.dmg)setDmg(d.dmg);if(d.comment)setComment(d.comment);alert("완료!")}catch{alert("오류")}}; r.readAsText(f); e.target.value=""; };
  const handleXL = async t => { setXlLoad(t); try { if(t==="d") await genDesignXL(items,sagub,gwangub,FEE_RATE); else if(t==="q") await genQtyXL(items,gwangub,FEE_RATE); else await genUnitXL(items); } finally { setXlLoad(null); } };

  return (
    <div className="min-h-screen bg-white" style={{fontFamily:"'Pretendard','Noto Sans KR',sans-serif"}}>
      <div className="bg-slate-800 text-white py-5 px-4"><div className="max-w-7xl mx-auto"><p className="text-blue-300 text-xs tracking-widest mb-1">소규모주민숙원사업</p><h1 className="text-2xl font-bold">종합검토보고서 <span className="text-sm font-normal text-slate-400">v7.4</span></h1><p className="text-slate-400 mt-1 text-xs">좌안 석축 붕괴 · 개선복구 · 2025 충북 단가</p></div></div>

      <div className="sticky top-0 z-30 bg-white border-b shadow-sm"><div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">{[["analysis","AI 분석"],["estimate","설계내역서"]].map(([k,l])=><button key={k} onClick={()=>{setView(k);setEditMode(false)}} className={`px-3 py-1.5 text-xs rounded font-medium ${view===k?"bg-blue-600 text-white":"bg-slate-100 hover:bg-slate-200"}`}>{l}</button>)}</div>
        <div className="flex gap-1"><button onClick={saveJ} className="px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">💾 저장</button><button onClick={()=>jsonRef.current?.click()} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">📂 불러오기</button><input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={loadJ}/></div>
      </div></div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {view==="analysis"&&<>
        <section><Hd n="📷" t="현장 사진"/><div className="mt-2 flex gap-3 items-start flex-wrap"><button onClick={()=>fileRef.current?.click()} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">사진 업로드</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)setPhotoUrl(URL.createObjectURL(f))}}/>{photoUrl&&<img src={photoUrl} alt="" className="h-36 rounded border cursor-pointer" onClick={()=>setPhotoModal(true)}/>}</div>{photoModal&&photoUrl&&<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={()=>setPhotoModal(false)}><img src={photoUrl} alt="" className="max-w-full max-h-full rounded"/></div>}</section>

        <section><Hd n="1" t="종합 분석"/><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3"><IC t="현장 제원" c="blue"><IR l="피해 위치" v="좌안 석축 호안"/><IR l="피해 연장" v="약 20m"/><IR l="석축 높이" v="약 2.5m"/><IR l="기초 세굴" v="약 1.0m"/></IC><IC t="피해 원인" c="red"><IR l="1차" v="급류 수충"/><IR l="2차" v="기초 세굴→붕괴"/><IR l="3차" v="도로 함몰"/><IR l="설계" v="근입 D≥1.0m"/></IC></div>
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3"><h4 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm"><div><span className="text-slate-500 text-xs">품목</span><p className="font-semibold">레미콘,철근,석재,잡석</p></div><div><span className="text-slate-500 text-xs">관급자재비</span><p className="font-bold text-red-600">{fmt(gT)}원</p></div><div><span className="text-slate-500 text-xs">수수료율</span><p>1.5%</p></div><div><span className="text-slate-500 text-xs">관급수수료</span><p className="font-bold text-red-600">{fmt(gF)}원</p></div></div></div></section>

        {/* 설계물량 (구 피해현황) */}
        <section><div className="flex items-center justify-between"><Hd n="2" t="설계 물량"/><button onClick={()=>setEditMode(!editMode)} className="text-xs px-3 py-1 bg-slate-100 rounded hover:bg-slate-200">{editMode?"✅ 완료":"✏️ 편집"}</button></div>
        <p className="text-xs text-orange-600 mt-1">* 수량 변경 시 내역서 물량 자동 연동</p>
        <div className="mt-2 overflow-x-auto border rounded-lg"><table className="w-full text-sm border-collapse"><thead><tr className="bg-blue-700 text-white">{editMode&&<th className="border border-blue-600 px-2 py-1.5 w-8"><input type="checkbox" checked={allD} ref={el=>{if(el)el.indeterminate=!allD&&someD}} onChange={toggleAllD} className="w-4 h-4"/></th>}<th className="border border-blue-600 px-2 py-1.5 w-8">No</th><th className="border border-blue-600 px-2 py-1.5">항목</th><th className="border border-blue-600 px-2 py-1.5">산출근거</th><th className="border border-blue-600 px-2 py-1.5 w-16">수량</th><th className="border border-blue-600 px-2 py-1.5 w-12">단위</th></tr></thead>
        <tbody>{dmg.map((d,i)=><tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-50 line-through":i%2===0?"bg-white":"bg-slate-50"}>{editMode&&<td className="border px-2 py-1 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>toggleD(d.id)} className="w-4 h-4"/></td>}<td className="border px-2 py-1 text-center">{i+1}</td><td className="border px-2 py-1">{d.item}</td><td className="border px-2 py-1 text-slate-500">{d.basis}</td><td className="border px-1 py-1 text-center font-medium">{editMode?<input type="number" value={d.qty} onChange={e=>updDmgQty(d.id,e.target.value)} className="w-full text-center border rounded px-1 py-0.5"/>:d.qty}</td><td className="border px-2 py-1 text-center">{d.unit}</td></tr>)}</tbody></table></div></section>

        <section><Hd n="📝" t="메모"/><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="수정사항, 현장명..." className="w-full mt-2 border rounded p-3 text-sm h-16 resize-none"/></section>
        <section><Hd n="3" t="구조물 제원"/><div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"><SpecC t="석축(찰쌓기)" items={["형식: 찰쌓기","H=2.5m, T=35cm","L=20.5m, 근입D=1.0m"]} c="blue"/><SpecC t="기초 콘크리트" items={["25-210-12(철근)","B=2.5m, D=1.0m","HD13 @200"]} c="red"/><SpecC t="잡석 기초" items={["잡석(기계다짐)","B=2.5m, T=0.5m","부직포 하부+배면"]} c="amber"/></div></section>
      </>}

      {view==="estimate"&&<>
        {/* 설계물량 편집 (체크+추가+삭제+재계산) */}
        <section>
          <div className="flex items-center justify-between flex-wrap gap-2"><Hd n="📋" t="설계물량 편집"/><div className="flex gap-1"><button onClick={addItem} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">➕ 공종추가</button><button onClick={delUnchecked} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">🗑️ 선택삭제</button><button onClick={()=>setEditMode(!editMode)} className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">{editMode?"✅ 완료":"✏️ 편집"}</button></div></div>
          <p className="text-xs text-blue-600 mt-1 mb-2">체크 해제 항목은 합계에서 자동 제외 · 수량/공종 변경 시 내역서 즉시 재계산</p>
          <div className="overflow-x-auto border rounded-lg"><table className="w-full text-xs border-collapse" style={{minWidth:850}}>
            <thead><tr className="bg-slate-700 text-white">
              <th className="border border-slate-600 px-1 py-1.5 w-8"><input type="checkbox" checked={allI} ref={el=>{if(el)el.indeterminate=!allI&&someI}} onChange={toggleAllI} className="w-4 h-4"/></th>
              <th className="border border-slate-600 px-1 py-1.5 w-14">단가ID</th>
              <th className="border border-slate-600 px-1 py-1.5 w-10">공종</th>
              <th className="border border-slate-600 px-2 py-1.5">품명</th>
              <th className="border border-slate-600 px-2 py-1.5">규격</th>
              <th className="border border-slate-600 px-1 py-1.5 w-14">수량</th>
              <th className="border border-slate-600 px-1 py-1.5 w-14">단위</th>
              <th className="border border-slate-600 px-1 py-1.5 w-16">합계단가</th>
              <th className="border border-slate-600 px-1 py-1.5 w-20">합계금액</th>
            </tr></thead>
            <tbody>{items.map(d => { const p=PRICE_DB[d.priceId]||{total:0}; return (
              <tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-40 line-through":"bg-white hover:bg-blue-50"}>
                <td className="border px-1 py-1 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>toggleI(d.id)} className="w-4 h-4"/></td>
                <td className="border px-1 py-1 text-center">{editMode?<input value={d.priceId} onChange={e=>updField(d.id,"priceId",e.target.value)} className="w-full text-center border rounded px-0.5 py-0.5 text-xs" placeholder="#.번호"/>:<span className="text-blue-600">{d.priceId}</span>}</td>
                <td className="border px-1 py-1 text-center">{editMode?<select value={d.cat} onChange={e=>updField(d.id,"cat",e.target.value)} className="text-xs border rounded"><option value="1.">1.토공</option><option value="2.">2.구조물</option><option value="3.">3.포장</option><option value="4.">4.부대</option></select>:d.cat}</td>
                <td className="border px-2 py-1">{editMode?<input value={d.name} onChange={e=>updField(d.id,"name",e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs" placeholder="공종명"/>:d.name}</td>
                <td className="border px-1 py-1 text-slate-500">{editMode?<input value={d.spec} onChange={e=>updField(d.id,"spec",e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs" placeholder="규격"/>:d.spec}</td>
                <td className="border px-1 py-1 text-center"><input type="number" value={d.qty} step="0.1" onChange={e=>updField(d.id,"qty",e.target.value)} className="w-full text-center border rounded px-0.5 py-0.5 text-xs"/></td>
                <td className="border px-1 py-1 text-center">{editMode?<select value={d.unit} onChange={e=>updField(d.id,"unit",e.target.value)} className="text-xs border rounded">{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>:d.unit}</td>
                <td className="border px-1 py-1 text-right">{fmt(p.total)}</td>
                <td className="border px-1 py-1 text-right font-medium">{d.enabled?fmt(Math.round(d.qty*p.total)):"-"}</td>
              </tr>); })}</tbody>
          </table></div>
        </section>

        {/* 13열 내역서 */}
        <section><Hd n="2" t="설계 내역서"/><p className="text-xs text-slate-500 mt-1 mb-3">2025년 충청북도 일위대가 · 체크 해제 항목 합계 제외</p>
        <div className="overflow-x-auto border rounded-lg"><table className="w-full text-xs border-collapse" style={{minWidth:1100}}>
          <thead><tr className="bg-blue-700 text-white"><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-10">공종</th><th rowSpan={2} className="border border-blue-600 px-2 py-1.5 w-32">품 명</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-36">규 격</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-12">수량</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-8">단위</th><th colSpan={2} className="border border-blue-600 text-center">합 계</th><th colSpan={2} className="border border-blue-600 text-center">노 무 비</th><th colSpan={2} className="border border-blue-600 text-center">재 료 비</th><th colSpan={2} className="border border-blue-600 text-center">경 비</th></tr>
          <tr className="bg-blue-600 text-white text-center">{["단가","금액","단가","금액","단가","금액","단가","금액"].map((t,i)=><th key={i} className="border border-blue-500 px-1 py-1">{t}</th>)}</tr></thead>
          <tbody>
            <TR13 label="순 공 사 비" a={[sunG,sunI,sunK,sunM]} bg="bg-slate-200" tc="text-slate-800"/>
            {[{c:"1.",n:"토공",t:t1},{c:"2.",n:"구조물공",t:t2},{c:"3.",n:"포장공",t:t3},{c:"4.",n:"부대공",t:t4}].map(({c,n,t})=>{const ci=act.filter(i=>i.cat===c);if(!ci.length)return null;return<Fragment key={c}><CR13 code={c} name={n} a={[t.g,t.i,t.k,t.m]}/>{ci.map((item,idx)=><IR13 key={item.id} item={item} p={PRICE_DB[item.priceId]||{total:0,labor:0,material:0,expense:0}} idx={idx}/>)}</Fragment>})}
            <CR13 code="5." name="사급자재대" a={[sT,0,0,0]} fill="bg-orange-50"/>
            {sagub.map((item,idx)=><tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1"></td><td className="border px-2 py-1">{item.name}</td><td className="border px-1 py-1 text-slate-500">{item.spec}</td><td className="border px-1 py-1 text-center">{item.qty}</td><td className="border px-1 py-1 text-center">{item.unit}</td><td className="border px-1 py-1 text-right">{fmt(item.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td><td colSpan={6} className="border"></td></tr>)}
            <CR13 code="6." name="관급자재대" a={[gT,0,0,0]} fill="bg-red-50"/>
            {gwangub.map((item,idx)=><tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1 text-center text-xs">{item.sub}</td><td className="border px-2 py-1">{item.name}</td><td className="border px-1 py-1 text-slate-500">{item.spec}</td><td className="border px-1 py-1 text-center">{item.qty}</td><td className="border px-1 py-1 text-center">{item.unit}</td><td className="border px-1 py-1 text-right">{fmt(item.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td><td colSpan={6} className="border"></td></tr>)}
            <tr className="bg-red-50 font-bold"><td colSpan={5} className="border px-3 py-1.5 text-center text-red-700">관급수수료 (1.5%)</td><td className="border"></td><td className="border px-1 py-1.5 text-right text-red-700">{fmt(gF)}</td><td colSpan={6} className="border"></td></tr>
            <TR13 label="총 공 사 비" a={[grand,0,0,0]} bg="bg-slate-800" tc="text-white"/>
          </tbody></table></div></section>

        <section><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["직접공사비",sunG,"blue"],["사급자재비",sT,"orange"],["관급자재비",gT,"red"],["관급수수료",gF,"pink"],["총공사비",grand,"slate"]].map(([l,v,c],i)=><SCard key={i} l={l} v={v} c={c} bold={i===4}/>)}</div></section>

        <section><Hd n="📊" t="엑셀 다운로드"/><div className="mt-3 flex gap-3 flex-wrap">
          <button disabled={xlLoad==="d"} onClick={()=>handleXL("d")} className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 shadow disabled:opacity-50">{xlLoad==="d"?"생성중...":"📊 설계내역서"}</button>
          <button disabled={xlLoad==="q"} onClick={()=>handleXL("q")} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 shadow disabled:opacity-50">{xlLoad==="q"?"생성중...":"📋 수량산출서"}</button>
          <button disabled={xlLoad==="u"} onClick={()=>handleXL("u")} className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 shadow disabled:opacity-50">{xlLoad==="u"?"생성중...":"📑 일위대가"}</button>
        </div><p className="text-xs text-green-700 mt-2">✅ 2단헤더 + 색상 + 수식 포함 (xlsx-js-style)</p></section>
      </>}

      <footer className="border-t pt-4 pb-6 text-xs text-slate-400"><p>상세 수량산출 근거는 엑셀 참조 · 2025년 충청북도 일위대가</p></footer>
      </div>
    </div>
  );
}

/* Sub */
function Hd({n,t}){return<div className="flex items-center gap-2"><span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded flex items-center justify-center">{n}</span><h2 className="text-lg font-bold text-slate-800">{t}</h2></div>}
function IC({t,c,children}){const s=c==="blue"?"bg-blue-50 border-blue-200 text-blue-700":"bg-red-50 border-red-200 text-red-700";return<div className={`${s.split(" ").slice(0,2).join(" ")} border rounded-lg p-4`}><h4 className={`font-bold ${s.split(" ")[2]} text-sm mb-2`}>{t}</h4><div className="space-y-1.5">{children}</div></div>}
function IR({l,v}){return<div className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800">{v}</span></div>}
function SpecC({t,items,c}){const bg={"blue":"bg-blue-50 border-blue-200","red":"bg-red-50 border-red-200","amber":"bg-amber-50 border-amber-200"}[c];return<div className={`${bg} border rounded-lg p-3`}><h4 className="font-bold text-sm mb-2">{t}</h4>{items.map((s,i)=><p key={i} className="text-xs text-slate-700">• {s}</p>)}</div>}
function TR13({label,a,bg,tc}){return<tr className={`${bg} font-bold`}><td colSpan={5} className={`border px-3 py-1.5 text-center ${tc}`}>{label}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{fmt(a[0])}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{a[1]?fmt(a[1]):""}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{a[2]?fmt(a[2]):""}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{a[3]?fmt(a[3]):""}</td></tr>}
function CR13({code,name,a,fill}){const bg=fill||"bg-blue-50";return<tr className={`${bg} font-bold`}><td className="border px-1 py-1 text-center text-blue-700 text-xs">{code}</td><td className="border px-2 py-1 text-blue-700">{name}</td><td className="border"></td><td className="border"></td><td className="border"></td><td className="border"></td><td className="border px-1 py-1 text-right text-blue-700">{fmt(a[0])}</td><td className="border"></td><td className="border px-1 py-1 text-right">{a[1]?fmt(a[1]):""}</td><td className="border"></td><td className="border px-1 py-1 text-right">{a[2]?fmt(a[2]):""}</td><td className="border"></td><td className="border px-1 py-1 text-right">{a[3]?fmt(a[3]):""}</td></tr>}
function IR13({item,p,idx}){const q=item.qty;return<tr className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1"></td><td className="border px-2 py-1">{item.name}</td><td className="border px-1 py-1 text-slate-500 text-xs">{item.spec}</td><td className="border px-1 py-1 text-center">{q}</td><td className="border px-1 py-1 text-center">{item.unit}</td><td className="border px-1 py-1 text-right">{fmt(p.total)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.total))}</td><td className="border px-1 py-1 text-right">{fmt(p.labor)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.labor))}</td><td className="border px-1 py-1 text-right">{fmt(p.material)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.material))}</td><td className="border px-1 py-1 text-right">{fmt(p.expense)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.expense))}</td></tr>}
function SCard({l,v,c,bold}){const s={blue:"bg-blue-50 border-blue-200 text-blue-700",orange:"bg-orange-50 border-orange-200 text-orange-600",red:"bg-red-50 border-red-200 text-red-600",pink:"bg-pink-50 border-pink-200 text-pink-600",slate:"bg-slate-800 border-slate-700 text-white"}[c];return<div className={`rounded-lg border p-3 ${s}`}><p className="text-xs opacity-75">{l}</p><p className={`${bold?"text-lg":"text-sm"} font-bold mt-0.5`}>{fmt(v)}원</p></div>}
