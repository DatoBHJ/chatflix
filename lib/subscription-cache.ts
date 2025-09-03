import { redis } from '@/lib/ratelimit'

// Redis keys for subscription caching
const SUBSCRIPTION_CACHE_PREFIX = 'subscription:status:'
const SUBSCRIPTION_ONGOING_PREFIX = 'subscription:ongoing:'
const SUBSCRIPTION_DETAILS_PREFIX = 'subscription:details:'

// Cache TTL settings
const SUBSCRIPTION_CACHE_TTL = 5 * 60 // 5분 (초 단위)
const ONGOING_REQUEST_TTL = 30 // 30초 (진행중인 요청 잠금)

// Redis-based subscription cache utilities
export class SubscriptionCache {
  
  /**
   * Get subscription status from Redis cache
   */
  static async getStatus(externalId: string): Promise<boolean | null> {
    try {
      const key = `${SUBSCRIPTION_CACHE_PREFIX}${externalId}`
      const cached = await redis.get(key)
      
      if (cached === null || cached === undefined) {
        return null
      }
      
      // Redis에서 문자열로 저장되므로 boolean으로 변환
      return cached === 'true' || cached === true
    } catch (error) {
      console.error('[SubscriptionCache] Error getting status from Redis:', error)
      return null
    }
  }
  
  /**
   * Set subscription status in Redis cache
   */
  static async setStatus(externalId: string, status: boolean): Promise<void> {
    try {
      const key = `${SUBSCRIPTION_CACHE_PREFIX}${externalId}`
      await redis.setex(key, SUBSCRIPTION_CACHE_TTL, status.toString())
    } catch (error) {
      console.error('[SubscriptionCache] Error setting status in Redis:', error)
      // 캐시 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }
  
  /**
   * Delete subscription status from Redis cache
   */
  static async deleteStatus(externalId: string): Promise<void> {
    try {
      const key = `${SUBSCRIPTION_CACHE_PREFIX}${externalId}`
      await redis.del(key)
      console.log('🗑️ Cleared Redis subscription status cache for user:', externalId)
    } catch (error) {
      console.error('[SubscriptionCache] Error deleting status from Redis:', error)
    }
  }
  
  /**
   * Check if there's an ongoing request for this user
   */
  static async hasOngoingRequest(externalId: string): Promise<boolean> {
    try {
      const key = `${SUBSCRIPTION_ONGOING_PREFIX}${externalId}`
      const exists = await redis.exists(key)
      return exists === 1
    } catch (error) {
      console.error('[SubscriptionCache] Error checking ongoing request:', error)
      return false
    }
  }
  
  /**
   * Set ongoing request lock with TTL
   */
  static async setOngoingRequest(externalId: string): Promise<void> {
    try {
      const key = `${SUBSCRIPTION_ONGOING_PREFIX}${externalId}`
      await redis.setex(key, ONGOING_REQUEST_TTL, 'true')
    } catch (error) {
      console.error('[SubscriptionCache] Error setting ongoing request lock:', error)
      // 락 설정 실패도 치명적이지 않으므로 에러를 던지지 않음
    }
  }
  
  /**
   * Delete ongoing request lock
   */
  static async deleteOngoingRequest(externalId: string): Promise<void> {
    try {
      const key = `${SUBSCRIPTION_ONGOING_PREFIX}${externalId}`
      await redis.del(key)
    } catch (error) {
      console.error('[SubscriptionCache] Error deleting ongoing request lock:', error)
    }
  }
  
  /**
   * Get detailed subscription information from cache
   */
  static async getDetails(externalId: string): Promise<any | null> {
    try {
      const key = `${SUBSCRIPTION_DETAILS_PREFIX}${externalId}`
      const cached = await redis.get(key)
      
      if (cached === null || cached === undefined) {
        return null
      }
      
      if (typeof cached === 'string') {
        return JSON.parse(cached)
      }
      
      return cached
    } catch (error) {
      console.error('[SubscriptionCache] Error getting details from Redis:', error)
      return null
    }
  }
  
  /**
   * Set detailed subscription information in cache
   */
  static async setDetails(externalId: string, details: any): Promise<void> {
    try {
      const key = `${SUBSCRIPTION_DETAILS_PREFIX}${externalId}`
      const value = typeof details === 'string' ? details : JSON.stringify(details)
      await redis.setex(key, SUBSCRIPTION_CACHE_TTL, value)
    } catch (error) {
      console.error('[SubscriptionCache] Error setting details in Redis:', error)
    }
  }
  
  /**
   * Delete detailed subscription information from cache
   */
  static async deleteDetails(externalId: string): Promise<void> {
    try {
      const key = `${SUBSCRIPTION_DETAILS_PREFIX}${externalId}`
      await redis.del(key)
    } catch (error) {
      console.error('[SubscriptionCache] Error deleting details from Redis:', error)
    }
  }
  
  /**
   * Clear all subscription cache data for a user (used by webhooks)
   */
  static async clearUserCache(externalId: string): Promise<void> {
    try {
      await Promise.all([
        this.deleteStatus(externalId),
        this.deleteOngoingRequest(externalId),
        this.deleteDetails(externalId)
      ])
      console.log('🗑️ Cleared all Redis subscription cache for user:', externalId)
    } catch (error) {
      console.error('[SubscriptionCache] Error clearing user cache:', error)
    }
  }
  
  /**
   * Clear all subscription cache (admin function)
   */
  static async clearAllCache(): Promise<void> {
    try {
      // Redis scan으로 관련 키들을 찾아서 삭제
      const prefixes = [
        SUBSCRIPTION_CACHE_PREFIX,
        SUBSCRIPTION_ONGOING_PREFIX,
        SUBSCRIPTION_DETAILS_PREFIX
      ]
      
      for (const prefix of prefixes) {
        const keys = await redis.keys(`${prefix}*`)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      }
      
      console.log('🗑️ Cleared all Redis subscription cache')
    } catch (error) {
      console.error('[SubscriptionCache] Error clearing all cache:', error)
    }
  }
  
  /**
   * Get cache statistics (for monitoring)
   */
  static async getCacheStats(): Promise<{
    statusCacheCount: number
    ongoingRequestCount: number
    detailsCacheCount: number
  }> {
    try {
      const [statusKeys, ongoingKeys, detailsKeys] = await Promise.all([
        redis.keys(`${SUBSCRIPTION_CACHE_PREFIX}*`),
        redis.keys(`${SUBSCRIPTION_ONGOING_PREFIX}*`),
        redis.keys(`${SUBSCRIPTION_DETAILS_PREFIX}*`)
      ])
      
      return {
        statusCacheCount: statusKeys.length,
        ongoingRequestCount: ongoingKeys.length,
        detailsCacheCount: detailsKeys.length
      }
    } catch (error) {
      console.error('[SubscriptionCache] Error getting cache stats:', error)
      return {
        statusCacheCount: 0,
        ongoingRequestCount: 0,
        detailsCacheCount: 0
      }
    }
  }
}

// Legacy support - 기존 코드와의 호환성을 위한 함수들
export async function getSubscriptionStatusFromCache(externalId: string): Promise<boolean | null> {
  return SubscriptionCache.getStatus(externalId)
}

export async function setSubscriptionStatusCache(externalId: string, status: boolean): Promise<void> {
  return SubscriptionCache.setStatus(externalId, status)
}

export async function clearSubscriptionStatusCache(externalId: string): Promise<void> {
  return SubscriptionCache.deleteStatus(externalId)
}

export async function clearAllSubscriptionCache(): Promise<void> {
  return SubscriptionCache.clearAllCache()
}
