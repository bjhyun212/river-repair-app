# 🌊 하천 수해복구 설계 AI 분석 시스템 v2.0

**사진 업로드 → AI 자동 분석 → 물량·단가 산출 → 설계내역서 생성**

## 핵심 기능
1. 📷 현장 사진 업로드
2. 🤖 Claude AI가 자동 분석 (좌/우안, 피해원인, 물량 산출)
3. ✅ 분석 결과 검토·수정
4. 📊 설계내역서 화면 표시 + 엑셀 다운로드

## 배포 방법

### 1. GitHub에 업로드
### 2. Netlify에 연결
### 3. ⚠️ 환경변수 설정 (필수!)

Netlify 대시보드 → Project configuration → Environment variables:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (Anthropic API 키) |

API 키 없이는 사진 분석이 작동하지 않습니다.

## 기술 스택
- React 18 + Vite + Tailwind CSS
- Netlify Functions (서버리스)
- Claude API (사진 분석)
- ExcelJS (엑셀 생성)
