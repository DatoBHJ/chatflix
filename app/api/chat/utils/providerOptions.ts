import { OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { XaiProviderOptions } from '@ai-sdk/xai';
import { GroqProviderOptions } from '@ai-sdk/groq';
import { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { ModelConfig } from '../../../../lib/models/config';

export interface ProviderOptions {
  openai?: OpenAIResponsesProviderOptions;
  xai?: XaiProviderOptions;
  groq?: GroqProviderOptions;
  anthropic?: AnthropicProviderOptions;
  google?: GoogleGenerativeAIProviderOptions;
  [key: string]: any; // Index signature for compatibility with SharedV2ProviderOptions
}

export function getProviderOptions(
  model: string,
  modelConfig: ModelConfig | undefined,
  userId: string,
  chatId?: string
): ProviderOptions {
  const providerOptions: ProviderOptions = {};

  // Anthropic Provider Options
  if (modelConfig?.provider === 'anthropic') {
    // Check if this is a reasoning model (has reasoning enabled)
    if (modelConfig.reasoning) {
      providerOptions.anthropic = {
        thinking: {
          type: 'enabled',
          budgetTokens: 12000, // Default budget tokens
        },
      } as AnthropicProviderOptions;
    }
  }

  // OpenAI Provider Options
  if (modelConfig?.provider === 'openai') {
    // Base options for all OpenAI models
    const baseOpenAIOptions: OpenAIResponsesProviderOptions = {
      parallelToolCalls: true, // Enable parallel function calling during tool use
      user: userId, // Unique user identifier for OpenAI monitoring
      store: true, // Enable persistence in Responses API
      metadata: { // Metadata to associate with the request
        chatId: chatId || 'unknown',
        model: model,
        timestamp: new Date().toISOString()
      },
      strictJsonSchema: false, // Strict JSON schema validation (default false)
    };

    // Model-specific configurations based on official OpenAI documentation
    if (model === 'o4-mini' || model === 'o3') {
      // o3, o4-mini reasoning models
      providerOptions.openai = {
        ...baseOpenAIOptions,
        reasoningEffort: 'high', // Reasoning effort: 'minimal', 'low', 'medium', 'high'
        reasoningSummary: 'detailed', // Reasoning summary: 'auto', 'detailed' or undefined
        serviceTier: 'flex', // Service tier: 'auto', 'flex', 'priority' (flex = 50% cheaper for o3, o4-mini)
        strictJsonSchema: true, // Enable strict schema for reasoning models
        parallelToolCalls: false, // Reasoning models work better with sequential calls
        include: ['reasoning.encrypted_content'], // Include reasoning content across conversation steps
      };
    } else if (model.startsWith('gpt-5') && !model.includes('chat-latest')) {
      // GPT-5 / GPT-5.1 / GPT-5.2 series models (except standard gpt-5) are reasoning models per documentation
      providerOptions.openai = {
        ...baseOpenAIOptions,
        reasoningEffort: modelConfig?.reasoningEffort || 'medium', // Use config value, default to 'medium'
        reasoningSummary: 'auto', // Auto summary for GPT-5 reasoning
        serviceTier: 'flex', // Available for GPT-5 models at 50% discount
        strictJsonSchema: true, // Enable for reasoning models
        parallelToolCalls: model.includes('nano') ? false : true, // Nano models work better sequential
        include: ['reasoning.encrypted_content'], // Include reasoning content
      };
    } else if (model.includes('chat-latest')) {
      // ChatGPT-latest variants (e.g., gpt-5.2-chat-latest) do not support flex tier
      providerOptions.openai = {
        ...baseOpenAIOptions,
        serviceTier: undefined,
        strictJsonSchema: false,
      };
    } 
    else if (model.startsWith('gpt-4.1')) {
      // GPT-4.1 series models (non-reasoning, high performance)
      providerOptions.openai = {
        ...baseOpenAIOptions,
        parallelToolCalls: model === 'gpt-4.1-mini' ? false : true, // Mini version works better sequential
        strictJsonSchema: false, // Conservative for non-reasoning models
        // These models don't support reasoning parameters
      };
    } else if (model.startsWith('gpt-4o')) {
      // GPT-4o series models (non-reasoning, multimodal)
      providerOptions.openai = {
        ...baseOpenAIOptions,
        parallelToolCalls: true, // 4o models handle parallel calls well
        strictJsonSchema: false, // Conservative default
        // prediction: undefined, // Predicted outputs supported for gpt-4o, gpt-4o-mini
        // For image inputs, can add imageDetail via providerOptions in message content
      };
    } else {
      // Default OpenAI options for other models
      providerOptions.openai = {
        ...baseOpenAIOptions,
        strictJsonSchema: false, // Conservative default for older models
      };
    }
  }

  // xAI (Grok) Provider Options
  if (modelConfig?.provider === 'xai') {
    // grok-4-1-fast-reasoning and grok-4-1-fast-non-reasoning don't support reasoningEffort parameter
    // Only grok-3-mini supported it, but it's deprecated and removed
    // All xAI models support parallel function calling
    providerOptions.xai = {
      parallel_function_calling: true, // Enable parallel function calling
    } as XaiProviderOptions;
  }

  // Groq Provider Options
  if (modelConfig?.provider === 'groq') {
    const baseGroqOptions: GroqProviderOptions = {
      parallelToolCalls: true, // Enable parallel function calling (default: true)
      structuredOutputs: true, // Enable structured outputs for Groq
    };
    
    // Add reasoning options ONLY for GPT-OSS models that support it
    if (model.includes('gpt-oss') && modelConfig.reasoning && modelConfig.reasoningEffort) {
      baseGroqOptions.reasoningFormat = 'parsed';
      // Groq 3.x doesn't support 'minimal', so map it to 'low'
      if (modelConfig.reasoningEffort !== 'minimal') {
        // Type assertion: Groq 3.x supports 'default' | 'low' | 'high' | 'none' | 'medium'
        baseGroqOptions.reasoningEffort = modelConfig.reasoningEffort as 'default' | 'low' | 'high' | 'none' | 'medium';
      } else {
        // Map 'minimal' to 'low' for Groq compatibility
        baseGroqOptions.reasoningEffort = 'low';
      }
    }
    // For other Groq reasoning models (like qwen/qwen3-32b), use default reasoning
    else if (modelConfig.reasoning && !model.includes('gpt-oss')) {
      // Only add reasoningFormat for models that support it, but not reasoningEffort
      baseGroqOptions.reasoningFormat = 'parsed';
    }
    
    providerOptions.groq = baseGroqOptions;
  }

  // Google (Gemini) Provider Options
  if (modelConfig?.provider === 'google' && modelConfig.reasoning) {
    const googleOptions: GoogleGenerativeAIProviderOptions = {};

    // Gemini 3 uses thinking_level, Gemini 2.5 uses thinking_budget
    const isGemini3 = modelConfig.id.startsWith('gemini-3');
    
    if (isGemini3) {
      // Gemini 3: Use thinking_level
      const thinkingLevel = modelConfig.thinkingConfig?.level;
      googleOptions.thinkingConfig = {
        ...(thinkingLevel ? { thinkingLevel } : {}),
        includeThoughts: modelConfig.thinkingConfig?.includeThoughts ?? true,
      };
    } else {
      // Gemini 2.5: Use thinking_budget
      const thinkingBudget = modelConfig.thinkingConfig?.dynamic
        ? -1
        : modelConfig.thinkingConfig?.budget;

      googleOptions.thinkingConfig = {
        ...(thinkingBudget !== undefined ? { thinkingBudget } : {}),
        includeThoughts: modelConfig.thinkingConfig?.includeThoughts ?? true,
      };
    }

    providerOptions.google = googleOptions;
  }

  // Fireworks Provider Options (Kimi K2.5)
  // https://fireworks.ai/models/fireworks/kimi-k2p5 — use thinking: { type: 'disabled' } for non-reasoning
  if (modelConfig?.provider === 'fireworks' && modelConfig.id.includes('kimi-k2p5')) {
    if (modelConfig.reasoning === false || modelConfig.reasoningEffort === 'none') {
      // Non-reasoning: do not use reasoning_effort and thinking together (causes error)
      providerOptions.fireworks = {
        thinking: { type: 'disabled' },
      };
    }
  }

  return providerOptions;
}

/**
 * Get provider options with tool-specific optimizations
 */
export function getProviderOptionsWithTools(
  model: string,
  modelConfig: ModelConfig | undefined,
  userId: string,
  hasTools: boolean,
  chatId?: string
): ProviderOptions {
  const providerOptions = getProviderOptions(model, modelConfig, userId, chatId);

  // Override options for specific tool scenarios
  if (hasTools && providerOptions.openai) {

    // Disable strict JSON schema validation for tools to avoid schema validation issues
    // This is especially important for o3 and gpt-5 series models which have stricter validation
    providerOptions.openai.strictJsonSchema = false;
    
    // Note: reasoningEffort and reasoningSummary use config default values, no override
  }

  return providerOptions;
}
