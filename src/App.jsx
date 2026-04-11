import { useState, useRef, useCallback, useMemo, Fragment } from "react";

/* ============================================================
   소규모주민숙원사업 종합검토보고서 v7.3
   ① 새 공종 추가: 품명/규격/단가ID/단위 모두 입력 가능
   ② 엑셀 3종 브라우저 직접 생성 (SheetJS CDN)
   ③ 체크박스 해제 → 합계 재계산 + 전체선택/해제
   ④ 단위 드롭다운 + 선택삭제
   ⑤ 피해현황 ↔ 내역서 물량 연동
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const UNITS = ["m²","m³","m","hr","ton","일","식","본","개소","km"];

const PRICE_DB = {
  "#.19":{name:"표토제거(답)",spec:"불도저19ton,T=20CM",unit:"m²",labor:225,material:144,expense:135,total:504},
  "#.22":{name:"표토제거(답외)",spec:"T=20CM,굴삭기0.7㎥",unit:"m²",labor:191,material:59,expense:80,total:330},
  "#.28":{name:"흙깍기",spec:"보통토사,소규모",unit:"m³",labor:1472,material:774,expense:747,total:2993},
  "#.36":{name:"토사깍기",spec:"굴삭기0.7㎥",unit:"m³",labor:887,material:277,expense:373,total:1537},
  "#.57":{name:"구조물터파기",spec:"육상토사,기계100%",unit:"m³",labor:1035,material:323,expense:435,total:1793},
  "#.63":{name:"흙쌓기(비다짐)",spec:"",unit:"m³",labor:351,material:374,expense:285,total:1010},
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
  "#.331":{name:"아스팔트덧씌우기",spec:"소규모포장",unit:"m²",labor:2245,material:328,expense:489,total:3062},
  "#.481":{name:"교통통제및안전처리",spec:"500M미만",unit:"일",labor:339608,material:0,expense:0,total:339608},
};

let _nid = 100;
const nid = () => ++_nid;

const makeDefaultItems = () => [
  {id:1,cat:"1.",catName:"토공",name:"표토제거",spec:"T=20CM,굴삭기0.7㎥(답외)",unit:"m²",qty:35,priceId:"#.22",enabled:true},
  {id:2,cat:"1.",catName:"토공",name:"흙깍기",spec:"보통토사,소규모",unit:"m³",qty:40,priceId:"#.28",enabled:true},
  {id:3,cat:"1.",catName:"토공",name:"구조물터파기",spec:"육상토사,기계100%",unit:"m³",qty:51,priceId:"#.57",enabled:true},
  {id:4,cat:"2.",catName:"구조물공",name:"기초지정(잡석)",spec:"잡석",unit:"m³",qty:26,priceId:"#.77",enabled:true},
  {id:5,cat:"2.",catName:"구조물공",name:"레미콘타설(펌프차)",spec:"철근(S:8-12cm),TYPE-Ⅱ",unit:"m³",qty:51,priceId:"#.193",enabled:true},
  {id:6,cat:"2.",catName:"구조물공",name:"석축쌓기",spec:"찰쌓기,T=35cm이하",unit:"m²",qty:51,priceId:"#.155",enabled:true},
  {id:7,cat:"2.",catName:"구조물공",name:"합판거푸집",spec:"(4회) 보통",unit:"m²",qty:41,priceId:"#.204",enabled:true},
  {id:8,cat:"2.",catName:"구조물공",name:"철근가공 및 조립",spec:"TYPE-1-1",unit:"ton",qty:2.6,priceId:"#.216",enabled:true},
  {id:9,cat:"2.",catName:"구조물공",name:"콘크리트양생",spec:"습윤양생",unit:"m²",qty:92,priceId:"#.276",enabled:true},
  {id:10,cat:"4.",catName:"부대공",name:"부직포설치",spec:"",unit:"m²",qty:72,priceId:"#.280",enabled:true},
  {id:11,cat:"4.",catName:"부대공",name:"비닐깔기",spec:"",unit:"m²",qty:51,priceId:"#.281",enabled:true},
  {id:12,cat:"1.",catName:"토공",name:"뒤채움 및 다짐",spec:"소형장비",unit:"m³",qty:35,priceId:"#.68",enabled:true},
  {id:13,cat:"1.",catName:"토공",name:"되메우기 및 다짐",spec:"소형장비",unit:"m³",qty:20,priceId:"#.70",enabled:true},
  {id:14,cat:"1.",catName:"토공",name:"절토사면 녹화",spec:"T=10㎝",unit:"m²",qty:45,priceId:"#.87",enabled:true},
  {id:15,cat:"1.",catName:"토공",name:"사토운반",spec:"토사,L=5.0KM",unit:"m³",qty:308,priceId:"#.127",enabled:true},
  {id:16,cat:"4.",catName:"부대공",name:"교통통제및안전처리",spec:"500M미만",unit:"일",qty:5,priceId:"#.481",enabled:true},
  {id:17,cat:"4.",catName:"부대공",name:"물푸기",spec:"",unit:"hr",qty:24,priceId:"#.282",enabled:true},
  {id:18,cat:"3.",catName:"포장공",name:"절삭후아스팔트덧씌우기",spec:"B-Type(1회절삭,1회포장)",unit:"m²",qty:40,priceId:"#.326",enabled:true},
];
const makeSagub = () => [{id:101,name:"합판거푸집(자재)",spec:"합판,유로폼",unit:"m²",qty:41,unitPrice:12000},{id:102,name:"부직포(자재)",spec:"부직포 원단",unit:"m²",qty:72,unitPrice:1500}];
const makeGwangub = () => [{id:201,sub:"6.1",name:"레미콘",spec:"25-210-12",unit:"m³",qty:51,unitPrice:75000},{id:202,sub:"6.2",name:"이형철근(SD400)",spec:"HD13",unit:"ton",qty:2.6,unitPrice:950000},{id:203,sub:"6.3",name:"석재",spec:"자연석,석축용",unit:"m²",qty:51,unitPrice:45000},{id:204,sub:"6.3",name:"잡석",spec:"25-40mm",unit:"m³",qty:24,unitPrice:22000}];
const FEE_RATE = 0.015;
const makeDmg = () => [{id:1,item:"석축 붕괴",basis:"붕괴 연장 약 20m × 높이 약 2.5m",qty:50,unit:"㎡",enabled:true},{id:2,item:"도로 포장 파손",basis:"파손 연장 약 20m × 폭 약 2.0m",qty:40,unit:"㎡",enabled:true},{id:3,item:"기초 세굴",basis:"세굴 연장 약 20m × 폭 2.5m × 깊이 1.0m",qty:50,unit:"㎥",enabled:true},{id:4,item:"토사 퇴적/유실",basis:"하천 내 토석 퇴적 및 사면 유실",qty:80,unit:"㎥",enabled:true},{id:5,item:"매설관 노출",basis:"노출 연장 약 15m",qty:15,unit:"m",enabled:true},{id:6,item:"사면 붕괴",basis:"도로 상부 사면 붕괴 면적",qty:30,unit:"㎡",enabled:true}];
const DMG_MAP = {1:[{did:6,f:1.02}],2:[{did:18,f:1.0}],3:[{did:3,f:1.02},{did:5,f:1.02}],4:[{did:15,f:3.85}],6:[{did:14,f:1.5}]};

/* SheetJS */
const loadXLSX = () => new Promise((res,rej) => { if(window.XLSX){res(window.XLSX);return;} const s=document.createElement("script"); s.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"; s.onload=()=>res(window.XLSX); s.onerror=()=>rej(new Error("SheetJS CDN 로드 실패")); document.head.appendChild(s); });

async function genDesignXL(items,sagub,gwangub,fr){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),cats=["1.","2.","3.","4."],cn={"1.":"토공","2.":"구조물공","3.":"포장공","4.":"부대공"},rows=[["설 계 내 역 서 (소규모주민숙원사업)"],["2025년 충청북도 일위대가"],["공종","품 명","규 격","수량","단위","합계단가","합계금액","노무비단가","노무비금액","재료비단가","재료비금액","경비단가","경비금액"]];let ct={};cats.forEach(c=>{ct[c]={g:0,i:0,k:0,m:0}});cats.forEach(c=>{const ci=act.filter(i=>i.cat===c);if(!ci.length)return;rows.push([c,cn[c],"","","","","","","","","","",""]);ci.forEach(item=>{const p=PRICE_DB[item.priceId]||{total:0,labor:0,material:0,expense:0},q=item.qty,gA=Math.round(q*p.total),iA=Math.round(q*p.labor),kA=Math.round(q*p.material),mA=Math.round(q*p.expense);ct[c].g+=gA;ct[c].i+=iA;ct[c].k+=kA;ct[c].m+=mA;rows.push(["",item.name,item.spec||"",q,item.unit,p.total,gA,p.labor,iA,p.material,kA,p.expense,mA])})});const sG=cats.reduce((s,c)=>s+(ct[c]?.g||0),0),sI=cats.reduce((s,c)=>s+(ct[c]?.i||0),0),sK=cats.reduce((s,c)=>s+(ct[c]?.k||0),0),sM=cats.reduce((s,c)=>s+(ct[c]?.m||0),0);rows.push(["","순 공 사 비","","","","",sG,"",sI,"",sK,"",sM]);const sT=sagub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);rows.push(["5.","사급자재대","","","","",sT,"","","","","",""]);sagub.forEach(i=>rows.push(["",i.name,i.spec,i.qty,i.unit,i.unitPrice,Math.round(i.qty*i.unitPrice),"","","","","",""]));const gT=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);rows.push(["6.","관급자재대","","","","",gT,"","","","","",""]);gwangub.forEach(i=>rows.push(["",i.name,i.spec,i.qty,i.unit,i.unitPrice,Math.round(i.qty*i.unitPrice),"","","","","",""]));const fee=Math.round(gT*fr);rows.push(["","관급수수료 (1.5%)","","","","",fee,"","","","","",""]);rows.push(["","총 공 사 비","","","","",sG+sT+gT+fee,"","","","","",""]);const ws=X.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:8},{wch:24},{wch:28},{wch:10},{wch:6},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14}];X.utils.book_append_sheet(wb,ws,"내역서");const r2=[["사급·관급자재 산출근거"],["No","품명","규격","수량","단위","자재단가","자재금액","산출근거","구분"],["[ 사급자재 ]"]];sagub.forEach((i,n)=>r2.push([n+1,i.name,i.spec,i.qty,i.unit,i.unitPrice,Math.round(i.qty*i.unitPrice),`${i.qty}${i.unit}×${fmt(i.unitPrice)}원`,"사급"]));r2.push(["","사급 소계","","","","",sT,"",""]);r2.push([]);r2.push(["[ 관급자재 ]"]);gwangub.forEach((i,n)=>r2.push([n+1,i.name,i.spec,i.qty,i.unit,i.unitPrice,Math.round(i.qty*i.unitPrice),`${i.qty}${i.unit}×${fmt(i.unitPrice)}원`,"관급"]));r2.push(["","관급 소계","","","","",gT,"",""]);r2.push(["","관급수수료","","","","",fee,`${fmt(gT)}×1.5%`,""]);r2.push([]);r2.push(["","합계","","","","",sT+gT+fee,"",""]);const ws2=X.utils.aoa_to_sheet(r2);X.utils.book_append_sheet(wb,ws2,"사급관급");X.writeFile(wb,`설계내역서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("엑셀 오류: "+e.message)}}

async function genQtyXL(items,gwangub,fr){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),rows=[["수 량 산 출 서"],["번호","공종명","규격","단위","자재구분","산출근거","수량","비고"]];act.forEach((item,i)=>{let mt="해당없음";if(["기초지정","레미콘","석축","철근"].some(n=>item.name.includes(n)))mt="관급";if(["합판거푸집","부직포"].some(n=>item.name.includes(n)))mt="사급";rows.push([i+1,item.name,item.spec||"",item.unit,mt,`설계수량 ${item.qty}${item.unit}`,item.qty,item.priceId])});const gT=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0),fee=Math.round(gT*fr);rows.push([act.length+1,"관급수수료","×1.5%","식","관급",`${fmt(gT)}×1.5%=${fmt(fee)}`,1,""]);const ws=X.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:7},{wch:22},{wch:28},{wch:7},{wch:12},{wch:50},{wch:10},{wch:15}];X.utils.book_append_sheet(wb,ws,"수량산출서");X.writeFile(wb,`수량산출서_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("엑셀 오류: "+e.message)}}

