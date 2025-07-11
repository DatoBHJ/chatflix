export interface ModelConfig {
  id: string;
  name: string;
  cutoff?: string;
  pro?: boolean;
  country: string;
  description?: string;
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'together' | 'groq' | 'xai';
  supportsVision: boolean;
  supportsPDFs: boolean;
  // censored?: boolean;
  abbreviation?: string; // Short name to display on mobile devices
  rateLimit: {
    level: 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
  };
  isEnabled: boolean;
  isActivated: boolean; // Whether the model is activated for selection
  isAgentEnabled?: boolean;
  isNew?: boolean; // Mark model as new
  isHot?: boolean; // Mark model as hot/trending
  isBeta?: boolean; // Mark model as beta
  reasoning?: {
    enabled: boolean;
    provider?: 'openai' | 'groq' | 'together' | 'anthropic' | 'deepseek' | 'google' | 'xai';  
    baseModelId?: string; 
    budgetTokens?: number;
  };
  contextWindow?: number;
  tps?: number; // Tokens per second received while the model is generating tokens (ie. after first chunk has been received from the API for models which support streaming).
  intelligenceIndex?: number; // Artificial Analysis Intelligence Index: Combination metric covering multiple dimensions of intelligence - the simplest way to compare how smart models are. Version 2 was released in Feb '25 and includes: MMLU_Pro-Pro, GPQA Diamond, HLE's Last Exam, LiveCodeBench, SciCode, AIME, MATH-500. See Intelligence Index methodology for further details, including a breakdown of each evaluation and how we run them.
  multilingual?: number
  latency?: number; // Seconds to First Answer Token Received; Accounts for Reasoning Model 'Thinking' time
  maxOutputTokens?: number; // Max output tokens for the model
}

// Default model configuration
export const DEFAULT_MODEL_ID = 'chatflix-ultimate-pro'; 

