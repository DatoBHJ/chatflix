import { customProvider, wrapLanguageModel, extractReasoningMiddleware, LanguageModelV1 } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createGroq } from '@ai-sdk/groq';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { MODEL_CONFIGS, ModelConfig, isChatflixModel } from './models/config';

// Create provider instances
const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

const together = createTogetherAI({
  apiKey: process.env.TOGETHER_API_KEY || '',
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const anthropic = createAnthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const xai = createXai({
  apiKey: process.env.XAI_API_KEY || '',
});

// Create provider mapping with proper types
type ProviderFunction = (modelId: string) => LanguageModelV1;
const providerMap: Record<ModelConfig['provider'], ProviderFunction> = {
  openai,
  anthropic,
  google,
  deepseek,
  together,
  groq,
  xai,
};

// Helper function to create a model with reasoning middleware
function createReasoningModel(config: ModelConfig): LanguageModelV1 {
  if (!config.reasoning?.enabled) {
    throw new Error(`Model ${config.id} is not configured for reasoning`);
  }

  const provider = providerMap[config.reasoning.provider || config.provider];
  if (!provider) {
    throw new Error(`Provider not found for model ${config.id}`);
  }
  // For other providers (DeepSeek, etc.)
  return wrapLanguageModel({
    model: provider(config.reasoning.baseModelId || config.id),
    middleware: extractReasoningMiddleware({ 
      tagName: 'think'
    })
  });
}

// Create language models configuration from MODEL_CONFIGS
const languageModels = MODEL_CONFIGS.reduce<Record<string, LanguageModelV1>>((acc, model) => {
  // 모든 모델을 providers에 포함 (챗플릭스 모델의 내부 라우팅을 위해)
  // 실제 사용 시 제약은 modelSelector.ts에서 처리

  try {
    // If model has reasoning enabled, create a reasoning model
    if (model.reasoning?.enabled) {
      acc[model.id] = createReasoningModel(model);
    } else {
      // Use standard provider
      const provider = providerMap[model.provider];
      if (provider) {
        acc[model.id] = provider(model.id);
      }
    }
  } catch (error) {
    console.error(`Failed to initialize model ${model.id}:`, error);
  }
  
  return acc;
}, {});

// Export providers
export const providers = customProvider({
  languageModels
});

export type Provider = typeof providers; 