export interface ModelConfig {
  id: string;
  name: string;
  country: string;
  description?: string;
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'together' | 'groq' | 'xai';
  supportsVision: boolean;
  supportsPDFs: boolean;
  censored?: boolean;
  rateLimit: {
    level: 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
  };
  isEnabled: boolean;
  isActivated: boolean; // Whether the model is activated for selection
  isAgentEnabled?: boolean;
  isNew?: boolean; // Mark model as new
  isHot?: boolean; // Mark model as hot/trending
  reasoning?: {
    enabled: boolean;
    provider?: 'groq' | 'together' | 'anthropic' | 'deepseek' | 'google';  
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
      requests: 50,    
      window: '4 h'
    },
    daily: {
      requests: 100,    
      window: '24 h'
    }
  },
  level1: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 24,    
      window: '24 h'
    }
  },
  level2: {
    hourly: {
      requests: 10,
      window: '4 h'
    },
    daily: {
      requests: 24,
      window: '24 h'
    }
  },
  level3: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 24,
      window: '24 h'
    }
  },
  level4: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 24,
      window: '24 h'
    }
  },
  level5: {
    hourly: {
      requests: 10,    
      window: '4 h'
    },
    daily: {
      requests: 24,
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
    id: 'gemini-2.5-pro-preview-03-25',
    name: 'Gemini 2.5 Pro Preview 03-25 (Thinking)',
    country: 'US',
    description: 'Google\'s most powerful thinking model. Reasoning tokens used in its chain-of-thought process are hidden by Google and not included in the visible output.',
    provider: 'google',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: true,
    isNew: true,
    isHot: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 1024000,
    isAgentEnabled: false,
    tps: 159,
    intelligenceIndex: 68,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    country: 'US',
    description: 'Latest 2.0 flash model with 1m context window by Google',
    provider: 'google',
    supportsVision: true,
    // censored: true,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    // isAgentEnabled: true,
    contextWindow: 1024000,
    tps: 258,
    intelligenceIndex: 48,
  },
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
    supportsPDFs: true,
    censored: true,
    rateLimit: {
      level: 'level4',
    },
    isAgentEnabled: true,
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
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Thinking)',
    country: 'CHINA',
    description: 'The best open source reasoning model by DeepSeek',
    provider: 'deepseek',
    supportsVision: false,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: false,
    reasoning: {
      enabled: true,
      provider: 'deepseek',
      baseModelId: 'deepseek-reasoner',
      tagName: 'think'
    },
    isEnabled: false,
    isActivated: true,
    contextWindow: 128000,
    tps: 25,
    intelligenceIndex: 60,
    multilingual:86,
  },
  {
    id: 'deepseek-chat',
    name: "DeepSeek V3 (Mar' 25)",
    country: 'CHINA',
    description: 'Latest generation of DeepSeek V3. The best open source non-reasoning model by DeepSeek',
    provider: 'deepseek',
    supportsVision: false,
    // censored: true,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: false,
    isEnabled: false,
    isActivated: true,
    contextWindow: 128000,
    tps: 33,
    intelligenceIndex: 53,
    multilingual:86
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1 (Thinking)',
    country: 'CHINA',
    description: 'Developed by DeepSeek hosted by Together.ai. Faster than the official DeepSeek R1',
    provider: 'together',
    supportsVision: false,
    // censored: true,
    rateLimit: {
      level: 'level3',
    },
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
    multilingual:86,
  },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    country: 'CHINA',
    description: 'Previous generation of DeepSeek V3 hosted by Together.ai. Faster than the official DeepSeek V3',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 128000,
    tps: 72,
    intelligenceIndex: 46,
    multilingual:86,
  },
  {
    id: 'chatgpt-4o-latest',
    name: 'ChatGPT-4o',
    country: 'US',
    description: 'GPT-4o model used in ChatGPT',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level5',
    },
    supportsPDFs: false,
    isHot: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 128000,
    tps: 174,
    intelligenceIndex: 50,
  },
  {
    id: 'gpt-4o-2024-11-20',
    name: 'GPT-4o (Nov \'24)',
    country: 'US',
    description: 'Fast, intelligent, flexible GPT model',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level5',
    },
    supportsPDFs: false,
    isEnabled: true,
    // isNew: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    tps: 69,
    intelligenceIndex: 41,
    multilingual: 84
  },
  {
    "id": "o1",
    "name": "o1 (Thinking)",
    "country": 'US',
    "description": "High-intelligence reasoning model by OpenAI. Reasoning tokens used in its chain-of-thought process are hidden by OpenAI and not included in the visible output.",
    "provider": "openai",
    "supportsVision": true,
    "rateLimit": {
      "level": "level5",
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 200000,
    tps: 36,
    intelligenceIndex: 62,
  },
  {
    "id": "o3-mini",
    "name": "o3-mini (Thinking)",
    "country": 'US',
    "description": "Fast, flexible, intelligent reasoning model by OpenAI. Reasoning tokens used in its chain-of-thought process are hidden by OpenAI and not included in the visible output.",
    "provider": "openai",
    "supportsVision": false,
    "rateLimit": {
      "level": "level5",
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    contextWindow: 200000,
    tps: 188,
    intelligenceIndex: 63,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    country: 'US',
    description: 'Fast and small model for focused tasks by OpenAI',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    // isNew: true,
    isAgentEnabled: false,
    contextWindow: 128000,
    tps: 77,
    intelligenceIndex: 36,
    multilingual: 80
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
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131000,
    tps: 67, 
    intelligenceIndex: 39,
  },
  {
    id: 'qwen-qwq-32b',
    name: 'QwQ-32B (Thinking)',
    country: 'CHINA',
    description: "Developed by Qwen hosted by Groq. Capable of achieving competitive performance against state-of-the-art reasoning models, e.g., DeepSeek-R1, o1-mini",
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    reasoning: {
      enabled: true,
      provider: 'groq',
      baseModelId: 'qwen-qwq-32b',
      tagName: 'think'
    },
    isEnabled: true,
    isActivated: true,
    supportsPDFs: false,
    contextWindow: 131000,
    tps: 399,
    intelligenceIndex: 58,
    MMLU_Pro: 76,
    Coding: 49,
    MATH: 87,
    GPQA: 59,
    HLE: 8.2
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    country: 'US',
    description: 'Developed by Meta hosted by Groq. Fast and smart.',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
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
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    country: 'US',
    description: 'Meta\'s latest model. Fast but dumb. Hosted by Groq.',
    provider: 'groq',
    supportsVision: true,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isNew: true,
    // isHot: true,
    contextWindow: 131072,
    tps: 460,
    intelligenceIndex: 36,
    // multilingual:84,
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