export const RATE_LIMITS = {
  level0: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 20,    
      window: '24 h'
    }
  },
  level1: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level2: {
    hourly: {
      requests: 10,
      window: '4 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level3: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level4: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level5: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  // // 구독자용 레이트 리밋 설정
  // subscriber_limits: {
  //   level1: {
  //     hourly: {
  //       requests: 50,
  //       window: '1 h'
  //     },
  //     daily: {
  //       requests: 200,
  //       window: '24 h'
  //     }
  //   },
  //   level2: {
  //     hourly: {
  //       requests: 40,
  //       window: '1 h'
  //     },
  //     daily: {
  //       requests: 160,
  //       window: '24 h'
  //     }
  //   },
  //   level3: {
  //     hourly: {
  //       requests: 30,
  //       window: '1 h'
  //     },
  //     daily: {
  //       requests: 120,
  //       window: '24 h'
  //     }
  //   },
  //   level4: {
  //     hourly: {
  //       requests: 20,
  //       window: '1 h'
  //     },
  //     daily: {
  //       requests: 80,
  //       window: '24 h'
  //     }
  //   },
  //   level5: {
  //     hourly: {
  //       requests: 20,
  //       window: '1 h'
  //     },
  //     daily: {
  //       requests: 60,
  //       window: '24 h'
  //     }
  //   }
  // }
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

// Function to get user's default model from Supabase
export async function getUserDefaultModel(userId: string): Promise<string> {
  try {
    // Import supabase client dynamically to avoid circular dependencies
    const { supabase } = await import('../supabase');
    
    // Call the Supabase function to get or create user model preference
    const { data, error } = await supabase.rpc('get_or_create_user_model', {
      p_user_id: userId
    });
    
    if (error) {
      console.error('Error fetching user model preference:', error);
      return getSystemDefaultModelId();
    }
    
    // Verify the returned model exists, is enabled, and is activated
    const modelExists = MODEL_CONFIGS.some(model => model.id === data && model.isEnabled && model.isActivated);
    
    if (modelExists) {
      return data;
    } else {
      // If the model is not enabled or not activated, get the first activated model
      const firstActivatedModel = getActivatedModels()[0];
      return firstActivatedModel ? firstActivatedModel.id : getSystemDefaultModelId();
    }
  } catch (error) {
    console.error('Error in getUserDefaultModel:', error);
    return getSystemDefaultModelId();
  }
}

// Function to update user's default model
export async function updateUserDefaultModel(userId: string, modelId: string): Promise<boolean> {
  try {
    // Verify the model exists, is enabled, and is activated
    const modelExists = MODEL_CONFIGS.some(model => model.id === modelId && model.isEnabled && model.isActivated);
    if (!modelExists) {
      console.error('Attempted to set invalid, disabled, or deactivated model as default:', modelId);
      return false;
    }
    
    // Import supabase client dynamically
    const { supabase } = await import('../supabase');
    
    // Call the Supabase function to update user model preference
    const { data, error } = await supabase.rpc('update_user_model', {
      p_user_id: userId,
      p_model_id: modelId
    });
    
    if (error) {
      console.error('Error updating user model preference:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateUserDefaultModel:', error);
    return false;
  }
}

// Function to reset user's model to system default
export async function resetUserDefaultModel(userId: string): Promise<boolean> {
  try {
    // Import supabase client dynamically
    const { supabase } = await import('../supabase');
    
    // Call the Supabase function to reset user model preference
    const { data, error } = await supabase.rpc('reset_user_model', {
      p_user_id: userId
    });
    
    if (error) {
      console.error('Error resetting user model preference:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in resetUserDefaultModel:', error);
    return false;
  }
}

// Function to get the default model ID (user's preference or system default)
export async function getDefaultModelId(userId?: string): Promise<string> {
  if (!userId) {
    return getSystemDefaultModelId();
  }
  
  return await getUserDefaultModel(userId);
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
  // description: 'Designed for detailed technical or complex tasks. Automatically selects the optimal model based on your input. Prioritizes high-performance models like Claude Sonnet 4 and Gemini 2.5 Pro for superior reasoning. Responses may be slightly slower due to the inherent speed and latency of these heavier models. For lighter or everyday tasks, the standard Chatflix model is recommended for faster replies.',
  provider: 'anthropic',
  supportsVision: true,
  supportsPDFs: true,
  rateLimit: {
    level: 'level5',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: {
    enabled: true,
    provider: 'anthropic',
    baseModelId: 'claude-3-7-sonnet-20250219',
    budgetTokens: 12000
  },
},

// Chatflix Ultimate
{
  id: 'chatflix-ultimate',
  name: 'Chatflix',
  cutoff: '',
  abbreviation: 'CHFX',
  country: 'GLOBAL',
  description: 'Selects the best model for everyday tasks',
  // description: 'Optimized for everyday tasks. Automatically selects the best model based on your input. By default, it prioritizes speed-optimized models like GPT 4.1 and Gemini 2.5 Flash for quick responses. High-performance models such as Claude Sonnet 4 and Gemini 2.5 Pro are also used when your request requires more advanced reasoning or complexity.',
  provider: 'anthropic',
  supportsVision: true,
  supportsPDFs: true,
  rateLimit: {
    level: 'level5',
  },
  // isHot: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  reasoning: {
    enabled: true,
    provider: 'anthropic',
    baseModelId: 'claude-3-7-sonnet-20250219',
    budgetTokens: 12000
  },
},
    // Grok 4 
    {
      id: 'grok-4',
      name: 'Grok 4',
      // cutoff: 'Jul 2025',
      pro: true,
      abbreviation: 'G4-0709',
      country: 'US',
      provider: 'xai',
      supportsVision: false,
      // censored: false,
      rateLimit: {
        level: 'level2',
      },
      supportsPDFs: false,
      isEnabled: true,
      isActivated: true,
      isAgentEnabled: true,
      isBeta: true,
      contextWindow: 256000,
      // tps: 79,
      // intelligenceIndex: 51,
      // latency: 0.6,
      // maxOutputTokens: 16000,
    },
   // Grok 3 Mini (Thinking)
  {
    id: 'grok-3-mini-fast',
    name: 'Grok 3 Mini High Fast (Thinking)',
    cutoff: 'Feb 2025',
    pro: true,
    abbreviation: 'G3M-H-F',
    country: 'US',
    // description: 'High-speed version of Grok 3 Mini High (Thinking)',
    provider: 'xai',
    supportsVision: false,
    // censored: false,
    rateLimit: {
      level: 'level2',
    },
    reasoning: {
      enabled: true,
      provider: 'xai',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    intelligenceIndex: 67,
    maxOutputTokens: 16000,
  },
  {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini High (Thinking)',
    cutoff: 'Feb 2025',
    abbreviation: 'G3M-H',
    country: 'US',
    provider: 'xai',
    supportsVision: false,
    // censored: false,
    rateLimit: {
      level: 'level2',
    },
    reasoning: {
      enabled: true,
      provider: 'xai',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    tps: 212,
    intelligenceIndex: 67,
    latency: 9.9,
    maxOutputTokens: 16000,
  },
    // Grok 3 
    {
    id: 'grok-3-fast',
    name: 'Grok 3 Fast',
    cutoff: 'Feb 2025',
    pro: true,
    abbreviation: 'G3F',
    country: 'US',
    // description: 'High-speed version of Grok 3',
    provider: 'xai',
    supportsVision: false,
    // censored: false,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    intelligenceIndex: 51,
    maxOutputTokens: 16000,
  },
    // Grok 3 
    {
    id: 'grok-3',
    name: 'Grok 3',
    cutoff: 'Feb 2025',
    abbreviation: 'G3',
    country: 'US',
    provider: 'xai',
    supportsVision: false,
    // censored: false,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    tps: 79,
    intelligenceIndex: 51,
    latency: 0.6,
    maxOutputTokens: 16000,
  },
  // Claude 4 Sonnet (Thinking)
  {
    id: 'claude-sonnet-4-20250514-thinking',
    name: 'Claude Sonnet 4 (Thinking)',
    // pro: true,
    cutoff: 'Mar 2025',
    abbreviation: 'CS4-T',
    country: 'US',
    provider: 'anthropic',
    supportsVision: true,
    rateLimit: {
      level: 'level4',
    },
    supportsPDFs: true,
    // censored: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    reasoning: {
      enabled: true,
      provider: 'anthropic',
      baseModelId: 'claude-sonnet-4-20250514',
      budgetTokens: 12000
    },
    contextWindow: 200000,
    intelligenceIndex: 61,
    tps: 82,
    latency: 25.5,
    maxOutputTokens: 64000,
  },
  // Claude 4 Sonnet 
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    // pro: true,
    cutoff: 'Mar 2025',
    abbreviation: 'CS4',
    country: 'US',
    provider: 'anthropic',
    supportsVision: true,
    supportsPDFs: true,
    // censored: true,
    rateLimit: {
      level: 'level4',
    },
    isAgentEnabled: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 200000,
    intelligenceIndex: 53,
    tps: 82,
    latency: 1.5,
    maxOutputTokens: 64000,
  },
  // GPT-4.1
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    cutoff: 'Jun 2024',
    abbreviation: 'G4.1',
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level5',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 1047576,
    tps: 119,
    intelligenceIndex: 53,
    latency: 0.4,
    maxOutputTokens: 32768,
  },
  // GPT-4.1 Mini
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    cutoff: 'Jun 2024',
    abbreviation: 'G4.1M',
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 1047576,
    tps: 69,
    intelligenceIndex: 53,
    latency: 0.4,
    maxOutputTokens: 32000,
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    cutoff: 'Jun 2024',
    abbreviation: 'G4.1N',
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 1047576,
    tps: 153,
    intelligenceIndex: 41,
    latency: 0.3,
    maxOutputTokens: 32000,
  },
   // ChatGPT-4o (Nov '24)
   {
    id: 'chatgpt-4o-latest',
    name: 'ChatGPT-4o',
    cutoff: 'Oct 2023',
    abbreviation: 'CG4o',
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level5',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 128000,
    tps: 174,
    intelligenceIndex: 40,
    latency: 0.5,
    maxOutputTokens: 16384,
  },
  // GPT-4o (Nov '24)
  {
    id: 'gpt-4o-2024-11-20',
    name: 'GPT-4o (Nov \'24)',
    abbreviation: 'G4o',
    country: 'US',
    cutoff: 'Oct 2023',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level5',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    tps: 183,
    intelligenceIndex: 41,
    latency: 0.4,
    maxOutputTokens: 65536,
  },
  // o4-Mini 
  {
    id: "o4-mini",
    name: "o4-Mini-High",
    cutoff: 'Jun 2024',
    abbreviation: "o4M-H",
    country: 'US',
    provider: "openai",
    supportsVision: true,
    rateLimit: {
      level: "level5",
    },
    reasoning: {
      enabled: true,
      provider: 'openai',
      baseModelId: 'o4-mini',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 200000,
    tps: 119,
    intelligenceIndex: 70,
    latency: 36.8,
    maxOutputTokens: 24576,
  },
  // o3 (Thinking)
  // {
  //   id: "o1",
  //   name: "o1 (Thinking)",
  //   cutoff: 'Oct 2023',
  //   abbreviation: "o1-T",
  //   country: 'US',
  //   // description: "OpenAI's most powerful reasoning model",
  //   provider: "openai",
  //   supportsVision: true,
  //   rateLimit: {
  //     level: "level5",
  //   },
  //   reasoning: {
  //     enabled: true,
  //     provider: 'openai',
  //   },
  //   supportsPDFs: false,
  //   isEnabled: true,
  //   isActivated: true,
  //   isAgentEnabled: false,
  //   contextWindow: 200000,
  //   // tps: 188,
  //   intelligenceIndex: 67,
  // },
   // QwQ-32B (Thinking)
   {
    id: 'qwen-qwq-32b',
    name: 'QwQ-32B (Thinking)',
    cutoff: 'June 2024',
    abbreviation: 'QwQ-T',
    country: 'CHINA',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    reasoning: {
      enabled: true,
      provider: 'groq',
      baseModelId: 'qwen-qwq-32b',
    },
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    supportsPDFs: false,
    contextWindow: 131000,
    tps: 422,
    latency: 6.1,
    intelligenceIndex: 58,
    maxOutputTokens: 32768,
  },
  // Gemini 2.5 Pro 
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    // pro: true,
    cutoff: 'Jan 2025',
    abbreviation: 'Gem2.5P',
    country: 'US',
    // description: 'Note: Fast response times with occasional latency due to hidden reasoning tokens that may make responses appear slower.',
    provider: 'google',
    supportsVision: true,
    rateLimit: {
      level: 'level4',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 1048576,
    isAgentEnabled: true,
    tps: 143,
    intelligenceIndex: 70,
    latency: 36.5,
    maxOutputTokens: 65536,
  },
  // Gemini 2.5 Pro 
  {
    id: 'gemini-2.5-pro-preview-06-05',
    name: 'Gemini 2.5 Pro Preview 06-05',
    // pro: true,
    cutoff: 'Jan 2025',
    abbreviation: 'Gem2.5P-06-05',
    country: 'US',
    // description: 'Note: Fast response times with occasional latency due to hidden reasoning tokens that may make responses appear slower.',
    provider: 'google',
    supportsVision: true,
    rateLimit: {
      level: 'level4',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 1048576,
    isAgentEnabled: true,
    // tps: 143,
    // intelligenceIndex: 70,
    // latency: 36.5,
    maxOutputTokens: 65536,
  },
  // Gemini 2.5 Pro 
  // {
  //   id: 'gemini-2.5-pro-preview-05-06',
  //   name: 'Gemini 2.5 Pro Preview 05-06',
  //   pro: true,
  //   cutoff: 'Jan 2025',
  //   abbreviation: 'Gem2.5P-05-06',
  //   country: 'US',
  //   // description: 'Note: Fast response times with occasional latency due to hidden reasoning tokens that may make responses appear slower.',
  //   provider: 'google',
  //   supportsVision: true,
  //   rateLimit: {
  //     level: 'level4',
  //   },
  //   supportsPDFs: true,
  //   isEnabled: true,
  //   isActivated: true,
  //   contextWindow: 1048576,
  //   isAgentEnabled: true,
  //   tps: 142,
  //   intelligenceIndex: 68,
  //   latency: 35,
  //   maxOutputTokens: 65536,
  // },
  // Gemini 2.5 Flash 
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    cutoff: 'Jan 2025',
    abbreviation: 'Gem2.5F',
    country: 'US',
    provider: 'google',
    supportsVision: true,
    rateLimit: {
      level: 'level4',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 1048576,
    tps: 284,
    intelligenceIndex: 65,
    latency: 13,
    maxOutputTokens: 65536,
  },
  // Gemini 2.0 Flash
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    cutoff: 'Aug 2024',
    abbreviation: 'Gem2.0F',
    country: 'US',
    provider: 'google',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 1048576,
    tps: 258,
    intelligenceIndex: 48,
    latency: 0.4,
    maxOutputTokens: 8192,
  },
  // Llama 3.3 70B
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    cutoff: 'Dec 2023',
    abbreviation: 'L3.3',
    country: 'US',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level0',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 128000,
    latency: 0.2,
    tps: 468,
    intelligenceIndex: 41,
  },
   // DeepSeek R1 (Thinking)
   {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 0528 (Thinking)',
    cutoff: 'July 2024',
    abbreviation: 'DSR1-T',
    country: 'CHINA',
    provider: 'deepseek',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    reasoning: {
      enabled: true,
      provider: 'deepseek',
      baseModelId: 'deepseek-reasoner',
    },
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    tps: 27,
    intelligenceIndex: 68,
    latency: 74.2,
    maxOutputTokens: 32000,
  },
  // DeepSeek V3
  {
    id: 'deepseek-chat',
    name: "DeepSeek V3",
    cutoff: 'July 2024',
    abbreviation: 'DSV3',
    country: 'CHINA',
    provider: 'deepseek',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 128000,
    tps: 28,
    intelligenceIndex: 53,
    latency: 3.1,
  },
  {
    id: 'Qwen/Qwen3-235B-A22B-fp8-tput',
    name: 'Qwen3-235B-A22B (Thinking)',
    cutoff: 'mid-2024 (estimated)',
    abbreviation: 'Q3-235B-A22B-T',
    country: 'CHINA',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    reasoning: {
      enabled: true,
      provider: 'together',
      baseModelId: 'Qwen/Qwen3-235B-A22B-fp8-tput',
    },
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 128000,
    tps: 30,
    intelligenceIndex: 62,
    latency: 52.5,
    maxOutputTokens: 32000,
  },
  // DeepSeek R1 (Thinking)
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1 0528 Fast (Thinking)',
    cutoff: 'July 2024',
    abbreviation: 'DSR1-T',
    country: 'CHINA',
    // description: 'High speed version of DeepSeek R1',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    reasoning: {
      enabled: true,
      provider: 'together',
      baseModelId: 'deepseek-ai/DeepSeek-R1',
    },
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    // tps: 96,
    intelligenceIndex: 68,
    // multilingual:86,
    latency: 24.2,
    maxOutputTokens: 32000,
  },
  // DeepSeek V3 (Mar' 25)
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3 Fast',
    cutoff: 'July 2024',
    abbreviation: 'DSV3',
    country: 'CHINA',
    // description: 'High speed version of DeepSeek V3',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    tps: 101,
    intelligenceIndex: 53,
    latency: 0.6,
  },
];

// Export the final MODEL_CONFIGS
export const MODEL_CONFIGS: ModelConfig[] = MODEL_CONFIG_DATA;

// Utility functions
export const getEnabledModels = () => MODEL_CONFIGS.filter(model => model.isEnabled);
export const getActivatedModels = () => MODEL_CONFIGS.filter(model => model.isEnabled && model.isActivated);
export const getModelById = (id: string) => MODEL_CONFIGS.find(model => model.id === id);
export const getVisionModels = () => MODEL_CONFIGS.filter(model => model.supportsVision);
export const getNonVisionModels = () => MODEL_CONFIGS.filter(model => !model.supportsVision);
export const getModelsByProvider = (provider: ModelConfig['provider']) => 
  MODEL_CONFIGS.filter(model => model.provider === provider); 
