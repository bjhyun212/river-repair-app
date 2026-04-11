// netlify/functions/analyze-photo.mjs
// AI 분석 후 서버에서 2025년 단가를 강제 적용
// v2: 디버깅 로그 추가

const PRICE_DB = {
  "#.19":{name:"표토제거(답구간)",spec:"불도저19ton,T=20CM",unit:"㎡",labor:225,material:144,expense:135},
  "#.21":{name:"표토제거(답구간)",spec:"T=20CM,굴삭기0.7㎥",unit:"㎡",labor:248,material:77,expense:104},
  "#.22":{name:"표토제거(답외구간)",spec:"T=20CM,굴삭기0.7㎥",unit:"㎡",labor:191,material:59,expense:80},
  "#.23":{name:"벌개제근",spec:"뿌리뽑기",unit:"㎡",labor:394,material:28,expense:62},
  "#.27":{name:"흙깍기(보통토사,중규모)",spec:"불도저19TON",unit:"㎥",labor:815,material:522,expense:489},
  "#.28":{name:"흙깍기(보통토사,소규모)",spec:"굴착기1.0㎥",unit:"㎥",labor:1472,material:774,expense:747},
  "#.31":{name:"흙깍기(혼합토사,소규모)",spec:"굴착기1.0㎥",unit:"㎥",labor:1985,material:1124,expense:1007},
  "#.36":{name:"토사깍기",spec:"굴삭기0.7㎥",unit:"㎥",labor:887,material:277,expense:373},
  "#.57":{name:"구조물터파기(육상토사)",spec:"기계100%",unit:"㎥",labor:1035,material:323,expense:435},
  "#.58":{name:"구조물터파기(수중토사)",spec:"기계100%",unit:"㎥",labor:1452,material:454,expense:610},
  "#.61":{name:"흙쌓기(노체)",spec:"다짐도90%이상",unit:"㎥",labor:1555,material:544,expense:720},
  "#.68":{name:"뒤채움 및 다짐",spec:"소형장비",unit:"㎥",labor:9507,material:1337,expense:1467},
  "#.69":{name:"뒤채움 및 다짐",spec:"대형장비",unit:"㎥",labor:6009,material:1601,expense:1784},
  "#.70":{name:"되메우기 및 다짐",spec:"소형장비",unit:"㎥",labor:8044,material:1131,expense:1241},
  "#.71":{name:"되메우기 및 다짐",spec:"대형장비",unit:"㎥",labor:5180,material:1380,expense:1538},
  "#.85":{name:"성토면고르기",spec:"",unit:"㎡",labor:430,material:226,expense:218},
  "#.87":{name:"절토사면 녹화",spec:"T=10㎝",unit:"㎡",labor:28320,material:22842,expense:4324},
  "#.127":{name:"사토운반(토사)",spec:"L=5.0KM",unit:"㎥",labor:4001,material:1876,expense:1525},
  "#.140":{name:"잔디붙임",spec:"평떼",unit:"㎡",labor:6022,material:5203,expense:0},
  "#.1":{name:"무근콘크리트깨기",spec:"30Cm미만(기계100%)",unit:"㎥",labor:19754,material:5027,expense:8779},
  "#.7":{name:"석축헐기(기계)",spec:"찰쌓기",unit:"㎡",labor:6258,material:1524,expense:2783},
  "#.75":{name:"기초지정(모래)",spec:"모래",unit:"㎥",labor:7708,material:678,expense:1017},
  "#.76":{name:"기초지정(자갈)",spec:"자갈",unit:"㎥",labor:8479,material:861,expense:1224},
  "#.77":{name:"기초지정(잡석)",spec:"잡석",unit:"㎥",labor:9421,material:956,expense:1360},
  "#.152":{name:"석축쌓기(메쌓기)",spec:"T=35cm이하",unit:"㎡",labor:57374,material:5818,expense:11095},
  "#.155":{name:"석축쌓기(찰쌓기)",spec:"T=35cm이하",unit:"㎡",labor:50146,material:4625,expense:8819},
  "#.156":{name:"석축쌓기(찰쌓기)",spec:"T=55cm이하",unit:"㎡",labor:45214,material:4476,expense:8534},
  "#.158":{name:"전석쌓기",spec:"",unit:"㎡",labor:62551,material:6747,expense:9800},
  "#.163":{name:"호안블럭붙이기",spec:"1.0x1.0(기계)",unit:"㎡",labor:7693,material:319,expense:1478},
  "#.168":{name:"레미콘타설(인력운반)",spec:"무근구조물",unit:"㎥",labor:56891,material:1137,expense:0},
  "#.171":{name:"레미콘타설(장비사용)",spec:"무근구조물",unit:"㎥",labor:22627,material:2611,expense:3360},
  "#.172":{name:"레미콘타설(장비사용)",spec:"철근구조물",unit:"㎥",labor:25892,material:2982,expense:3837},
  "#.184":{name:"레미콘타설(펌프차)",spec:"무근TYPE-Ⅰ",unit:"㎥",labor:10266,material:1682,expense:3118},
  "#.186":{name:"레미콘타설(펌프차)",spec:"무근TYPE-Ⅲ",unit:"㎥",labor:17966,material:2944,expense:5457},
  "#.192":{name:"레미콘타설(펌프차)",spec:"철근TYPE-Ⅰ",unit:"㎥",labor:12199,material:1825,expense:3243},
  "#.194":{name:"레미콘타설(펌프차)",spec:"철근TYPE-Ⅲ",unit:"㎥",labor:21348,material:3195,expense:5676},
  "#.201":{name:"합판거푸집(1회)",spec:"제물치장",unit:"㎡",labor:85188,material:37177,expense:0},
  "#.204":{name:"합판거푸집(4회)",spec:"보통",unit:"㎡",labor:37861,material:14845,expense:0},
  "#.205":{name:"합판거푸집(6회)",spec:"간단",unit:"㎡",labor:34075,material:13018,expense:0},
  "#.216":{name:"철근가공 및 조립",spec:"TYPE-1-1",unit:"ton",labor:763584,material:46877,expense:0},
  "#.275":{name:"콘크리트양생(피막)",spec:"E,CU6-8m2/ℓ",unit:"㎡",labor:339,material:445,expense:0},
  "#.276":{name:"콘크리트양생(습윤)",spec:"습윤양생",unit:"㎡",labor:1426,material:472,expense:231},
  "#.280":{name:"부직포설치",spec:"",unit:"㎡",labor:279,material:1693,expense:17},
  "#.281":{name:"비닐깔기",spec:"",unit:"㎡",labor:32,material:647,expense:0},
  "#.282":{name:"물푸기",spec:"",unit:"hr",labor:1139,material:2463,expense:635},
  "#.320":{name:"표층아스콘포설및다짐",spec:"소규모포설",unit:"㎡",labor:6433,material:501,expense:389},
  "#.325":{name:"절삭후아스팔트덧씌우기",spec:"A-Type",unit:"㎡",labor:1365,material:727,expense:820},
  "#.327":{name:"절삭후아스팔트덧씌우기",spec:"C-Type",unit:"㎡",labor:3032,material:1108,expense:1457},
  "#.331":{name:"아스팔트덧씌우기",spec:"소규모포장",unit:"㎡",labor:2245,material:328,expense:489},
  "#.335":{name:"콘크리트포장(인력)",spec:"A-TYPE(T=20Cm)",unit:"㎡",labor:2823,material:732,expense:0},
  "#.481":{name:"교통통제및안전처리",spec:"500M미만",unit:"일",labor:339608,material:0,expense:0},
};

