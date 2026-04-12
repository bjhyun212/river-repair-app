import { useState, useRef, useCallback, useMemo, Fragment, memo } from "react";

/* ============================================================
   소규모주민숙원사업 설계자동화 VER2.0
   v8.2 + 신규공종 노무비/재료비/경비 단가 직접입력 → 자동계산
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const UNITS = ["m²","m³","m","hr","ton","일","식","본","개소","km","㎡","㎥"];
const CAT_OPTIONS = [["1.","1.토공"],["2.","2.구조물공"],["3.","3.배수공"],["4.","4.호안공"],["5.","5.포장공"],["6.","6.부대공"]];
const CAT_NAMES = {"1.":"토공","2.":"구조물공","3.":"배수공","4.":"호안공","5.":"포장공","6.":"부대공"};
const CATS = ["1.","2.","3.","4.","5.","6."];

/* API 호출 헬퍼 — 환경 자동 감지 (Netlify→직접API→에러 순서) */
async function callAI(body) {
  const urls=["/.netlify/functions/ai-proxy","https://api.anthropic.com/v1/messages"];
  for(const url of urls){
    try{
      const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(r.ok) return await r.json();
    }catch(e){/* 다음 URL */}
  }
  throw new Error("AI 서버 연결 실패");
}

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
  "#.308":{name:"보조기층포설및다짐",spec:"기계시공-본선포장",unit:"m³",labor:2806,material:943,expense:1206,total:4955},
  "#.310":{name:"프라임코팅",spec:"RS(C)-3,기계",unit:"m²",labor:31,material:6,expense:6,total:43},
  "#.312":{name:"택코팅",spec:"RS(C)-4,기계",unit:"m²",labor:31,material:6,expense:6,total:43},
  "#.314":{name:"기층아스콘포설및다짐",spec:"소형장비(5-7cm)",unit:"m²",labor:1973,material:281,expense:510,total:2764},
  "#.321":{name:"표층아스콘포설및다짐",spec:"소형장비",unit:"m²",labor:2158,material:307,expense:558,total:3023},
  "#.185":{name:"레미콘타설(펌프차)",spec:"무근(S:8-12cm),TYPE-Ⅱ",unit:"m³",labor:14372,material:2355,expense:4366,total:21093},
  "#.481":{name:"교통통제및안전처리",spec:"500M미만",unit:"일",labor:339608,material:0,expense:0,total:339608},
  "#.445":{name:"가드레일 설치",spec:"표준레일(지주간격2m,2W)",unit:"m",labor:6606,material:101375,expense:827,total:108808},
  "#.446":{name:"가드레일 설치",spec:"표준레일(지주간격4m,2W)",unit:"m",labor:4128,material:74589,expense:439,total:79156},
  "#.453":{name:"낙석방지망",spec:"철망설치(기계식)",unit:"m²",labor:6115,material:11800,expense:1510,total:19425},
  "#.451":{name:"낙석방지책",spec:"표준구간(3.0×3.0)",unit:"경간",labor:257962,material:505960,expense:6158,total:770080},
  "#.460":{name:"안전시설목",spec:"",unit:"ea",labor:122778,material:344733,expense:1196,total:468707},
  "#.100":{name:"진동전압관부설",spec:"D=300mm,고무링접합",unit:"m",labor:28432,material:3680,expense:4805,total:36917},
  "#.101":{name:"진동전압관부설",spec:"D=450mm,고무링접합",unit:"m",labor:47454,material:6143,expense:8020,total:61617},
  "#.102":{name:"진동전압관부설",spec:"D=600mm,고무링접합",unit:"m",labor:65688,material:8503,expense:11102,total:85293},
  "#.103":{name:"진동전압관부설",spec:"D=800mm,고무링접합",unit:"m",labor:85479,material:11065,expense:14448,total:110992},
  "#.105":{name:"진동전압관부설",spec:"D=1000mm,고무링접합",unit:"m",labor:116786,material:13438,expense:20774,total:150998},
  "#.163":{name:"호안블럭붙이기",spec:"1.0x1.0(기계)",unit:"m²",labor:7693,material:319,expense:1478,total:9490},
  "#.149":{name:"돌붙임",spec:"찰붙임,T=35cm이하",unit:"m²",labor:48636,material:3282,expense:6258,total:58176},
  "#.158":{name:"전석쌓기",spec:"",unit:"m²",labor:62551,material:6747,expense:9800,total:79098},
  "#.164":{name:"보강토옹벽",spec:"블록식",unit:"m²",labor:90337,material:3330,expense:15396,total:109063},
  "#.306":{name:"보조기층포설및다짐",spec:"인력,소규모",unit:"m³",labor:11408,material:1410,expense:1577,total:14395},
  "#.330":{name:"아스팔트절삭",spec:"소규모포장",unit:"m²",labor:1009,material:626,expense:619,total:2254},
  "#.331":{name:"아스팔트덧씌우기",spec:"소규모포장",unit:"m²",labor:2245,material:328,expense:489,total:3062},
};

/* ★ 단가 조회: PRICE_DB 있으면 DB, 없으면 item 자체 값 사용 */
// 공종명 → 단가ID 자동 매핑 (PRICE_DB에 없는 경우)
// ★ 공종명 유사어 → 단가ID 자동 매핑 (부분 일치)
const AUTO_PRICE_MAP=[
  // [키워드배열, 단가ID, 자동규격] — 키워드 중 하나라도 포함되면 매핑
  [["가드레일","가드","방호울타리","방호펜스"],"#.445","표준레일(지주간격2m,2W)"],
  [["낙석방지망","낙석망"],"#.453","철망설치(기계식)"],
  [["낙석방지책","낙석책"],"#.451","표준구간(3.0×3.0)"],
  [["호안블럭","호안블록","호안"],"#.163","1.0x1.0"],
  [["안전시설목"],"#.460",""],
  [["아스팔트절삭","절삭"],"#.330","소규모포장"],
  [["덧씌우기","오버레이"],"#.331","소규모포장"],
  [["보조기층"],"#.308","기계시공-본선포장"],
  [["프라임코팅","프라임"],"#.310","RS(C)-3,기계"],
  [["택코팅","택코트"],"#.312","RS(C)-4,기계"],
  [["기층아스콘","기층포설"],"#.314","소형장비(5-7cm)"],
  [["표층아스콘","표층포설"],"#.321","소형장비"],
  [["흄관","관부설","배수관"],"#.102","D=600mm,고무링접합"],
  [["플륨관"],"#.92","300~500kg"],
  [["석축쌓기","석축","찰쌓기","메쌓기"],"#.155","찰쌓기,T=35cm이하"],
  [["레미콘타설","콘크리트타설","레미콘"],"#.193","철근(S:8-12cm),TYPE-Ⅱ"],
  [["합판거푸집","거푸집"],"#.204","(4회) 보통"],
  [["철근가공","철근조립","철근"],"#.216","TYPE-1-1"],
  [["콘크리트양생","양생"],"#.276","습윤양생"],
  [["구조물터파기","터파기"],"#.57","육상토사,기계100%"],
  [["기초지정","잡석기초","잡석"],"#.77","잡석"],
  [["부직포"],"#.280",""],
  [["비닐깔기","비닐"],"#.281",""],
  [["물푸기"],"#.282",""],
  [["교통통제","안전처리"],"#.481","500M미만"],
  [["표토제거","표토"],"#.22","T=20CM,굴삭기0.7㎥"],
  [["흙깍기","토사굴착"],"#.28","보통토사,소규모,굴착기1.0㎥"],
  [["뒤채움","뒷채움"],"#.68","소형장비"],
  [["되메우기","되메움"],"#.70","소형장비"],
  [["사토운반","잔토운반"],"#.127","토사,L=5.0KM"],
  [["사면녹화","절토사면","녹화"],"#.87","T=10㎝"],
  [["보강토옹벽","보강토"],"#.164","블록식"],
  [["돌망태","돌망태옹벽"],"#.162",""],
];
function autoMapPrice(item){
  if(item.priceId&&PRICE_DB[item.priceId])return item.priceId;
  const nm=(item.name||"").toLowerCase();
  for(const[keywords,pid,spec]of AUTO_PRICE_MAP){
    if(keywords.some(kw=>nm.includes(kw))&&PRICE_DB[pid]){
      // 규격이 비어있으면 자동 채움 (참조용, item을 직접 수정하지 않음)
      if(spec&&!item.spec) item._autoSpec=spec;
      return pid;
    }
  }
  return item.priceId||"";
}
function getPrice(item) {
  const mapped=autoMapPrice(item);
  const db = PRICE_DB[mapped];
  if (db) return db;
  if ((item.labor||0)+(item.material||0)+(item.expense||0)>0)
    return { labor: item.labor||0, material: item.material||0, expense: item.expense||0, total: (item.labor||0)+(item.material||0)+(item.expense||0) };
  return { labor: 0, material: 0, expense: 0, total: 0 };
}
// 단가 적용 우선순위: ①2025 충북 일위대가(PRICE_DB) → ②유사단가 적용 → ③가격정보(물가자료) → ④직접입력
function getPriceBasis(item) {
  const mapped=autoMapPrice(item);
  if (PRICE_DB[mapped]) return `2025 충북 일위대가 ${mapped}`;
  if ((item.labor||0)+(item.material||0)+(item.expense||0)>0) return "유사단가 또는 가격정보 적용 (직접입력)";
  return "단가 미등록 — 유사단가>가격정보>물가정보 순 적용 필요";
}

const CALC_BASIS={1:"표토제거=폭2.5m×길이14m=35m²",2:"토사굴착=폭2.0m×길이10m×깊이2.0m=40m³",3:"기초터파기=폭2.5m×길이20.5m×깊이1.0m=51m³",4:"잡석기초=폭2.5m×길이20.5m×두께0.5m=26m³",5:"기초콘크리트=폭2.5m×길이20.5m×깊이1.0m=51m³",6:"석축찰쌓기=높이2.5m×길이20.5m=51m²",7:"거푸집=기초양측면+전면=41m²",8:"철근=HD13@200,51m³×배근율≒2.6ton",9:"양생=기초상면+측면=92m²",10:"부직포=잡석하부+석축배면≒72m²",11:"비닐=기초하부2.5m×20.5m=51m²",12:"뒤채움=석축배면1.5m×2.5m×20.5m×0.45≒35m³",13:"되메우기=잔여1.0m×1.0m×20.5m≒20m³",14:"사면녹화=3.0m×15m=45m²",15:"사토운반=터파기51+토사40+잔해217=308m³",16:"교통통제=공사기간5일",17:"물푸기=24시간",18:"아스팔트=2.0m×20m=40m²"};

let _nid = 200;
const nid = () => _nid++;

