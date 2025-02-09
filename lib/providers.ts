import { customProvider, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createGroq } from '@ai-sdk/groq';
import { createAnthropic } from '@ai-sdk/anthropic';

// 각 프로바이더 생성
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

// Groq의 DeepSeek 모델에 reasoning 기능 추가
const groqDeepSeekWithReasoning = wrapLanguageModel({
  model: groq('deepseek-r1-distill-llama-70b'),
  middleware: extractReasoningMiddleware({ tagName: 'think' })
});

// Together.ai의 DeepSeek 모델에 reasoning 기능 추가
const togetherDeepSeekR1WithReasoning = wrapLanguageModel({
  model: together('deepseek-ai/DeepSeek-R1'),
  middleware: extractReasoningMiddleware({ tagName: 'think' })
});

// 모든 모델을 하나의 customProvider로 통합
export const providers = customProvider({
  languageModels: {
    'deepseek-reasoner': deepseek('deepseek-reasoner'),
    'deepseek-chat': deepseek('deepseek-chat'),
    'deepseek-ai/DeepSeek-R1': togetherDeepSeekR1WithReasoning,
    'deepseek-ai/DeepSeek-V3': together('deepseek-ai/DeepSeek-V3'),
    'DeepSeek r1 distill llama 70b': groqDeepSeekWithReasoning,
    'claude-3-5-sonnet-latest': anthropic('claude-3-sonnet-20240229'),
  }
});

export type Provider = typeof providers; 