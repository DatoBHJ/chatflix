import { generateObject } from 'ai';
import { providers } from '@/lib/providers';
import { z } from 'zod';
import {
  MODEL_CONFIGS,
  ModelConfig,
  getModelByVariantId,
  getModelVariantId,
  isChatflixModel,
  parseModelVariantId,
  resolveDefaultModelVariantId,
  selectModelBasedOnAnalysis,
} from '@/lib/models/config';
import { estimateTokenCount, estimateMultiModalTokens, Message } from '@/utils/context-manager';

interface ModelSelectionResult {
  selectedModel: string;
  analysis: {
    category: 'coding' | 'technical' | 'math' | 'other';
    complexity: 'simple' | 'medium' | 'complex';
    hasImage: boolean;
    hasPDF: boolean;
    hasCodeAttachment: boolean;
  };
  contextInfo?: {
    estimatedTokens: number;
    requiredContext: number;
    selectedModelContext: number;
    wasUpgraded: boolean;
    upgradeReason?: string;
    breakdown?: {
      currentInputTokens: number;
      historyTokens: number;
      expectedOutputTokens: number;
      safetyMargin: number;
      isAttachmentsHeavy: boolean;
      attachmentDetails: {
        imageCount: number;
        pdfCount: number;
        codeFileCount: number;
        otherFileCount: number;
      };
    };
  };
}



// 🆕 첨부파일 무거움 판단 함수
export function isAttachmentsHeavy(
  messages: Message[], 
  hasImage: boolean, 
  hasPDF: boolean, 
  hasCodeAttachment: boolean
): boolean {
  const imageCount = messages.filter(msg => detectImages(msg)).length;
  const pdfCount = messages.filter(msg => detectPDFs(msg)).length;
  const codeFileCount = messages.filter(msg => detectCodeAttachments(msg)).length;
  
  return hasPDF || hasCodeAttachment || 
    (hasImage && imageCount > 2) || 
    pdfCount > 0 || 
    codeFileCount > 1;
}

export async function selectOptimalModel(
  messages: Message[], 
  modelType: 'chatflix-ultimate' | 'chatflix-ultimate-pro' = 'chatflix-ultimate'
): Promise<ModelSelectionResult> {
  // 사용자의 마지막 메시지 추출
  const lastUserMessage = messages[messages.length - 1];
  let lastUserContent = '';
  
  // 텍스트 콘텐츠 추출
  if (typeof lastUserMessage.content === 'string') {
    lastUserContent = lastUserMessage.content;
  } else if (Array.isArray(lastUserMessage.content)) {
    // 멀티모달 메시지에서 텍스트 부분 추출
    const textParts = lastUserMessage.content
      .filter((part: { type: string }) => part.type === 'text')
      .map((part: { text: string }) => part.text);
    lastUserContent = textParts.join('\n');
  }
  
  // 멀티모달 요소 감지
  const hasImageInMessage = detectImages(lastUserMessage);
  const hasPDFInMessage = detectPDFs(lastUserMessage);
  const hasCodeAttachmentInMessage = detectCodeAttachments(lastUserMessage);
  const hasImageInHistory = messages.slice(0, -1).some(msg => detectImages(msg));
  const hasPDFInHistory = messages.slice(0, -1).some(msg => detectPDFs(msg));
  const hasCodeAttachmentInHistory = messages.slice(0, -1).some(msg => detectCodeAttachments(msg));
  
  const hasImage = hasImageInMessage || hasImageInHistory;
  const hasPDF = hasPDFInMessage || hasPDFInHistory;
  const hasCodeAttachment = hasCodeAttachmentInMessage || hasCodeAttachmentInHistory;
  
  // 🆕 개선된 컨텍스트 길이 계산
  const contextInfo = calculateContextRequirements(
    messages, 
    lastUserContent, 
    hasImage, 
    hasPDF, 
    hasCodeAttachment
  );
  
  try {
    // Gemini 2.5 Flash Lite로 쿼리 분석
    const analysisResult = await generateObject({
      model: providers.languageModel('gemini-2.5-flash-lite'),
      schema: z.object({
        category: z.enum(['coding', 'technical', 'math', 'other']),
        complexity: z.enum(['simple', 'medium', 'complex']),
      }),
      prompt: `Analyze this query and classify it:
        
        Query: "${lastUserContent}"
        
        1. Category: 
          - 'coding' if it's about programming, code review, debugging, etc.
          - 'technical' if it's about science, logic, reasoning
          - 'math' if it's about mathematics, calculations, statistics, etc.
          - 'other' for creative writing, stories, or general knowledge
        
        2. Complexity:
          - 'simple' for straightforward questions with clear answers
          - 'medium' for questions requiring some analysis
          - 'complex' for questions requiring deep reasoning or expertise

        Provide a brief reasoning for your classification.`
    });
    
    const analysis = analysisResult.object;
    
    // 코드 첨부 파일이 있으면 코딩 카테고리로 강제 설정
    if (hasCodeAttachment) {
      analysis.category = 'coding';
    }
    
    // 컨텍스트 길이를 고려한 모델 선택
    const modelSelectionResult = selectModelWithContextAwareness(
      analysis, 
      hasImage, 
      hasPDF, 
      modelType, 
      contextInfo
    );

    return {
      selectedModel: modelSelectionResult.selectedModel,
      analysis: {
        category: analysis.category,
        complexity: analysis.complexity,
        hasImage,
        hasPDF,
        hasCodeAttachment
      },
      contextInfo: modelSelectionResult.contextInfo
    };
    
  } catch (error) {
    // 오류 발생 시 기본 Agent 모델 사용
    const fallbackModel = getAgentEnabledModels(modelType).find(m => m.id === 'gemini-3-pro-preview');
    const fallbackVariant = fallbackModel
      ? getModelVariantId(fallbackModel)
      : resolveDefaultModelVariantId('gemini-3-pro-preview');
    return {
      selectedModel: fallbackVariant,
      analysis: {
        category: 'other',
        complexity: 'medium',
        hasImage,
        hasPDF,
        hasCodeAttachment: false
      },
      contextInfo
    };
  }
}