const INIT_DAMAGE = () => [
  {id:1,item:"석축찰쌓기",basis:"높이3.0m×연장20m=60㎡",qty:60,unit:"㎡",enabled:true},
  {id:2,item:"아스콘포장",basis:"폭4.0m×연장20m=80㎡",qty:80,unit:"㎡",enabled:true},
  {id:3,item:"배수관설치",basis:"φ600mm×연장15m",qty:15,unit:"m",enabled:true},
  {id:4,item:"사면녹화",basis:"높이3.0m×연장20m=60㎡",qty:60,unit:"㎡",enabled:true},
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
        <td className="border px-1 py-1"><input value={d.name} onChange={e=>onUpdate(d.id,"name",e.target.value)} className="w-full bg-transparent text-xs outline-none focus:bg-blue-50 rounded px-1 py-0.5" placeholder="복구공종 (석축찰쌓기, 아스콘포장 등)"/></td>
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
  const mapped = autoMapPrice(item);
  const hasDb = !!PRICE_DB[mapped];
  const p = getPrice(item);
  const q = item.qty;
  const inpCls = "w-full text-right bg-transparent text-xs outline-none focus:bg-yellow-50 focus:ring-1 focus:ring-orange-300 rounded px-0.5 py-0.5";

  return (
    <tr className={idx%2===0?"bg-white":"bg-slate-50"}>
      <td className="border px-1 py-1"></td>
      <td className="border px-2 py-1">{item.name}</td>
      <td className="border px-1 py-1 text-slate-500 text-xs">{item.spec||item._autoSpec||PRICE_DB[mapped]?.spec||""}</td>
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
async function genDesignXL(items,sagub,gwangub,fr,pn,pl){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),ws={};ws["!cols"]=[{wch:8},{wch:24},{wch:28},{wch:10},{wch:6},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14}];wsc(ws,0,0,`공사명: ${pn||""}`,{font:{bold:true,sz:11},alignment:{horizontal:"left"}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:12}}];wsc(ws,1,0,`위  치: ${pl||""}`,{font:{sz:10},alignment:{horizontal:"left"}});ws["!merges"].push({s:{r:1,c:0},e:{r:1,c:12}});wsc(ws,2,0,"설 계 내 역 서",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"].push({s:{r:2,c:0},e:{r:2,c:12}});wsc(ws,3,0,"2025년 충청북도 일위대가",{font:{sz:9,color:{rgb:"666666"}},alignment:{horizontal:"center"}});ws["!merges"].push({s:{r:3,c:0},e:{r:3,c:12}});["공종","품 명","규 격","수량","단위","합 계","","노 무 비","","재 료 비","","경 비",""].forEach((v,c)=>wsc(ws,4,c,v,HS));["","","","","","단가","금액","단가","금액","단가","금액","단가","금액"].forEach((v,c)=>{if(c>=5)wsc(ws,5,c,v,HS)});for(let c=0;c<5;c++)ws["!merges"].push({s:{r:4,c},e:{r:5,c}});ws["!merges"].push({s:{r:4,c:5},e:{r:4,c:6}},{s:{r:4,c:7},e:{r:4,c:8}},{s:{r:4,c:9},e:{r:4,c:10}},{s:{r:4,c:11},e:{r:4,c:12}});let r=6;const catRows={};const sunRow=r;r++;CATS.forEach(cc=>{const ci=act.filter(i=>i.cat===cc);if(!ci.length)return;const cr=r;r++;catRows[cc]={row:cr,items:[]};wsc(ws,cr,0,cc,CST("DBEAFE"));wsc(ws,cr,1,CAT_NAMES[cc],CST("DBEAFE"));for(let c=2;c<13;c++)wsc(ws,cr,c,"",CST("DBEAFE"));ci.forEach(item=>{const p=getPrice(item),ir=r;r++;catRows[cc].items.push(ir);wsc(ws,ir,0,"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec||"",TS);wsc(ws,ir,3,item.qty,{...NS,numFmt:"#,##0.0##"});wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,`=H${ir+1}+J${ir+1}+L${ir+1}`,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);wsc(ws,ir,7,p.labor,NS);wsc(ws,ir,8,`=D${ir+1}*H${ir+1}`,NS);wsc(ws,ir,9,p.material,NS);wsc(ws,ir,10,`=D${ir+1}*J${ir+1}`,NS);wsc(ws,ir,11,p.expense,NS);wsc(ws,ir,12,`=D${ir+1}*L${ir+1}`,NS)});const irs=catRows[cc].items;if(irs.length)[6,8,10,12].forEach(c=>{const col=String.fromCharCode(65+c);wsc(ws,cr,c,`=SUM(${col}${irs[0]+1}:${col}${irs[irs.length-1]+1})`,{...CST("DBEAFE"),numFmt:"#,##0"})})});const sunS=TTS2("D6DCE4");wsc(ws,sunRow,0,"",sunS);wsc(ws,sunRow,1,"순 공 사 비",sunS);for(let c=2;c<13;c++)wsc(ws,sunRow,c,"",sunS);ws["!merges"].push({s:{r:sunRow,c:0},e:{r:sunRow,c:1}});const uc=CATS.filter(c=>catRows[c]);[6,8,10,12].forEach(c=>{const col=String.fromCharCode(65+c);const refs=uc.map(cc=>`${col}${catRows[cc].row+1}`).join("+");if(refs)wsc(ws,sunRow,c,`=${refs}`,{...sunS,numFmt:"#,##0"})});const sRow=r;r++;const sNum=Object.keys(catRows).length+1;wsc(ws,sRow,0,`${sNum}.`,CST("FFF7ED"));wsc(ws,sRow,1,"사급자재대",CST("FFF7ED"));for(let c=2;c<13;c++)wsc(ws,sRow,c,"",CST("FFF7ED"));const si=[];sagub.forEach(item=>{const ir=r;r++;si.push(ir);wsc(ws,ir,0,"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec,TS);wsc(ws,ir,3,item.qty,NS);wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,item.unitPrice,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);for(let c=7;c<9;c++)wsc(ws,ir,c,"",TS);wsc(ws,ir,9,item.unitPrice,NS);wsc(ws,ir,10,`=D${ir+1}*J${ir+1}`,NS);for(let c=11;c<13;c++)wsc(ws,ir,c,"",TS)});if(si.length){wsc(ws,sRow,6,`=SUM(G${si[0]+1}:G${si[si.length-1]+1})`,{...CST("FFF7ED"),numFmt:"#,##0"});wsc(ws,sRow,10,`=SUM(K${si[0]+1}:K${si[si.length-1]+1})`,{...CST("FFF7ED"),numFmt:"#,##0"})};void(0);if(0)wsc(ws,sRow,6,`=SUM(G${si[0]+1}:G${si[si.length-1]+1})`,{...CST("FFF7ED"),numFmt:"#,##0"});const gRow=r;r++;wsc(ws,gRow,0,`${sNum+1}.`,CST("FEF2F2"));wsc(ws,gRow,1,"관급자재대",CST("FEF2F2"));for(let c=2;c<13;c++)wsc(ws,gRow,c,"",CST("FEF2F2"));const gi=[];gwangub.forEach(item=>{const ir=r;r++;gi.push(ir);wsc(ws,ir,0,item.sub||"",TS);wsc(ws,ir,1,item.name,TS);wsc(ws,ir,2,item.spec,TS);wsc(ws,ir,3,item.qty,NS);wsc(ws,ir,4,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,ir,5,item.unitPrice,NS);wsc(ws,ir,6,`=D${ir+1}*F${ir+1}`,NS);for(let c=7;c<9;c++)wsc(ws,ir,c,"",TS);wsc(ws,ir,9,item.unitPrice,NS);wsc(ws,ir,10,`=D${ir+1}*J${ir+1}`,NS);for(let c=11;c<13;c++)wsc(ws,ir,c,"",TS)});if(gi.length){wsc(ws,gRow,6,`=SUM(G${gi[0]+1}:G${gi[gi.length-1]+1})`,{...CST("FEF2F2"),numFmt:"#,##0"});wsc(ws,gRow,10,`=SUM(K${gi[0]+1}:K${gi[gi.length-1]+1})`,{...CST("FEF2F2"),numFmt:"#,##0"})};void(0);if(0)wsc(ws,gRow,6,`=SUM(G${gi[0]+1}:G${gi[gi.length-1]+1})`,{...CST("FEF2F2"),numFmt:"#,##0"});const fRow=r;r++;wsc(ws,fRow,0,"",CST("FEF2F2"));wsc(ws,fRow,1,"관급수수료 (1.5%)",CST("FEF2F2"));for(let c=2;c<13;c++)wsc(ws,fRow,c,"",CST("FEF2F2"));wsc(ws,fRow,6,`=ROUND(G${gRow+1}*0.015,0)`,{...CST("FEF2F2"),numFmt:"#,##0"});const grRow=r;r++;const gS=TTS2("1E3A5F","FFFFFF");wsc(ws,grRow,0,"",gS);wsc(ws,grRow,1,"총 공 사 비",gS);for(let c=2;c<13;c++)wsc(ws,grRow,c,"",gS);ws["!merges"].push({s:{r:grRow,c:0},e:{r:grRow,c:1}});wsc(ws,grRow,6,`=G${sunRow+1}+G${sRow+1}+G${gRow+1}+G${fRow+1}`,{...gS,numFmt:"#,##0"});ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r,c:12}});X.utils.book_append_sheet(wb,ws,"내역서");await saveXL(X,wb,`설계내역서_${pn||new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

async function genQtyXL(items,gwangub,fr,pn,pl){try{const X=await loadXLSX(),wb=X.utils.book_new(),act=items.filter(i=>i.enabled),ws={};ws["!cols"]=[{wch:5},{wch:22},{wch:28},{wch:7},{wch:10},{wch:65},{wch:15}];wsc(ws,0,0,`공사명: ${pn||""}`,{font:{bold:true,sz:11}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:6}}];wsc(ws,1,0,`위  치: ${pl||""}`,{font:{sz:10}});ws["!merges"].push({s:{r:1,c:0},e:{r:1,c:6}});wsc(ws,2,0,"수 량 산 출 서",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"].push({s:{r:2,c:0},e:{r:2,c:6}});["No","공종명","규격","단위","수량","산출근거","비고"].forEach((v,c)=>wsc(ws,3,c,v,HS));act.forEach((item,i)=>{const r=i+4;wsc(ws,r,0,i+1,{...TS,alignment:{horizontal:"center"}});wsc(ws,r,1,item.name,TS);wsc(ws,r,2,item.spec||"",TS);wsc(ws,r,3,item.unit,{...TS,alignment:{horizontal:"center"}});wsc(ws,r,4,item.qty,{...NS,numFmt:item.unit==="ton"?"#,##0.000":"#,##0"});wsc(ws,r,5,item.basis||`설계수량=${item.qty}${item.unit}`,TS);wsc(ws,r,6,getPriceBasis(item),{...TS,font:{color:{rgb:item.priceId&&PRICE_DB[item.priceId]?"2563EB":"DC2626"}}})});const gTot=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0),fee=Math.round(gTot*fr),lr=act.length+4;wsc(ws,lr,0,act.length+1,{...TS,alignment:{horizontal:"center"}});wsc(ws,lr,1,"관급수수료",TS);wsc(ws,lr,2,"×1.5%",TS);wsc(ws,lr,3,"식",{...TS,alignment:{horizontal:"center"}});wsc(ws,lr,4,1,NS);wsc(ws,lr,5,`관급자재비${fmt(gTot)}원×1.5%=${fmt(fee)}원`,TS);wsc(ws,lr,6,"",TS);ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r:lr,c:6}});X.utils.book_append_sheet(wb,ws,"수량산출서");await saveXL(X,wb,`수량산출서_${pn||new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

async function genUnitXL(items,sagub,gwangub,pn,pl){try{const X=await loadXLSX(),wb=X.utils.book_new(),ws={};ws["!cols"]=[{wch:10},{wch:25},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:25}];wsc(ws,0,0,`공사명: ${pn||""}`,{font:{bold:true,sz:11}});ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}}];wsc(ws,1,0,`위  치: ${pl||""}`,{font:{sz:10}});ws["!merges"].push({s:{r:1,c:0},e:{r:1,c:8}});wsc(ws,2,0,"일위대가 (2025 충북)",{font:{bold:true,sz:14},alignment:{horizontal:"center"}});ws["!merges"].push({s:{r:2,c:0},e:{r:2,c:8}});["단가ID","공종명","규격","합계","노무비","재료비","경비","자재구분","출처"].forEach((v,c)=>wsc(ws,3,c,v,HS));const act=items.filter(i=>i.enabled);let r=4;
// DB 단가
const pids=[...new Set(act.filter(i=>PRICE_DB[i.priceId]).map(i=>i.priceId))];
pids.forEach(pid=>{const p=PRICE_DB[pid];let mt="";if(["기초지정","레미콘","석축","철근"].some(n=>p.name.includes(n)))mt="관급(자재별도)";else if(["합판거푸집","부직포"].some(n=>p.name.includes(n)))mt="사급(자재별도)";wsc(ws,r,0,pid,{...TS,alignment:{horizontal:"center"},font:{color:{rgb:"2563EB"}}});wsc(ws,r,1,p.name,TS);wsc(ws,r,2,p.spec,TS);wsc(ws,r,3,p.total,NS);wsc(ws,r,4,p.labor,NS);wsc(ws,r,5,p.material,NS);wsc(ws,r,6,p.expense,NS);wsc(ws,r,7,mt,mt?{...TS,font:{color:{rgb:mt.includes("관급")?"DC2626":"EA580C"}}}:TS);wsc(ws,r,8,"2025 충북 일위대가",TS);r++});
// 직접입력 단가
const customItems=act.filter(i=>!PRICE_DB[i.priceId]&&i.name);
if(customItems.length){r++;wsc(ws,r,1,"[ 직접입력 단가 ]",{...TS,font:{bold:true,color:{rgb:"B45309"}}});for(let c=0;c<9;c++)if(c!==1)wsc(ws,r,c,"",TS);r++;["","공종명","규격","합계","노무비","재료비","경비","","출처"].forEach((v,c)=>wsc(ws,r,c,v,{...HS,fill:{fgColor:{rgb:"D97706"}}}));r++;customItems.forEach(i=>{const p=getPrice(i);wsc(ws,r,0,i.priceId||"직접",{...TS,alignment:{horizontal:"center"}});wsc(ws,r,1,i.name,TS);wsc(ws,r,2,i.spec||"",TS);wsc(ws,r,3,p.total,NS);wsc(ws,r,4,p.labor,NS);wsc(ws,r,5,p.material,NS);wsc(ws,r,6,p.expense,NS);wsc(ws,r,7,"",TS);wsc(ws,r,8,"사용자 직접입력",TS);r++})}
// 사급/관급
r++;wsc(ws,r,1,"[ 사급·관급 자재 단가 ]",{...TS,font:{bold:true,color:{rgb:"B45309"}}});for(let c=0;c<9;c++)if(c!==1)wsc(ws,r,c,"",TS);r++;["품명","규격","자재단가","","","","","구분","출처"].forEach((v,c)=>wsc(ws,r,c,v,{...HS,fill:{fgColor:{rgb:"D97706"}}}));r++;[...sagub,...gwangub].forEach(i=>{wsc(ws,r,0,"",TS);wsc(ws,r,1,i.name,TS);wsc(ws,r,2,i.spec,TS);wsc(ws,r,3,i.unitPrice,NS);for(let c=4;c<7;c++)wsc(ws,r,c,"",TS);const isGw=i.id>=200;wsc(ws,r,7,isGw?"관급":"사급",{...TS,font:{color:{rgb:isGw?"DC2626":"EA580C"}}});wsc(ws,r,8,i.source,TS);r++});
ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r,c:8}});X.utils.book_append_sheet(wb,ws,"일위대가");await saveXL(X,wb,`일위대가_${pn||new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`)}catch(e){alert("오류: "+e.message)}}

