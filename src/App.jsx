import { useState, useRef, useCallback, useMemo } from "react";

/* ============================================================
   소규모주민숙원사업 종합검토보고서 v7.2
   수정사항 3건:
   ① 체크박스 전체선택/해제 기능
   ② 엑셀 3종 브라우저 직접 생성 (SheetJS, 서버 불필요)
   ③ 피해현황 설계물량 ↔ 내역서 물량 연동
   ============================================================ */

const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const fmtDec = (n, unit) => {
  if (unit === "ton" || unit === "톤") return (n ?? 0).toFixed(3);
  return (n ?? 0).toFixed(2);
};

/* ========== 2025 충청북도 단가 DB ========== */
const PRICE_DB = {
  "#.22": { name:"표토제거", spec:"T=20CM, 굴삭기0.7㎥(답외)", unit:"m²", labor:191, material:59, expense:80, total:330 },
  "#.28": { name:"흙깍기", spec:"보통토사,소규모,굴착기1.0㎥", unit:"m³", labor:1472, material:774, expense:747, total:2993 },
  "#.57": { name:"구조물터파기", spec:"육상토사,기계100%", unit:"m³", labor:1035, material:323, expense:435, total:1793 },
  "#.68": { name:"뒤채움 및 다짐", spec:"소형장비", unit:"m³", labor:9507, material:1337, expense:1467, total:12311 },
  "#.70": { name:"되메우기 및 다짐", spec:"소형장비", unit:"m³", labor:8044, material:1131, expense:1241, total:10416 },
  "#.77": { name:"기초지정(잡석)", spec:"잡석", unit:"m³", labor:9421, material:956, expense:1360, total:11737 },
  "#.87": { name:"절토사면 녹화", spec:"T=10㎝", unit:"m²", labor:28320, material:22842, expense:4324, total:55486 },
  "#.127":{ name:"사토운반", spec:"토사,L=5.0KM", unit:"m³", labor:4001, material:1876, expense:1525, total:7402 },
  "#.155":{ name:"석축쌓기", spec:"찰쌓기,T=35cm이하", unit:"m²", labor:50146, material:4625, expense:8819, total:63590 },
  "#.172":{ name:"레미콘타설(장비)", spec:"철근구조물", unit:"m³", labor:25892, material:2982, expense:3837, total:32711 },
  "#.193":{ name:"레미콘타설(펌프차)", spec:"철근(S:8-12cm),TYPE-Ⅱ", unit:"m³", labor:17078, material:2556, expense:4540, total:24174 },
  "#.204":{ name:"합판거푸집", spec:"(4회) 보통", unit:"m²", labor:37861, material:14845, expense:0, total:52706 },
  "#.216":{ name:"철근가공 및 조립", spec:"TYPE-1-1", unit:"ton", labor:763584, material:46877, expense:0, total:810461 },
  "#.276":{ name:"콘크리트양생", spec:"습윤양생", unit:"m²", labor:1426, material:472, expense:231, total:2129 },
  "#.280":{ name:"부직포설치", spec:"", unit:"m²", labor:279, material:1693, expense:17, total:1989 },
  "#.281":{ name:"비닐깔기", spec:"", unit:"m²", labor:32, material:647, expense:0, total:679 },
  "#.282":{ name:"물푸기", spec:"", unit:"hr", labor:1139, material:2463, expense:635, total:4237 },
  "#.326":{ name:"절삭후아스팔트덧씌우기", spec:"B-Type(1회절삭,1회포장)", unit:"m²", labor:1873, material:919, expense:1189, total:3981 },
};

/* ========== 기본 설계 항목 ========== */
const makeDefaultItems = () => [
  { id:1, cat:"1.", catName:"토공", name:"표토제거", spec:"T=20CM, 굴삭기0.7㎥(답외)", unit:"m²", qty:35, priceId:"#.22", enabled:true },
  { id:2, cat:"1.", catName:"토공", name:"흙깍기", spec:"보통토사,소규모", unit:"m³", qty:40, priceId:"#.28", enabled:true },
  { id:3, cat:"1.", catName:"토공", name:"구조물터파기", spec:"육상토사,기계100%", unit:"m³", qty:51, priceId:"#.57", enabled:true },
  { id:4, cat:"2.", catName:"구조물공", name:"기초지정(잡석)", spec:"잡석", unit:"m³", qty:26, priceId:"#.77", enabled:true },
  { id:5, cat:"2.", catName:"구조물공", name:"레미콘타설(펌프차)", spec:"철근(S:8-12cm),TYPE-Ⅱ", unit:"m³", qty:51, priceId:"#.193", enabled:true },
  { id:6, cat:"2.", catName:"구조물공", name:"석축쌓기", spec:"찰쌓기,T=35cm이하", unit:"m²", qty:51, priceId:"#.155", enabled:true },
  { id:7, cat:"2.", catName:"구조물공", name:"합판거푸집", spec:"(4회) 보통", unit:"m²", qty:41, priceId:"#.204", enabled:true },
  { id:8, cat:"2.", catName:"구조물공", name:"철근가공 및 조립", spec:"TYPE-1-1", unit:"ton", qty:2.6, priceId:"#.216", enabled:true },
  { id:9, cat:"2.", catName:"구조물공", name:"콘크리트양생", spec:"습윤양생", unit:"m²", qty:92, priceId:"#.276", enabled:true },
  { id:10,cat:"4.", catName:"부대공", name:"부직포설치", spec:"", unit:"m²", qty:72, priceId:"#.280", enabled:true },
  { id:11,cat:"4.", catName:"부대공", name:"비닐깔기", spec:"", unit:"m²", qty:51, priceId:"#.281", enabled:true },
  { id:12,cat:"1.", catName:"토공", name:"뒤채움 및 다짐", spec:"소형장비", unit:"m³", qty:35, priceId:"#.68", enabled:true },
  { id:13,cat:"1.", catName:"토공", name:"되메우기 및 다짐", spec:"소형장비", unit:"m³", qty:20, priceId:"#.70", enabled:true },
  { id:14,cat:"1.", catName:"토공", name:"절토사면 녹화", spec:"T=10㎝", unit:"m²", qty:45, priceId:"#.87", enabled:true },
  { id:15,cat:"1.", catName:"토공", name:"사토운반", spec:"토사,L=5.0KM", unit:"m³", qty:40, priceId:"#.127", enabled:true },
  { id:16,cat:"4.", catName:"부대공", name:"물푸기", spec:"", unit:"hr", qty:24, priceId:"#.282", enabled:true },
  { id:17,cat:"3.", catName:"포장공", name:"절삭후아스팔트덧씌우기", spec:"B-Type(1회절삭,1회포장)", unit:"m²", qty:40, priceId:"#.326", enabled:true },
];

