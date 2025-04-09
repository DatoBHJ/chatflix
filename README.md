chatflix.app - the Netflix of chatbots

- super minimal fye ui/ux lol
- customizable prompt shortcuts
- vision 
- file uplaod
- image generation (experimental)
- academic search for scholarly articles
- works with both reasoning & non-reasoning models
- switch models mid-convo
- supports the bests models itw (sonnet, openai, deepseek, google, meta ..etc) 
- web search / deep search mode (soon). 

https://www.chatflix.app

---

# Cursor Agent 스타일 구현 가이드

이 문서는 chatflix 앱에 구현된 Cursor Agent 스타일의 메모리 관리 및 컨텍스트 윈도우 시스템에 대한 자세한 설명을 제공합니다.

## 목차

1. [개요](#1-개요)
2. [데이터베이스 구조](#2-데이터베이스-구조)
3. [메모리 뱅크 시스템](#3-메모리-뱅크-시스템)
4. [프로젝트 상태 추적](#4-프로젝트-상태-추적)
5. [컨텍스트 윈도우 최적화](#5-컨텍스트-윈도우-최적화)
6. [API 구현](#6-api-구현)
7. [문제 해결 및 디버깅](#7-문제-해결-및-디버깅)
8. [향후 확장](#8-향후-확장)

## 1. 개요

Cursor Agent 스타일의 구현은 장기적인 대화 컨텍스트를 관리하고 프로젝트 진행 상황을 추적하기 위한 시스템입니다. 이 접근 방식의 핵심 요소는 다음과 같습니다:

- **메모리 뱅크**: 중요한 정보를 카테고리별로 저장하고 참조하는 구조화된 저장소
- **프로젝트 상태 추적**: 현재 진행 상황, 결정 사항, 다음 단계를 기록하는 메커니즘
- **컨텍스트 윈도우 최적화**: 모델별 토큰 제한을 고려한 메시지 선택 알고리즘
- **에이전트 모드**: 다양한 도구(웹 검색, 계산기, 링크 리더 등)를 활용한 향상된 보조 기능

이 시스템은 모델의 컨텍스트 제한을 효율적으로 관리하면서 장기적인 대화 맥락을 유지하는 데 초점을 맞추고 있습니다.

## 2. 데이터베이스 구조

Supabase를 사용하여 다음과 같은 테이블을 구현했습니다:

### memory_bank 테이블

```sql
CREATE TABLE memory_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- RLS 정책
ALTER TABLE memory_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own memory bank"
  ON memory_bank FOR ALL
  USING (auth.uid() = user_id);
```

### project_status 테이블

```sql
CREATE TABLE project_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chat_session_id, user_id)
);

-- RLS 정책
ALTER TABLE project_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own project status"
  ON project_status FOR ALL
  USING (auth.uid() = user_id);
```

## 3. 메모리 뱅크 시스템

메모리 뱅크는 대화에서 얻은 중요한 정보를 카테고리별로 저장하고 관리하는 시스템입니다.

### 구현된 카테고리

- **00-project-overview**: 프로젝트 설명 및 목표
- **01-summary**: 대화 요약 및 핵심 포인트
- **02-progress**: 현재 진행 상황 및 단계
- **03-decisions**: 중요 결정 사항 및 이유
- **04-lessons**: 학습된 교훈 및 모범 사례

### 주요 기능

#### 메모리 뱅크 초기화

```typescript
export async function initializeMemoryBank(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const defaultEntries = [
    {
      category: '00-project-overview',
      content: '# Project Overview\n\nThis section contains the overall project description and goals.'
    },
    // 다른 카테고리 초기화...
  ];
  
  for (const entry of defaultEntries) {
    await updateMemoryBank(supabase, userId, entry.category, entry.content);
  }
}
```

#### 메모리 뱅크 전체 조회

```typescript
export async function getAllMemoryBank(
  supabase: SupabaseClient,
  userId: string,
  categories?: string[]
): Promise<{ data: string | null; error: any }> {
  let query = supabase
    .from('memory_bank')
    .select('category, content')
    .eq('user_id', userId);
  
  if (categories && categories.length > 0) {
    query = query.in('category', categories);
  }
  
  const { data, error } = await query;
  
  // 메모리 뱅크 내용을 마크다운 형식으로 변환하는 로직...
  
  return { data: memoryContent, error: null };
}
```

#### 메모리 뱅크 업데이트

```typescript
export async function updateMemoryBank(
  supabase: SupabaseClient,
  userId: string,
  category: string,
  content: string
): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase
    .from('memory_bank')
    .upsert({
      user_id: userId,
      category,
      content,
      updated_at: new Date().toISOString()
    }, { onConflict: ['user_id', 'category'] });
  
  return { data, error };
}
```

### 자동 업데이트 메커니즘

대화 종료 시, AI는 다음과 같은 정보를 자동으로 업데이트합니다:

1. **대화 요약 (01-summary)**: 최근 대화 내용을 분석하여 핵심 정보를 요약
2. **진행 상황 (02-progress)**: 프로젝트 진행 상황, 완료된 항목, 다음 단계 등 업데이트

```typescript
// 대화 요약 생성 예시 코드
const summaryPrompt = `Summarize the key points of this conversation related to the project and tasks. Include any decisions made and action items.`;

const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Create a concise summary of the conversation focusing on project-related information.' },
      { role: 'user', content: summaryPrompt }
    ],
    max_tokens: 500,
    temperature: 0.3
  })
});

if (summaryResponse.ok) {
  const summaryData = await summaryResponse.json();
  const summaryText = summaryData.choices?.[0]?.message?.content || '';
  
  if (summaryText) {
    await updateMemoryBank(supabase, user.id, '01-summary', summaryText);
  }
}
```

### 백그라운드 메모리 업데이트

사용자 경험을 개선하기 위해 메모리 뱅크 업데이트를 백그라운드에서 비동기적으로 처리합니다:

```typescript
// 먼저 AI 응답을 사용자에게 보여줌
await handleStreamCompletion(
  supabase,
  assistantMessageId,
  user.id,
  model,
  getProviderFromModel(model),
  completion,
  isRegeneration,
  toolResults ? { 
    tool_results: toolResults,
    full_text: completion.text
  } : undefined
);

// 백그라운드에서 메모리 업데이트 수행
if (chatId && !abortController.signal.aborted) {
  updateMemoryBankInBackground(
    supabase, 
    user.id, 
    chatId, 
    optimizedMessages, 
    userMessage, 
    aiMessage
  ).catch((error: Error) => {
    console.error("[DEBUG-AGENT] Background memory update error:", error);
  });
}
```

### 병렬 메모리 업데이트 최적화

각 카테고리별 메모리 업데이트를 병렬로 처리하여 전체 업데이트 시간을 단축합니다:

```typescript
// 프로젝트 상태 업데이트를 먼저 실행 (02-progress가 이에 의존하기 때문)
const statusText = await updateProjectStatusAsync();

// 나머지 모든 업데이트를 병렬로 실행
await Promise.all([
  updateProgressAsync(statusText),
  updateSummaryAsync(),
  updateOverviewAsync(),
  updateArchitectureAsync(),
  updateDecisionsAsync()
]);
```

## 4. 프로젝트 상태 추적

프로젝트 상태 추적 시스템은 현재 대화 세션과 관련된 프로젝트 상태를 저장하고 업데이트합니다.

### 주요 기능

#### 프로젝트 상태 조회

```typescript
export async function getProjectStatus(
  supabase: SupabaseClient,
  chatId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('project_status')
    .select('content')
    .eq('chat_session_id', chatId)
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    // 기본 상태 템플릿 생성
    return createDefaultStatus();
  }
  
  return data.content;
}
```

#### 프로젝트 상태 업데이트

```typescript
export async function updateProjectStatus(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  content: string
): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase
    .from('project_status')
    .upsert({
      chat_session_id: chatId,
      user_id: userId,
      content,
      updated_at: new Date().toISOString()
    }, { onConflict: ['chat_session_id', 'user_id'] });
  
  return { data, error };
}
```

### 자동 상태 업데이트

대화가 끝날 때 AI가 대화 내용을 분석하여 프로젝트 상태를 자동으로 업데이트합니다:

```typescript
const statusUpdatePrompt = `Based on our conversation, please provide a concise update to the project status in markdown format. Focus only on what has changed.`;

// 현재 상태와 대화 내용 준비
const currentStatus = await getProjectStatus(supabase, chatId, user.id);
const userMessage = typeof processedLastMessage.content === 'string' 
  ? processedLastMessage.content 
  : JSON.stringify(processedLastMessage.content);
const aiMessage = completion.text;

// 상태 업데이트 생성 및 저장
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Generate a concise project status update based on the conversation.' },
      { role: 'user', content: finalPrompt }
    ],
    max_tokens: 300,
    temperature: 0.3
  })
});

// 응답 처리 및 저장 로직...
```

## 5. 컨텍스트 윈도우 최적화

모델의 컨텍스트 윈도우 크기를 효율적으로 활용하기 위한 최적화 기능을 구현했습니다.

### 토큰 추정 및 메시지 선택

```typescript
function selectMessagesWithinTokenLimit(messages: MultiModalMessage[], maxTokens: number, isAttachmentsHeavy: boolean = false): MultiModalMessage[] {
  // 파일 첨부물이 많은 경우 추가 안전 마진 적용
  const safetyMargin = isAttachmentsHeavy ? 0.7 : 0.85; // 70% 또는 85%만 사용
  const adjustedMaxTokens = Math.floor(maxTokens * safetyMargin);
  
  // 필수 포함 메시지 (마지막 사용자 메시지는 항상 포함)
  const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.role === 'user');
  const lastUserMessage = lastUserMessageIndex >= 0 ? messages[messages.length - 1 - lastUserMessageIndex] : null;
  
  // 필수 메시지의 토큰 수 계산
  let reservedTokens = 0;
  if (lastUserMessage) {
    const content = typeof lastUserMessage.content === 'string' ? lastUserMessage.content : JSON.stringify(lastUserMessage.content);
    reservedTokens = estimateTokenCount(content);
  }
  
  // 실제 사용 가능한 토큰 수 계산
  const availableTokens = adjustedMaxTokens - reservedTokens;
  
  // 메시지 선택 로직...
  
  return selectedMessages;
}
```

### 멀티모달 콘텐츠 처리

```typescript
// 멀티모달 콘텐츠의 토큰 수 추정 함수
const estimateMultiModalTokens = (msg: MultiModalMessage): number => {
  // 텍스트 콘텐츠
  if (typeof msg.content === 'string') {
    return estimateTokenCount(msg.content);
  }
  
  // 멀티모달 콘텐츠 (이미지, 파일 등)
  if (Array.isArray(msg.content)) {
    let total = 0;
    
    for (const part of msg.content) {
      if (part.type === 'text') {
        total += estimateTokenCount(part.text || '');
      } else if (part.type === 'image') {
        // 이미지는 약 1000 토큰으로 추정
        total += 1000;
      } else if (part.type === 'file') {
        // 파일 내용에 따라 다르지만 평균적으로 파일당 5000 토큰으로 추정
        total += 5000;
      }
    }
    
    return total;
  }
  
  // 기타 형식
  return estimateTokenCount(JSON.stringify(msg.content));
};
```

### 모델별 컨텍스트 윈도우 적용

```typescript
// 모델의 컨텍스트 윈도우 또는 기본값 사용
const maxContextTokens = modelConfig?.contextWindow || 8000;
const remainingTokens = maxContextTokens - systemTokens;

console.log(`[DEBUG-TOKEN] Model: ${model}, Context window: ${maxContextTokens}, System tokens: ${systemTokens}, Remaining: ${remainingTokens}`);
```

## 6. API 구현

API 라우트에 Cursor Agent 스타일의 기능을 통합했습니다.

### 에이전트 모드 분기 처리

```typescript
// API 라우트의 주요 로직
if (isAgentEnabled) {
  // 에이전트 모드에서만 메모리 뱅크 초기화 완료 대기
  await memoryInitPromise;
  
  // 1. 메모리 뱅크 전체 내용 조회
  const { data: memoryData } = await getAllMemoryBank(supabase, user.id);
  
  // 2. 프로젝트 상태 조회
  const statusContent = await getProjectStatus(supabase, chatId || 'default', user.id);
  
  // 3. 향상된 시스템 프롬프트 구성
  // ...
  
  // 4. 라우팅 결정 - 필요한 도구 선택
  const routingDecision = await routerStream.object;
  
  // 5. 선택된 도구로 작업 수행
  // ...
  
  // 6. 대화 종료 시 메모리 및 상태 업데이트
  // ...
} else {
  // 일반 채팅 모드 - 컨텍스트 윈도우 최적화만 적용
  // ...
}
```

### 메모리 통합 시스템 프롬프트

```typescript
// 메모리 뱅크와 프로젝트 상태를 시스템 프롬프트에 통합
if (memoryData) {
  currentSystemPrompt = `${systemPrompt}\n\n## MEMORY BANK\n\n${memoryData}\n\n## PROJECT STATUS\n\n${statusContent}`;
} else {
  currentSystemPrompt = `${systemPrompt}\n\n## PROJECT STATUS\n\n${statusContent}`;
}
```

### 라우팅 결정 로직

```typescript
const routerStream = streamObject({
  model: providers.languageModel('gpt-4o-mini'),
  system: `Analyze the query efficiently to determine which tools are needed:
1: Web search - For factual info or current events
2: Calculator - For math calculations  
3: Link reader - For URL content extraction
4: Image generator - For generating images from text 
5: Academic search - For scholarly articles and research papers

Use minimal reasoning. Focus on:
- Query keywords suggesting specific tools 
- Explicit mentions of URLs, calculations, or information needs
- Previous context indicating tool requirements
**IMPORTANT: Always generate reasoning in user's language.**
`,
  prompt: userQuery,
  schema: z.object({
    reasoning: z.string().describe("Brief reasoning for your decision"),
    needsWebSearch: z.boolean().describe("True if web search needed"),
    // 다른 도구 필요 여부...
  }),
  temperature: 0.1, // 낮은 temperature로 결정적 응답 유도
  maxTokens: 300, // 짧은 응답 제한으로 속도 향상
});

// 최종 결과 기다리기
const routingDecision = await routerStream.object;
```

## 7. 문제 해결 및 디버깅

구현 과정에서 다음과 같은 문제를 해결했습니다:

### 토큰 한도 초과 문제

문제: 복잡한 대화나 파일 첨부가 있는 경우 모델의 컨텍스트 윈도우 한도를 초과하는 문제가 발생했습니다.

해결책:
1. 안전 마진 도입 (파일 첨부가 있는 경우 70%, 일반적인 경우 85%만 사용)
2. 토큰 수 추정 로직 개선 (특히 멀티모달 콘텐츠에 대한 처리)
3. 필수 메시지 예약 (마지막 사용자 메시지는 항상 포함)

```typescript
// 파일 첨부 여부 확인
const hasFileAttachments = processMessages.some(msg => {
  if (Array.isArray(msg.content)) {
    return msg.content.some(part => part.type === 'file');
  }
  return false;
});

// 토큰 제한 내에서 메시지 선택 - 파일 첨부 여부에 따라 다른 마진 적용
const optimizedMessages = selectMessagesWithinTokenLimit(
  processMessages, 
  remainingTokens,
  hasFileAttachments
);
```

### 성능 및 반응성 문제

문제: 메모리 뱅크 업데이트 과정이 AI 응답 완료 후에도 사용자 인터페이스를 지연시키는 문제가 발생했습니다.

해결책:
1. 메모리 업데이트를 백그라운드로 분리하여 사용자에게 AI 응답을 즉시 표시
2. 각 카테고리별 메모리 업데이트를 병렬로 처리하여 전체 업데이트 시간 단축
3. 상태 업데이트와 의존성이 있는 업데이트만 순차적으로 처리하고 나머지는 병렬 처리

```typescript
// 백그라운드에서 메모리 업데이트 수행 - AI 응답 완료 후 즉시 비동기 실행
updateMemoryBankInBackground(supabase, user.id, chatId, messages, userMessage, aiMessage)
  .catch(error => console.error("[DEBUG-AGENT-BG] Background memory update error:", error));

// 병렬 처리 구현으로 업데이트 시간 단축
async function updateMemoryBankInBackground() {
  // 상태 업데이트는 먼저 실행 (다른 업데이트의 의존성)
  const statusText = await updateProjectStatusAsync();
  
  // 나머지 업데이트는 모두 병렬로 실행
  await Promise.all([
    updateProgressAsync(statusText),
    updateSummaryAsync(),
    updateOverviewAsync(),
    updateArchitectureAsync(),
    updateDecisionsAsync()
  ]);
}
```

### 디버깅 로그 개선

상세한 디버깅 로그를 추가하여 문제 해결을 용이하게 했습니다:

```typescript
// 토큰 계산 디버그 로그
console.log(`[DEBUG-TOKEN] Token limit: ${maxTokens}, Adjusted limit with safety margin: ${adjustedMaxTokens}`);
console.log(`[DEBUG-TOKEN] Reserved tokens for last user message: ${reservedTokens}`);
console.log(`[DEBUG-TOKEN] Available tokens after reservation: ${availableTokens}`);

// 메모리 뱅크 관련 디버그 로그
console.log("[DEBUG-AGENT] Memory bank data:", memoryData ? "Retrieved successfully" : "Not found");
console.log("[DEBUG-AGENT] Project status:", statusContent ? "Retrieved successfully" : "Not found");

// 라우팅 결정 디버그 로그
console.log("[DEBUG-AGENT] Router decision:", JSON.stringify(routingDecision));
console.log("[DEBUG-AGENT] Using tools:", 
  [
    routingDecision.needsWebSearch && "web_search",
    routingDecision.needsCalculator && "calculator", 
    // 다른 도구들...
  ].filter(Boolean).join(", ") || "none"
);
```

### 데이터베이스 저장 확인

상태 업데이트 후 저장이 정상적으로 이루어졌는지 확인하는 로직:

```typescript
const checkStatus = await supabase
  .from('project_status')
  .select('id, content')
  .eq('user_id', user.id)
  .eq('chat_session_id', chatId)
  .single();

if (checkStatus.error) {
  console.error("[DEBUG-AGENT] Failed to verify project status update:", checkStatus.error);
} else if (checkStatus.data) {
  console.log("[DEBUG-AGENT] Verified project status in DB:", checkStatus.data.id);
} else {
  console.error("[DEBUG-AGENT] Project status update verification failed - record not found");
}
```

## 8. 향후 확장

현재 구현을 기반으로 다음과 같은 확장을 고려할 수 있습니다:

### UI 개선

메모리 뱅크와 프로젝트 상태를 시각화하고 편집할 수 있는 UI 컴포넌트:

1. **메모리 뱅크 대시보드**: 카테고리별 내용을 탭 형식으로 표시하고 편집할 수 있는 인터페이스
2. **프로젝트 상태 시각화**: 프로젝트 진행 상황을 타임라인이나 칸반 보드 형태로 표시
3. **에이전트 활동 모니터링**: 활성화된 도구와 진행 상황을 실시간으로 표시하는 상태 바
4. **컨텍스트 윈도우 시각화**: 현재 사용 중인 토큰 수와 남은 토큰 수를 그래프로 표시

### 시스템 개선

1. **테마별 메모리 뱅크**: 여러 주제나 프로젝트에 대한 별도의 메모리 뱅크 관리
2. **프로젝트 템플릿**: 일반적인 프로젝트 유형에 대한 사전 정의된 메모리 뱅크 및 상태 템플릿
3. **지식 그래프 통합**: 메모리 뱅크 항목 간의 연결과 관계를 시각화하는 그래프 뷰
4. **문서 통합**: 코드 파일, 문서 등을 자동으로 분석하여 관련 정보를 메모리 뱅크에 추가

### 팀 협업

1. **공유 메모리 뱅크**: 팀원 간에 공유되는 프로젝트 메모리 뱅크
2. **변경 기록 추적**: 메모리 뱅크 및 프로젝트 상태 변경에 대한 기록 유지
3. **역할 기반 접근 제어**: 다양한 팀 역할에 따른 메모리 뱅크 접근 권한 관리

## 결론

Cursor Agent 스타일의 구현을 통해 장기적인 대화 컨텍스트 관리, 프로젝트 상태 추적, 그리고 최적화된 컨텍스트 윈도우 활용이 가능해졌습니다. 이 시스템은 복잡한 프로젝트에서 일관된 지원을 제공하며, 사용자의 작업 맥락을 효과적으로 유지합니다.

현재 구현된 백엔드 시스템을 기반으로 다양한 UI 컴포넌트와 추가 기능을 개발하여 더욱 강력한 에이전트 시스템으로 발전시킬 수 있을 것입니다.