/* 설계참고 AI — 수정 명령 + Q&A 통합 */
async function askDesignAI(question, currentDamage) {
  const dmgList = (currentDamage||[]).filter(d=>d.enabled).map((d,i)=>({no:i+1,item:d.item,qty:d.qty,unit:d.unit}));
  try {
    const data = await callAI({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: `현재 피해현황: ${JSON.stringify(dmgList)}\n\n사용자 요청: ${question}` }],
        system: `당신은 30년 경력의 토목직 공무원이자 소규모주민숙원사업 설계 전문가입니다.\n이 사업은 단순 하자보수가 아닌 【개량공법에 의한 전면적 개선설계】입니다.\n기존 구조물의 근본적 문제를 해결하는 개량 방향으로 답변하세요.\n\n사용자의 요청이 피해현황 수정/변경 요청인 경우:\n반드시 JSON으로만 응답: {"action":"modify","damage":[{"item":"복구공종명(석축찰쌓기,아스콘포장 등)","basis":"산출근거(폭×높이×길이=수량)","qty":숫자,"unit":"단위"}],"message":"수정내용요약"}\n\n설계/공법/기준 질문인 경우:\nJSON으로 응답: {"action":"answer","message":"상세하고 전문적인 답변. 관련 설계기준(KDS 등) 구체적 인용. 실무 관점의 장단점, 적용조건, 시공방법 포함. 최소 300자 이상."}\n\n참고: 하천설계기준(2019), KDS 51 40 15 석축, KDS 14 20 72 옹벽, KDS 11 80 05 토류벽, 자연재해대책법, 2025 충북 일위대가`
    });
    return data.content?.map(c => c.type === "text" ? c.text : "").join("") || "";
  } catch (e) { throw e; }
}

function getLocalAnswer(q) {
  if (q.match(/(수정|변경|바꿔|교체|해줘)/) && q.match(/(옹벽|블록|호안|석축|콘크리트|포장|복구)/))
    return `⚠️ 자연어 수정은 AI 서버 연결이 필요합니다.\n\n로컬에서는 명령어를 사용하세요:\n• 수정: 1 공종 역T형옹벽 신설\n• 수정: 2 산출근거 높이3.0m×연장20m=60㎡\n• 추가: 역T형옹벽 60 ㎡\n\n또는 피해현황 테이블에서 직접 셀을 클릭하여 편집하세요.`;
  const DB={"석축":["석축: 자연석/가공석으로 토압·수압 지지하는 중력식 구조물","찰쌓기: 시멘트모르타르 접착 (KDS 51 40 15)","적용: H≤3m 소규모, 경사 1:0.3~1:0.5","기초: 근입≥세굴깊이+0.5m (최소 1.0m)"],"옹벽":["옹벽: 철근콘크리트 토류 구조물","종류: 중력식(H≤3m), 역T형(H=3~8m), 부벽식(H≥8m)","역T형: 전면벽+저판+뒷굽, 전도·활동·지지력 검토","기준: KDS 14 20 72, KDS 11 80 05","석축과 차이: ①H>3m가능 ②구조계산필수 ③내구성우수"],"차이":["석축 vs 옹벽 비교:","①재료: 석축=자연석, 옹벽=RC","②높이: 석축3m이하, 옹벽3~8m","③비용: 소규모→석축, 대규모→옹벽","④시공: 석축=석공, 옹벽=거푸집+타설","⑤기준: 석축=KDS5140, 옹벽=KDS1420","⑥내구성: 옹벽이 장기적 우수","⑦선택: 높이·토압·지반·경제성 종합검토"],"기초":["기초 σck=21MPa (25-210-12)","철근 SD400, HD13@200","근입: 세굴깊이+여유≥1.0m","잡석: T=0.3~0.5m, 부직포하부"],"호안":["호안: 하천 세굴·침식 방지","종류: 석축/블록/돌망태/식생/옹벽호안","수충부: 개선복구→구조물신설+기초보강"],"복구":["자연재해대책법 시행령 제47조","원인복구: 동일규격 복구","개선복구: 구조보강·신설 (수충부/세굴/반복)"],"단가":["2025 충북 일위대가","관급: 3000만원이상→발주처지급","사급: 미만→시공사구매","수수료: 관급×1.5%"],"관급":["■ 관급자재 vs 사급자재 비교:","","【관급자재】발주처(지자체)가 직접 구매하여 시공사에 지급하는 자재","• 판정기준: 단일품목 자재비 3,000만원 이상 또는 발주처 지정품목","• 대표품목: 레미콘, 철근, 석재, 골재, 관류 등 대형 주자재","• 관급수수료: 관급자재비 × 1.5% (보관·하역·소운반 비용)","• 설계내역서: 직접공사비(순공사비)에 미포함, 별도 집계","","【사급자재】시공사가 직접 구매하는 자재","• 판정기준: 단일품목 자재비 3,000만원 미만의 주자재","• 대표품목: 거푸집합판, 부직포, 비닐, 유로폼 등","• 설계내역서: 직접공사비에 미포함, 별도 집계","","【합계 구조】","• 순공사비 = 노무비 + 재료비(순수) + 경비","• 총공사비 = 순공사비 + 사급자재대 + 관급자재대 + 관급수수료","• 기준금액(3,000만원)과 수수료율(1.5%)은 발주처별 상이"],"사급":["사급자재: 시공사가 직접 구매하는 주자재","판정: 단일품목 자재비 3,000만원 미만","대표품목: 거푸집합판, 부직포, 비닐, 유로폼","순공사비에 미포함, 별도 집계 후 총공사비에 합산"],"배수":["배수체계 설계:","유공관(φ100~200mm): 옹벽/석축 배면 배수","맹암거: 지하수 차단·유도","측구(L형/U형): 도로 노면수 배수","집수정: 측구 연결, 우수 집중 배수","부직포: 배수층과 뒤채움 분리(토사유입 방지)"],"포장":["도로포장 복구:","아스팔트: 절삭후덧씌우기(#.326), 기층+표층","콘크리트: T=20cm 포장(#.335,#.336)","보조기층: 쇄석 T=15~20cm 다짐(#.306~308)","프라임코팅+택코팅 필수"]};
  for(const[key,refs] of Object.entries(DB)) if(q.includes(key)) return `📚 **${key}** 관련:\n\n${refs.join("\n")}`;
  return `AI 서버 연결 불가.\n\n키워드: 석축, 옹벽, 차이, 기초, 호안, 복구, 단가\n배포 환경에서는 전문 답변 제공.`;
}