/* ========== 사급/관급 기본 데이터 ========== */
const makeSagubItems = () => [
  { id:101, name:"합판거푸집(자재)", spec:"합판,유로폼 등", unit:"m²", qty:41, unitPrice:12000 },
  { id:102, name:"부직포(자재)", spec:"부직포 원단", unit:"m²", qty:72, unitPrice:1500 },
];
const makeGwangubItems = () => [
  { id:201, sub:"6.1", name:"레미콘", spec:"25-210-12, S=12cm", unit:"m³", qty:51, unitPrice:75000 },
  { id:202, sub:"6.2", name:"이형철근(SD400)", spec:"HD13", unit:"ton", qty:2.6, unitPrice:950000 },
  { id:203, sub:"6.3", name:"석재", spec:"자연석,석축용", unit:"m²", qty:51, unitPrice:45000 },
  { id:204, sub:"6.3", name:"잡석", spec:"기초지정용", unit:"m³", qty:26, unitPrice:18000 },
];

const FEE_RATE = 0.015;

/* ========== 피해현황 기본 데이터 ========== */
const makeDefaultDamage = () => [
  { id:1, item:"석축 붕괴", basis:"붕괴 연장 약 20m × 높이 약 2.5m", qty:50, unit:"㎡", enabled:true },
  { id:2, item:"도로 포장 파손", basis:"파손 연장 약 20m × 폭 약 2.0m", qty:40, unit:"㎡", enabled:true },
  { id:3, item:"기초 세굴", basis:"세굴 연장 약 20m × 폭 2.5m × 깊이 1.0m", qty:50, unit:"㎥", enabled:true },
  { id:4, item:"토사 퇴적/유실", basis:"하천 내 토석 퇴적 및 사면 유실", qty:80, unit:"㎥", enabled:true },
  { id:5, item:"매설관 노출", basis:"노출 연장 약 15m (φ200~300mm 추정)", qty:15, unit:"m", enabled:true },
  { id:6, item:"사면 붕괴", basis:"도로 상부 사면 붕괴 면적", qty:30, unit:"㎡", enabled:true },
];

/* ========== 피해현황 → 설계물량 매핑 규칙 ========== */
// 피해현황 물량이 변경되면, 관련 설계항목의 수량도 자동 연동
const DAMAGE_TO_DESIGN_MAP = {
  // 피해현황 id → [{ designId, factor, addOffset }]
  1: [{ designId: 6, factor: 1.02, addOffset: 0 }],   // 석축붕괴 50㎡ → 석축쌓기 51㎡ (여유 2%)
  2: [{ designId: 17, factor: 1.0, addOffset: 0 }],    // 도로파손 40㎡ → 아스팔트 40㎡
  3: [{ designId: 3, factor: 1.02, addOffset: 0 },     // 기초세굴 → 구조물터파기
      { designId: 5, factor: 1.02, addOffset: 0 }],    // 기초세굴 → 레미콘타설
  4: [{ designId: 15, factor: 0.5, addOffset: 0 }],    // 토사 80㎥ → 사토운반 40㎥
  6: [{ designId: 14, factor: 1.5, addOffset: 0 }],    // 사면붕괴 30㎡ → 녹화 45㎡
};

/* ============================================================
   Excel Generation (Browser-side, SheetJS via CDN)
   ============================================================ */

// SheetJS CDN 로드 함수
const loadSheetJS = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("SheetJS 로드 실패"));
    document.head.appendChild(s);
  });
};

