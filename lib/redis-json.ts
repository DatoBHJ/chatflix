import { redis } from './ratelimit'

/**
 * Safely parse JSON payloads persisted in Redis.
 */
export async function getCachedJSON<T>(key: string): Promise<T | null> {
  const raw = await redis.get<string>(key)
  if (raw === null || raw === undefined) {
    return null
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch (error) {
      console.warn(`[redis-json] Failed to parse value for key ${key}:`, error)
      return null
    }
  }

  return raw as T
}

/**
 * Stringify and persist JSON payloads into Redis with optional TTL (seconds).
 */
export async function setCachedJSON(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  const payload = JSON.stringify(value)

  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, payload, { ex: ttlSeconds })
    return
  }

  await redis.set(key, payload)
}

