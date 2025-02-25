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

  const modelConfig = getModelById(model);
  if (!modelConfig) {
    // For unknown models, create a new rate limiter with 'low' category limits
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 m'), // Default to low category limits
      analytics: true,
      prefix: `ratelimit:model:${model}`,
    });
  }

  return modelRateLimiters[model];
}

// Default rate limiter (for backward compatibility)
export const ratelimit = getRateLimiter('default');