async function genUnitXL(items){try{const X=await loadXLSX(),wb=X.utils.book_new(),pids=[...new Set(items.filter(i=>i.enabled).map(i=>i.priceId))],rows=[["일위대가 (2025 충북)"],["단가ID","공종명","규격","합계","노무비","재료비","경비","자재구분","비고"]];pids.forEach(pid=>{const p=PRICE_DB[pid];if(!p)return;let mt="해당없음";if(["기초지정","레미콘","석축","철근"].some(n=>p.name.includes(n)))mt="관급(별도)";if(["합판거푸집","부직포"].some(n=>p.name.includes(n)))mt="사급(별도)";rows.push([pid,p.name,p.spec,p.total,p.labor,p.material,p.expense,mt,""])});const ws=X.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:10},{wch:25},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:20}];X.utils.book_append_sheet(wb,ws,"일위대가");X.writeFile(wb,`일위대가_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("엑셀 오류: "+e.message)}}

/* ============================================================ MAIN */
export default function App(){
  const[view,setView]=useState("analysis");
  const[items,setItems]=useState(makeDefaultItems());
  const[dmg,setDmg]=useState(makeDmg());
  const[sagub]=useState(makeSagub());
  const[gwangub]=useState(makeGwangub());
  const[editMode,setEditMode]=useState(false);
  const[photoUrl,setPhotoUrl]=useState(null);
  const[photoModal,setPhotoModal]=useState(false);
  const[comment,setComment]=useState("");
  const[xlLoad,setXlLoad]=useState(null);
  const fileRef=useRef(null);
  const jsonRef=useRef(null);

  const syncDmg=useCallback(nd=>{setItems(prev=>{const nx=prev.map(d=>({...d}));nd.forEach(dm=>{if(!dm.enabled)return;const maps=DMG_MAP[dm.id];if(!maps)return;maps.forEach(m=>{const idx=nx.findIndex(d=>d.id===m.did);if(idx>=0)nx[idx].qty=Math.ceil(dm.qty*m.f)})});return nx})},[]);
  const updDmgQty=(id,v)=>{const u=dmg.map(d=>d.id===id?{...d,qty:Number(v)||0}:d);setDmg(u);syncDmg(u)};

  const allD=dmg.every(d=>d.enabled),someD=dmg.some(d=>d.enabled);
  const toggleAllD=()=>setDmg(p=>p.map(d=>({...d,enabled:!allD})));
  const toggleD=id=>setDmg(p=>p.map(d=>d.id===id?{...d,enabled:!d.enabled}:d));

  const allI=items.every(d=>d.enabled),someI=items.some(d=>d.enabled);
  const toggleAllI=()=>setItems(p=>p.map(d=>({...d,enabled:!allI})));
  const toggleI=id=>setItems(p=>p.map(d=>d.id===id?{...d,enabled:!d.enabled}:d));

  const updField=(id,f,v)=>setItems(p=>p.map(d=>d.id===id?{...d,[f]:f==="qty"?(Number(v)||0):v}:d));
  const addItem=()=>setItems(p=>[...p,{id:nid(),cat:"4.",catName:"부대공",name:"",spec:"",unit:"m²",qty:1,priceId:"",enabled:true}]);
  const delUnchecked=()=>{if(!window.confirm("체크 해제 항목을 삭제합니까?"))return;setItems(p=>p.filter(d=>d.enabled))};

  const act=useMemo(()=>items.filter(i=>i.enabled),[items]);
  const calcCat=useCallback(c=>act.filter(i=>i.cat===c).reduce((s,i)=>{const p=PRICE_DB[i.priceId]||{total:0,labor:0,material:0,expense:0};return{g:s.g+Math.round(i.qty*p.total),i:s.i+Math.round(i.qty*p.labor),k:s.k+Math.round(i.qty*p.material),m:s.m+Math.round(i.qty*p.expense)}},{g:0,i:0,k:0,m:0}),[act]);

  const t1=calcCat("1."),t2=calcCat("2."),t3=calcCat("3."),t4=calcCat("4.");
  const sunG=t1.g+t2.g+t3.g+t4.g,sunI=t1.i+t2.i+t3.i+t4.i,sunK=t1.k+t2.k+t3.k+t4.k,sunM=t1.m+t2.m+t3.m+t4.m;
  const sT=sagub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gT=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gF=Math.round(gT*FEE_RATE),grand=sunG+sT+gT+gF;

  const saveJ=()=>{const b=new Blob([JSON.stringify({v:"7.3",items,dmg,sagub,gwangub,comment,at:new Date().toISOString()},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`소규모주민숙원_${new Date().toISOString().slice(0,10)}.json`;a.click()};
  const loadJ=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.items)setItems(d.items);if(d.dmg)setDmg(d.dmg);if(d.comment)setComment(d.comment);alert("완료!")}catch{alert("형식 오류")}};r.readAsText(f);e.target.value=""};
  const handleXL=async t=>{setXlLoad(t);try{if(t==="d")await genDesignXL(items,sagub,gwangub,FEE_RATE);else if(t==="q")await genQtyXL(items,gwangub,FEE_RATE);else await genUnitXL(items)}finally{setXlLoad(null)}};

  return(
    <div className="min-h-screen bg-white" style={{fontFamily:"'Pretendard','Noto Sans KR',sans-serif"}}>
      <div className="bg-slate-800 text-white py-5 px-4"><div className="max-w-7xl mx-auto"><p className="text-blue-300 text-xs tracking-widest mb-1">소규모주민숙원사업</p><h1 className="text-2xl font-bold">종합검토보고서 <span className="text-sm font-normal text-slate-400">v7.3</span></h1><p className="text-slate-400 mt-1 text-xs">좌안 석축 붕괴 · 개선복구 · 2025 충북 단가</p></div></div>

      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm"><div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">{[["analysis","AI 분석"],["estimate","설계내역서"]].map(([k,l])=><button key={k} onClick={()=>setView(k)} className={`px-3 py-1.5 text-xs rounded font-medium ${view===k?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l}</button>)}</div>
        <div className="flex gap-1"><button onClick={saveJ} className="px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">💾 저장</button><button onClick={()=>jsonRef.current?.click()} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">📂 불러오기</button><input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={loadJ}/></div>
      </div></div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {view==="analysis"&&<>
        <section><Hd n="📷" t="현장 사진"/><div className="mt-2 flex gap-3 items-start flex-wrap"><button onClick={()=>fileRef.current?.click()} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">사진 업로드</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)setPhotoUrl(URL.createObjectURL(f))}}/>{photoUrl&&<img src={photoUrl} alt="" className="h-36 rounded border cursor-pointer hover:opacity-80" onClick={()=>setPhotoModal(true)}/>}</div>{photoModal&&photoUrl&&<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={()=>setPhotoModal(false)}><img src={photoUrl} alt="" className="max-w-full max-h-full rounded"/></div>}</section>

        <section><Hd n="1" t="종합 분석"/><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3"><IC title="현장 제원" c="blue"><IR l="피해 위치" v="좌안 석축 호안"/><IR l="피해 연장" v="약 20m"/><IR l="석축 높이" v="약 2.5m"/><IR l="기초 세굴" v="약 1.0m"/></IC><IC title="피해 원인" c="red"><IR l="1차" v="급류 수충"/><IR l="2차" v="기초 세굴→붕괴"/><IR l="3차" v="도로 함몰"/><IR l="설계" v="근입 D≥1.0m"/></IC></div>
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3"><h4 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm"><div><span className="text-slate-500 text-xs">품목</span><p className="font-semibold">레미콘,철근,석재,잡석</p></div><div><span className="text-slate-500 text-xs">관급자재비</span><p className="font-bold text-red-600">{fmt(gT)}원</p></div><div><span className="text-slate-500 text-xs">수수료율</span><p className="font-semibold">1.5%</p></div><div><span className="text-slate-500 text-xs">관급수수료</span><p className="font-bold text-red-600">{fmt(gF)}원</p></div></div></div></section>

        <section><div className="flex items-center justify-between"><Hd n="2" t="피해 현황"/><button onClick={()=>setEditMode(!editMode)} className="text-xs px-3 py-1 bg-slate-100 rounded hover:bg-slate-200">{editMode?"✅ 완료":"✏️ 편집"}</button></div>
        <p className="text-xs text-orange-600 mt-1">* 수량 변경 시 내역서 물량 자동 연동</p>
        <div className="mt-2 overflow-x-auto border border-slate-200 rounded-lg"><table className="w-full text-sm border-collapse"><thead><tr className="bg-blue-700 text-white">{editMode&&<th className="border border-blue-600 px-2 py-1.5 w-8"><input type="checkbox" checked={allD} ref={el=>{if(el)el.indeterminate=!allD&&someD}} onChange={toggleAllD} className="w-4 h-4"/></th>}<th className="border border-blue-600 px-2 py-1.5 w-8">No</th><th className="border border-blue-600 px-2 py-1.5">항목</th><th className="border border-blue-600 px-2 py-1.5">산출근거</th><th className="border border-blue-600 px-2 py-1.5 w-16">수량</th><th className="border border-blue-600 px-2 py-1.5 w-12">단위</th></tr></thead>
        <tbody>{dmg.map((d,i)=><tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-50 line-through":i%2===0?"bg-white":"bg-slate-50"}>{editMode&&<td className="border border-slate-200 px-2 py-1 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>toggleD(d.id)} className="w-4 h-4"/></td>}<td className="border border-slate-200 px-2 py-1 text-center">{i+1}</td><td className="border border-slate-200 px-2 py-1">{d.item}</td><td className="border border-slate-200 px-2 py-1 text-slate-500">{d.basis}</td><td className="border border-slate-200 px-1 py-1 text-center font-medium">{editMode?<input type="number" value={d.qty} onChange={e=>updDmgQty(d.id,e.target.value)} className="w-full text-center border rounded px-1 py-0.5 text-sm"/>:d.qty}</td><td className="border border-slate-200 px-2 py-1 text-center">{d.unit}</td></tr>)}</tbody></table></div></section>

        <section><Hd n="📝" t="메모"/><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="수정사항, 현장명..." className="w-full mt-2 border border-slate-300 rounded p-3 text-sm h-16 resize-none"/></section>

        <section><Hd n="3" t="구조물 제원 / 단면도"/><div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"><SpecCard t="석축(찰쌓기)" items={["형식: 찰쌓기","H=2.5m, T=35cm","L=20.5m, 근입D=1.0m"]} c="blue"/><SpecCard t="기초 콘크리트" items={["25-210-12(철근)","B=2.5m, D=1.0m","HD13 @200"]} c="red"/><SpecCard t="잡석 기초" items={["잡석(기계다짐)","B=2.5m, T=0.5m","부직포 하부+배면"]} c="amber"/></div><div className="mt-4 flex justify-center"><XSec/></div></section>
      </>}

      {view==="estimate"&&<>
        <section>
          <div className="flex items-center justify-between flex-wrap gap-2"><Hd n="📋" t="설계물량 편집"/><div className="flex gap-1"><button onClick={addItem} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">➕ 공종추가</button><button onClick={delUnchecked} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">🗑️ 선택삭제</button><button onClick={()=>setEditMode(!editMode)} className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">{editMode?"✅ 완료":"✏️ 편집"}</button></div></div>
          <div className="mt-2 overflow-x-auto border border-slate-200 rounded-lg"><table className="w-full text-xs border-collapse" style={{minWidth:850}}>
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
            <tbody>{items.map(d=>{const p=PRICE_DB[d.priceId]||{total:0};return(
              <tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-40 line-through":"bg-white hover:bg-blue-50"}>
                <td className="border border-slate-200 px-1 py-1 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>toggleI(d.id)} className="w-4 h-4"/></td>
                <td className="border border-slate-200 px-1 py-1 text-center">{editMode?<input value={d.priceId} onChange={e=>updField(d.id,"priceId",e.target.value)} className="w-full text-center border rounded px-0.5 py-0.5 text-xs" placeholder="#.번호"/>:<span className="text-blue-600">{d.priceId}</span>}</td>
                <td className="border border-slate-200 px-1 py-1 text-center">{editMode?<select value={d.cat} onChange={e=>updField(d.id,"cat",e.target.value)} className="text-xs border rounded px-0.5 py-0.5"><option value="1.">1.토공</option><option value="2.">2.구조물</option><option value="3.">3.포장</option><option value="4.">4.부대</option></select>:d.cat}</td>
                <td className="border border-slate-200 px-2 py-1">{editMode?<input value={d.name} onChange={e=>updField(d.id,"name",e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs" placeholder="공종명 입력"/>:d.name}</td>
                <td className="border border-slate-200 px-1 py-1 text-slate-500">{editMode?<input value={d.spec} onChange={e=>updField(d.id,"spec",e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs" placeholder="규격"/>:d.spec}</td>
                <td className="border border-slate-200 px-1 py-1 text-center"><input type="number" value={d.qty} step="0.1" onChange={e=>updField(d.id,"qty",e.target.value)} className="w-full text-center border rounded px-0.5 py-0.5 text-xs"/></td>
                <td className="border border-slate-200 px-1 py-1 text-center">{editMode?<select value={d.unit} onChange={e=>updField(d.id,"unit",e.target.value)} className="text-xs border rounded px-0.5 py-0.5">{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>:d.unit}</td>
                <td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.total)}</td>
                <td className="border border-slate-200 px-1 py-1 text-right font-medium">{d.enabled?fmt(Math.round(d.qty*p.total)):"-"}</td>
              </tr>)})}</tbody>
          </table></div>
          {editMode&&<p className="text-xs text-slate-400 mt-1">* 단가ID(#.22 등) 입력 시 단가 자동 적용 · 공종/단위 드롭다운 선택</p>}
        </section>

        {/* 13열 내역서 */}
        <section><Hd n="2" t="설계 내역서"/><p className="text-xs text-slate-500 mt-1 mb-3">2025년 충청북도 일위대가 · 체크 해제 항목 합계 제외</p>
        <div className="overflow-x-auto border border-slate-200 rounded-lg"><table className="w-full text-xs border-collapse" style={{minWidth:1100}}>
          <thead><tr className="bg-blue-700 text-white"><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-10">공종</th><th rowSpan={2} className="border border-blue-600 px-2 py-1.5 w-32">품 명</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-36">규 격</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-12">수량</th><th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-8">단위</th><th colSpan={2} className="border border-blue-600 text-center">합 계</th><th colSpan={2} className="border border-blue-600 text-center">노 무 비</th><th colSpan={2} className="border border-blue-600 text-center">재 료 비</th><th colSpan={2} className="border border-blue-600 text-center">경 비</th></tr>
          <tr className="bg-blue-600 text-white text-center">{["단가","금액","단가","금액","단가","금액","단가","금액"].map((t,i)=><th key={i} className="border border-blue-500 px-1 py-1">{t}</th>)}</tr></thead>
          <tbody>
            <TR13 label="순 공 사 비" a={[sunG,sunI,sunK,sunM]} bg="bg-slate-200" tc="text-slate-800"/>
            {[{c:"1.",n:"토공",t:t1},{c:"2.",n:"구조물공",t:t2},{c:"3.",n:"포장공",t:t3},{c:"4.",n:"부대공",t:t4}].map(({c,n,t})=>{const ci=act.filter(i=>i.cat===c);if(!ci.length)return null;return<Fragment key={c}><CR13 code={c} name={n} a={[t.g,t.i,t.k,t.m]}/>{ci.map((item,idx)=><IR13 key={item.id} item={item} p={PRICE_DB[item.priceId]||{total:0,labor:0,material:0,expense:0}} idx={idx}/>)}</Fragment>})}

            <CR13 code="5." name="사급자재대" a={[sT,0,0,0]} fill="bg-orange-50"/>
            {sagub.map((item,idx)=><tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border border-slate-200 px-1 py-1"></td><td className="border border-slate-200 px-2 py-1">{item.name}</td><td className="border border-slate-200 px-1 py-1 text-slate-500">{item.spec}</td><td className="border border-slate-200 px-1 py-1 text-center">{item.qty}</td><td className="border border-slate-200 px-1 py-1 text-center">{item.unit}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(item.unitPrice)}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td><td colSpan={6} className="border border-slate-200"></td></tr>)}

            <CR13 code="6." name="관급자재대" a={[gT,0,0,0]} fill="bg-red-50"/>
            {gwangub.map((item,idx)=><tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border border-slate-200 px-1 py-1 text-center text-xs">{item.sub}</td><td className="border border-slate-200 px-2 py-1">{item.name}</td><td className="border border-slate-200 px-1 py-1 text-slate-500">{item.spec}</td><td className="border border-slate-200 px-1 py-1 text-center">{item.qty}</td><td className="border border-slate-200 px-1 py-1 text-center">{item.unit}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(item.unitPrice)}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td><td colSpan={6} className="border border-slate-200"></td></tr>)}

            <tr className="bg-red-50 font-bold"><td colSpan={5} className="border border-slate-300 px-3 py-1.5 text-center text-red-700">관급수수료 (1.5%)</td><td className="border border-slate-300"></td><td className="border border-slate-300 px-1 py-1.5 text-right text-red-700">{fmt(gF)}</td><td colSpan={6} className="border border-slate-300"></td></tr>
            <TR13 label="총 공 사 비" a={[grand,0,0,0]} bg="bg-slate-800" tc="text-white"/>
          </tbody></table></div></section>

        <section><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["직접공사비",sunG,"blue"],["사급자재비",sT,"orange"],["관급자재비",gT,"red"],["관급수수료",gF,"pink"],["총공사비",grand,"slate"]].map(([l,v,c],i)=><SCard key={i} l={l} v={v} c={c} bold={i===4}/>)}</div></section>

        <section><Hd n="📊" t="엑셀 다운로드"/><div className="mt-3 flex gap-3 flex-wrap">
          <button disabled={xlLoad==="d"} onClick={()=>handleXL("d")} className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 shadow disabled:opacity-50">{xlLoad==="d"?"생성중...":"📊 설계내역서"}</button>
          <button disabled={xlLoad==="q"} onClick={()=>handleXL("q")} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 shadow disabled:opacity-50">{xlLoad==="q"?"생성중...":"📋 수량산출서"}</button>
          <button disabled={xlLoad==="u"} onClick={()=>handleXL("u")} className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 shadow disabled:opacity-50">{xlLoad==="u"?"생성중...":"📑 일위대가"}</button>
        </div><p className="text-xs text-slate-400 mt-2">* 브라우저 직접 생성 — 서버 불필요</p></section>
      </>}

      <footer className="border-t border-slate-200 pt-4 pb-6 text-xs text-slate-400"><p>상세 수량산출 근거는 엑셀 참조 · 2025년 충청북도 일위대가</p></footer>
      </div>
    </div>
  );
}

/* Sub */
function Hd({n,t}){return<div className="flex items-center gap-2"><span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded flex items-center justify-center">{n}</span><h2 className="text-lg font-bold text-slate-800">{t}</h2></div>}
function IC({title,c,children}){const s=c==="blue"?"bg-blue-50 border-blue-200 text-blue-700":"bg-red-50 border-red-200 text-red-700";return<div className={`${s.split(" ").slice(0,2).join(" ")} border rounded-lg p-4`}><h4 className={`font-bold ${s.split(" ")[2]} text-sm mb-2`}>{title}</h4><div className="space-y-1.5">{children}</div></div>}
function IR({l,v}){return<div className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800">{v}</span></div>}
function SpecCard({t,items,c}){const bg={"blue":"bg-blue-50 border-blue-200 text-blue-700","red":"bg-red-50 border-red-200 text-red-700","amber":"bg-amber-50 border-amber-200 text-amber-700"}[c];return<div className={`${bg} border rounded-lg p-3`}><h4 className="font-bold text-sm mb-2">{t}</h4>{items.map((s,i)=><p key={i} className="text-xs text-slate-700">• {s}</p>)}</div>}
function TR13({label,a,bg,tc}){return<tr className={`${bg} font-bold`}><td colSpan={5} className={`border border-slate-300 px-3 py-1.5 text-center ${tc}`}>{label}</td><td className="border border-slate-300"></td><td className={`border border-slate-300 px-1 py-1.5 text-right ${tc}`}>{fmt(a[0])}</td><td className="border border-slate-300"></td><td className={`border border-slate-300 px-1 py-1.5 text-right ${tc}`}>{a[1]?fmt(a[1]):""}</td><td className="border border-slate-300"></td><td className={`border border-slate-300 px-1 py-1.5 text-right ${tc}`}>{a[2]?fmt(a[2]):""}</td><td className="border border-slate-300"></td><td className={`border border-slate-300 px-1 py-1.5 text-right ${tc}`}>{a[3]?fmt(a[3]):""}</td></tr>}
function CR13({code,name,a,fill}){const bg=fill||"bg-blue-50";return<tr className={`${bg} font-bold`}><td className="border border-slate-300 px-1 py-1 text-center text-blue-700 text-xs">{code}</td><td className="border border-slate-300 px-2 py-1 text-blue-700">{name}</td><td className="border border-slate-300"></td><td className="border border-slate-300"></td><td className="border border-slate-300"></td><td className="border border-slate-300"></td><td className="border border-slate-300 px-1 py-1 text-right text-blue-700">{fmt(a[0])}</td><td className="border border-slate-300"></td><td className="border border-slate-300 px-1 py-1 text-right">{a[1]?fmt(a[1]):""}</td><td className="border border-slate-300"></td><td className="border border-slate-300 px-1 py-1 text-right">{a[2]?fmt(a[2]):""}</td><td className="border border-slate-300"></td><td className="border border-slate-300 px-1 py-1 text-right">{a[3]?fmt(a[3]):""}</td></tr>}
function IR13({item,p,idx}){const q=item.qty;return<tr className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border border-slate-200 px-1 py-1"></td><td className="border border-slate-200 px-2 py-1">{item.name}</td><td className="border border-slate-200 px-1 py-1 text-slate-500 text-xs">{item.spec}</td><td className="border border-slate-200 px-1 py-1 text-center">{q}</td><td className="border border-slate-200 px-1 py-1 text-center">{item.unit}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.total)}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*p.total))}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.labor)}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*p.labor))}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.material)}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*p.material))}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.expense)}</td><td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*p.expense))}</td></tr>}
function SCard({l,v,c,bold}){const s={blue:"bg-blue-50 border-blue-200 text-blue-700",orange:"bg-orange-50 border-orange-200 text-orange-600",red:"bg-red-50 border-red-200 text-red-600",pink:"bg-pink-50 border-pink-200 text-pink-600",slate:"bg-slate-800 border-slate-700 text-white"}[c];return<div className={`rounded-lg border p-3 ${s}`}><p className="text-xs opacity-75">{l}</p><p className={`${bold?"text-lg":"text-sm"} font-bold mt-0.5`}>{fmt(v)}원</p></div>}
function XSec(){return<svg viewBox="0 0 600 340" className="w-full max-w-xl border border-slate-200 rounded-lg bg-slate-50"><line x1="30" y1="245" x2="570" y2="245" stroke="#78716c" strokeWidth="2" strokeDasharray="8,4"/><text x="575" y="249" fontSize="10" fill="#78716c">G.L</text><rect x="120" y="245" width="250" height="28" fill="#d6d3d1" stroke="#78716c" strokeWidth="1"/><text x="245" y="264" fontSize="9" fill="#44403c" textAnchor="middle">잡석기초 T=0.5m</text><rect x="115" y="273" width="260" height="5" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="0.5"/><rect x="130" y="185" width="230" height="60" fill="#e5e7eb" stroke="#374151" strokeWidth="1.5"/><text x="245" y="220" fontSize="10" fill="#1f2937" textAnchor="middle" fontWeight="bold">기초 콘크리트</text><text x="245" y="235" fontSize="8" fill="#4b5563" textAnchor="middle">25-210-12 D=1.0m</text><rect x="140" y="65" width="35" height="120" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" rx="2"/>{[75,95,115,135,155,175].map((y,i)=><line key={i} x1="142" y1={y} x2="173" y2={y} stroke="#92400e" strokeWidth="0.5" opacity="0.4"/>)}<text x="157" y="50" fontSize="9" fill="#92400e" textAnchor="middle" fontWeight="bold">찰쌓기 T=35cm</text><rect x="175" y="65" width="80" height="120" fill="#fef3c7" stroke="#d97706" strokeWidth="1" strokeDasharray="4,2"/><text x="215" y="130" fontSize="9" fill="#92400e" textAnchor="middle">뒤채움</text><line x1="175" y1="65" x2="175" y2="185" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6,3"/><rect x="255" y="55" width="200" height="10" fill="#374151" rx="1"/><text x="355" y="48" fontSize="10" fill="#1f2937" textAnchor="middle" fontWeight="bold">도 로</text><text x="70" y="175" fontSize="11" fill="#2563eb" textAnchor="middle" fontWeight="bold">하 천</text><path d="M55,190 Q70,195 55,205 Q70,210 55,220" fill="none" stroke="#2563eb" strokeWidth="1.5"/><line x1="125" y1="65" x2="125" y2="185" stroke="#dc2626" strokeWidth="0.8"/><text x="110" y="130" fontSize="8" fill="#dc2626" textAnchor="middle" transform="rotate(-90,110,130)">H=2.5m</text><line x1="370" y1="185" x2="370" y2="245" stroke="#dc2626" strokeWidth="0.8"/><text x="388" y="220" fontSize="8" fill="#dc2626">D=1.0m</text>{[200,210,220,230,240].map((y,i)=><circle key={i} cx={150+i*40} cy={y} r="2" fill="#ef4444" stroke="#991b1b" strokeWidth="0.5"/>)}<rect x="430" y="280" width="150" height="52" fill="white" stroke="#d1d5db" rx="3"/><text x="440" y="295" fontSize="8" fill="#374151" fontWeight="bold">범 례</text><rect x="440" y="300" width="12" height="8" fill="#fbbf24" stroke="#92400e" strokeWidth="0.5"/><text x="456" y="308" fontSize="7" fill="#44403c">석축</text><rect x="440" y="312" width="12" height="8" fill="#e5e7eb" stroke="#374151" strokeWidth="0.5"/><text x="456" y="320" fontSize="7" fill="#44403c">기초 콘크리트</text><rect x="440" y="324" width="12" height="8" fill="#d6d3d1" stroke="#78716c" strokeWidth="0.5"/><text x="456" y="332" fontSize="7" fill="#44403c">잡석기초</text></svg>}
