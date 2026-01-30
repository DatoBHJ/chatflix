import { customProvider, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { togetherai } from '@ai-sdk/togetherai';
import { groq } from '@ai-sdk/groq';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { fireworks } from '@ai-sdk/fireworks';
import { MODEL_CONFIGS } from './models/config';

// Single reasoning middleware instance (scira style)
const middleware = extractReasoningMiddleware({
  tagName: 'think',
});

// Create language models configuration with direct mapping (scira style)
const languageModels: Record<string, any> = {};

// Build models from config with simplified logic (scira style)
MODEL_CONFIGS.forEach(model => {
  try {
    let languageModel: any;
    
    // For reasoning models, use the base model ID (strip reasoning effort suffixes)
    let baseModelId = model.id;
    if (model.reasoning) {
      // xAI models use full model IDs (e.g., grok-4-1-fast-reasoning, grok-4-1-fast-non-reasoning)
      // Don't strip suffixes for xAI provider - they are part of the actual API model ID
      if (model.provider === 'xai') {
        baseModelId = model.id; // Keep full ID for xAI
      }
      // Handle -thinking suffix (existing logic for other providers)
      else if (model.id.endsWith('-thinking')) {
        baseModelId = model.id.replace('-thinking', '');
      }
      // Handle reasoning effort suffixes (-low, -medium, -high, -minimal)
      else if (model.id.match(/-(?:low|medium|high|minimal)$/)) {
        baseModelId = model.id.replace(/-(?:low|medium|high|minimal)$/, '');
      }
    }
    
    // Create base model instance
    switch (model.provider) {
      case 'openai':
        languageModel = openai.responses(baseModelId);
        break;
      case 'anthropic':
        languageModel = anthropic(baseModelId);
        break;
      case 'google':
        languageModel = google(baseModelId);
        break;
      case 'deepseek':
        languageModel = deepseek(baseModelId);
        break;
      case 'together':
        languageModel = togetherai(baseModelId);
        break;
      case 'groq':
        languageModel = groq(baseModelId);
        break;
      case 'xai':
        languageModel = xai(baseModelId);
        break;
      case 'fireworks':
        languageModel = fireworks(baseModelId);
        break;
      default:
        console.warn(`Unknown provider: ${model.provider} for model: ${model.id}`);
        return;
    }
    
    // Generate unique key for models with same ID but different reasoningEffort
    // Format: id-reasoningEffort (e.g., 'gpt-5.2-high') or just id if no reasoningEffort
    const modelKey = model.reasoningEffort 
      ? `${model.id}-${model.reasoningEffort}`
      : model.id;
    
    // Wrap with reasoning middleware if enabled (scira style)
    if (model.reasoning) {
      languageModels[modelKey] = wrapLanguageModel({
        model: languageModel,
        middleware,
      });
    } else {
      languageModels[modelKey] = languageModel;
    }
  } catch (error) {
    console.error(`Failed to initialize model ${model.id}:`, error);
  }
});

// Export providers
export const providers = customProvider({
  languageModels
});

export type Provider = typeof providers; 