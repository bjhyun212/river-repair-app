import React, { useState, useRef } from 'react';
import { UNIT_PRICES } from './unitPrices.js';

const fmt = (n) => (n ?? 0).toLocaleString('ko-KR');
const fmtQty = (n, unit) => {
  if (!n && n !== 0) return '0';
  if (unit === 'ton') return Number(n).toFixed(3);
  if (['㎥','㎡','m','hr'].includes(unit)) return Number(n).toFixed(2);
  return fmt(n);
};

// ─── 메인 앱 ───
export default function App() {
  const [step, setStep] = useState('upload'); // upload → analyzing → review → report
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);
  const [excelLoading, setExcelLoading] = useState({});
  const [userComment, setUserComment] = useState('');
  const fileRef = useRef();

  // 사진 선택 (자동 압축)
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1024;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setImagePreview(compressed);
        setImageBase64(compressed.split(',')[1]);
      };
      img.src = ev.target.result;
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
          priceId: price ? price.id : (item.priceId || ''),
          spec: price ? price.spec : (item.spec || ''),
          unit: price ? price.unit : (item.unit || ''),
          labor: price ? price.labor : (item.labor || 0),
          material: price ? price.material : (item.material || 0),
          expense: price ? price.expense : (item.expense || 0),
          priceSource: price ? '2025 단가목록' : '유사공종/물가정보',
        };
      });
    }
    return data;
  };

  const handleConfirm = () => setStep('report');

  // 엑셀 다운로드 공통 함수
  const downloadExcel = async (endpoint, filename, loadingKey) => {
    setExcelLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const res = await fetch(`/.netlify/functions/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: siteName || '○○',
          riverBank: analysisData?.analysis?.riverBank || '좌안',
          analysisData,
        }),
      });
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('엑셀 생성 오류: ' + e.message);
    }
    setExcelLoading(prev => ({ ...prev, [loadingKey]: false }));
  };

  const handleExcelEstimate = () => downloadExcel('generate-excel', `설계내역서_${siteName || '현장'}.xlsx`, 'estimate');
  const handleExcelQuantity = () => downloadExcel('generate-quantity', `수량산출서_${siteName || '현장'}.xlsx`, 'quantity');
  const handleExcelUnitprice = () => downloadExcel('generate-unitprice', `일위대가_단가산출서_${siteName || '현장'}.xlsx`, 'unitprice');

  // 저장 (localStorage)
  const handleSave = () => {
    const name = prompt('저장할 이름을 입력하세요:', siteName || '작업1');
    if (!name) return;
    const saveData = { siteName, location, imagePreview, analysisData, userComment, savedAt: new Date().toISOString() };
    const saves = JSON.parse(localStorage.getItem('river_saves') || '{}');
    saves[name] = saveData;
    localStorage.setItem('river_saves', JSON.stringify(saves));
    alert(`"${name}" 저장 완료`);
  };

  // 불러오기
  const handleLoad = () => {
    const saves = JSON.parse(localStorage.getItem('river_saves') || '{}');
    const keys = Object.keys(saves);
    if (keys.length === 0) { alert('저장된 작업이 없습니다.'); return; }
    const name = prompt(`불러올 작업을 선택하세요:\n${keys.map((k, i) => `${i + 1}. ${k}`).join('\n')}\n\n번호를 입력하세요:`);
    if (!name) return;
    const idx = parseInt(name) - 1;
    const key = keys[idx];
    if (!key || !saves[key]) { alert('잘못된 번호입니다.'); return; }
    const d = saves[key];
    setSiteName(d.siteName || '');
    setLocation(d.location || '');
    setImagePreview(d.imagePreview || null);
    setAnalysisData(d.analysisData || null);
    setUserComment(d.userComment || '');
    setStep(d.analysisData ? 'report' : 'upload');
    alert(`"${key}" 불러오기 완료`);
  };

  // 새로 작업
  const handleNew = () => {
    if (!confirm('현재 작업을 초기화하시겠습니까?')) return;
    setSiteName(''); setLocation(''); setImagePreview(null); setImageBase64(null);
    setAnalysisData(null); setError(null); setUserComment('');
    setStep('upload');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight">🏗️ 소규모주민숙원사업 설계 AI 분석 시스템</h1>
              <p className="text-slate-300 text-xs mt-0.5">사진 업로드 → AI 자동 분석 → 설계내역서 생성</p>
            </div>
            <div className="text-xs text-slate-400">충청북도 2025년 단가목록 기준</div>
          </div>
          {/* 저장/불러오기/새로작업 버튼 */}
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs">💾 다른이름으로 저장</button>
            <button onClick={handleLoad} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs">📂 불러오기</button>
            <button onClick={handleNew} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs">🆕 새로 작업</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator current={step} />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
            <strong>오류:</strong> {error}
          </div>
        )}
        {step === 'upload' && (
          <UploadSection siteName={siteName} setSiteName={setSiteName}
            location={location} setLocation={setLocation}
            imagePreview={imagePreview} handleFile={handleFile}
            handleAnalyze={handleAnalyze} fileRef={fileRef} />
        )}
        {step === 'analyzing' && <AnalyzingView imagePreview={imagePreview} />}
        {step === 'review' && analysisData && (
          <ReviewSection data={analysisData} imagePreview={imagePreview}
            onConfirm={handleConfirm} onBack={() => setStep('upload')}
            userComment={userComment} setUserComment={setUserComment} />
        )}
        {step === 'report' && analysisData && (
          <ReportSection data={analysisData} siteName={siteName}
            imagePreview={imagePreview}
            onExcelEstimate={handleExcelEstimate}
            onExcelQuantity={handleExcelQuantity}
            onExcelUnitprice={handleExcelUnitprice}
            excelLoading={excelLoading} onBack={() => setStep('review')} />
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t">
        소규모주민숙원사업 설계 AI 분석 시스템 v4.0 · 충청북도 2025년 단가목록 기준
        <br />※ 단가적용 원칙: 2025년 단가목록 우선 → 유사공종 적용 → 물가정보/가격정보 단가 적용
      </footer>
    </div>
  );
}

// ─── 스텝 표시 ───
function StepIndicator({ current }) {
  const steps = [
    { key: 'upload', label: '① 사진 업로드', icon: '📷' },
    { key: 'analyzing', label: '② AI 분석', icon: '🤖' },
    { key: 'review', label: '③ 설계물량 검토', icon: '✅' },
    { key: 'report', label: '④ 설계내역서', icon: '📊' },
  ];
  const currentIdx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            i <= currentIdx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
            <span>{s.icon}</span><span className="hidden sm:inline">{s.label}</span>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">현장명</label>
            <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)}
              placeholder="예: ○○마을 진입로" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">위치</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="예: 충북 ○○군 ○○면" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">현장 사진 업로드</h2>
        <div onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
          {imagePreview ? (
            <img src={imagePreview} alt="현장사진" className="max-h-80 mx-auto rounded-lg shadow" />
          ) : (
            <div className="text-gray-400">
              <div className="text-5xl mb-3">📷</div>
              <p className="font-medium">클릭하여 현장 사진을 선택하세요</p>
              <p className="text-xs mt-1">JPG, PNG 파일 지원 (자동 압축)</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      </div>
      <button onClick={handleAnalyze} disabled={!imagePreview}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg text-lg disabled:bg-gray-400">
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
        <h2 className="text-xl font-bold text-gray-800 mb-2">AI가 현장을 분석하고 있습니다...</h2>
        <p className="text-sm text-gray-500 mb-4">설계물량 산출, 단가 적용 중</p>
        <div className="flex justify-center gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 검토 섹션 ───
function ReviewSection({ data, imagePreview, onConfirm, onBack, userComment, setUserComment }) {
  const a = data.analysis;
  const gwTotal = (data.materials?.관급 || []).reduce((s, m) => s + Math.round((m.unitPrice || 0) * (m.qty || 0)), 0);
  const sagubTotal = (data.materials?.사급 || []).reduce((s, m) => s + Math.round((m.unitPrice || 0) * (m.qty || 0)), 0);
  const gwFee = Math.round(gwTotal * 0.015);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-bold text-blue-700 mb-4">설계물량 검토</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {imagePreview && <img src={imagePreview} alt="" className="rounded-lg shadow max-h-64 object-cover w-full" />}
          <div className="space-y-2">
            <InfoRow label="현장명" value={a.siteName || '—'} />
            <InfoRow label="위치" value={a.riverBank || '—'} />
            <InfoRow label="원인" value={a.cause} />
            <InfoRow label="연장" value={`${a.damageLength}m`} />
            <InfoRow label="높이" value={`${a.damageHeight}m`} />
            <InfoRow label="상세" value={a.damageDescription} />
          </div>
        </div>

        {/* 설계물량 표 */}
        <h3 className="font-bold text-sm text-gray-700 mb-2">설계물량</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="border px-2 py-1.5 text-left">분류</th>
                <th className="border px-2 py-1.5 text-left">공종</th>
                <th className="border px-2 py-1.5 text-center">수량</th>
                <th className="border px-2 py-1.5 text-center">단위</th>
                <th className="border px-2 py-1.5 text-left">산출근거</th>
                <th className="border px-2 py-1.5 text-center">단가출처</th>
              </tr>
            </thead>
            <tbody>
              {['토공', '구조물공', '포장공', '부대공'].map(cat => (
                (data.items[cat] || []).map((item, i) => (
                  <tr key={`${cat}-${i}`} className="hover:bg-gray-50">
                    <td className="border px-2 py-1 text-gray-500">{i === 0 ? cat : ''}</td>
                    <td className="border px-2 py-1">{item.name}</td>
                    <td className="border px-2 py-1 text-center">{fmtQty(item.qty, item.unit)}</td>
                    <td className="border px-2 py-1 text-center">{item.unit}</td>
                    <td className="border px-2 py-1 text-gray-600">{item.note}</td>
                    <td className="border px-2 py-1 text-center text-[10px]">{item.priceSource || '2025 단가'}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>

        {/* 관급/사급 자재 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-bold text-sm text-red-700 mb-2">관급자재 ({fmt(gwTotal)}원)</h3>
            <div className="text-xs space-y-1">
              {(data.materials?.관급 || []).map((m, i) => (
                <div key={i} className="flex justify-between">
                  <span>{m.name} ({m.spec})</span>
                  <span>{fmtQty(m.qty, m.unit)} {m.unit} × {fmt(m.unitPrice)}원</span>
                </div>
              ))}
              <div className="border-t pt-1 mt-2 font-bold">수수료(1.5%): {fmt(gwFee)}원</div>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="font-bold text-sm text-orange-700 mb-2">사급자재 ({fmt(sagubTotal)}원)</h3>
            <div className="text-xs space-y-1">
              {(data.materials?.사급 || []).map((m, i) => (
                <div key={i} className="flex justify-between">
                  <span>{m.name} ({m.spec})</span>
                  <span>{fmtQty(m.qty, m.unit)} {m.unit} × {fmt(m.unitPrice)}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 수정/질문 입력란 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-sm text-yellow-800 mb-2">📝 수정사항 또는 질문</h3>
          <textarea
            value={userComment}
            onChange={e => setUserComment(e.target.value)}
            placeholder="설계물량이나 공종에 대한 수정사항, 추가 요청사항을 입력하세요.&#10;예: 석축 높이를 3m로 수정해주세요 / 부직포 수량 확인 필요"
            className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none focus:ring-2 focus:ring-yellow-400"
          />
          <p className="text-[10px] text-yellow-700 mt-1">※ 입력하신 내용은 향후 재분석 시 반영됩니다.</p>
        </div>

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
function ReportSection({ data, siteName, imagePreview, onExcelEstimate, onExcelQuantity, onExcelUnitprice, excelLoading, onBack }) {
  const a = data.analysis;
  const allCats = ['토공', '구조물공', '포장공', '부대공'];

  const catTotals = {};
  let sunTotal = { labor: 0, material: 0, expense: 0, total: 0 };
  for (const cat of allCats) {
    const t = { labor: 0, material: 0, expense: 0, total: 0 };
    for (const item of (data.items[cat] || [])) {
      const l = Math.round((item.labor || 0) * (item.qty || 0));
      const m = Math.round((item.material || 0) * (item.qty || 0));
      const e = Math.round((item.expense || 0) * (item.qty || 0));
      t.labor += l; t.material += m; t.expense += e; t.total += l + m + e;
    }
    catTotals[cat] = t;
    sunTotal.labor += t.labor; sunTotal.material += t.material;
    sunTotal.expense += t.expense; sunTotal.total += t.total;
  }
  const sagubTotal = (data.materials?.사급 || []).reduce((s, m) => s + Math.round((m.unitPrice || 0) * (m.qty || 0)), 0);
  const gwangubTotal = (data.materials?.관급 || []).reduce((s, m) => s + Math.round((m.unitPrice || 0) * (m.qty || 0)), 0);
  const gwFee = Math.round(gwangubTotal * 0.015);
  const grandTotal = sunTotal.total + sagubTotal + gwangubTotal + gwFee;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-slate-800">소규모주민숙원사업 설계내역서</h1>
        <p className="text-sm text-gray-500 mt-1">{siteName || '○○'} — {a.riverBank}</p>
      </div>

      {/* 다운로드 버튼 */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h3 className="font-bold text-sm text-gray-700 mb-3">📥 엑셀 다운로드</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={onExcelEstimate} disabled={excelLoading?.estimate}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg">
            📊 {excelLoading?.estimate ? '생성 중...' : '설계내역서'}
          </button>
          <button onClick={onExcelQuantity} disabled={excelLoading?.quantity}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg">
            📐 {excelLoading?.quantity ? '생성 중...' : '수량산출서'}
          </button>
          <button onClick={onExcelUnitprice} disabled={excelLoading?.unitprice}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg">
            📋 {excelLoading?.unitprice ? '생성 중...' : '일위대가 단가산출서'}
          </button>
          <button onClick={onBack} className="px-5 py-2.5 border text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            ← 검토로 돌아가기
          </button>
        </div>
      </div>

      {/* 1. 종합분석 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-blue-700 border-b-2 border-blue-600 pb-2 mb-4">1. 종합 분석</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <InfoCard label="현장명" value={siteName || '○○'} />
          <InfoCard label="위치" value={a.riverBank || '—'} />
          <InfoCard label="설계연장" value={`${a.damageLength}m`} />
          <InfoCard label="설계높이" value={`${a.damageHeight}m`} />
        </div>
        <div className="bg-gray-50 border rounded p-3 text-sm mb-4">{a.cause}</div>

        {/* 관급자재 요약 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-red-700 text-sm mb-2">관급자재 요약</h3>
          <div className="text-xs space-y-1">
            <p>품목: {(data.materials?.관급 || []).map(m => m.name).join(', ')}</p>
            <p>관급자재비: {fmt(gwangubTotal)}원 / 수수료(1.5%): {fmt(gwFee)}원</p>
          </div>
        </div>

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
                <th rowSpan={2} className="border border-gray-400 px-1 py-2 w-14 text-center">수량</th>
                <th rowSpan={2} className="border border-gray-400 px-1 py-2 w-10 text-center">단위</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">합 계</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">노 무 비</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">재 료 비</th>
                <th colSpan={2} className="border border-gray-400 px-1 py-1 text-center">경 비</th>
              </tr>
              <tr className="bg-blue-100">
                {['단가', '금액', '단가', '금액', '단가', '금액', '단가', '금액'].map((h, i) => (
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

              {[{ n: '1.', name: '토공' }, { n: '2.', name: '구조물공' }, { n: '3.', name: '포장공' }, { n: '4.', name: '부대공' }].map(cat => (
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
                  {(data.items[cat.name] || []).map((item, idx) => {
                    const tu = (item.labor || 0) + (item.material || 0) + (item.expense || 0);
                    return (
                      <tr key={idx} className="bg-white hover:bg-gray-50">
                        <td className="border border-gray-400"></td>
                        <td className="border border-gray-400 px-2 py-1">{item.name}</td>
                        <td className="border border-gray-400 px-1 py-1 text-[10px]">{item.spec} <span className="text-blue-500">{item.priceId}</span></td>
                        <td className="border border-gray-400 px-1 text-center">{fmtQty(item.qty, item.unit)}</td>
                        <td className="border border-gray-400 px-1 text-center">{item.unit}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(tu)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round(tu * item.qty))}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(item.labor)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round((item.labor || 0) * item.qty))}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(item.material)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round((item.material || 0) * item.qty))}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(item.expense)}</td>
                        <td className="border border-gray-400 px-1 text-right">{fmt(Math.round((item.expense || 0) * item.qty))}</td>
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
              {(data.materials?.사급 || []).map((m, i) => (
                <tr key={`s${i}`} className="bg-white">
                  <td className="border border-gray-400"></td>
                  <td className="border border-gray-400 px-2 py-1">{m.name}</td>
                  <td className="border border-gray-400 px-1 text-[10px]">{m.spec}</td>
                  <td className="border border-gray-400 px-1 text-center">{fmtQty(m.qty, m.unit)}</td>
                  <td className="border border-gray-400 px-1 text-center">{m.unit}</td>
                  <td className="border border-gray-400 px-1 text-right">{fmt(m.unitPrice)}</td>
                  <td className="border border-gray-400 px-1 text-right">{fmt(Math.round(m.unitPrice * m.qty))}</td>
                  <td colSpan={6} className="border border-gray-400"></td>
                </tr>
              ))}

              {/* 관급 */}
              <tr className="bg-red-50 font-bold">
                <td className="border border-gray-400 px-1 text-center">6.</td>
                <td className="border border-gray-400 px-2">관급자재대</td>
                <td colSpan={3} className="border border-gray-400"></td>
                <td className="border border-gray-400"></td>
                <td className="border border-gray-400 px-1 text-right">{fmt(gwangubTotal)}</td>
                <td colSpan={6} className="border border-gray-400"></td>
              </tr>
              {(data.materials?.관급 || []).map((m, i) => (
                <tr key={`g${i}`} className="bg-white">
                  <td className="border border-gray-400"></td>
                  <td className="border border-gray-400 px-2 py-1">{m.name}</td>
                  <td className="border border-gray-400 px-1 text-[10px]">{m.spec}</td>
                  <td className="border border-gray-400 px-1 text-center">{fmtQty(m.qty, m.unit)}</td>
                  <td className="border border-gray-400 px-1 text-center">{m.unit}</td>
                  <td className="border border-gray-400 px-1 text-right">{fmt(m.unitPrice)}</td>
                  <td className="border border-gray-400 px-1 text-right">{fmt(Math.round(m.unitPrice * m.qty))}</td>
                  <td colSpan={6} className="border border-gray-400"></td>
                </tr>
              ))}

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

      {/* 3. 주요 구조물 제원 (한글 표기) */}
      {data.structure && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-blue-700 border-b-2 border-blue-600 pb-2 mb-4">3. 주요 구조물 제원</h2>
          <div className="bg-white border rounded-lg p-4">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['구조형식', data.structure.type],
                  ['기초형식', data.structure.foundation],
                  ['근입깊이', data.structure.embedDepth],
                  ['콘크리트 강도', data.structure.concreteStrength],
                  ['슬럼프', data.structure.slump],
                  ['철근량', data.structure.reinforcement],
                ].filter(([, v]) => v).map(([k, v]) => (
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
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-500 font-medium w-16 shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-white border rounded px-3 py-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="text-sm font-bold">{value}</div>
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
