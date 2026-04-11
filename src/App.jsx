import { useState, useRef, useCallback, useMemo, Fragment, memo } from "react";

/* ============================================================
   소규모주민숙원사업 종합검토보고서 v8.1
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const UNITS = ["m²","m³","m","hr","ton","일","식","본","개소","km"];
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

let _nid = 200;
const nid = () => _nid++;

/* 피해현황 = 개선복구 설계물량 개요 (수량산출근거 포함) */
const INIT_DAMAGE = () => [
  {id:1, item:"석축 신설 (찰쌓기)", basis:"기존 석축 전면 붕괴 → 찰쌓기 석축 신설\n높이 2.5m × 연장 20.5m (여유 0.5m 포함) = 51㎡", qty:51, unit:"㎡"},
  {id:2, item:"기초 콘크리트 신설", basis:"기초 세굴 → RC 기초 신설 (근입 D=1.0m)\n폭 2.5m × 연장 20.5m × 깊이 1.0m = 51㎥", qty:51, unit:"㎥"},
  {id:3, item:"잡석기초 다짐", basis:"기초 하부 잡석 다짐\n폭 2.5m × 연장 20.5m × T=0.5m = 26㎥", qty:26, unit:"㎥"},
  {id:4, item:"도로 포장 복구", basis:"아스팔트 포장면 파손 복구\n폭 2.0m × 연장 20m = 40㎡", qty:40, unit:"㎡"},
  {id:5, item:"사면 녹화 복원", basis:"붕괴 사면 녹화 복원\n높이 3.0m × 연장 15m = 45㎡", qty:45, unit:"㎡"},
  {id:6, item:"토사 굴착 및 사토", basis:"붕괴 잔해 굴착 + 터파기 + 사토운반\n총 308㎥ (토량환산 C=1.0)", qty:308, unit:"㎥"},
];

const INIT_ITEMS = () => [
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

const INIT_SAGUB = () => [{id:101,name:"합판거푸집(자재)",spec:"합판,유로폼",unit:"m²",qty:41,unitPrice:12000,source:"거래처 견적"},{id:102,name:"부직포(자재)",spec:"부직포 원단",unit:"m²",qty:72,unitPrice:1500,source:"거래처 견적"}];
const INIT_GWANGUB = () => [{id:201,sub:"6.1",name:"레미콘",spec:"25-210-12",unit:"m³",qty:51,unitPrice:75000,source:"레미콘 업체 견적"},{id:202,sub:"6.2",name:"이형철근(SD400)",spec:"HD13",unit:"ton",qty:2.6,unitPrice:950000,source:"철강 유통 시세"},{id:203,sub:"6.3",name:"석재",spec:"자연석,석축용",unit:"m²",qty:51,unitPrice:45000,source:"석재 업체 견적"},{id:204,sub:"6.3",name:"잡석",spec:"25-40mm",unit:"m³",qty:24,unitPrice:22000,source:"골재 업체 견적"}];
const FEE_RATE = 0.015;
const STRUCT = {wallH:2.5,wallT:0.35,wallL:20.5,foundW:2.5,foundD:1.0,japsukT:0.5,steelSpec:"HD13 @200, SD400",conSpec:"25-210-12"};
const CALC_BASIS={1:"표토제거=폭2.5m×길이14m=35m²",2:"토사굴착=폭2.0m×길이10m×깊이2.0m=40m³",3:"기초터파기=폭2.5m×길이20.5m×깊이1.0m=51m³",4:"잡석기초=폭2.5m×길이20.5m×두께0.5m=26m³",5:"기초콘크리트=폭2.5m×길이20.5m×깊이1.0m=51m³",6:"석축찰쌓기=높이2.5m×길이20.5m=51m²",7:"거푸집=기초양측면+전면=41m²",8:"철근=HD13@200,기초51m³×배근율≒2.6ton",9:"양생=기초상면+측면=92m²",10:"부직포=잡석하부+석축배면≒72m²",11:"비닐=기초하부2.5m×20.5m=51m²",12:"뒤채움=석축배면폭1.5m×높이2.5m×길이20.5m×0.45≒35m³",13:"되메우기=잔여1.0m×1.0m×20.5m≒20m³",14:"사면녹화=높이3.0m×길이15m=45m²",15:"사토운반=터파기51+토사40+잔해217=308m³",16:"교통통제=공사기간5일",17:"물푸기=24시간",18:"아스팔트=폭2.0m×길이20m=40m²"};

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
    <tbody>{items.map((d,idx)=>{const p=PRICE_DB[d.priceId]||{total:0};const isNew=!d.name;return(
      <tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-40 line-through":isNew?"bg-yellow-50":"bg-white hover:bg-blue-50"}>
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

/* ============================================================ Excel (간략화 — 동일 로직) */
const loadXLSX=()=>new Promise((res,rej)=>{if(window.XLSX){res(window.XLSX);return}const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";s.onload=()=>window.XLSX?res(window.XLSX):rej(new Error("f"));s.onerror=()=>{const s2=document.createElement("script");s2.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";s2.onload=()=>res(window.XLSX);s2.onerror=()=>rej(new Error("CDN"));document.head.appendChild(s2)};document.head.appendChild(s)});
const HS={font:{bold:true,color:{rgb:"FFFFFF"},sz:10},fill:{fgColor:{rgb:"4472C4"}},border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"center",vertical:"center",wrapText:true}};
const CST=rgb=>({font:{bold:true,sz:10},fill:{fgColor:{rgb}},border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"center",vertical:"center"}});
const NS={numFmt:"#,##0",border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"right"}};
const TS={border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{wrapText:true}};
const TTS2=(rgb,fc="000000")=>({font:{bold:true,color:{rgb:fc},sz:11},fill:{fgColor:{rgb}},border:{top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}},alignment:{horizontal:"center"},numFmt:"#,##0"});
function wsc(ws,r,c,v,s){const ref=window.XLSX.utils.encode_cell({r,c});if(!ws[ref])ws[ref]={};ws[ref].v=v;if(typeof v==="number")ws[ref].t="n";else if(typeof v==="string"&&v.startsWith("=")){ws[ref].f=v.slice(1);ws[ref].t="n";delete ws[ref].v}else ws[ref].t="s";if(s)ws[ref].s=s}

