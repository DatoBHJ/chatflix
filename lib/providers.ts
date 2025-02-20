import { customProvider, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createGroq } from '@ai-sdk/groq';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';

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

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const xai = createXai({
  apiKey: process.env.XAI_API_KEY || '',
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

// Together.ai의 DeepSeek R1 Distill Llama 70B free 모델에 reasoning 기능 추가
const togetherDeepSeekR1DistillWithReasoning = wrapLanguageModel({
  model: together('deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free'),
  middleware: extractReasoningMiddleware({ tagName: 'think' })
});

// 모든 모델을 하나의 customProvider로 통합
export const providers = customProvider({
  languageModels: {
    'chatgpt-4o-latest': openai('gpt-4-0125-preview'), // vision support
    'gpt-4o': openai('gpt-4-0125-preview'), // vision support
    'o1': openai('gpt-4-0125-preview'), // vision support
    'o3-mini': openai('gpt-4-0125-preview'), // vision support
    'deepseek-reasoner': deepseek('deepseek-reasoner'), // non-vision support
    'deepseek-chat': deepseek('deepseek-chat'), // non-vision support
    'deepseek-ai/DeepSeek-R1': togetherDeepSeekR1WithReasoning, // non-vision support
    'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free': togetherDeepSeekR1DistillWithReasoning, // non-vision support
    'deepseek-ai/DeepSeek-V3': together('deepseek-ai/DeepSeek-V3'), // non-vision support
    'DeepSeek r1 distill llama 70b': groqDeepSeekWithReasoning, // non-vision support
    'claude-3-5-sonnet-latest': anthropic('claude-3-sonnet-20240229'), // vision support
    'llama-3.3-70b-versatile': groq('llama-3.3-70b-versatile'), // non-vision support
    'gemini-2.0-flash': google('gemini-2.0-flash'), // vision support
    'gemini-1.5-pro': google('gemini-1.5-pro'), // vision support
    'grok-2-latest': xai('grok-2-latest'), // vision support
  }
});

export type Provider = typeof providers; 