function applyPrices(data) {
  const cats = ['토공','구조물공','포장공','부대공'];
  for (const cat of cats) {
    if (!data.items[cat]) continue;
    data.items[cat] = data.items[cat].map(item => {
      const id = item.priceId || '';
      const p = PRICE_DB[id];
      if (p) {
        return { ...item, name: p.name, spec: p.spec, unit: p.unit,
          labor: p.labor, material: p.material, expense: p.expense,
          priceSource: '2025 단가목록' };
      }
      return { ...item, priceSource: '⚠ 확인필요' };
    });
  }
  return data;
}

export default async (req) => {
  console.log('[analyze-photo] 함수 시작');

  if (req.method !== 'POST') {
    console.log('[analyze-photo] POST가 아님:', req.method);
    return new Response(JSON.stringify({error:'POST only'}),{status:405});
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.log('[analyze-photo] API KEY 없음!');
    return new Response(JSON.stringify({error:'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.'}),
      {status:500, headers:{'Content-Type':'application/json'}});
  }
  console.log('[analyze-photo] API KEY 존재, 길이:', ANTHROPIC_API_KEY.length);

  try {
    console.log('[analyze-photo] body 파싱 시작');
    const body = await req.json();
    console.log('[analyze-photo] body 파싱 완료, image 길이:', body.image?.length || 0);

    const { image, siteName, location } = body;

    if (!image || image.length < 100) {
      console.log('[analyze-photo] 이미지 데이터 없거나 너무 짧음');
      return new Response(JSON.stringify({error:'이미지 데이터가 없거나 너무 짧습니다.'}),
        {status:400, headers:{'Content-Type':'application/json'}});
    }

    // 사용 가능한 단가ID 목록을 AI에게 전달
    const priceList = Object.entries(PRICE_DB)
      .map(([id,p]) => `${id} ${p.name} (${p.spec}) ${p.unit} 합계:${p.labor+p.material+p.expense}원`)
      .join('\n');

    const systemPrompt = `당신은 30년 경력 토목직 공무원이자 수해복구 설계 전문가입니다.
현장 사진을 분석하여 설계물량을 산출하세요.

## 핵심 규칙
- 각 공종의 priceId는 반드시 아래 단가목록에서 선택하세요
- 단가목록에 없는 공종은 가장 유사한 공종의 ID를 사용하세요
- 수량(qty)은 철근(ton)은 소수점3자리, 기타는 소수점2자리로 산출

## 2025년 충청북도 단가목록 (priceId → 공종)
${priceList}

## 반환 JSON (반드시 이 형식만 출력, 설명 없이 JSON만)
{
  "analysis": {
    "riverBank": "좌안/우안",
    "cause": "원인설명",
    "judgement": "개선복구",
    "damageLength": 숫자,
    "damageHeight": 숫자,
    "damageDescription": "상세설명"
  },
  "items": {
    "토공": [
      {"name":"공종명","priceId":"#.번호","qty":수량,"note":"산출근거 계산식"}
    ],
    "구조물공": [...],
    "포장공": [...],
    "부대공": [...]
  },
  "materials": {
    "관급": [
      {"name":"레미콘","spec":"25-21-150","unit":"㎥","qty":수량,"unitPrice":75000,"note":"산출근거"}
    ],
    "사급": [
      {"name":"합판거푸집(자재)","spec":"합판+각재","unit":"㎡","qty":수량,"unitPrice":14845,"note":"산출근거"}
    ]
  },
  "structure": {
    "type":"구조형식","foundation":"기초형식","embedDepth":"근입깊이",
    "concreteStrength":"콘크리트강도","slump":"슬럼프","reinforcement":"철근량"
  }
}`;

    console.log('[analyze-photo] Claude API 호출 시작');
    const apiBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: `현장명: ${siteName||'미지정'}\n위치: ${location||'미지정'}\n\n사진 분석 후 설계물량을 JSON으로 반환하세요. priceId는 반드시 단가목록의 #.번호를 사용하세요.` },
        ],
      }],
    };
    console.log('[analyze-photo] API body 크기:', JSON.stringify(apiBody).length, 'bytes');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(apiBody),
    });

    console.log('[analyze-photo] Claude API 응답 status:', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.log('[analyze-photo] Claude API 에러:', errText.substring(0, 500));
      return new Response(JSON.stringify({error:`Claude API 오류: ${response.status}`, detail:errText}),
        {status:500, headers:{'Content-Type':'application/json'}});
    }

    const data = await response.json();
    const text = data.content.map(c => c.text || '').join('');
    console.log('[analyze-photo] Claude 응답 길이:', text.length);

    let jsonStr = text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();

    let parsed;
    try { parsed = JSON.parse(jsonStr); }
    catch(e) {
      console.log('[analyze-photo] JSON 파싱 실패:', e.message);
      console.log('[analyze-photo] 원본 텍스트:', text.substring(0, 300));
      return new Response(JSON.stringify({error:'JSON 파싱 실패',raw:text.substring(0,1000)}),
        {status:200,headers:{'Content-Type':'application/json'}});
    }

    // 서버에서 2025년 단가 강제 적용
    const result = applyPrices(parsed);
    console.log('[analyze-photo] 성공! 공종 수:', 
      Object.values(result.items||{}).flat().length);

    return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
  } catch(err) {
    console.log('[analyze-photo] 치명적 에러:', err.message, err.stack);
    return new Response(JSON.stringify({error:err.message}),{status:500,headers:{'Content-Type':'application/json'}});
  }
};

export const config = { path: '/.netlify/functions/analyze-photo' };
