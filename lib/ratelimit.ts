import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_* environment variables are not set')
}

// Create a new Redis instance
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Define rate limits for different model categories
const rateLimits = {
  low: {
    requests: 100,
    window: '60 m'
  },
  mid: {
    requests: 60,
    window: '60 m'
  },
  high: {
    requests: 30,
    window: '60 m'
  },
  superHigh: {
    requests: 15,
    window: '60 m'
  }
} as const;

// Model configuration with rate limits and pricing info
interface ModelConfig {
  category: keyof typeof rateLimits;
  pricePerMillion: number;
  inputPrice?: number;
  outputPrice?: number;
}

const modelConfigs: { [key: string]: ModelConfig } = {
  'o1': {
    category: 'superHigh',
    pricePerMillion: 37.5,
    inputPrice: 15,
    outputPrice: 60
  },
  'chatgpt-4o-latest': {
    category: 'high',
    pricePerMillion: 10,
    inputPrice: 5,
    outputPrice: 15
  },
  'claude-3-5-sonnet-latest': {
    category: 'high',
    pricePerMillion: 9,
    inputPrice: 3,
    outputPrice: 15
  },
  'deepseek-ai/DeepSeek-R1': {
    category: 'high',
    pricePerMillion: 7
  },
  'grok-2-latest': {
    category: 'high',
    pricePerMillion: 6,
    inputPrice: 2,
    outputPrice: 10
  },
  'gemini-1.5-pro': {
    category: 'mid',
    pricePerMillion: 4.5,
    inputPrice: 2,
    outputPrice: 7
  },
  'o3-mini': {
    category: 'low',
    pricePerMillion: 2.75,
    inputPrice: 1.1,
    outputPrice: 4.4
  },
  'deepseek-ai/DeepSeek-V3': {
    category: 'mid',
    pricePerMillion: 1.25
  },
  'llama-3.3-70b-versatile': {
    category: 'low',
    pricePerMillion: 0.7
  },
  'gemini-2.0-flash': {
    category: 'low',
    pricePerMillion: 0.25,
    inputPrice: 0.1,
    outputPrice: 0.4
  },
  'deepseek-reasoner': {
    category: 'low',
    pricePerMillion: 0
  },
  'deepseek-chat': {
    category: 'low',
    pricePerMillion: 0
  }
};

// Create individual rate limiters for each model
const modelRateLimiters = Object.entries(modelConfigs).reduce((acc, [model, config]) => {
  const limit = rateLimits[config.category];
  acc[model] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit.requests, limit.window),
    analytics: true,
    prefix: `ratelimit:model:${model}`, // Model-specific prefix
  });
  return acc;
}, {} as { [key: string]: Ratelimit });

// Function to get rate limiter for a specific model
export function getRateLimiter(model: string): Ratelimit {
  // Development environment check
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true') {
    // Return a mock rate limiter that always succeeds
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(99999, '1 h'), // Effectively unlimited
      analytics: false,
      prefix: `ratelimit:model:${model}`,
    });
  }

  if (!modelRateLimiters[model]) {
    // For unknown models, create a new rate limiter with 'low' category limits
    const limit = rateLimits.low;
    modelRateLimiters[model] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit.requests, limit.window),
      analytics: true,
      prefix: `ratelimit:model:${model}`,
    });
  }
  return modelRateLimiters[model];
}

// Default rate limiter (for backward compatibility)
export const ratelimit = getRateLimiter('default');