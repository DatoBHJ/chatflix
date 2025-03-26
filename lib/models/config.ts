export interface ModelConfig {
  id: string;
  name: string;
  country: string;
  description: string;
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'together' | 'groq' | 'xai';
  supportsVision: boolean;
  supportsPDFs: boolean;
  censored?: boolean;
  rateLimit: {
    level: 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
  };
  isEnabled: boolean;
  isActivated: boolean; // Whether the model is activated for selection
  isWebSearchEnabled: boolean;
  isNew?: boolean; // Mark model as new
  isHot?: boolean; // Mark model as hot/trending
  reasoning?: {
    enabled: boolean;
    provider?: 'groq' | 'together' | 'anthropic' | 'deepseek';  
    baseModelId?: string; 
    tagName?: string; 
    budgetTokens?: number;
  };
  contextWindow?: number;
  tps?: number; // Tokens per second received while the model is generating tokens (ie. after first chunk has been received from the API for models which support streaming).
  intelligenceIndex?: number; // Artificial Analysis Intelligence Index: Combination metric covering multiple dimensions of intelligence - the simplest way to compare how smart models are. Version 2 was released in Feb '25 and includes: MMLU_Pro-Pro, GPQA Diamond, HLE's Last Exam, LiveCodeBench, SciCode, AIME, MATH-500. See Intelligence Index methodology for further details, including a breakdown of each evaluation and how we run them.
  MMLU_Pro?: number; // (Reasoning & Knowledge)
  Coding?: number; // Artificial Analysis Coding Index: Represents the average of coding evaluations in the Artificial Analysis Intelligence Index. Currently includes: LiveCodeBench, SciCode. See Intelligence Index methodology for further details, including a breakdown of each evaluation and how we run them.
  MATH?: number; // Artificial Analysis Math Index: Represents the average of math evaluations in the Artificial Analysis Intelligence Index. Currently includes: AIME, MATH-500. See Intelligence Index methodology for further details, including a breakdown of each evaluation and how we run them.
  GPQA?: number; // GPQA Diamond (Scientific Reasoning)
  multilingual?: number
  HLE?: number // HLE's Last Exam (Reasoning & Knowledge)
}

// Default model configuration
export const DEFAULT_MODEL_ID = 'gemini-2.0-flash'; 

