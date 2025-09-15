// Only import redis on server side
let redis: any = null;

// Initialize redis only on server side
if (typeof window === 'undefined') {
  try {
    const { redis: redisClient } = require('@/lib/ratelimit');
    redis = redisClient;
  } catch (error) {
    console.warn('Redis not available on server side:', error);
  }
}

/**
 * User Name Cache class for managing user name caching with Upstash Redis
 */
export class UserNameCache {
  private static readonly USER_NAME_PREFIX = 'user_name:';
  private static readonly ONGOING_REQUEST_PREFIX = 'user_name_request:';
  private static readonly TTL_SECONDS = 30 * 60; // 30 minutes
  private static readonly REQUEST_LOCK_TTL = 30; // 30 seconds for ongoing requests

  /**
   * Get cached user name
   */
  static async getName(userId: string): Promise<string | null> {
    if (typeof window !== 'undefined' || !redis) {
      return null;
    }
    
    try {
      const key = `${this.USER_NAME_PREFIX}${userId}`;
      const cachedName = await redis.get(key);
      return cachedName;
    } catch (error) {
      console.error('[UserNameCache.getName]: Error getting cached user name:', error);
      return null;
    }
  }

  /**
   * Set cached user name with TTL
   */
  static async setName(userId: string, userName: string): Promise<void> {
    if (typeof window !== 'undefined' || !redis) {
      return;
    }
    
    try {
      const key = `${this.USER_NAME_PREFIX}${userId}`;
      await redis.setex(key, this.TTL_SECONDS, userName);
      console.log(`[UserNameCache.setName]: Cached user name for ${userId}: ${userName}`);
    } catch (error) {
      console.error('[UserNameCache.setName]: Error setting cached user name:', error);
    }
  }

  /**
   * Delete cached user name
   */
  static async deleteName(userId: string): Promise<void> {
    if (typeof window !== 'undefined' || !redis) {
      return;
    }
    
    try {
      const key = `${this.USER_NAME_PREFIX}${userId}`;
      await redis.del(key);
      console.log(`[UserNameCache.deleteName]: Deleted cached user name for ${userId}`);
    } catch (error) {
      console.error('[UserNameCache.deleteName]: Error deleting cached user name:', error);
    }
  }

  /**
   * Check if there's an ongoing request for this user
   */
  static async hasOngoingRequest(userId: string): Promise<boolean> {
    if (typeof window !== 'undefined' || !redis) {
      return false;
    }
    
    try {
      const key = `${this.ONGOING_REQUEST_PREFIX}${userId}`;
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('[UserNameCache.hasOngoingRequest]: Error checking ongoing request:', error);
      return false;
    }
  }

  /**
   * Set ongoing request lock
   */
  static async setOngoingRequest(userId: string): Promise<void> {
    if (typeof window !== 'undefined' || !redis) {
      return;
    }
    
    try {
      const key = `${this.ONGOING_REQUEST_PREFIX}${userId}`;
      await redis.setex(key, this.REQUEST_LOCK_TTL, 'true');
    } catch (error) {
      console.error('[UserNameCache.setOngoingRequest]: Error setting ongoing request:', error);
    }
  }

  /**
   * Delete ongoing request lock
   */
  static async deleteOngoingRequest(userId: string): Promise<void> {
    if (typeof window !== 'undefined' || !redis) {
      return;
    }
    
    try {
      const key = `${this.ONGOING_REQUEST_PREFIX}${userId}`;
      await redis.del(key);
    } catch (error) {
      console.error('[UserNameCache.deleteOngoingRequest]: Error deleting ongoing request:', error);
    }
  }

  /**
   * Clear all cache entries for a specific user
   */
  static async clearUserCache(userId: string): Promise<void> {
    if (typeof window !== 'undefined' || !redis) {
      return;
    }
    
    try {
      await Promise.all([
        this.deleteName(userId),
        this.deleteOngoingRequest(userId)
      ]);
      console.log(`[UserNameCache.clearUserCache]: Cleared all cache for user ${userId}`);
    } catch (error) {
      console.error('[UserNameCache.clearUserCache]: Error clearing user cache:', error);
    }
  }

