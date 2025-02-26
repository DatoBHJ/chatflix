import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { MODEL_CONFIGS, getModelById } from './models/config'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_* environment variables are not set')
}

// Create a new Redis instance
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

type Duration = `${number} ms` | `${number} s` | `${number} m` | `${number} h` | `${number} d`;

// Helper function to parse window string into Duration format
function parseWindow(window: string): Duration {
  // Expected format: "60 m" or similar
  const [value, unit] = window.split(' ');
  return `${value} ${unit}` as Duration;
}

// Create individual rate limiters for each model
const modelRateLimiters = MODEL_CONFIGS.reduce((acc, model) => {
  acc[model.id] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      model.rateLimit.requests,
      parseWindow(model.rateLimit.window)
    ),
    analytics: true,
    prefix: `ratelimit:model:${model.id}`,
  });
  return acc;
}, {} as { [key: string]: Ratelimit });

// Function to get rate limiter for a specific model
export function getRateLimiter(model: string): Ratelimit {
  if (!model) {
    throw new Error('Model parameter is required');
  }

  const modelConfig = getModelById(model);
  if (!modelConfig) {
    throw new Error(`Model ${model} not found in configuration`);
  }

  const rateLimiter = modelRateLimiters[model];
  if (!rateLimiter) {
    throw new Error(`Rate limiter not initialized for model ${model}`);
  }

  return rateLimiter;
}