// 2025년 충청북도 일위대가 단가목록 (PDF 원본 기준)
// 시공단가만 포함. 자재 구매단가(관급/사급)는 별도

export const PRICE_DB = [
  { id:"#.19", name:"표토제거(답구간)", spec:"불도저19ton,T=20CM", unit:"㎡", labor:225, material:144, expense:135 },
  { id:"#.21", name:"표토제거(답구간)", spec:"T=20CM,굴삭기0.7㎥", unit:"㎡", labor:248, material:77, expense:104 },
  { id:"#.22", name:"표토제거(답외구간)", spec:"T=20CM,굴삭기0.7㎥", unit:"㎡", labor:191, material:59, expense:80 },
  { id:"#.23", name:"벌개제근", spec:"뿌리뽑기", unit:"㎡", labor:394, material:28, expense:62 },
  { id:"#.27", name:"흙깍기(보통토사,중규모)", spec:"불도저19TON", unit:"㎥", labor:815, material:522, expense:489 },
  { id:"#.28", name:"흙깍기(보통토사,소규모)", spec:"굴착기1.0㎥", unit:"㎥", labor:1472, material:774, expense:747 },
  { id:"#.31", name:"흙깍기(혼합토사,소규모)", spec:"굴착기1.0㎥", unit:"㎥", labor:1985, material:1124, expense:1007 },
  { id:"#.36", name:"토사깍기", spec:"굴삭기0.7㎥", unit:"㎥", labor:887, material:277, expense:373 },
  { id:"#.57", name:"구조물터파기(육상토사)", spec:"기계100%", unit:"㎥", labor:1035, material:323, expense:435 },
  { id:"#.58", name:"구조물터파기(수중토사)", spec:"기계100%", unit:"㎥", labor:1452, material:454, expense:610 },
  { id:"#.68", name:"뒤채움 및 다짐", spec:"소형장비", unit:"㎥", labor:9507, material:1337, expense:1467 },
  { id:"#.69", name:"뒤채움 및 다짐", spec:"대형장비", unit:"㎥", labor:6009, material:1601, expense:1784 },
  { id:"#.70", name:"되메우기 및 다짐", spec:"소형장비", unit:"㎥", labor:8044, material:1131, expense:1241 },
  { id:"#.71", name:"되메우기 및 다짐", spec:"대형장비", unit:"㎥", labor:5180, material:1380, expense:1538 },
  { id:"#.85", name:"성토면고르기", spec:"", unit:"㎡", labor:430, material:226, expense:218 },
  { id:"#.87", name:"절토사면 녹화", spec:"T=10㎝", unit:"㎡", labor:28320, material:22842, expense:4324 },
  { id:"#.127", name:"사토운반(토사)", spec:"사토장-자동덮개,L=5.0KM", unit:"㎥", labor:4001, material:1876, expense:1525 },
  { id:"#.1", name:"무근콘크리트깨기", spec:"30Cm미만(기계100%)", unit:"㎥", labor:19754, material:5027, expense:8779 },
  { id:"#.7", name:"석축헐기(기계)", spec:"찰쌓기", unit:"㎡", labor:6258, material:1524, expense:2783 },
  { id:"#.75", name:"기초지정", spec:"모래", unit:"㎥", labor:7708, material:678, expense:1017 },
  { id:"#.76", name:"기초지정", spec:"자갈", unit:"㎥", labor:8479, material:861, expense:1224 },
  { id:"#.77", name:"기초지정", spec:"잡석", unit:"㎥", labor:9421, material:956, expense:1360 },
  { id:"#.152", name:"석축쌓기", spec:"메쌓기,T=35cm이하", unit:"㎡", labor:57374, material:5818, expense:11095 },
  { id:"#.155", name:"석축쌓기", spec:"찰쌓기,T=35cm이하", unit:"㎡", labor:50146, material:4625, expense:8819 },
  { id:"#.156", name:"석축쌓기", spec:"찰쌓기,T=55cm이하", unit:"㎡", labor:45214, material:4476, expense:8534 },
  { id:"#.163", name:"호안블럭붙이기", spec:"1.0x1.0(기계)", unit:"㎡", labor:7693, material:319, expense:1478 },
  { id:"#.171", name:"레미콘타설(장비사용)", spec:"무근구조물", unit:"㎥", labor:22627, material:2611, expense:3360 },
  { id:"#.172", name:"레미콘타설(장비사용)", spec:"철근구조물", unit:"㎥", labor:25892, material:2982, expense:3837 },
  { id:"#.184", name:"레미콘타설(펌프차)", spec:"무근(S:8-12cm),TYPE-Ⅰ", unit:"㎥", labor:10266, material:1682, expense:3118 },
  { id:"#.186", name:"레미콘타설(펌프차)", spec:"무근(S:8-12cm),TYPE-Ⅲ", unit:"㎥", labor:17966, material:2944, expense:5457 },
  { id:"#.192", name:"레미콘타설(펌프차)", spec:"철근(S:8-12cm),TYPE-Ⅰ", unit:"㎥", labor:12199, material:1825, expense:3243 },
  { id:"#.194", name:"레미콘타설(펌프차)", spec:"철근(S:8-12cm),TYPE-Ⅲ", unit:"㎥", labor:21348, material:3195, expense:5676 },
  { id:"#.201", name:"합판거푸집(1회)", spec:"제물치장", unit:"㎡", labor:85188, material:37177, expense:0 },
  { id:"#.204", name:"합판거푸집(4회)", spec:"보통", unit:"㎡", labor:37861, material:14845, expense:0 },
  { id:"#.205", name:"합판거푸집(6회)", spec:"간단", unit:"㎡", labor:34075, material:13018, expense:0 },
  { id:"#.216", name:"철근가공 및 조립(현장)", spec:"TYPE-1-1", unit:"ton", labor:763584, material:46877, expense:0 },
  { id:"#.218", name:"철근가공 및 조립(현장)", spec:"TYPE-2-1", unit:"ton", labor:904580, material:55408, expense:0 },
  { id:"#.275", name:"콘크리트양생", spec:"E,CU6-8m2/ℓ", unit:"㎡", labor:339, material:445, expense:0 },
  { id:"#.276", name:"콘크리트양생", spec:"습윤양생", unit:"㎡", labor:1426, material:472, expense:231 },
  { id:"#.280", name:"부직포설치", spec:"", unit:"㎡", labor:279, material:1693, expense:17 },
  { id:"#.281", name:"비닐깔기", spec:"", unit:"㎡", labor:32, material:647, expense:0 },
  { id:"#.282", name:"물푸기", spec:"", unit:"hr", labor:1139, material:2463, expense:635 },
  { id:"#.320", name:"표층아스콘포설및다짐", spec:"소규모포설", unit:"㎡", labor:6433, material:501, expense:389 },
  { id:"#.325", name:"절삭후아스팔트덧씌우기", spec:"A-Type(1회절삭,1회포장)", unit:"㎡", labor:1365, material:727, expense:820 },
  { id:"#.327", name:"절삭후아스팔트덧씌우기", spec:"C-Type(1회절삭,1회포장)", unit:"㎡", labor:3032, material:1108, expense:1457 },
  { id:"#.335", name:"콘크리트포장(인력)", spec:"A-TYPE(T=20Cm)", unit:"㎡", labor:2823, material:732, expense:0 },
  { id:"#.481", name:"교통통제및안전처리", spec:"공구연장500M미만", unit:"일", labor:339608, material:0, expense:0 },
];