// Agent 활성화된 모델만 필터링하는 함수
function getAgentEnabledModels(selectedModel?: string, rateLimitedLevels: string[] = []): ModelConfig[] {
  const parsed = selectedModel ? parseModelVariantId(selectedModel) : undefined;

  // 챗플릭스 모델이 선택된 경우 rate limit만 체크하고 나머지 플래그는 무시
  if (parsed && isChatflixModel(parsed.baseId)) {
    return MODEL_CONFIGS.filter(model => {
      // rate limit은 기존처럼 체크
      const isRateLimited = rateLimitedLevels.includes(model.rateLimit?.level || '');
      return !isRateLimited;
    });
  }
  
  // 기존 로직 유지 (모든 플래그 체크)
  const models = MODEL_CONFIGS.filter(model => 
    model.isEnabled && 
    model.isActivated && 
    model.isAgentEnabled === true
  );
  
  // gemini-3-pro-preview가 목록에 있는지 확인
  const hasFallback = models.some(m => m.id === 'gemini-3-pro-preview');
  
  return models;
}

// 🆕 개선된 컨텍스트 요구사항 계산 함수
function calculateContextRequirements(
  messages: Message[], 
  currentInput: string,
  hasImage: boolean = false,
  hasPDF: boolean = false,
  hasCodeAttachment: boolean = false
): {
  estimatedTokens: number;
  requiredContext: number;
  selectedModelContext: number;
  wasUpgraded: boolean;
  upgradeReason?: string;
  breakdown?: {
    currentInputTokens: number;
    historyTokens: number;
    expectedOutputTokens: number;
    safetyMargin: number;
    isAttachmentsHeavy: boolean;
    attachmentDetails: {
      imageCount: number;
      pdfCount: number;
      codeFileCount: number;
      otherFileCount: number;
    };
  };
} {
  // 1. 첨부파일 개수 및 무거운 정도 판단
  const imageCount = messages.filter(msg => detectImages(msg)).length;
  const pdfCount = messages.filter(msg => detectPDFs(msg)).length;
  const codeFileCount = messages.filter(msg => detectCodeAttachments(msg)).length;
  
  // 기타 파일 개수 계산
  const otherFileCount = messages.reduce((count, msg) => {
    if (Array.isArray(msg.experimental_attachments)) {
      return count + msg.experimental_attachments.filter(att => 
        att.fileType !== 'image' && 
        att.fileType !== 'pdf' && 
        att.fileType !== 'code' &&
        !att.contentType?.startsWith('image/') &&
        att.contentType !== 'application/pdf'
      ).length;
    }
    return count;
  }, 0);
  
  const isHeavyAttachments = isAttachmentsHeavy(messages, hasImage, hasPDF, hasCodeAttachment);
  
  const safetyMargin = isHeavyAttachments ? 0.7 : 0.85; // 70% 또는 85%만 사용
  
  // 3. 현재 입력 토큰 수 정확한 추정
  const currentInputTokens = estimateTokenCount(currentInput);
  
  // 4. 대화 히스토리 토큰 수 정확한 계산 (공통 함수 사용)
  const historyTokens = messages.slice(0, -1).reduce((total, message) => {
    return total + estimateMultiModalTokens(message);
  }, 0);
  
  // 5. 예상 출력 토큰 수 동적 계산
  let expectedOutputTokens = Math.max(currentInputTokens * 0.5, 1000);
  
  // 복잡한 작업일 경우 출력 토큰 증가
  if (hasCodeAttachment) {
    expectedOutputTokens = Math.max(expectedOutputTokens, 3000);
  }
  if (hasPDF) {
    expectedOutputTokens = Math.max(expectedOutputTokens, 2000);
  }
  if (currentInput.length > 1000) { // 긴 입력
    expectedOutputTokens = Math.max(expectedOutputTokens, currentInputTokens * 0.8);
  }
  
  // 6. 총 추정 토큰 수
  const estimatedTokens = currentInputTokens + historyTokens + expectedOutputTokens;
  
  // 7. 필요 컨텍스트 계산 (안전 마진 적용)
  const requiredContext = Math.ceil(estimatedTokens / safetyMargin);
  
  return {
    estimatedTokens,
    requiredContext,
    selectedModelContext: 0, // 초기값
    wasUpgraded: false, // 초기값
    upgradeReason: undefined, // 초기값
    breakdown: {
      currentInputTokens,
      historyTokens,
      expectedOutputTokens,
      safetyMargin,
      isAttachmentsHeavy: isHeavyAttachments,
      attachmentDetails: {
        imageCount,
        pdfCount,
        codeFileCount,
        otherFileCount
      }
    }
  };
}


