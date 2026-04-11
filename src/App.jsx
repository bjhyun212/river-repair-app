import { useState, useRef, Fragment } from "react";

/* ============================================================
   소규모주민숙원사업 종합검토보고서 v7.2
   흐름: 사진업로드 → API분석 → 결과표시 → 편집 → 저장
   - 처음 실행: 사진 업로드 화면만
   - 사진 업로드: Netlify Function 호출 → AI 분석
   - 분석 완료: AI분석 ↔ 설계내역서 전환
   - 새 작업: 전체 초기화
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");

// ═══════════════ 빈 초기 데이터 ═══════════════
const emptyItems = [];
const emptySagub = [];
const emptyGwangub = [];
const emptyDamage = [];
const emptyStruct = {
  wallHeight: 0, wallLength: 0, wallThickness: 0,
  foundWidth: 0, foundDepth: 0, japseokThickness: 0,
  backfillWidth: 0, backfillDepth: 0,
  roadWidth: 0, roadThickness: 0,
};

// ═══════════════ 2025 단가 DB (서버 매칭용) ═══════════════
const PRICE_DB = {
  "#.22": { name:"표토제거", spec:"T=20CM, 굴삭기0.7㎥", unit:"m²", labor:191, material:59, expense:80, total:330 },
  "#.28": { name:"흙깍기", spec:"보통토사,소규모,굴착기1.0㎥", unit:"m³", labor:1472, material:774, expense:747, total:2993 },
  "#.57": { name:"구조물터파기", spec:"육상토사,기계100%", unit:"m³", labor:1035, material:323, expense:435, total:1793 },
  "#.68": { name:"뒤채움 및 다짐", spec:"소형장비", unit:"m³", labor:9507, material:1337, expense:1467, total:12311 },
  "#.70": { name:"되메우기 및 다짐", spec:"소형장비", unit:"m³", labor:8044, material:1131, expense:1241, total:10416 },
  "#.77": { name:"기초지정(잡석)", spec:"잡석", unit:"m³", labor:9421, material:956, expense:1360, total:11737 },
  "#.87": { name:"절토사면 녹화", spec:"T=10㎝", unit:"m²", labor:28320, material:22842, expense:4324, total:55486 },
  "#.127":{ name:"사토운반", spec:"토사,L=5.0KM", unit:"m³", labor:4001, material:1876, expense:1525, total:7402 },
  "#.155":{ name:"석축쌓기", spec:"찰쌓기,T=35cm이하", unit:"m²", labor:50146, material:4625, expense:8819, total:63590 },
  "#.193":{ name:"레미콘타설(펌프차)", spec:"철근(S:8-12cm),TYPE-Ⅱ", unit:"m³", labor:17078, material:2556, expense:4540, total:24174 },
  "#.204":{ name:"합판거푸집", spec:"(4회) 보통", unit:"m²", labor:37861, material:14845, expense:0, total:52706 },
  "#.216":{ name:"철근가공 및 조립", spec:"TYPE-1-1", unit:"ton", labor:763584, material:46877, expense:0, total:810461 },
  "#.276":{ name:"콘크리트양생", spec:"습윤양생", unit:"m²", labor:1426, material:472, expense:231, total:2129 },
  "#.280":{ name:"부직포설치", spec:"", unit:"m²", labor:279, material:1693, expense:17, total:1989 },
  "#.281":{ name:"비닐깔기", spec:"", unit:"m²", labor:32, material:647, expense:0, total:679 },
  "#.282":{ name:"물푸기", spec:"", unit:"hr", labor:1139, material:2463, expense:635, total:4237 },
  "#.326":{ name:"아스팔트 절삭후 덧씌우기", spec:"B-Type(1회절삭,1회포장)", unit:"m²", labor:1873, material:919, expense:1189, total:3981 },
};

// ═══════════════ 계산 함수 ═══════════════
function calcTotals(items, sagub, gwangub) {
  const enabled = items.filter(i => i.enabled);
  const cats = { "1.":0,"2.":0,"3.":0,"4.":0 };
  const catsLabor = { "1.":0,"2.":0,"3.":0,"4.":0 };
  const catsMat = { "1.":0,"2.":0,"3.":0,"4.":0 };
  const catsExp = { "1.":0,"2.":0,"3.":0,"4.":0 };
  enabled.forEach(i => {
    cats[i.cat] = (cats[i.cat]||0) + Math.round(i.qty * i.total);
    catsLabor[i.cat] = (catsLabor[i.cat]||0) + Math.round(i.qty * i.labor);
    catsMat[i.cat] = (catsMat[i.cat]||0) + Math.round(i.qty * i.material);
    catsExp[i.cat] = (catsExp[i.cat]||0) + Math.round(i.qty * i.expense);
  });
  const directTotal = Object.values(cats).reduce((a,b)=>a+b,0);
  const sagubTotal = sagub.filter(s=>s.enabled).reduce((a,s)=>a+Math.round(s.qty*s.unitPrice),0);
  const gwangubTotal = gwangub.filter(g=>g.enabled).reduce((a,g)=>a+Math.round(g.qty*g.unitPrice),0);
  const gwangubFee = Math.round(gwangubTotal*0.015);
  const grandTotal = directTotal+sagubTotal+gwangubTotal+gwangubFee;
  return { cats,catsLabor,catsMat,catsExp,directTotal,sagubTotal,gwangubTotal,gwangubFee,grandTotal };
}

// ═══════════════ SVG 단면도 ═══════════════
function CrossSectionSVG({ specs }) {
  const { wallHeight, wallThickness, foundWidth, foundDepth, japseokThickness, backfillWidth, roadWidth } = specs;
  if (!wallHeight || !foundWidth) return <div className="text-center text-slate-400 py-10 text-sm">구조물 제원을 입력하면 단면도가 생성됩니다.</div>;
  const svgW=600,svgH=400,scale=60,ox=120,oy=280;
  const fw=foundWidth*scale,fd=foundDepth*scale,jt=japseokThickness*scale;
  const wh=wallHeight*scale,wt=wallThickness*scale,bw=backfillWidth*scale;
  const rw=roadWidth*scale,rt=5;
  const groundY=oy,japBot=groundY+jt,foundBot=japBot+fd;
  const wallTop=groundY-wh,wallRight=ox+wt;
  const dim=(x1,y1,x2,y2,label,side="left")=>{
    const isVert=Math.abs(x1-x2)<2;
    if(isVert){const xOff=side==="left"?-35:25;return(<g key={label}><line x1={x1+xOff} y1={y1} x2={x1+xOff} y2={y2} stroke="#DC2626" strokeWidth="0.8" markerStart="url(#au)" markerEnd="url(#ad)"/><line x1={x1+xOff-5} y1={y1} x2={x1+xOff+5} y2={y1} stroke="#DC2626" strokeWidth="0.5"/><line x1={x1+xOff-5} y1={y2} x2={x1+xOff+5} y2={y2} stroke="#DC2626" strokeWidth="0.5"/><text x={x1+xOff-8} y={(y1+y2)/2+3} fill="#DC2626" fontSize="9" textAnchor="end" fontWeight="600">{label}</text></g>);}
    const yOff=side==="top"?-12:15;return(<g key={label}><line x1={x1} y1={y1+yOff} x2={x2} y2={y1+yOff} stroke="#2563EB" strokeWidth="0.8" markerStart="url(#al)" markerEnd="url(#ar)"/><line x1={x1} y1={y1+yOff-5} x2={x1} y2={y1+yOff+5} stroke="#2563EB" strokeWidth="0.5"/><line x1={x2} y1={y1+yOff-5} x2={x2} y2={y1+yOff+5} stroke="#2563EB" strokeWidth="0.5"/><text x={(x1+x2)/2} y={y1+yOff-3} fill="#2563EB" fontSize="9" textAnchor="middle" fontWeight="600">{label}</text></g>);
  };
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full border border-slate-200 rounded-lg bg-white" style={{maxHeight:420}}>
      <defs>
        <marker id="au" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto"><path d="M0,6 L3,0 L6,6" fill="#DC2626"/></marker>
        <marker id="ad" markerWidth="6" markerHeight="6" refX="3" refY="0" orient="auto"><path d="M0,0 L3,6 L6,0" fill="#DC2626"/></marker>
        <marker id="al" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6" fill="#2563EB"/></marker>
        <marker id="ar" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#2563EB"/></marker>
        <pattern id="gravel" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="none" stroke="#A8A29E" strokeWidth="0.6"/><circle cx="8" cy="7" r="1.5" fill="none" stroke="#A8A29E" strokeWidth="0.6"/></pattern>
        <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="#CBD5E1"/></pattern>
      </defs>
      <text x={svgW/2} y="22" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1E3A5F">설계 표준 단면도</text>
      <text x={svgW/2} y="37" textAnchor="middle" fontSize="9" fill="#64748B">석축 찰쌓기 + 기초 콘크리트 + 잡석기초</text>
      <line x1="30" y1={groundY} x2={svgW-30} y2={groundY} stroke="#78716C" strokeWidth="1.5" strokeDasharray="8,3"/>
      <text x="40" y={groundY-5} fontSize="9" fill="#78716C" fontWeight="600">G.L</text>
      <rect x="30" y={groundY+5} width={ox-40} height={30} fill="#DBEAFE" opacity="0.5" rx="2"/>
      <text x={(30+ox-10)/2} y={groundY+24} fontSize="8" fill="#3B82F6" textAnchor="middle">하천수면</text>
      <rect x={ox-10} y={groundY} width={fw+20} height={jt} fill="url(#gravel)" stroke="#78716C" strokeWidth="1"/>
      <text x={ox+fw/2} y={groundY+jt/2+3} fontSize="8" fill="#57534E" textAnchor="middle" fontWeight="500">잡석기초</text>
      <rect x={ox-5} y={japBot} width={fw+10} height={fd} fill="#E2E8F0" stroke="#475569" strokeWidth="1.2"/>
      <text x={ox+fw/2} y={japBot+fd/2+3} fontSize="8" fill="#334155" textAnchor="middle" fontWeight="600">기초 콘크리트</text>
      <rect x={ox} y={wallTop} width={wt} height={wh} fill="#D6D3D1" stroke="#57534E" strokeWidth="1.5"/>
      <text x={ox+wt/2} y={wallTop+wh/2} fontSize="8" fill="#44403C" textAnchor="middle" fontWeight="600" transform={`rotate(-90,${ox+wt/2},${wallTop+wh/2})`}>석축 찰쌓기</text>
      <rect x={wallRight} y={wallTop} width={bw} height={wh} fill="url(#dots)" stroke="#78716C" strokeWidth="0.8"/>
      <text x={wallRight+bw/2} y={wallTop+wh/2+3} fontSize="7" fill="#57534E" textAnchor="middle">뒤채움</text>
      <line x1={wallRight} y1={wallTop} x2={wallRight} y2={groundY} stroke="#7C3AED" strokeWidth="2.5" strokeDasharray="4,2"/>
      <rect x={wallRight+bw-5} y={wallTop-rt} width={rw} height={rt} fill="#1F2937" stroke="#111827" strokeWidth="0.8"/>
      <text x={wallRight+bw+rw/2-5} y={wallTop-rt-4} fontSize="7" fill="#374151" textAnchor="middle">도로 (As포장)</text>
      {dim(ox,wallTop,ox,groundY,`H=${wallHeight}m`,"left")}
      {dim(ox-5,groundY,ox-5,groundY+jt,`${japseokThickness}m`,"left")}
      {dim(ox-5,japBot,ox-5,foundBot,`D=${foundDepth}m`,"left")}
      {dim(ox,groundY,ox+fw,groundY,`B=${foundWidth}m`,"top")}
      {dim(ox,wallTop,wallRight,wallTop,`T=${wallThickness}m`,"top")}
      {dim(wallRight,wallTop,wallRight+bw,wallTop,`${backfillWidth}m`,"top")}
      <g transform="translate(420,55)"><rect width="155" height="88" fill="white" stroke="#E2E8F0" rx="4"/><text x="8" y="15" fontSize="8" fontWeight="bold" fill="#334155">범 례</text><rect x="8" y="22" width="14" height="8" fill="#D6D3D1" stroke="#57534E" strokeWidth="0.5"/><text x="26" y="29" fontSize="7" fill="#475569">석축 찰쌓기</text><rect x="8" y="34" width="14" height="8" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5"/><text x="26" y="41" fontSize="7" fill="#475569">기초 콘크리트</text><rect x="8" y="46" width="14" height="8" fill="url(#gravel)" stroke="#78716C" strokeWidth="0.5"/><text x="26" y="53" fontSize="7" fill="#475569">잡석기초</text><rect x="8" y="58" width="14" height="8" fill="url(#dots)" stroke="#78716C" strokeWidth="0.5"/><text x="26" y="65" fontSize="7" fill="#475569">뒤채움</text><line x1="8" y1="74" x2="22" y2="74" stroke="#7C3AED" strokeWidth="2.5" strokeDasharray="4,2"/><text x="26" y="77" fontSize="7" fill="#475569">부직포</text></g>
    </svg>
  );
}

// ═══════════════ 공통 UI ═══════════════
function SectionTitle({num,title}){return(<div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">{num}</div><h2 className="text-lg font-bold text-slate-800">{title}</h2></div>);}
function InfoCard({title,color,children}){const s=color==="blue"?{bg:"bg-blue-50",border:"border-blue-200",txt:"text-blue-700"}:{bg:"bg-red-50",border:"border-red-200",txt:"text-red-700"};return(<div className={`${s.bg} border ${s.border} rounded-lg p-5`}><h4 className={`font-bold ${s.txt} text-sm mb-3`}>{title}</h4><div className="space-y-2">{children}</div></div>);}
function InfoRow({label,value,highlight}){return(<div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className={highlight?"font-bold text-red-600":"font-medium text-slate-800"}>{value}</span></div>);}
function SumCard({label,value,color,bold}){const c={blue:"bg-blue-50 border-blue-200 text-blue-700",orange:"bg-orange-50 border-orange-200 text-orange-600",red:"bg-red-50 border-red-200 text-red-600",pink:"bg-pink-50 border-pink-200 text-pink-600",slate:"bg-slate-800 border-slate-700 text-white"};return(<div className={`rounded-lg border p-3 ${c[color]}`}><p className="text-xs opacity-75">{label}</p><p className={`${bold?"text-lg":"text-sm"} font-bold mt-1`}>{fmt(value)}원</p></div>);}
function StructCard({title,specs,color}){const c={blue:{bg:"bg-blue-50",border:"border-blue-200",title:"text-blue-700",dot:"bg-blue-400"},red:{bg:"bg-red-50",border:"border-red-200",title:"text-red-700",dot:"bg-red-400"},amber:{bg:"bg-amber-50",border:"border-amber-200",title:"text-amber-700",dot:"bg-amber-400"}}[color];return(<div className={`${c.bg} border ${c.border} rounded-lg p-5`}><h4 className={`font-bold ${c.title} text-sm mb-4`}>{title}</h4><div className="space-y-2.5">{specs.map((s,i)=>(<div key={i} className="flex items-start gap-2 text-sm"><span className={`${c.dot} w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0`}/><span className="text-slate-500 w-16 flex-shrink-0">{s.k}</span><span className="font-medium text-slate-800">{s.v}</span></div>))}</div></div>);}

// ═══════════════ AI 분석 화면 ═══════════════
function AnalysisView({totals,structSpecs,setStructSpecs,editMode,damageItems,setDamageItems,analysisResult,imagePreview,imageInputRef,handleImageUpload,onImageClick}){
  const toggleDamage=(id)=>setDamageItems(p=>p.map(d=>d.id===id?{...d,enabled:!d.enabled}:d));
  const updateDamage=(id,field,val)=>setDamageItems(p=>p.map(d=>d.id!==id?d:{...d,[field]:field==="qty"?parseFloat(val)||0:val}));
  const addDamage=()=>{const mx=Math.max(...damageItems.map(d=>d.id),0);setDamageItems(p=>[...p,{id:mx+1,name:"새 항목",basis:"",qty:0,unit:"㎡",enabled:true}]);};
  const ar = analysisResult || {};
  return (
    <div className="space-y-6">
      {/* 현장 사진 */}
      {imagePreview && imagePreview !== "loaded" && (
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <SectionTitle num="0" title="현장 사진" />
        <div className="relative cursor-pointer group mt-4" onClick={onImageClick}>
          <img src={imagePreview} alt="현장사진" className="w-full max-h-80 object-contain rounded-lg border border-slate-200" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-lg">🔍 클릭하여 확대</span>
          </div>
        </div>
        {editMode && <div className="mt-3"><button onClick={()=>imageInputRef.current?.click()} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300 font-medium">📷 사진 변경</button><input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/></div>}
      </section>
      )}

      {/* 종합 분석 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <SectionTitle num="1" title="종합 분석" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          <InfoCard title="현장 제원" color="blue">
            <InfoRow label="피해 위치" value={ar.bankSide||"좌안"} />
            <InfoRow label="피해 연장" value={ar.damageLength||"-"} />
            <InfoRow label="구조물 높이" value={ar.wallHeight||"-"} />
            <InfoRow label="기초 세굴 깊이" value={ar.scourDepth||"-"} />
            <InfoRow label="도로 파손" value={ar.roadDamage||"-"} />
          </InfoCard>
          <InfoCard title="피해 원인 및 판정" color="red">
            <InfoRow label="1차 원인" value={ar.cause1||"-"} />
            <InfoRow label="2차 원인" value={ar.cause2||"-"} />
            <InfoRow label="3차 피해" value={ar.cause3||"-"} />
            <InfoRow label="복구 판정" value={ar.judgement||"개선복구"} highlight />
            <InfoRow label="설계 기준" value={ar.designBasis||"-"} />
          </InfoCard>
        </div>
        <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-5">
          <h4 className="font-bold text-red-700 text-sm mb-3">관급자재 요약</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-slate-500">품목</span><p className="font-semibold text-slate-800 mt-1">레미콘, 철근, 석재, 잡석</p></div>
            <div><span className="text-slate-500">관급자재비</span><p className="font-bold text-red-600 mt-1">{fmt(totals.gwangubTotal)}원</p></div>
            <div><span className="text-slate-500">수수료율</span><p className="font-semibold text-slate-800 mt-1">1.5%</p></div>
            <div><span className="text-slate-500">관급수수료</span><p className="font-bold text-red-600 mt-1">{fmt(totals.gwangubFee)}원</p></div>
          </div>
        </div>
      </section>

      {/* 피해 현황 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle num="2" title="피해 현황" />
          {editMode&&<button onClick={addDamage} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">+ 항목 추가</button>}
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr className="bg-slate-100">{editMode&&<th className="border border-slate-300 px-2 py-2 w-8 text-center">✓</th>}<th className="border border-slate-300 px-3 py-2 w-10 text-center">순번</th><th className="border border-slate-300 px-3 py-2 text-center">항목</th><th className="border border-slate-300 px-3 py-2 text-center">산출근거</th><th className="border border-slate-300 px-3 py-2 w-16 text-center">수량</th><th className="border border-slate-300 px-3 py-2 w-12 text-center">단위</th></tr></thead>
        <tbody>{damageItems.map((d,idx)=>(<tr key={d.id} className={`${!d.enabled?"opacity-40 line-through":""} ${idx%2===0?"bg-white":"bg-slate-50"}`}>{editMode&&<td className="border border-slate-200 px-2 py-1.5 text-center"><input type="checkbox" checked={d.enabled} onChange={()=>toggleDamage(d.id)} className="w-4 h-4"/></td>}<td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500">{idx+1}</td><td className="border border-slate-200 px-3 py-1.5">{editMode?<input value={d.name} onChange={e=>updateDamage(d.id,"name",e.target.value)} className="w-full px-1 py-0.5 border rounded text-sm"/>:d.name}</td><td className="border border-slate-200 px-3 py-1.5 text-slate-600">{editMode?<input value={d.basis} onChange={e=>updateDamage(d.id,"basis",e.target.value)} className="w-full px-1 py-0.5 border rounded text-sm"/>:d.basis}</td><td className="border border-slate-200 px-2 py-1.5 text-center font-medium">{editMode?<input type="number" value={d.qty} onChange={e=>updateDamage(d.id,"qty",e.target.value)} className="w-16 px-1 py-0.5 border rounded text-sm text-center"/>:d.qty}</td><td className="border border-slate-200 px-2 py-1.5 text-center">{d.unit}</td></tr>))}</tbody></table></div>
      </section>

      {/* 구조물 + 단면도 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <SectionTitle num="3" title="주요구조물 제원" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          <StructCard title="석축 (찰쌓기)" color="blue" specs={[{k:"형식",v:"찰쌓기 석축"},{k:"두께",v:`T = ${structSpecs.wallThickness}m`},{k:"높이",v:`H = ${structSpecs.wallHeight}m`},{k:"연장",v:`L = ${structSpecs.wallLength}m`}]}/>
          <StructCard title="기초 콘크리트" color="red" specs={[{k:"규격",v:"25-21-150"},{k:"폭",v:`B = ${structSpecs.foundWidth}m`},{k:"근입",v:`D = ${structSpecs.foundDepth}m`},{k:"잡석",v:`T = ${structSpecs.japseokThickness}m`}]}/>
          <StructCard title="부대시설" color="amber" specs={[{k:"부직포",v:"뒤채움 배면 전면 설치"},{k:"뒤채움",v:`소형장비 다짐 (B=${structSpecs.backfillWidth}m)`},{k:"포장",v:`As 절삭+덧씌우기 (W=${structSpecs.roadWidth}m)`},{k:"물푸기",v:"시공 중 배수"}]}/>
        </div>
        <div className="mt-6"><h3 className="text-sm font-bold text-slate-700 mb-3">설계 표준 단면도</h3><CrossSectionSVG specs={structSpecs}/></div>
        {editMode&&(<div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg"><h4 className="text-sm font-bold text-amber-700 mb-3">구조물 제원 수정</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">{[["wallHeight","석축 높이(m)"],["wallLength","석축 연장(m)"],["wallThickness","석축 두께(m)"],["foundWidth","기초 폭(m)"],["foundDepth","기초 근입(m)"],["japseokThickness","잡석 두께(m)"],["backfillWidth","뒤채움 폭(m)"],["roadWidth","도로 폭(m)"]].map(([k,l])=>(<div key={k}><label className="text-slate-600">{l}</label><input type="number" step="0.1" value={structSpecs[k]} onChange={e=>setStructSpecs(p=>({...p,[k]:parseFloat(e.target.value)||0}))} className="w-full mt-1 px-2 py-1.5 border rounded text-sm"/></div>))}</div></div>)}
      </section>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SumCard label="직접공사비" value={totals.directTotal} color="blue"/>
        <SumCard label="사급자재비" value={totals.sagubTotal} color="orange"/>
        <SumCard label="관급자재비" value={totals.gwangubTotal} color="red"/>
        <SumCard label="관급수수료" value={totals.gwangubFee} color="pink"/>
        <SumCard label="총공사비" value={totals.grandTotal} color="slate" bold/>
      </div>
    </div>
  );
}

// ═══════════════ 설계내역서 화면 ═══════════════
function EstimateView({items,setItems,sagub,setSagub,gwangub,setGwangub,totals,editMode}){
  const catOrder=["1.","2.","3.","4."];
  const catNames={"1.":"토공","2.":"구조물공","3.":"포장공","4.":"부대공"};
  const toggleItem=id=>setItems(p=>p.map(i=>i.id===id?{...i,enabled:!i.enabled}:i));
  const toggleSagub=id=>setSagub(p=>p.map(i=>i.id===id?{...i,enabled:!i.enabled}:i));
  const toggleGwangub=id=>setGwangub(p=>p.map(i=>i.id===id?{...i,enabled:!i.enabled}:i));
  const addItem=()=>{const mx=Math.max(...items.map(i=>i.id),0);setItems(p=>[...p,{id:mx+1,cat:"4.",catName:"부대공",name:"새 공종",spec:"",unit:"m²",qty:1,labor:0,material:0,expense:0,total:0,note:"",enabled:true}]);};
  const updateItem=(id,field,value)=>{setItems(p=>p.map(i=>{if(i.id!==id)return i;const u={...i,[field]:field==="qty"?parseFloat(value)||0:value};if(["labor","material","expense"].includes(field)){u[field]=parseInt(value)||0;u.total=u.labor+u.material+u.expense;}return u;}));};
  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle num="2" title="설계 내역서"/>
          {editMode&&<button onClick={addItem} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">+ 공종 추가</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-700 text-white">
                {editMode&&<th rowSpan={2} className="border border-slate-500 px-1 py-2 w-8 text-center">✓</th>}
                <th rowSpan={2} className="border border-slate-500 px-2 py-2 w-12 text-center">공종</th>
                <th rowSpan={2} className="border border-slate-500 px-2 py-2 text-center">품 명</th>
                <th rowSpan={2} className="border border-slate-500 px-2 py-2 text-center">규 격</th>
                <th rowSpan={2} className="border border-slate-500 px-1 py-2 w-14 text-center">수량</th>
                <th rowSpan={2} className="border border-slate-500 px-1 py-2 w-10 text-center">단위</th>
                <th colSpan={2} className="border border-slate-500 px-2 py-1 text-center bg-slate-600">합 계</th>
                <th colSpan={2} className="border border-slate-500 px-2 py-1 text-center bg-blue-700">노 무 비</th>
                <th colSpan={2} className="border border-slate-500 px-2 py-1 text-center bg-emerald-700">재 료 비</th>
                <th colSpan={2} className="border border-slate-500 px-2 py-1 text-center bg-amber-700">경 비</th>
              </tr>
              <tr className="bg-slate-600 text-white">{["단가","금액","단가","금액","단가","금액","단가","금액"].map((t,i)=>(<th key={i} className="border border-slate-500 px-1 py-1 text-center">{t}</th>))}</tr>
            </thead>
            <tbody>
              <tr className="bg-slate-200 font-bold">{editMode&&<td className="border border-slate-300"/>}<td colSpan={5} className="border border-slate-300 px-3 py-2 text-center tracking-widest text-slate-700">순 공 사 비</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(totals.directTotal)}</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(Object.values(totals.catsLabor).reduce((a,b)=>a+b,0))}</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(Object.values(totals.catsMat).reduce((a,b)=>a+b,0))}</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(Object.values(totals.catsExp).reduce((a,b)=>a+b,0))}</td></tr>
              {catOrder.map(cat=>{const ci=items.filter(i=>i.cat===cat);if(!ci.length)return null;return(<Fragment key={cat}>
                <tr className="bg-blue-50 font-bold">{editMode&&<td className="border border-slate-300"/>}<td className="border border-slate-300 px-2 py-2 text-center text-blue-700">{cat}</td><td className="border border-slate-300 px-2 py-2 text-blue-700">{catNames[cat]}</td>{[...Array(3)].map((_,i)=><td key={i} className="border border-slate-300"/>)}<td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(totals.cats[cat])}</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-600">{fmt(totals.catsLabor[cat])}</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-600">{fmt(totals.catsMat[cat])}</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-600">{fmt(totals.catsExp[cat])}</td></tr>
                {ci.map((item,idx)=>(<tr key={item.id} className={`${!item.enabled?"opacity-40 line-through":""} ${idx%2===0?"bg-white":"bg-slate-50"} hover:bg-blue-50 transition`}>
                  {editMode&&<td className="border border-slate-200 px-1 py-1.5 text-center"><input type="checkbox" checked={item.enabled} onChange={()=>toggleItem(item.id)} className="w-4 h-4"/></td>}
                  <td className="border border-slate-200 px-1 py-1.5 text-center text-slate-400">{item.note}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{editMode?<input value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs"/>:item.name}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-600">{editMode?<input value={item.spec} onChange={e=>updateItem(item.id,"spec",e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs"/>:item.spec}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-center">{editMode?<input type="number" value={item.qty} onChange={e=>updateItem(item.id,"qty",e.target.value)} className="w-16 px-1 py-0.5 border rounded text-xs text-center"/>:item.qty}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-center">{item.unit}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(item.total)}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right font-medium">{fmt(Math.round(item.qty*item.total))}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(item.labor)}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(Math.round(item.qty*item.labor))}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(item.material)}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(Math.round(item.qty*item.material))}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(item.expense)}</td>
                  <td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(Math.round(item.qty*item.expense))}</td>
                </tr>))}
              </Fragment>);})}
              {/* 사급 */}
              <tr className="bg-orange-50 font-bold">{editMode&&<td className="border border-slate-300"/>}<td className="border border-slate-300 px-2 py-2 text-center text-orange-700">5.</td><td className="border border-slate-300 px-2 py-2 text-orange-700">사급자재대</td><td colSpan={4} className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-orange-700">{fmt(totals.sagubTotal)}</td><td colSpan={6} className="border border-slate-300"/></tr>
              {sagub.map((s,idx)=>(<tr key={s.id} className={`${!s.enabled?"opacity-40 line-through":""} ${idx%2===0?"bg-white":"bg-orange-50/30"}`}>{editMode&&<td className="border border-slate-200 px-1 py-1.5 text-center"><input type="checkbox" checked={s.enabled} onChange={()=>toggleSagub(s.id)} className="w-4 h-4"/></td>}<td className="border border-slate-200"/><td className="border border-slate-200 px-2 py-1.5">{s.name}</td><td className="border border-slate-200 px-2 py-1.5 text-slate-600">{s.spec}</td><td className="border border-slate-200 px-1 py-1.5 text-center">{s.qty}</td><td className="border border-slate-200 px-1 py-1.5 text-center">{s.unit}</td><td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(s.unitPrice)}</td><td className="border border-slate-200 px-1 py-1.5 text-right font-medium">{fmt(Math.round(s.qty*s.unitPrice))}</td><td colSpan={6} className="border border-slate-200 text-center text-slate-400">—</td></tr>))}
              {/* 관급 */}
              <tr className="bg-red-50 font-bold">{editMode&&<td className="border border-slate-300"/>}<td className="border border-slate-300 px-2 py-2 text-center text-red-700">6.</td><td className="border border-slate-300 px-2 py-2 text-red-700">관급자재대</td><td colSpan={4} className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-red-700">{fmt(totals.gwangubTotal)}</td><td colSpan={6} className="border border-slate-300"/></tr>
              {gwangub.map((g,idx)=>(<tr key={g.id} className={`${!g.enabled?"opacity-40 line-through":""} ${idx%2===0?"bg-white":"bg-red-50/30"}`}>{editMode&&<td className="border border-slate-200 px-1 py-1.5 text-center"><input type="checkbox" checked={g.enabled} onChange={()=>toggleGwangub(g.id)} className="w-4 h-4"/></td>}<td className="border border-slate-200 px-1 py-1.5 text-center text-red-500 text-[10px]">{g.sub}</td><td className="border border-slate-200 px-2 py-1.5">{g.name}</td><td className="border border-slate-200 px-2 py-1.5 text-slate-600">{g.spec}</td><td className="border border-slate-200 px-1 py-1.5 text-center">{g.qty}</td><td className="border border-slate-200 px-1 py-1.5 text-center">{g.unit}</td><td className="border border-slate-200 px-1 py-1.5 text-right">{fmt(g.unitPrice)}</td><td className="border border-slate-200 px-1 py-1.5 text-right font-medium">{fmt(Math.round(g.qty*g.unitPrice))}</td><td colSpan={6} className="border border-slate-200 text-center text-slate-400">—</td></tr>))}
              <tr className="bg-red-100 font-bold">{editMode&&<td className="border border-slate-300"/>}<td colSpan={5} className="border border-slate-300 px-3 py-2 text-center text-red-700">관급수수료 (1.5%)</td><td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-red-700">{fmt(totals.gwangubFee)}</td><td colSpan={6} className="border border-slate-300"/></tr>
              <tr className="bg-slate-800 text-white font-bold">{editMode&&<td className="border border-slate-600"/>}<td colSpan={5} className="border border-slate-600 px-3 py-3 text-center text-base tracking-widest">총 공 사 비</td><td className="border border-slate-600"/><td className="border border-slate-600 px-2 py-3 text-right text-lg text-yellow-300">{fmt(totals.grandTotal)}</td><td colSpan={6} className="border border-slate-600"/></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <SumCard label="직접공사비" value={totals.directTotal} color="blue"/>
          <SumCard label="사급자재비" value={totals.sagubTotal} color="orange"/>
          <SumCard label="관급자재비" value={totals.gwangubTotal} color="red"/>
          <SumCard label="관급수수료" value={totals.gwangubFee} color="pink"/>
          <SumCard label="총공사비" value={totals.grandTotal} color="slate" bold/>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 메인 앱
