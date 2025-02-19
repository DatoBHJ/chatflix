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

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 m'),
  analytics: true,
}) 