// 컨텍스트 인식 모델 선택
// 컨텍스트 인식 모델 선택
function selectModelWithContextAwareness(
  analysis: { category: 'coding' | 'technical' | 'math' | 'other'; complexity: 'simple' | 'medium' | 'complex' },
  hasImage: boolean,
  hasPDF: boolean,
  modelType: 'chatflix-ultimate' | 'chatflix-ultimate-pro',
  contextInfo: { estimatedTokens: number; requiredContext: number }
): {
  selectedModel: string;
  contextInfo: {
    estimatedTokens: number;
    requiredContext: number;
    selectedModelContext: number;
    wasUpgraded: boolean;
    upgradeReason?: string;
  };
} {
  const agentModels = getAgentEnabledModels(modelType);
  try {
    // 1단계: 기존 로직으로 1차 모델 선택
    const primaryModel = selectModelBasedOnAnalysis(analysis, hasImage, hasPDF, modelType);
    const primaryModelConfig = getModelByVariantId(primaryModel);
    const primaryModelInfo = parseModelVariantId(primaryModel);
    
    // 2단계: 컨텍스트 용량 확인
    // gemini-3-flash는 1M 컨텍스트로 대부분의 경우 충분하므로 간소화된 검증
    if (primaryModelConfig && primaryModelConfig.contextWindow) {
      const isGeminiFlash = primaryModelInfo.baseId === 'gemini-3-flash-preview' || primaryModelInfo.baseId === 'gemini-2.5-flash';
      const contextSufficient = isGeminiFlash ? 
        contextInfo.requiredContext <= 800000 : // 1M 중 800K 이하면 충분
        primaryModelConfig.contextWindow >= contextInfo.requiredContext;
      
      if (contextSufficient) {
        // 컨텍스트 충분 - 1차 선택 모델 사용
        return {
          selectedModel: primaryModel,
          contextInfo: {
            ...contextInfo,
            selectedModelContext: primaryModelConfig.contextWindow,
            wasUpgraded: false
          }
        };
      }
    }
    
    // 🆕 3단계: gemini-3-flash는 1M 컨텍스트로 대부분의 경우 충분하므로 특별 처리 생략
    // (1M 컨텍스트면 거의 모든 일반적인 사용 사례에서 충분함)
    
    // 4단계: 컨텍스트 부족 - 일반적인 업그레이드 필요
    const compatibleModels = agentModels.filter(model => 
      model.contextWindow && model.contextWindow >= contextInfo.requiredContext
    );
    
    if (compatibleModels.length === 0) {
      // 🆕 폴백 로직: 적합한 모델이 없으면 gemini-3-pro-preview 사용
      const fallbackModel = agentModels.find(m => m.id === 'gemini-3-pro-preview');
      if (fallbackModel) {
        return {
          selectedModel: getModelVariantId(fallbackModel),
          contextInfo: {
            ...contextInfo,
            selectedModelContext: fallbackModel.contextWindow || 0,
            wasUpgraded: true,
            upgradeReason: 'No suitable model found, using fallback: gemini-3-pro-preview'
          }
        };
      }
      
      // 최후의 수단: 가장 큰 컨텍스트 모델 사용
      const largestContextModel = agentModels
        .filter(m => m.contextWindow)
        .sort((a, b) => (b.contextWindow || 0) - (a.contextWindow || 0))[0];
      
      return {
        selectedModel: largestContextModel ? getModelVariantId(largestContextModel) : primaryModel,
        contextInfo: {
          ...contextInfo,
          selectedModelContext: largestContextModel?.contextWindow || 0,
          wasUpgraded: true,
          upgradeReason: 'Fallback model not available, using largest available model'
        }
      };
    }
    
    // 5단계: 최적 모델 선택 (효율성 점수 기반)
    const scoredModels = compatibleModels
      .map(model => ({
      model,
      score: calculateEfficiencyScore(model, analysis, hasImage, hasPDF, contextInfo)
      }))
      .sort((a, b) => b.score - a.score);
    const selectedModel = scoredModels[0].model;
    const selectedVariantId = getModelVariantId(selectedModel);
    
    return {
      selectedModel: selectedVariantId,
      contextInfo: {
        ...contextInfo,
        selectedModelContext: selectedModel.contextWindow || 0,
        wasUpgraded: selectedVariantId !== primaryModel,
        upgradeReason: selectedVariantId !== primaryModel ? 
          `Upgraded from ${primaryModel} due to insufficient context (${primaryModelConfig?.contextWindow || 0} < ${contextInfo.requiredContext})` : 
          undefined
      }
    };
    
  } catch (error) {
    // 🆕 에러 발생 시 폴백 로직
    
    const fallbackModel = agentModels.find(m => m.id === 'gemini-3-pro-preview');
    
    if (fallbackModel) {
      return {
        selectedModel: getModelVariantId(fallbackModel),
        contextInfo: {
          ...contextInfo,
          selectedModelContext: fallbackModel.contextWindow || 0,
          wasUpgraded: true,
          upgradeReason: `Error occurred during model selection, using fallback: gemini-3-pro-preview`
        }
      };
    }
    
    // 최후의 수단: 첫 번째 사용 가능한 모델
    const firstAvailable = agentModels[0];
    return {
      selectedModel: firstAvailable ? getModelVariantId(firstAvailable) : resolveDefaultModelVariantId('gemini-3-pro-preview'),
      contextInfo: {
        ...contextInfo,
        selectedModelContext: firstAvailable?.contextWindow || 0,
        wasUpgraded: true,
        upgradeReason: 'Critical fallback: using first available model'
      }
    };
  }
}


