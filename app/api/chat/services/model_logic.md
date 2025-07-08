## Chatflix Ultimate vs Chatflix Ultimate Pro 모델 선택 로직

### 🎯 **1단계: 쿼리 분석**
```
Gemini 2.0 Flash로 분석:
- Category: coding, technical, math, other
- Complexity: simple, medium, complex
- 멀티모달 요소: 이미지, PDF, 코드 첨부파일 감지
- 코드 첨부파일 감지 시 자동으로 coding 카테고리로 강제 설정
```

### 🎯 **2단계: 1차 모델 선택 (기존 로직)**

#### **📝 Coding 카테고리 (최우선)**

| 조건 | Chatflix Ultimate | Chatflix Ultimate Pro |
|------|-------------------|----------------------|
| **멀티모달 + 단순** | `gpt-4.1` | `claude-sonnet-4` |
| **멀티모달 + 중간** | `gpt-4.1` | `gemini-2.5-pro` |
| **멀티모달 + 복잡** | `gemini-2.5-pro` | `gemini-2.5-pro` |
| **비멀티모달 + 모든 복잡도** | `gpt-4.1` | `claude-sonnet-4` (단순/중간), `claude-sonnet-4-thinking` (복잡) |

#### **🖼️ 이미지 포함**

| 카테고리 | 복잡도 | Chatflix Ultimate | Chatflix Ultimate Pro |
|----------|--------|-------------------|----------------------|
| **Technical/Math** | 모든 복잡도 | `gemini-2.5-pro` | `gemini-2.5-pro` |
| **Other** | Simple | `gemini-2.0-flash` | `gemini-2.5-flash` |
| **Other** | Medium | `gemini-2.5-flash` | `gemini-2.5-flash` |
| **Other** | Complex | `gemini-2.5-pro` | `gemini-2.5-pro` |

#### **📄 PDF 포함**

| 복잡도 | Chatflix Ultimate | Chatflix Ultimate Pro |
|--------|-------------------|----------------------|
| **Simple** | `gemini-2.0-flash` | `gemini-2.5-flash` |
| **Medium** | `gemini-2.5-flash` | `gemini-2.5-flash` |
| **Complex** | `gemini-2.5-pro` | `gemini-2.5-pro` |

#### **📝 텍스트만 (비멀티모달)**

| 카테고리 | 복잡도 | Chatflix Ultimate | Chatflix Ultimate Pro |
|----------|--------|-------------------|----------------------|
| **Math** | 단순 | `grok-3` | `grok-3` |
| **Math** | 중간 | `grok-3` | `grok-3-mini` |
| **Math** | 복잡 | `grok-3-mini` | `deepseek-reasoner` |
| **Technical** | 단순 | `grok-3` | `grok-3` |
| **Technical** | 중간/복잡 | `gpt-4.1` | `claude-sonnet-4` |
| **Other** | 단순 | `gpt-4.1-mini` | `gpt-4.1` |
| **Other** | 중간 | `gpt-4.1-mini` | `gpt-4.1` |
| **Other** | 복잡 | `gpt-4.1` | `claude-sonnet-4` |

### 🎯 **3단계: 개선된 컨텍스트 길이 검증 및 업그레이드**

```typescript
// 🆕 정교한 컨텍스트 요구사항 계산
현재_입력_토큰 = estimateTokenCount(currentInput)
히스토리_토큰 = messages.reduce(estimateMultiModalTokens)
예상_출력_토큰 = Math.max(현재_입력_토큰 * 0.5, 1000)

// 🆕 첨부파일 무거움 판단
isAttachmentsHeavy = hasPDF || hasCodeAttachment || 
  (hasImage && imageCount > 2) || pdfCount > 0 || codeFileCount > 1

// 🆕 동적 안전 마진 적용
safetyMargin = isAttachmentsHeavy ? 0.7 : 0.85  // 70% 또는 85%만 사용
필요_컨텍스트 = Math.ceil(총_토큰_수 / safetyMargin)

// 🆕 멀티모달 콘텐츠별 정확한 토큰 추정
- 이미지: 1000 토큰
- PDF: 5000 토큰
- 코드 파일: 3000 토큰
- 기타 파일: 2000 토큰
- 텍스트: estimateTokenCount() 사용

// 1차 선택 모델의 컨텍스트 용량 확인
if (선택된_모델_컨텍스트 >= 필요_컨텍스트) {
  ✅ 1차 선택 모델 사용
} else {
  🔄 업그레이드 필요
}
```

