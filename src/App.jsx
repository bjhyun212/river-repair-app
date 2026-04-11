import { useState, useRef, Fragment } from "react";

/* ============================================================
   소규모주민숙원사업 종합검토보고서 v7.1
   - AI분석 ↔ 설계내역서 화면 전환 기능 추가
   - v7.0 수정사항 6건 유지
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");

// ═══════════════ 기본 데이터 ═══════════════
const defaultDesignItems = [
  { id: 1, cat: "1.", catName: "토공", name: "표토제거", spec: "T=20CM, 굴삭기0.7㎥", unit: "m²", qty: 35, labor: 191, material: 59, expense: 80, total: 330, note: "#.22", enabled: true },
  { id: 2, cat: "1.", catName: "토공", name: "흙깍기", spec: "보통토사, 소규모, 굴착기1.0㎥", unit: "m³", qty: 40, labor: 1472, material: 774, expense: 747, total: 2993, note: "#.28", enabled: true },
  { id: 3, cat: "1.", catName: "토공", name: "구조물터파기", spec: "육상토사, 기계100%", unit: "m³", qty: 51, labor: 1035, material: 323, expense: 435, total: 1793, note: "#.57", enabled: true },
  { id: 4, cat: "1.", catName: "토공", name: "뒤채움 및 다짐", spec: "소형장비", unit: "m³", qty: 35, labor: 9507, material: 1337, expense: 1467, total: 12311, note: "#.68", enabled: true },
  { id: 5, cat: "1.", catName: "토공", name: "되메우기 및 다짐", spec: "소형장비", unit: "m³", qty: 20, labor: 8044, material: 1131, expense: 1241, total: 10416, note: "#.70", enabled: true },
  { id: 6, cat: "1.", catName: "토공", name: "절토사면 녹화", spec: "T=10cm", unit: "m²", qty: 45, labor: 28320, material: 22842, expense: 4324, total: 55486, note: "#.87", enabled: true },
  { id: 7, cat: "1.", catName: "토공", name: "사토운반", spec: "토사, L=5.0KM", unit: "m³", qty: 40, labor: 4001, material: 1876, expense: 1525, total: 7402, note: "#.127", enabled: true },
  { id: 8, cat: "2.", catName: "구조물공", name: "기초지정(잡석)", spec: "잡석", unit: "m³", qty: 26, labor: 9421, material: 956, expense: 1360, total: 11737, note: "#.77", enabled: true },
  { id: 9, cat: "2.", catName: "구조물공", name: "레미콘타설(펌프차)", spec: "철근(S:8-12cm), TYPE-Ⅱ", unit: "m³", qty: 51, labor: 17078, material: 2556, expense: 4540, total: 24174, note: "#.193", enabled: true },
  { id: 10, cat: "2.", catName: "구조물공", name: "석축쌓기", spec: "찰쌓기, T=35cm이하", unit: "m²", qty: 51, labor: 50146, material: 4625, expense: 8819, total: 63590, note: "#.155", enabled: true },
  { id: 11, cat: "2.", catName: "구조물공", name: "합판거푸집", spec: "(4회) 보통", unit: "m²", qty: 41, labor: 37861, material: 14845, expense: 0, total: 52706, note: "#.204", enabled: true },
  { id: 12, cat: "2.", catName: "구조물공", name: "철근가공 및 조립", spec: "TYPE-1-1", unit: "ton", qty: 2.6, labor: 763584, material: 46877, expense: 0, total: 810461, note: "#.216", enabled: true },
  { id: 13, cat: "2.", catName: "구조물공", name: "콘크리트양생", spec: "습윤양생", unit: "m²", qty: 92, labor: 1426, material: 472, expense: 231, total: 2129, note: "#.276", enabled: true },
  { id: 14, cat: "3.", catName: "포장공", name: "아스팔트 절삭후 덧씌우기", spec: "B-Type(1회절삭,1회포장)", unit: "m²", qty: 40, labor: 1873, material: 919, expense: 1189, total: 3981, note: "#.326", enabled: true },
  { id: 15, cat: "4.", catName: "부대공", name: "부직포설치", spec: "", unit: "m²", qty: 72, labor: 279, material: 1693, expense: 17, total: 1989, note: "#.280", enabled: true },
  { id: 16, cat: "4.", catName: "부대공", name: "비닐깔기", spec: "", unit: "m²", qty: 51, labor: 32, material: 647, expense: 0, total: 679, note: "#.281", enabled: true },
  { id: 17, cat: "4.", catName: "부대공", name: "물푸기", spec: "", unit: "hr", qty: 24, labor: 1139, material: 2463, expense: 635, total: 4237, note: "#.282", enabled: true },
];

const defaultSagubItems = [
  { id: 101, name: "합판거푸집(자재)", spec: "합판, 유로폼 등", unit: "m²", qty: 41, unitPrice: 12000, enabled: true },
  { id: 102, name: "부직포(자재)", spec: "부직포 원단", unit: "m²", qty: 72, unitPrice: 2500, enabled: true },
];

const defaultGwangubItems = [
  { id: 201, sub: "6.1", name: "레미콘", spec: "25-21-150", unit: "m³", qty: 51, unitPrice: 85000, enabled: true },
  { id: 202, sub: "6.2", name: "이형철근(SD400)", spec: "D13~D22", unit: "ton", qty: 2.6, unitPrice: 950000, enabled: true },
  { id: 203, sub: "6.3", name: "석재", spec: "석축용 할석", unit: "m²", qty: 51, unitPrice: 45000, enabled: true },
  { id: 204, sub: "6.3", name: "잡석", spec: "기초용", unit: "m³", qty: 26, unitPrice: 35000, enabled: true },
];

const defaultStructSpecs = {
  wallHeight: 2.5, wallLength: 20.5, wallThickness: 0.35,
  foundWidth: 2.5, foundDepth: 1.0, japseokThickness: 0.5,
  backfillWidth: 1.0, backfillDepth: 2.0,
  roadWidth: 2.0, roadThickness: 0.05,
};

const defaultDamageItems = [
  { id: 1, name: "석축 붕괴", basis: "붕괴 연장 약 20m × 높이 약 2.5m", qty: 50, unit: "㎡", enabled: true },
  { id: 2, name: "도로 포장 파손", basis: "파손 연장 약 20m × 폭 약 2.0m", qty: 40, unit: "㎡", enabled: true },
  { id: 3, name: "기초 세굴", basis: "세굴 연장 약 20m × 폭 2.5m × 깊이 1.0m", qty: 50, unit: "㎥", enabled: true },
  { id: 4, name: "토사 퇴적/유실", basis: "하천 내 토석 퇴적 및 사면 유실", qty: 80, unit: "㎥", enabled: true },
  { id: 5, name: "매설관 노출", basis: "노출 연장 약 15m (φ200~300mm 추정)", qty: 15, unit: "m", enabled: true },
  { id: 6, name: "사면 붕괴", basis: "도로 상부 사면 붕괴 면적", qty: 30, unit: "㎡", enabled: true },
];

// ═══════════════ 계산 함수 ═══════════════
function calcTotals(items, sagub, gwangub) {
  const enabled = items.filter(i => i.enabled);
  const cats = { "1.": 0, "2.": 0, "3.": 0, "4.": 0 };
  const catsLabor = { "1.": 0, "2.": 0, "3.": 0, "4.": 0 };
  const catsMat = { "1.": 0, "2.": 0, "3.": 0, "4.": 0 };
  const catsExp = { "1.": 0, "2.": 0, "3.": 0, "4.": 0 };
  enabled.forEach(i => {
    cats[i.cat] = (cats[i.cat] || 0) + Math.round(i.qty * i.total);
    catsLabor[i.cat] = (catsLabor[i.cat] || 0) + Math.round(i.qty * i.labor);
    catsMat[i.cat] = (catsMat[i.cat] || 0) + Math.round(i.qty * i.material);
    catsExp[i.cat] = (catsExp[i.cat] || 0) + Math.round(i.qty * i.expense);
  });
  const directTotal = Object.values(cats).reduce((a, b) => a + b, 0);
  const sagubTotal = sagub.filter(s => s.enabled).reduce((a, s) => a + Math.round(s.qty * s.unitPrice), 0);
  const gwangubTotal = gwangub.filter(g => g.enabled).reduce((a, g) => a + Math.round(g.qty * g.unitPrice), 0);
  const gwangubFee = Math.round(gwangubTotal * 0.015);
  const grandTotal = directTotal + sagubTotal + gwangubTotal + gwangubFee;
  return { cats, catsLabor, catsMat, catsExp, directTotal, sagubTotal, gwangubTotal, gwangubFee, grandTotal };
}

// ═══════════════ SVG 단면도 ═══════════════
function CrossSectionSVG({ specs }) {
  const { wallHeight, wallThickness, foundWidth, foundDepth, japseokThickness, backfillWidth, roadWidth } = specs;
  const svgW = 600, svgH = 400, scale = 60;
  const ox = 120, oy = 280;
  const fw = foundWidth * scale, fd = foundDepth * scale, jt = japseokThickness * scale;
  const wh = wallHeight * scale, wt = wallThickness * scale, bw = backfillWidth * scale;
  const rw = roadWidth * scale, rt = 5;
  const groundY = oy, japBot = groundY + jt, foundBot = japBot + fd;
  const wallTop = groundY - wh, wallRight = ox + wt;

  const dim = (x1, y1, x2, y2, label, side = "left") => {
    const isVert = Math.abs(x1 - x2) < 2;
    if (isVert) {
      const xOff = side === "left" ? -35 : 25;
      return (<g key={label}><line x1={x1+xOff} y1={y1} x2={x1+xOff} y2={y2} stroke="#DC2626" strokeWidth="0.8" markerStart="url(#au)" markerEnd="url(#ad)"/><line x1={x1+xOff-5} y1={y1} x2={x1+xOff+5} y2={y1} stroke="#DC2626" strokeWidth="0.5"/><line x1={x1+xOff-5} y1={y2} x2={x1+xOff+5} y2={y2} stroke="#DC2626" strokeWidth="0.5"/><text x={x1+xOff-8} y={(y1+y2)/2+3} fill="#DC2626" fontSize="9" textAnchor="end" fontWeight="600">{label}</text></g>);
    }
    const yOff = side === "top" ? -12 : 15;
    return (<g key={label}><line x1={x1} y1={y1+yOff} x2={x2} y2={y1+yOff} stroke="#2563EB" strokeWidth="0.8" markerStart="url(#al)" markerEnd="url(#ar)"/><line x1={x1} y1={y1+yOff-5} x2={x1} y2={y1+yOff+5} stroke="#2563EB" strokeWidth="0.5"/><line x1={x2} y1={y1+yOff-5} x2={x2} y2={y1+yOff+5} stroke="#2563EB" strokeWidth="0.5"/><text x={(x1+x2)/2} y={y1+yOff-3} fill="#2563EB" fontSize="9" textAnchor="middle" fontWeight="600">{label}</text></g>);
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
      {[0,15,30,45,60].map(i=>(<path key={i} d={`M${40+i},${groundY+10} Q${47+i},${groundY+6} ${54+i},${groundY+10}`} fill="none" stroke="#93C5FD" strokeWidth="0.8"/>))}
      <rect x={ox-10} y={groundY} width={fw+20} height={jt} fill="url(#gravel)" stroke="#78716C" strokeWidth="1"/>
      <text x={ox+fw/2} y={groundY+jt/2+3} fontSize="8" fill="#57534E" textAnchor="middle" fontWeight="500">잡석기초</text>
      <rect x={ox-5} y={japBot} width={fw+10} height={fd} fill="#E2E8F0" stroke="#475569" strokeWidth="1.2"/>
      <text x={ox+fw/2} y={japBot+fd/2+3} fontSize="8" fill="#334155" textAnchor="middle" fontWeight="600">기초 콘크리트</text>
      <text x={ox+fw/2} y={japBot+fd/2+14} fontSize="7" fill="#64748B" textAnchor="middle">25-21-150</text>
      <rect x={ox} y={wallTop} width={wt} height={wh} fill="#D6D3D1" stroke="#57534E" strokeWidth="1.5"/>
      {Array.from({length:Math.floor(wh/12)},(_, i)=>(<g key={i}><line x1={ox+2} y1={wallTop+i*12+12} x2={wallRight-2} y2={wallTop+i*12+12} stroke="#A8A29E" strokeWidth="0.5"/>{i%2===0&&<line x1={ox+wt/2} y1={wallTop+i*12} x2={ox+wt/2} y2={wallTop+i*12+12} stroke="#A8A29E" strokeWidth="0.5"/>}</g>))}
      <text x={ox+wt/2} y={wallTop+wh/2} fontSize="8" fill="#44403C" textAnchor="middle" fontWeight="600" transform={`rotate(-90,${ox+wt/2},${wallTop+wh/2})`}>석축 찰쌓기</text>
      <rect x={wallRight} y={wallTop} width={bw} height={wh} fill="url(#dots)" stroke="#78716C" strokeWidth="0.8"/>
      <text x={wallRight+bw/2} y={wallTop+wh/2+3} fontSize="7" fill="#57534E" textAnchor="middle">뒤채움</text>
      <line x1={wallRight} y1={wallTop} x2={wallRight} y2={groundY} stroke="#7C3AED" strokeWidth="2.5" strokeDasharray="4,2"/>
      <text x={wallRight+4} y={wallTop+12} fontSize="7" fill="#7C3AED" fontWeight="500">부직포</text>
      <rect x={wallRight+bw-5} y={wallTop-rt} width={rw} height={rt} fill="#1F2937" stroke="#111827" strokeWidth="0.8"/>
      <text x={wallRight+bw+rw/2-5} y={wallTop-rt-4} fontSize="7" fill="#374151" textAnchor="middle">도로 (As포장)</text>
      <rect x={wallRight+bw-5} y={wallTop} width={rw} height={15} fill="#F1F5F9" stroke="#9CA3AF" strokeWidth="0.5"/>
      {dim(ox, wallTop, ox, groundY, `H=${wallHeight}m`, "left")}
      {dim(ox-5, groundY, ox-5, groundY+jt, `${japseokThickness}m`, "left")}
      {dim(ox-5, japBot, ox-5, foundBot, `D=${foundDepth}m`, "left")}
      {dim(ox, groundY, ox+fw, groundY, `B=${foundWidth}m`, "top")}
      {dim(ox, wallTop, wallRight, wallTop, `T=${wallThickness}m`, "top")}
      {dim(wallRight, wallTop, wallRight+bw, wallTop, `${backfillWidth}m`, "top")}
      <g transform="translate(420,55)">
        <rect width="155" height="100" fill="white" stroke="#E2E8F0" rx="4"/>
        <text x="8" y="15" fontSize="8" fontWeight="bold" fill="#334155">범 례</text>
        <rect x="8" y="22" width="14" height="8" fill="#D6D3D1" stroke="#57534E" strokeWidth="0.5"/><text x="26" y="29" fontSize="7" fill="#475569">석축 찰쌓기 (T={wallThickness}m)</text>
        <rect x="8" y="34" width="14" height="8" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5"/><text x="26" y="41" fontSize="7" fill="#475569">기초 콘크리트 (D={foundDepth}m)</text>
        <rect x="8" y="46" width="14" height="8" fill="url(#gravel)" stroke="#78716C" strokeWidth="0.5"/><text x="26" y="53" fontSize="7" fill="#475569">잡석기초 (T={japseokThickness}m)</text>
        <rect x="8" y="58" width="14" height="8" fill="url(#dots)" stroke="#78716C" strokeWidth="0.5"/><text x="26" y="65" fontSize="7" fill="#475569">뒤채움 (소형장비 다짐)</text>
        <line x1="8" y1="74" x2="22" y2="74" stroke="#7C3AED" strokeWidth="2.5" strokeDasharray="4,2"/><text x="26" y="77" fontSize="7" fill="#475569">부직포</text>
        <rect x="8" y="82" width="14" height="5" fill="#1F2937" stroke="#111827" strokeWidth="0.5"/><text x="26" y="88" fontSize="7" fill="#475569">아스팔트 포장</text>
      </g>
    </svg>
  );
}

// ═══════════════ 공통 UI 컴포넌트 ═══════════════
function SectionTitle({ num, title }) {
  return (<div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">{num}</div><h2 className="text-lg font-bold text-slate-800">{title}</h2></div>);
}
function InfoCard({ title, color, children }) {
  const s = color === "blue" ? { bg: "bg-blue-50", border: "border-blue-200", txt: "text-blue-700" } : { bg: "bg-red-50", border: "border-red-200", txt: "text-red-700" };
  return (<div className={`${s.bg} border ${s.border} rounded-lg p-5`}><h4 className={`font-bold ${s.txt} text-sm mb-3`}>{title}</h4><div className="space-y-2">{children}</div></div>);
}
function InfoRow({ label, value, highlight }) {
  return (<div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className={highlight ? "font-bold text-red-600" : "font-medium text-slate-800"}>{value}</span></div>);
}
function SumCard({ label, value, color, bold }) {
  const c = { blue:"bg-blue-50 border-blue-200 text-blue-700", orange:"bg-orange-50 border-orange-200 text-orange-600", red:"bg-red-50 border-red-200 text-red-600", pink:"bg-pink-50 border-pink-200 text-pink-600", slate:"bg-slate-800 border-slate-700 text-white" };
  return (<div className={`rounded-lg border p-3 ${c[color]}`}><p className="text-xs opacity-75">{label}</p><p className={`${bold?"text-lg":"text-sm"} font-bold mt-1`}>{fmt(value)}원</p></div>);
}
function StructCard({ title, specs, color }) {
  const c = { blue:{bg:"bg-blue-50",border:"border-blue-200",title:"text-blue-700",dot:"bg-blue-400"}, red:{bg:"bg-red-50",border:"border-red-200",title:"text-red-700",dot:"bg-red-400"}, amber:{bg:"bg-amber-50",border:"border-amber-200",title:"text-amber-700",dot:"bg-amber-400"} }[color];
  return (<div className={`${c.bg} border ${c.border} rounded-lg p-5`}><h4 className={`font-bold ${c.title} text-sm mb-4`}>{title}</h4><div className="space-y-2.5">{specs.map((s,i)=>(<div key={i} className="flex items-start gap-2 text-sm"><span className={`${c.dot} w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0`}/><span className="text-slate-500 w-16 flex-shrink-0">{s.k}</span><span className="font-medium text-slate-800">{s.v}</span></div>))}</div></div>);
}

// ═══════════════ AI 분석 화면 ═══════════════
function AnalysisView({ totals, structSpecs, setStructSpecs, editMode, damageItems, setDamageItems, imagePreview, imageInputRef, handleImageUpload, onImageClick }) {
  const toggleDamage = (id) => setDamageItems(p => p.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  const updateDamage = (id, field, val) => setDamageItems(p => p.map(d => d.id !== id ? d : { ...d, [field]: field === "qty" ? parseFloat(val) || 0 : val }));
  const addDamage = () => { const mx = Math.max(...damageItems.map(d => d.id), 0); setDamageItems(p => [...p, { id: mx + 1, name: "새 항목", basis: "", qty: 0, unit: "㎡", enabled: true }]); };

  return (
    <div className="space-y-6">
      {/* 현장 사진 - 사진이 있거나 편집모드일 때만 표시 */}
      {(imagePreview || editMode) && (
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <SectionTitle num="0" title="현장 사진" />
        <div className="mt-4">
          {imagePreview ? (
            <div className="space-y-3">
              <div className="relative cursor-pointer group" onClick={onImageClick}>
                <img src={imagePreview} alt="현장사진" className="w-full max-h-80 object-contain rounded-lg border border-slate-200" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-lg transition-all">🔍 클릭하여 확대</span>
                </div>
              </div>
              {editMode && (
                <div className="flex gap-2">
                  <button onClick={()=>imageInputRef.current?.click()} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300 font-medium">📷 사진 변경</button>
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          ) : editMode ? (
            <div>
              <div onClick={()=>imageInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                <div className="text-4xl mb-3">📷</div>
                <p className="text-sm font-medium text-slate-600">현장 피해 사진을 첨부하세요</p>
                <p className="text-xs text-slate-400 mt-1">클릭하여 파일 선택 (JPG, PNG)</p>
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          ) : null}
        </div>
      </section>
      )}

      {/* 종합 분석 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <SectionTitle num="1" title="종합 분석" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          <InfoCard title="현장 제원" color="blue">
            <InfoRow label="피해 위치" value="좌안 (도로변 석축 호안)" />
            <InfoRow label="피해 연장" value="약 20m" /><InfoRow label="석축 높이" value="약 2.5m (찰쌓기)" />
            <InfoRow label="기초 세굴 깊이" value="약 1.0m" /><InfoRow label="도로 파손" value="약 20m × 2.0m" />
            <InfoRow label="매설관 노출" value="약 15m (φ200~300mm)" />
          </InfoCard>
          <InfoCard title="피해 원인 및 판정" color="red">
            <InfoRow label="1차 원인" value="집중호우 시 하천 급류 수충" />
            <InfoRow label="2차 원인" value="석축 기초 세굴 → 전면 붕괴" />
            <InfoRow label="3차 피해" value="도로 노면 함몰 + 관로 노출" />
            <InfoRow label="복구 판정" value="개선복구 (구조 신설)" highlight />
            <InfoRow label="설계 기준" value="기초 근입 D=1.0m 이상" />
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
          {editMode && <button onClick={addDamage} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">+ 항목 추가</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-slate-100">
              {editMode && <th className="border border-slate-300 px-2 py-2 w-8 text-center">✓</th>}
              <th className="border border-slate-300 px-3 py-2 w-10 text-center">순번</th>
              <th className="border border-slate-300 px-3 py-2 text-center">항목</th>
              <th className="border border-slate-300 px-3 py-2 text-center">산출근거</th>
              <th className="border border-slate-300 px-3 py-2 w-16 text-center">수량</th>
              <th className="border border-slate-300 px-3 py-2 w-12 text-center">단위</th>
            </tr></thead>
            <tbody>{damageItems.map((d, idx) => (
              <tr key={d.id} className={`${!d.enabled ? "opacity-40 line-through" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                {editMode && <td className="border border-slate-200 px-2 py-1.5 text-center"><input type="checkbox" checked={d.enabled} onChange={() => toggleDamage(d.id)} className="w-4 h-4" /></td>}
                <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500">{idx + 1}</td>
                <td className="border border-slate-200 px-3 py-1.5">{editMode ? <input value={d.name} onChange={e => updateDamage(d.id, "name", e.target.value)} className="w-full px-1 py-0.5 border rounded text-sm" /> : d.name}</td>
                <td className="border border-slate-200 px-3 py-1.5 text-slate-600">{editMode ? <input value={d.basis} onChange={e => updateDamage(d.id, "basis", e.target.value)} className="w-full px-1 py-0.5 border rounded text-sm" /> : d.basis}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center font-medium">{editMode ? <input type="number" value={d.qty} onChange={e => updateDamage(d.id, "qty", e.target.value)} className="w-16 px-1 py-0.5 border rounded text-sm text-center" /> : d.qty}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center">{d.unit}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      {/* 주요구조물 + 단면도 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <SectionTitle num="3" title="주요구조물 제원" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          <StructCard title="석축 (찰쌓기)" color="blue" specs={[{k:"형식",v:"찰쌓기 석축"},{k:"두께",v:`T = ${structSpecs.wallThickness}m`},{k:"높이",v:`H = ${structSpecs.wallHeight}m`},{k:"연장",v:`L = ${structSpecs.wallLength}m`}]} />
          <StructCard title="기초 콘크리트" color="red" specs={[{k:"규격",v:"25-21-150"},{k:"폭",v:`B = ${structSpecs.foundWidth}m`},{k:"근입",v:`D = ${structSpecs.foundDepth}m`},{k:"잡석",v:`T = ${structSpecs.japseokThickness}m`}]} />
          <StructCard title="부대시설" color="amber" specs={[{k:"부직포",v:"뒤채움 배면 전면 설치"},{k:"뒤채움",v:`소형장비 다짐 (B=${structSpecs.backfillWidth}m)`},{k:"포장",v:`As 절삭+덧씌우기 (W=${structSpecs.roadWidth}m)`},{k:"물푸기",v:"24hr (시공 중 배수)"}]} />
        </div>
        <div className="mt-6"><h3 className="text-sm font-bold text-slate-700 mb-3">설계 표준 단면도 (구조물 제원 기반 자동 생성)</h3><CrossSectionSVG specs={structSpecs} /></div>
        {editMode && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="text-sm font-bold text-amber-700 mb-3">구조물 제원 수정 (단면도 실시간 반영)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[["wallHeight","석축 높이(m)"],["wallLength","석축 연장(m)"],["wallThickness","석축 두께(m)"],["foundWidth","기초 폭(m)"],["foundDepth","기초 근입(m)"],["japseokThickness","잡석 두께(m)"],["backfillWidth","뒤채움 폭(m)"],["roadWidth","도로 폭(m)"]].map(([k,l])=>(
                <div key={k}><label className="text-slate-600">{l}</label><input type="number" step="0.1" value={structSpecs[k]} onChange={e=>setStructSpecs(p=>({...p,[k]:parseFloat(e.target.value)||0}))} className="w-full mt-1 px-2 py-1.5 border rounded text-sm"/></div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SumCard label="직접공사비" value={totals.directTotal} color="blue" />
        <SumCard label="사급자재비" value={totals.sagubTotal} color="orange" />
        <SumCard label="관급자재비" value={totals.gwangubTotal} color="red" />
        <SumCard label="관급수수료" value={totals.gwangubFee} color="pink" />
        <SumCard label="총공사비" value={totals.grandTotal} color="slate" bold />
      </div>
    </div>
  );
}

// ═══════════════ 설계내역서 화면 ═══════════════
function EstimateView({ items, setItems, sagub, setSagub, gwangub, setGwangub, totals, editMode }) {
  const catOrder = ["1.","2.","3.","4."];
  const catNames = {"1.":"토공","2.":"구조물공","3.":"포장공","4.":"부대공"};
  const toggleItem = id => setItems(p => p.map(i => i.id===id?{...i,enabled:!i.enabled}:i));
  const toggleSagub = id => setSagub(p => p.map(i => i.id===id?{...i,enabled:!i.enabled}:i));
  const toggleGwangub = id => setGwangub(p => p.map(i => i.id===id?{...i,enabled:!i.enabled}:i));
  const addItem = () => { const mx = Math.max(...items.map(i=>i.id),0); setItems(p=>[...p,{id:mx+1,cat:"4.",catName:"부대공",name:"새 공종",spec:"",unit:"m²",qty:1,labor:0,material:0,expense:0,total:0,note:"",enabled:true}]); };
  const updateItem = (id, field, value) => { setItems(p => p.map(i => { if (i.id!==id) return i; const u={...i,[field]:field==="qty"?parseFloat(value)||0:value}; if (["labor","material","expense"].includes(field)){u[field]=parseInt(value)||0;u.total=u.labor+u.material+u.expense;} return u; })); };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle num="2" title="설계 내역서" />
          {editMode && <button onClick={addItem} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">+ 공종 추가</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-700 text-white">
                {editMode && <th rowSpan={2} className="border border-slate-500 px-1 py-2 w-8 text-center">✓</th>}
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
              <tr className="bg-slate-600 text-white">
                {["단가","금액","단가","금액","단가","금액","단가","금액"].map((t,i)=>(<th key={i} className="border border-slate-500 px-1 py-1 text-center">{t}</th>))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-200 font-bold">
                {editMode && <td className="border border-slate-300"/>}
                <td colSpan={5} className="border border-slate-300 px-3 py-2 text-center tracking-widest text-slate-700">순 공 사 비</td>
                <td className="border border-slate-300"/>
                <td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(totals.directTotal)}</td>
                <td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(Object.values(totals.catsLabor).reduce((a,b)=>a+b,0))}</td>
                <td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(Object.values(totals.catsMat).reduce((a,b)=>a+b,0))}</td>
                <td className="border border-slate-300"/><td className="border border-slate-300 px-2 py-2 text-right text-blue-700">{fmt(Object.values(totals.catsExp).reduce((a,b)=>a+b,0))}</td>
              </tr>
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
          <SumCard label="직접공사비" value={totals.directTotal} color="blue" />
          <SumCard label="사급자재비" value={totals.sagubTotal} color="orange" />
          <SumCard label="관급자재비" value={totals.gwangubTotal} color="red" />
          <SumCard label="관급수수료" value={totals.gwangubFee} color="pink" />
          <SumCard label="총공사비" value={totals.grandTotal} color="slate" bold />
        </div>
      </section>
    </div>
  );
}

// ═══════════════ 메인 앱 ═══════════════
export default function App() {
  const [view, setView] = useState("analysis");
  const [items, setItems] = useState(defaultDesignItems);
  const [sagub, setSagub] = useState(defaultSagubItems);
  const [gwangub, setGwangub] = useState(defaultGwangubItems);
  const [structSpecs, setStructSpecs] = useState(defaultStructSpecs);
  const [damageItems, setDamageItems] = useState(defaultDamageItems);
  const [editMode, setEditMode] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const totals = calcTotals(items, sagub, gwangub);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file); e.target.value = "";
  };

  const saveToFile = () => {
    const data = JSON.stringify({ items, sagub, gwangub, structSpecs, damageItems, savedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `소규모주민숙원사업_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const loadFromFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { const d = JSON.parse(ev.target.result); if(d.items)setItems(d.items);if(d.sagub)setSagub(d.sagub);if(d.gwangub)setGwangub(d.gwangub);if(d.structSpecs)setStructSpecs(d.structSpecs);if(d.damageItems)setDamageItems(d.damageItems);if(d.imagePreview)setImagePreview(d.imagePreview);else setImagePreview("loaded");alert("불러오기 완료");} catch{alert("파일 오류");} };
    reader.readAsText(file); e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ══════ 사진 미업로드 상태: 초기 화면 ══════ */}
      {!imagePreview ? (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-800">종합검토보고서</h1>
              <p className="text-sm text-slate-500 mt-2">하천 수해복구 설계 분석 시스템</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              <div onClick={()=>imageInputRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                <div className="text-5xl mb-4">📷</div>
                <p className="text-base font-medium text-slate-700">현장 피해 사진을 첨부하세요</p>
                <p className="text-sm text-slate-400 mt-2">클릭하여 파일 선택 (JPG, PNG)</p>
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <div className="mt-6 flex justify-center gap-3">
                <button onClick={()=>fileInputRef.current?.click()} className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 font-medium">📂 이전 데이터 불러오기</button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={loadFromFile} className="hidden"/>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-6">2025년 단가목록 적용 (충청북도)</p>
          </div>
        </div>
      ) : (
      /* ══════ 사진 업로드 완료: 보고서 전체 ══════ */
      <>
      {/* 상단 네비게이션 */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-base font-bold text-slate-800 hidden sm:block">종합검토보고서</h1>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={()=>setView("analysis")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view==="analysis"?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:text-slate-800 hover:bg-slate-200"}`}>
                🔍 AI 분석
              </button>
              <button onClick={()=>setView("estimate")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view==="estimate"?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:text-slate-800 hover:bg-slate-200"}`}>
                📋 설계내역서
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={saveToFile} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">💾 저장</button>
              <button onClick={()=>fileInputRef.current?.click()} className="px-3 py-1.5 bg-slate-600 text-white text-xs rounded-lg hover:bg-slate-700 font-medium">📂 열기</button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={loadFromFile} className="hidden"/>
              <button onClick={()=>setEditMode(!editMode)} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${editMode?"bg-amber-500 text-white":"bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>{editMode?"✏️ 편집중":"✏️ 편집"}</button>
            </div>
          </div>
        </div>
      </div>

      {/* 서브헤더 */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">좌안</span>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">개선복구</span>
              <span className="text-sm text-slate-600">하천 석축 붕괴 피해 복구 설계</span>
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
          ? <AnalysisView totals={totals} structSpecs={structSpecs} setStructSpecs={setStructSpecs} editMode={editMode} damageItems={damageItems} setDamageItems={setDamageItems} imagePreview={imagePreview} imageInputRef={imageInputRef} handleImageUpload={handleImageUpload} onImageClick={()=>setShowImageModal(true)} />
          : <EstimateView items={items} setItems={setItems} sagub={sagub} setSagub={setSagub} gwangub={gwangub} setGwangub={setGwangub} totals={totals} editMode={editMode} />
        }
      </div>

      {/* 사진 전체화면 모달 */}
      {showImageModal && imagePreview && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={()=>setShowImageModal(false)}>
          <button onClick={()=>setShowImageModal(false)} className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-red-400 z-[101]">✕</button>
          <img src={imagePreview} alt="현장사진 확대" className="max-w-full max-h-full object-contain rounded-lg" onClick={e=>e.stopPropagation()} />
        </div>
      )}

      <div className="text-center text-xs text-slate-400 py-6 border-t border-slate-100">
        <p>상세 수량산출 근거는 엑셀 파일 참조</p>
        <p className="mt-1">종합검토보고서 v7.1 — 2025년 단가목록 적용 (충청북도)</p>
      </div>
      </>
      )}
    </div>
  );
}
