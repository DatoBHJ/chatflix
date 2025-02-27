export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'together' | 'groq' | 'xai';
  supportsVision: boolean;
  supportsPdf?: boolean;
  rateLimit: {
    category: 'low' | 'mid' | 'high' | 'superHigh';
    requests: number;
    window: string;
  };
  pricing: {
    pricePerMillion: number;
    inputPrice?: number;
    outputPrice?: number;
  };
  isEnabled: boolean;
  reasoning?: {
    enabled: boolean;
    provider?: 'groq' | 'together' | 'anthropic' | 'deepseek';  
    baseModelId?: string; 
    tagName?: string; 
    budgetTokens?: number;
  };
}

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet (Thinking)',
    description: "Anthropic's most intelligent model yet with extended thinking capability.",
    provider: 'anthropic',
    supportsVision: true,
    supportsPdf: true,
    rateLimit: {
      category: 'high',
      requests: 30,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 9,
      inputPrice: 3,
      outputPrice: 15
    },
    isEnabled: true,
    reasoning: {
      enabled: true,
      provider: 'anthropic',
      baseModelId: 'claude-3-7-sonnet-20250219',
      budgetTokens: 12000
    }
  },
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    description: 'GOAT',
    provider: 'anthropic',
    supportsVision: true,
    supportsPdf: true,
    rateLimit: {
      category: 'low',
      requests: 300,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 9,
      inputPrice: 3,
      outputPrice: 15
    },
    isEnabled: true
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1',
    description: 'The best open source reasoning model by DeepSeek via Together.ai',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      category: 'high',
      requests: 30,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 7
    },
    isEnabled: true,
    reasoning: {
      enabled: true,
      provider: 'together',
      baseModelId: 'deepseek-ai/DeepSeek-R1',
      tagName: 'think'
    }
  },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    description: 'The best open source non-reasoning model by DeepSeek via Together.ai',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      category: 'mid',
      requests: 60,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 1.25
    },
    isEnabled: true
  },
  // {
  //   id: 'deepseek-reasoner',
  //   name: 'DeepSeek R1',
  //   description: 'The best open source reasoning model by DeepSeek',
  //   provider: 'deepseek',
  //   supportsVision: false,
  //   rateLimit: {
  //     category: 'low',
  //     requests: 3000,
  //     window: '60 m'
  //   },
  //   pricing: {
  //     pricePerMillion: 7
  //   },
  //   isEnabled: true,
  //   reasoning: {
  //     enabled: true,
  //     provider: 'deepseek',
  //     baseModelId: 'deepseek-reasoner',
  //     tagName: 'think'
  //   }
  // },
  // {
  //   id: 'deepseek-chat',
  //   name: 'DeepSeek V3',
  //   description: 'The best open source non-reasoning model by DeepSeek',
  //   provider: 'deepseek',
  //   supportsVision: false,
  //   rateLimit: {
  //     category: 'low',
  //     requests: 3000,
  //     window: '60 m'
  //   },
  //   pricing: {
  //     pricePerMillion: 1.25
  //   },
  //   isEnabled: true
  // },
  {
    id: 'chatgpt-4o-latest',
    name: 'ChatGPT-4o',
    description: 'Latest version of GPT-4o used in ChatGPT',
    provider: 'openai',
    supportsVision: true,
    supportsPdf: false,
    rateLimit: {
      category: 'high',
      requests: 30,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 10,
      inputPrice: 5,
      outputPrice: 15
    },
    isEnabled: true
  },
  {
    id: 'o1',
    name: 'o1',
    description: 'Advanced reasoning model by OpenAI',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      category: 'superHigh',
      requests: 15,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 37.5,
      inputPrice: 15,
      outputPrice: 60
    },
    isEnabled: true
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    description: 'Latest small reasoning model by OpenAI',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      category: 'low',
      requests: 100,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 2.75,
      inputPrice: 1.1,
      outputPrice: 4.4
    },
    isEnabled: true
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Latest model with 1m context window by Google',
    provider: 'google',
    supportsVision: true,
    supportsPdf: true,
    rateLimit: {
      category: 'low',
      requests: 100,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 0.25,
      inputPrice: 0.1,
      outputPrice: 0.4
    },
    isEnabled: true
  },
  {
    id: 'grok-2-vision-latest',
    name: 'Grok 2 Vision',
    description: 'Grok 2 by xAI',
    provider: 'xai',
    supportsVision: true,
    rateLimit: {
      category: 'high',
      requests: 30,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 6,
      inputPrice: 2,
      outputPrice: 10
    },
    isEnabled: true
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    description: 'Llama 3.3 70B by Meta via Groq',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      category: 'low',
      requests: 100,
      window: '60 m'
    },
    pricing: {
      pricePerMillion: 0.7
    },
    isEnabled: true
  }
];

// Utility functions
export const getEnabledModels = () => MODEL_CONFIGS.filter(model => model.isEnabled);
export const getModelById = (id: string) => MODEL_CONFIGS.find(model => model.id === id);
export const getVisionModels = () => MODEL_CONFIGS.filter(model => model.supportsVision);
export const getNonVisionModels = () => MODEL_CONFIGS.filter(model => !model.supportsVision);
export const getModelsByProvider = (provider: ModelConfig['provider']) => 
  MODEL_CONFIGS.filter(model => model.provider === provider); 