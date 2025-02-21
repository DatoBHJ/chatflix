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
    requests: 100, // 50 
    window: '60 m'
  },
  mid: {
    requests: 60, // 30 
    window: '60 m'
  },
  high: {
    requests: 300, //15 
    window: '60 m'
  },
  superHigh: {
    requests: 15, // 7.5
    window: '60 m'
  }
} as const;

// Map models to their rate limit categories (sorted by price per 1m)
const modelRateLimitCategories: { [key: string]: keyof typeof rateLimits } = {
  'o1': 'superHigh', // 37.5 per 1m (input : 15 / output : 60)
  'chatgpt-4o-latest': 'high', // 10 per 1m (input : 5 / output : 15)
  'claude-3-5-sonnet-latest': 'high', // 9 per 1m (input : 3 / output : 15)
  'deepseek-ai/DeepSeek-R1': 'high', // 7 per 1m 
  'grok-2-latest': 'high', // 6 per 1m (input : 2 / output : 10)
  'gemini-1.5-pro': 'mid', // free / 4.5 per 1m (input : 2 / output : 7)
  'o3-mini': 'low', // 2.75 per 1m (input : 1.1 / output : 4.4)
  'deepseek-ai/DeepSeek-V3': 'mid', // 1.25 per 1m 
  'llama-3.3-70b-versatile': 'low', //0.7 per 1m
  'gemini-2.0-flash': 'low', // free / 0.25 per 1m (input : 0.1 / output : 0.4)
  'deepseek-reasoner': 'low', // free
  'deepseek-chat': 'low', // free
};

// Create rate limiters for each category
const rateLimiters = Object.entries(rateLimits).reduce((acc, [category, limit]) => {
  acc[category] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit.requests, limit.window),
    analytics: true,
    prefix: `ratelimit:${category}`,
  });
  return acc;
}, {} as { [key: string]: Ratelimit });

// Function to get rate limiter for a specific model
export function getRateLimiter(model: string): Ratelimit {
  const category = modelRateLimitCategories[model] || 'low';
  return rateLimiters[category];
}

// Default rate limiter (for backward compatibility)
export const ratelimit = rateLimiters.low; 