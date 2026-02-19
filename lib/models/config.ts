export interface ModelConfig {
  id: string;
  name: string;
  cutoff?: string;
  pro?: boolean;
  country: string;
  description?: string;
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'together' | 'groq' | 'xai' | 'fireworks';
  creator?: string; // Company/organization that developed the model (may differ from provider)
  supportsVision: boolean;
  supportsPDFs: boolean;
  abbreviation?: string; // Short name to display on mobile devices
  rateLimit: {
    level: 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
  };
  isEnabled: boolean;
  isActivated: boolean; // Whether the model is activated for selection
  isAgentEnabled?: boolean;
  isNew?: boolean; // Mark model as new
  isHot?: boolean; // Mark model as hot/popular
  isUpdated?: boolean; // Mark model as recently updated
  updateDescription?: string; // Description for the update tooltip
  
  // Simple reasoning flag (scira style)
  reasoning?: boolean;
  
  // Reasoning effort level for Groq models
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'default' | 'none';

  // Gemini-style thinking configuration
  thinkingConfig?: {
    budget?: number;        // Gemini 2.5 (thinking_budget)
    dynamic?: boolean;      // Gemini 2.5 (thinking_budget: -1)
    level?: 'minimal' | 'low' | 'medium' | 'high';  // Gemini 3 (thinking_level)
    includeThoughts?: boolean;
  };
  
  // Performance metrics (optional)
  contextWindow?: number;
  tps?: number; // Tokens per second
  intelligenceIndex?: number; // AI Intelligence Index
  latency?: number; // Response latency
  maxOutputTokens?: number;
}

// Default model configuration
export const DEFAULT_MODEL_ID = 'chatflix-ultimate'; 

export const RATE_LIMITS = {
  level0: {
    hourly: {
      requests: 10,    
      window: '12 h'
    },
    daily: {
      requests: 20,    
      window: '24 h'
    }
  },
  level1: {
    hourly: {
      requests: 10,    
      window: '12 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level2: {
    hourly: {
      requests: 10,
      window: '12 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level3: {
    hourly: {
      requests: 10,    
      window: '12 h'
    },
    daily: {
      requests: 10,
      window: '24 h'
    }
  },
  level4: {
    hourly: {
      requests: 2,    
      window: '1 h'
    },
    daily: {
      requests: 10,
      window: '24 h'
    }
  },
  level5: {
    hourly: {
      requests: 2,    
      window: '1 h'
    },
    daily: {
      requests: 10,
      window: '24 h'
    }
  },

};


// Get system default model ID (should match Supabase's get_default_model_id function)
export function getSystemDefaultModelId(): string {
  // Check if the default model is activated
  const defaultModel = MODEL_CONFIGS.find(model => model.id === DEFAULT_MODEL_ID);
  
  if (defaultModel && defaultModel.isEnabled && defaultModel.isActivated) {
    return DEFAULT_MODEL_ID;
  } else {
    // If the default model is not enabled or activated, find the first activated model
    const firstActivatedModel = getActivatedModels()[0];
    return firstActivatedModel ? firstActivatedModel.id : DEFAULT_MODEL_ID; // Fallback to default even if not activated as last resort
  }
}


// Reasoning effort helper constants
const REASONING_EFFORT_SUFFIXES: Array<NonNullable<ModelConfig['reasoningEffort']>> = [
'none',
'minimal',
'low',
'medium',
'high',
'default',
];

// 챗플릭스 모델인지 확인하는 함수
export function isChatflixModel(modelId: string): boolean {
return modelId === 'chatflix-ultimate' || modelId === 'chatflix-ultimate-pro';
}

export function buildModelVariantId(
modelId: string,
reasoningEffort?: ModelConfig['reasoningEffort'] | null
): string {
if (!reasoningEffort) {
  return modelId;
}
return `${modelId}-${reasoningEffort}`;
}

export function getModelVariantId(model: ModelConfig): string {
return buildModelVariantId(model.id, model.reasoningEffort);
}

export function parseModelVariantId(
identifier: string
): { baseId: string; reasoningEffort?: NonNullable<ModelConfig['reasoningEffort']> } {
const parts = identifier.split('-');
const possibleEffort = parts[parts.length - 1] as NonNullable<ModelConfig['reasoningEffort']>;

if (parts.length >= 2 && REASONING_EFFORT_SUFFIXES.includes(possibleEffort)) {
  const baseId = parts.slice(0, -1).join('-');
  return { baseId, reasoningEffort: possibleEffort };
}

return { baseId: identifier };
}

// 복잡도에 따라 Gemini 3 모델의 reasoning variant 선택
function pickGemini3Variant(
  baseId: 'gemini-3-pro-preview' | 'gemini-3-flash-preview',
  complexity: 'simple' | 'medium' | 'complex'
): string {
  if (complexity === 'simple') {
    // Simple: 빠른 응답을 위해 low/minimal variant 사용
    if (baseId === 'gemini-3-pro-preview') {
      return resolveDefaultModelVariantId('gemini-3-pro-preview-low');
    } else {
      return resolveDefaultModelVariantId('gemini-3-flash-preview-minimal');
    }
  } else {
    // Medium/Complex: 높은 성능을 위해 high variant 사용
    return resolveDefaultModelVariantId(`${baseId}-high`);
  }
}

// 복잡도에 따라 GPT-5.2 모델의 reasoning variant 선택
function pickGPT52Variant(
  complexity: 'simple' | 'medium' | 'complex'
): string {
  if (complexity === 'simple') {
    // Simple: 빠른 응답을 위해 none variant 사용
    return resolveDefaultModelVariantId('gpt-5.2-none');
  } else {
    // Medium/Complex: 높은 성능을 위해 high variant 사용
    return resolveDefaultModelVariantId('gpt-5.2-high');
  }
}

// Chatflix 라우팅 로직: 중앙화된 모델 선택 로직
// 이 함수를 수정하면 서버와 클라이언트 모두에 자동으로 반영됨
export function selectModelBasedOnAnalysis(
  analysis: { category: 'coding' | 'technical' | 'math' | 'other'; complexity: 'simple' | 'medium' | 'complex' },
  hasImage: boolean,
  hasPDF: boolean,
  modelType: 'chatflix-ultimate' | 'chatflix-ultimate-pro' = 'chatflix-ultimate'
): string {
const pick = (modelId: string) => resolveDefaultModelVariantId(modelId);

  // 1단계: 코딩 카테고리 최우선 처리
  if (analysis.category === 'coding') {
    if (modelType === 'chatflix-ultimate-pro') {
      // Pro 버전 코딩 로직
      if (hasImage || hasPDF) {
        // 멀티모달 + 코딩
        if (analysis.complexity === 'simple') {
        return pick('gemini-3-flash-preview-high'); // gemini 3 flash high
        } else { // medium/complex
        return pickGemini3Variant('gemini-3-pro-preview', analysis.complexity); // gemini 3 pro
        }
      } else {
        // 비멀티모달 + 코딩
        if (analysis.complexity === 'simple') {
        return pick('grok-code-fast-1'); // grok code fast for simple coding
        } else if (analysis.complexity === 'medium') {
        return pick('accounts/fireworks/models/kimi-k2p5');
        } else { // complex
        return pick('accounts/fireworks/models/kimi-k2p5');
        }
      }
    } else {
      // 일반 버전 코딩 로직
      if (hasImage || hasPDF) {
        // 멀티모달 + 코딩
        if (analysis.complexity === 'complex') {
        return pickGemini3Variant('gemini-3-pro-preview', analysis.complexity); // gemini 3 pro
        } else { // simple/medium
        return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity); // gemini 3 flash
        }
      } else {
        // 비멀티모달 + 코딩: 복잡도에 따라 모델 선택
        if (analysis.complexity === 'simple') {
        return pick('grok-code-fast-1'); // grok code fast for simple coding tasks
        } else {
        return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity); // gemini 3 flash for medium/complex
        }
      }
    }
  }
  
  // 2단계: 멀티모달 요소 처리
  else if (hasImage) {
    if (analysis.category === 'technical' || analysis.category === 'math') {
      // 이미지 + 기술/수학: Pro는 gpt-5.2, 일반은 gemini 3 pro
    return modelType === 'chatflix-ultimate-pro' ? pickGPT52Variant(analysis.complexity) : pickGemini3Variant('gemini-3-pro-preview', analysis.complexity);
    } else {
      // 이미지 + 기타 카테고리
      if (modelType === 'chatflix-ultimate-pro') {
        // Pro 버전: 단순/중간은 gemini 3 flash, 복잡은 gemini 3 pro
        if (analysis.complexity === 'complex') {
        return pickGemini3Variant('gemini-3-pro-preview', analysis.complexity);
        } else { // simple/medium
        return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
        }
      } else {
        // 일반 버전
        if (analysis.complexity === 'simple') {
        return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
        } else if (analysis.complexity === 'medium') {
        return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
        } else { // complex
        return pickGemini3Variant('gemini-3-pro-preview', analysis.complexity);
        }
      }
    }
  }
  else if (hasPDF) {
    // PDF 처리 (카테고리 무관)
    if (modelType === 'chatflix-ultimate-pro') {
      // Pro 버전: 모든 복잡도에서 gemini 3 flash (단순/중간), gemini 3 pro (복잡)
      if (analysis.complexity === 'complex') {
      return pickGemini3Variant('gemini-3-pro-preview', analysis.complexity);
      } else { // simple/medium
      return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
      }
    } else {
      // 일반 버전
      if (analysis.complexity === 'simple') {
      return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
      } else if (analysis.complexity === 'medium') {
      return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
      } else { // complex
      return pickGemini3Variant('gemini-3-pro-preview', analysis.complexity);
      }
    }
  }
  
  // 3단계: 텍스트만 있는 경우 (비멀티모달)
  else {
    if (analysis.category === 'math') {
      // 수학 카테고리 - 비멀티모달: Ultimate는 openai/gpt-oss-120b-high, Pro는 gpt-5.2 사용
    return modelType === 'chatflix-ultimate-pro' ? pickGPT52Variant(analysis.complexity) : pick('openai/gpt-oss-120b-high');
    }
    else if (analysis.category === 'technical') {
      // 기술 카테고리
      if (modelType === 'chatflix-ultimate-pro') {
        // Pro 버전: 단순 gemini-3-flash, 중간/복잡 claude-sonnet-4-6
        if (analysis.complexity === 'simple') {
        return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
        } else { // medium/complex
        return pick('accounts/fireworks/models/kimi-k2p5');
        }
      } else {
        // 일반 버전: 모든 복잡도 gemini-3-flash
      return pickGemini3Variant('gemini-3-flash-preview', analysis.complexity);
      }
    }
    else {
      // 기타 카테고리
      if (modelType === 'chatflix-ultimate-pro') {
        // Pro 버전: 복잡도에 따라 모델 선택
        if (analysis.complexity === 'simple') {
        return pick('accounts/fireworks/models/kimi-k2p5');
        } else if (analysis.complexity === 'medium') {
        return pick('accounts/fireworks/models/kimi-k2p5');
        } else { // complex
        return pickGPT52Variant(analysis.complexity);
        }
      } else {
        // 일반 버전: 복잡도에 따라 모델 선택
        if (analysis.complexity === 'simple') {
        return pick('accounts/fireworks/models/kimi-k2p5-none');
        } else { // medium/complex
        return pick('accounts/fireworks/models/kimi-k2p5');
        }
      }
    }
  }
}