// (엑셀 함수 genDesignXL, genQtyXL, genUnitXL은 v8.0과 동일 — 지면상 축약)
async function genDesignXL(items,sagub,gwangub,fr){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),ws={};ws["!cols"]=[{wch:8},{wch:24},{wch:28},{wch:10},{wch:6},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14}];wsc(ws,0,0,"설 계 내 역 서 (소규모주민숙원사업)",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:12}}];wsc(ws,1,0,"단가근거: 2025년 충청북도 일위대가 목록표",{font:{sz:9,color:{rgb:"666666"}},alignment:{horizontal:"center"}});ws["!merges"].push({s:{r:1,c:0},e:{r:1,c:12}});["공종","품 명","규 격","수량","단위","합 계","","노 무 비","","재 료 비","","경 비",""].forEach((v,c)=>wsc(ws,2,c,v,HS));["","","","","","단가","금액","단가","금액","단가","금액","단가","금액"].forEach((v,c)=>{if(c>=5)wsc(ws,3,c,v,HS)});for(let c=0;c<5;c++)ws["!merges"].push({s:{r:2,c},e:{r:3,c}});ws["!merges"].push({s:{r:2,c:5},e:{r:2,c:6}},{s:{r:2,c:7},e:{r:2,c:8}},{s:{r:2,c:9},e:{r:2,c:10}},{s:{r:2,c:11},e:{r:2,c:12}});let r=4;const catRows={};const sunRow=r;r++;CATS.forEach(cc=>{const ci=act.filter(i=>i.cat===cc);if(!ci.length)return;const cr=r;r++;catRows[cc]={row:cr,items:[]};wsc(ws,cr,0,cc,CST("DBEAFE"));wsc(ws,cr,1,CAT_NAMES[cc],CST("DBEAFE"));for(let c=2;c<13;c++)wsc(ws,cr,c,"",CST("DBEAFE"));ci.forEach(item=>{const p=PRICE_DB[item.priceId]||{total:0,labor:0,material:0,expense:0},ir=r;r++;catRows[cc].items.push(ir);wsc(ws,ir,0,"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec||"",TS);wsc(ws,ir,3,item.qty,{...NS,numFmt:"#,##0.0##"});wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,`=H${ir+1}+J${ir+1}+L${ir+1}`,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);wsc(ws,ir,7,p.labor,NS);wsc(ws,ir,8,`=D${ir+1}*H${ir+1}`,NS);wsc(ws,ir,9,p.material,NS);wsc(ws,ir,10,`=D${ir+1}*J${ir+1}`,NS);wsc(ws,ir,11,p.expense,NS);wsc(ws,ir,12,`=D${ir+1}*L${ir+1}`,NS)});const irs=catRows[cc].items;if(irs.length)[6,8,10,12].forEach(c=>{const col=String.fromCharCode(65+c);wsc(ws,cr,c,`=SUM(${col}${irs[0]+1}:${col}${irs[irs.length-1]+1})`,{...CST("DBEAFE"),numFmt:"#,##0"})})});const sunS=TTS2("D6DCE4");wsc(ws,sunRow,0,"",sunS);wsc(ws,sunRow,1,"순 공 사 비",sunS);for(let c=2;c<13;c++)wsc(ws,sunRow,c,"",sunS);ws["!merges"].push({s:{r:sunRow,c:0},e:{r:sunRow,c:1}});const uc=CATS.filter(c=>catRows[c]);[6,8,10,12].forEach(c=>{const col=String.fromCharCode(65+c);const refs=uc.map(cc=>`${col}${catRows[cc].row+1}`).join("+");if(refs)wsc(ws,sunRow,c,`=${refs}`,{...sunS,numFmt:"#,##0"})});const sRow=r;r++;wsc(ws,sRow,0,"5.",CST("FFF7ED"));wsc(ws,sRow,1,"사급자재대",CST("FFF7ED"));for(let c=2;c<13;c++)wsc(ws,sRow,c,"",CST("FFF7ED"));const si=[];sagub.forEach(item=>{const ir=r;r++;si.push(ir);wsc(ws,ir,0,"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec,TS);wsc(ws,ir,3,item.qty,NS);wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,item.unitPrice,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);for(let c=7;c<13;c++)wsc(ws,ir,c,"",TS)});if(si.length)wsc(ws,sRow,6,`=SUM(G${si[0]+1}:G${si[si.length-1]+1})`,{...CST("FFF7ED"),numFmt:"#,##0"});const gRow=r;r++;wsc(ws,gRow,0,"6.",CST("FEF2F2"));wsc(ws,gRow,1,"관급자재대",CST("FEF2F2"));for(let c=2;c<13;c++)wsc(ws,gRow,c,"",CST("FEF2F2"));const gi=[];gwangub.forEach(item=>{const ir=r;r++;gi.push(ir);wsc(ws,ir,0,item.sub||"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec,TS);wsc(ws,ir,3,item.qty,NS);wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,item.unitPrice,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);for(let c=7;c<13;c++)wsc(ws,ir,c,"",TS)});if(gi.length)wsc(ws,gRow,6,`=SUM(G${gi[0]+1}:G${gi[gi.length-1]+1})`,{...CST("FEF2F2"),numFmt:"#,##0"});const fRow=r;r++;wsc(ws,fRow,0,"",CST("FEF2F2"));wsc(ws,fRow,1,"관급수수료 (1.5%)",CST("FEF2F2"));for(let c=2;c<13;c++)wsc(ws,fRow,c,"",CST("FEF2F2"));wsc(ws,fRow,6,`=ROUND(G${gRow+1}*0.015,0)`,{...CST("FEF2F2"),numFmt:"#,##0"});const grRow=r;r++;const gS=TTS2("1E3A5F","FFFFFF");wsc(ws,grRow,0,"",gS);wsc(ws,grRow,1,"총 공 사 비",gS);for(let c=2;c<13;c++)wsc(ws,grRow,c,"",gS);ws["!merges"].push({s:{r:grRow,c:0},e:{r:grRow,c:1}});wsc(ws,grRow,6,`=G${sunRow+1}+G${sRow+1}+G${gRow+1}+G${fRow+1}`,{...gS,numFmt:"#,##0"});ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r,c:12}});X.utils.book_append_sheet(wb,ws,"내역서");X.writeFile(wb,`설계내역서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

async function genQtyXL(items,gwangub,fr){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),ws={};ws["!cols"]=[{wch:5},{wch:22},{wch:28},{wch:7},{wch:10},{wch:65},{wch:15}];wsc(ws,0,0,"수 량 산 출 서",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:6}}];["No","공종명","규격","단위","수량","산출근거","비고"].forEach((v,c)=>wsc(ws,1,c,v,HS));act.forEach((item,i)=>{const r=i+2;wsc(ws,r,0,i+1,{...TS,alignment:{horizontal:"center"}});wsc(ws,r,1,item.name,TS);wsc(ws,r,2,item.spec||"",TS);wsc(ws,r,3,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,r,4,item.qty,{...NS,numFmt:item.unit==="ton"?"#,##0.000":"#,##0"});wsc(ws,r,5,CALC_BASIS[item.id]||`설계수량=${item.qty}${item.unit}`,TS);wsc(ws,r,6,item.priceId,{...TS,font:{color:{rgb:"2563EB"}}})});const gTot=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0),fee=Math.round(gTot*fr),lr=act.length+2;wsc(ws,lr,0,act.length+1,{...TS,alignment:{horizontal:"center"}});wsc(ws,lr,1,"관급수수료",TS);wsc(ws,lr,2,"×1.5%",TS);wsc(ws,lr,3,"식",{...TS,alignment:{horizontal:"center"}});wsc(ws,lr,4,1,NS);wsc(ws,lr,5,`관급자재비${fmt(gTot)}원×1.5%=${fmt(fee)}원`,TS);wsc(ws,lr,6,"",TS);ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r:lr,c:6}});X.utils.book_append_sheet(wb,ws,"수량산출서");X.writeFile(wb,`수량산출서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

async function genUnitXL(items,sagub,gwangub){try{const X=await loadXLSX(),wb=X.utils.book_new(),ws={};ws["!cols"]=[{wch:10},{wch:25},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:25}];wsc(ws,0,0,"일위대가 단가목록 (2025년 충청북도)",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}}];["단가ID","공종명","규격","합계","노무비","재료비","경비","자재구분","출처"].forEach((v,c)=>wsc(ws,1,c,v,HS));const pids=[...new Set(items.filter(i=>i.enabled).map(i=>i.priceId))];let r=2;pids.forEach(pid=>{const p=PRICE_DB[pid];if(!p)return;let mt="";if(["기초지정","레미콘","석축","철근"].some(n=>p.name.includes(n)))mt="관급(자재별도)";else if(["합판거푸집","부직포"].some(n=>p.name.includes(n)))mt="사급(자재별도)";wsc(ws,r,0,pid,{...TS,alignment:{horizontal:"center"},font:{color:{rgb:"2563EB"}}});wsc(ws,r,1,p.name,TS);wsc(ws,r,2,p.spec,TS);wsc(ws,r,3,p.total,NS);wsc(ws,r,4,p.labor,NS);wsc(ws,r,5,p.material,NS);wsc(ws,r,6,p.expense,NS);wsc(ws,r,7,mt,mt?{...TS,font:{color:{rgb:mt.includes("관급")?"DC2626":"EA580C"}}}:TS);wsc(ws,r,8,"2025 충북 일위대가",TS);r++});r++;wsc(ws,r,1,"[ 사급·관급 자재 단가 ]",{...TS,font:{bold:true,color:{rgb:"B45309"}}});for(let c=0;c<9;c++)if(c!==1)wsc(ws,r,c,"",TS);r++;["품명","규격","자재단가","","","","","구분","출처"].forEach((v,c)=>wsc(ws,r,c,v,{...HS,fill:{fgColor:{rgb:"D97706"}}}));r++;sagub.forEach(i=>{wsc(ws,r,0,"",TS);wsc(ws,r,1,i.name,TS);wsc(ws,r,2,i.spec,TS);wsc(ws,r,3,i.unitPrice,NS);for(let c=4;c<7;c++)wsc(ws,r,c,"",TS);wsc(ws,r,7,"사급",{...TS,font:{color:{rgb:"EA580C"}}});wsc(ws,r,8,i.source,TS);r++});gwangub.forEach(i=>{wsc(ws,r,0,"",TS);wsc(ws,r,1,i.name,TS);wsc(ws,r,2,i.spec,TS);wsc(ws,r,3,i.unitPrice,NS);for(let c=4;c<7;c++)wsc(ws,r,c,"",TS);wsc(ws,r,7,"관급",{...TS,font:{color:{rgb:"DC2626"}}});wsc(ws,r,8,i.source,TS);r++});ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r,c:8}});X.utils.book_append_sheet(wb,ws,"일위대가");X.writeFile(wb,`일위대가_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

/* ============================================================ MAIN */
export default function App() {
  const [view, setView] = useState("analysis");
  const [damage, setDamage] = useState([]);
  const [items, setItems] = useState([]);
  const [sagub] = useState(INIT_SAGUB);
  const [gwangub] = useState(INIT_GWANGUB);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoModal, setPhotoModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [query, setQuery] = useState(""); // 수정/질문사항
  const [xlLoad, setXlLoad] = useState(null);
  const fileRef = useRef(null), jsonRef = useRef(null);

  const handleNewWork = useCallback(() => {
    if (!window.confirm("모든 데이터를 초기화합니까?")) return;
    _nid=200; setDamage([]); setItems([]); setPhotoUrl(null); setAnalyzed(false); setQuery(""); setView("analysis");
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!photoUrl) { alert("먼저 사진을 업로드해주세요"); return; }
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setAnalyzed(true); setDamage(INIT_DAMAGE()); _nid=200; setItems(INIT_ITEMS()); }, 1500);
  }, [photoUrl]);

  /* ★ 수정/질문사항 실행 — 피해현황에 항목 추가 */
  const handleQueryExec = useCallback(() => {
    if (!query.trim()) { alert("수정 또는 질문사항을 입력해주세요"); return; }
    const newDmg = {id: Date.now(), item: query.trim(), basis: "사용자 추가 항목", qty: 0, unit: "식"};
    setDamage(p => [...p, newDmg]);
    setQuery("");
    alert("피해현황에 추가되었습니다. 수량을 수정해주세요.");
  }, [query]);

  /* 설계내역 작성 실행 */
  const handleStartDesign = useCallback(() => {
    if (items.length === 0) { alert("AI 분석을 먼저 실행해주세요"); return; }
    setView("estimate");
    window.scrollTo(0, 0);
  }, [items]);

  const allI = useMemo(() => items.length>0 && items.every(d=>d.enabled), [items]);
  const someI = useMemo(() => items.some(d=>d.enabled), [items]);
  const toggleAllI = useCallback(() => setItems(p=>p.map(d=>({...d,enabled:!allI}))), [allI]);
  const toggleI = useCallback(id => setItems(p=>p.map(d=>d.id===id?{...d,enabled:!d.enabled}:d)), []);
  const updField = useCallback((id,field,value) => {
    setItems(p=>p.map(d=>{
      if(d.id!==id) return d;
      const u={...d,[field]:field==="qty"?(Number(value)||0):value};
      if(field==="priceId"&&PRICE_DB[value]){const pr=PRICE_DB[value];u.name=pr.name;u.spec=pr.spec;u.unit=pr.unit}
      return u;
    }));
  }, []);
  const addItem = useCallback(() => { setItems(p=>[...p,{id:nid(),cat:"4.",name:"",spec:"",unit:"m²",qty:1,priceId:"",enabled:true}]); }, []);
  /* ★ 삭제 후 번호 자동 재부여 (React key=id이므로 별도 처리 불필요, No열에 idx+1 표시) */
  const delUnchecked = useCallback(() => { if(!window.confirm("체크 해제 항목 삭제?"))return; setItems(p=>p.filter(d=>d.enabled)); }, []);

  const act = useMemo(() => items.filter(i=>i.enabled), [items]);
  const calcCat = useCallback(c => act.filter(i=>i.cat===c).reduce((s,i)=>{const p=PRICE_DB[i.priceId]||{total:0,labor:0,material:0,expense:0};return{g:s.g+Math.round(i.qty*p.total),i:s.i+Math.round(i.qty*p.labor),k:s.k+Math.round(i.qty*p.material),m:s.m+Math.round(i.qty*p.expense)}},{g:0,i:0,k:0,m:0}), [act]);
  const t1=calcCat("1."),t2=calcCat("2."),t3=calcCat("3."),t4=calcCat("4.");
  const sunG=t1.g+t2.g+t3.g+t4.g,sunI=t1.i+t2.i+t3.i+t4.i,sunK=t1.k+t2.k+t3.k+t4.k,sunM=t1.m+t2.m+t3.m+t4.m;
  const sT=sagub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gTot=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gF=Math.round(gTot*FEE_RATE),grand=sunG+sT+gTot+gF;

  /* ★ 다른이름으로 저장 */
  const saveAs = useCallback((asNew) => {
    const defaultName = `소규모주민숙원_${new Date().toISOString().slice(0,10)}`;
    const fileName = asNew ? (window.prompt("파일명을 입력하세요:", defaultName) || defaultName) : defaultName;
    const data = {v:"8.1", damage, items, query, at:new Date().toISOString()};
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download = `${fileName}.json`; a.click(); URL.revokeObjectURL(a.href);
  }, [damage, items, query]);

  const loadJ = useCallback(e => {
    const file=e.target.files?.[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{
      const d=JSON.parse(ev.target.result);
      const li=d.items||d.designItems||[];
      const ld=d.damage||d.dmg||INIT_DAMAGE();
      if(li.length>0){setItems(li);setDamage(ld);setAnalyzed(true);if(d.query||d.comment)setQuery(d.query||d.comment||"");const mx=Math.max(...li.map(x=>x.id),200);_nid=mx+1;alert(`불러오기 완료! (${li.length}개 공종)`)}
      else alert("유효한 데이터가 없습니다");
    }catch(err){alert("파일 오류: "+err.message)}};
    reader.readAsText(file); e.target.value="";
  }, []);

  const handleXL = useCallback(async t => {
    setXlLoad(t); try{if(t==="d")await genDesignXL(items,sagub,gwangub,FEE_RATE);else if(t==="q")await genQtyXL(items,gwangub,FEE_RATE);else await genUnitXL(items,sagub,gwangub)}finally{setXlLoad(null)}
  }, [items, sagub, gwangub]);

  return (
    <div className="min-h-screen bg-white" style={{fontFamily:"'Pretendard','Noto Sans KR',sans-serif"}}>
      <div className="bg-slate-800 text-white py-5 px-4"><div className="max-w-7xl mx-auto"><p className="text-blue-300 text-xs tracking-widest mb-1">소규모주민숙원사업</p><h1 className="text-2xl font-bold">종합검토보고서 <span className="text-sm font-normal text-slate-400">v8.1</span></h1></div></div>

      {/* ★ 상단 탭 크게 */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            {[["analysis","🔍 AI 분석"],["estimate","📊 설계내역서"]].map(([k,l])=>(
              <button key={k} onClick={()=>{setView(k);window.scrollTo(0,0)}}
                className={`px-5 py-2.5 text-sm rounded-lg font-bold transition ${view===k?"bg-blue-600 text-white shadow-md":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={handleNewWork} className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded hover:bg-slate-800 font-medium">🆕 새로운작업</button>
            <button onClick={()=>saveAs(false)} className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">💾 저장</button>
            <button onClick={()=>saveAs(true)} className="px-3 py-1.5 text-xs bg-green-100 text-green-800 border border-green-300 rounded hover:bg-green-200">💾 다른이름저장</button>
            <button onClick={()=>jsonRef.current?.click()} className="px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">📂 불러오기</button>
            <input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={loadJ}/>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {view==="analysis"&&<>
        <section>
          <Hd n="📷" t="현장 사진 + AI 분석"/>
          <div className="mt-3 flex gap-3 items-center flex-wrap">
            <button onClick={()=>fileRef.current?.click()} className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 font-medium">📷 사진 업로드</button>
            <button onClick={handleAnalyze} disabled={analyzing} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold shadow">{analyzing?"⏳ 분석 중...":"🤖 AI 분석 실행"}</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoUrl(URL.createObjectURL(f));setAnalyzed(false)}}}/>
          </div>
          {photoUrl&&<img src={photoUrl} alt="" className="mt-3 h-44 rounded-lg border cursor-pointer" onClick={()=>setPhotoModal(true)}/>}
          {photoModal&&photoUrl&&<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={()=>setPhotoModal(false)}><img src={photoUrl} alt="" className="max-w-full max-h-full rounded-lg"/></div>}
          {!analyzed&&photoUrl&&<p className="mt-2 text-sm text-orange-600 font-medium">📌 "AI 분석 실행" 버튼을 클릭하세요.</p>}
          {!analyzed&&!photoUrl&&<div className="mt-4 p-10 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center"><p className="text-slate-500 text-base">사진을 업로드하고 AI 분석을 실행하거나,<br/>저장된 파일을 불러오세요.</p></div>}
        </section>

        {analyzed&&<>
          <section><Hd n="1" t="종합 분석"/>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <IC t="현장 제원" c="blue"><IR l="위치" v="좌안 석축 호안"/><IR l="연장" v="약 20m"/><IR l="석축" v="약 2.5m"/><IR l="세굴" v="약 1.0m"/></IC>
            <IC t="피해 원인 / 복구 판정" c="red"><IR l="1차" v="급류 수충"/><IR l="2차" v="기초세굴→전면붕괴"/><IR l="판정" v="【개선복구】"/><IR l="설계" v="구조물 신설, 근입 D≥1.0m"/></IC>
          </div>
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3"><h4 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm"><div><span className="text-slate-500 text-xs">품목</span><p className="font-semibold">레미콘,철근,석재,잡석</p></div><div><span className="text-slate-500 text-xs">관급자재비</span><p className="font-bold text-red-600">{fmt(gTot)}원</p></div><div><span className="text-slate-500 text-xs">수수료율</span><p>1.5%</p></div><div><span className="text-slate-500 text-xs">관급수수료</span><p className="font-bold text-red-600">{fmt(gF)}원</p></div></div></div></section>

          {/* ★ 피해현황 = 개선복구 설계물량 개요 + 수량산출근거 */}
          <section>
            <Hd n="2" t="피해현황 (개선복구 설계물량)"/>
            <p className="text-xs text-slate-500 mt-1 mb-2">개선복구 개념의 공종별 수량산출근거 · 세부 내역은 [설계내역서] 탭</p>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-blue-700 text-white">
                  <th className="border border-blue-600 px-3 py-2 w-10">No</th>
                  <th className="border border-blue-600 px-3 py-2" style={{minWidth:150}}>공종 (개선복구)</th>
                  <th className="border border-blue-600 px-3 py-2">수량산출근거</th>
                  <th className="border border-blue-600 px-3 py-2 w-16">수량</th>
                  <th className="border border-blue-600 px-3 py-2 w-12">단위</th>
                </tr></thead>
                <tbody>{damage.map((d, i) => (
                  <tr key={d.id} className={i%2===0?"bg-white":"bg-slate-50"}>
                    <td className="border px-3 py-2 text-center font-medium">{i+1}</td>
                    <td className="border px-3 py-2 font-medium text-blue-800">{d.item}</td>
                    <td className="border px-3 py-2 text-slate-600 whitespace-pre-line text-xs">{d.basis}</td>
                    <td className="border px-3 py-2 text-center font-bold text-lg">{d.qty}</td>
                    <td className="border px-3 py-2 text-center">{d.unit}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          {/* ★ 수정/질문사항 + 실행 버튼 */}
          <section>
            <Hd n="📝" t="수정 및 질문사항"/>
            <p className="text-xs text-slate-500 mt-1 mb-2">공종 추가/수정 요청 또는 질문사항 입력 후 [실행] 클릭 → 피해현황에 반영</p>
            <div className="flex gap-2">
              <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 비탈면 보호공 추가 필요, 매설관 복구 공종 추가..." className="flex-1 border rounded-lg p-3 text-sm h-20 resize-none focus:ring-2 focus:ring-blue-300"/>
              <button onClick={handleQueryExec} className="px-5 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold self-end shadow">▶ 실행</button>
            </div>
          </section>

          <section><Hd n="3" t="구조물 제원"/>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <SpecC t="석축 (찰쌓기)" items={["형식: 찰쌓기 (자연석)",`높이 H=${STRUCT.wallH}m`,`두께 T=${STRUCT.wallT*100}cm`,`연장 L=${STRUCT.wallL}m`,`기초 근입 D=${STRUCT.foundD}m`]} c="blue"/>
            <SpecC t="기초 콘크리트" items={[`규격: ${STRUCT.conSpec} (철근)`,`폭 B=${STRUCT.foundW}m`,`깊이 D=${STRUCT.foundD}m`,`연장 L=${STRUCT.wallL}m`,`철근: ${STRUCT.steelSpec}`]} c="red"/>
            <SpecC t="기초 지정 (잡석)" items={["재료: 잡석 (기계다짐)",`폭 B=${STRUCT.foundW}m`,`두께 T=${STRUCT.japsukT}m`,`연장 L=${STRUCT.wallL}m`,"부직포: 하부 + 석축 배면"]} c="amber"/>
          </div></section>

          <section><Hd n="4" t="설계 표준단면도"/>
          <p className="text-xs text-slate-500 mt-1">하천설계기준(2019) · 석축 구조물 표준단면 · 구조물 제원 기반 축척 생성</p>
          <div className="mt-3 flex justify-center"><XSec s={STRUCT}/></div></section>

          {/* ★ 설계내역 작성 버튼 (피해현황 하단) */}
          <div className="text-center pt-4">
            <button onClick={handleStartDesign} className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold text-base shadow-lg">
              📊 설계내역서 작성 →
            </button>
          </div>
        </>}
      </>}

      {view==="estimate"&&<>
        {items.length===0?(
          <div className="p-12 bg-slate-50 border-2 border-dashed rounded-xl text-center"><p className="text-slate-500 text-lg mb-4">설계물량 없음</p><button onClick={()=>setView("analysis")} className="px-4 py-2 bg-blue-600 text-white rounded-lg">← AI 분석으로</button></div>
        ):(<>
          <section>
            <div className="flex items-center justify-between flex-wrap gap-2"><Hd n="📋" t="설계물량 편집"/>
            <div className="flex gap-1 flex-wrap">
              <button onClick={addItem} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium">➕ 공종추가</button>
              <button onClick={delUnchecked} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium">🗑️ 선택삭제</button>
            </div></div>
            <p className="text-xs text-blue-600 mt-1 mb-2">No는 삭제 시 자동 재부여 · 단가ID 입력→자동채움 · 수량변경→즉시재계산</p>
            <EditTable items={items} onToggleAll={toggleAllI} onToggle={toggleI} onUpdate={updField} allChk={allI} someChk={someI}/>
            <div className="mt-2 text-right text-sm font-bold">직접공사비: <span className="text-blue-700">{fmt(sunG)}원</span></div>
          </section>

          <section><Hd n="2" t="설계 내역서"/><p className="text-xs text-slate-500 mt-1 mb-3">2025년 충청북도 일위대가</p>
          <div className="overflow-x-auto border rounded-lg"><table className="w-full text-xs border-collapse" style={{minWidth:1100}}>
            <thead><tr className="bg-blue-700 text-white"><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-10">공종</th><th rowSpan={2} className="border border-blue-600 px-2 py-1.5 w-32">품 명</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-36">규 격</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-12">수량</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-8">단위</th><th colSpan={2} className="border border-blue-600 text-center">합 계</th><th colSpan={2} className="border border-blue-600 text-center">노 무 비</th><th colSpan={2} className="border border-blue-600 text-center">재 료 비</th><th colSpan={2} className="border border-blue-600 text-center">경 비</th></tr>
            <tr className="bg-blue-600 text-white text-center">{["단가","금액","단가","금액","단가","금액","단가","금액"].map((t,i)=><th key={i} className="border border-blue-500 px-1 py-1">{t}</th>)}</tr></thead>
            <tbody>
              <TR13 label="순 공 사 비" a={[sunG,sunI,sunK,sunM]} bg="bg-slate-200" tc="text-slate-800"/>
              {[{c:"1.",n:"토공",t:t1},{c:"2.",n:"구조물공",t:t2},{c:"3.",n:"포장공",t:t3},{c:"4.",n:"부대공",t:t4}].map(({c,n,t})=>{const ci=act.filter(i=>i.cat===c);if(!ci.length)return null;return<Fragment key={c}><CR13 code={c} name={n} a={[t.g,t.i,t.k,t.m]}/>{ci.map((item,idx)=><IR13 key={item.id} item={item} p={PRICE_DB[item.priceId]||{total:0,labor:0,material:0,expense:0}} idx={idx}/>)}</Fragment>})}
              <CR13 code="5." name="사급자재대" a={[sT,0,0,0]} fill="bg-orange-50"/>{sagub.map((item,idx)=><tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1"></td><td className="border px-2 py-1">{item.name}</td><td className="border px-1 py-1 text-slate-500">{item.spec}</td><td className="border px-1 py-1 text-center">{item.qty}</td><td className="border px-1 py-1 text-center">{item.unit}</td><td className="border px-1 py-1 text-right">{fmt(item.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td><td colSpan={6} className="border"></td></tr>)}
              <CR13 code="6." name="관급자재대" a={[gTot,0,0,0]} fill="bg-red-50"/>{gwangub.map((item,idx)=><tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1 text-center text-xs">{item.sub}</td><td className="border px-2 py-1">{item.name}</td><td className="border px-1 py-1 text-slate-500">{item.spec}</td><td className="border px-1 py-1 text-center">{item.qty}</td><td className="border px-1 py-1 text-center">{item.unit}</td><td className="border px-1 py-1 text-right">{fmt(item.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td><td colSpan={6} className="border"></td></tr>)}
              <tr className="bg-red-50 font-bold"><td colSpan={5} className="border px-3 py-1.5 text-center text-red-700">관급수수료 (1.5%)</td><td className="border"></td><td className="border px-1 py-1.5 text-right text-red-700">{fmt(gF)}</td><td colSpan={6} className="border"></td></tr>
              <TR13 label="총 공 사 비" a={[grand,0,0,0]} bg="bg-slate-800" tc="text-white"/>
            </tbody></table></div></section>

          <section><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["직접공사비",sunG,"blue"],["사급자재비",sT,"orange"],["관급자재비",gTot,"red"],["관급수수료",gF,"pink"],["총공사비",grand,"slate"]].map(([l,v,c],i)=><SCard key={i} l={l} v={v} c={c} bold={i===4}/>)}</div></section>

          <section><Hd n="📊" t="엑셀 다운로드"/><div className="mt-3 flex gap-3 flex-wrap">
            {[["d","📊 설계내역서","bg-green-600 hover:bg-green-700"],["q","📋 수량산출서","bg-blue-600 hover:bg-blue-700"],["u","📑 일위대가","bg-purple-600 hover:bg-purple-700"]].map(([k,l,cls])=>
              <button key={k} disabled={xlLoad===k} onClick={()=>handleXL(k)} className={`px-4 py-2 ${cls} text-white text-sm rounded-lg shadow disabled:opacity-50 font-medium`}>{xlLoad===k?"생성중...":l}</button>
            )}
          </div><p className="text-xs text-green-700 mt-2">✅ 2단헤더+색상+수식 포함</p></section>
        </>)}
      </>}

      <footer className="border-t pt-4 pb-6 text-xs text-slate-400"><p>2025년 충청북도 일위대가 · 상세 수량산출 근거는 엑셀 참조</p></footer>
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
function IR13({item,p,idx}){const q=item.qty;return<tr className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1"></td><td className="border px-2 py-1">{item.name}</td><td className="border px-1 py-1 text-slate-500 text-xs">{item.spec}</td><td className="border px-1 py-1 text-center">{q}</td><td className="border px-1 py-1 text-center">{item.unit}</td><td className="border px-1 py-1 text-right">{fmt(p.total)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.total))}</td><td className="border px-1 py-1 text-right">{fmt(p.labor)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.labor))}</td><td className="border px-1 py-1 text-right">{fmt(p.material)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.material))}</td><td className="border px-1 py-1 text-right">{fmt(p.expense)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(q*p.expense))}</td></tr>}
function SCard({l,v,c,bold}){const cls={blue:"bg-blue-50 border-blue-200 text-blue-700",orange:"bg-orange-50 border-orange-200 text-orange-600",red:"bg-red-50 border-red-200 text-red-600",pink:"bg-pink-50 border-pink-200 text-pink-600",slate:"bg-slate-800 border-slate-700 text-white"}[c];return<div className={`rounded-lg border p-3 ${cls}`}><p className="text-xs opacity-75">{l}</p><p className={`${bold?"text-lg":"text-sm"} font-bold mt-0.5`}>{fmt(v)}원</p></div>}

/* ★ 설계 표준단면도 — 설계기준 명시, 구체적 치수 */
function XSec({s}){
  const sc=80,wH=s.wallH*sc,wT=s.wallT*sc*3,fW=s.foundW*sc,fD=s.foundD*sc,jT=s.japsukT*sc,ox=140,gy=265,fT=gy-fD,wTop=fT-wH;
  return(
    <svg viewBox="0 0 700 420" className="w-full max-w-3xl border rounded-lg bg-white p-3">
      {/* 타이틀 */}
      <text x="350" y="18" fontSize="12" fill="#1e293b" textAnchor="middle" fontWeight="bold">하천 호안 석축 표준단면도</text>
      <text x="350" y="32" fontSize="9" fill="#64748b" textAnchor="middle">설계기준: 하천설계기준(2019), 석축 구조물 설계 · 개선복구</text>

      {/* 지반선 */}
      <line x1="30" y1={gy} x2="640" y2={gy} stroke="#78716c" strokeWidth="2" strokeDasharray="8,4"/>
      <text x="645" y={gy+4} fontSize="10" fill="#78716c">G.L</text>

      {/* 잡석기초 */}
      <rect x={ox} y={gy} width={fW} height={jT} fill="#d6d3d1" stroke="#78716c" strokeWidth="1"/>
      <text x={ox+fW/2} y={gy+jT/2+4} fontSize="9" fill="#44403c" textAnchor="middle">잡석다짐 T={s.japsukT}m</text>
      {/* 잡석 해칭 */}
      {Array.from({length:8}).map((_,i)=><circle key={`j${i}`} cx={ox+15+i*25} cy={gy+jT/2} r="4" fill="none" stroke="#a8a29e" strokeWidth="0.5"/>)}

      {/* 부직포 (잡석 하부) */}
      <rect x={ox-5} y={gy+jT} width={fW+10} height={5} fill="#93c5fd" stroke="#3b82f6" strokeWidth="0.8"/>
      <text x={ox+fW+15} y={gy+jT+5} fontSize="8" fill="#2563eb" fontWeight="bold">부직포 (토목섬유)</text>

      {/* 기초 콘크리트 */}
      <rect x={ox+10} y={fT} width={fW-20} height={fD} fill="#d1d5db" stroke="#374151" strokeWidth="2"/>
      {/* 해칭 (콘크리트) */}
      {Array.from({length:12}).map((_,i)=><line key={`ch${i}`} x1={ox+15+i*15} y1={fT+2} x2={ox+5+i*15} y2={fT+fD-2} stroke="#9ca3af" strokeWidth="0.3"/>)}
      <text x={ox+fW/2} y={fT+fD/2-8} fontSize="11" fill="#1f2937" textAnchor="middle" fontWeight="bold">R.C 기초</text>
      <text x={ox+fW/2} y={fT+fD/2+8} fontSize="8" fill="#4b5563" textAnchor="middle">{s.conSpec} (σck=21MPa)</text>
      <text x={ox+fW/2} y={fT+fD/2+20} fontSize="8" fill="#4b5563" textAnchor="middle">W={s.foundW}m × D={s.foundD}m</text>

      {/* 철근 표시 */}
      {Array.from({length:6}).map((_,i)=><circle key={`r${i}`} cx={ox+20+i*30} cy={fT+fD-12} r="3" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8"/>)}
      {Array.from({length:6}).map((_,i)=><circle key={`rt${i}`} cx={ox+20+i*30} cy={fT+12} r="3" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8"/>)}
      <text x={ox+fW+15} y={fT+fD-8} fontSize="8" fill="#dc2626" fontWeight="bold">● {s.steelSpec}</text>

      {/* 석축 */}
      <rect x={ox+10} y={wTop} width={wT} height={wH} fill="#fbbf24" stroke="#92400e" strokeWidth="2" rx="2"/>
      {/* 석재 질감 */}
      {Array.from({length:Math.floor(wH/18)}).map((_,i)=><Fragment key={`st${i}`}>
        <line x1={ox+12} y1={wTop+8+i*18} x2={ox+8+wT} y2={wTop+8+i*18} stroke="#92400e" strokeWidth="0.6" opacity="0.5"/>
        <line x1={ox+12+((i%2)*wT/3)} y1={wTop+i*18} x2={ox+12+((i%2)*wT/3)} y2={wTop+8+i*18} stroke="#92400e" strokeWidth="0.4" opacity="0.3"/>
      </Fragment>)}
      <text x={ox+10+wT/2} y={wTop-10} fontSize="10" fill="#92400e" textAnchor="middle" fontWeight="bold">찰쌓기 석축</text>
      <text x={ox+10+wT/2} y={wTop-0} fontSize="8" fill="#b45309" textAnchor="middle">T={Math.round(s.wallT*100)}cm, 자연석</text>

      {/* 뒤채움 */}
      <rect x={ox+10+wT} y={wTop} width={70} height={wH} fill="#fef3c7" stroke="#d97706" strokeWidth="1" strokeDasharray="4,2"/>
      {Array.from({length:6}).map((_,i)=><text key={`bf${i}`} x={ox+10+wT+35} y={wTop+20+i*30} fontSize="7" fill="#b45309" textAnchor="middle">·····</text>)}
      <text x={ox+10+wT+35} y={wTop+wH/2-5} fontSize="9" fill="#92400e" textAnchor="middle" fontWeight="bold">뒤채움</text>
      <text x={ox+10+wT+35} y={wTop+wH/2+8} fontSize="7" fill="#92400e" textAnchor="middle">(양질사토)</text>

      {/* 부직포 (석축 배면) */}
      <line x1={ox+10+wT} y1={wTop} x2={ox+10+wT} y2={fT} stroke="#3b82f6" strokeWidth="3" strokeDasharray="6,3"/>
      <text x={ox+10+wT+5} y={wTop-5} fontSize="8" fill="#2563eb" fontWeight="bold">부직포↓</text>

      {/* 비닐 */}
      <line x1={ox+10} y1={fT} x2={ox+fW-10} y2={fT} stroke="#16a34a" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x={ox+fW/2} y={fT-4} fontSize="7" fill="#16a34a" textAnchor="middle">PE비닐</text>

      {/* 도로 */}
      <rect x={ox+10+wT+70} y={wTop-12} width={200} height={12} fill="#374151" stroke="#1f2937" strokeWidth="1.5" rx="1"/>
      <rect x={ox+10+wT+70} y={wTop} width={200} height={8} fill="#78716c" stroke="#57534e" strokeWidth="0.5"/>
      <text x={ox+10+wT+170} y={wTop-18} fontSize="12" fill="#1f2937" textAnchor="middle" fontWeight="bold">도 로</text>
      <text x={ox+10+wT+170} y={wTop+6} fontSize="7" fill="#d6d3d1" textAnchor="middle">보조기층</text>

      {/* 하천 */}
      <text x="65" y={fT+20} fontSize="13" fill="#2563eb" textAnchor="middle" fontWeight="bold">하 천</text>
      <path d={`M45,${fT+35} Q65,${fT+42} 45,${fT+52} Q65,${fT+59} 45,${fT+69} Q65,${fT+76} 45,${fT+86}`} fill="none" stroke="#3b82f6" strokeWidth="2"/>
      <text x="65" y={fT+100} fontSize="8" fill="#3b82f6" textAnchor="middle">H.W.L ▼</text>

      {/* 치수선 — 석축 높이 */}
      <line x1={ox-8} y1={wTop} x2={ox-8} y2={fT} stroke="#dc2626" strokeWidth="1"/>
      <polygon points={`${ox-8},${wTop} ${ox-11},${wTop+6} ${ox-5},${wTop+6}`} fill="#dc2626"/>
      <polygon points={`${ox-8},${fT} ${ox-11},${fT-6} ${ox-5},${fT-6}`} fill="#dc2626"/>
      <text x={ox-28} y={(wTop+fT)/2+4} fontSize="10" fill="#dc2626" textAnchor="middle" fontWeight="bold" transform={`rotate(-90,${ox-28},${(wTop+fT)/2})`}>H={s.wallH}m</text>

      {/* 치수선 — 기초 깊이 */}
      <line x1={ox+fW+8} y1={fT} x2={ox+fW+8} y2={gy} stroke="#dc2626" strokeWidth="1"/>
      <polygon points={`${ox+fW+8},${fT} ${ox+fW+5},${fT+6} ${ox+fW+11},${fT+6}`} fill="#dc2626"/>
      <polygon points={`${ox+fW+8},${gy} ${ox+fW+5},${gy-6} ${ox+fW+11},${gy-6}`} fill="#dc2626"/>
      <text x={ox+fW+25} y={(fT+gy)/2+4} fontSize="10" fill="#dc2626" fontWeight="bold">D={s.foundD}m</text>

      {/* 치수선 — 기초폭 */}
      <line x1={ox+10} y1={fT-15} x2={ox+fW-10} y2={fT-15} stroke="#059669" strokeWidth="1"/>
      <polygon points={`${ox+10},${fT-15} ${ox+16},${fT-18} ${ox+16},${fT-12}`} fill="#059669"/>
      <polygon points={`${ox+fW-10},${fT-15} ${ox+fW-16},${fT-18} ${ox+fW-16},${fT-12}`} fill="#059669"/>
      <text x={ox+fW/2} y={fT-20} fontSize="10" fill="#059669" textAnchor="middle" fontWeight="bold">B={s.foundW}m</text>

      {/* 근입 표시 */}
      <line x1={ox+fW/2} y1={gy} x2={ox+fW/2} y2={gy+jT+10} stroke="#7c3aed" strokeWidth="1" strokeDasharray="3,2"/>
      <text x={ox+fW/2} y={gy+jT+22} fontSize="9" fill="#7c3aed" textAnchor="middle" fontWeight="bold">근입 D≥{s.foundD}m</text>

      {/* 범례 */}
      <rect x="490" y="340" width="190" height="75" fill="white" stroke="#d1d5db" rx="4"/>
      <text x="500" y="356" fontSize="9" fill="#374151" fontWeight="bold">범 례</text>
      <rect x="500" y="360" width="14" height="9" fill="#fbbf24" stroke="#92400e" strokeWidth="0.8"/><text x="520" y="369" fontSize="8" fill="#44403c">석축 (찰쌓기,자연석)</text>
      <rect x="500" y="374" width="14" height="9" fill="#d1d5db" stroke="#374151" strokeWidth="0.8"/><text x="520" y="383" fontSize="8" fill="#44403c">R.C 기초 ({s.conSpec})</text>
      <rect x="500" y="388" width="14" height="9" fill="#d6d3d1" stroke="#78716c" strokeWidth="0.8"/><text x="520" y="397" fontSize="8" fill="#44403c">잡석다짐 (T={s.japsukT}m)</text>
      <line x1="500" y1="406" x2="514" y2="406" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="4,2"/><text x="520" y="410" fontSize="8" fill="#44403c">부직포 (토목섬유)</text>

      {/* 설계기준 */}
      <text x="30" y="395" fontSize="7" fill="#94a3b8">적용기준: 하천설계기준(2019)</text>
      <text x="30" y="405" fontSize="7" fill="#94a3b8">석축: KDS 51 40 15 석축 및 돌쌓기</text>
      <text x="30" y="415" fontSize="7" fill="#94a3b8">기초: 근입깊이 D≥1.0m (세굴방지)</text>
    </svg>
  );
}
