import React, { useState, useRef } from 'react';
import { UNIT_PRICES } from './unitPrices.js';

const fmt = (n) => (n ?? 0).toLocaleString('ko-KR');

// ─── 메인 앱 ───
export default function App() {
  const [step, setStep] = useState('upload'); // upload → analyzing → review → report
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const fileRef = useRef();

  // 사진 선택
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      // base64 부분만 추출
      const base64 = ev.target.result.split(',')[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // AI 분석 요청
  const handleAnalyze = async () => {
    if (!imageBase64) { setError('사진을 먼저 선택하세요.'); return; }
    setError(null);
    setStep('analyzing');

    try {
      const res = await fetch('/.netlify/functions/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, siteName, location }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error + (data.detail ? '\n' + data.detail : ''));
        setStep('upload');
        return;
      }
      // 단가 정보 매핑
      const enriched = enrichWithPrices(data);
      setAnalysisData(enriched);
      setStep('review');
    } catch (e) {
      setError('분석 중 오류: ' + e.message);
      setStep('upload');
    }
  };

  // 단가 매핑
  const enrichWithPrices = (data) => {
    const categories = ['토공', '구조물공', '포장공', '부대공'];
    for (const cat of categories) {
      if (!data.items[cat]) continue;
      data.items[cat] = data.items[cat].map(item => {
        const priceKey = item.priceKey || item.name;
        const price = UNIT_PRICES[priceKey] || null;
        return {
          ...item,
          priceId: price ? price.id : '',
          spec: price ? price.spec : (item.spec || ''),
          unit: price ? price.unit : (item.unit || ''),
          labor: price ? price.labor : (item.labor || 0),
          material: price ? price.material : (item.material || 0),
          expense: price ? price.expense : (item.expense || 0),
        };
      });
    }
    return data;
  };

  // 확인 → 보고서
  const handleConfirm = () => setStep('report');

  // 엑셀 다운로드
  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      const res = await fetch('/.netlify/functions/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: siteName || analysisData?.analysis?.siteName || '○○천',
          riverBank: analysisData?.analysis?.riverBank || '좌안',
          analysisData,
        }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `설계내역서_${siteName || '하천복구'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('엑셀 생성 오류: ' + e.message);
    }
    setExcelLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="bg-slate-800 text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">🌊 하천 수해복구 설계 AI 분석 시스템</h1>
            <p className="text-slate-300 text-xs mt-0.5">사진 업로드 → AI 자동 분석 → 설계내역서 생성</p>
          </div>
          <div className="text-xs text-slate-400">충청북도 2025년 단가목록 기준</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 스텝 표시 */}
        <StepIndicator current={step} />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
            <strong>오류:</strong> {error}
          </div>
        )}

        {/* Step 1: 업로드 */}
        {step === 'upload' && (
          <UploadSection
            siteName={siteName} setSiteName={setSiteName}
            location={location} setLocation={setLocation}
            imagePreview={imagePreview} handleFile={handleFile}
            handleAnalyze={handleAnalyze} fileRef={fileRef}
          />
        )}

        {/* 분석 중 */}
        {step === 'analyzing' && <AnalyzingView imagePreview={imagePreview} />}

        {/* Step 2: 검토 */}
        {step === 'review' && analysisData && (
          <ReviewSection
            data={analysisData}
            imagePreview={imagePreview}
            onConfirm={handleConfirm}
            onBack={() => setStep('upload')}
          />
        )}

        {/* Step 3: 보고서 */}
        {step === 'report' && analysisData && (
          <ReportSection
            data={analysisData}
            siteName={siteName}
            imagePreview={imagePreview}
            onExcel={handleExcel}
            excelLoading={excelLoading}
            onBack={() => setStep('review')}
          />
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t">
        하천 수해복구 설계 AI 분석 시스템 v4.0 · Claude API 연동 · 충청북도 2025년 단가목록 기준
      </footer>
    </div>
  );
}

// ─── 스텝 표시 ───
function StepIndicator({ current }) {
  const steps = [
    { key: 'upload', label: '① 사진 업로드', icon: '📷' },
    { key: 'analyzing', label: '② AI 분석', icon: '🤖' },
    { key: 'review', label: '③ 검토·확인', icon: '✅' },
    { key: 'report', label: '④ 보고서', icon: '📊' },
  ];
  const currentIdx = steps.findIndex(s => s.key === current);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            i <= currentIdx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            <span>{s.icon}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── 업로드 섹션 ───
function UploadSection({ siteName, setSiteName, location, setLocation, imagePreview, handleFile, handleAnalyze, fileRef }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">현장 정보 입력</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">현장명 (하천명)</label>
            <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)}
              placeholder="예: ○○천" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">위치</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="예: 충북 ○○군 ○○면" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-800 mb-4">현장 사진 업로드</h2>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          {imagePreview ? (
            <img src={imagePreview} alt="현장사진" className="max-h-80 mx-auto rounded-lg shadow" />
          ) : (
            <div className="text-gray-400">
              <div className="text-5xl mb-3">📷</div>
              <p className="font-medium">클릭하여 현장 사진을 선택하세요</p>
              <p className="text-xs mt-1">JPG, PNG 파일 지원</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      </div>

      <button onClick={handleAnalyze}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all text-lg disabled:bg-gray-400"
        disabled={!imagePreview}
      >
        🤖 AI 분석 시작
      </button>
    </div>
  );
}

// ─── 분석 중 ───
function AnalyzingView({ imagePreview }) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="bg-white rounded-xl shadow-sm border p-8">
        {imagePreview && <img src={imagePreview} alt="" className="max-h-48 mx-auto rounded-lg mb-6 opacity-60" />}
        <div className="text-5xl mb-4 animate-bounce">🤖</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">AI가 현장 사진을 분석하고 있습니다...</h2>
        <p className="text-sm text-gray-500 mb-4">좌/우안 판정, 피해 원인, 물량 산출, 단가 적용 중</p>
        <div className="flex justify-center gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: `${i*0.3}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 검토 섹션 ───
function ReviewSection({ data, imagePreview, onConfirm, onBack }) {
  const a = data.analysis;
  const gwTotal = (data.materials?.관급 || []).reduce((s, m) => s + Math.round((m.unitPrice||0) * (m.qty||0)), 0);
  const gwFee = Math.round(gwTotal * 0.015);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-bold text-blue-700 mb-4">Step 1: AI 분석 결과 — 검토</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {imagePreview && <img src={imagePreview} alt="" className="rounded-lg shadow max-h-64 object-cover w-full" />}
          <div className="space-y-2">
            <InfoRow label="좌/우안" value={a.riverBank} accent />
            <InfoRow label="피해원인" value={a.cause} />
            <InfoRow label="복구판정" value={a.judgement} accent />
            <InfoRow label="피해연장" value={`${a.damageLength}m`} />
            <InfoRow label="피해높이" value={`${a.damageHeight}m`} />
            <InfoRow label="상세" value={a.damageDescription} />
          </div>
        </div>

        {/* 물량 표 */}
        <h3 className="font-bold text-sm text-gray-700 mb-2">피해 물량 (설계 수량)</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="border px-2 py-1.5 text-left">분류</th>
                <th className="border px-2 py-1.5 text-left">공종</th>
                <th className="border px-2 py-1.5 text-center">수량</th>
                <th className="border px-2 py-1.5 text-center">단위</th>
                <th className="border px-2 py-1.5 text-left">산출근거</th>
              </tr>
            </thead>
            <tbody>
              {['토공','구조물공','포장공','부대공'].map(cat => (
                (data.items[cat] || []).map((item, i) => (
                  <tr key={`${cat}-${i}`} className="hover:bg-gray-50">
                    <td className="border px-2 py-1 text-gray-500">{i === 0 ? cat : ''}</td>
                    <td className="border px-2 py-1">{item.name}</td>
                    <td className="border px-2 py-1 text-center">{fmt(item.qty)}</td>
                    <td className="border px-2 py-1 text-center">{item.unit}</td>
                    <td className="border px-2 py-1 text-gray-600">{item.note}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>

        {/* 관급/사급 확인 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-sm text-red-700 mb-2">▶ 관급/사급자재 확인사항</h3>
          <div className="text-xs space-y-1">
            <p>관급 기준금액: 3,000만원 (기본값)</p>
            <p>관급수수료율: 1.5% (기본값)</p>
            <p>관급 예상 품목: {(data.materials?.관급||[]).map(m=>m.name).join(', ') || '없음'}</p>
            <p>사급 예상 품목: {(data.materials?.사급||[]).map(m=>m.name).join(', ') || '없음'}</p>
            <p>관급자재비: {fmt(gwTotal)}원 / 관급수수료: {fmt(gwFee)}원</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 font-medium">→ 확인 또는 수정사항을 말씀해 주세요</p>

        <div className="flex gap-3">
          <button onClick={onBack} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
            ← 다시 업로드
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm">
            ✅ 확인 — 설계내역서 생성
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 보고서 섹션 ───
function ReportSection({ data, siteName, imagePreview, onExcel, excelLoading, onBack }) {
  const a = data.analysis;
  const allCats = ['토공','구조물공','포장공','부대공'];

  // 계산
  const catTotals = {};
  let sunTotal = { labor: 0, material: 0, expense: 0, total: 0 };
  for (const cat of allCats) {
    const t = { labor: 0, material: 0, expense: 0, total: 0 };
    for (const item of (data.items[cat] || [])) {
      const l = Math.round((item.labor||0) * (item.qty||0));
      const m = Math.round((item.material||0) * (item.qty||0));
      const e = Math.round((item.expense||0) * (item.qty||0));
      t.labor += l; t.material += m; t.expense += e; t.total += l + m + e;
    }
    catTotals[cat] = t;
    sunTotal.labor += t.labor; sunTotal.material += t.material; sunTotal.expense += t.expense; sunTotal.total += t.total;
  }
  const sagubTotal = (data.materials?.사급||[]).reduce((s,m) => s + Math.round((m.unitPrice||0)*(m.qty||0)), 0);
  const gwangubTotal = (data.materials?.관급||[]).reduce((s,m) => s + Math.round((m.unitPrice||0)*(m.qty||0)), 0);
  const gwFee = Math.round(gwangubTotal * 0.015);
  const grandTotal = sunTotal.total + sagubTotal + gwangubTotal + gwFee;

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-slate-800">종합검토보고서</h1>
        <p className="text-sm text-gray-500 mt-1">{siteName || '○○천'} 하천 수해복구 설계 — {a.riverBank}</p>
        <span className="inline-block mt-2 bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">{a.judgement}</span>
      </div>

      {/* 다운로드 버튼 */}
      <div className="bg-white border rounded-lg p-4 mb-6 flex flex-wrap gap-3">
        <button onClick={onExcel} disabled={excelLoading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg">
          📊 {excelLoading ? '생성 중...' : '설계내역서 엑셀 다운로드'}
        </button>
        <button onClick={onBack} className="px-5 py-2.5 border text-gray-700 text-sm rounded-lg hover:bg-gray-50">
          ← 검토로 돌아가기
        </button>
      </div>

      {/* 1. 종합분석 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-blue-700 border-b-2 border-blue-600 pb-2 mb-4">1. 종합 분석</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <InfoCard label="현장명" value={siteName || '○○천'} />
          <InfoCard label="좌/우안" value={a.riverBank} />
          <InfoCard label="복구판정" value={a.judgement} accent />
          <InfoCard label="피해연장" value={`${a.damageLength}m`} />
        </div>
        <div className="bg-gray-50 border rounded p-3 text-sm mb-4">{a.cause}</div>

        {/* 관급자재 요약 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h3>
          <div className="text-xs space-y-1">
            <p>품목: {(data.materials?.관급||[]).map(m=>m.name).join(', ')}</p>
            <p>관급자재비: {fmt(gwangubTotal)}원 / 수수료(1.5%): {fmt(gwFee)}원</p>
          </div>
        </div>

        {/* 합계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SumCard title="직접공사비" amount={sunTotal.total} color="blue" />
          <SumCard title="사급자재대" amount={sagubTotal} color="orange" />
          <SumCard title="관급자재대" amount={gwangubTotal} color="red" />
          <SumCard title="관급수수료" amount={gwFee} color="pink" />
          <SumCard title="총공사비" amount={grandTotal} color="navy" bold />
        </div>
      </section>

      {/* 2. 내역서 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-blue-700 border-b-2 border-blue-600 pb-2 mb-4">2. 설계 내역서</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-gray-400 min-w-[1100px]">
            <thead>
              <tr className="bg-blue-100">
                <th rowSpan={2} className="border border-gray-400 px-1 py-2 w-14">공종</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-36">품 명</th>
                <th rowSpan={2} className="border border-gray-400 px-1 py-2 w-40">규 격</th>
                <th rowSpan={2} className="border border-gray-400 px-1 py-2 w-12 text-center">수량</th>
                <th rowSpan={2} className="border border-gray-400 px-1 py-2 w-10 text-center">단위</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">합 계</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">노 무 비</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">재 료 비</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">경 비</th>
              </tr>
              <tr className="bg-blue-100">
                {['단가','금액','단가','금액','단가','금액','단가','금액'].map((h,i) => (
                  <th key={i} className="border border-gray-400 px-1 py-1 text-center text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 순공사비 */}
              <tr className="bg-gray-200 font-bold">
                <td colSpan={5} className="border border-gray-400 px-2 py-2 text-center tracking-widest">순 공 사 비</td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 py-2 text-right">{fmt(sunTotal.total)}</td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 text-right">{fmt(sunTotal.labor)}</td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 text-right">{fmt(sunTotal.material)}</td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 text-right">{fmt(sunTotal.expense)}</td>
              </tr>

              {/* 대분류 + 세부 */}
              {[{n:'1.',name:'토공'},{n:'2.',name:'구조물공'},{n:'3.',name:'포장공'},{n:'4.',name:'부대공'}].map(cat => (
                <React.Fragment key={cat.name}>
                  <tr className="bg-blue-50 font-bold">
                    <td className="border border-gray-400 px-1 py-1.5 text-center">{cat.n}</td>
                    <td className="border border-gray-400 px-2">{cat.name}</td>
                    <td colSpan={3} className="border border-gray-400"></td>
                    <td className="border border-gray-400"></td>
                    <td className="border border-gray-400 px-1 text-right">{fmt(catTotals[cat.name]?.total)}</td>
                    <td className="border border-gray-400"></td>
                    <td className="border border-gray-400 px-1 text-right">{fmt(catTotals[cat.name]?.labor)}</td>
                    <td className="border border-gray-400"></td>
                    <td className="border border-gray-400 px-1 text-right">{fmt(catTotals[cat.name]?.material)}</td>
                    <td className="border border-gray-400"></td>
                    <td className="border border-gray-400 px-1 text-right">{fmt(catTotals[cat.name]?.expense)}</td>
                  </tr>
                  {(data.items[cat.name]||[]).map((item,idx) => {
                    const tu = (item.labor||0)+(item.material||0)+(item.expense||0);
                    return (
                      <tr key={idx} className="bg-white hover:bg-gray-50">
                        <td className="border border-gray-400"></td>
                        <td className="border border-gray-400 px-2 py-1">{item.name}</td>
                        <td className="border border-gray-400 px-1 py-1 text-[10px]">{item.spec} <span className="text-blue-500">{item.priceId}</span></td>
                        <td className="border border-gray-400 px-1 text-center">{fmt(item.qty)}</td>
                        <td className="border border-gray-400 px-1 text-center">{item.unit}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(tu)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round(tu*item.qty))}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(item.labor)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round((item.labor||0)*item.qty))}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(item.material)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round((item.material||0)*item.qty))}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(item.expense)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round((item.expense||0)*item.qty))}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* 사급 */}
              <tr className="bg-orange-50 font-bold">
                <td className="border border-gray-400 px-1 text-center">5.</td>
                <td className="border border-gray-400 px-2">사급자재대</td>
                <td colSpan={3} className="border border-gray-400"></td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 text-right">{fmt(sagubTotal)}</td>
                <td colSpan={6} className="border border-gray-400"></td>
              </tr>

              {/* 관급 */}
              <tr className="bg-red-50 font-bold">
                <td className="border border-gray-400 px-1 text-center">6.</td>
                <td className="border border-gray-400 px-2">관급자재대</td>
                <td colSpan={3} className="border border-gray-400"></td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 text-right">{fmt(gwangubTotal)}</td>
                <td colSpan={6} className="border border-gray-400"></td>
              </tr>

              {/* 관급수수료 */}
              <tr className="bg-red-50 font-bold">
                <td className="border border-gray-400"></td>
                <td colSpan={4} className="border border-gray-400 px-2">관급수수료 (1.5%)</td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 text-right">{fmt(gwFee)}</td>
                <td colSpan={6} className="border border-gray-400"></td>
              </tr>

              {/* 총공사비 */}
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={5} className="border border-gray-400 px-2 py-2 text-center tracking-widest">총 공 사 비</td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 py-2 text-right">{fmt(grandTotal)}</td>
                <td colSpan={6} className="border border-gray-400"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">※ 상세 수량산출 근거는 엑셀 파일 참조</p>
      </section>

      {/* 3. 구조물 제원 */}
      {data.structure && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-blue-700 border-b-2 border-blue-600 pb-2 mb-4">3. 주요 구조물 제원</h2>
          <div className="bg-white border rounded-lg p-4">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(data.structure).map(([k,v]) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-500 w-36">{k}</td>
                    <td className="py-2">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── 유틸 컴포넌트 ───
function InfoRow({ label, value, accent }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-500 font-medium w-16 shrink-0">{label}</span>
      <span className={accent ? 'text-red-600 font-bold' : ''}>{value}</span>
    </div>
  );
}

function InfoCard({ label, value, accent }) {
  return (
    <div className="bg-white border rounded px-3 py-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-sm font-bold ${accent ? 'text-red-600' : ''}`}>{value}</div>
    </div>
  );
}

function SumCard({ title, amount, color, bold }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
    navy: 'bg-slate-800 border-slate-700 text-white',
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <div className="text-xs opacity-80">{title}</div>
      <div className={`text-sm mt-1 ${bold ? 'font-black text-base' : 'font-bold'}`}>{fmt(amount)}원</div>
    </div>
  );
}
