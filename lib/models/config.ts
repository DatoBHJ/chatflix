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
  abbreviation?: string; // Short name to display on mobile devices
  rateLimit: {
    level: 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
  };
  isEnabled: boolean;
  isActivated: boolean; // Whether the model is activated for selection
  isAgentEnabled?: boolean;
  isNew?: boolean; // Mark model as new
  isHot?: boolean; // Mark model as hot/trending
  isUpdated?: boolean; // Mark model as recently updated
  updateDescription?: string; // Description for the update tooltip
  
  // Simple reasoning flag (scira style)
  reasoning?: boolean;
  
  // Performance metrics (optional)
  contextWindow?: number;
  tps?: number; // Tokens per second
  intelligenceIndex?: number; // AI Intelligence Index
  multilingual?: number;
  latency?: number; // Response latency
  maxOutputTokens?: number;
  IFBench?: number; // Instruction Following benchmark
}

// Default model configuration
export const DEFAULT_MODEL_ID = 'chatflix-ultimate-pro'; 

export const RATE_LIMITS = {
  level0: {
    hourly: {
      requests: 10,    
      window: '12 h'
    },
    daily: {
      requests: 20,    
      window: '24 h'
    }
  },
  level1: {
    hourly: {
      requests: 10,    
      window: '12 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level2: {
    hourly: {
      requests: 10,
      window: '12 h'
    },
    daily: {
      requests: 20,
      window: '24 h'
    }
  },
  level3: {
    hourly: {
      requests: 10,    
      window: '12 h'
    },
    daily: {
      requests: 10,
      window: '24 h'
    }
  },
  level4: {
    hourly: {
      requests: 2,    
      window: '1 h'
    },
    daily: {
      requests: 10,
      window: '24 h'
    }
  },
  level5: {
    hourly: {
      requests: 2,    
      window: '1 h'
    },
    daily: {
      requests: 10,
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



// 챗플릭스 모델인지 확인하는 함수
export function isChatflixModel(modelId: string): boolean {
  return modelId === 'chatflix-ultimate' || modelId === 'chatflix-ultimate-pro';
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
  provider: 'anthropic',
  supportsVision: true,
  supportsPDFs: true,
  rateLimit: {
    level: 'level3',
  },
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,
  // isUpdated: true, // Recently updated
  // updateDescription: 'Enhanced model selection algorithm with improved reasoning capabilities and better performance for complex tasks.',
  reasoning: true,
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
    level: 'level0',
  },
  // isHot: true,
  isEnabled: true,
  isActivated: true,
  isAgentEnabled: true,

  reasoning: true,
},
  // Grok Code Fast 1
  {
    id: 'grok-code-fast-1',
    name: 'Grok Code Fast 1',
    cutoff: 'Aug 2025',
    abbreviation: 'GCF1',
    country: 'US',
    provider: 'xai',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    reasoning: true,
    contextWindow: 256000,
    tps: 310, 
    intelligenceIndex: 49, 
    latency: 6.8,
    maxOutputTokens: 16000,
    description: 'A speedy reasoning model that excels at agentic coding.',
  },
  // Grok 4 
  {
    id: 'grok-4-0709',
    name: 'Grok 4',
    // cutoff: 'Jul 2025',
    // pro: true,
    abbreviation: 'G4-0709',
    country: 'US',
    provider: 'xai',
    supportsVision: true,
    // censored: false,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 256000,
    tps: 41,
    intelligenceIndex: 65,
    latency: 8.9,
    maxOutputTokens: 16000,
    IFBench:54
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
      level: 'level1',
    },
    reasoning: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    tps: 127,
    intelligenceIndex: 57,
    latency: 16.3,
    maxOutputTokens: 16000,
    IFBench:46
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
      level: 'level1',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    tps: 43,
    intelligenceIndex: 36,
    latency: 0.8,
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
      level: 'level3',
    },
    supportsPDFs: true,
    // censored: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    reasoning: true,
    contextWindow: 200000,
    intelligenceIndex: 57,
    tps: 43,
    latency: 47.4,
    maxOutputTokens: 64000,
    IFBench:55
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
      level: 'level3',
    },
    isAgentEnabled: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 200000,
    intelligenceIndex: 47,
    tps: 62,
    latency: 1.8,
    maxOutputTokens: 64000,
    IFBench:45
  },
  // GPT-5
  {
    id: 'gpt-5',
    name: 'GPT-5 (Thinking)',
    cutoff: 'Oct 2024',
    abbreviation: 'G5',
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level3',
    },
    reasoning: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 400000,
    tps: 181,
    intelligenceIndex: 66,
    latency: 31.9,
    maxOutputTokens: 128000,
    IFBench:71
  },
  // GPT-5 Mini
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini (Thinking)',
    cutoff: 'Oct 2024',
    abbreviation: 'G5M',
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    reasoning: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 400000,
    tps: 81,
    intelligenceIndex: 61,
    latency: 30.6,
    maxOutputTokens: 128000,
    IFBench:71
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano (Thinking)',
    cutoff: 'Oct 2024',
    abbreviation: 'G5N',
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    reasoning: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 400000,
    tps: 194,
    intelligenceIndex: 48,
    latency: 35.1,
    maxOutputTokens: 128000,
    IFBench:66
  },
   // ChatGPT-5 (Aug '25)
   {
    id: 'gpt-5-chat-latest',
    name: 'ChatGPT-5',
    cutoff: 'Sep 2024',
    abbreviation: 'CG5',
    country: 'US',
    provider: 'openai',
    description: "GPT-5 model used in ChatGPT",
    supportsVision: true,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 400000,
    // tps: 174,
    // intelligenceIndex: 40,
    // latency: 0.5,
    maxOutputTokens: 128000,
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
      level: 'level3',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 1047576,
    tps: 113,
    intelligenceIndex: 43,
    latency: 0.5,
    maxOutputTokens: 32768,
    IFBench:61
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
    intelligenceIndex: 42,
    latency: 0.5,
    maxOutputTokens: 32000,
    IFBench:42
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
    tps: 106,
    intelligenceIndex: 27,
    latency: 0.4,
    maxOutputTokens: 32000,
    IFBench:17
  },
    // ChatGPT-4o (Nov '24)
    {
    id: 'chatgpt-4o-latest',
    name: 'ChatGPT-4o',
    cutoff: 'Oct 2023',
    abbreviation: 'CG4o',
    description: "GPT-4o model used in ChatGPT",
    country: 'US',
    provider: 'openai',
    supportsVision: true,
    rateLimit: {
      level: 'level3',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: false,
    contextWindow: 128000,
    tps: 170,
    intelligenceIndex: 36,
    latency: 0.4,
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
      level: 'level3',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    tps: 158,
    intelligenceIndex: 27,
    latency: 0.4,
    maxOutputTokens: 65536,
    IFBench:34
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
      level: "level3",
    },
    reasoning: true,
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 200000,
    tps: 107,
    intelligenceIndex: 59,
    latency: 44.8,
    maxOutputTokens: 100000,
    IFBench:69
  },
  // o3 (Reasoning)
  {
    id: 'o3',
    name: 'o3',
    cutoff: 'Jun 2024',
    abbreviation: 'o3',
    country: 'US',
    provider: 'openai',
    supportsVision: false,
    rateLimit: {
      level: 'level3',
    },
    reasoning: true,
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 200000,
    tps: 176,
    intelligenceIndex: 65,
    latency: 10.6,
    maxOutputTokens: 100000,
    IFBench:71
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
      level: 'level3',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    contextWindow: 1048576,
    isAgentEnabled: true,
    tps: 152,
    intelligenceIndex: 60,
    latency: 29,
    maxOutputTokens: 65536,
    IFBench:49
  },
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
      level: 'level3',
    },
    supportsPDFs: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 1048576,
    tps: 223,
    intelligenceIndex: 40,
    latency: 0.3,
    maxOutputTokens: 65536,
    IFBench:39
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
    tps: 183,
    intelligenceIndex: 34,
    latency: 0.4,
    maxOutputTokens: 8192,
    IFBench:40
  },
  // openai/gpt-oss-120b
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS-120B (Thinking)',
    abbreviation: 'G120B',
    country: 'US',
    description: 'Developed by OpenAI, powered by Groq',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    reasoning: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    // latency: 3.8,
    // tps: 574,
    // intelligenceIndex: 61,
  },
  // openai/gpt-oss-20b
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS-20B (Thinking)',
    abbreviation: 'G20B',
    country: 'US',
    description: 'Developed by OpenAI, powered by Groq',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    reasoning: true,
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    // latency: 2,
    // tps: 1152,
    // intelligenceIndex: 49,
  },
  // Kimi K2
  {
    id: 'moonshotai/kimi-k2-instruct',
    name: 'Kimi K2',
    // cutoff: 'Dec 2023',
    abbreviation: 'K2',
    country: 'US',
    description: 'Developed by Moonshot AI, powered by Groq',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 131072,
    latency: 0.3,
    tps: 340,
    intelligenceIndex: 50,
    IFBench:42,
    maxOutputTokens: 16384,
  },    
  // Kimi K2 
  // {
  //   id: 'moonshotai/Kimi-K2-Instruct',
  //   name: 'Kimi K2',
  //   // cutoff: 'July 2024',
  //   abbreviation: 'K2',
  //   country: 'CHINA',
  //   description: 'Developed by Moonshot AI, powered by TogetherAI',
  //   provider: 'together',
  //   supportsVision: false,
  //   rateLimit: {
  //     level: 'level2',
  //   },
  //   supportsPDFs: false,
  //   isEnabled: false,
  //   isActivated: true,
  //   isAgentEnabled: true,
  //   contextWindow: 131072,
  //   tps: 32,
  //   intelligenceIndex: 49,
  //   latency: 0.6,
  //   IFBench:42
  // },
  // Llama 4 Scout --disabled due to unstable agent performance
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    cutoff: 'Dec 2023',
    abbreviation: 'L4S',
    country: 'US',
    description: 'Developed by Meta, powered by Groq',
    provider: 'groq',
    supportsVision: true,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: false,
    isEnabled: false,
    isActivated: false,
    isAgentEnabled: false,
    contextWindow: 131072,
    latency: 0.2,
    tps: 430,
    intelligenceIndex: 28,
    IFBench:40
  },
   // QwQ-32B (Thinking)
   {
    id: 'qwen/qwen3-32b',
    name: 'Qwen3-32B (Thinking)',
    cutoff: 'June 2024',
    abbreviation: 'Q3-32B-T',
    country: 'CHINA',
    description: 'Developed by Alibaba, powered by Groq',
    provider: 'groq',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    reasoning: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    supportsPDFs: false,
    contextWindow: 131072,
    tps: 429,
    latency: 0.2,
    intelligenceIndex: 26,
    // maxOutputTokens: 32768,
  },

   // DeepSeek V3.1 (Thinking)
   {
    id: 'deepseek-reasoner',
    name: 'DeepSeek V3.1 (Thinking)',
    cutoff: 'July 2024',
    abbreviation: 'DSV3.1-T',
    country: 'CHINA',
    provider: 'deepseek',
    supportsVision: false,
    rateLimit: {
      level: 'level1',
    },
    description: 'If the request to the deepseek-reasoner model includes the tools parameter, the request will actually be processed using the deepseek-chat model.',
    supportsPDFs: false,
    reasoning: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    tps: 20,
    intelligenceIndex: 54,
    latency: 102.4,
    maxOutputTokens: 32000,
    IFBench:42,
    isNew: true,
  },
  // DeepSeek V3.1
  {
    id: 'deepseek-chat',
    name: "DeepSeek V3.1",
    cutoff: 'July 2024',
    abbreviation: 'DSV3.1',
    country: 'CHINA',
    provider: 'deepseek',
    supportsVision: false,
    rateLimit: {
      level: 'level1',
    },
    supportsPDFs: false,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 128000,
    tps: 21,
    intelligenceIndex: 45,
    latency: 2.8,
    IFBench:38,
    isNew: true,
  },
  {
    id: 'Qwen/Qwen3-235B-A22B-Thinking-2507',
    name: 'Qwen3-235B-A22B-2507 (Thinking)',
    cutoff: 'mid-2024 (estimated)',
    abbreviation: 'Q3-235B-A22B-T-2507',
    country: 'CHINA',
    description: 'Developed by Alibaba, powered by TogetherAI',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    reasoning: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 256000,
    tps: 54,
    intelligenceIndex: 57,
    latency: 37.6,
    maxOutputTokens: 32000,
    IFBench:51,
    isNew: true,
  },
  {
    id: 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput',
    name: 'Qwen3-235B-A22B-2507',
    cutoff: 'mid-2024 (estimated)',
    abbreviation: 'Q3-235B-A22B-2507',
    country: 'CHINA',
    description: 'Developed by Alibaba, powered by TogetherAI',
    provider: 'together',
    supportsVision: false,
    rateLimit: {
      level: 'level2',
    },
    supportsPDFs: false,
    reasoning: true,
    isEnabled: true,
    isActivated: true,
    isAgentEnabled: true,
    contextWindow: 256000,
    tps: 39,
    intelligenceIndex: 45,
    latency: 0.3,
    maxOutputTokens: 32000,
    IFBench:51,
    isNew: true,
  },
  // // DeepSeek R1 (Thinking)
  // {
  //   id: 'deepseek-ai/DeepSeek-R1',
  //   name: 'DeepSeek R1 0528 (Thinking)',
  //   cutoff: 'July 2024',
  //   abbreviation: 'DSR1-T',
  //   country: 'CHINA',
  //   description: 'Developed by DeepSeek, powered by TogetherAI',
  //   provider: 'together',
  //   supportsVision: false,
  //   rateLimit: {
  //     level: 'level2',
  //   },
  //   supportsPDFs: false,
  //   reasoning: true,
  //   isEnabled: false,
  //   isActivated: true,
  //   isAgentEnabled: true,
  //   contextWindow: 128000,
  //   // tps: 96,
  //   intelligenceIndex: 59,
  //   // multilingual:86,
  //   latency: 24.2,
  //   maxOutputTokens: 32000,
  //   IFBench:40
  // },
  // // DeepSeek V3 (Mar' 25)
  // {
  //   id: 'deepseek-ai/DeepSeek-V3',
  //   name: 'DeepSeek V3',
  //   cutoff: 'July 2024',
  //   abbreviation: 'DSV3',
  //   country: 'CHINA',
  //   description: 'Developed by DeepSeek, powered by TogetherAI',
  //   provider: 'together',
  //   supportsVision: false,
  //   rateLimit: {
  //     level: 'level2',
  //   },
  //   supportsPDFs: false,
  //   isEnabled: false,
  //   isActivated: true,
  //   isAgentEnabled: true,
  //   contextWindow: 128000,
  //   tps: 101,
  //   intelligenceIndex: 44,
  //   latency: 0.6,
  // },
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