### 🎯 **4단계: 업그레이드 시 최적 모델 선택 + 폴백 메커니즘**

**효율성 점수 계산 (100점 만점):**
- **지능지수 (40%)**: `intelligenceIndex × 0.4`
- **속도 (30%)**: `(TPS 정규화 + 지연시간 역수) × 0.3`
- **컨텍스트 여유도 (20%)**: `min(모델_컨텍스트 / 필요_컨텍스트, 3) × 20 / 3`
- **기능 매칭도 (10%)**: 멀티모달 지원, 카테고리별 보너스

**🚨 강화된 폴백 메커니즘:**
```typescript
// 업그레이드 실패 시나리오
if (업그레이드_실패 || 에러_발생 || 적합한_모델_없음) {
  ⚡ 무조건 gemini-2.5-pro-preview-05-06 사용
  📝 upgradeReason: "Fallback to gemini-2.5-pro due to [error/failure reason]"
}

// try-catch로 감싸진 안전한 모델 선택
try {
  // 모델 선택 로직 실행
} catch (error) {
  // 에러 발생 시 즉시 폴백
  return gemini-2.5-pro-preview-05-06
}
```

**폴백 발생 조건:**
1. **컨텍스트 요구사항을 만족하는 모델이 없는 경우**
2. **모델 선택 과정에서 예외/에러가 발생한 경우**
3. **업그레이드 로직 실행 중 문제가 발생한 경우**
4. **네트워크 또는 API 오류로 모델 정보를 가져올 수 없는 경우**
5. **Agent 활성화된 모델이 없는 경우**

**폴백 우선순위:**
1. **1순위**: `gemini-2.5-pro-preview-05-06` (안정성과 범용성이 검증된 모델)
2. **2순위**: 첫 번째 사용 가능한 `isAgentEnabled: true` 모델 (최후의 수단)

### 🆕 **상세 컨텍스트 분석 정보**

**컨텍스트 계산 결과에 포함되는 상세 정보:**
```typescript
contextInfo: {
  estimatedTokens: 총_추정_토큰_수,
  requiredContext: 필요_컨텍스트_크기,
  selectedModelContext: 선택된_모델_컨텍스트,
  wasUpgraded: 업그레이드_여부,
  upgradeReason?: "업그레이드_이유",
  breakdown: {
    currentInputTokens: 현재_입력_토큰,
    historyTokens: 히스토리_토큰,
    expectedOutputTokens: 예상_출력_토큰,
    safetyMargin: 안전_마진_비율,
    isAttachmentsHeavy: 첨부파일_무거움_여부,
    attachmentDetails: {
      imageCount: 이미지_개수,
      pdfCount: PDF_개수,
      codeFileCount: 코드파일_개수,
      otherFileCount: 기타파일_개수
    }
  }
}
```

## 🔍 **주요 차이점 요약**

