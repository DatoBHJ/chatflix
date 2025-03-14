export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'together' | 'groq' | 'xai';
  supportsVision: boolean;
  rateLimit: {
    level: 'level1' | 'level2' | 'level3';
  };
  isEnabled: boolean;
  reasoning?: {
    enabled: boolean;
    provider?: 'groq' | 'together' | 'anthropic' | 'deepseek';  
    baseModelId?: string; 
    tagName?: string; 
    budgetTokens?: number;
  };
  contextWindow?: number;
}

// Default model configuration
export const DEFAULT_MODEL_ID = 'gemini-2.0-flash'; 

// // Rate limit configuration by level
// export const RATE_LIMITS = {
//   level1: {
//     requests: 1,
//     window: '60 m'
//   },
//   level2: {
//     requests: 6,
//     window: '60 m'
//   },
//   level3: {
//     requests: 3,
//     window: '60 m'
//   }
// };
// Rate limit configuration by level
export const RATE_LIMITS = {
  level1: {
    requests: 5,
    window: '60 m'
  },
  level2: {
    requests: 5,
    window: '60 m'
  },
  level3: {
    requests: 5,
    window: '60 m'
  }
};

// Get system default model ID (should match Supabase's get_default_model_id function)
export function getSystemDefaultModelId(): string {
  return DEFAULT_MODEL_ID;
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
    
    // Verify the returned model exists in our configs
    const modelExists = MODEL_CONFIGS.some(model => model.id === data && model.isEnabled);
    return modelExists ? data : getSystemDefaultModelId();
  } catch (error) {
    console.error('Error in getUserDefaultModel:', error);
    return getSystemDefaultModelId();
  }
}

// Function to update user's default model
export async function updateUserDefaultModel(userId: string, modelId: string): Promise<boolean> {
  try {
    // Verify the model exists and is enabled
    const modelExists = MODEL_CONFIGS.some(model => model.id === modelId && model.isEnabled);
    if (!modelExists) {
      console.error('Attempted to set invalid or disabled model as default:', modelId);
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
    description: "Anthropic's most intelligent model yet with extended thinking capability.",
    provider: 'anthropic',
    supportsVision: true,
    rateLimit: {
      level: 'level3',
    },
    isEnabled: true,
    reasoning: {
      enabled: true,
      provider: 'anthropic',
      baseModelId: 'claude-3-7-sonnet-20250219',
      budgetTokens: 12000
    },
    contextWindow: 200000    
  },
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    description: "Anthropic's most intelligent model.",
    provider: 'anthropic',
    supportsVision: true,
    rateLimit: {
      level: 'level3',
    },
    isEnabled: true,
    contextWindow: 200000
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    description: 'Coding GOAT',
    provider: 'anthropic',
    supportsVision: true,
    rateLimit: {
      level: 'level3',
    },
    isEnabled: true,
    contextWindow: 200000
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1 (Thinking) 🇺🇸',
    description: 'The best open source reasoning model by DeepSeek via Together.ai',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    reasoning: {
      enabled: true,
      provider: 'together',
      baseModelId: 'deepseek-ai/DeepSeek-R1',
      tagName: 'think'
    },
    isEnabled: true,
    contextWindow: 128000 
  },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3 🇺🇸',
    description: 'The best open source non-reasoning model by DeepSeek via Together.ai',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    isEnabled: true,
    contextWindow: 128000
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Thinking) 🇨🇳',
    description: 'The best open source reasoning model by DeepSeek',
    provider: 'deepseek',
    supportsVision: false,
    rateLimit: {
      level: 'level1',
    },
    reasoning: {
      enabled: true,
      provider: 'deepseek',
      baseModelId: 'deepseek-reasoner',
      tagName: 'think'
    },
    isEnabled: true,
    contextWindow: 128000
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 🇨🇳',
    description: 'The best open source non-reasoning model by DeepSeek',
    provider: 'deepseek',
    supportsVision: false,
    rateLimit: {
      level: 'level1',
    },
    isEnabled: true,
    contextWindow: 128000
  },
  // {
  //   id: 'gpt-4.5-preview',
  //   name: 'GPT-4.5',
  //   description: 'Latest and most capable GPT model yet by OpenAI',
  //   provider: 'openai',
  //   supportsVision: true,
  //   rateLimit: {
  //     level: 'level3',
  //   },
  //   isEnabled: true,
  //   contextWindow: 128000
  // },
  // {
  //   id: 'chatgpt-4o-latest',
  //   name: 'GPT-4o',
  //   description: 'Latest version of GPT-4o used in ChatGPT',
  //   provider: 'openai',
  //   supportsVision: true,
  //   rateLimit: {
  //     level: 'level3',
  //   },
  //   isEnabled: true,
  //   contextWindow: 128000 
  // },
  // {
  //   "id": "o1",
  //   "name": "o1 (Thinking)",
  //   "description": "Advanced reasoning model by OpenAI. Reasoning tokens used in its chain-of-thought process are hidden by OpenAI and not included in the visible output.",
  //   "provider": "openai",
  //   "supportsVision": true,
  //   "rateLimit": {
  //     "level": "level3",
  //   },
  //   "isEnabled": true,
  //   contextWindow: 200000 
  // },
  // {
  //   "id": "o3-mini",
  //   "name": "o3-mini (Thinking)",
  //   "description": "Latest small reasoning model by OpenAI. Reasoning tokens used in its chain-of-thought process are hidden by OpenAI and not included in the visible output.",
  //   "provider": "openai",
  //   "supportsVision": true,
  //   "rateLimit": {
  //     "level": "level2",
  //   },
  //   "isEnabled": true,
  //   contextWindow: 200000
  // },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Latest model with 1m context window by Google',
    provider: 'google',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    isEnabled: true,
    contextWindow: 1024000
  },
  {
    id: 'grok-2-vision-latest',
    name: 'Grok 2 Vision',
    description: 'Grok 2 by xAI',
    provider: 'xai',
    supportsVision: true,
    rateLimit: {
      level: 'level2',
    },
    isEnabled: true,
    contextWindow: 128000
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    description: 'Llama 3.3 70B by Meta via Groq',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level1',
    },
    isEnabled: true,
    contextWindow: 128000
  },
  {
    id: 'qwen-qwq-32b',
    name: 'QwQ-32B (Thinking)',
    description: "Alibaba's latest model. Excels at mathematical reasoning, coding, and complex-problem solving with performance rivaling the likes of DeepSeek-R1 and o1-mini.",
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level1',
    },
    reasoning: {
      enabled: true,
      provider: 'groq',
      baseModelId: 'qwen-qwq-32b',
      tagName: 'think'
    },
    isEnabled: true,
    contextWindow: 128000
  },
];

// Export the final MODEL_CONFIGS
export const MODEL_CONFIGS: ModelConfig[] = MODEL_CONFIG_DATA;

// Utility functions
export const getEnabledModels = () => MODEL_CONFIGS.filter(model => model.isEnabled);
export const getModelById = (id: string) => MODEL_CONFIGS.find(model => model.id === id);
export const getVisionModels = () => MODEL_CONFIGS.filter(model => model.supportsVision);
export const getNonVisionModels = () => MODEL_CONFIGS.filter(model => !model.supportsVision);
export const getModelsByProvider = (provider: ModelConfig['provider']) => 
  MODEL_CONFIGS.filter(model => model.provider === provider); 