// 효율성 점수 계산
function calculateEfficiencyScore(
  model: ModelConfig,
  analysis: { category: string; complexity: string },
  hasImage: boolean,
  hasPDF: boolean,
  contextInfo: { requiredContext: number }
): number {
  let score = 0;
  
  // 지능 지수 (40%)
  const intelligenceScore = (model.intelligenceIndex || 50) * 0.4;
  score += intelligenceScore;
  
  // 속도 점수 (30%)
  const tpsScore = Math.min((model.tps || 50) / 100, 2) * 15; // TPS 정규화
  const latencyScore = model.latency ? Math.max(0, 15 - (model.latency / 10)) : 15; // 지연시간 역수
  score += (tpsScore + latencyScore) * 0.3;
  
  // 컨텍스트 여유도 (20%)
  const contextRatio = model.contextWindow ? model.contextWindow / contextInfo.requiredContext : 1;
  const contextScore = Math.min(contextRatio, 3) * 20 / 3; // 최대 3배까지만 점수 반영
  score += contextScore * 0.2;
  
  // 기능 매칭도 (10%)
  let featureScore = 10;
  if ((hasImage || hasPDF) && !model.supportsVision && !model.supportsPDFs) {
    featureScore = 5; // 멀티모달 필요하지만 지원하지 않음
  }
  if (analysis.category === 'coding' && model.provider === 'openai') {
    featureScore += 5; // 코딩 작업에 OpenAI 모델 보너스
  }
  if (analysis.category === 'math' && model.id.includes('grok')) {
    featureScore += 5; // 수학 작업에 Grok 모델 보너스
  }
  score += featureScore * 0.1;
  
  return score;
}
function detectImages(message: Message): boolean {
  // experimental_attachments 배열을 확인
  if (Array.isArray(message.experimental_attachments)) {
    return message.experimental_attachments.some((attachment) => 
      attachment.fileType === 'image' || 
      (attachment.contentType && attachment.contentType.startsWith('image/')) ||
      (attachment.name && attachment.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i))
    );
  }
  
  // v5 parts 확인
  if (Array.isArray(message.parts)) {
    return message.parts.some((part: any) => part.type === 'image') ||
      message.parts.some((part: any) => 
        part.type === 'file' && 
        (part.mediaType?.startsWith('image/') || 
        (part.filename || '').match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i))
      );
  }

  // 레거시 content 배열 확인
  if (Array.isArray(message.content)) {
    return message.content.some((part: { type: string }) => part.type === 'image') ||
      message.content.some((part: any) => 
        part.type === 'file' && 
        (part.file?.contentType?.startsWith('image/') || 
        part.file?.name?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i))
      );
  }
  
  return false;
}