/* ============================================================ MAIN */
export default function App(){
  const[view,setView]=useState("analysis");
  const[damage,setDamage]=useState([]);
  const[items,setItems]=useState([]);
  const[sagub,setSagub]=useState(INIT_SAGUB);
  const[gwangub,setGwangub]=useState(INIT_GWANGUB);
  const[photoUrl,setPhotoUrl]=useState(null);
  const[photoFile,setPhotoFile]=useState(null);
  const[photoModal,setPhotoModal]=useState(false);
  const[analyzing,setAnalyzing]=useState(false);
  const[analyzed,setAnalyzed]=useState(false);
  const[recoveryPlan,setRecoveryPlan]=useState({method:"",steps:[]});
  const[chatLog,setChatLog]=useState([]);
  const[chatInput,setChatInput]=useState("");
  const[xlLoad,setXlLoad]=useState(null);
  const[projName,setProjName]=useState("");
  const[projLoc,setProjLoc]=useState("");
  const fileRef=useRef(null),jsonRef=useRef(null),chatEndRef=useRef(null);

  const handleNewWork=useCallback(()=>{if(!window.confirm("초기화?"))return;_nid=200;setDamage([]);setItems([]);setPhotoUrl(null);setPhotoFile(null);setAnalyzed(false);setRecoveryPlan({method:"",steps:[]});setChatLog([]);setProjName("");setProjLoc("");setView("analysis")},[]);

  const handleAnalyze=useCallback(async()=>{
    if(!photoFile){alert("먼저 사진을 업로드해주세요");return}
    setAnalyzing(true);
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=()=>rej(new Error("읽기실패"));r.readAsDataURL(photoFile)});
      const mt=photoFile.type||"image/jpeg";
      const resp_data=await callAI({model:"claude-sonnet-4-20250514",max_tokens:2000,system:`당신은 30년 경력의 토목직 공무원이자 하천 수해복구 설계 전문가입니다.\n사진을 분석하여 반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.\n\n{"recovery":{"method":"복구방침(피해상황+복구방향 구체적 서술)","steps":["1.토공:...","2.구조물공:...","3.포장공:...","4.부대공:...","5.기타:..."]},"damage":[{"item":"복구공종명(석축찰쌓기,아스콘포장,배수관설치,사면녹화 등)","basis":"수량산출근거(폭×높이×길이=수량)","qty":숫자,"unit":"㎡/㎥/m"}],"designItems":[{"cat":"1./2./3./4.","name":"공종명","spec":"규격","unit":"m²등","qty":숫자,"priceId":"#.번호"}]}\n\n분석원칙 (소규모주민숙원사업 = 개량설계):\n- 이 사업은 단순 하자보수가 아닌 【개량공법에 의한 전면적 개선설계】입니다\n- 사진의 표면적 증상(균열,파손)뿐 아니라 근본 원인(구조적 결함,설계미비,배수불량,기초부실 등)을 분석하세요\n- 기존 구조물의 문제점을 완전히 해결하는 개선방향을 제시하세요\n- 예: 단순 균열보수(X) → 구조물 전면 철거 후 개량 공법으로 재시공(O)\n- 예: 석축 부분보수(X) → RC옹벽 또는 보강토옹벽으로 공법 변경(O)\n- 예: 포장 패칭(X) → 기층부터 전면 재포장(O)\n- 구조적 취약점→무조건 개선복구, 기초근입D≥1.0m\n- 배수체계 개선(유공관,맹암거,측구 등) 반드시 포함 검토\n- 안전시설(가드레일,낙석방지망 등) 추가 설치 검토\n- 피해물량은 사진에서 추정가능한 치수로 산출하되, 개량설계 관점에서 충분한 물량 확보\n- priceId: #.22표토제거,#.28흙깍기,#.57구조물터파기,#.68뒤채움,#.70되메우기,#.77기초지정잡석,#.87사면녹화,#.127사토운반,#.155석축쌓기,#.193레미콘타설,#.204합판거푸집,#.216철근가공,#.276콘크리트양생,#.280부직포,#.281비닐,#.282물푸기,#.326아스팔트덧씌우기,#.481교통통제\n- 사진에 해당하지 않는 공종은 포함하지 마세요`,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mt,data:base64}},{type:"text",text:"이 현장 사진을 분석하여 복구설계(복구공종명+물량)를 JSON으로 응답해주세요. item은 피해내용이 아닌 복구공종명(석축찰쌓기, 아스콘포장, 배수관설치, RC옹벽신설, 사면녹화 등)으로 작성하세요."}]}]});
      const text=resp_data.content?.map(c=>c.type==="text"?c.text:"").join("")||"";
      const jsonMatch=text.match(/\{[\s\S]*\}/);
      if(!jsonMatch)throw new Error("JSON파싱실패");
      const result=JSON.parse(jsonMatch[0]);
      if(result.recovery)setRecoveryPlan({method:result.recovery.method||"",steps:result.recovery.steps||[]});
      if(result.damage?.length>0)setDamage(result.damage.map((d,i)=>({id:i+1,item:d.item,basis:d.basis,qty:d.qty,unit:d.unit,enabled:true})));
      if(result.designItems?.length>0){_nid=200;setItems(result.designItems.map((d,i)=>({id:i+1,cat:d.cat||"4.",name:d.name,spec:d.spec||"",unit:d.unit||"m²",qty:d.qty||0,priceId:d.priceId||"",labor:0,material:0,expense:0,enabled:true})))}
      setAnalyzed(true);
    }catch(e){
      console.error("AI분석오류:",e);
      setDamage(INIT_DAMAGE());_nid=200;setItems(INIT_ITEMS());
      setRecoveryPlan({method:"(API 연결 실패 — 기본 시나리오) 기존 구조물의 구조적 결함(기초 부실, 배수 미비, 설계 미흡)을 근본적으로 해결하기 위해 기존 구조물을 전면 철거하고, 개량 공법(RC 기초 근입 D≥1.0m, 찰쌓기 석축 신설, 배수체계 개선)으로 전면 재시공하는 개선설계를 시행한다.",steps:["1.토공: 기존 구조물 전면 철거, 터파기(근입D≥1.0m), 양질토 뒤채움·다짐","2.구조물공: 잡석기초→RC기초(25-210-12)→개량 구조물 신설→거푸집·철근·양생","3.포장공: 기존 포장 전면 철거→기층부터 재포장(보조기층+표층)","4.배수공: 배수체계 전면 개선(유공관, 측구, 집수정 신설)","5.부대공: 안전시설(가드레일,표지판), 부직포·비닐, 교통통제","6.사면공: 사면 정리 후 녹화(T=10cm) 또는 보강토 시공"]});
      setAnalyzed(true);
      alert("AI 서버 연결 실패 → 기본 데이터로 대체.\n배포 환경에서는 실제 사진 분석이 수행됩니다.");
    }finally{setAnalyzing(false)}
  },[photoFile]);

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
  const t1=calcCat("1."),t2=calcCat("2."),t3=calcCat("3."),t4=calcCat("4."),t5=calcCat("5."),t6=calcCat("6.");
  const sunG=t1.g+t2.g+t3.g+t4.g+t5.g+t6.g,sunI=t1.i+t2.i+t3.i+t4.i+t5.i+t6.i,sunK=t1.k+t2.k+t3.k+t4.k+t5.k+t6.k,sunM=t1.m+t2.m+t3.m+t4.m+t5.m+t6.m;
  const sT=sagub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gTot=gwangub.reduce((s,i)=>s+Math.round(i.qty*i.unitPrice),0);
  const gF=Math.round(gTot*FEE_RATE),grand=sunG+sT+gTot+gF;

  /* ★ 수정.질문 — 모든 입력을 AI가 해석 (명령+질문 통합) */
  const handleChatSend=useCallback(async()=>{
    if(!chatInput.trim()) return;
    const msg=chatInput.trim();
    setChatLog(p=>[...p,{role:"user",text:msg}]);
    setChatInput("");
    setChatLog(p=>[...p,{role:"ai",text:"⏳ AI 처리 중..."}]);

    try {
      // 현재 피해현황 데이터를 컨텍스트로 전달
      const currentDamage = damage.filter(d=>d.enabled).map((d,i)=>`${i+1}. ${d.item} (${d.qty}${d.unit}) - ${d.basis}`).join("\n");

      const resp_raw = await callAI({
          model:"claude-sonnet-4-20250514", max_tokens:1500,
          system: `당신은 30년 경력의 토목직 공무원이자 수해복구 설계 전문가입니다.

사용자가 피해현황 수정을 요청하면 반드시 아래 JSON을 응답 맨 앞에 포함하고, 그 뒤에 설명을 추가하세요:
<!--DAMAGE_UPDATE-->
{"damage":[{"item":"복구공종명(석축찰쌓기,아스콘포장 등)","basis":"산출근거(폭×높이×길이=수량)","qty":숫자,"unit":"단위"}]}
<!--/DAMAGE_UPDATE-->

사용자가 질문만 하면 JSON 없이 전문적으로 답변하세요.

현재 피해현황:
${currentDamage || "(없음)"}

주요 단가ID: #.22표토제거,#.28흙깍기,#.57구조물터파기,#.68뒤채움,#.77기초지정잡석,#.155석축쌓기,#.193레미콘타설,#.204합판거푸집,#.216철근가공,#.276콘크리트양생,#.280부직포,#.326아스팔트덧씌우기,#.481교통통제
답변은 한국어로, 실무적이고 구체적으로 하세요.`,
          messages:[{role:"user",content:msg}]
      });

      const data = resp_raw;
      let text = data.content?.map(c=>c.type==="text"?c.text:"").join("")||"";

      // 데이터 변경 JSON이 포함되어 있는지 확인
      const dmgMatch = text.match(/<!--DAMAGE_UPDATE-->\s*(\{[\s\S]*?\})\s*<!--\/DAMAGE_UPDATE-->/);
      if(dmgMatch){
        try{
          const upd = JSON.parse(dmgMatch[1]);
          if(upd.damage?.length>0){
            setDamage(upd.damage.map((d,i)=>({id:Date.now()+i, item:d.item, basis:d.basis, qty:d.qty, unit:d.unit, enabled:true})));
          }
          // 설계물량도 업데이트하면 반영
          if(upd.designItems?.length>0){
            _nid=200;
            setItems(upd.designItems.map((d,i)=>({id:i+1,cat:d.cat||"4.",name:d.name,spec:d.spec||"",unit:d.unit||"m²",qty:d.qty||0,priceId:d.priceId||"",labor:0,material:0,expense:0,enabled:true})));
          }
          if(upd.recovery){
            setRecoveryPlan({method:upd.recovery.method||recoveryPlan.method,steps:upd.recovery.steps||recoveryPlan.steps});
          }
        }catch(je){console.error("JSON파싱오류",je)}
        // JSON 태그 제거하여 설명만 표시
        text = text.replace(/<!--DAMAGE_UPDATE-->[\s\S]*?<!--\/DAMAGE_UPDATE-->/,"").trim();
        text = "✅ 피해현황이 수정되었습니다.\n\n" + text;
      }

      setChatLog(p=>p.map(m=>m.text==="⏳ AI 처리 중..."?{...m,text:text||"처리 완료"}:m));
    } catch(e) {
      // API 실패 시 로컬 명령어 파싱 폴백
      let reply = "";
      const addMatch=msg.match(/추가[:：]?\s*(.+?)\s+(\d+\.?\d*)\s*(m²|m³|m|hr|ton|일|식|㎡|㎥)?/);
      const delMatch=msg.match(/삭제[:：]?\s*(\d+)/);
      const modMatch=msg.match(/수정[:：]?\s*(\d+)\s*(수량|공종|산출근거|단위)\s+(.+)/);

      if(addMatch){
        setDamage(p=>[...p,{id:Date.now(),item:addMatch[1],basis:"사용자 추가",qty:Number(addMatch[2]),unit:addMatch[3]||"식",enabled:true}]);
        reply=`✅ "${addMatch[1]}" 추가 완료`;
      } else if(delMatch){
        const no=Number(delMatch[1]);
        setDamage(p=>{const en=p.filter(d=>d.enabled);if(no>=1&&no<=en.length)return p.filter(d=>d.id!==en[no-1].id);return p});
        reply=`✅ ${no}번 삭제 완료`;
      } else if(modMatch){
        const no=Number(modMatch[1]),fMap={"수량":"qty","공종":"item","산출근거":"basis","단위":"unit"},f=fMap[modMatch[2]];
        setDamage(p=>{const en=p.filter(d=>d.enabled);if(no>=1&&no<=en.length){const tid=en[no-1].id;return p.map(d=>d.id===tid?{...d,[f]:f==="qty"?(Number(modMatch[3])||0):modMatch[3]}:d)}return p});
        reply=`✅ ${no}번 ${modMatch[2]} 수정 완료`;
      } else {
        reply = getLocalAnswer(msg);
      }
      setChatLog(p=>p.map(m=>m.text==="⏳ AI 처리 중..."?{...m,text:reply}:m));
    }
    chatEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[chatInput,damage,recoveryPlan]);

  /* ★ 설계내역서 작성 — 피해현황 기반 설계물량 동적 생성 */
  const handleBuildEstimate=useCallback(()=>{
    const enabledDmg=damage.filter(d=>d.enabled);
    if(enabledDmg.length===0){alert("피해현황에 항목이 없습니다");return}

    // ── Step 1: 피해현황 분류 ──
    const structItems=[],paveItems=[],slopeItems=[],drainItems=[],etcItems=[];
    const hoanItems=[];
    enabledDmg.forEach(d=>{
      if(d.item.match(/호안|돌붙임|전석|블록.*붙/i)) hoanItems.push(d);
      else if(d.item.match(/석축|옹벽|RC|역.*T|콘크리트.*벽|기초|구조물/i)) structItems.push(d);
      else if(d.item.match(/포장|도로|아스팔트|아스콘/)) paveItems.push(d);
      else if(d.item.match(/사면|녹화|법면/)) slopeItems.push(d);
      else if(d.item.match(/측구|배수|수로|산마루|플륨|흄관|관로|관부설|유공|암거|맹암거|드레인/)) drainItems.push(d);
      else etcItems.push(d);
    });
    const allStructQty=structItems.reduce((s,d)=>s+d.qty,0);

    // ── Step 2: 소분류별 세부물량 산출 (수량산출서용 basis 포함) ──
    // {priceId, cat, name, spec, unit, qty, basis} 형태로 수집 후 합산
    const raw=[];  // 개별 물량 (합산 전)
    const push=(cat,name,spec,unit,qty,priceId,basis)=>{if(qty>0)raw.push({cat,name,spec,unit,qty:Math.round(qty*10)/10,priceId,basis})};

    // 1. 토공 (공통)
    if(allStructQty>0){
      const digQty=etcItems.find(d=>d.item.match(/굴착|토사|사토/))?.qty||Math.round(allStructQty*0.6);
      push("1.","표토제거","T=20CM, 굴삭기0.7㎥","m²",Math.round(digQty*0.4)||10,"#.22",`표토제거: 구조물 부지 T=0.2m, 면적=${Math.round(digQty*0.4)}㎡`);
      push("1.","흙깍기","보통토사,소규모,굴착기1.0㎥","m³",Math.round(digQty*0.3)||10,"#.28",`흙깍기: 부지정리 토사 굴착량=${Math.round(digQty*0.3)}㎥`);
      const satoQty=etcItems.find(d=>d.item.match(/사토/))?.qty||Math.round(allStructQty*1.2);
      push("1.","사토운반","토사,L=5.0KM","m³",satoQty,"#.127",`사토운반: 터파기+굴착 잔토 반출=${satoQty}㎥, L=5.0km`);
    }

    // 2. 구조물공 — 시설기준 경사율 반영 산출
    const parseDim=(basis)=>{const hm=basis?.match(/높이\s*(\d+\.?\d*)\s*m/);const lm=basis?.match(/연장\s*(\d+\.?\d*)\s*m/)||basis?.match(/길이\s*(\d+\.?\d*)\s*m/);return{H:hm?Number(hm[1]):0,L:lm?Number(lm[1]):0}};
    let sNo=0;
    structItems.forEach(d=>{
      sNo++;
      const label=d.item;
      const dim=parseDim(d.basis);
      if(d.item.match(/석축/)){
        // 찰쌓기 석축: 전면경사 1:0.3 (KDS 51 40 15)
        const A=d.qty;
        const H=dim.H||(Math.round(Math.sqrt(A/5))||3);
        const L=dim.L||(Math.round(A/H)||20);
        const slope=0.3;
        const Ttop=0.35;
        const Tbot=+(Ttop+H*slope).toFixed(2);
        const Tavg=+((Ttop+Tbot)/2).toFixed(2);
        const foundD=1.0;
        const foundW=+(Tbot+0.3).toFixed(1);
        const digW=+(foundW+0.5).toFixed(1);
        const digV=+(digW*(foundD+0.3)*L).toFixed(0);
        const japV=+(foundW*0.3*L).toFixed(1);
        const backV=+(0.3*H*L).toFixed(0);
        push("2.","구조물터파기","육상토사,기계100%","m³",+digV,"#.57",`${label}: 폭${digW}m×깊이${(foundD+0.3).toFixed(1)}m×길이${L}m=${digV}㎥`);
        push("2.","기초지정","잡석","m³",+japV,"#.77",`${label}: 폭${foundW}m×두께0.3m×길이${L}m=${japV}㎥`);
        push("2.","석축쌓기","찰쌓기,T=35cm이하","m²",A,"#.155",`${label}: 전면경사1:${slope}, H=${H}m×L=${L}m=${A}㎡ (상부T=${Ttop}m→하부T=${Tbot}m, 평균T=${Tavg}m)`);
        push("2.","콘크리트양생","습윤양생","m²",A,"#.276",`${label}: 표면적 H=${H}m×L=${L}m=${A}㎡`);
        push("1.","뒤채움 및 다짐","소형장비","m³",+backV,"#.68",`${label}: 배면 0.3m×H${H}m×L${L}m=${backV}㎥`);
      }
      else if(d.item.match(/옹벽|RC.*벽|역.*T/i)){
        // 역T형 옹벽: KDS 14 20 72 표준단면 비율
        const isVol=d.unit.includes("³");
        const inputA=isVol?Math.round(d.qty*6.5):d.qty;
        const H=dim.H||(Math.round(Math.sqrt(inputA/5))||3);
        const L=dim.L||(Math.round(inputA/H)||20);
        const wallTtop=0.20;
        const wallTbot=+(0.15+H*0.04).toFixed(2);
        const footB=+(H*0.5).toFixed(1);
        const footT=+(0.15+H*0.03).toFixed(2);
        const heelL=+(footB-wallTbot-0.1).toFixed(2);
        const wallArea=+((wallTtop+wallTbot)/2*(H-footT)).toFixed(3);
        const footArea=+(footB*footT).toFixed(3);
        const secArea=+(wallArea+footArea).toFixed(3);
        const conVol=+(secArea*L).toFixed(1);
        const formA=+((H+H+footT*2)*L).toFixed(0);
        const steelT=+(conVol*0.1).toFixed(1);
        const digW=+(footB+0.6).toFixed(1);
        const digD=+(footT+1.0).toFixed(1);
        const digV=+(digW*digD*L).toFixed(0);
        const japV=+(footB*0.2*L).toFixed(1);
        const backV=+(heelL*(H-footT)*0.5*L).toFixed(0);
        push("2.","구조물터파기","육상토사,기계100%","m³",+digV,"#.57",`${label}: 폭${digW}m(저판${footB}+여유0.6)×깊이${digD}m(저판${footT}+근입1.0)×L${L}m=${digV}㎥`);
        push("2.","기초지정","잡석","m³",+japV,"#.77",`${label}: 저판폭${footB}m×T0.2m×L${L}m=${japV}㎥`);
        push("2.","레미콘타설(펌프차)","철근(S:8-12cm),TYPE-Ⅱ","m³",+conVol,"#.193",`${label}: 벽체(상${wallTtop}+하${wallTbot})÷2×H${(H-footT).toFixed(1)}+저판${footB}×${footT}⇒단면${secArea}㎡×L${L}m=${conVol}㎥`);
        push("2.","합판거푸집","(4회) 보통","m²",formA,"#.204",`${label}: (전면H${H}+배면H${H}+저판단면${footT}×2)×L${L}m=${formA}㎡`);
        push("2.","철근가공 및 조립","TYPE-1-1","ton",+steelT||0.5,"#.216",`${label}: Con'c${conVol}㎥×100kg/㎥=${steelT}ton`);
        push("2.","콘크리트양생","습윤양생","m²",formA,"#.276",`${label}: 양생면적=${formA}㎡`);
        push("1.","뒤채움 및 다짐","소형장비","m³",+backV||15,"#.68",`${label}: 뒷굽${heelL}m×벽높${(H-footT).toFixed(1)}m×0.5(삼각)×L${L}m=${backV}㎥`);
      }
      else {
        const H2=3, L2=Math.round(d.qty/H2)||10;
        push("2.","구조물터파기","육상토사,기계100%","m³",Math.round(d.qty*0.5)||10,"#.57",`${label}: 폭1.0m×깊이0.5m×L${L2}m=${Math.round(d.qty*0.5)}㎥`);
        push("2.","레미콘타설(펌프차)","철근(S:8-12cm),TYPE-Ⅱ","m³",d.qty,"#.193",`${label}: ${d.qty}㎥`);
        push("2.","콘크리트양생","습윤양생","m²",d.qty,"#.276",`${label}: 표면적=${d.qty}㎡`);
      }
    });

    // 3. 배수공 — 맥락 감지: 공종명+규격+산출근거에서 종류 자동 판별
    drainItems.forEach(d=>{
      const L=d.qty, label=d.item;
      const ctx=(d.item+"|"+d.basis+"|"+(d.spec||"")).toLowerCase();  // 전체 맥락 문자열

      // ── 흄관/원형관 감지 ──
      if(ctx.match(/흄관|원형관|vr관|원심력|진동전압|배수관.*mm|관부설|pipe/)){
        const dia=ctx.match(/(\d{3,4})\s*mm/)?Number(ctx.match(/(\d{3,4})\s*mm/)[1]):ctx.match(/φ(\d+)/)?Number(ctx.match(/φ(\d+)/)[1]):600;
        const pId=dia>=1000?"#.105":dia>=800?"#.103":dia>=600?"#.102":dia>=450?"#.101":"#.100";
        const digW=+(dia/1000+0.6).toFixed(1);  // 터파기폭=관경+여유
        const digD=+(dia/1000+0.4).toFixed(1);  // 터파기깊이=관경+기초+여유
        const digV=Math.round(digW*digD*L)||10;
        push("3.","구조물터파기","육상토사,기계100%","m³",digV,"#.57",`${label}: 폭${digW}m×깊이${digD}m×길이${L}m=${digV}㎥`);
        push("3.","기초지정","잡석","m³",+(digW*0.15*L).toFixed(1),"#.77",`${label}: 폭${digW}m×두께0.15m×길이${L}m`);
        push("3.",`흄관부설(φ${dia}mm)`,"고무링접합","m",L,pId,`${label}: φ${dia}mm×길이${L}m`);
        push("3.","뒤채움 및 다짐","소형장비","m³",Math.round(digV*0.6)||5,"#.68",`${label}: 관 주변 뒤채움`);
        push("1.","되메우기 및 다짐","소형장비","m³",Math.round(digV*0.3)||3,"#.70",`${label}: 잔여 되메우기`);
      }
      // ── 암거/BOX 감지 ──
      else if(ctx.match(/암거|box|박스|맹암거/)){
        const bw=ctx.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/);
        const boxW=bw?Number(bw[1]):0.6, boxH=bw?Number(bw[2]):0.6;
        const digW=+(boxW+0.8).toFixed(1), digD=+(boxH+0.5).toFixed(1);
        const digV=Math.round(digW*digD*L)||10;
        const conV=+((boxW+0.2)*(boxH+0.2)-boxW*boxH)*L.toFixed(1)||Math.round(L*0.15);
        const formA=Math.round((boxH*2+boxW)*L);
        push("3.","구조물터파기","육상토사,기계100%","m³",digV,"#.57",`${label}: 폭${digW}m×깊이${digD}m×길이${L}m=${digV}㎥`);
        push("3.","기초지정","잡석","m³",+(digW*0.15*L).toFixed(1),"#.77",`${label}: 폭${digW}m×두께0.15m×길이${L}m`);
        push("3.","레미콘타설(펌프차)","무근(S:8-12cm),TYPE-Ⅱ","m³",conV,"#.185",`${label}: 암거 단면적×길이${L}m=${conV}㎥`);
        push("3.","합판거푸집","(4회) 보통","m²",formA,"#.204",`${label}: (양벽${boxH}m×2+바닥${boxW}m)×길이${L}m=${formA}㎡`);
        push("3.","콘크리트양생","습윤양생","m²",formA,"#.276",`${label}: 양생면적=${formA}㎡`);
        push("3.","뒤채움 및 다짐","소형장비","m³",Math.round(digV*0.4)||5,"#.68",`${label}: 암거 주변 뒤채움`);
      }
      // ── 유공관 감지 ──
      else if(ctx.match(/유공관|유공|드레인/)){
        const dia2=ctx.match(/(\d+)\s*mm/)?Number(ctx.match(/(\d+)\s*mm/)[1]):100;
        push("3.","구조물터파기","육상토사,기계100%","m³",Math.round(L*0.4*0.5)||3,"#.57",`${label}: 폭0.4m×깊이0.5m×길이${L}m`);
        push("3.",`유공관설치(φ${dia2}mm)`,`PVC φ${dia2}mm`,"m",L,"",`${label}: φ${dia2}mm×${L}m`);
        push("3.","뒤채움 및 다짐","소형장비","m³",Math.round(L*0.2)||2,"#.68",`${label}: 쇄석 뒤채움`);
      }
      // ── 측구/산마루측구/L형측구 감지 ──
      else if(ctx.match(/측구|수로|산마루/)){
        const W=0.4, Hc=0.4, T=0.1;
        const digV=Math.round((W+0.4)*0.6*L*10)/10;
        const japV=Math.round(W*T*L*10)/10;
        const conV=Math.round(((W+T*2)*Hc-(W*W))*L*100)/100||Math.round(L*0.04*10)/10;
        const formA=Math.round((Hc*2+W)*L*10)/10;
        const backV=Math.round(0.2*Hc*L*10)/10;
        push("3.","구조물터파기","육상토사,기계100%","m³",digV,"#.57",`${label}: 폭${(W+0.4).toFixed(1)}m×깊이0.6m×길이${L}m=${digV}㎥`);
        push("3.","기초지정","잡석","m³",japV,"#.77",`${label}: 폭${W}m×두께${T}m×길이${L}m=${japV}㎥`);
        push("3.","레미콘타설(펌프차)","무근(S:8-12cm),TYPE-Ⅱ","m³",conV,"#.185",`${label}: 단면적(벽2+바닥)×길이${L}m=${conV}㎥`);
        push("3.","합판거푸집","(4회) 보통","m²",formA,"#.204",`${label}: (양벽${Hc}m×2+바닥${W}m)×길이${L}m=${formA}㎡`);
        push("3.","콘크리트양생","습윤양생","m²",formA,"#.276",`${label}: 양생면적=${formA}㎡`);
        push("3.","뒤채움 및 다짐","소형장비","m³",backV,"#.68",`${label}: 배면 0.2m×${Hc}m×${L}m=${backV}㎥`);
      }
      // ── 기타 배수공 (미분류) ──
      else {
        push("3.","구조물터파기","육상토사,기계100%","m³",Math.round(L*0.5)||5,"#.57",`${label}: 터파기`);
        push("3.","레미콘타설(펌프차)","무근(S:8-12cm),TYPE-Ⅱ","m³",Math.round(L*0.1)||2,"#.185",`${label}: 콘크리트`);
        push("3.",d.item,"","m",L,"",`${label}: ${L}m`);
        push("3.","뒤채움 및 다짐","소형장비","m³",Math.round(L*0.3)||3,"#.68",`${label}: 뒤채움`);
      }
    });

    // 4. 호안공 — 호안블록, 돌붙임, 전석 등
    hoanItems.forEach(d=>{
      const A=d.qty, label=d.item;
      const dim2=parseDim(d.basis);
      const H=dim2.H||2, L=dim2.L||(Math.round(A/H)||20);
      if(d.item.match(/블록/)){
        push("4.","구조물터파기","육상토사,기계100%","m³",Math.round(L*1.5*0.5)||10,"#.57",`${label}: 폭1.5m×깊이0.5m×길이${L}m`);
        push("4.","기초지정","잡석","m³",Math.round(L*1.0*0.2*10)/10||3,"#.77",`${label}: 폭1.0m×두께0.2m×길이${L}m`);
        push("4.","호안블럭붙이기","1.0x1.0(기계)","m²",A,"#.163",`${label}: 높이${H}m×길이${L}m=${A}㎡`);
        push("4.","부직포설치","","m²",A,"#.280",`${label}: 호안 배면 부직포=${A}㎡`);
        push("1.","뒤채움 및 다짐","소형장비","m³",Math.round(A*0.3)||10,"#.68",`${label}: 배면 뒤채움`);
      } else if(d.item.match(/돌붙임/)){
        push("4.","돌붙임","찰붙임,T=35cm이하","m²",A,"#.149",`${label}: ${A}㎡`);
        push("4.","부직포설치","","m²",A,"#.280",`${label}: 배면=${A}㎡`);
      } else if(d.item.match(/전석/)){
        push("4.","전석쌓기","","m²",A,"#.158",`${label}: ${A}㎡`);
        push("4.","부직포설치","","m²",A,"#.280",`${label}: 배면=${A}㎡`);
      } else {
        // 기타 호안공
        push("4.","구조물터파기","육상토사,기계100%","m³",Math.round(A*0.3)||5,"#.57",`${label}: 터파기`);
        push("4.","레미콘타설(펌프차)","무근(S:8-12cm),TYPE-Ⅱ","m³",Math.round(A*0.1)||3,"#.185",`${label}: 기초콘크리트`);
        push("4.",d.item,"","m²",A,"",`${label}: ${A}㎡`);
        push("4.","부직포설치","","m²",A,"#.280",`${label}: 배면=${A}㎡`);
        push("1.","뒤채움 및 다짐","소형장비","m³",Math.round(A*0.2)||5,"#.68",`${label}: 배면`);
      }
    });

    // allStructQty에 호안물량 추가
    const hoQty=hoanItems.reduce((s,d)=>s+d.qty,0);

    // 되메우기 (공통)
    if(allStructQty+hoQty>0) push("1.","되메우기 및 다짐","소형장비","m³",Math.round((allStructQty+hoQty)*0.2)||10,"#.70",`되메우기: 잔여공간 되메우기 및 다짐=${Math.round(allStructQty*0.2)}㎥`);

    // 5. 포장공 — 기층/표층 세부 공종 반영
    paveItems.forEach(d=>{
      const A=d.qty, label=d.item, ob=d.basis||"";
      if(d.item.match(/기층/)){
        const japV=+(A*0.1).toFixed(1);
        push("5.","보조기층포설및다짐","기계시공-본선포장","m³",japV,"#.308",`${label}(${ob}): 보조기층 면적${A}㎡×T=0.1m=${japV}㎥`);
        push("5.","프라임코팅","RS(C)-3,기계","m²",A,"#.310",`${label}(${ob}): 기층하부 프라임코팅 면적=${A}㎡`);
        push("5.","기층아스콘포설및다짐","소형장비(5-7cm)","m²",A,"#.314",`${label}(${ob}): 기층아스콘 T=5~7cm, 면적=${A}㎡`);
      }
      else if(d.item.match(/표층/)){
        push("5.","택코팅","RS(C)-4,기계","m²",A,"#.312",`${label}(${ob}): 표층하부 택코팅 면적=${A}㎡`);
        push("5.","표층아스콘포설및다짐","소형장비","m²",A,"#.321",`${label}(${ob}): 표층아스콘 T=5cm, 면적=${A}㎡`);
      }
      else if(d.item.match(/절삭|덧씌/)){
        push("5.","절삭후아스팔트덧씌우기","B-Type(1회절삭,1회포장)","m²",A,"#.326",`${label}(${ob}): 절삭+덧씌우기 면적=${A}㎡`);
      }
      else {
        const japV=+(A*0.15).toFixed(1);
        push("5.","보조기층포설및다짐","기계시공-본선포장","m³",japV,"#.308",`${label}(${ob}): 보조기층 면적${A}㎡×T=0.15m=${japV}㎥`);
        push("5.","프라임코팅","RS(C)-3,기계","m²",A,"#.310",`${label}(${ob}): 기층하부 프라임코팅=${A}㎡`);
        push("5.","기층아스콘포설및다짐","소형장비(5-7cm)","m²",A,"#.314",`${label}(${ob}): 기층아스콘 T=5~7cm=${A}㎡`);
        push("5.","택코팅","RS(C)-4,기계","m²",A,"#.312",`${label}(${ob}): 표층하부 택코팅=${A}㎡`);
        push("5.","표층아스콘포설및다짐","소형장비","m²",A,"#.321",`${label}(${ob}): 표층아스콘 T=5cm=${A}㎡`);
      }
    });

    // 사면
    slopeItems.forEach(d=>{
      push("1.","절토사면 녹화","T=10㎝","m²",d.qty,"#.87",`${d.item}(${d.basis||""}): 사면녹화 T=10cm, 면적=${d.qty}㎡`);
    });

    // 4. 부대공 — 소분류별 근거 상세
    const bStructNames=structItems.map(d=>`${d.item}${d.qty}${d.unit}`).join("+");
    const bDrainNames=drainItems.map(d=>`${d.item}${d.qty}${d.unit}`).join("+");
    const bHoanNames=hoanItems.map(d=>`${d.item}${d.qty}${d.unit}`).join("+");
    const bArea=allStructQty+drainItems.reduce((s,d)=>s+d.qty,0)+hoQty;
    if(bArea>0){
      push("6.","부직포설치","","m²",Math.round(bArea*1.0)||30,"#.280",`부직포: 구조물하부+배면 [${bStructNames}${bDrainNames?"+"+bDrainNames:""}]=${Math.round(bArea)}㎡`);
      push("6.","비닐깔기","","m²",Math.round(bArea*0.4)||15,"#.281",`비닐: 기초하부 방습 [${bStructNames}]×0.4=${Math.round(bArea*0.4)}㎡`);
    }
    if(allStructQty>0||paveItems.length>0){
      push("6.","물푸기","","hr",24,"#.282","물푸기: 공사기간 중 지하수 배수 24hr (1일×24시간)");
      push("6.","교통통제및안전처리","500M미만","일",5,"#.481","교통통제: 공사기간 5일×1식/일 (도로 인접 공사)");
    }
    etcItems.filter(d=>d.item.match(/낙석/)).forEach(d=>{
      push("6.","낙석방지망","철망설치(기계식)","m²",d.qty,"#.453",`${d.item}: ${d.qty}㎡`);
    });
    etcItems.filter(d=>!d.item.match(/굴착|사토|토사|잔해|낙석/)).forEach(d=>{
      push("6.",d.item,"피해현황 직접반영",d.unit,d.qty,"",d.basis||"");
    });

    // ── Step 3: 동일 공종(cat+priceId) 합산 → 내역서용 items 생성 ──
    // cat별로 분리하여 합산 (같은 priceId라도 다른 대분류면 별도 행)
    const merged=new Map();
    raw.forEach(r=>{
      const key=r.priceId?`${r.cat}_${r.priceId}`:`${r.cat}_${r.name}`;
      if(merged.has(key)){
        const m=merged.get(key);
        m.qty=Math.round((m.qty+r.qty)*10)/10;
        m.basis+=`\n${r.basis}`;
      } else {
        merged.set(key,{...r});
      }
    });

    let id=1;
    const newItems=[...merged.values()].map(r=>({
      id:id++, cat:r.cat, name:r.name, spec:r.spec, unit:r.unit,
      qty:r.qty, priceId:r.priceId, basis:r.basis,
      labor:0, material:0, expense:0, enabled:true
    }));

    _nid=id+200;
    setItems(newItems);

    // ══════════════════════════════════════════════════════════
    // 사급/관급 자재 동적 재계산 — 공종별 자재 분리 체계
    // ══════════════════════════════════════════════════════════
    // [자재매핑 테이블] 공종키워드 → 자재명, 규격, 단위, 단가, 수량비율, 구분(사급/관급)
    const MAT_MAP=[
      // 구조물 자재
      {kw:"거푸집",     matName:"합판거푸집(자재)",spec:"합판,유로폼",    unit:"m²", price:12000, ratio:1.0, type:"사급"},
      {kw:"부직포",     matName:"부직포(자재)",    spec:"부직포 원단",   unit:"m²", price:1500,  ratio:1.0, type:"사급"},
      {kw:"비닐",       matName:"비닐(자재)",      spec:"PE필름 0.1mm", unit:"m²", price:500,   ratio:1.0, type:"사급"},
      {kw:"레미콘타설", matName:"레미콘",          spec:"25-210-12",    unit:"m³", price:75000, ratio:1.0, type:"관급"},
      {kw:"철근",       matName:"이형철근(SD400)", spec:"HD13",         unit:"ton",price:950000,ratio:1.0, type:"관급"},
      {kw:"석축",       matName:"석재",            spec:"자연석",       unit:"m²", price:45000, ratio:1.0, type:"관급"},
      {kw:"기초지정",   matName:"잡석",            spec:"25-40mm",      unit:"m³", price:22000, ratio:1.0, type:"관급"},
      // 배수 자재
      {kw:"흄관",       matName:"흄관(자재)",      spec:"진동전압관",   unit:"m",  price:0,     ratio:1.0, type:"사급", diaPrice:true},
      // 포장 자재
      {kw:"기층아스콘", matName:"아스콘(기층)",    spec:"AP-5, WC-2",   unit:"m²", price:3500,  ratio:1.0, type:"관급"},
      {kw:"표층아스콘", matName:"아스콘(표층)",    spec:"AP-5, WC-1",   unit:"m²", price:3800,  ratio:1.0, type:"관급"},
      {kw:"보조기층",   matName:"쇄석(보조기층)",  spec:"40mm",         unit:"m³", price:18000, ratio:1.0, type:"사급"},
      // 안전시설 자재
      {kw:"호안블럭",   matName:"호안블록(자재)", spec:"1.0×1.0m 블록",unit:"m²", price:15000, ratio:1.0, type:"사급"},
  {kw:"돌붙임",     matName:"석재(돌붙임)",   spec:"자연석",       unit:"m²", price:40000, ratio:1.0, type:"관급"},
  {kw:"전석",       matName:"전석(자재)",     spec:"자연석",       unit:"m²", price:35000, ratio:1.0, type:"관급"},
  {kw:"가드레일",   matName:"가드레일(자재)",  spec:"빔+지주 세트", unit:"m",  price:85000, ratio:1.0, type:"사급"},
      {kw:"낙석방지망", matName:"낙석방지망(자재)",spec:"철망",         unit:"m²", price:8000,  ratio:1.0, type:"사급"},
      {kw:"낙석방지책", matName:"낙석방지책(자재)",spec:"와이어로프+네트",unit:"경간",price:500000,ratio:1.0,type:"관급"},
    ];

    const newSagub=[], newGwangub=[];
    let sid=101, gid=201;

    MAT_MAP.forEach(mat=>{
      const matched=newItems.filter(i=>i.name?.includes(mat.kw));
      if(!matched.length) return;
      const totalQty=matched.reduce((s,i)=>s+i.qty,0);
      if(totalQty<=0) return;

      // 흄관은 관경별 단가 적용
      if(mat.diaPrice){
        matched.forEach(h=>{
          const dia=h.name?.match(/(\d+)/)?Number(h.name.match(/(\d+)/)[1]):600;
          const uPrice=dia>=1000?180000:dia>=800?130000:dia>=600?85000:dia>=450?55000:35000;
          const entry={id:0,name:`${mat.matName} φ${dia}mm`,spec:`${mat.spec} D=${dia}mm`,unit:mat.unit,qty:h.qty,unitPrice:uPrice,source:"관 제조업체"};
          if(mat.type==="사급"){entry.id=sid++;newSagub.push(entry)}
          else{entry.id=gid++;entry.sub="6.4";newGwangub.push(entry)}
        });
        return;
      }

      const qty=Math.round(totalQty*mat.ratio*10)/10;
      const entry={id:0,name:mat.matName,spec:mat.spec,unit:mat.unit,qty,unitPrice:mat.price,source:"2025 물가정보"};
      if(mat.type==="사급"){entry.id=sid++;newSagub.push(entry)}
      else{entry.id=gid++;entry.sub=mat.kw.includes("레미콘")?"6.1":mat.kw.includes("철근")?"6.2":"6.3";newGwangub.push(entry)}
    });

    setSagub(newSagub.length>0?newSagub:INIT_SAGUB());
    setGwangub(newGwangub.length>0?newGwangub:INIT_GWANGUB());

    alert(`복구설계 ${enabledDmg.length}개 항목 → 설계내역서 ${newItems.length}개 공종\n사급자재 ${newSagub.length}개, 관급자재 ${newGwangub.length}개 자동 반영`);
    setView("estimate"); window.scrollTo(0,0);
  },[damage]);
  const handleSave=useCallback(async()=>{const json=JSON.stringify({v:"8.3",damage,items,chatLog,projName,projLoc,at:new Date().toISOString()},null,2);const blob=new Blob([json],{type:"application/json"});if(window.showSaveFilePicker){try{const handle=await window.showSaveFilePicker({suggestedName:`${projName||'소규모주민숙원'}_${new Date().toISOString().slice(0,10)}.json`,types:[{description:"JSON 파일",accept:{"application/json":[".json"]}}]});const writable=await handle.createWritable();await writable.write(blob);await writable.close();alert("저장 완료!")}catch(e){if(e.name!=="AbortError")alert("저장 오류: "+e.message)}}else{const fn=window.prompt("파일명:",`${projName||"소규모주민숙원"}_${new Date().toISOString().slice(0,10)}`);if(!fn)return;const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${fn}.json`;a.click();URL.revokeObjectURL(a.href)}},[damage,items,chatLog,projName,projLoc]);
  const loadJ=useCallback(e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);const li=d.items||d.designItems||[];const ld=d.damage||d.dmg||[];if(li.length>0){setItems(li.map(i=>({labor:0,material:0,expense:0,...i})));setDamage(ld.length?ld:INIT_DAMAGE());setAnalyzed(true);if(d.chatLog)setChatLog(d.chatLog);if(d.projName)setProjName(d.projName);if(d.projLoc)setProjLoc(d.projLoc);_nid=Math.max(...li.map(x=>x.id),200)+1;alert(`불러오기 완료! (${li.length}개)`)}else alert("데이터 없음")}catch(err){alert("오류:"+err.message)}};r.readAsText(f);e.target.value=""},[]);
  const handleXL=useCallback(async t=>{setXlLoad(t);try{if(t==="d")await genDesignXL(items,sagub,gwangub,FEE_RATE,projName,projLoc);else if(t==="q")await genQtyXL(items,gwangub,FEE_RATE,projName,projLoc);else await genUnitXL(items,sagub,gwangub,projName,projLoc)}finally{setXlLoad(null)}},[items,sagub,gwangub]);

  return(
    <div className="min-h-screen bg-white" style={{fontFamily:"'Pretendard','Noto Sans KR',sans-serif"}}>
      <div className="bg-slate-800 text-white py-5 px-4"><div className="max-w-7xl mx-auto"><h1 className="text-3xl md:text-4xl font-black tracking-tight">소규모주민숙원사업 설계자동화 <span className="text-lg font-normal text-blue-300">VER2.0</span></h1></div></div>
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm"><div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">{[["analysis","🔍 AI 분석"],["estimate","📊 설계내역서"]].map(([k,l])=><button key={k} onClick={()=>{setView(k);window.scrollTo(0,0)}} className={`px-5 py-2.5 text-sm rounded-lg font-bold ${view===k?"bg-blue-600 text-white shadow-md":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{l}</button>)}</div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={handleNewWork} className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded hover:bg-slate-800 font-medium">🆕 새로운작업</button>
          <button onClick={handleSave} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium">💾 작업저장</button>
          <button onClick={()=>jsonRef.current?.click()} className="px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">📂 불러오기</button>
          <input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={loadJ}/>
          <button onClick={()=>{if(window.confirm("⚠️ 현재 작업을 반드시 저장한 후 실행하세요.\n\n저장하셨습니까?\n\n[확인] → 제잡비계산 실행\n[취소] → 돌아가서 저장"))window.open("https://bespoke-boba-03d8af.netlify.app","_blank")}} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium">🧮 제잡비계산</button>
        </div>
      </div></div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {view==="analysis"&&<>
        <section><Hd n="📷" t="현장 사진 + AI 분석"/><div className="mt-3 flex gap-3 items-center flex-wrap"><button onClick={()=>fileRef.current?.click()} className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 font-medium">📷 사진 업로드</button><button onClick={handleAnalyze} disabled={analyzing} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold shadow">{analyzing?"⏳ 분석 중...":"🤖 AI 분석 실행"}</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoUrl(URL.createObjectURL(f));setPhotoFile(f);setAnalyzed(false)}}}/></div>{photoUrl&&<img src={photoUrl} alt="" className="mt-3 h-44 rounded-lg border cursor-pointer" onClick={()=>setPhotoModal(true)}/>}{photoModal&&photoUrl&&<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={()=>setPhotoModal(false)}><img src={photoUrl} alt="" className="max-w-full max-h-full rounded-lg"/></div>}{!analyzed&&photoUrl&&<p className="mt-2 text-sm text-orange-600 font-medium">📌 "AI 분석 실행"을 클릭하세요.</p>}{!analyzed&&!photoUrl&&<div className="mt-4 p-10 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center"><p className="text-slate-500">사진 업로드 후 AI 분석을 실행하거나, 저장 파일을 불러오세요.</p></div>}</section>

        {analyzed&&<>
          {/* 공사개요 (공사명/위치 입력만) */}
          <section>
            <Hd n="0" t="공사 개요"/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <div><label className="text-xs text-slate-500 font-medium">공사명</label><input value={projName} onChange={e=>setProjName(e.target.value)} placeholder="예: ○○천 수해복구공사" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 mt-1"/></div>
                <div><label className="text-xs text-slate-500 font-medium">위치</label><input value={projLoc} onChange={e=>setProjLoc(e.target.value)} placeholder="예: ○○군 ○○면 ○○리 산00번지" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 mt-1"/></div>
              </div>
            </div>
          </section>

          {/* 복구계획 (AI 분석 결과 동적 생성) */}
          {recoveryPlan.method&&<section>
          <div className="bg-slate-800 text-white rounded-lg p-4">
            <h4 className="font-bold text-blue-300 text-sm mb-3">복구계획</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-200 font-medium mb-1">복구방침</p>
                <p className="text-slate-300 text-xs leading-relaxed">{recoveryPlan.method}</p>
              </div>
              <div>
                <p className="text-blue-200 font-medium mb-1">피해내용</p>
                <div className="text-slate-300 text-xs leading-relaxed space-y-0.5">
                  {damage.filter(d=>d.enabled).map((d,i)=>{
                    const dmg=d.item.match(/석축/)?`석축유실 ${d.qty}${d.unit}`:d.item.match(/옹벽|RC/)?`옹벽붕괴 ${d.qty}${d.unit}`:d.item.match(/포장|아스콘/)?`포장파손 ${d.qty}${d.unit}`:d.item.match(/사면|녹화/)?`사면유실 ${d.qty}${d.unit}`:d.item.match(/배수|흄관|측구|암거/)?`배수시설파손 ${d.qty}${d.unit}`:d.item.match(/호안/)?`호안유실 ${d.qty}${d.unit}`:d.item.match(/노반/)?`노반유실 ${d.qty}${d.unit}`:`${d.item} ${d.qty}${d.unit}`;
                    return <p key={d.id}>{i+1}. {dmg} ({d.basis||""})</p>})}
                  {damage.filter(d=>d.enabled).length===0&&<p className="text-slate-500">복구설계를 입력하세요</p>}
                </div>
              </div>
            </div>
          </div>
          </section>}

          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3"><h4 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm"><div><span className="text-slate-500 text-xs">품목</span><p className="font-semibold">레미콘,철근,석재,잡석</p></div><div><span className="text-slate-500 text-xs">관급자재비</span><p className="font-bold text-red-600">{fmt(gTot)}원</p></div><div><span className="text-slate-500 text-xs">수수료율</span><p>1.5%</p></div><div><span className="text-slate-500 text-xs">관급수수료</span><p className="font-bold text-red-600">{fmt(gF)}원</p></div></div></div>

          <section><div className="flex items-center justify-between flex-wrap gap-2"><Hd n="2" t="복구설계"/><div className="flex gap-1"><button onClick={addDamage} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium">➕ 항목추가</button><button onClick={delDamageUnchecked} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium">🗑️ 선택삭제</button></div></div>
          <div className="mt-2 overflow-x-auto border rounded-lg"><table className="w-full text-sm border-collapse"><thead><tr className="bg-blue-700 text-white"><th className="border border-blue-600 px-2 py-2 w-8"><input type="checkbox" checked={allD} ref={el=>{if(el)el.indeterminate=!allD&&someD}} onChange={toggleAllD} className="w-4 h-4"/></th><th className="border border-blue-600 px-2 py-2 w-10">No</th><th className="border border-blue-600 px-3 py-2" style={{minWidth:150}}>공종 (복구계획)</th><th className="border border-blue-600 px-3 py-2">수량산출근거</th><th className="border border-blue-600 px-2 py-2 w-16">수량</th><th className="border border-blue-600 px-2 py-2 w-14">단위</th></tr></thead>
          <tbody>{damage.map((d,i)=><tr key={d.id} className={!d.enabled?"bg-slate-100 opacity-40 line-through":!d.item?"bg-yellow-50":i%2===0?"bg-white":"bg-slate-50"}><td className="border px-2 py-1.5 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>toggleD(d.id)} className="w-4 h-4"/></td><td className="border px-2 py-1.5 text-center font-medium">{i+1}</td><td className="border px-2 py-1.5"><input value={d.item} onChange={e=>updDamage(d.id,"item",e.target.value)} className="w-full bg-transparent text-sm font-medium text-blue-800 outline-none focus:bg-blue-50 rounded px-1" placeholder="공종명"/></td><td className="border px-2 py-1.5"><input value={d.basis} onChange={e=>updDamage(d.id,"basis",e.target.value)} className="w-full bg-transparent text-xs text-slate-600 outline-none focus:bg-blue-50 rounded px-1" placeholder="산출근거"/></td><td className="border px-1 py-1.5 text-center"><input type="number" value={d.qty} onChange={e=>updDamage(d.id,"qty",e.target.value)} className="w-full text-center bg-transparent text-sm font-bold outline-none focus:bg-blue-50 rounded"/></td><td className="border px-1 py-1.5 text-center"><select value={d.unit} onChange={e=>updDamage(d.id,"unit",e.target.value)} className="text-sm bg-transparent outline-none">{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></td></tr>)}</tbody></table></div>
            <div className="mt-3 text-center"><button onClick={handleBuildEstimate} className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow">📊 설계내역서 작성 (복구설계 반영)</button></div>
          </section>

          <section><Hd n="💬" t="수정.질문"/>
          <p className="text-xs text-slate-500 mt-1 mb-2">명령: "추가: 낙석방지망 32m" · 질문: 설계·공법·기준 등 무엇이든 (AI가 전문적으로 답변)</p>
          <div className="border rounded-lg bg-slate-50 p-3 max-h-52 overflow-y-auto space-y-2">{chatLog.length===0&&<p className="text-slate-400 text-sm text-center py-3">명령: "추가: 낙석방지망 32m", "삭제: 3", "수정: 1 수량 60"<br/>질문: "석축과 옹벽의 차이점", "기초 근입깊이 기준" 등 자유롭게</p>}{chatLog.map((msg,i)=><div key={i} className={`flex ${msg.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-md px-3 py-2 rounded-lg text-sm whitespace-pre-line ${msg.role==="user"?"bg-blue-600 text-white":"bg-white border text-slate-700"}`}>{msg.text}</div></div>)}<div ref={chatEndRef}/></div><div className="flex gap-2 mt-2"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();handleChatSend()}}} placeholder="명령 또는 질문 입력..." className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"/><button onClick={handleChatSend} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm">전송</button>{chatLog.length>0&&<button onClick={()=>setChatLog([])} className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 text-xs font-medium">🗑️ 초기화</button>}</div></section>

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
              {(()=>{const allCats=[{c:"1.",n:"토공",t:t1},{c:"2.",n:"구조물공",t:t2},{c:"3.",n:"배수공",t:t3},{c:"4.",n:"호안공",t:t4},{c:"5.",n:"포장공",t:t5},{c:"6.",n:"부대공",t:t6}];let seq=0;return allCats.map(({c,n,t})=>{const ci=act.filter(i=>i.cat===c);if(!ci.length)return null;seq++;return<Fragment key={c}><CR13 code={`${seq}.`} name={n} a={[t.g,t.i,t.k,t.m]}/>{ci.map((item,idx)=><IR13Edit key={item.id} item={item} onUpdate={updField} idx={idx}/>)}</Fragment>})})()}
              {/* 사급자재대 */}<CR13 code={`${[t1,t2,t3,t4,t5,t6].filter((_,i)=>act.some(x=>x.cat===["1.","2.","3.","4.","5.","6."][i])).length+1}.`} name="사급자재대" a={[sT,0,0,0]} fill="bg-orange-50"/>{sagub.map((it,idx)=><tr key={it.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1"></td><td className="border px-2 py-1">{it.name}</td><td className="border px-1 py-1 text-slate-500">{it.spec}</td><td className="border px-1 py-1 text-center">{it.qty}</td><td className="border px-1 py-1 text-center">{it.unit}</td><td className="border px-1 py-1 text-right">{fmt(it.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(it.qty*it.unitPrice))}</td><td className="border"></td><td className="border"></td><td className="border px-1 py-1 text-right text-xs">{fmt(it.unitPrice)}</td><td className="border px-1 py-1 text-right text-xs">{fmt(Math.round(it.qty*it.unitPrice))}</td><td className="border"></td><td className="border"></td></tr>)}
              <CR13 code={`${[t1,t2,t3,t4,t5,t6].filter((_,i)=>act.some(x=>x.cat===["1.","2.","3.","4.","5.","6."][i])).length+2}.`} name="관급자재대" a={[gTot,0,0,0]} fill="bg-red-50"/>{gwangub.map((it,idx)=><tr key={it.id} className={idx%2===0?"bg-white":"bg-slate-50"}><td className="border px-1 py-1 text-center text-xs">{it.sub}</td><td className="border px-2 py-1">{it.name}</td><td className="border px-1 py-1 text-slate-500">{it.spec}</td><td className="border px-1 py-1 text-center">{it.qty}</td><td className="border px-1 py-1 text-center">{it.unit}</td><td className="border px-1 py-1 text-right">{fmt(it.unitPrice)}</td><td className="border px-1 py-1 text-right">{fmt(Math.round(it.qty*it.unitPrice))}</td><td className="border"></td><td className="border"></td><td className="border px-1 py-1 text-right text-xs">{fmt(it.unitPrice)}</td><td className="border px-1 py-1 text-right text-xs">{fmt(Math.round(it.qty*it.unitPrice))}</td><td className="border"></td><td className="border"></td></tr>)}
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
