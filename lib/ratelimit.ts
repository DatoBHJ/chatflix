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

// Create level-based rate limiters for hourly limits
const hourlyRateLimiters = {
  level0: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level0.hourly.requests, parseWindow(RATE_LIMITS.level0.hourly.window)),
    analytics: true,
    prefix: 'ratelimit:hourly',
  }),
  level1: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level1.hourly.requests, parseWindow(RATE_LIMITS.level1.hourly.window)),
    analytics: true,
    prefix: 'ratelimit:hourly',
  }),
  level2: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level2.hourly.requests, parseWindow(RATE_LIMITS.level2.hourly.window)),
    analytics: true,
    prefix: 'ratelimit:hourly',
  }),
  level3: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level3.hourly.requests, parseWindow(RATE_LIMITS.level3.hourly.window)),
    analytics: true,
    prefix: 'ratelimit:hourly',
  }),
  level4: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level4.hourly.requests, parseWindow(RATE_LIMITS.level4.hourly.window)),
    analytics: true,
    prefix: 'ratelimit:hourly',
  }),
  level5: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level5.hourly.requests, parseWindow(RATE_LIMITS.level5.hourly.window)),
    analytics: true,
    prefix: 'ratelimit:hourly',
  }),
};

// Create level-based rate limiters for daily limits
const dailyRateLimiters = {
  level0: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level0.daily.requests, parseWindow(RATE_LIMITS.level0.daily.window)),
    analytics: true,
    prefix: 'ratelimit:daily',
  }),
  level1: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level1.daily.requests, parseWindow(RATE_LIMITS.level1.daily.window)),
    analytics: true,
    prefix: 'ratelimit:daily',
  }),
  level2: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level2.daily.requests, parseWindow(RATE_LIMITS.level2.daily.window)),
    analytics: true,
    prefix: 'ratelimit:daily',
  }),
  level3: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level3.daily.requests, parseWindow(RATE_LIMITS.level3.daily.window)),
    analytics: true,
    prefix: 'ratelimit:daily',
  }),
  level4: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level4.daily.requests, parseWindow(RATE_LIMITS.level4.daily.window)),
    analytics: true,
    prefix: 'ratelimit:daily',
  }),
  level5: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.level5.daily.requests, parseWindow(RATE_LIMITS.level5.daily.window)),
    analytics: true,
    prefix: 'ratelimit:daily',
  }),
};

// Create level-based rate limiters for subscriber hourly limits
// const subscriberHourlyRateLimiters = {
//   level1: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level1.hourly.requests, parseWindow(RATE_LIMITS.subscriber_limits.level1.hourly.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:hourly',
//   }),
//   level2: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level2.hourly.requests, parseWindow(RATE_LIMITS.subscriber_limits.level2.hourly.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:hourly',
//   }),
//   level3: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level3.hourly.requests, parseWindow(RATE_LIMITS.subscriber_limits.level3.hourly.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:hourly',
//   }),
//   level4: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level4.hourly.requests, parseWindow(RATE_LIMITS.subscriber_limits.level4.hourly.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:hourly',
//   }),
//   level5: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level5.hourly.requests, parseWindow(RATE_LIMITS.subscriber_limits.level5.hourly.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:hourly',
//   }),
// };

// // Create level-based rate limiters for subscriber daily limits
// const subscriberDailyRateLimiters = {
//   level1: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level1.daily.requests, parseWindow(RATE_LIMITS.subscriber_limits.level1.daily.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:daily',
//   }),
//   level2: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level2.daily.requests, parseWindow(RATE_LIMITS.subscriber_limits.level2.daily.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:daily',
//   }),
//   level3: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level3.daily.requests, parseWindow(RATE_LIMITS.subscriber_limits.level3.daily.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:daily',
//   }),
//   level4: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level4.daily.requests, parseWindow(RATE_LIMITS.subscriber_limits.level4.daily.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:daily',
//   }),
//   level5: new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(RATE_LIMITS.subscriber_limits.level5.daily.requests, parseWindow(RATE_LIMITS.subscriber_limits.level5.daily.window)),
//     analytics: true,
//     prefix: 'ratelimit:subscriber:daily',
//   }),
// };

// Function to check if a user has an active subscription (cached for 5 minutes)
const subscriptionCache = new Map<string, { isSubscribed: boolean, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function isUserSubscribed(userId: string, email: string): Promise<boolean> {
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
    const isSubscribed = await checkSubscription(userId, email);
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
export async function getRateLimiter(model: string, userId?: string, email?: string): Promise<{hourly: Ratelimit, daily: Ratelimit}> {
  if (!model) {
    throw new Error('Model parameter is required');
  }

  const modelConfig = getModelById(model);
  if (!modelConfig) {
    throw new Error(`Model ${model} not found in configuration`);
  }
  
  // Check if user has an active subscription
  if (userId) {
    const isSubscribed = await isUserSubscribed(userId, email || '');
    if (isSubscribed) {
      const unlimitedLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1000000, '1 d'),
        analytics: true,
        prefix: 'ratelimit',
      });
      // Use subscriber rate limiters instead of unlimited
      // const level = modelConfig.rateLimit.level;
      // const subscriberHourlyRateLimiter = subscriberHourlyRateLimiters[level];
      // const subscriberDailyRateLimiter = subscriberDailyRateLimiters[level];
      
      // if (!subscriberHourlyRateLimiter || !subscriberDailyRateLimiter) {
      //   throw new Error(`Subscriber rate limiter not initialized for level ${level}`);
      // }
      
      return {
        hourly: unlimitedLimiter,
        daily: unlimitedLimiter
        // hourly: subscriberHourlyRateLimiter,
        // daily: subscriberDailyRateLimiter
      };
    }
  }

  // Use level-based rate limiters for non-subscribed users
  const level = modelConfig.rateLimit.level;
  const hourlyRateLimiter = hourlyRateLimiters[level];
  const dailyRateLimiter = dailyRateLimiters[level];
  
  if (!hourlyRateLimiter || !dailyRateLimiter) {
    throw new Error(`Rate limiter not initialized for level ${level}`);
  }
  
  return {
    hourly: hourlyRateLimiter,
    daily: dailyRateLimiter
  };
}

// Helper function to create standardized rate limit keys
export function createRateLimitKey(userId: string, level: string, type: 'hourly' | 'daily' = 'hourly', isSubscriber: boolean = false): string {
  const prefix = isSubscriber ? 'subscriber:' : '';
  return `user:${userId}:${prefix}level:${level}:${type}`;
}