function detectPDFs(message: Message): boolean {
  // experimental_attachments 배열을 확인
  if (Array.isArray(message.experimental_attachments)) {
    return message.experimental_attachments.some((attachment) => 
      attachment.fileType === 'pdf' || 
      attachment.contentType === 'application/pdf' ||
      (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))
    );
  }
  
  // v5 parts 확인
  if (Array.isArray(message.parts)) {
    return message.parts.some((part: any) => 
      (part.type === 'file' && (part.filename || '').toLowerCase().endsWith('.pdf')) ||
      (part.type === 'file' && part.mediaType === 'application/pdf')
    );
  }

  // 레거시 content 배열 확인도 유지
  if (Array.isArray(message.content)) {
    return message.content.some((part: any) => 
      (part.type === 'file' && part.file?.name?.toLowerCase().endsWith('.pdf')) ||
      (part.type === 'file' && part.file?.contentType === 'application/pdf')
    );
  }
  
  return false;
}

function detectCodeAttachments(message: Message): boolean {
  if (Array.isArray(message.experimental_attachments)) {
    if (message.experimental_attachments.some((attachment) => 
      attachment.fileType === 'code' || 
      (attachment.name && attachment.name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i))
    )) return true;
  }

  // v5 parts에서 코드 파일 감지 (filename 기반)
  if (Array.isArray(message.parts)) {
    if (message.parts.some((part: any) => 
      part.type === 'file' &&
      ((part.filename || '').match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i))
    )) return true;
  }

  // 레거시 content 배열에서도 확인
  if (Array.isArray(message.content)) {
    if (message.content.some((part: any) => 
      part.type === 'file' &&
      ((part.file?.name || '').match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i))
    )) return true;
  }

  return false;
}