// Chatflix가 선택할 수 있는 모든 모델 ID를 추출하는 함수
// selectModelBasedOnAnalysis 함수의 모든 가능한 반환값을 수집
export function getChatflixSelectableModelIds(
  modelType: 'chatflix-ultimate' | 'chatflix-ultimate-pro'
): string[] {
  const modelIds = new Set<string>();
  
  // 모든 가능한 조합을 시뮬레이션
  const categories: Array<'coding' | 'technical' | 'math' | 'other'> = ['coding', 'technical', 'math', 'other'];
  const complexities: Array<'simple' | 'medium' | 'complex'> = ['simple', 'medium', 'complex'];
  const multimodalOptions = [
    { hasImage: true, hasPDF: false },
    { hasImage: false, hasPDF: true },
    { hasImage: false, hasPDF: false }
  ];
  
  // 모든 조합에 대해 모델 ID 수집
  for (const category of categories) {
    for (const complexity of complexities) {
      for (const { hasImage, hasPDF } of multimodalOptions) {
        const modelId = selectModelBasedOnAnalysis(
          { category, complexity },
          hasImage,
          hasPDF,
          modelType
        );
      modelIds.add(modelId);
      }
    }
  }
  
  return Array.from(modelIds);
}

// Chatflix 모델이 선택할 수 있는 모델들의 지표 범위를 계산하는 함수
export function getChatflixMetricRange(
  modelId: string,
  metric: 'latency' | 'tps' | 'intelligenceIndex' | 'contextWindow',
  disabledLevels: string[] = []
): { min: number; max: number } | null {
  // Chatflix 모델이 아니면 null 반환
  if (!isChatflixModel(modelId)) {
    return null;
  }

  // Chatflix가 실제로 선택할 수 있는 모델 ID 목록 가져오기
  const selectableModelIds = getChatflixSelectableModelIds(modelId as 'chatflix-ultimate' | 'chatflix-ultimate-pro');
  
  // 실제 존재하는 모델들만 필터링
const selectableModelIdsSet = new Set(selectableModelIds);
const availableModels = MODEL_CONFIGS.filter(model => {
  const variantId = getModelVariantId(model);

    // Chatflix 모델 자체는 제외
    if (isChatflixModel(model.id)) {
      return false;
    }
    // 실제 라우팅 로직에서 사용되는 모델인지 확인
  if (!selectableModelIdsSet.has(variantId)) {
      return false;
    }
    // rate limit 체크
    const isRateLimited = disabledLevels.includes(model.rateLimit?.level || '');
    if (isRateLimited) {
      return false;
    }
    // isEnabled && isActivated 체크
    if (!model.isEnabled || !model.isActivated) {
      return false;
    }
    return true;
  });

  // 해당 지표가 있는 모델들만 필터링
  const modelsWithMetric = availableModels
    .map(model => model[metric])
    .filter((value): value is number => typeof value === 'number');

  // 지표가 있는 모델이 없으면 null 반환
  if (modelsWithMetric.length === 0) {
    return null;
  }

  // 최소값과 최대값 계산
  const min = Math.min(...modelsWithMetric);
  const max = Math.max(...modelsWithMetric);

  return { min, max };
}