// ID로 조회
export function findById(id) {
  if (!id) return null;
  const nid = id.startsWith('#') ? id : `#.${id}`;
  return PRICE_DB.find(p => p.id === nid) || null;
}

// AI 응답 항목에 2025 단가 강제 매칭
export function matchPrice(item) {
  // 1순위: AI가 반환한 priceId(#.xxx) 매칭
  const ids = [item.priceId, item.priceKey, item.id].filter(Boolean);
  for (const raw of ids) {
    const idMatch = raw.match(/#\.\d+/);
    if (idMatch) {
      const found = findById(idMatch[0]);
      if (found) return { ...found, source: '2025 단가목록' };
    }
  }
  // 2순위: 이름 매칭
  const nm = (item.name || '').replace(/[\s()（）]/g, '');
  for (const p of PRICE_DB) {
    const pn = p.name.replace(/[\s()（）]/g, '');
    if (nm === pn || nm.includes(pn) || pn.includes(nm)) return { ...p, source: '2025 단가목록' };
  }
  // 3순위: 부분 매칭
  const core = nm.replace(/소규모|대규모|중규모|기계|인력|소형|대형/g, '');
  for (const p of PRICE_DB) {
    const pc = p.name.replace(/[\s()（）소규모대규모중규모기계인력소형대형]/g, '');
    if (core.length > 2 && (core.includes(pc) || pc.includes(core))) return { ...p, source: '2025 유사공종' };
  }
  return null;
}
