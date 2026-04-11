import { useState, useRef, useCallback, useMemo, Fragment, memo } from "react";

/* ============================================================
   소규모주민숙원사업 종합검토보고서 v8.3
   v8.2 + 신규공종 노무비/재료비/경비 단가 직접입력 → 자동계산
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const UNITS = ["m²","m³","m","hr","ton","일","식","본","개소","km","㎡","㎥"];
const CAT_OPTIONS = [["1.","1.토공"],["2.","2.구조물"],["3.","3.포장"],["4.","4.부대"]];
const CAT_NAMES = {"1.":"토공","2.":"구조물공","3.":"포장공","4.":"부대공"};
const CATS = ["1.","2.","3.","4."];

const PRICE_DB = {
  "#.22":{name:"표토제거(답외)",spec:"T=20CM,굴삭기0.7㎥",unit:"m²",labor:191,material:59,expense:80,total:330},
  "#.28":{name:"흙깍기",spec:"보통토사,소규모",unit:"m³",labor:1472,material:774,expense:747,total:2993},
  "#.57":{name:"구조물터파기",spec:"육상토사,기계100%",unit:"m³",labor:1035,material:323,expense:435,total:1793},
  "#.68":{name:"뒤채움 및 다짐",spec:"소형장비",unit:"m³",labor:9507,material:1337,expense:1467,total:12311},
  "#.70":{name:"되메우기 및 다짐",spec:"소형장비",unit:"m³",labor:8044,material:1131,expense:1241,total:10416},
  "#.77":{name:"기초지정(잡석)",spec:"잡석",unit:"m³",labor:9421,material:956,expense:1360,total:11737},
  "#.87":{name:"절토사면 녹화",spec:"T=10㎝",unit:"m²",labor:28320,material:22842,expense:4324,total:55486},
  "#.127":{name:"사토운반",spec:"토사,L=5.0KM",unit:"m³",labor:4001,material:1876,expense:1525,total:7402},
  "#.155":{name:"석축쌓기",spec:"찰쌓기,T=35cm이하",unit:"m²",labor:50146,material:4625,expense:8819,total:63590},
  "#.193":{name:"레미콘타설(펌프차)",spec:"철근(S:8-12cm),TYPE-Ⅱ",unit:"m³",labor:17078,material:2556,expense:4540,total:24174},
  "#.204":{name:"합판거푸집",spec:"(4회) 보통",unit:"m²",labor:37861,material:14845,expense:0,total:52706},
  "#.216":{name:"철근가공 및 조립",spec:"TYPE-1-1",unit:"ton",labor:763584,material:46877,expense:0,total:810461},
  "#.276":{name:"콘크리트양생",spec:"습윤양생",unit:"m²",labor:1426,material:472,expense:231,total:2129},
  "#.280":{name:"부직포설치",spec:"",unit:"m²",labor:279,material:1693,expense:17,total:1989},
  "#.281":{name:"비닐깔기",spec:"",unit:"m²",labor:32,material:647,expense:0,total:679},
  "#.282":{name:"물푸기",spec:"",unit:"hr",labor:1139,material:2463,expense:635,total:4237},
  "#.326":{name:"절삭후아스팔트덧씌우기",spec:"B-Type(1회절삭,1회포장)",unit:"m²",labor:1873,material:919,expense:1189,total:3981},
  "#.481":{name:"교통통제및안전처리",spec:"500M미만",unit:"일",labor:339608,material:0,expense:0,total:339608},
};

/* ★ 단가 조회: PRICE_DB 있으면 DB, 없으면 item 자체 값 사용 */
function getPrice(item) {
  const db = PRICE_DB[item.priceId];
  if (db) return db;
  return { labor: item.labor||0, material: item.material||0, expense: item.expense||0, total: (item.labor||0)+(item.material||0)+(item.expense||0) };
}

const CALC_BASIS={1:"표토제거=폭2.5m×길이14m=35m²",2:"토사굴착=폭2.0m×길이10m×깊이2.0m=40m³",3:"기초터파기=폭2.5m×길이20.5m×깊이1.0m=51m³",4:"잡석기초=폭2.5m×길이20.5m×두께0.5m=26m³",5:"기초콘크리트=폭2.5m×길이20.5m×깊이1.0m=51m³",6:"석축찰쌓기=높이2.5m×길이20.5m=51m²",7:"거푸집=기초양측면+전면=41m²",8:"철근=HD13@200,51m³×배근율≒2.6ton",9:"양생=기초상면+측면=92m²",10:"부직포=잡석하부+석축배면≒72m²",11:"비닐=기초하부2.5m×20.5m=51m²",12:"뒤채움=석축배면1.5m×2.5m×20.5m×0.45≒35m³",13:"되메우기=잔여1.0m×1.0m×20.5m≒20m³",14:"사면녹화=3.0m×15m=45m²",15:"사토운반=터파기51+토사40+잔해217=308m³",16:"교통통제=공사기간5일",17:"물푸기=24시간",18:"아스팔트=2.0m×20m=40m²"};

let _nid = 200;
const nid = () => _nid++;

const INIT_DAMAGE = () => [
  {id:1,item:"석축 신설 (찰쌓기)",basis:"기존 석축 전면 붕괴 → 찰쌓기 석축 신설\n높이 2.5m × 연장 20.5m = 51㎡",qty:51,unit:"㎡",enabled:true},
  {id:2,item:"기초 콘크리트 신설",basis:"기초 세굴 → RC 기초 신설 (근입 D=1.0m)\n폭 2.5m × 연장 20.5m × 깊이 1.0m = 51㎥",qty:51,unit:"㎥",enabled:true},
  {id:3,item:"잡석기초 다짐",basis:"기초 하부 잡석 다짐\n폭 2.5m × 연장 20.5m × T=0.5m = 26㎥",qty:26,unit:"㎥",enabled:true},
  {id:4,item:"도로 포장 복구",basis:"아스팔트 파손 복구\n폭 2.0m × 연장 20m = 40㎡",qty:40,unit:"㎡",enabled:true},
  {id:5,item:"사면 녹화 복원",basis:"붕괴 사면 녹화\n높이 3.0m × 연장 15m = 45㎡",qty:45,unit:"㎡",enabled:true},
  {id:6,item:"토사 굴착 및 사토",basis:"붕괴 잔해 + 터파기 + 사토운반\n총 308㎥",qty:308,unit:"㎥",enabled:true},
];