// ═══════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("analysis");
  const [items, setItems] = useState(emptyItems);
  const [sagub, setSagub] = useState(emptySagub);
  const [gwangub, setGwangub] = useState(emptyGwangub);
  const [structSpecs, setStructSpecs] = useState(emptyStruct);
  const [damageItems, setDamageItems] = useState(emptyDamage);
  const [editMode, setEditMode] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const totals = calcTotals(items, sagub, gwangub);

  // 사진 업로드 → API 분석 호출
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setImagePreview(base64);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/.netlify/functions/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
        const data = await res.json();
        applyAnalysisData(data);
      } catch (err) {
        console.error("API 분석 실패:", err);
        setError("AI 분석에 실패했습니다. 편집 모드에서 수동으로 입력해주세요.");
        // 빈 상태로 편집 모드 전환
        setEditMode(true);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file); e.target.value = "";
  };

  // AI 분석 결과를 state에 반영
  const applyAnalysisData = (data) => {
    setAnalysisResult(data.analysis || {});

    // 설계 물량 → items (단가 DB 매칭)
    if (data.designItems && data.designItems.length > 0) {
      const mapped = data.designItems.map((di, idx) => {
        const price = PRICE_DB[di.priceId] || {};
        return {
          id: idx + 1, cat: di.cat || "4.", catName: di.catName || "부대공",
          name: price.name || di.name || "미지정", spec: price.spec || di.spec || "",
          unit: price.unit || di.unit || "m²", qty: di.qty || 0,
          labor: price.labor || 0, material: price.material || 0,
          expense: price.expense || 0, total: price.total || 0,
          note: di.priceId || "", enabled: true,
        };
      });
      setItems(mapped);
    }

    // 사급자재
    if (data.sagubItems) setSagub(data.sagubItems.map((s, i) => ({ ...s, id: 100 + i + 1, enabled: true })));
    // 관급자재
    if (data.gwangubItems) setGwangub(data.gwangubItems.map((g, i) => ({ ...g, id: 200 + i + 1, enabled: true })));
    // 피해현황
    if (data.damageItems) setDamageItems(data.damageItems.map((d, i) => ({ ...d, id: i + 1, enabled: true })));
    // 구조물 제원
    if (data.structSpecs) setStructSpecs(data.structSpecs);
  };

  // 전체 초기화 (새 작업)
  const resetAll = () => {
    if (!confirm("모든 데이터를 초기화하고 새 작업을 시작하시겠습니까?")) return;
    setView("analysis");
    setItems(emptyItems); setSagub(emptySagub); setGwangub(emptyGwangub);
    setStructSpecs(emptyStruct); setDamageItems(emptyDamage);
    setEditMode(false); setImagePreview(null); setShowImageModal(false);
    setAnalysisResult(null); setLoading(false); setError(null);
  };

  // PC 저장
  const saveToFile = () => {
    const data = JSON.stringify({ items, sagub, gwangub, structSpecs, damageItems, analysisResult, savedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `소규모주민숙원사업_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  // PC 불러오기
  const loadFromFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if(d.items)setItems(d.items); if(d.sagub)setSagub(d.sagub);
        if(d.gwangub)setGwangub(d.gwangub); if(d.structSpecs)setStructSpecs(d.structSpecs);
        if(d.damageItems)setDamageItems(d.damageItems);
        if(d.analysisResult)setAnalysisResult(d.analysisResult);
        setImagePreview("loaded"); // 보고서 화면으로 전환
        alert("불러오기 완료");
      } catch { alert("파일 형식이 올바르지 않습니다."); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  // ═══════════════ 렌더링 ═══════════════
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ══════ 초기 화면: 사진 업로드 ══════ */}
      {!imagePreview ? (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-800">종합검토보고서</h1>
              <p className="text-sm text-slate-500 mt-2">하천 수해복구 설계 분석 시스템</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                  <p className="text-base font-medium text-slate-700">AI가 현장 사진을 분석 중입니다...</p>
                  <p className="text-sm text-slate-400 mt-2">피해 유형, 물량, 공법을 산정하고 있습니다</p>
                </div>
              ) : (
                <>
                  <div onClick={()=>imageInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    <div className="text-5xl mb-4">📷</div>
                    <p className="text-base font-medium text-slate-700">현장 피해 사진을 첨부하세요</p>
                    <p className="text-sm text-slate-400 mt-2">클릭하여 파일 선택 (JPG, PNG)</p>
                    <p className="text-xs text-blue-500 mt-3">사진 업로드 → AI 자동 분석 → 설계물량 산정</p>
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <div className="mt-6 flex justify-center">
                    <button onClick={()=>fileInputRef.current?.click()} className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 font-medium">📂 이전 데이터 불러오기</button>
                    <input ref={fileInputRef} type="file" accept=".json" onChange={loadFromFile} className="hidden"/>
                  </div>
                </>
              )}
            </div>
            <p className="text-center text-xs text-slate-400 mt-6">2025년 단가목록 적용 (충청북도)</p>
          </div>
        </div>
      ) : (
      /* ══════ 보고서 화면 ══════ */
      <>
      {/* 로딩 오버레이 */}
      {loading && (
        <div className="fixed inset-0 z-[200] bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"/>
            <p className="text-base font-medium text-slate-700">AI 분석 중...</p>
          </div>
        </div>
      )}

      {/* 네비바 */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-base font-bold text-slate-800 hidden sm:block">종합검토보고서</h1>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={()=>setView("analysis")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view==="analysis"?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-200"}`}>🔍 AI 분석</button>
              <button onClick={()=>setView("estimate")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view==="estimate"?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-200"}`}>📋 설계내역서</button>
            </div>
            <div className="flex gap-2">
              <button onClick={resetAll} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 font-medium">🔄 새 작업</button>
              <button onClick={saveToFile} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">💾 저장</button>
              <button onClick={()=>fileInputRef.current?.click()} className="px-3 py-1.5 bg-slate-600 text-white text-xs rounded-lg hover:bg-slate-700 font-medium">📂 열기</button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={loadFromFile} className="hidden"/>
              <button onClick={()=>setEditMode(!editMode)} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${editMode?"bg-amber-500 text-white":"bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>{editMode?"✏️ 편집중":"✏️ 편집"}</button>
            </div>
          </div>
        </div>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-amber-800">
            <span>⚠️</span><span>{error}</span>
            <button onClick={()=>setError(null)} className="ml-auto text-amber-500 hover:text-amber-700">✕</button>
          </div>
        </div>
      )}

      {/* 서브헤더 */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">{analysisResult?.bankSide||"분석중"}</span>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">{analysisResult?.judgement||"개선복구"}</span>
              <span className="text-sm text-slate-600">하천 수해복구 설계</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>직접공사비 <strong className="text-blue-700">{fmt(totals.directTotal)}</strong></span>
              <span className="text-slate-300">|</span>
              <span>총공사비 <strong className="text-slate-800 text-sm">{fmt(totals.grandTotal)}원</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {view === "analysis"
          ? <AnalysisView totals={totals} structSpecs={structSpecs} setStructSpecs={setStructSpecs} editMode={editMode} damageItems={damageItems} setDamageItems={setDamageItems} analysisResult={analysisResult} imagePreview={imagePreview} imageInputRef={imageInputRef} handleImageUpload={handleImageUpload} onImageClick={()=>setShowImageModal(true)}/>
          : <EstimateView items={items} setItems={setItems} sagub={sagub} setSagub={setSagub} gwangub={gwangub} setGwangub={setGwangub} totals={totals} editMode={editMode}/>
        }
      </div>

      {/* 사진 모달 */}
      {showImageModal && imagePreview && imagePreview !== "loaded" && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={()=>setShowImageModal(false)}>
          <button onClick={()=>setShowImageModal(false)} className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-red-400 z-[101]">✕</button>
          <img src={imagePreview} alt="현장사진 확대" className="max-w-full max-h-full object-contain rounded-lg" onClick={e=>e.stopPropagation()}/>
        </div>
      )}

      <div className="text-center text-xs text-slate-400 py-6 border-t border-slate-100">
        <p>상세 수량산출 근거는 엑셀 파일 참조</p>
        <p className="mt-1">종합검토보고서 v7.2 — 2025년 단가목록 적용 (충청북도)</p>
      </div>
      </>
      )}
    </div>
  );
}