  /**
   * Clear all cache entries (admin function)
   */
  static async clearAllCache(): Promise<void> {
    if (typeof window !== 'undefined' || !redis) {
      return;
    }
    
    try {
      // Get all user name keys
      const nameKeys = await redis.keys(`${this.USER_NAME_PREFIX}*`);
      const requestKeys = await redis.keys(`${this.ONGOING_REQUEST_PREFIX}*`);
      
      const allKeys = [...nameKeys, ...requestKeys];
      
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
        console.log(`[UserNameCache.clearAllCache]: Cleared ${allKeys.length} cache entries`);
      }
    } catch (error) {
      console.error('[UserNameCache.clearAllCache]: Error clearing all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalUserNames: number;
    totalOngoingRequests: number;
    userNameKeys: string[];
    ongoingRequestKeys: string[];
  }> {
    if (typeof window !== 'undefined' || !redis) {
      return {
        totalUserNames: 0,
        totalOngoingRequests: 0,
        userNameKeys: [],
        ongoingRequestKeys: []
      };
    }
    
    try {
      const nameKeys = await redis.keys(`${this.USER_NAME_PREFIX}*`);
      const requestKeys = await redis.keys(`${this.ONGOING_REQUEST_PREFIX}*`);
      
      return {
        totalUserNames: nameKeys.length,
        totalOngoingRequests: requestKeys.length,
        userNameKeys: nameKeys,
        ongoingRequestKeys: requestKeys
      };
    } catch (error) {
      console.error('[UserNameCache.getCacheStats]: Error getting cache stats:', error);
      return {
        totalUserNames: 0,
        totalOngoingRequests: 0,
        userNameKeys: [],
        ongoingRequestKeys: []
      };
    }
  }
}

/**
 * Get cached user name or fetch from database if not cached
 */
export async function getCachedUserName(
  userId: string, 
  fetchFunction: (userId: string) => Promise<string>
): Promise<string> {
  // If running on client side, just call the fetch function directly
  if (typeof window !== 'undefined') {
    return await fetchFunction(userId);
  }

  try {
    // Check if there's already an ongoing request for this user
    const hasOngoing = await UserNameCache.hasOngoingRequest(userId);
    if (hasOngoing) {
      console.log(`[getCachedUserName]: Ongoing request detected for ${userId}, waiting...`);
      // Wait a bit and try to get from cache
      await new Promise(resolve => setTimeout(resolve, 100));
      const cachedAfterWait = await UserNameCache.getName(userId);
      if (cachedAfterWait) {
        return cachedAfterWait;
      }
      // If still no cache, proceed with fetch
    }

    // Try to get from cache first
    const cachedName = await UserNameCache.getName(userId);
    if (cachedName) {
      console.log(`[getCachedUserName]: Cache hit for ${userId}: ${cachedName}`);
      return cachedName;
    }

    console.log(`[getCachedUserName]: Cache miss for ${userId}, fetching from database...`);
    
    // Set ongoing request lock
    await UserNameCache.setOngoingRequest(userId);

    try {
      // Fetch from database
      const userName = await fetchFunction(userId);
      
      // Cache the result
      await UserNameCache.setName(userId, userName);
      
      console.log(`[getCachedUserName]: Fetched and cached user name for ${userId}: ${userName}`);
      return userName;
    } finally {
      // Always clear the ongoing request lock
      await UserNameCache.deleteOngoingRequest(userId);
    }
  } catch (error) {
    console.error('[getCachedUserName]: Error in cached user name fetch:', error);
    // Fallback to direct fetch
    return await fetchFunction(userId);
  }
}

/**
 * Invalidate user name cache for a specific user
 */
export function invalidateUserNameCache(userId: string): void {
  if (typeof window !== 'undefined') {
    return;
  }
  
  UserNameCache.clearUserCache(userId).catch(error => {
    console.error('[invalidateUserNameCache]: Error clearing cache:', error);
  });
}