// 설계내역서 엑셀 생성
async function generateDesignExcel(items, sagub, gwangub, feeRate) {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();

  // 시트1: 내역서
  const activeItems = items.filter(i => i.enabled);
  const cats = ["1.","2.","3.","4."];
  const catNames = { "1.":"토공","2.":"구조물공","3.":"포장공","4.":"부대공" };

  const rows = [];
  rows.push(["설 계 내 역 서 (소규모주민숙원사업)","","","","","","","","","","","","",""]);
  rows.push(["단가근거: 2025년 충청북도 일위대가 목록표","","","","","","","","","","","","",""]);
  rows.push(["공종","품 명","규 격","수량","단위","합계 단가","합계 금액","노무비 단가","노무비 금액","재료비 단가","재료비 금액","경비 단가","경비 금액"]);

  let catTotals = {};
  cats.forEach(c => { catTotals[c] = { g:0, i:0, k:0, m:0 }; });

  // 대분류별 항목 정리
  cats.forEach(catCode => {
    const catItems = activeItems.filter(i => i.cat === catCode);
    if (catItems.length === 0) return;
    rows.push([catCode, catNames[catCode],"","","","","","","","","","","",""]);
    catItems.forEach(item => {
      const p = PRICE_DB[item.priceId] || {};
      const totalU = p.total||0, laborU = p.labor||0, matU = p.material||0, expU = p.expense||0;
      const q = item.qty;
      const gAmt = Math.round(q*totalU);
      const iAmt = Math.round(q*laborU);
      const kAmt = Math.round(q*matU);
      const mAmt = Math.round(q*expU);
      catTotals[catCode].g += gAmt;
      catTotals[catCode].i += iAmt;
      catTotals[catCode].k += kAmt;
      catTotals[catCode].m += mAmt;
      rows.push(["", item.name, item.spec||"", q, item.unit, totalU, gAmt, laborU, iAmt, matU, kAmt, expU, mAmt]);
    });
  });

  // 순공사비
  const sunG = cats.reduce((s,c) => s+(catTotals[c]?.g||0), 0);
  const sunI = cats.reduce((s,c) => s+(catTotals[c]?.i||0), 0);
  const sunK = cats.reduce((s,c) => s+(catTotals[c]?.k||0), 0);
  const sunM = cats.reduce((s,c) => s+(catTotals[c]?.m||0), 0);
  rows.push(["","순 공 사 비","","","","",sunG,"",sunI,"",sunK,"",sunM]);

  // 사급
  const sagubTotal = sagub.reduce((s,i) => s+Math.round(i.qty*i.unitPrice), 0);
  rows.push(["5.","사급자재대","","","","",sagubTotal,"","","","","",""]);
  sagub.forEach(item => {
    rows.push(["", item.name, item.spec, item.qty, item.unit, item.unitPrice, Math.round(item.qty*item.unitPrice),"","","","","",""]);
  });

  // 관급
  const gwangubTotal = gwangub.reduce((s,i) => s+Math.round(i.qty*i.unitPrice), 0);
  rows.push(["6.","관급자재대","","","","",gwangubTotal,"","","","","",""]);
  gwangub.forEach(item => {
    rows.push(["", item.name, item.spec, item.qty, item.unit, item.unitPrice, Math.round(item.qty*item.unitPrice),"","","","","",""]);
  });

  // 관급수수료
  const fee = Math.round(gwangubTotal * feeRate);
  rows.push(["","관급수수료 (1.5%)","","","","",fee,"","","","","",""]);

  // 총공사비
  const grand = sunG + sagubTotal + gwangubTotal + fee;
  rows.push(["","총 공 사 비","","","","",grand,"","","","","",""]);

  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1["!cols"] = [{wch:8},{wch:24},{wch:28},{wch:8},{wch:6},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws1, "내역서");

  // 시트2: 사급·관급 산출근거
  const rows2 = [];
  rows2.push(["사급·관급자재 산출근거","","","","","","","",""]);
  rows2.push(["No","품명","규격","수량","단위","자재단가","자재금액","산출근거","구분"]);
  rows2.push(["[ 사급자재 ]","","","","","","","",""]);
  sagub.forEach((item,i) => {
    rows2.push([i+1, item.name, item.spec, item.qty, item.unit, item.unitPrice, Math.round(item.qty*item.unitPrice), `${item.qty}${item.unit} × ${fmt(item.unitPrice)}원`, "사급"]);
  });
  rows2.push(["","사급자재 소계","","","","",sagubTotal,"",""]);
  rows2.push([]);
  rows2.push(["[ 관급자재 ]","","","","","","","",""]);
  gwangub.forEach((item,i) => {
    rows2.push([i+1, item.name, item.spec, item.qty, item.unit, item.unitPrice, Math.round(item.qty*item.unitPrice), `${item.qty}${item.unit} × ${fmt(item.unitPrice)}원`, "관급"]);
  });
  rows2.push(["","관급자재 소계","","","","",gwangubTotal,"",""]);
  rows2.push(["","관급수수료 (1.5%)","","","","",fee,`${fmt(gwangubTotal)} × 1.5%`,""]);
  rows2.push([]);
  rows2.push(["","사급+관급+수수료 합계","","","","",sagubTotal+gwangubTotal+fee,"",""]);

  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2["!cols"] = [{wch:5},{wch:20},{wch:25},{wch:10},{wch:6},{wch:14},{wch:14},{wch:65},{wch:22}];
  XLSX.utils.book_append_sheet(wb, ws2, "사급관급자재");

  XLSX.writeFile(wb, `설계내역서_소규모주민숙원_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
}

// 수량산출서 엑셀 생성
async function generateQuantityExcel(items, sagub, gwangub, feeRate) {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();
  const activeItems = items.filter(i => i.enabled);

  const rows = [];
  rows.push(["수 량 산 출 서 (소규모주민숙원사업)","","","","","","",""]);
  rows.push(["번호","공종명(ID)","규격","단위","자재구분","산출근거","수량","비고"]);

  activeItems.forEach((item, i) => {
    const p = PRICE_DB[item.priceId] || {};
    let matType = "해당없음";
    if (["기초지정(잡석)","레미콘타설(펌프차)","석축쌓기","철근가공 및 조립"].some(n => item.name.includes(n.split("(")[0]))) matType = "관급";
    if (["합판거푸집","부직포설치"].some(n => item.name.includes(n))) matType = "사급";
    rows.push([i+1, item.name, item.spec||"", item.unit, matType, `설계수량 ${fmtDec(item.qty, item.unit)}${item.unit}`, item.qty, item.priceId]);
  });

  // 관급수수료 행
  const gwangubTotal = gwangub.reduce((s,i) => s+Math.round(i.qty*i.unitPrice), 0);
  const fee = Math.round(gwangubTotal * feeRate);
  rows.push([activeItems.length+1, "관급수수료", "관급자재비×1.5%", "식", "관급", `관급자재비 ${fmt(gwangubTotal)}원 × 1.5% = ${fmt(fee)}원`, 1, ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:7},{wch:20},{wch:25},{wch:7},{wch:12},{wch:65},{wch:10},{wch:25}];
  XLSX.utils.book_append_sheet(wb, ws, "수량산출서");

  XLSX.writeFile(wb, `수량산출서_소규모주민숙원_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
}

// 일위대가 엑셀 생성
async function generateUnitPriceExcel(items) {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();
  const activeItems = items.filter(i => i.enabled);

  const usedPriceIds = [...new Set(activeItems.map(i => i.priceId))];
  const rows = [];
  rows.push(["일위대가 단가목록 (2025년 충청북도)","","","","","","","",""]);
  rows.push(["단가ID","공종명","규격","합계","노무비","재료비","경비","자재구분","비고"]);

  usedPriceIds.forEach(pid => {
    const p = PRICE_DB[pid];
    if (!p) return;
    let matType = "해당없음";
    if (["기초지정","레미콘","석축","철근"].some(n => p.name.includes(n))) matType = "관급(자재별도)";
    if (["합판거푸집","부직포"].some(n => p.name.includes(n))) matType = "사급(자재별도)";
    rows.push([pid, p.name, p.spec, p.total, p.labor, p.material, p.expense, matType, ""]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:10},{wch:25},{wch:30},{wch:14},{wch:14},{wch:14},{wch:14},{wch:12},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, "일위대가");

  XLSX.writeFile(wb, `일위대가_단가목록_소규모주민숙원_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
}

/* ============================================================
   Main Component
   ============================================================ */
export default function App() {
  const [view, setView] = useState("analysis"); // analysis | estimate
  const [designItems, setDesignItems] = useState(makeDefaultItems());
  const [damageItems, setDamageItems] = useState(makeDefaultDamage());
  const [sagubItems] = useState(makeSagubItems());
  const [gwangubItems] = useState(makeGwangubItems());
  const [editMode, setEditMode] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoModal, setPhotoModal] = useState(false);
  const [comment, setComment] = useState("");
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  /* ========== ③ 피해현황 → 설계물량 연동 ========== */
  const syncDamageToDesign = useCallback((newDamage) => {
    setDesignItems(prev => {
      const next = [...prev];
      newDamage.forEach(dmg => {
        const mappings = DAMAGE_TO_DESIGN_MAP[dmg.id];
        if (!mappings) return;
        mappings.forEach(m => {
          const idx = next.findIndex(d => d.id === m.designId);
          if (idx >= 0) {
            const newQty = Math.ceil(dmg.qty * m.factor + m.addOffset);
            next[idx] = { ...next[idx], qty: newQty };
          }
        });
      });
      return next;
    });
  }, []);

  const updateDamageQty = (id, newQty) => {
    const updated = damageItems.map(d => d.id === id ? { ...d, qty: Number(newQty) || 0 } : d);
    setDamageItems(updated);
    syncDamageToDesign(updated.filter(d => d.enabled));
  };

  /* ========== ① 체크박스 전체선택/해제 ========== */
  const allDamageChecked = damageItems.every(d => d.enabled);
  const someDamageChecked = damageItems.some(d => d.enabled);
  const toggleAllDamage = () => {
    const newVal = !allDamageChecked;
    setDamageItems(prev => prev.map(d => ({ ...d, enabled: newVal })));
  };

  const allDesignChecked = designItems.every(d => d.enabled);
  const someDesignChecked = designItems.some(d => d.enabled);
  const toggleAllDesign = () => {
    const newVal = !allDesignChecked;
    setDesignItems(prev => prev.map(d => ({ ...d, enabled: newVal })));
  };

  const toggleDamageItem = (id) => {
    setDamageItems(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  };
  const toggleDesignItem = (id) => {
    setDesignItems(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  };

  /* 설계물량 수량 편집 */
  const updateDesignQty = (id, newQty) => {
    setDesignItems(prev => prev.map(d => d.id === id ? { ...d, qty: Number(newQty) || 0 } : d));
  };

  /* ========== 금액 계산 (enabled 항목만) ========== */
  const activeDesign = useMemo(() => designItems.filter(i => i.enabled), [designItems]);

  const calcCatTotal = useCallback((catCode) => {
    return activeDesign.filter(i => i.cat === catCode).reduce((s, i) => {
      const p = PRICE_DB[i.priceId] || {};
      return { g: s.g + Math.round(i.qty * (p.total||0)),
               i: s.i + Math.round(i.qty * (p.labor||0)),
               k: s.k + Math.round(i.qty * (p.material||0)),
               m: s.m + Math.round(i.qty * (p.expense||0)) };
    }, { g:0, i:0, k:0, m:0 });
  }, [activeDesign]);

  const togong = calcCatTotal("1.");
  const gujo = calcCatTotal("2.");
  const pojang = calcCatTotal("3.");
  const budae = calcCatTotal("4.");
  const sunG = togong.g + gujo.g + pojang.g + budae.g;
  const sagubTotal = sagubItems.reduce((s,i) => s + Math.round(i.qty*i.unitPrice), 0);
  const gwangubTotal = gwangubItems.reduce((s,i) => s + Math.round(i.qty*i.unitPrice), 0);
  const gwangubFee = Math.round(gwangubTotal * FEE_RATE);
  const grandTotal = sunG + sagubTotal + gwangubTotal + gwangubFee;

  /* ========== JSON 저장/불러오기 ========== */
  const handleSaveJson = () => {
    const data = { version:"7.2", designItems, damageItems, sagubItems, gwangubItems, comment, savedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `소규모주민숙원_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const handleLoadJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.designItems) setDesignItems(data.designItems);
        if (data.damageItems) setDamageItems(data.damageItems);
        if (data.comment) setComment(data.comment);
        alert("불러오기 완료!");
      } catch { alert("파일 형식 오류"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* 사진 업로드 (표시용) */
  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file) setPhotoUrl(URL.createObjectURL(file));
  };

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Pretendard','Noto Sans KR',sans-serif" }}>
      {/* 타이틀 */}
      <div className="bg-slate-800 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-blue-300 text-xs font-medium tracking-widest mb-1">소규모주민숙원사업</p>
          <h1 className="text-2xl font-bold tracking-tight">종합검토보고서 <span className="text-sm font-normal text-slate-400">v7.2</span></h1>
          <p className="text-slate-400 mt-1 text-xs">좌안 석축 붕괴 구간 · 개선복구 · 2025년 충청북도 단가 적용</p>
        </div>
      </div>

      {/* 탭 + 도구 */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            <button onClick={() => setView("analysis")} className={`px-3 py-1.5 text-xs rounded font-medium ${view==="analysis"?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              AI 분석
            </button>
            <button onClick={() => setView("estimate")} className={`px-3 py-1.5 text-xs rounded font-medium ${view==="estimate"?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              설계내역서
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={handleSaveJson} className="px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">💾 저장</button>
            <button onClick={() => jsonInputRef.current?.click()} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">📂 불러오기</button>
            <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadJson} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* ============================================ */}
        {view === "analysis" && (
          <>
            {/* 사진 */}
            <section>
              <SectionTitle num="📷" title="현장 사진" />
              <div className="mt-3 flex gap-3 items-start flex-wrap">
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                  사진 업로드
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                {photoUrl && (
                  <img src={photoUrl} alt="현장" className="h-40 rounded border cursor-pointer hover:opacity-80" onClick={() => setPhotoModal(true)} />
                )}
              </div>
              {photoModal && photoUrl && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4" onClick={() => setPhotoModal(false)}>
                  <img src={photoUrl} alt="확대" className="max-w-full max-h-full rounded" />
                </div>
              )}
            </section>

            {/* 종합분석 */}
            <section>
              <SectionTitle num="1" title="종합 분석" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <InfoCard title="현장 제원" color="blue">
                  <InfoRow label="피해 위치" value="좌안 (도로변 석축 호안)" />
                  <InfoRow label="피해 연장" value="약 20m" />
                  <InfoRow label="석축 높이" value="약 2.5m (찰쌓기)" />
                  <InfoRow label="기초 세굴 깊이" value="약 1.0m" />
                  <InfoRow label="도로 파손" value="약 20m × 2.0m" />
                </InfoCard>
                <InfoCard title="피해 원인 및 판정" color="red">
                  <InfoRow label="1차 원인" value="집중호우 시 하천 급류 수충" />
                  <InfoRow label="2차 원인" value="석축 기초 세굴 → 전면 붕괴" />
                  <InfoRow label="3차 피해" value="도로 노면 함몰 + 관로 노출" />
                  <InfoRow label="설계 기준" value="기초 근입 D=1.0m 이상" />
                </InfoCard>
              </div>
              {/* 관급자재 요약 */}
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-slate-500">품목</span><p className="font-semibold text-slate-800 mt-0.5">레미콘, 철근, 석재, 잡석</p></div>
                  <div><span className="text-slate-500">관급자재비</span><p className="font-bold text-red-600 mt-0.5">{fmt(gwangubTotal)}원</p></div>
                  <div><span className="text-slate-500">수수료율</span><p className="font-semibold text-slate-800 mt-0.5">1.5%</p></div>
                  <div><span className="text-slate-500">관급수수료</span><p className="font-bold text-red-600 mt-0.5">{fmt(gwangubFee)}원</p></div>
                </div>
              </div>
            </section>

            {/* ========== 피해현황 (체크박스 + 전체선택) ========== */}
            <section>
              <div className="flex items-center justify-between">
                <SectionTitle num="2" title="피해 현황 (설계물량)" />
                <button onClick={() => setEditMode(!editMode)} className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">
                  {editMode ? "✅ 편집완료" : "✏️ 편집"}
                </button>
              </div>
              <p className="text-xs text-orange-600 mt-1">* 피해현황 수량 변경 시 설계내역서 물량이 자동 연동됩니다</p>
              <div className="mt-3 overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      {editMode && (
                        <th className="border border-blue-600 px-2 py-1.5 w-8">
                          <input type="checkbox" checked={allDamageChecked} ref={el => { if(el) el.indeterminate = !allDamageChecked && someDamageChecked; }}
                            onChange={toggleAllDamage} className="w-4 h-4" title="전체선택/해제" />
                        </th>
                      )}
                      <th className="border border-blue-600 px-2 py-1.5 w-8">No</th>
                      <th className="border border-blue-600 px-2 py-1.5">항목</th>
                      <th className="border border-blue-600 px-2 py-1.5">산출근거</th>
                      <th className="border border-blue-600 px-2 py-1.5 w-16">수량</th>
                      <th className="border border-blue-600 px-2 py-1.5 w-12">단위</th>
                    </tr>
                  </thead>
                  <tbody>
                    {damageItems.map((d, idx) => (
                      <tr key={d.id} className={`${!d.enabled ? "bg-slate-100 opacity-50" : idx%2===0 ? "bg-white" : "bg-slate-50"}`}>
                        {editMode && (
                          <td className="border border-slate-200 px-2 py-1 text-center">
                            <input type="checkbox" checked={d.enabled} onChange={() => toggleDamageItem(d.id)} className="w-4 h-4" />
                          </td>
                        )}
                        <td className="border border-slate-200 px-2 py-1 text-center">{idx+1}</td>
                        <td className="border border-slate-200 px-2 py-1">{d.item}</td>
                        <td className="border border-slate-200 px-2 py-1 text-slate-600">{d.basis}</td>
                        <td className="border border-slate-200 px-2 py-1 text-center font-medium">
                          {editMode ? (
                            <input type="number" value={d.qty} onChange={(e) => updateDamageQty(d.id, e.target.value)}
                              className="w-full text-center border rounded px-1 py-0.5 text-sm" />
                          ) : d.qty}
                        </td>
                        <td className="border border-slate-200 px-2 py-1 text-center">{d.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 메모/수정사항 */}
            <section>
              <SectionTitle num="📝" title="수정사항 / 메모" />
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="수정사항, 현장명, 하천명 등을 입력하세요..."
                className="w-full mt-2 border border-slate-300 rounded p-3 text-sm h-20 resize-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400" />
            </section>

            {/* 주요 구조물 제원 */}
            <section>
              <SectionTitle num="3" title="주요 구조물 제원" />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <StructCard title="석축 (찰쌓기)" specs={[
                  {k:"형식",v:"찰쌓기 석축 (자연석)"},{k:"높이",v:"H = 2.5m"},{k:"두께",v:"T = 35cm 이하"},{k:"연장",v:"L = 20.5m"},{k:"기초 근입",v:"D = 1.0m"},
                ]} color="blue" />
                <StructCard title="기초 콘크리트" specs={[
                  {k:"규격",v:"25-210-12 (철근콘크리트)"},{k:"폭",v:"B = 2.5m"},{k:"깊이",v:"D = 1.0m"},{k:"연장",v:"L = 20.5m"},{k:"철근",v:"HD13 @200, SD400"},
                ]} color="red" />
                <StructCard title="기초 지정 (잡석다짐)" specs={[
                  {k:"재료",v:"잡석 (기계다짐)"},{k:"폭",v:"B = 2.5m"},{k:"두께",v:"T = 0.5m"},{k:"연장",v:"L = 20.5m"},{k:"부직포",v:"기초 하부 + 석축 배면"},
                ]} color="amber" />
              </div>
            </section>

            {/* 설계단면도 */}
            <section>
              <SectionTitle num="4" title="설계 단면도 (개략)" />
              <div className="mt-3 flex justify-center">
                <CrossSectionSVG />
              </div>
            </section>
          </>
        )}

        {/* ============================================ */}
        {view === "estimate" && (
          <>
            {/* 설계물량 편집 테이블 (체크박스 + 전체선택) */}
            <section>
              <div className="flex items-center justify-between">
                <SectionTitle num="📋" title="설계물량 (체크박스 편집)" />
                <button onClick={() => setEditMode(!editMode)} className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">
                  {editMode ? "✅ 편집완료" : "✏️ 편집"}
                </button>
              </div>
              {editMode && (
                <div className="mt-3 overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="border border-slate-600 px-2 py-1.5 w-8">
                          <input type="checkbox" checked={allDesignChecked} ref={el => { if(el) el.indeterminate = !allDesignChecked && someDesignChecked; }}
                            onChange={toggleAllDesign} className="w-4 h-4" title="전체선택/해제" />
                        </th>
                        <th className="border border-slate-600 px-2 py-1.5 w-8">공종</th>
                        <th className="border border-slate-600 px-2 py-1.5">품명</th>
                        <th className="border border-slate-600 px-2 py-1.5">규격</th>
                        <th className="border border-slate-600 px-2 py-1.5 w-14">수량</th>
                        <th className="border border-slate-600 px-2 py-1.5 w-10">단위</th>
                        <th className="border border-slate-600 px-2 py-1.5 w-14">단가ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {designItems.map((d) => (
                        <tr key={d.id} className={!d.enabled ? "bg-slate-100 opacity-50" : "bg-white"}>
                          <td className="border border-slate-200 px-2 py-1 text-center">
                            <input type="checkbox" checked={d.enabled} onChange={() => toggleDesignItem(d.id)} className="w-4 h-4" />
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-center font-medium">{d.cat}</td>
                          <td className="border border-slate-200 px-2 py-1">{d.name}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-500">{d.spec}</td>
                          <td className="border border-slate-200 px-1 py-1 text-center">
                            <input type="number" value={d.qty} step="0.1" onChange={(e) => updateDesignQty(d.id, e.target.value)}
                              className="w-full text-center border rounded px-1 py-0.5 text-xs" />
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-center">{d.unit}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center text-blue-600">{d.priceId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 13열 내역서 */}
            <section>
              <SectionTitle num="2" title="설계 내역서" />
              <p className="text-xs text-slate-500 mt-1 mb-3">단가근거: 2025년 충청북도 일위대가 목록표</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      <th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-10">공종</th>
                      <th rowSpan={2} className="border border-blue-600 px-2 py-1.5 w-32">품 명</th>
                      <th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-36">규 격</th>
                      <th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-10">수량</th>
                      <th rowSpan={2} className="border border-blue-600 px-1 py-1.5 w-8">단위</th>
                      <th colSpan={2} className="border border-blue-600 px-1 py-1 text-center">합 계</th>
                      <th colSpan={2} className="border border-blue-600 px-1 py-1 text-center">노 무 비</th>
                      <th colSpan={2} className="border border-blue-600 px-1 py-1 text-center">재 료 비</th>
                      <th colSpan={2} className="border border-blue-600 px-1 py-1 text-center">경 비</th>
                    </tr>
                    <tr className="bg-blue-600 text-white text-center">
                      {["단가","금액","단가","금액","단가","금액","단가","금액"].map((t, i) => (
                        <th key={i} className="border border-blue-500 px-1 py-1">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* 순공사비 */}
                    <TotalRow label="순 공 사 비" amounts={[sunG, togong.i+gujo.i+pojang.i+budae.i, togong.k+gujo.k+pojang.k+budae.k, togong.m+gujo.m+pojang.m+budae.m]} bg="bg-slate-200" text="text-slate-800" />

                    {/* 1~4 대분류 */}
                    {[{code:"1.",name:"토공",t:togong},{code:"2.",name:"구조물공",t:gujo},{code:"3.",name:"포장공",t:pojang},{code:"4.",name:"부대공",t:budae}].map(({code,name,t}) => {
                      const catItems = activeDesign.filter(i => i.cat === code);
                      if (catItems.length === 0) return null;
                      return (
                        <React.Fragment key={code}>
                          <CatRow code={code} name={name} amounts={[t.g, t.i, t.k, t.m]} />
                          {catItems.map((item, idx) => {
                            const p = PRICE_DB[item.priceId] || {};
                            return <ItemRow key={item.id} item={item} p={p} idx={idx} />;
                          })}
                        </React.Fragment>
                      );
                    })}

                    {/* 사급자재대 */}
                    <CatRow code="5." name="사급자재대" amounts={[sagubTotal,0,0,0]} fillClass="bg-orange-50" />
                    {sagubItems.map((item, idx) => (
                      <tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}>
                        <td className="border border-slate-200 px-1 py-1 text-center"></td>
                        <td className="border border-slate-200 px-2 py-1">{item.name}</td>
                        <td className="border border-slate-200 px-1 py-1 text-slate-500">{item.spec}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center">{item.qty}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center">{item.unit}</td>
                        <td className="border border-slate-200 px-1 py-1 text-right">{fmt(item.unitPrice)}</td>
                        <td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td>
                        <td colSpan={6} className="border border-slate-200"></td>
                      </tr>
                    ))}

                    {/* 관급자재대 */}
                    <CatRow code="6." name="관급자재대" amounts={[gwangubTotal,0,0,0]} fillClass="bg-red-50" />
                    {gwangubItems.map((item, idx) => (
                      <tr key={item.id} className={idx%2===0?"bg-white":"bg-slate-50"}>
                        <td className="border border-slate-200 px-1 py-1 text-center text-xs">{item.sub}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.name}</td>
                        <td className="border border-slate-200 px-1 py-1 text-slate-500">{item.spec}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center">{item.qty}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center">{item.unit}</td>
                        <td className="border border-slate-200 px-1 py-1 text-right">{fmt(item.unitPrice)}</td>
                        <td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(item.qty*item.unitPrice))}</td>
                        <td colSpan={6} className="border border-slate-200"></td>
                      </tr>
                    ))}

                    {/* 관급수수료 */}
                    <tr className="bg-red-50 font-bold">
                      <td colSpan={5} className="border border-slate-300 px-3 py-1.5 text-center text-red-700">관급수수료 (1.5%)</td>
                      <td className="border border-slate-300"></td>
                      <td className="border border-slate-300 px-1 py-1.5 text-right text-red-700">{fmt(gwangubFee)}</td>
                      <td colSpan={6} className="border border-slate-300"></td>
                    </tr>

                    {/* 총공사비 */}
                    <TotalRow label="총 공 사 비" amounts={[grandTotal, 0, 0, 0]} bg="bg-slate-800" text="text-white" />
                  </tbody>
                </table>
              </div>
            </section>

            {/* 합계 요약 카드 */}
            <section>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SumCard label="직접공사비" value={sunG} color="blue" />
                <SumCard label="사급자재대" value={sagubTotal} color="orange" />
                <SumCard label="관급자재대" value={gwangubTotal} color="red" />
                <SumCard label="관급수수료" value={gwangubFee} color="pink" />
                <SumCard label="총공사비" value={grandTotal} color="slate" bold />
              </div>
            </section>

            {/* ② 엑셀 다운로드 (브라우저 생성) */}
            <section>
              <SectionTitle num="📊" title="엑셀 다운로드" />
              <div className="mt-3 flex gap-3 flex-wrap">
                <button onClick={() => generateDesignExcel(designItems, sagubItems, gwangubItems, FEE_RATE)}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 shadow">
                  📊 설계내역서
                </button>
                <button onClick={() => generateQuantityExcel(designItems, sagubItems, gwangubItems, FEE_RATE)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 shadow">
                  📋 수량산출서
                </button>
                <button onClick={() => generateUnitPriceExcel(designItems)}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 shadow">
                  📑 일위대가
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">* 브라우저에서 직접 생성 — 서버 불필요, 오프라인에서도 동작</p>
            </section>
          </>
        )}

        {/* 푸터 */}
        <footer className="border-t border-slate-200 pt-4 pb-6 text-xs text-slate-400 space-y-1">
          <p>상세 수량산출 근거는 엑셀 파일 참조</p>
          <p>단가근거: 2025년 충청북도 일위대가 목록표 · 기초 근입 D≥1.0m</p>
        </footer>
      </div>
    </div>
  );
}

/* ===== Sub Components ===== */

function SectionTitle({ num, title }) {
  return (
    <div className="flex items-center gap-2">
      <span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded flex items-center justify-center">{num}</span>
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
    </div>
  );
}

function InfoCard({ title, color, children }) {
  const styles = { blue: "bg-blue-50 border-blue-200 text-blue-700", red: "bg-red-50 border-red-200 text-red-700" };
  const s = styles[color];
  return (
    <div className={`${s.split(" ").slice(0,2).join(" ")} border rounded-lg p-4`}>
      <h4 className={`font-bold ${s.split(" ")[2]} text-sm mb-2`}>{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? "font-bold text-red-600" : "font-medium text-slate-800"}>{value}</span>
    </div>
  );
}

function StructCard({ title, specs, color }) {
  const c = { blue:{bg:"bg-blue-50",border:"border-blue-200",title:"text-blue-700",dot:"bg-blue-400"},
    red:{bg:"bg-red-50",border:"border-red-200",title:"text-red-700",dot:"bg-red-400"},
    amber:{bg:"bg-amber-50",border:"border-amber-200",title:"text-amber-700",dot:"bg-amber-400"} }[color];
  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-4`}>
      <h4 className={`font-bold ${c.title} text-sm mb-3`}>{title}</h4>
      <div className="space-y-2">
        {specs.map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className={`${c.dot} w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0`}></span>
            <span className="text-slate-500 w-14 flex-shrink-0">{s.k}</span>
            <span className="font-medium text-slate-800">{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalRow({ label, amounts, bg, text }) {
  return (
    <tr className={`${bg} font-bold`}>
      <td colSpan={5} className={`border border-slate-300 px-3 py-1.5 text-center ${text}`}>{label}</td>
      <td className="border border-slate-300"></td>
      <td className={`border border-slate-300 px-1 py-1.5 text-right ${text} text-xs`}>{fmt(amounts[0])}</td>
      <td className="border border-slate-300"></td>
      <td className={`border border-slate-300 px-1 py-1.5 text-right ${text} text-xs`}>{amounts[1] ? fmt(amounts[1]) : ""}</td>
      <td className="border border-slate-300"></td>
      <td className={`border border-slate-300 px-1 py-1.5 text-right ${text} text-xs`}>{amounts[2] ? fmt(amounts[2]) : ""}</td>
      <td className="border border-slate-300"></td>
      <td className={`border border-slate-300 px-1 py-1.5 text-right ${text} text-xs`}>{amounts[3] ? fmt(amounts[3]) : ""}</td>
    </tr>
  );
}

function CatRow({ code, name, amounts, fillClass }) {
  const bg = fillClass || "bg-blue-50";
  return (
    <tr className={`${bg} font-bold`}>
      <td className="border border-slate-300 px-1 py-1 text-center text-blue-700 text-xs">{code}</td>
      <td className="border border-slate-300 px-2 py-1 text-blue-700">{name}</td>
      <td className="border border-slate-300"></td>
      <td className="border border-slate-300"></td>
      <td className="border border-slate-300"></td>
      <td className="border border-slate-300"></td>
      <td className="border border-slate-300 px-1 py-1 text-right text-blue-700 text-xs">{fmt(amounts[0])}</td>
      <td className="border border-slate-300"></td>
      <td className="border border-slate-300 px-1 py-1 text-right text-xs">{amounts[1] ? fmt(amounts[1]) : ""}</td>
      <td className="border border-slate-300"></td>
      <td className="border border-slate-300 px-1 py-1 text-right text-xs">{amounts[2] ? fmt(amounts[2]) : ""}</td>
      <td className="border border-slate-300"></td>
      <td className="border border-slate-300 px-1 py-1 text-right text-xs">{amounts[3] ? fmt(amounts[3]) : ""}</td>
    </tr>
  );
}

function ItemRow({ item, p, idx }) {
  const q = item.qty;
  return (
    <tr className={idx%2===0 ? "bg-white" : "bg-slate-50"}>
      <td className="border border-slate-200 px-1 py-1 text-center"></td>
      <td className="border border-slate-200 px-2 py-1">{item.name}</td>
      <td className="border border-slate-200 px-1 py-1 text-slate-500 text-xs">{item.spec}</td>
      <td className="border border-slate-200 px-1 py-1 text-center">{q}</td>
      <td className="border border-slate-200 px-1 py-1 text-center">{item.unit}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.total||0)}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*(p.total||0)))}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.labor||0)}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*(p.labor||0)))}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.material||0)}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*(p.material||0)))}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(p.expense||0)}</td>
      <td className="border border-slate-200 px-1 py-1 text-right">{fmt(Math.round(q*(p.expense||0)))}</td>
    </tr>
  );
}

function SumCard({ label, value, color, bold }) {
  const styles = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    orange: "bg-orange-50 border-orange-200 text-orange-600",
    red: "bg-red-50 border-red-200 text-red-600",
    pink: "bg-pink-50 border-pink-200 text-pink-600",
    slate: "bg-slate-800 border-slate-700 text-white",
  };
  return (
    <div className={`rounded-lg border p-3 ${styles[color]}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className={`${bold ? "text-lg" : "text-sm"} font-bold mt-0.5`}>{fmt(value)}원</p>
    </div>
  );
}

/* ===== 설계 단면도 SVG ===== */
function CrossSectionSVG() {
  return (
    <svg viewBox="0 0 600 350" className="w-full max-w-xl border border-slate-200 rounded-lg bg-slate-50">
      {/* 지반선 */}
      <line x1="30" y1="250" x2="570" y2="250" stroke="#78716c" strokeWidth="2" strokeDasharray="8,4" />
      <text x="575" y="254" fontSize="10" fill="#78716c" textAnchor="start">G.L</text>

      {/* 잡석 기초 */}
      <rect x="120" y="250" width="250" height="30" fill="#d6d3d1" stroke="#78716c" strokeWidth="1" />
      <text x="245" y="270" fontSize="9" fill="#44403c" textAnchor="middle">잡석기초 T=0.5m</text>

      {/* 부직포 (잡석 아래) */}
      <rect x="115" y="280" width="260" height="5" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="0.5" />
      <text x="380" y="285" fontSize="8" fill="#3b82f6">부직포</text>

      {/* 기초 콘크리트 */}
      <rect x="130" y="190" width="230" height="60" fill="#e5e7eb" stroke="#374151" strokeWidth="1.5" />
      <text x="245" y="225" fontS
