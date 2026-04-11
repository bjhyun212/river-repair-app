// 2025년 충청북도 일위대가 단가목록 (PDF 기준)
// 이 파일은 프론트엔드(src/unitPrices.js)와 서버(netlify/functions/)에서 공용

export const UNIT_PRICES = {
  // === 1. 토공 ===
  "표토제거(답구간)": { id: "#.21", spec: "T=20CM, 굴삭기0.7㎥", unit: "㎡", labor: 248, material: 77, expense: 104 },
  "표토제거(답외구간)": { id: "#.22", spec: "T=20CM, 굴삭기0.7㎥", unit: "㎡", labor: 191, material: 59, expense: 80 },
  "흙깍기(보통토사,소규모)": { id: "#.28", spec: "굴착기1.0㎥", unit: "㎥", labor: 1472, material: 774, expense: 747 },
  "흙깍기(보통토사,중규모)": { id: "#.27", spec: "불도저19TON", unit: "㎥", labor: 815, material: 522, expense: 489 },
  "흙깍기(혼합토사,소규모)": { id: "#.31", spec: "굴착기1.0㎥", unit: "㎥", labor: 1985, material: 1124, expense: 1007 },
  "구조물터파기(육상토사)": { id: "#.57", spec: "기계100%", unit: "㎥", labor: 1035, material: 323, expense: 435 },
  "구조물터파기(수중토사)": { id: "#.58", spec: "기계100%", unit: "㎥", labor: 1452, material: 454, expense: 610 },
  "뒤채움(소형장비)": { id: "#.68", spec: "소형장비", unit: "㎥", labor: 9507, material: 1337, expense: 1467 },
  "뒤채움(대형장비)": { id: "#.69", spec: "대형장비", unit: "㎥", labor: 6009, material: 1601, expense: 1784 },
  "되메우기(소형장비)": { id: "#.70", spec: "소형장비", unit: "㎥", labor: 8044, material: 1131, expense: 1241 },
  "되메우기(대형장비)": { id: "#.71", spec: "대형장비", unit: "㎥", labor: 5180, material: 1380, expense: 1538 },
  "사토운반(토사,L=5KM)": { id: "#.127", spec: "사토장-자동덮개", unit: "㎥", labor: 4001, material: 1876, expense: 1525 },
  "절토사면녹화(T=10cm)": { id: "#.87", spec: "T=10㎝", unit: "㎡", labor: 28320, material: 22842, expense: 4324 },
  "성토면고르기": { id: "#.85", spec: "", unit: "㎡", labor: 430, material: 226, expense: 218 },

  // === 2. 구조물공 ===
  "기초지정(모래)": { id: "#.75", spec: "모래", unit: "㎥", labor: 7708, material: 678, expense: 1017 },
  "기초지정(자갈)": { id: "#.76", spec: "자갈", unit: "㎥", labor: 8479, material: 861, expense: 1224 },
  "기초지정(잡석)": { id: "#.77", spec: "잡석", unit: "㎥", labor: 9421, material: 956, expense: 1360 },
  "레미콘타설(펌프차,무근,TYPE-Ⅰ)": { id: "#.184", spec: "무근(S:8-12cm),TYPE-Ⅰ", unit: "㎥", labor: 10266, material: 1682, expense: 3118 },
  "레미콘타설(펌프차,무근,TYPE-Ⅲ)": { id: "#.186", spec: "무근(S:8-12cm),TYPE-Ⅲ", unit: "㎥", labor: 17966, material: 2944, expense: 5457 },
  "레미콘타설(펌프차,철근,TYPE-Ⅰ)": { id: "#.192", spec: "철근(S:8-12cm),TYPE-Ⅰ", unit: "㎥", labor: 12199, material: 1825, expense: 3243 },
  "레미콘타설(펌프차,철근,TYPE-Ⅲ)": { id: "#.194", spec: "철근(S:8-12cm),TYPE-Ⅲ", unit: "㎥", labor: 21348, material: 3195, expense: 5676 },
  "레미콘타설(장비,무근)": { id: "#.171", spec: "무근구조물", unit: "㎥", labor: 22627, material: 2611, expense: 3360 },
  "레미콘타설(장비,철근)": { id: "#.172", spec: "철근구조물", unit: "㎥", labor: 25892, material: 2982, expense: 3837 },
  "석축쌓기(찰쌓기,T=35cm)": { id: "#.155", spec: "찰쌓기, T=35cm이하", unit: "㎡", labor: 50146, material: 4625, expense: 8819 },
  "석축쌓기(찰쌓기,T=55cm)": { id: "#.156", spec: "찰쌓기, T=55cm이하", unit: "㎡", labor: 45214, material: 4476, expense: 8534 },
  "석축쌓기(메쌓기,T=35cm)": { id: "#.152", spec: "메쌓기, T=35cm이하", unit: "㎡", labor: 57374, material: 5818, expense: 11095 },
  "합판거푸집(1회)": { id: "#.201", spec: "제물치장", unit: "㎡", labor: 85188, material: 37177, expense: 0 },
  "합판거푸집(3회)": { id: "#.203", spec: "복잡", unit: "㎡", labor: 56792, material: 17278, expense: 0 },
  "합판거푸집(4회)": { id: "#.204", spec: "보통", unit: "㎡", labor: 37861, material: 14845, expense: 0 },
  "합판거푸집(6회)": { id: "#.205", spec: "간단", unit: "㎡", labor: 34075, material: 13018, expense: 0 },
  "철근가공조립(TYPE-1-1)": { id: "#.216", spec: "TYPE-1-1", unit: "ton", labor: 763584, material: 46877, expense: 0 },
  "철근가공조립(TYPE-2-1)": { id: "#.218", spec: "TYPE-2-1", unit: "ton", labor: 904580, material: 55408, expense: 0 },
  "콘크리트양생(피막)": { id: "#.275", spec: "E,CU6-8m2/ℓ", unit: "㎡", labor: 339, material: 445, expense: 0 },
  "콘크리트양생(습윤)": { id: "#.276", spec: "습윤양생", unit: "㎡", labor: 1426, material: 472, expense: 231 },

  // === 3. 포장공 ===
  "절삭후아스팔트덧씌우기(A-Type)": { id: "#.325", spec: "A-Type(1회절삭,1회포장)", unit: "㎡", labor: 1365, material: 727, expense: 820 },
  "절삭후아스팔트덧씌우기(B-Type)": { id: "#.326", spec: "B-Type(1회절삭,1회포장)", unit: "㎡", labor: 1873, material: 919, expense: 1189 },
  "절삭후아스팔트덧씌우기(C-Type)": { id: "#.327", spec: "C-Type(1회절삭,1회포장)", unit: "㎡", labor: 3032, material: 1108, expense: 1457 },
  "표층아스콘포설(소규모)": { id: "#.320", spec: "소규모포설", unit: "㎡", labor: 6433, material: 501, expense: 389 },
  "콘크리트포장(인력,A-TYPE)": { id: "#.335", spec: "A-TYPE(T=20Cm)", unit: "㎡", labor: 2823, material: 732, expense: 0 },

  // === 4. 부대공 ===
  "부직포설치": { id: "#.280", spec: "", unit: "㎡", labor: 279, material: 1693, expense: 17 },
  "비닐깔기": { id: "#.281", spec: "", unit: "㎡", labor: 32, material: 647, expense: 0 },
  "물푸기": { id: "#.282", spec: "", unit: "hr", labor: 1139, material: 2463, expense: 635 },

  // === 기타 ===
  "무근콘크리트깨기(30cm미만)": { id: "#.1", spec: "기계100%", unit: "㎥", labor: 19754, material: 5027, expense: 8779 },
  "석축헐기(기계,찰쌓기)": { id: "#.7", spec: "찰쌓기", unit: "㎡", labor: 6258, material: 1524, expense: 2783 },
  "호안블럭붙이기": { id: "#.163", spec: "1.0x1.0(기계)", unit: "㎡", labor: 7693, material: 319, expense: 1478 },
};

// 관급/사급 자재 단가 (별도 구매 품목)
export const MATERIAL_PRICES = {
  "레미콘(25-21-150)": { unit: "㎥", price: 75000, type: "관급" },
  "레미콘(25-18-150)": { unit: "㎥", price: 72000, type: "관급" },
  "이형철근(SD400,D13)": { unit: "ton", price: 950000, type: "관급" },
  "이형철근(SD400,D16)": { unit: "ton", price: 940000, type: "관급" },
  "이형철근(SD400,D19)": { unit: "ton", price: 930000, type: "관급" },
  "석재(자연석,T=35cm)": { unit: "㎡", price: 35000, type: "관급" },
  "석재(자연석,T=55cm)": { unit: "㎡", price: 45000, type: "관급" },
  "잡석(∅150~300)": { unit: "㎥", price: 25000, type: "관급" },
  "합판거푸집(자재)": { unit: "㎡", price: 14845, type: "사급" },
  "부직포(200g/㎡)": { unit: "㎡", price: 1693, type: "사급" },
  "비닐(0.1mm)": { unit: "㎡", price: 647, type: "사급" },
};