/* ★ items에 labor/material/expense 필드 추가 (PRICE_DB에 없는 항목용) */
const INIT_ITEMS = () => [
  {id:1,cat:"1.",name:"표토제거",spec:"T=20CM,굴삭기0.7㎥(답외)",unit:"m²",qty:35,priceId:"#.22",labor:0,material:0,expense:0,enabled:true},
  {id:2,cat:"1.",name:"흙깍기",spec:"보통토사,소규모",unit:"m³",qty:40,priceId:"#.28",labor:0,material:0,expense:0,enabled:true},
  {id:3,cat:"1.",name:"구조물터파기",spec:"육상토사,기계100%",unit:"m³",qty:51,priceId:"#.57",labor:0,material:0,expense:0,enabled:true},
  {id:4,cat:"2.",name:"기초지정(잡석)",spec:"잡석",unit:"m³",qty:26,priceId:"#.77",labor:0,material:0,expense:0,enabled:true},
  {id:5,cat:"2.",name:"레미콘타설(펌프차)",spec:"철근(S:8-12cm),TYPE-Ⅱ",unit:"m³",qty:51,priceId:"#.193",labor:0,material:0,expense:0,enabled:true},
  {id:6,cat:"2.",name:"석축쌓기",spec:"찰쌓기,T=35cm이하",unit:"m²",qty:51,priceId:"#.155",labor:0,material:0,expense:0,enabled:true},
  {id:7,cat:"2.",name:"합판거푸집",spec:"(4회) 보통",unit:"m²",qty:41,priceId:"#.204",labor:0,material:0,expense:0,enabled:true},
  {id:8,cat:"2.",name:"철근가공 및 조립",spec:"TYPE-1-1",unit:"ton",qty:2.6,priceId:"#.216",labor:0,material:0,expense:0,enabled:true},
  {id:9,cat:"2.",name:"콘크리트양생",spec:"습윤양생",unit:"m²",qty:92,priceId:"#.276",labor:0,material:0,expense:0,enabled:true},
  {id:10,cat:"4.",name:"부직포설치",spec:"",unit:"m²",qty:72,priceId:"#.280",labor:0,material:0,expense:0,enabled:true},
  {id:11,cat:"4.",name:"비닐깔기",spec:"",unit:"m²",qty:51,priceId:"#.281",labor:0,material:0,expense:0,enabled:true},
  {id:12,cat:"1.",name:"뒤채움 및 다짐",spec:"소형장비",unit:"m³",qty:35,priceId:"#.68",labor:0,material:0,expense:0,enabled:true},
  {id:13,cat:"1.",name:"되메우기 및 다짐",spec:"소형장비",unit:"m³",qty:20,priceId:"#.70",labor:0,material:0,expense:0,enabled:true},
  {id:14,cat:"1.",name:"절토사면 녹화",spec:"T=10㎝",unit:"m²",qty:45,priceId:"#.87",labor:0,material:0,expense:0,enabled:true},
  {id:15,cat:"1.",name:"사토운반",spec:"토사,L=5.0KM",unit:"m³",qty:308,priceId:"#.127",labor:0,material:0,expense:0,enabled:true},
  {id:16,cat:"4.",name:"교통통제및안전처리",spec:"500M미만",unit:"일",qty:5,priceId:"#.481",labor:0,material:0,expense:0,enabled:true},
  {id:17,cat:"4.",name:"물푸기",spec:"",unit:"hr",qty:24,priceId:"#.282",labor:0,material:0,expense:0,enabled:true},
  {id:18,cat:"3.",name:"절삭후아스팔트덧씌우기",spec:"B-Type(1회절삭,1회포장)",unit:"m²",qty:40,priceId:"#.326",labor:0,material:0,expense:0,enabled:true},
];

const INIT_SAGUB=()=>[{id:101,name:"합판거푸집(자재)",spec:"합판,유로폼",unit:"m²",qty:41,unitPrice:12000,source:"거래처 견적"},{id:102,name:"부직포(자재)",spec:"부직포 원단",unit:"m²",qty:72,unitPrice:1500,source:"거래처 견적"}];
const INIT_GWANGUB=()=>[{id:201,sub:"6.1",name:"레미콘",spec:"25-210-12",unit:"m³",qty:51,unitPrice:75000,source:"레미콘 업체"},{id:202,sub:"6.2",name:"이형철근(SD400)",spec:"HD13",unit:"ton",qty:2.6,unitPrice:950000,source:"철강 시세"},{id:203,sub:"6.3",name:"석재",spec:"자연석",unit:"m²",qty:51,unitPrice:45000,source:"석재 업체"},{id:204,sub:"6.3",name:"잡석",spec:"25-40mm",unit:"m³",qty:24,unitPrice:22000,source:"골재 업체"}];
const FEE_RATE=0.015;
const STRUCT={wallH:2.5,wallT:0.35,wallL:20.5,foundW:2.5,foundD:1.0,japsukT:0.5,steelSpec:"HD13 @200, SD400",conSpec:"25-210-12"};

/* ============================================================ EditTable */
const EditTable = memo(function EditTable({items,onToggleAll,onToggle,onUpdate,allChk,someChk}){
  return(<div className="overflow-x-auto border rounded-lg"><table className="w-full text-xs border-collapse" style={{minWidth:900}}>
    <thead><tr className="bg-slate-700 text-white">
      <th className="border border-slate-600 px-1 py-1.5 w-8"><input type="checkbox" checked={allChk} ref={el=>{if(el)el.indeterminate=!allChk&&someChk}} onChange={onToggleAll} className="w-4 h-4"/></th>
      <th className="border border-slate-600 px-1 py-1.5 w-10">No</th>
      <th className="border border-slate-600 px-1 py-1.5 w-16">단가ID</th>
      <th className="border border-slate-600 px-1 py-1.5 w-20">공종</th>
      <th className="border border-slate-600 px-2 py-1.5" style={{minWidth:120}}>품명</th>
      <th className="border border-slate-600 px-2 py-1.5" style={{minWidth:150}}>규격</th>
      <th className="border border-slate-600 px-1 py-1.5 w-14">수량</th>
      <th className="border border-slate-600 px-1 py-1.5 w-14">단위</th>
      <th className="border border-slate-600 px-1 py-1.5 w-20">합계단가</th>
      <th className="border border-slate-600 px-1 py-1.5 w-24">합계금액</th>
    </tr></thead>
    <tbody>{items.map((d,idx)=>{const p=getPrice(d);return(
      <tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-40 line-through":!d.name?"bg-yellow-50":"bg-white hover:bg-blue-50"}>
        <td className="border px-1 py-1 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>onToggle(d.id)} className="w-4 h-4"/></td>
        <td className="border px-1 py-1 text-center text-slate-400">{idx+1}</td>
        <td className="border px-1 py-1 text-center"><input value={d.priceId} onChange={e=>onUpdate(d.id,"priceId",e.target.value)} className="w-full text-center bg-transparent text-blue-600 font-medium text-xs outline-none focus:bg-blue-50 rounded px-1 py-0.5" placeholder="#.번호"/></td>
        <td className="border px-1 py-1 text-center"><select value={d.cat} onChange={e=>onUpdate(d.id,"cat",e.target.value)} className="text-xs bg-transparent outline-none w-full">{CAT_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
        <td className="border px-1 py-1"><input value={d.name} onChange={e=>onUpdate(d.id,"name",e.target.value)} className="w-full bg-transparent text-xs outline-none focus:bg-blue-50 rounded px-1 py-0.5" placeholder="공종명"/></td>
        <td className="border px-1 py-1"><input value={d.spec} onChange={e=>onUpdate(d.id,"spec",e.target.value)} className="w-full bg-transparent text-xs text-slate-500 outline-none focus:bg-blue-50 rounded px-1 py-0.5" placeholder="규격"/></td>
        <td className="border px-1 py-1 text-center"><input type="number" value={d.qty} step="0.1" onChange={e=>onUpdate(d.id,"qty",e.target.value)} className="w-full text-center bg-transparent text-xs font-medium outline-none focus:bg-blue-50 rounded px-1 py-0.5"/></td>
        <td className="border px-1 py-1 text-center"><select value={d.unit} onChange={e=>onUpdate(d.id,"unit",e.target.value)} className="text-xs bg-transparent outline-none">{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></td>
        <td className="border px-1 py-1 text-right text-xs">{fmt(p.total)}</td>
        <td className="border px-1 py-1 text-right text-xs font-medium">{d.enabled?fmt(Math.round(d.qty*p.total)):"-"}</td>
      </tr>)})}</tbody>
  </table></div>);
});

/* ★ 13열 내역서 행 — 단가 직접입력 가능 */
const IR13Edit = memo(function IR13Edit({item, onUpdate, idx}) {
  const hasDb = !!PRICE_DB[item.priceId];
  const p = getPrice(item);
  const q = item.qty;
  const inpCls = "w-full text-right bg-transparent text-xs outline-none focus:bg-yellow-50 focus:ring-1 focus:ring-orange-300 rounded px-0.5 py-0.5";

  return (
    <tr className={idx%2===0?"bg-white":"bg-slate-50"}>
      <td className="border px-1 py-1"></td>
      <td className="border px-2 py-1">{item.name}</td>
      <td className="border px-1 py-1 text-slate-500 text-xs">{item.spec}</td>
      <td className="border px-1 py-1 text-center">{q}</td>
      <td className="border px-1 py-1 text-center">{item.unit}</td>
      {/* 합계단가 = 자동계산 */}
      <td className="border px-1 py-1 text-right text-xs">{fmt(p.total)}</td>
      <td className="border px-1 py-1 text-right text-xs font-medium">{fmt(Math.round(q*p.total))}</td>
      {/* 노무비 단가 */}
      <td className={`border px-1 py-1 ${hasDb?"text-right text-xs":"bg-yellow-50"}`}>
        {hasDb ? fmt(p.labor) : <input type="number" value={item.labor||""} onChange={e=>onUpdate(item.id,"labor",e.target.value)} className={inpCls} placeholder="입력"/>}
      </td>
      <td className="border px-1 py-1 text-right text-xs">{fmt(Math.round(q*p.labor))}</td>
      {/* 재료비 단가 */}
      <td className={`border px-1 py-1 ${hasDb?"text-right text-xs":"bg-yellow-50"}`}>
        {hasDb ? fmt(p.material) : <input type="number" value={item.material||""} onChange={e=>onUpdate(item.id,"material",e.target.value)} className={inpCls} placeholder="입력"/>}
      </td>
      <td className="border px-1 py-1 text-right text-xs">{fmt(Math.round(q*p.material))}</td>
      {/* 경비 단가 */}
      <td className={`border px-1 py-1 ${hasDb?"text-right text-xs":"bg-yellow-50"}`}>
        {hasDb ? fmt(p.expense) : <input type="number" value={item.expense||""} onChange={e=>onUpdate(item.id,"expense",e.target.value)} className={inpCls} placeholder="입력"/>}
      </td>
      <td className="border px-1 py-1 text-right text-xs">{fmt(Math.round(q*p.expense))}</td>
    </tr>
  );
});

/* ============================================================ Excel (동일) */
const loadXLSX=()=>new Promise((res,rej)=>{if(window.XLSX){res(window.XLSX);return}const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";s.onload=()=>window.XLSX?res(window.XLSX):rej(new Error("f"));s.onerror=()=>{const s2=document.createElement("script");s2.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";s2.onload=()=>res(window.XLSX);s2.onerror=()=>rej(new Error("CDN"));document.head.appendChild(s2)};document.head.appendChild(s)});
const HS={font:{bold:true,color:{rgb:"FFFFFF"},sz:10},fill:{fgColor:{rgb:"4472C4"}},border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"center",vertical:"center",wrapText:true}};
const CST=rgb=>({font:{bold:true,sz:10},fill:{fgColor:{rgb}},border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"center",vertical:"center"}});
const NS={numFmt:"#,##0",border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"right"}};
const TS={border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{wrapText:true}};
const TTS2=(rgb,fc="000000")=>({font:{bold:true,color:{rgb:fc},sz:11},fill:{fgColor:{rgb}},border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"center"},numFmt:"#,##0"});
function wsc(ws,r,c,v,s){const ref=window.XLSX.utils.encode_cell({r,c});if(!ws[ref])ws[ref]={};ws[ref].v=v;if(typeof v==="number")ws[ref].t="n";else if(typeof v==="string"&&v.startsWith("=")){ws[ref].f=v.slice(1);ws[ref].t="n";delete ws[ref].v}else ws[ref].t="s";if(s)ws[ref].s=s}