| 구분 | Chatflix Ultimate | Chatflix Ultimate Pro |
|------|-------------------|----------------------|
| **코딩 (비멀티모달)** | 모든 복잡도 `gpt-4.1` | 단순/중간 `claude-sonnet-4`, 복잡 `claude-sonnet-4-thinking` |
| **기타 (비멀티모달)** | 단순/중간 `gpt-4.1-mini`, 복잡 `gpt-4.1` | 단순/중간 `gpt-4.1`, 복잡 `claude-sonnet-4` |
| **Math (비멀티모달)** | 단순/중간 `grok-3`, 복잡 `grok-3-mini` | 단순 `grok-3`, 중간 `grok-3-mini`, 복잡 `deepseek-reasoner` |
| **Technical (비멀티모달)** | 단순 `grok-3`, 중간/복잡 `gpt-4.1` | 단순 `grok-3`, 중간/복잡 `claude-sonnet-4` |
| **멀티모달 처리** | 더 보수적 (Gemini 중심) | 더 적극적 (Claude Sonnet 4 활용) |
| **컨텍스트 계산** | 정교한 멀티모달 토큰 추정 + 동적 안전 마진 |
| **폴백 메커니즘** | 강화된 에러 처리 + 안전장치 |

## 📊 **개선된 컨텍스트 업그레이드 + 폴백 예시**

```text
예시 1: 긴 코드 리뷰 요청 (코드 파일 첨부)
1차 선택: gpt-4.1 (1M+ 컨텍스트) - Coding 카테고리, 비멀티모달
컨텍스트 계산: 
  - 입력: 2K 토큰
  - 히스토리: 50K 토큰  
  - 코드 파일: 3K 토큰 (정확한 추정)
  - 예상 출력: 3K 토큰 (코드 작업으로 증가)
  - 안전 마진: 0.7 (첨부파일 무거움)
  - 필요 컨텍스트: (2K + 50K + 3K + 3K) / 0.7 ≈ 83K
결과: 그대로 사용 (1M+ >= 83K, 충분한 컨텍스트)

예시 2: 수학 문제 풀이 (중간 복잡도)
1차 선택: grok-3 (131K 컨텍스트) - Math 카테고리, 비멀티모달
컨텍스트 계산:
  - 입력: 1K 토큰
  - 히스토리: 20K 토큰
  - 예상 출력: 2K 토큰 (수학 문제 풀이)
  - 안전 마진: 0.85 (첨부파일 없음)
  - 필요 컨텍스트: (1K + 20K + 2K) / 0.85 ≈ 27K
결과: 그대로 사용 (131K >= 27K, 충분한 컨텍스트)

예시 3: 대용량 PDF 분석
1차 선택: gemini-2.0-flash (1M 컨텍스트)
컨텍스트 계산:
  - 입력: 1K 토큰
  - 히스토리: 20K 토큰
  - PDF: 5K 토큰 (정확한 추정)
  - 예상 출력: 2K 토큰 (PDF 작업으로 증가)
  - 안전 마진: 0.7 (PDF 무거움)
  - 필요 컨텍스트: (1K + 20K + 5K + 2K) / 0.7 ≈ 40K
결과: 그대로 사용 (1M >= 40K, 충분한 컨텍스트)

예시 4: 극대용량 대화 히스토리
1차 선택: gpt-4.1 (1M+ 컨텍스트)
컨텍스트 계산:
  - 입력: 5K 토큰
  - 히스토리: 1.2M 토큰 (매우 긴 대화)
  - 예상 출력: 5K 토큰
  - 안전 마진: 0.85 (첨부파일 없음)
  - 필요 컨텍스트: (5K + 1.2M + 5K) / 0.85 ≈ 1.42M
업그레이드 시도: 모든 모델이 1.42M 미만
결과: gemini-2.5-pro-preview-05-06 폴백 (안정성 우선)

🚨 예시 5: 에러 발생 시나리오
1차 선택: claude-sonnet-4
에러 상황: 모델 정보 로딩 실패 (네트워크 오류)
결과: gemini-2.5-pro-preview-05-06 즉시 폴백
upgradeReason: "Error occurred during model selection, using fallback: gemini-2.5-pro-preview-05-06"

🚨 예시 6: Agent 모델 없음 시나리오
1차 선택: 시도 중...
문제: isAgentEnabled: true 모델이 하나도 없음
결과: gemini-2.5-pro-preview-05-06 폴백 (하드코딩된 안전장치)
upgradeReason: "No agent-enabled models available, using fallback"
```
