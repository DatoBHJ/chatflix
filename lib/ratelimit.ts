import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { getModelById, RATE_LIMITS } from './models/config'
import { checkSubscription } from './polar'

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
  return window as Duration;
}

// Create level-based rate limiters
const levelRateLimiters = {
  level1: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level1.requests, parseWindow(RATE_LIMITS.level1.window)),
    analytics: true,
    prefix: 'ratelimit',  // Simplified prefix
  }),
  level2: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level2.requests, parseWindow(RATE_LIMITS.level2.window)),
    analytics: true,
    prefix: 'ratelimit',  // Simplified prefix
  }),
  level3: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level3.requests, parseWindow(RATE_LIMITS.level3.window)),
    analytics: true,
    prefix: 'ratelimit',  // Simplified prefix
  }),
  level4: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level4.requests, parseWindow(RATE_LIMITS.level4.window)),
    analytics: true,
    prefix: 'ratelimit',  // Simplified prefix
  }),
  level5: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level5.requests, parseWindow(RATE_LIMITS.level5.window)),
    analytics: true,
    prefix: 'ratelimit',  // Simplified prefix
  }),
};

// Function to check if a user has an active subscription (cached for 5 minutes)
const subscriptionCache = new Map<string, { isSubscribed: boolean, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function isUserSubscribed(userId: string): Promise<boolean> {
  // If no userId is provided, return false (not subscribed)
  if (!userId) return false;
  
  const now = Date.now();
  const cached = subscriptionCache.get(userId);
  
  // Return cached result if it's still valid
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.isSubscribed;
  }
  
  // Check subscription status
  try {
    const isSubscribed = await checkSubscription(userId);
    subscriptionCache.set(userId, { isSubscribed, timestamp: now });
    return isSubscribed;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    // In case of error, don't update the cache and:
    // 1. If we have a cached value, keep using it even if expired
    if (cached) {
      return cached.isSubscribed;
    }
    // 2. Otherwise, default to false but don't cache this result
    return false;
  }
}

// Function to get rate limiter for a specific model
export async function getRateLimiter(model: string, userId?: string): Promise<Ratelimit> {
  if (!model) {
    throw new Error('Model parameter is required');
  }

  const modelConfig = getModelById(model);
  if (!modelConfig) {
    throw new Error(`Model ${model} not found in configuration`);
  }
  
  // Check if user has an active subscription
  if (userId) {
    const isSubscribed = await isUserSubscribed(userId);
    if (isSubscribed) {
      // Create an unlimited rate limiter for subscribed users
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1000000, '1 d'), // Very high limit
        analytics: true,
        prefix: 'ratelimit',  // Simplified prefix
      });
    }
  }

  // Use level-based rate limiter for non-subscribed users
  const levelRateLimiter = levelRateLimiters[modelConfig.rateLimit.level];
  if (!levelRateLimiter) {
    throw new Error(`Rate limiter not initialized for level ${modelConfig.rateLimit.level}`);
  }
  
  return levelRateLimiter;
}

// Function to get the level-based rate limiter directly
export async function getLevelRateLimiter(level: 'level1' | 'level2' | 'level3' | 'level4' | 'level5', userId?: string): Promise<Ratelimit> {
  // If no userId is provided, use a default limiter without subscription check
  if (!userId) {
    const rateLimiter = levelRateLimiters[level];
    if (!rateLimiter) {
      throw new Error(`Rate limiter not initialized for level ${level}`);
    }
    return rateLimiter;
  }
  
  // Check if user has an active subscription
  const isSubscribed = await isUserSubscribed(userId);
  if (isSubscribed) {
    // Create an unlimited rate limiter for subscribed users
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000000, '1 d'), // Very high limit
      analytics: true,
      prefix: 'ratelimit',  // Simplified prefix
    });
  }
  
  const rateLimiter = levelRateLimiters[level];
  if (!rateLimiter) {
    throw new Error(`Rate limiter not initialized for level ${level}`);
  }
  return rateLimiter;
}

// Helper function to create a standardized rate limit key
export function createRateLimitKey(userId: string, level: string): string {
  return `user:${userId}:level:${level}`;
}