/* ★ 엑셀 생성 시 getPrice 사용 */
async function genDesignXL(items,sagub,gwangub,fr){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),ws={};ws["!cols"]=[{wch:8},{wch:24},{wch:28},{wch:10},{wch:6},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14}];wsc(ws,0,0,"설 계 내 역 서",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:12}}];wsc(ws,1,0,"2025년 충청북도 일위대가",{font:{sz:9,color:{rgb:"666666"}},alignment:{horizontal:"center"}});ws["!merges"].push({s:{r:1,c:0},e:{r:1,c:12}});["공종","품 명","규 격","수량","단위","합 계","","노 무 비","","재 료 비","","경 비",""].forEach((v,c)=>wsc(ws,2,c,v,HS));["","","","","","단가","금액","단가","금액","단가","금액","단가","금액"].forEach((v,c)=>{if(c>=5)wsc(ws,3,c,v,HS)});for(let c=0;c<5;c++)ws["!merges"].push({s:{r:2,c},e:{r:3,c}});ws["!merges"].push({s:{r:2,c:5},e:{r:2,c:6}},{s:{r:2,c:7},e:{r:2,c:8}},{s:{r:2,c:9},e:{r:2,c:10}},{s:{r:2,c:11},e:{r:2,c:12}});let r=4;const catRows={};const sunRow=r;r++;CATS.forEach(cc=>{const ci=act.filter(i=>i.cat===cc);if(!ci.length)return;const cr=r;r++;catRows[cc]={row:cr,items:[]};wsc(ws,cr,0,cc,CST("DBEAFE"));wsc(ws,cr,1,CAT_NAMES[cc],CST("DBEAFE"));for(let c=2;c<13;c++)wsc(ws,cr,c,"",CST("DBEAFE"));ci.forEach(item=>{const p=getPrice(item),ir=r;r++;catRows[cc].items.push(ir);wsc(ws,ir,0,"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec||"",TS);wsc(ws,ir,3,item.qty,{...NS,numFmt:"#,##0.0##"});wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,`=H${ir+1}+J${ir+1}+L${ir+1}`,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);wsc(ws,ir,7,p.labor,NS);wsc(ws,ir,8,`=D${ir+1}*H${ir+1}`,NS);wsc(ws,ir,9,p.material,NS);wsc(ws,ir,10,`=D${ir+1}*J${ir+1}`,NS);wsc(ws,ir,11,p.expense,NS);wsc(ws,ir,12,`=D${ir+1}*L${ir+1}`,NS)});const irs=catRows[cc].items;if(irs.length)[6,8,10,12].forEach(c=>{const col=String.fromCharCode(65+c);wsc(ws,cr,c,`=SUM(${col}${irs[0]+1}:${col}${irs[irs.length-1]+1})`,{...CST("DBEAFE"),numFmt:"#,##0"})})});const sunS=TTS2("D6DCE4");wsc(ws,sunRow,0,"",sunS);wsc(ws,sunRow,1,"순 공 사 비",sunS);for(let c=2;c<13;c++)wsc(ws,sunRow,c,"",sunS);ws["!merges"].push({s:{r:sunRow,c:0},e:{r:sunRow,c:1}});const uc=CATS.filter(c=>catRows[c]);[6,8,10,12].forEach(c=>{const col=String.fromCharCode(65+c);const refs=uc.map(cc=>`${col}${catRows[cc].row+1}`).join("+");if(refs)wsc(ws,sunRow,c,`=${refs}`,{...sunS,numFmt:"#,##0"})});const sRow=r;r++;wsc(ws,sRow,0,"5.",CST("FFF7ED"));wsc(ws,sRow,1,"사급자재대",CST("FFF7ED"));for(let c=2;c<13;c++)wsc(ws,sRow,c,"",CST("FFF7ED"));const si=[];sagub.forEach(item=>{const ir=r;r++;si.push(ir);wsc(ws,ir,0,"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec,TS);wsc(ws,ir,3,item.qty,NS);wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,item.unitPrice,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);for(let c=7;c<13;c++)wsc(ws,ir,c,"",TS)});if(si.length)wsc(ws,sRow,6,`=SUM(G${si[0]+1}:G${si[si.length-1]+1})`,{...CST("FFF7ED"),numFmt:"#,##0"});const gRow=r;r++;wsc(ws,gRow,0,"6.",CST("FEF2F2"));wsc(ws,gRow,1,"관급자재대",CST("FEF2F2"));for(let c=2;c<13;c++)wsc(ws,gRow,c,"",CST("FEF2F2"));const gi=[];gwangub.forEach(item=>{const ir=r;r++;gi.push(ir);wsc(ws,ir,0,item.sub||"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec,TS);wsc(ws,ir,3,item.qty,NS);wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,item.unitPrice,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);for(let c=7;c<13;c++)wsc(ws,ir,c,"",TS)});if(gi.length)wsc(ws,gRow,6,`=SUM(G${gi[0]+1}:G${gi[gi.length-1]+1})`,{...CST("FEF2F2"),numFmt:"#,##0"});const fRow=r;r++;wsc(ws,fRow,0,"",CST("FEF2F2"));wsc(ws,fRow,1,"관급수수료 (1.5%)",CST("FEF2F2"));for(let c=2;c<13;c++)wsc(ws,fRow,c,"",CST("FEF2F2"));wsc(ws,fRow,6,`=ROUND(G${gRow+1}*0.015,0)`,{...CST("FEF2F2"),numFmt:"#,##0"});const grRow=r;r++;const gS=TTS2("1E3A5F","FFFFFF");wsc(ws,grRow,0,"",gS);wsc(ws,grRow,1,"총 공 사 비",gS);for(let c=2;c<13;c++)wsc(ws,grRow,c,"",gS);ws["!merges"].push({s:{r:grRow,c:0},e:{r:grRow,c:1}});wsc(ws,grRow,6,`=G${sunRow+1}+G${sRow+1}+G${gRow+1}+G${fRow+1}`,{...gS,numFmt:"#,##0"});ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r,c:12}});X.utils.book_append_sheet(wb,ws,"내역서");X.writeFile(wb,`설계내역서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

async function genQtyXL(items,gwangub,fr){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),ws={};ws["!cols"]=[{wch:5},{wch:22},{wch:28},{wch:7},{wch:10},{wch:65},{wch:15}];wsc(ws,0,0,"수 량 산 출 서",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:6}}];["No","공종명","규격","단위","수량","산출근거","비고"].forEach((v,c)=>wsc(ws,1,c,v,HS));act.forEach((item,i)=>{const r=i+2;wsc(ws,r,0,i+1,{...TS,alignment:{horizontal:"center"}});wsc(ws,r,1,item.name,TS);wsc(ws,r,2,item.spec||"",TS);wsc(ws,r,3,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,r,4,item.qty,{...NS,numFmt:item.unit==="ton"?"#,##0.000":"#,##0"});wsc(ws,r,5,CALC_BASIS[item.id]||`설계수량=${item.qty}${item.unit}`,TS);wsc(ws,r,6,item.priceId||"직접입력",{...TS,font:{color:{rgb:"2563EB"}}})});const gTot=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0),fee=Math.round(gTot*fr),lr=act.length+2;wsc(ws,lr,0,act.length+1,{...TS,alignment:{horizontal:"center"}});wsc(ws,lr,1,"관급수수료",TS);wsc(ws,lr,2,"×1.5%",TS);wsc(ws,lr,3,"식",{...TS,alignment:{horizontal:"center"}});wsc(ws,lr,4,1,NS);wsc(ws,lr,5,`관급자재비${fmt(gTot)}원×1.5%=${fmt(fee)}원`,TS);wsc(ws,lr,6,"",TS);ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r:lr,c:6}});X.utils.book_append_sheet(wb,ws,"수량산출서");X.writeFile(wb,`수량산출서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

async function genUnitXL(items,sagub,gwangub){try{const X=await loadXLSX(),wb=X.utils.book_new(),ws={};ws["!cols"]=[{wch:10},{wch:25},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:25}];wsc(ws,0,0,"일위대가 (2025 충북)",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}}];["단가ID","공종명","규격","합계","노무비","재료비","경비","자재구분","출처"].forEach((v,c)=>wsc(ws,1,c,v,HS));const act=items.filter(i=>i.enabled);let r=2;
// DB 단가
const pids=[...new Set(act.filter(i=>PRICE_DB[i.priceId]).map(i=>i.priceId))];
pids.forEach(pid=>{const p=PRICE_DB[pid];let mt="";if(["기초지정","레미콘","석축","철근"].some(n=>p.name.includes(n)))mt="관급(자재별도)";else if(["합판거푸집","부직포"].some(n=>p.name.includes(n)))mt="사급(자재별도)";wsc(ws,r,0,pid,{...TS,alignment:{horizontal:"center"},font:{color:{rgb:"2563EB"}}});wsc(ws,r,1,p.name,TS);wsc(ws,r,2,p.spec,TS);wsc(ws,r,3,p.total,NS);wsc(ws,r,4,p.labor,NS);wsc(ws,r,5,p.material,NS);wsc(ws,r,6,p.expense,NS);wsc(ws,r,7,mt,mt?{...TS,font:{color:{rgb:mt.includes("관급")?"DC2626":"EA580C"}}}:TS);wsc(ws,r,8,"2025 충북 일위대가",TS);r++});
// 직접입력 단가
const customItems=act.filter(i=>!PRICE_DB[i.priceId]&&i.name);
if(customItems.length){r++;wsc(ws,r,1,"[ 직접입력 단가 ]",{...TS,font:{bold:true,color:{rgb:"B45309"}}});for(let c=0;c<9;c++)if(c!==1)wsc(ws,r,c,"",TS);r++;["","공종명","규격","합계","노무비","재료비","경비","","출처"].forEach((v,c)=>wsc(ws,r,c,v,{...HS,fill:{fgColor:{rgb:"D97706"}}}));r++;customItems.forEach(i=>{const p=getPrice(i);wsc(ws,r,0,i.priceId||"직접",{...TS,alignment:{horizontal:"center"}});wsc(ws,r,1,i.name,TS);wsc(ws,r,2,i.spec||"",TS);wsc(ws,r,3,p.total,NS);wsc(ws,r,4,p.labor,NS);wsc(ws,r,5,p.material,NS);wsc(ws,r,6,p.expense,NS);wsc(ws,r,7,"",TS);wsc(ws,r,8,"사용자 직접입력",TS);r++})}
// 사급/관급
r++;wsc(ws,r,1,"[ 사급·관급 자재 단가 ]",{...TS,font:{bold:true,color:{rgb:"B45309"}}});for(let c=0;c<9;c++)if(c!==1)wsc(ws,r,c,"",TS);r++;["품명","규격","자재단가","","","","","구분","출처"].forEach((v,c)=>wsc(ws,r,c,v,{...HS,fill:{fgColor:{rgb:"D97706"}}}));r++;[...sagub,...gwangub].forEach(i=>{wsc(ws,r,0,"",TS);wsc(ws,r,1,i.name,TS);wsc(ws,r,2,i.spec,TS);wsc(ws,r,3,i.unitPrice,NS);for(let c=4;c<7;c++)wsc(ws,r,c,"",TS);const isGw=i.id>=200;wsc(ws,r,7,isGw?"관급":"사급",{...TS,font:{color:{rgb:isGw?"DC2626":"EA580C"}}});wsc(ws,r,8,i.source,TS);r++});
ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r,c:8}});X.utils.book_append_sheet(wb,ws,"일위대가");X.writeFile(wb,`일위대가_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

/* 설계참고 채팅 */
const DESIGN_REFS={"석축":["하천설계기준(2019) 제7장 호안","KDS 51 40 15 석축 및 돌쌓기","찰쌓기: 1:0.3~1:0.5 경사, 부직포+뒤채움","기초 근입: 최소 1.0m"],"기초":["KDS 14 20 00 콘크리트 설계기준","기초 σck=21MPa (25-210-12)","철근 SD400, HD13@200","근입깊이: 세굴깊이+여유≥1.0m"],"호안":["하천설계기준(2019) 제7장","수충부: 개선복구 원칙","세굴방지: 근고공 또는 근입"],"복구":["자연재해대책법 시행령 제47조","원인복구/개선복구 구분","개선복구: 구조 보강, 기초 신설"],"단가":["2025년 충청북도 일위대가","관급: 3,000만원 이상 또는 발주처 지정","사급: 시공사 직접구매"]};
function getDesignAnswer(q){for(const[key,refs]of Object.entries(DESIGN_REFS))if(q.includes(key))return`📚 ${key} 관련:\n\n${refs.map((r,i)=>`${i+1}. ${r}`).join("\n")}`;return`키워드(석축,기초,호안,복구,단가)를 포함하여 질문해주세요.`}

/* ============================================================ MAIN */
export default function App(){
  const[view,setView]=useState("analysis");
  const[damage,setDamage]=useState([]);
  const[items,setItems]=useState([]);
  const[sagub]=useState(INIT_SAGUB);
  const[gwangub]=useState(INIT_GWANGUB);
  const[photoUrl,setPhotoUrl]=useState(null);
  const[photoModal,setPhotoModal]=useState(false);
  const[analyzing,setAnalyzing]=useState(false);
  const[analyzed,setAnalyzed]=useState(false);
  const[chatLog,setChatLog]=useState([]);
  const[chatInput,setChatInput]=useState("");
  const[xlLoad,setXlLoad]=useState(null);
  const fileRef=useRef(null),jsonRef=useRef(null),chatEndRef=useRef(null);

  const handleNewWork=useCallback(()=>{if(!window.confirm("초기화?"))return;_nid=200;setDamage([]);setItems([]);setPhotoUrl(null);setAnalyzed(false);setChatLog([]);setView("analysis")},[]);
  const handleAnalyze=useCallback(()=>{if(!photoUrl){alert("사진을 업로드해주세요");return}setAnalyzing(true);setTimeout(()=>{setAnalyzing(false);setAnalyzed(true);setDamage(INIT_DAMAGE());_nid=200;setItems(INIT_ITEMS())},1500)},[photoUrl]);

  const allD=useMemo(()=>damage.length>0&&damage.every(d=>d.enabled),[damage]);
  const someD=useMemo(()=>damage.some(d=>d.enabled),[damage]);
  const toggleAllD=useCallback(()=>setDamage(p=>p.map(d=>({...d,enabled:!allD}))),[allD]);
  const toggleD=useCallback(id=>setDamage(p=>p.map(d=>d.id===id?{...d,enabled:!d.enabled}:d)),[]);
  const addDamage=useCallback(()=>setDamage(p=>[...p,{id:Date.now(),item:"",basis:"",qty:0,unit:"㎡",enabled:true}]),[]);
  const delDamageUnchecked=useCallback(()=>{if(!window.confirm("삭제?"))return;setDamage(p=>p.filter(d=>d.enabled))},[]);
  const updDamage=useCallback((id,f,v)=>setDamage(p=>p.map(d=>d.id===id?{...d,[f]:f==="qty"?(Number(v)||0):v}:d)),[]);

  const allI=useMemo(()=>items.length>0&&items.every(d=>d.enabled),[items]);
  const someI=useMemo(()=>items.some(d=>d.enabled),[items]);
  const toggleAllI=useCallback(()=>setItems(p=>p.map(d=>({...d,enabled:!allI}))),[allI]);
  const toggleI=useCallback(id=>setItems(p=>p.map(d=>d.id===id?{...d,enabled:!d.enabled}:d)),[]);

  /* ★ updField: labor/material/expense도 숫자로 변환 */
  const updField=useCallback((id,field,value)=>{
    setItems(p=>p.map(d=>{
      if(d.id!==id) return d;
      const numFields = ["qty","labor","material","expense"];
      const u = {...d, [field]: numFields.includes(field) ? (Number(value)||0) : value};
      if(field==="priceId"&&PRICE_DB[value]){
        const pr=PRICE_DB[value];
        u.name=pr.name; u.spec=pr.spec; u.unit=pr.unit;
        u.labor=0; u.material=0; u.expense=0; // DB 사용 시 자체값 초기화
      }
      return u;
    }));
  },[]);

  const addItem=useCallback(()=>setItems(p=>[...p,{id:nid(),cat:"4.",name:"",spec:"",unit:"m²",qty:1,priceId:"",labor:0,material:0,expense:0,enabled:true}]),[]);
  const delUnchecked=useCallback(()=>{if(!window.confirm("삭제?"))return;setItems(p=>p.filter(d=>d.enabled))},[]);

  const act=useMemo(()=>items.filter(i=>i.enabled),[items]);
  const calcCat=useCallback(c=>act.filter(i=>i.cat===c).reduce((s,i)=>{const p=getPrice(i);return{g:s.g+Math.round(i.qty*p.total),i:s.i+Math.round(i.qty*p.labor),k:s.k+Math.round(i.qty*p.material),m:s.m+Math.round(i.qty*p.expense)}},{g:0,i:0,k:0,m:0}),[act]);
  const t1=calcCat("1."),t2=calcCat("2."),t3=calcCat("3."),t4=calcCat("4.");
  const sunG=t1.g+t2.g+t3.g+t4.g,sunI=t1.i+t2.i+t3.i+t4.i,sunK=t1.k+t2.k+t3.k+t4.k,sunM=t1.m+t2.m+t3.m+t4.m;
  const sT=sagub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gTot=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gF=Math.round(gTot*FEE_RATE),grand=sunG+sT+gTot+gF;

  const handleChatSend=useCallback(()=>{if(!chatInput.trim())return;const msg=chatInput.trim();setChatLog(p=>[...p,{role:"user",text:msg}]);setChatInput("");setTimeout(()=>{setChatLog(p=>[...p,{role:"ai",text:getDesignAnswer(msg)}]);chatEndRef.current?.scrollIntoView({behavior:"smooth"})},500)},[chatInput]);
  const handleSave=useCallback(()=>{const fn=window.prompt("파일명:",`소규모주민숙원_${new Date().toISOString().slice(0,10)}`);if(!fn)return;const b=new Blob([JSON.stringify({v:"8.3",damage,items,chatLog,at:new Date().toISOString()},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`${fn}.json`;a.click();URL.revokeObjectURL(a.href)},[damage,items,chatLog]);
  const loadJ=useCallback(e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);const li=d.items||d.designItems||[];const ld=d.damage||d.dmg||[];if(li.length>0){setItems(li.map(i=>({labor:0,material:0,expense:0,...i})));setDamage(ld.length?ld:INIT_DAMAGE());setAnalyzed(true);if(d.chatLog)setChatLog(d.chatLog);_nid=Math.max(...li.map(x=>x.id),200)+1;alert(`불러오기 완료! (${li.length}개)`)}else alert("데이터 없음")}catch(err){alert("오류:"+err.message)}};r.readAsText(f);e.target.value=""},[]);
  const handleXL=useCallback(async t=>{setXlLoad(t);try{if(t==="d")await genDesignXL(items,sagub,gwangub,FEE_RATE);else if(t==="q")await genQtyXL(items,gwangub,FEE_RATE);else await genUnitXL(items,sagub,gwangub)}finally{setXlLoad(null)}},[items,sagub,gwangub]);

  return(
    <div className="min-h-screen bg-white" style={{fontFamily:"'Pretendard','Noto Sans KR',sans-serif"}}>
      <div className="bg-slate-800 text-white py-5 px-4"><div className="max-w-7xl mx-auto"><p className="text-blue-300 text-xs tracking-widest mb-1">소규모주민숙원사업</p><h1 className="text-2xl font-bold">종합검토보고서 <span className="text-sm font-normal text-slate-400">v8.3</span></h1></div></div>
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm"><div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">{[["analysis","🔍 AI 분석"],["estimate","📊 설계내역서"]].map(([k,l])=><button key={k} onClick={()=>{setView(k);window.scrollTo(0,0)}} className={`px-5 py-2.5 text-sm rounded-lg font-bold ${view===k?"bg-blue-600 text-white shadow-md":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{l}</button>)}</div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={handleNewWork} className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded hover:bg-slate-800 font-medium">🆕 새로운작업</button>
          <button onClick={handleSave} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium">💾 저장</button>
          <button onClick={()=>jsonRef.current?.click()} className="px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">📂 불러오기</button>
          <input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={loadJ}/>
          <button onClick={()=>{if(window.confirm("⚠️ 현재 작업을 반드시 저장한 후 실행하세요.\n\n저장하셨습니까?\n\n[확인] → Netlify 앱 실행\n[취소] → 돌아가서 저장"))window.open("https://bespoke-boba-03d8af.netlify.app","_blank")}} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium">🚀 설계앱 실행</button>
        </div>
      </div></div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {view==="analysis"&&<>
        <section><Hd n="📷" t="현장 사진 + AI 분석"/><div className="mt-3 flex gap-3 items-center flex-wrap"><button onClick={()=>fileRef.current?.click()} className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 font-medium">📷 사진 업로드</button><button onClick={handleAnalyze} disabled={analyzing} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold shadow">{analyzing?"⏳ 분석 중...":"🤖 AI 분석 실행"}</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoUrl(URL.createObjectURL(f));setAnalyzed(false)}}}/></div>{photoUrl&&<img src={photoUrl} alt="" className="mt-3 h-44 rounded-lg border cursor-pointer" onClick={()=>setPhotoModal(true)}/>}{photoModal&&photoUrl&&<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={()=>setPhotoModal(false)}><img src={photoUrl} alt="" className="max-w-full max-h-full rounded-lg"/></div>}{!analyzed&&photoUrl&&<p className="mt-2 text-sm text-orange-600 font-medium">📌 "AI 분석 실행"을 클릭하세요.</p>}{!analyzed&&!photoUrl&&<div className="mt-4 p-10 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center"><p className="text-slate-500">사진 업로드 후 AI 분석을 실행하거나, 저장 파일을 불러오세요.</p></div>}</section>

        {analyzed&&<>
          <section><Hd n="1" t="종합 분석"/><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3"><IC t="현장 제원" c="blue"><IR l="위치" v="좌안 석축 호안"/><IR l="연장" v="약 20m"/><IR l="석축" v="약 2.5m"/><IR l="세굴" v="약 1.0m"/></IC><IC t="피해 원인 / 복구 판정" c="red"><IR l="1차" v="급류 수충"/><IR l="2차" v="기초세굴→전면붕괴"/><IR l="판정" v="【개선복구】"/><IR l="설계" v="구조물 신설, 근입 D≥1.0m"/></IC></div><div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3"><h4 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm"><div><span className="text-slate-500 text-xs">품목</span><p className="font-semibold">레미콘,철근,석재,잡석</p></div><div><span className="text-slate-500 text-xs">관급자재비</span><p className="font-bold text-red-600">{fmt(gTot)}원</p></div><div><span className="text-slate-500 text-xs">수수료율</span><p>1.5%</p></div><div><span className="text-slate-500 text-xs">관급수수료</span><p className="font-bold text-red-600">{fmt(gF)}원</p></div></div></div></section>

          <section><div className="flex items-center justify-between flex-wrap gap-2"><Hd n="2" t="피해현황 (개선복구 설계물량)"/><div className="flex gap-1"><button onClick={addDamage} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium">➕ 항목추가</button><button onClick={delDamageUnchecked} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium">🗑️ 선택삭제</button></div></div>
          <div className="mt-2 overflow-x-auto border rounded-lg"><table className="w-full text-sm border-collapse"><thead><tr className="bg-blue-700 text-white"><th className="border border-blue-600 px-2 py-2 w-8"><input type="checkbox" checked={allD} ref={el=>{if(el)el.indeterminate=!allD&&someD}} onChange={toggleAllD} className="w-4 h-4"/></th><th className="border border-blue-600 px-2 py-2 w-10">No</th><th className="border border-blue-600 px-3 py-2" style={{minWidth:150}}>공종 (개선복구)</th><th className="border border-blue-600 px-3 py-2">수량산출근거</th><th className="border border-blue-600 px-2 py-2 w-16">수량</th><th className="border border-blue-600 px-2 py-2 w-14">단위</th></tr></thead>
          <tbody>{damage.map((d,i)=><tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-40 line-through":!d.item?"bg-yellow-50":i%2===0?"bg-white":"bg-slate-50"}><td className="border px-2 py-1.5 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>toggleD(d.id)} className="w-4 h-4"/></td><td className="border px-2 py-1.5 text-center font-medium">{i+1}</td><td className="border px-2 py-1.5"><input value={d.item} onChange={e=>updDamage(d.id,"item",e.target.value)} className="w-full bg-transparent text-sm font-medium text-blue-800 outline-none focus:bg-blue-50 rounded px-1" placeholder="공종명"/></td><td className="border px-2 py-1.5"><input value={d.basis} onChange={e=>updDamage(d.id,"basis",e.target.value)} className="w-full bg-transparent text-xs text-slate-600 outline-none focus:bg-blue-50 rounded px-1" placeholder="산출근거"/></td><td className="border px-1 py-1.5 text-center"><input type="number" value={d.qty} onChange={e=>updDamage(d.id,"qty",e.target.value)} className="w-full text-center bg-transparent text-sm font-bold outline-none focus:bg-blue-50 rounded"/></td><td className="border px-1 py-1.5 text-center"><select value={d.unit} onChange={e=>updDamage(d.id,"unit",e.target.value)} className="text-sm bg-transparent outline-none">{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></td></tr>)}</tbody></table></div></section>

          <section><Hd n="💬" t="설계 참고 질문"/><div className="border rounded-lg bg-slate-50 p-3 max-h-52 overflow-y-auto space-y-2">{chatLog.length===0&&<p className="text-slate-400 text-sm text-center py-3">예: "석축 설계기준", "기초 배근 기준"</p>}{chatLog.map((msg,i)=><div key={i} className={`flex ${msg.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-md px-3 py-2 rounded-lg text-sm whitespace-pre-line ${msg.role==="user"?"bg-blue-600 text-white":"bg-white border text-slate-700"}`}>{msg.text}</div></div>)}<div ref={chatEndRef}/></div><div className="flex gap-2 mt-2"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();handleChatSend()}}} placeholder="질문 입력..." className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"/><button onClick={handleChatSend} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm">전송</button></div></section>

          <section><Hd n="3" t="구조물 제원"/><div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"><SpecC t="석축(찰쌓기)" items={[`H=${STRUCT.wallH}m, T=${STRUCT.wallT*100}cm`,`L=${STRUCT.wallL}m, 근입D=${STRUCT.foundD}m`]} c="blue"/><SpecC t="기초 콘크리트" items={[`${STRUCT.conSpec} (σck=21MPa)`,`B=${STRUCT.foundW}m, D=${STRUCT.foundD}m`,STRUCT.steelSpec]} c="red"/><SpecC t="잡석 기초" items={[`B=${STRUCT.foundW}m, T=${STRUCT.japsukT}m`,"부직포 하부+배면"]} c="amber"/></div></section>

          <section><Hd n="4" t="설계 표준단면도"/><p className="text-xs text-slate-500 mt-1">하천설계기준(2019) · KDS 51 40 15</p><div className="mt-3 flex justify-center"><XSec s={STRUCT}/></div></section>
        </>}
      </>}

      {view==="estimate"&&<>
        {items.length===0?<div className="p-12 bg-slate-50 border-2 border-dashed rounded-xl text-center"><p className="text-slate-500 mb-4">데이터 없음</p><button onClick={()=>setView("analysis")} className="px-4 py-2 bg-blue-600 text-white rounded-lg">← AI 분석</button></div>
        :<>
          <section><div className="flex items-center justify-between flex-wrap gap-2"><Hd n="📋" t="설계물량 편집"/><div className="flex gap-1"><button onClick={addItem} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium">➕ 공종추가</button><button onClick={delUnchecked} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium">🗑️ 선택삭제</button></div></div>
          <p className="text-xs text-blue-600 mt-1 mb-2">단가ID→자동채움 · 수량→즉시재계산 · <span className="text-orange-600 font-medium">PRICE_DB에 없는 공종은 내역서에서 노무비/재료비/경비 단가 직접입력</span></p>
          <EditTable items={items} onToggleAll={toggleAllI} onToggle={toggleI} onUpdate={updField} allChk={allI} someChk={someI}/>
          <div className="mt-2 text-right text-sm font-bold">직접공사비: <span className="text-blue-700">{fmt(sunG)}원</span></div></section>

          {/* ★ 13열 내역서 — IR13Edit에서 단가 직접입력 가능 */}
          <section><Hd n="2" t="설계 내역서"/><p className="text-xs text-slate-500 mt-1 mb-1">2025년 충청북도 일위대가</p><p className="text-xs text-orange-600 mb-3">💡 노란색 셀: 단가 직접입력 가능 (PRICE_DB에 없는 항목)</p>
          <div className="overflow-x-auto border rounded-lg"><table className="w-full text-xs border-collapse" style={{minWidth:1100}}>
            <thead><tr className="bg-blue-700 text-white"><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-10">공종</th><th rowSpan={2} className="border border-blue-600 px-2 py-1.5 w-32">품 명</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-36">규 격</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-12">수량</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-8">단위</th><th colSpan={2} className="border border-blue-600 text-center">합 계</th><th colSpan={2} className="border border-blue-600 text-center">노 무 비</th><th colSpan={2} className="border border-blue-600 text-center">재 료 비</th><th colSpan={2} className="border border-blue-600 text-center">경 비</th></tr>
            <tr className="bg-blue-600 text-white text-center">{["단가","금액","단가","금액","단가","금액","단가","금액"].map((t,i)=><th key={i} className="border border-blue-500 px-1 py-1">{t}</th>)}</tr></thead>
            <tbody>
              <TR13 label="순 공 사 비" a={[sunG,sunI,sunK,sunM]} bg="bg-slate-200" tc="text-slate-800"/>
              {[{c:"1.",n:"토공",t:t1},{c:"2.",n:"구조물공",t:t2},{c:"3.",n:"포장공",t:t3},{c:"4.",n:"부대공",t:t4}].map(({c,n,t})=>{const ci=act.filter(i=>i.cat===c);if(!ci.length)return null;return<Fragment key={c}><CR13 code={c} name={n} a={[t.g,t.i,t.k,t.m]}/>{ci.map((item,idx)=><IR13Edit key={item.id} item={item} onUpdate={updField} idx={idx}/>)}</Fragment>})}
              <CR13 code="5." name="사급자재대" a={[sT,0,0,0]} fill="bg-orange-50"/>{sagub.map((it,idx)=><tr key={it.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1"></td><td className="border px-2 py-1">{it.name}</td><td className="border px-1 py-1 text-slate-500">{it.spec}</td><td className="border px-1 py-1 text-center">{it.qty}</td><td className="border px-1 py-1 text-center">{it.unit}</td><td className="border px-1 py-1 text-right">{fmt(it.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(it.qty*it.unitPrice))}</td><td colSpan={6} className="border"></td></tr>)}
              <CR13 code="6." name="관급자재대" a={[gTot,0,0,0]} fill="bg-red-50"/>{gwangub.map((it,idx)=><tr key={it.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1 text-center text-xs">{it.sub}</td><td className="border px-2 py-1">{it.name}</td><td className="border px-1 py-1 text-slate-500">{it.spec}</td><td className="border px-1 py-1 text-center">{it.qty}</td><td className="border px-1 py-1 text-center">{it.unit}</td><td className="border px-1 py-1 text-right">{fmt(it.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(it.qty*it.unitPrice))}</td><td colSpan={6} className="border"></td></tr>)}
              <tr className="bg-red-50 font-bold"><td colSpan={5} className="border px-3 py-1.5 text-center text-red-700">관급수수료 (1.5%)</td><td className="border"></td><td className="border px-1 py-1.5 text-right text-red-700">{fmt(gF)}</td><td colSpan={6} className="border"></td></tr>
              <TR13 label="총 공 사 비" a={[grand,0,0,0]} bg="bg-slate-800" tc="text-white"/>
            </tbody></table></div></section>

          <section><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["직접공사비",sunG,"blue"],["사급자재비",sT,"orange"],["관급자재비",gTot,"red"],["관급수수료",gF,"pink"],["총공사비",grand,"slate"]].map(([l,v,c],i)=><SCard key={i} l={l} v={v} c={c} bold={i===4}/>)}</div></section>

          <section><Hd n="📊" t="엑셀 다운로드"/><div className="mt-3 flex gap-3 flex-wrap">{[["d","📊 설계내역서","bg-green-600 hover:bg-green-700"],["q","📋 수량산출서","bg-blue-600 hover:bg-blue-700"],["u","📑 일위대가","bg-purple-600 hover:bg-purple-700"]].map(([k,l,cls])=><button key={k} disabled={xlLoad===k} onClick={()=>handleXL(k)} className={`px-4 py-2 ${cls} text-white text-sm rounded-lg shadow disabled:opacity-50 font-medium`}>{xlLoad===k?"생성중...":l}</button>)}</div></section>
        </>}
      </>}

      <footer className="border-t pt-4 pb-6 text-xs text-slate-400"><p>2025년 충청북도 일위대가 · 하천설계기준(2019)</p></footer>
      </div>
    </div>
  );
}

/* Sub */
function Hd({n,t}){return<div className="flex items-center gap-2"><span className="bg-blue-600 text-white text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center">{n}</span><h2 className="text-lg font-bold text-slate-800">{t}</h2></div>}
function IC({t,c,children}){const cls=c==="blue"?"bg-blue-50 border-blue-200":"bg-red-50 border-red-200";const tc2=c==="blue"?"text-blue-700":"text-red-700";return<div className={`${cls} border rounded-lg p-4`}><h4 className={`font-bold ${tc2} text-sm mb-2`}>{t}</h4><div className="space-y-1.5">{children}</div></div>}
function IR({l,v}){return<div className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800">{v}</span></div>}
function SpecC({t,items,c}){const cls={"blue":"bg-blue-50 border-blue-200","red":"bg-red-50 border-red-200","amber":"bg-amber-50 border-amber-200"}[c];return<div className={`${cls} border rounded-lg p-3`}><h4 className="font-bold text-sm mb-2">{t}</h4>{items.map((s,i)=><p key={i} className="text-xs text-slate-700">• {s}</p>)}</div>}
function TR13({label,a,bg,tc}){return<tr className={`${bg} font-bold`}><td colSpan={5} className={`border px-3 py-1.5 text-center ${tc}`}>{label}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{fmt(a[0])}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{a[1]?fmt(a[1]):""}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{a[2]?fmt(a[2]):""}</td><td className="border"></td><td className={`border px-1 py-1.5 text-right ${tc}`}>{a[3]?fmt(a[3]):""}</td></tr>}
function CR13({code,name,a,fill}){const bg=fill||"bg-blue-50";return<tr className={`${bg} font-bold`}><td className="border px-1 py-1 text-center text-blue-700 text-xs">{code}</td><td className="border px-2 py-1 text-blue-700">{name}</td><td className="border"></td><td className="border"></td><td className="border"></td><td className="border"></td><td className="border px-1 py-1 text-right text-blue-700">{fmt(a[0])}</td><td className="border"></td><td className="border px-1 py-1 text-right">{a[1]?fmt(a[1]):""}</td><td className="border"></td><td className="border px-1 py-1 text-right">{a[2]?fmt(a[2]):""}</td><td className="border"></td><td className="border px-1 py-1 text-right">{a[3]?fmt(a[3]):""}</td></tr>}
function SCard({l,v,c,bold}){const cls={blue:"bg-blue-50 border-blue-200 text-blue-700",orange:"bg-orange-50 border-orange-200 text-orange-600",red:"bg-red-50 border-red-200 text-red-600",pink:"bg-pink-50 border-pink-200 text-pink-600",slate:"bg-slate-800 border-slate-700 text-white"}[c];return<div className={`rounded-lg border p-3 ${cls}`}><p className="text-xs opacity-75">{l}</p><p className={`${bold?"text-lg":"text-sm"} font-bold mt-0.5`}>{fmt(v)}원</p></div>}

function XSec({s}){const sc=80,wH=s.wallH*sc,wT=s.wallT*sc*3,fW=s.foundW*sc,fD=s.foundD*sc,jT=s.japsukT*sc,ox=140,gy=265,fT=gy-fD,wTop=fT-wH;return<svg viewBox="0 0 700 420" className="w-full max-w-3xl border rounded-lg bg-white p-3"><text x="350" y="18" fontSize="12" fill="#1e293b" textAnchor="middle" fontWeight="bold">하천 호안 석축 표준단면도</text><text x="350" y="32" fontSize="9" fill="#64748b" textAnchor="middle">하천설계기준(2019) · KDS 51 40 15 · 개선복구</text><line x1="30" y1={gy} x2="640" y2={gy} stroke="#78716c" strokeWidth="2" strokeDasharray="8,4"/><text x="645" y={gy+4} fontSize="10" fill="#78716c">G.L</text><rect x={ox} y={gy} width={fW} height={jT} fill="#d6d3d1" stroke="#78716c"/><text x={ox+fW/2} y={gy+jT/2+4} fontSize="9" fill="#44403c" textAnchor="middle">잡석 T={s.japsukT}m</text><rect x={ox-5} y={gy+jT} width={fW+10} height={5} fill="#93c5fd" stroke="#3b82f6" strokeWidth="0.8"/><text x={ox+fW+15} y={gy+jT+5} fontSize="8" fill="#2563eb" fontWeight="bold">부직포</text><rect x={ox+10} y={fT} width={fW-20} height={fD} fill="#d1d5db" stroke="#374151" strokeWidth="2"/>{Array.from({length:12}).map((_,i)=><line key={i} x1={ox+15+i*15} y1={fT+2} x2={ox+5+i*15} y2={fT+fD-2} stroke="#9ca3af" strokeWidth="0.3"/>)}<text x={ox+fW/2} y={fT+fD/2-5} fontSize="11" fill="#1f2937" textAnchor="middle" fontWeight="bold">R.C 기초</text><text x={ox+fW/2} y={fT+fD/2+10} fontSize="8" fill="#4b5563" textAnchor="middle">{s.conSpec} W={s.foundW}m×D={s.foundD}m</text>{Array.from({length:6}).map((_,i)=><circle key={`b${i}`} cx={ox+20+i*30} cy={fT+fD-12} r="3" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8"/>)}{Array.from({length:6}).map((_,i)=><circle key={`t${i}`} cx={ox+20+i*30} cy={fT+12} r="3" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8"/>)}<text x={ox+fW+15} y={fT+fD-8} fontSize="8" fill="#dc2626" fontWeight="bold">● {s.steelSpec}</text><rect x={ox+10} y={wTop} width={wT} height={wH} fill="#fbbf24" stroke="#92400e" strokeWidth="2" rx="2"/>{Array.from({length:Math.floor(wH/18)}).map((_,i)=><Fragment key={i}><line x1={ox+12} y1={wTop+8+i*18} x2={ox+8+wT} y2={wTop+8+i*18} stroke="#92400e" strokeWidth="0.5" opacity="0.5"/></Fragment>)}<text x={ox+10+wT/2} y={wTop-8} fontSize="10" fill="#92400e" textAnchor="middle" fontWeight="bold">찰쌓기 T={Math.round(s.wallT*100)}cm</text><rect x={ox+10+wT} y={wTop} width={70} height={wH} fill="#fef3c7" stroke="#d97706" strokeDasharray="4,2"/><text x={ox+10+wT+35} y={wTop+wH/2} fontSize="9" fill="#92400e" textAnchor="middle">뒤채움</text><line x1={ox+10+wT} y1={wTop} x2={ox+10+wT} y2={fT} stroke="#3b82f6" strokeWidth="3" strokeDasharray="6,3"/><rect x={ox+10+wT+70} y={wTop-12} width={200} height={12} fill="#374151" rx="1"/><text x={ox+10+wT+170} y={wTop-18} fontSize="12" fill="#1f2937" textAnchor="middle" fontWeight="bold">도 로</text><text x="65" y={fT+25} fontSize="13" fill="#2563eb" textAnchor="middle" fontWeight="bold">하 천</text><path d={`M45,${fT+40} Q65,${fT+47} 45,${fT+57} Q65,${fT+64} 45,${fT+74}`} fill="none" stroke="#3b82f6" strokeWidth="2"/><line x1={ox-8} y1={wTop} x2={ox-8} y2={fT} stroke="#dc2626" strokeWidth="1"/><text x={ox-25} y={(wTop+fT)/2+4} fontSize="10" fill="#dc2626" textAnchor="middle" fontWeight="bold" transform={`rotate(-90,${ox-25},${(wTop+fT)/2})`}>H={s.wallH}m</text><line x1={ox+fW+8} y1={fT} x2={ox+fW+8} y2={gy} stroke="#dc2626" strokeWidth="1"/><text x={ox+fW+22} y={(fT+gy)/2+4} fontSize="10" fill="#dc2626" fontWeight="bold">D={s.foundD}m</text><line x1={ox+10} y1={fT-12} x2={ox+fW-10} y2={fT-12} stroke="#059669" strokeWidth="1"/><text x={ox+fW/2} y={fT-18} fontSize="10" fill="#059669" textAnchor="middle" fontWeight="bold">B={s.foundW}m</text><rect x="490" y="340" width="190" height="65" fill="white" stroke="#d1d5db" rx="4"/><text x="500" y="355" fontSize="9" fill="#374151" fontWeight="bold">범 례</text><rect x="500" y="360" width="14" height="9" fill="#fbbf24" stroke="#92400e"/><text x="520" y="369" fontSize="8">석축(찰쌓기)</text><rect x="500" y="374" width="14" height="9" fill="#d1d5db" stroke="#374151"/><text x="520" y="383" fontSize="8">R.C기초</text><rect x="500" y="388" width="14" height="9" fill="#d6d3d1" stroke="#78716c"/><text x="520" y="397" fontSize="8">잡석다짐</text><text x="30" y="400" fontSize="7" fill="#94a3b8">하천설계기준(2019) · KDS 51 40 15</text></svg>}
