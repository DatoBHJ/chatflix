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
| **비멀티모달 + 모든 복잡도** | `moonshotai/kimi-k2-instruct` | `moonshotai/kimi-k2-instruct` (단순), `claude-sonnet-4` (중간), `claude-sonnet-4-thinking` (복잡) |

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

#### **📝 텍스트만 (비멀티모달) - 🆕 2025-07-15 업데이트**

| 카테고리 | 복잡도 | Chatflix Ultimate | Chatflix Ultimate Pro |
|----------|--------|-------------------|----------------------|
| **Math** | 단순 | `moonshotai/kimi-k2-instruct` | `moonshotai/kimi-k2-instruct` |
| **Math** | 중간 | `moonshotai/kimi-k2-instruct` | `grok-3-mini` |
| **Math** | 복잡 | `grok-3-mini` | `grok-3-mini` |
| **Technical** | 단순 | `moonshotai/kimi-k2-instruct` | `moonshotai/kimi-k2-instruct` |
| **Technical** | 중간/복잡 | `moonshotai/kimi-k2-instruct` | `claude-sonnet-4` |
| **Other** | 단순 | `moonshotai/kimi-k2-instruct` | `moonshotai/kimi-k2-instruct` |
| **Other** | 중간 | `moonshotai/kimi-k2-instruct` | `moonshotai/kimi-k2-instruct` |
| **Other** | 복잡 | `moonshotai/kimi-k2-instruct` | `claude-sonnet-4` |

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

### 🆕 **특별 라우팅 규칙 (2025-07-15 추가)**

1.  **`moonshotai/kimi-k2-instruct` 컨텍스트 부족 시 폴백:**
    -   **조건:** 1차 선택 모델이 `moonshotai/kimi-k2-instruct`이지만, 계산된 `필요_컨텍스트`를 충족하지 못할 경우.
    -   **로직:** 일반적인 업그레이드 로직(효율성 점수 계산)을 실행하기 전에, `gpt-4.1` 모델이 컨텍스트 요구사항을 충족하는지 먼저 확인합니다.
    -   **결과:** `gpt-4.1`이 사용 가능하면 즉시 `gpt-4.1`로 업그레이드합니다. 그렇지 않으면 기존 업그레이드 및 폴백 로직을 따릅니다.

2.  **파일 생성(`streamObject`) 시 `moonshotai/kimi-k2-instruct` 대체:**
    -   **조건:** 최종 선택된 모델이 `moonshotai/kimi-k2-instruct`이고, 해당 요청이 파일 생성과 같이 `streamObject`를 사용하는 작업일 경우.
    -   **로직:** `moonshotai/kimi-k2-instruct` 대신 `gpt-4.1` 모델을 사용하도록 강제 전환합니다. (단, `gpt-4.1`이 컨텍스트 요구사항을 충족해야 함)
    -   **목적:** `streamObject` 기능과의 안정적인 호환성을 위해 `gpt-4.1`을 우선 사용합니다.

3.  **툴 호출(`tool-calling`) 시 `moonshotai/kimi-k2-instruct` 대체:**
    -   **조건:** 최종 선택된 모델이 `moonshotai/kimi-k2-instruct` (groq provider)이고, 해당 요청이 툴 사용이 필요한 작업일 경우 (`TEXT_RESPONSE` 또는 `FILE_RESPONSE` 라우트에서 `tools` 배열이 비어있지 않음).
    -   **로직:** `moonshotai/kimi-k2-instruct` (groq) 대신 `moonshotai/Kimi-K2-Instruct` (togetherai) 모델을 사용하도록 강제 전환합니다.
    -   **목적:** groq provider의 tool-calling 안정성 문제를 해결하기 위해 togetherai provider를 우선 사용합니다.

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

## 🔍 **주요 차이점 요약 (2025-07-15 업데이트)**

| 구분 | Chatflix Ultimate | Chatflix Ultimate Pro |
|------|-------------------|----------------------|
| **코딩 (비멀티모달)** | 모든 복잡도 `moonshotai/kimi-k2-instruct` | 단순 `moonshotai/kimi-k2-instruct`, 중간 `claude-sonnet-4`, 복잡 `claude-sonnet-4-thinking` |
| **기타 (비멀티모달)** | 모든 복잡도 `moonshotai/kimi-k2-instruct` | 단순/중간 `moonshotai/kimi-k2-instruct`, 복잡 `claude-sonnet-4` |
| **Math (비멀티모달)** | 단순/중간 `moonshotai/kimi-k2-instruct`, 복잡 `grok-3-mini` | 단순 `moonshotai/kimi-k2-instruct`, 중간/복잡 `grok-3-mini` |
| **Technical (비멀티모달)** | 모든 복잡도 `moonshotai/kimi-k2-instruct` | 단순 `moonshotai/kimi-k2-instruct`, 중간/복잡 `claude-sonnet-4` |
| **멀티모달 처리** | 더 보수적 (Gemini 중심) | 더 적극적 (Claude Sonnet 4 활용) |
| **컨텍스트 계산** | 정교한 멀티모달 토큰 추정 + 동적 안전 마진 |
| **폴백 메커니즘** | 강화된 에러 처리 + `kimi` 모델 특별 규칙 추가 |

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
1차 선택: moonshotai/kimi-k2-instruct (256K 컨텍스트) - Math 카테고리, 비멀티모달
컨텍스트 계산:
  - 입력: 1K 토큰
  - 히스토리: 20K 토큰
  - 예상 출력: 2K 토큰 (수학 문제 풀이)
  - 안전 마진: 0.85 (첨부파일 없음)
  - 필요 컨텍스트: (1K + 20K + 2K) / 0.85 ≈ 27K
결과: 그대로 사용 (256K >= 27K, 충분한 컨텍스트)

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
1차 선택: moonshotai/kimi-k2-instruct (256K 컨텍스트)
컨텍스트 계산:
  - 입력: 5K 토큰
  - 히스토리: 300K 토큰 (매우 긴 대화)
  - 예상 출력: 5K 토큰
  - 안전 마진: 0.85 (첨부파일 없음)
  - 필요 컨텍스트: (5K + 300K + 5K) / 0.85 ≈ 365K
업그레이드 시도: moonshotai/kimi-k2-instruct 컨텍스트 부족(256K < 365K). gpt-4.1(1M+)이 사용 가능하므로 gpt-4.1로 업그레이드.
결과: gpt-4.1 사용

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

🔧 예시 7: 툴 사용 시나리오
1차 선택: moonshotai/kimi-k2-instruct (groq) - Math 카테고리, 단순 복잡도
라우팅 분석: TEXT_RESPONSE, tools: ['web_search', 'calculator']
모델 대체: groq provider tool-calling 문제로 인해 moonshotai/Kimi-K2-Instruct (togetherai)로 자동 대체
결과: moonshotai/Kimi-K2-Instruct (togetherai) 사용
로그: "Tool calling detected: Switched from moonshotai/kimi-k2-instruct (groq) to moonshotai/Kimi-K2-Instruct (togetherai)"