export const RATE_LIMITS = {
  level0: {
    hourly: {
      requests: 1000,    
      window: '1 h'
    },
    daily: {
      requests: 10000,    
      window: '24 h'
    }
  },
  level1: {
    hourly: {
      requests: 10,    
      window: '1 h'
    },
    daily: {
      requests: 50,    
      window: '24 h'
    }
  },
  level2: {
    hourly: {
      requests: 5,
      window: '1 h'
    },
    daily: {
      requests: 40,
      window: '24 h'
    }
  },
  level3: {
    hourly: {
      requests: 5,    
      window: '1 h'
    },
    daily: {
      requests: 30,
      window: '24 h'
    }
  },
  level4: {
    hourly: {
      requests: 5,    
      window: '1 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level5: {
    hourly: {
      requests: 5,    
      window: '1 h'
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
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet (Thinking)',
    country: 'US',
    description: "Anthropic's most intelligent model yet with extended thinking capability.",
    provider: 'anthropic',
    supportsVision: true,
    rateLimit: {
      level: 'level4',
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    censored: true,
    isEnabled: true,
    isActivated: true,
    reasoning: {
      enabled: true,
      provider: 'anthropic',
      baseModelId: 'claude-3-7-sonnet-20250219',
      budgetTokens: 12000
    },
    contextWindow: 200000,
    tps: 78,
    intelligenceIndex: 57,
    MMLU_Pro: 84,
    Coding: 44,
    MATH: 72,
    GPQA: 77,
    HLE: 10.3
  },
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    country: 'US',
    description: "Anthropic's most intelligent model.",
    provider: 'anthropic',
    supportsVision: true,
    supportsPDFs: false,
    censored: true,
    rateLimit: {
      level: 'level4',
    },
    isWebSearchEnabled: false,
    isHot: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 200000,
    tps: 78,
    intelligenceIndex: 48,
    MMLU_Pro: 80,
    Coding: 38,
    MATH: 54,
    GPQA: 66,
    HLE: 4.8
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    country: 'US',
    description: 'Coding GOAT',
    provider: 'anthropic',
    supportsVision: true,
    censored: true,
    rateLimit: {
      level: 'level4',
    },
    isWebSearchEnabled: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 200000,
    tps: 77,
    intelligenceIndex: 44,
    MMLU_Pro: 77,
    Coding: 37,
    MATH: 46,
    GPQA: 60,
    multilingual:88,
    HLE: 3.9
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Thinking)',
    country: 'CHINA',
    description: 'The best open source reasoning model by DeepSeek',
    provider: 'deepseek',
    supportsVision: false,
    // censored: true,
    rateLimit: {
      level: 'level1',
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    reasoning: {
      enabled: true,
      provider: 'deepseek',
      baseModelId: 'deepseek-reasoner',
      tagName: 'think'
    },
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 25,
    intelligenceIndex: 60,
    MMLU_Pro: 84,
    Coding: 49,
    MATH: 82,
    GPQA: 71,
    multilingual:86,
    HLE: 9.3
  },
  {
    id: 'deepseek-chat',
    name: "DeepSeek V3 (Mar' 25)",
    country: 'CHINA',
    description: 'The best open source non-reasoning model in the world, outscoring Grok3, Claude 3.7 Sonnet and GPT-4.5 in the Artificial Analysis Intelligence Index.',
    provider: 'deepseek',
    supportsVision: false,
    // censored: true,
    rateLimit: {
      level: 'level1',
    },
    isWebSearchEnabled: true,
    supportsPDFs: false,
    isNew: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 33,
    intelligenceIndex: 53,
    MMLU_Pro: 82,
    Coding: 38,
    MATH: 73,
    GPQA: 66,
    HLE: 5.2,
    multilingual:86
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1 (Thinking)',
    country: 'CHINA',
    description: 'DeepSeek R1 via Together.ai',
    provider: 'together',
    supportsVision: false,
    // censored: true,
    rateLimit: {
      level: 'level3',
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    reasoning: {
      enabled: true,
      provider: 'together',
      baseModelId: 'deepseek-ai/DeepSeek-R1',
      tagName: 'think'
    },
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 96,
    intelligenceIndex: 60,
    MMLU_Pro: 84,
    Coding: 49,
    MATH: 82,
    GPQA: 71,
    multilingual:86,
    HLE: 9.3
  },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    country: 'CHINA',
    description: 'DeepSeek V3 via Together.ai',
    provider: 'together',
    supportsVision: false,
    // censored: true,
    rateLimit: {
      level: 'level3',
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 72,
    intelligenceIndex: 46,
    MMLU_Pro: 76,
    Coding: 36,
    MATH: 57,
    GPQA: 56,
    multilingual:86,
    HLE: 3.6
  },
  {
    id: 'gpt-4.5-preview',
    name: 'GPT-4.5',
    country: 'US',
    description: 'Latest and most capable GPT model yet by OpenAI',
    provider: 'openai',
    supportsVision: true,
    censored: true,
    rateLimit: {
      level: 'level5',
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 14,
    intelligenceIndex: 51,
    MMLU_Pro: 89.6,  // estimated
    // Coding: , // unknown
    // MATH: // unknown,
    GPQA: 71
  },
  {
    id: 'chatgpt-4o-latest',
    name: 'GPT-4o',
    country: 'US',
    description: 'Latest version of GPT-4o used in ChatGPT',
    provider: 'openai',
    supportsVision: true,
    censored: true,
    rateLimit: {
      level: 'level5',
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 136,
    intelligenceIndex: 41,
    MMLU_Pro: 77,
    Coding: 31,
    MATH: 45,
    GPQA: 51,
    HLE: 3.7
  },
  {
    "id": "o1",
    "name": "o1 (Thinking)",
    "country": 'US',
    "description": "Advanced reasoning model by OpenAI. Reasoning tokens used in its chain-of-thought process are hidden by OpenAI and not included in the visible output.",
    "provider": "openai",
    "supportsVision": true,
    // "censored": true,
    "rateLimit": {
      "level": "level5",
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 200000,
    tps: 36,
    intelligenceIndex: 62,
    MMLU_Pro: 84,
    Coding: 52,
    MATH: 85,
    GPQA: 75,
    multilingual: 88,
    HLE: 7.7
  },
  {
    "id": "o3-mini",
    "name": "o3-mini (Thinking)",
    "country": 'US',
    "description": "Latest small reasoning model by OpenAI. Reasoning tokens used in its chain-of-thought process are hidden by OpenAI and not included in the visible output.",
    "provider": "openai",
    "supportsVision": false,
    // "censored": true,
    "rateLimit": {
      "level": "level5",
    },
    isWebSearchEnabled: false,
    supportsPDFs: false,
    isEnabled: true,
    isHot: true,
    isActivated: true,
    contextWindow: 200000,
    tps: 188,
    intelligenceIndex: 63,
    MMLU_Pro: 79,
    Coding: 56,
    MATH: 87,
    GPQA: 75,
    HLE: 8.7
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    country: 'US',
    description: 'Latest model with 1m context window by Google',
    provider: 'google',
    supportsVision: true,
    censored: true,
    rateLimit: {
      level: 'level1',
    },
    isWebSearchEnabled: true,
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 1024000,
    tps: 258,
    intelligenceIndex: 48,
    MMLU_Pro: 78,
    Coding: 32,
    MATH: 63,
    GPQA: 62,
    HLE: 5.3
  },
  {
    id: 'grok-2-vision-latest',
    name: 'Grok 2 Vision',
    country: 'US',
    description: 'Grok 2 by xAI',
    provider: 'xai',
    supportsVision: true,
    censored: false,
    rateLimit: {
      level: 'level0',
    },
    isWebSearchEnabled: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 67, 
    intelligenceIndex: 39,
    MMLU_Pro: 70,
    Coding: 28,
    MATH: 46,
    GPQA: 51,
    HLE: 3.8
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    country: 'US',
    description: 'Llama 3.3 70B by Meta via Groq',
    provider: 'groq',
    supportsVision: false,
    censored: false,
    rateLimit: {
      level: 'level2',
    },
    isWebSearchEnabled: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 275,
    intelligenceIndex: 41,
    MMLU_Pro: 71,
    Coding: 27,
    MATH: 54,
    GPQA: 50,
    multilingual:84,
    HLE: 4.0
  },
  {
    id: 'qwen-qwq-32b',
    name: 'QwQ-32B (Thinking)',
    country: 'CHINA',
    description: "Capable of achieving competitive performance against state-of-the-art reasoning models, e.g., DeepSeek-R1, o1-mini",
    provider: 'groq',
    supportsVision: false,
    // censored: true,
    rateLimit: {
      level: 'level2',
    },
    isHot: true,
    reasoning: {
      enabled: true,
      provider: 'groq',
      baseModelId: 'qwen-qwq-32b',
      tagName: 'think'
    },
    isEnabled: true,
    isActivated: true,
    supportsPDFs: false,
    isWebSearchEnabled: true,
    contextWindow: 131000,
    tps: 399,
    intelligenceIndex: 58,
    MMLU_Pro: 76,
    Coding: 49,
    MATH: 87,
    GPQA: 59,
    HLE: 8.2
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