// Define the model configurations
const MODEL_CONFIG_DATA: ModelConfig[] = [
// Chatflix Ultimate Pro
{
  id: 'chatflix-ultimate-pro',
  name: 'Chatflix (Deluxe)',
  cutoff: '',
  abbreviation: 'CHFX-PRO',
  country: 'GLOBAL',
  description: 'Selects top models for complex or technical tasks.',
  provider: 'anthropic',
  creator: 'chatflix',
  supportsVision: true,
  supportsPDFs: true,
  rateLimit: {
    level: 'level3',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: true,
},

// Chatflix Ultimate
{
  id: 'chatflix-ultimate',
  name: 'Chatflix',
  cutoff: '',
  abbreviation: 'CHFX',
  country: 'GLOBAL',
  description: 'Selects the best model for everyday tasks',
  provider: 'anthropic',
  creator: 'chatflix',
  supportsVision: true,
  supportsPDFs: true,
  rateLimit: {
    level: 'level0',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,

  reasoning: true,
},
// 📅 현재 Google의 가장 최신 모델은 Gemini 3 Pro입니다.
// 📅 Gemini 3 Pro
{
  id: 'gemini-3-pro-preview',
  name: 'Gemini 3 Pro (High)',
  cutoff: 'Jan 2025',
  abbreviation: 'Gem3P',
  country: 'US',
  provider: 'google',
  creator: 'google',
  supportsVision: true,
  supportsPDFs: true,
  rateLimit: {
    level: 'level3',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: true,
  thinkingConfig: {
    level: 'high',  // Default thinking_level for Gemini 3
    includeThoughts: true,
  },
  reasoningEffort: 'high', // Creates unique provider key: 'gemini-3-pro-preview-high'
  // Metrics from https://artificialanalysis.ai/models/gemini-3-pro/providers (Google AI Studio)
  contextWindow: 1048576, // Updated from artificialanalysis.ai (1m = 1,048,576)
  tps: 120.6, // Updated from artificialanalysis.ai (Google AI Studio: 120.6 tokens/s)
  intelligenceIndex: 48, // Updated from artificialanalysis.ai (Intelligence Index: 48, ranks #4/106)
  latency: 32.66, // Updated from artificialanalysis.ai (Google AI Studio: 32.66s, time to first answer token including thinking)
  maxOutputTokens: 64000, // From https://ai.google.dev/gemini-api/docs/gemini-3 (Output token limit: 64k)
},
// 📅 Gemini 3 Pro (Low Thinking)
{
  id: 'gemini-3-pro-preview',
  name: 'Gemini 3 Pro Fast',
  cutoff: 'Jan 2025',
  abbreviation: 'Gem3P-L',
  country: 'US',
  provider: 'google',
  creator: 'google',
  supportsVision: true,
  supportsPDFs: true,
  rateLimit: {
    level: 'level3',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: true,
  thinkingConfig: {
    level: 'low',  // Low thinking_level for faster responses
    includeThoughts: false,
  },
  reasoningEffort: 'low', // Creates unique provider key: 'gemini-3-pro-preview-low'
  // Metrics from https://artificialanalysis.ai/models/gemini-3-pro-low/providers (Google AI Studio)
  contextWindow: 1048576, // ✓ Found: 1m (matches)
  tps: 109.8, // Updated from artificialanalysis.ai (Google AI Studio: 109.8 tokens/s)
  intelligenceIndex: 41, // Updated from artificialanalysis.ai (Intelligence Index: 41, ranks #15/106)
  latency: 3.37, // Updated from artificialanalysis.ai (Google AI Studio: 3.37s, time to first answer token including thinking)
  maxOutputTokens: 64000, // From https://ai.google.dev/gemini-api/docs/gemini-3 (Output token limit: 64k)
},
// 📅 Gemini 3 Flash
{
  id: 'gemini-3-flash-preview',
  name: 'Gemini 3 Flash (High)',
  cutoff: 'Jan 2025',
  abbreviation: 'Gem3F',
  country: 'US',
  provider: 'google',
  creator: 'google',
  supportsVision: true,
  rateLimit: {
    level: 'level3',
  },
  supportsPDFs: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gemini-3-flash-reasoning/providers (Google AI Studio)
  contextWindow: 1048576, // ✓ Found: 1m (matches)
  tps: 193.6, // Updated from artificialanalysis.ai (Google AI Studio: 193.6 tokens/s)
  intelligenceIndex: 46, // Updated from artificialanalysis.ai (Intelligence Index: 46, ranks #7/106)
  latency: 13.00, // Updated from artificialanalysis.ai (Google AI Studio: 13.00s, time to first answer token including thinking) 
  maxOutputTokens: 65536, // From https://ai.google.dev/gemini-api/docs/models (Output token limit: 65,536)
  reasoning: true,
  thinkingConfig: {
    level: 'high',  // Default thinking_level for Gemini 3 Flash
    includeThoughts: true,
  },
  reasoningEffort: 'high', // Creates unique provider key: 'gemini-3-flash-preview-high'
},
// 📅 Gemini 3 Flash (No Thinking)
{
  id: 'gemini-3-flash-preview',
  name: 'Gemini 3 Flash Fast',
  cutoff: 'Jan 2025',
  abbreviation: 'Gem3F-Min',
  country: 'US',
  provider: 'google',
  creator: 'google',
  supportsVision: true,
  rateLimit: {
    level: 'level3',
  },
  supportsPDFs: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gemini-3-flash/providers (Google AI Studio - Non-reasoning)
  contextWindow: 1048576, // ✓ Found: 1m (matches)
  tps: 164.9, // Updated from artificialanalysis.ai (Google AI Studio: 164.9 tokens/s for non-reasoning)
  intelligenceIndex: 35, // Updated from artificialanalysis.ai (Intelligence Index: 35, ranks #3/56)
  latency: 0.89, // Updated from artificialanalysis.ai (Google AI Studio: 0.89s, time to first answer token)
  maxOutputTokens: 65536, // From https://ai.google.dev/gemini-api/docs/models (Output token limit: 65,536)
  reasoning: true,
  thinkingConfig: {
    level: 'minimal',  // Minimal thinking_level: matches "no thinking" for most queries
    includeThoughts: false,
  },
  reasoningEffort: 'minimal', // Creates unique provider key: 'gemini-3-flash-preview-minimal'
},
// 📅 Gemini 2.5 Flash 
// Note: Gemini 2.5 Flash (Sep) 모델 업데이트 권장. 관련 링크: https://artificialanalysis.ai/models/gemini-2-5-flash-preview-09-2025-reasoning/providers
{
  id: 'gemini-2.5-flash',
  name: 'Gemini 2.5 Flash (Thinking)',
  cutoff: 'Jan 2025',
  abbreviation: 'Gem2.5F',
  country: 'US',
  provider: 'google',
  creator: 'google',
  supportsVision: true,
  rateLimit: {
    level: 'level3',
  },
  supportsPDFs: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gemini-2-5-flash-reasoning/providers (Google AI Studio)
  contextWindow: 1048576, // ✓ Found: 1m (matches)
  tps: 264.9, // Updated from artificialanalysis.ai (Intelligence Index page: 264.9 tokens/s)
  intelligenceIndex: 27, // Updated from artificialanalysis.ai (Intelligence Index: 27, ranks #30/135)
  latency: 16.68, // Updated from artificialanalysis.ai (Google AI Studio: 16.68s, time to first answer token including thinking)
  maxOutputTokens: 65536, // From https://ai.google.dev/gemini-api/docs/models (Output token limit: 65,536)
  reasoning: true,
  thinkingConfig: {
    budget: 8192,
    includeThoughts: true,
  },
},
// 📅 Gemini 2.5 Flash (No Thinking)
{
  id: 'gemini-2.5-flash',
  name: 'Gemini 2.5 Flash Fast',
  cutoff: 'Jan 2025',
  abbreviation: 'Gem2.5F-NT',
  country: 'US',
  provider: 'google',
  creator: 'google',
  supportsVision: true,
  rateLimit: {
    level: 'level3',
  },
  supportsPDFs: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gemini-2-5-flash/providers (Google AI Studio - Non-reasoning)
  contextWindow: 1048576, // ✓ Found: 1m (matches)
  tps: 224.7, // Updated from artificialanalysis.ai (Google AI Studio: 224.7 tokens/s for non-reasoning)
  intelligenceIndex: 21, // Updated from artificialanalysis.ai (Intelligence Index: 21, ranks #17/77)
  latency: 0.38, // Updated from artificialanalysis.ai (Google AI Studio: 0.38s, time to first answer token)
  maxOutputTokens: 65536, // From https://ai.google.dev/gemini-api/docs/models (Output token limit: 65,536)
  reasoning: false, // Prevents thinkingConfig from being sent to API
  reasoningEffort: 'none', // Creates unique provider key: 'gemini-2.5-flash-none'
},
// 📅 Gemini 2.5 Flash Lite
{
  id: 'gemini-2.5-flash-lite',
  name: 'Gemini 2.5 Flash Lite',
  cutoff: 'Jan 2025',
  abbreviation: 'Gem2.5FL',
  country: 'US',
  provider: 'google',
  creator: 'google',
  supportsVision: true,
  rateLimit: {
    level: 'level1',
  },
  supportsPDFs: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gemini-2-5-flash-lite/providers (Google AI Studio)
  contextWindow: 1048576, // ✓ Found: 1m (matches)
  tps: 255.1, // Updated from artificialanalysis.ai (Google AI Studio: 255.1 tokens/s)
  intelligenceIndex: 13, // Updated from artificialanalysis.ai (Intelligence Index: 13, ranks #52/77)
  latency: 0.32, // Updated from artificialanalysis.ai (Google AI Studio: 0.32s, time to first answer token)
  maxOutputTokens: 65536, // From https://ai.google.dev/gemini-api/docs/models (Output token limit: 65,536)
},
// 📅 Gemini 2.0 Flash
// {
//   id: 'gemini-2.0-flash',
//   name: 'Gemini 2.0 Flash',
//   cutoff: 'Aug 2024',
//   abbreviation: 'Gem2.0F',
//   country: 'US',
//   provider: 'google',
//   creator: 'google',
//   supportsVision: true,
//   rateLimit: {
//     level: 'level1',
//   },
//   supportsPDFs: true,
//   isEnabled: true,
//   isActivated: true,
//   isAgentEnabled: true,
//   // Metrics from https://artificialanalysis.ai/models/gemini-2-0-flash/providers (Google Vertex)
//   contextWindow: 1048576, // ✓ Found: 1m (matches)
//   tps: 150.4, // Updated from artificialanalysis.ai (Google Vertex: 150.4 tokens/s)
//   intelligenceIndex: 19, // Updated from artificialanalysis.ai (Intelligence Index: 19, ranks #21/76)
//   latency: 0.33, // Updated from artificialanalysis.ai (Google Vertex: 0.33s, time to first answer token)
//   maxOutputTokens: 8192, // From config (Gemini 2.0 Flash typically uses 8192, verify at https://ai.google.dev/gemini-api/docs/models)
// },
// 📅 현재 Anthropic의 가장 최신 모델은 Claude Opus 4.6입니다.
// 📅 Claude 4.6 Opus (Thinking)
// ⚠️ 주의: 이전에 contextWindow가 1,000,000 (1M)으로 설정되어 있었으나, 표준은 200,000 (200K)입니다. 1M은 beta 기능이며 usage tier 4+ 조직에서만 사용 가능합니다.
{
  id: 'claude-opus-4-6-thinking',
  name: 'Claude Opus 4.6 (Thinking)',
  // pro: true,
  cutoff: 'Feb 2026',
  abbreviation: 'CO4-T',
  country: 'US',
  provider: 'anthropic',
  creator: 'anthropic',
  supportsVision: true,
  rateLimit: {
    level: 'level4',
  },
  supportsPDFs: true,
  // censored: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: true,
  // We use adaptive thinking + effort high. artificialanalysis.ai only benchmarks Adaptive Reasoning Max Effort (https://artificialanalysis.ai/models/claude-opus-4-6-adaptive/providers) — no direct benchmark for our effort level; metrics not filled.
  // Note: 1M token context window is available as beta feature for usage tier 4+ organizations. See: https://docs.claude.com/en/docs/build-with-claude/context-windows#1m-token-context-window
  contextWindow: 200000, // Standard context window: 200K tokens (1M is beta, usage tier 4+ only)
  maxOutputTokens: 128000, // Claude 4.6 Opus: 128K max output tokens
  // pro: true,
},
// 📅 Claude 4.6 Opus (Non-reasoning)
// ⚠️ 주의: 이전에 contextWindow가 1,000,000 (1M)으로 설정되어 있었으나, 표준은 200,000 (200K)입니다. 1M은 beta 기능이며 usage tier 4+ 조직에서만 사용 가능합니다.
{
  id: 'claude-opus-4-6',
  name: 'Claude Opus 4.6',
  // pro: true,
  cutoff: 'Feb 2026',
  abbreviation: 'CO4',
  country: 'US',
  provider: 'anthropic',
  creator: 'anthropic',
  supportsVision: true,
  supportsPDFs: true,
  // censored: true,
  rateLimit: {
    level: 'level4',
  },
  isAgentEnabled: true,
  isEnabled: true,
  isActivated: true,
  // Metrics from https://artificialanalysis.ai/models/claude-opus-4-6/providers (Anthropic) — Non-reasoning, High Effort
  // Note: 1M token context window is available as beta feature for usage tier 4+ organizations. See: https://docs.claude.com/en/docs/build-with-claude/context-windows#1m-token-context-window
  contextWindow: 200000, // Standard context window: 200K tokens (1M is beta, usage tier 4+ only)
  intelligenceIndex: 46, // Updated from artificialanalysis.ai (Non-reasoning: Intelligence Index 46, ranks #1/61)
  tps: 66.2, // Updated from artificialanalysis.ai (Anthropic: 66.2 tokens/s)
  latency: 1.68, // Updated from artificialanalysis.ai (Anthropic: 1.68s, time to first answer token)
  maxOutputTokens: 128000, // Claude 4.6 Opus: 128K max output tokens
  // pro: true,
},
// 📅 Claude 4.6 Sonnet (Thinking)
// ⚠️ 주의: 이전에 contextWindow가 1,000,000 (1M)으로 설정되어 있었으나, 표준은 200,000 (200K)입니다. 1M은 beta 기능이며 usage tier 4+ 조직에서만 사용 가능합니다.
{
  id: 'claude-sonnet-4-6-thinking',
  name: 'Claude Sonnet 4.6 (Thinking)',
  // pro: true,
  cutoff: 'Feb 2026',
  abbreviation: 'CS4-T',
  country: 'US',
  provider: 'anthropic',
  creator: 'anthropic',
  supportsVision: true,
  rateLimit: {
    level: 'level3',
  },
  supportsPDFs: true,
  // censored: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: true,
  // We use adaptive thinking + effort medium. artificialanalysis.ai only benchmarks Adaptive Reasoning Max Effort (https://artificialanalysis.ai/models/claude-sonnet-4-6-adaptive/providers) — no direct benchmark for our effort level; metrics not filled.
  // Note: 1M token context window is available as beta feature for usage tier 4+ organizations. See: https://docs.claude.com/en/docs/build-with-claude/context-windows#1m-token-context-window
  contextWindow: 200000, // Standard context window: 200K tokens (1M is beta, usage tier 4+ only)
  maxOutputTokens: 64000, // Claude 4.6 Sonnet: 64K max output tokens
  // pro: true,
},
// 📅 Claude 4.6 Sonnet (Non-reasoning)
// ⚠️ 주의: 이전에 contextWindow가 1,000,000 (1M)으로 설정되어 있었으나, 표준은 200,000 (200K)입니다. 1M은 beta 기능이며 usage tier 4+ 조직에서만 사용 가능합니다.
{
  id: 'claude-sonnet-4-6',
  name: 'Claude Sonnet 4.6',
  // pro: true,
  cutoff: 'Feb 2026',
  abbreviation: 'CS4',
  country: 'US',
  provider: 'anthropic',
  creator: 'anthropic',
  supportsVision: true,
  supportsPDFs: true,
  // censored: true,
  rateLimit: {
    level: 'level3',
  },
  isAgentEnabled: true,
  isEnabled: true,
  isActivated: true,
  // Metrics from https://artificialanalysis.ai/models/claude-sonnet-4-6/providers (Anthropic) — Non-reasoning, High Effort
  // Note: 1M token context window is available as beta feature for usage tier 4+ organizations. See: https://docs.claude.com/en/docs/build-with-claude/context-windows#1m-token-context-window
  contextWindow: 200000, // Standard context window: 200K tokens (1M is beta, usage tier 4+ only)
  intelligenceIndex: 44, // Updated from artificialanalysis.ai (Non-reasoning: Intelligence Index 44, ranks #2/61)
  tps: 56.2, // Updated from artificialanalysis.ai (Anthropic: 56.2 tokens/s)
  latency: 0.72, // Updated from artificialanalysis.ai (Anthropic: 0.72s, time to first answer token)
  maxOutputTokens: 64000, // Claude 4.6 Sonnet: 64K max output tokens
  // pro: true,
},
// 📅 현재 DeepSeek의 가장 최신 모델은 DeepSeek V3.2 Exp입니다.
// 📅 DeepSeek V3.2 (Reasoning)
{
  id: 'deepseek-reasoner',
  name: 'DeepSeek V3.2 (Thinking)',
  cutoff: 'Sep 2025',
  abbreviation: 'DSV3.2-T',
  country: 'CHINA',
  provider: 'deepseek',
  creator: 'deepseek',
  supportsVision: false,
  rateLimit: {
    level: 'level1',
  },
  supportsPDFs: false,
  reasoning: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  
  // Metrics from https://artificialanalysis.ai/models/deepseek-v3-2-reasoning/providers (DeepSeek)
  contextWindow: 128000,      // ✓ Found: 128k (matches)
  tps: 30.2, // Updated from artificialanalysis.ai (DeepSeek: 30.2 tokens/s)
  intelligenceIndex: 42, // Updated from artificialanalysis.ai (Intelligence Index: 42, ranks #3/59)
  latency: 1.17, // Updated from artificialanalysis.ai (DeepSeek: 1.17s, time to first answer token including thinking)
  maxOutputTokens: 8192,      // 📉 Updated: 32k -> 8k (Official API Limit: 8192)
},

// 📅 DeepSeek V3.2 (Chat)
{
  id: 'deepseek-chat',
  name: "DeepSeek V3.2",
  cutoff: 'Sep 2025',
  abbreviation: 'DSV3.2',
  country: 'CHINA',
  provider: 'deepseek',
  creator: 'deepseek',
  supportsVision: false,
  rateLimit: {
    level: 'level1',
  },
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,

  // Metrics from https://artificialanalysis.ai/models/deepseek-v3-2/providers (DeepSeek)
  contextWindow: 128000,      // ✓ Found: 128k (matches)
  tps: 30.7, // Updated from artificialanalysis.ai (Intelligence Index page: 30.7 tokens/s)
  intelligenceIndex: 32, // Updated from artificialanalysis.ai (Intelligence Index: 32, ranks #2/33)
  latency: 1.13, // Updated from artificialanalysis.ai (DeepSeek: 1.13s, time to first answer token)
  maxOutputTokens: 8192,      // Added: Official API Limit
},

// 📅 DeepSeek V3.2 (Fireworks) Thinking
{
  id: 'accounts/fireworks/models/deepseek-v3p2',
  name: 'DeepSeek V3.2 Thinking',
  cutoff: 'Sep 2025',
  abbreviation: 'DSV3.2-FW',
  country: 'CHINA',
  provider: 'fireworks',
  creator: 'deepseek',
  supportsVision: false,
  supportsPDFs: false,
  rateLimit: {
    level: 'level2',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: true,
  contextWindow: 160000,
  maxOutputTokens: 20480,
  // Metrics from https://artificialanalysis.ai/models/deepseek-v3-2-reasoning/providers (Fireworks)
  tps: 217.3, // artificialanalysis.ai: Fireworks #2 (217.3 t/s)
  latency: 3.02, // Estimated; Fireworks not in top-5 latency list on page
  intelligenceIndex: 42, // Same model as official DeepSeek V3.2 (Thinking)
},
// 📅 DeepSeek V3.2 (Fireworks) Non-reasoning
{
  id: 'accounts/fireworks/models/deepseek-v3p2',
  name: 'DeepSeek V3.2',
  cutoff: 'Sep 2025',
  abbreviation: 'DSV3.2-FW-NR',
  country: 'CHINA',
  provider: 'fireworks',
  creator: 'deepseek',
  supportsVision: false,
  supportsPDFs: false,
  rateLimit: {
    level: 'level2',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: false,
  reasoningEffort: 'none',
  contextWindow: 160000,
  maxOutputTokens: 20480,
  // Metrics from https://artificialanalysis.ai/models/deepseek-v3-2/providers (Fireworks)
  tps: 222.9, // artificialanalysis.ai: Fireworks #2 (222.9 t/s)
  latency: 2.39, // artificialanalysis.ai: Fireworks #2 (2.39 s)
  intelligenceIndex: 32, // Same model as official DeepSeek V3.2 (Chat)
},

// 📅 Kimi K2
{
  id: 'moonshotai/kimi-k2-instruct-0905',
  name: 'Kimi K2 0905',
  // cutoff: 'Dec 2023',
  abbreviation: 'K2-0905',
  country: 'CHINA',
  provider: 'groq',
  creator: 'moonshot',
  supportsVision: false,
  rateLimit: {
    level: 'level2',
  },
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/kimi-k2-0905/providers (Groq)
  contextWindow: 256000, // Updated from artificialanalysis.ai (256k = 256,000)
  latency: 0.26, // Updated from artificialanalysis.ai (Groq: 0.26s, time to first answer token)
  tps: 290.5, // Updated from artificialanalysis.ai (Groq: 290.5 tokens/s)
  intelligenceIndex: 31, // Updated from artificialanalysis.ai (Intelligence Index: 31, ranks #3/33)
  // maxOutputTokens: Not found on artificialanalysis.ai, verify at official Moonshot AI documentation
},
// 📅 Kimi K2 (Thinking)
// {
//   id: 'moonshotai/Kimi-K2-Thinking',
//   name: 'Kimi K2 (Thinking)',
//   abbreviation: 'K2-T',
//   country: 'CHINA',
//   provider: 'together',
//   creator: 'moonshot',
//   supportsVision: false,
//   rateLimit: {
//     level: 'level2',
//   },
//   supportsPDFs: false,
//   reasoning: true,
//   isEnabled: true,
//   isActivated: true,
//   isAgentEnabled: true,
//   // Metrics from https://artificialanalysis.ai/models/kimi-k2-thinking/providers (Together.ai)
//   contextWindow: 256000, // Updated from artificialanalysis.ai (256k = 256,000)
//   tps: 145.2, // Updated from artificialanalysis.ai (Together.ai: 145.2 tokens/s)
//   intelligenceIndex: 41, // Updated from artificialanalysis.ai (Intelligence Index: 41, ranks #4/59)
//   latency: 0.49, // Updated from artificialanalysis.ai (Together.ai: 0.49s, time to first answer token including thinking)
//   // maxOutputTokens: Not found on artificialanalysis.ai, verify at official Moonshot AI documentation
// },
// 📅 Kimi K2.5
{
  id: 'accounts/fireworks/models/kimi-k2p5',
  name: 'Kimi K2.5 (Thinking)',
  cutoff: 'Jan 2025',
  abbreviation: 'K2.5',
  country: 'CHINA',
  provider: 'fireworks',
  creator: 'moonshot',
  supportsVision: true,
  supportsPDFs: false,
  rateLimit: {
    level: 'level2',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: true, // Reasoning 지원 (effort/budget 조정 옵션 없음)
  // Metrics from https://artificialanalysis.ai/models/kimi-k2-5/providers (Fireworks)
  contextWindow: 256000, // Updated from artificialanalysis.ai (256k = 256,000)
  maxOutputTokens: 32768, // 32k tokens
  intelligenceIndex: 47, // Updated from artificialanalysis.ai (Intelligence Index: 47, ranks #1/59)
  tps: 185.4, // Updated from artificialanalysis.ai (Fireworks: 185.4 tokens/s)
  latency: 0.45, // Updated from artificialanalysis.ai (Fireworks: 0.45s, time to first answer token including thinking)
},
// 📅 Kimi K2.5 (Non-reasoning)
{
  id: 'accounts/fireworks/models/kimi-k2p5',
  name: 'Kimi K2.5',
  cutoff: 'Jan 2026',
  abbreviation: 'K2.5-NR',
  country: 'CHINA',
  provider: 'fireworks',
  creator: 'moonshot',
  supportsVision: true,
  supportsPDFs: false,
  rateLimit: {
    level: 'level2',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: false,
  reasoningEffort: 'none', // Creates unique variant key: kimi-k2p5-none (same id, different from Thinking)
  // Metrics from https://artificialanalysis.ai/models/kimi-k2-5-non-reasoning and /providers (Fireworks)
  contextWindow: 256000, // 256k tokens
  maxOutputTokens: 32768, // 32k tokens
  intelligenceIndex: 38, // From artificialanalysis.ai (Intelligence Index: 38, ranks #1/34 in class)
  tps: 166.1, // Fireworks: 166.1 tokens/s (fastest among 5 providers)
  latency: 0.32, // Fireworks: 0.32s time to first token (lowest)
},
// 📅 GPT-OSS-120B High
{
  id: 'openai/gpt-oss-120b-high',
  name: 'GPT-OSS-120B (High)',
  abbreviation: 'G120B-H',
  country: 'US',
  provider: 'groq',
  creator: 'openai',
  supportsVision: false,
  rateLimit: {
    level: 'level2',
  },
  reasoning: true,
  reasoningEffort: 'high',
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gpt-oss-120b/providers (Groq provider)
  contextWindow: 131072, // ✓ Found: 131k (matches)
  intelligenceIndex: 33, // Updated from artificialanalysis.ai (Intelligence Index: 33, ranks #1/48)
  tps: 466, // 직접 수정함
  latency: 4.5, // 직접 수정함
  // maxOutputTokens: Not found on artificialanalysis.ai
},
// 📅 DeepSeek V3.1
// Note: DeepSeek V3.1 Terminus 모델 업데이트 권장. 관련 링크: https://artificialanalysis.ai/models/deepseek-v3-1-terminus
{
  id: 'deepseek-ai/DeepSeek-V3.1',
  name: 'DeepSeek V3.1',
  cutoff: 'July 2024',
  abbreviation: 'DSV3.1',
  country: 'CHINA',
  provider: 'together',
  creator: 'deepseek',
  supportsVision: false,
  rateLimit: {
    level: 'level2',
  },
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/deepseek-v3-1/providers (Together.ai)
  contextWindow: 131000, // Updated from artificialanalysis.ai (131k = 131,000)
  tps: 149.7, // Updated from artificialanalysis.ai (Together.ai: 149.7 tokens/s)
  intelligenceIndex: 28, // Updated from artificialanalysis.ai (Intelligence Index: 28, ranks #8/33)
  latency: 0.31, // Updated from artificialanalysis.ai (Together.ai: 0.31s, time to first answer token)
  // maxOutputTokens: Not found on artificialanalysis.ai, verify at https://api-docs.deepseek.com/
},
// 📅 Grok 4.1 Fast (Thinking)
{
  id: 'grok-4-1-fast-reasoning',
  name: 'Grok 4.1 Fast (Thinking)',
  // cutoff: 'Jul 2025',
  // pro: true,
  abbreviation: 'G4.1-F-T',
  country: 'US',
  provider: 'xai',
  creator: 'xai',
  supportsVision: true,
  // censored: false,
  rateLimit: {
    level: 'level3',
  },
  reasoning: true,
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/grok-4-1-fast-reasoning/providers (xAI)
  contextWindow: 2000000, // ✓ Found: 2m (matches)
  tps: 201.1, // Updated from artificialanalysis.ai (xAI: 201.1 tokens/s)
  intelligenceIndex: 39, // Updated from artificialanalysis.ai (Intelligence Index: 39, ranks #7/136)
  latency: 11.15, // Updated from artificialanalysis.ai (xAI: 11.15s, time to first answer token including thinking)
  maxOutputTokens: 16000, // From config (verify at official xAI documentation)
},
// 📅 Grok 4.1 Fast
{
  id: 'grok-4-1-fast-non-reasoning',
  name: 'Grok 4.1 Fast',
  // cutoff: 'Jul 2025',
  // pro: true,
  abbreviation: 'G4.1-F',
  country: 'US',
  provider: 'xai',
  supportsVision: true,
  // censored: false,
  rateLimit: {
    level: 'level3',
  },
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/grok-4-1-fast/providers (xAI)
  contextWindow: 2000000, // 2M tokens (xAI / multiple sources)
  tps: 121.1, // artificialanalysis.ai: xAI 121.1 t/s
  latency: 0.74, // artificialanalysis.ai: xAI 0.74s time to first token
  intelligenceIndex: 24, // artificialanalysis.ai Intelligence Index (non-reasoning)
  maxOutputTokens: 16000, // Reported 8k–30k by source; 16k per Oracle/playground
},
// 📅 Grok Code Fast 1
{
  id: 'grok-code-fast-1',
  name: 'Grok Code Fast 1',
  cutoff: 'Aug 2025',
  abbreviation: 'GCF1',
  country: 'US',
  provider: 'xai',
  creator: 'xai',
  supportsVision: false,
  rateLimit: {
    level: 'level2',
  },
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: false,
  reasoning: true,
  // Metrics from https://artificialanalysis.ai/models/grok-code-fast-1/providers (xAI)
  contextWindow: 256000, // ✓ Found: 256k (matches)
  tps: 227.9, // Updated from artificialanalysis.ai (xAI: 227.9 tokens/s)
  intelligenceIndex: 29, // Updated from artificialanalysis.ai (Intelligence Index: 29, ranks #26/136)
  latency: 6.10, // Updated from artificialanalysis.ai (xAI: 6.10s, time to first answer token including thinking)
  maxOutputTokens: 16000, // From config (verify at official xAI documentation)
},
// 📅 현재 OpenAI의 가장 최신 모델은 GPT-5.2입니다.
// 📅 GPT-5.2 (High)
{
  id: 'gpt-5.2',
  name: 'GPT-5.2 (High)',
  cutoff: 'Oct 2024',
  abbreviation: 'G5.2',
  country: 'US',
  provider: 'openai',
  creator: 'openai',
  supportsVision: true,
  rateLimit: {
    level: 'level3',
  },
  reasoning: true,
  reasoningEffort: 'high',
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gpt-5-2/providers (OpenAI)
  // Note: artificialanalysis.ai shows GPT-5.2 (xhigh)
  contextWindow: 400000, // ✓ Found: 400k (matches)
  tps: 101.7, // Updated from artificialanalysis.ai (OpenAI: 101.7 tokens/s)
  intelligenceIndex: 51, // Updated from artificialanalysis.ai (Intelligence Index: 51, ranks #1/106)
  latency: 31.40, // Updated from artificialanalysis.ai (OpenAI: 31.40s, time to first answer token including thinking)
  maxOutputTokens: 128000, // From config (same as GPT-5.1; verify at https://platform.openai.com/docs/models when available)
},
// 📅 GPT-5.2 (Medium)
// {
//   id: 'gpt-5.2',
//   name: 'GPT-5.2 (Medium)',
//   description: 'The best model for coding and agentic tasks with medium reasoning effort.',
//   cutoff: 'Oct 2024',
//   abbreviation: 'G5.2-M',
//   country: 'US',
//   provider: 'openai',
//   supportsVision: true,
//   rateLimit: {
//     level: 'level3',
//   },
//   reasoning: true,
//   reasoningEffort: 'medium',
//   supportsPDFs: false,
//   isEnabled: true,
//   isActivated: true,
//   isAgentEnabled: true,
//   isNew: true,
//   // Metrics: https://artificialanalysis.ai/models/gpt-5-2-medium/providers - verify availability
//   // Unable to verify metrics from artificialanalysis.ai
//   contextWindow: 400000, // From config (verify at artificialanalysis.ai when available)
//   // tps: Not found on artificialanalysis.ai
//   // intelligenceIndex: Not found on artificialanalysis.ai
//   // latency: Not found on artificialanalysis.ai
//   maxOutputTokens: 128000, // From config (same as GPT-5.1; verify at https://platform.openai.com/docs/models when available)
// },
// 📅 GPT-5.2 (Low)
// {
//   id: 'gpt-5.2',
//   name: 'GPT-5.2 (Low)',
//   description: 'The best model for coding and agentic tasks with low reasoning effort.',
//   cutoff: 'Oct 2024',
//   abbreviation: 'G5.2-L',
//   country: 'US',
//   provider: 'openai',
//   supportsVision: true,
//   rateLimit: {
//     level: 'level3',
//   },
//   reasoning: true,
//   reasoningEffort: 'low',
//   supportsPDFs: false,
//   isEnabled: true,
//   isActivated: true,
//   isAgentEnabled: true,
//   isNew: true,
//   // Metrics: https://artificialanalysis.ai/models/gpt-5-2-low/providers returned 500 error
//   // Unable to verify metrics from artificialanalysis.ai
//   contextWindow: 400000, // From config (verify at artificialanalysis.ai when available)
//   // tps: Not found on artificialanalysis.ai
//   // intelligenceIndex: Not found on artificialanalysis.ai
//   // latency: Not found on artificialanalysis.ai
//   maxOutputTokens: 128000, // From config (same as GPT-5.1; verify at https://platform.openai.com/docs/models when available)
// },
// 📅 GPT-5.2 (Minimal)
// {
//   id: 'gpt-5.2',
//   name: 'GPT-5.2 (Minimal)',
//   description: 'The best model for coding and agentic tasks with minimal reasoning effort.',
//   cutoff: 'Oct 2024',
//   abbreviation: 'G5.2-Min',
//   country: 'US',
//   provider: 'openai',
//   supportsVision: true,
//   rateLimit: {
//     level: 'level3',
//   },
//   reasoning: true,
//   reasoningEffort: 'minimal',
//   supportsPDFs: false,
//   isEnabled: true,
//   isActivated: true,
//   isAgentEnabled: true,
//   isNew: true,
//   // Metrics: https://artificialanalysis.ai/models/gpt-5-2-minimal/providers returned 500 error
//   // Unable to verify metrics from artificialanalysis.ai
//   contextWindow: 400000, // From config (verify at artificialanalysis.ai when available)
//   // tps: Not found on artificialanalysis.ai
//   // intelligenceIndex: Not found on artificialanalysis.ai
//   // latency: Not found on artificialanalysis.ai
//   maxOutputTokens: 128000, // From config (same as GPT-5.1; verify at https://platform.openai.com/docs/models when available)
// },
// 📅 GPT-5.2 (None)
{
  id: 'gpt-5.2',
  name: 'GPT-5.2 Instant',
  cutoff: 'Oct 2024',
  abbreviation: 'G5.2-I',
  country: 'US',
  provider: 'openai',
  creator: 'openai',
  supportsVision: true,
  rateLimit: {
    level: 'level3',
  },
  reasoning: true,
  reasoningEffort: 'none',
  supportsPDFs: false,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // Metrics from https://artificialanalysis.ai/models/gpt-5-2-non-reasoning/providers (OpenAI)
  contextWindow: 400000, // ✓ Found: 400k (matches)
  tps: 71.4, // Updated from artificialanalysis.ai (OpenAI: 71.4 tokens/s)
  intelligenceIndex: 34, // Updated from artificialanalysis.ai (Intelligence Index: 34, ranks #4/56)
  latency: 0.50, // Updated from artificialanalysis.ai (OpenAI: 0.50s, time to first answer token)
  maxOutputTokens: 128000, // From config (same as GPT-5.1; verify at https://platform.openai.com/docs/models when available)
},
// 📅 ChatGPT-5.2 (Aug '25)
// {
//   id: 'gpt-5.2-chat-latest',
//   name: 'ChatGPT-5.2',
//   cutoff: 'Sep 2024',
//   abbreviation: 'CG5.2',
//   country: 'US',
//   provider: 'openai',
//   description: "GPT-5.2 model used in ChatGPT",
//   supportsVision: true,
//   rateLimit: {
//     level: 'level3',
//   },
//   supportsPDFs: false,
//   isEnabled: true,
//   isActivated: true,
//   isAgentEnabled: false,
//   // Metrics: https://artificialanalysis.ai/models/gpt-5-chat-latest/providers returned 500 error
//   // Unable to verify metrics from artificialanalysis.ai
//   contextWindow: 128000, 
//   // tps: Not found on artificialanalysis.ai
//   // intelligenceIndex: Not found on artificialanalysis.ai
//   // latency: Not found on artificialanalysis.ai
//   maxOutputTokens: 16384, // From config (verify at https://platform.openai.com/docs/models)
// },
// 📅 GPT-5 Codex (High)
// {
//   id: 'gpt-5-codex',
//   name: 'GPT-5 Codex (High)',
//   description: 'A version of GPT-5 optimized for agentic coding in Codex with high reasoning effort.',
//   cutoff: 'Oct 2024',
//   abbreviation: 'G5-C',
//   country: 'US',
//   provider: 'openai',
//   supportsVision: true,
//   rateLimit: {
//     level: 'level3',
//   },
//   reasoning: true,
//   reasoningEffort: 'high',
//   supportsPDFs: false,
//   isEnabled: true,
//   isActivated: true,
//   isAgentEnabled: true,
//   // Metrics from https://artificialanalysis.ai/models/gpt-5-codex/providers (OpenAI)
//   // Note: artificialanalysis.ai shows GPT-5 Codex (high), using high metrics
//   contextWindow: 400000, // Updated from artificialanalysis.ai (OpenAI: 400k)
//   tps: 131, // Updated from artificialanalysis.ai (OpenAI: 131 tokens/s)
//   intelligenceIndex: 68, // Updated from artificialanalysis.ai (OpenAI: 68)
//   latency: 29.83, // Updated from artificialanalysis.ai (OpenAI: Total Response 29.83s, thinking time included)
//   maxOutputTokens: 128000, // From https://platform.openai.com/docs/models (Max output: 128K tokens)
// },

];

// Export the final MODEL_CONFIGS
export const MODEL_CONFIGS: ModelConfig[] = MODEL_CONFIG_DATA;

// Utility functions
export const getEnabledModels = () => MODEL_CONFIGS.filter(model => model.isEnabled);
export const getActivatedModels = () => MODEL_CONFIGS.filter(model => model.isEnabled && model.isActivated);
export const getModelById = (id: string) => {
const { baseId, reasoningEffort } = parseModelVariantId(id);
if (reasoningEffort) {
  const variantMatch = MODEL_CONFIGS.find(
    model => model.id === baseId && model.reasoningEffort === reasoningEffort
  );
  if (variantMatch) {
    return variantMatch;
  }
  }
return MODEL_CONFIGS.find(model => model.id === baseId);
};
export const getModelByIdWithReasoningEffort = (id: string, reasoningEffort?: string) => {
  if (reasoningEffort) {
    return MODEL_CONFIGS.find(model => model.id === id && model.reasoningEffort === reasoningEffort);
  }
return MODEL_CONFIGS.find(model => model.id === id);
};
export const getVisionModels = () => MODEL_CONFIGS.filter(model => model.supportsVision);
export const getNonVisionModels = () => MODEL_CONFIGS.filter(model => !model.supportsVision);
export const getModelsByProvider = (provider: ModelConfig['provider']) => 
  MODEL_CONFIGS.filter(model => model.provider === provider); 

export function getModelByVariantId(variantId: string): ModelConfig | undefined {
const { baseId, reasoningEffort } = parseModelVariantId(variantId);
if (reasoningEffort) {
  const match = getModelByIdWithReasoningEffort(baseId, reasoningEffort);
  if (match) {
    return match;
  }
}
return MODEL_CONFIGS.find(model => model.id === baseId);
}

export function resolveDefaultModelVariantId(modelId: string): string {
const { baseId, reasoningEffort } = parseModelVariantId(modelId);

if (reasoningEffort) {
  // Variant가 명시된 경우: 해당 variant가 존재하고 활성화되어 있는지 확인
  const variantModel = getModelByIdWithReasoningEffort(baseId, reasoningEffort);
  if (variantModel && variantModel.isEnabled && variantModel.isActivated) {
    return buildModelVariantId(baseId, reasoningEffort);
  }
  // Variant가 비활성화되어 있으면, baseId의 활성화된 variant 중 하나를 찾아서 반환
  const preferred = MODEL_CONFIGS.find(model => model.id === baseId && model.isEnabled && model.isActivated);
  if (preferred) {
    return getModelVariantId(preferred);
  }
  // 활성화된 variant가 없으면, 비활성화된 variant라도 반환
  if (variantModel) {
    return buildModelVariantId(baseId, reasoningEffort);
  }
}

const preferred = MODEL_CONFIGS.find(model => model.id === baseId && model.isEnabled && model.isActivated);
if (preferred) {
  return getModelVariantId(preferred);
}

const fallback = MODEL_CONFIGS.find(model => model.id === baseId);
return fallback ? getModelVariantId(fallback) : modelId;
}