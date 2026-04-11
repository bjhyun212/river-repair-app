// netlify/functions/analyze-photo.mjs
// 현장 사진을 받아 Claude API로 분석하고 물량·단가 산출 결과를 반환

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'API 키가 설정되지 않았습니다. Netlify 환경변수에 ANTHROPIC_API_KEY를 추가하세요.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { image, siteName, location } = body;
    // image: base64 encoded image data (data URL에서 base64 부분만)

    const systemPrompt = `당신은 30년 경력의 토목직 공무원이자 수해복구 설계 전문가입니다.
하천 수해 현장 사진을 분석하여 아래 정보를 JSON 형식으로 반환하세요.

## 분석 규칙
1. 좌/우안 판정: 사진에서 왼쪽이 피해지(도로/석축)면 좌안, 오른쪽이면 우안
2. 복구 판정: 수충부, 사면붕괴, 기초세굴 등 구조적 취약점 → 무조건 "개선복구"
3. 기초 근입: D=1.0m 이상 적용
4. 물량 산출: 사진에서 관측되는 피해 규모를 최대한 정밀하게 추정
5. 설계 수량: 여유폭 +0.5m, 매몰 +1.0m 반영

## 단가 적용 공종 목록 (2025년 충청북도 단가목록)
- 표토제거(답구간) #.21: 429원/㎡
- 흙깍기(보통토사,소규모) #.28: 2,993원/㎥
- 구조물터파기(육상토사) #.57: 1,793원/㎥
- 뒤채움(소형장비) #.68: 12,311원/㎥
- 되메우기(소형장비) #.70: 10,416원/㎥
- 사토운반(토사,L=5KM) #.127: 7,402원/㎥
- 절토사면녹화(T=10cm) #.87: 55,486원/㎡
- 기초지정(잡석) #.77: 11,737원/㎥
- 레미콘타설(펌프차,무근,TYPE-Ⅲ) #.186: 26,367원/㎥
- 레미콘타설(펌프차,철근,TYPE-Ⅲ) #.194: 30,219원/㎥
- 석축쌓기(찰쌓기,T=35cm) #.155: 63,590원/㎡
- 합판거푸집(4회,보통) #.204: 52,706원/㎡
- 철근가공조립(TYPE-1-1) #.216: 810,461원/ton
- 콘크리트양생(피막) #.275: 784원/㎡
- 부직포설치 #.280: 1,989원/㎡
- 비닐깔기 #.281: 679원/㎡
- 물푸기 #.282: 4,237원/hr
- 절삭후아스팔트덧씌우기(C-Type) #.327: 5,597원/㎡
- 호안블럭붙이기 #.163: 9,490원/㎡

## 관급/사급 자재
- 관급: 레미콘 75,000원/㎥, 철근(SD400) 950,000원/ton, 석재 35,000원/㎡, 잡석 25,000원/㎥
- 사급: 합판거푸집(자재) 14,845원/㎡, 부직포(자재) 1,693원/㎡
- 관급수수료: 관급자재비 × 1.5%

## 반환 JSON 형식
반드시 아래 형식의 JSON만 반환하세요. 설명 텍스트 없이 JSON만 출력하세요.
{
  "analysis": {
    "riverBank": "좌안 또는 우안",
    "cause": "피해 원인 설명",
    "judgement": "개선복구",
    "damageLength": 숫자(m),
    "damageHeight": 숫자(m),
    "damageDescription": "피해 상황 상세 설명"
  },
  "items": {
    "토공": [
      { "name": "공종명", "priceKey": "단가목록 공종키", "qty": 수량, "unit": "단위", "note": "상세 산출근거 계산식" }
    ],
    "구조물공": [...],
    "포장공": [...],
    "부대공": [...]
  },
  "materials": {
    "관급": [
      { "name": "품목명", "spec": "규격", "unit": "단위", "qty": 수량, "unitPrice": 단가, "note": "산출근거" }
    ],
    "사급": [...]
  },
  "structure": {
    "type": "구조형식 (예: 찰쌓기 석축)",
    "foundation": "기초형식",
    "embedDepth": "근입깊이 (예: D=1.0m)",
    "concreteStrength": "21 MPa",
    "slump": "80~120 mm",
    "reinforcement": "철근량 (예: 100kg/㎥)"
  }
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image,
              },
            },
            {
              type: 'text',
              text: `현장명: ${siteName || '미지정'}\n위치: ${location || '미지정'}\n\n이 하천 수해 현장 사진을 분석하여 피해 현황, 물량, 단가를 산출해 주세요. JSON만 반환하세요.`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Claude API 오류: ${response.status}`, detail: errText }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const text = data.content.map(c => c.text || '').join('');

    // JSON 추출 (마크다운 코드블록 제거)
    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      // JSON 파싱 실패 시 원본 텍스트 반환
      return new Response(JSON.stringify({ error: 'JSON 파싱 실패', raw: text }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/.netlify/functions/analyze-photo' };
