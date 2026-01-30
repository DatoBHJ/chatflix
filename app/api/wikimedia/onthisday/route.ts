import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/ratelimit';

/**
 * Wikimedia On This Day API proxy route
 * Fetches historical events from Wikimedia API for a given date
 * Uses dual caching (memory + Redis) to ensure all users see the same data for the same UTC date
 * and to minimize external API calls (once per day per date)
 */

// Cache key prefixes
const CACHE_PREFIX = 'onthisday:';
const ONGOING_PREFIX = 'onthisday:ongoing:';

// TTL settings
const ONGOING_REQUEST_TTL = 30; // 30 seconds for ongoing request lock

/**
 * Memory cache structure (in-memory cache for fast access)
 */
interface CachedData {
  data: any;
  expiresAt: number; // UTC timestamp (next day midnight)
}

// In-memory cache (per-instance)
const memoryCache = new Map<string, CachedData>();

/**
 * Get UTC date string in YYYY-MM-DD format
 */
function getUTCDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Calculate TTL until next day midnight UTC (in seconds)
 */
function getTTLUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const secondsUntilMidnight = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
  // Ensure at least 1 minute TTL
  return Math.max(secondsUntilMidnight, 60);
}

/**
 * Get expiration timestamp (UTC) for next day midnight
 */
function getExpiresAtTimestamp(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * Generate cache key for the given date, language, and type
 */
function getCacheKey(date: string, language: string, type: string): string {
  return `${CACHE_PREFIX}${date}:${language}:${type}`;
}

/**
 * Generate ongoing request lock key
 */
function getOngoingKey(date: string, language: string, type: string): string {
  return `${ONGOING_PREFIX}${date}:${language}:${type}`;
}

/**
 * Get Cache-Control headers for browser caching
 */
function getCacheControlHeaders(): { headers: { 'Cache-Control': string } } {
  const ttl = getTTLUntilMidnightUTC();
  return {
    headers: {
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=86400`
    }
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Get parameters with defaults
    const language = searchParams.get('language') || 'en';
    const type = searchParams.get('type') || 'selected';
    const month = searchParams.get('month');
    const day = searchParams.get('day');
    
    // Validate type
    const validTypes = ['all', 'selected', 'births', 'deaths', 'holidays', 'events'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get date for caching (UTC based)
    let dateStr: string;
    let monthValue: string;
    let dayValue: string;
    
    if (month && day) {
      // Use provided month/day (for querying specific dates)
      monthValue = month.padStart(2, '0');
      dayValue = day.padStart(2, '0');
      // Use current year + provided month/day for cache key
      // This ensures same date queries are cached together
      const today = new Date();
      const year = today.getUTCFullYear();
      dateStr = `${year}-${monthValue}-${dayValue}`;
    } else {
      // Use UTC today
      const today = new Date();
      dateStr = getUTCDateString();
      monthValue = String(today.getUTCMonth() + 1).padStart(2, '0');
      dayValue = String(today.getUTCDate()).padStart(2, '0');
    }
    
    // Validate month and day ranges
    const monthNum = parseInt(monthValue, 10);
    const dayNum = parseInt(dayValue, 10);
    
    if (monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Invalid month. Must be between 01 and 12' },
        { status: 400 }
      );
    }
    
    if (dayNum < 1 || dayNum > 31) {
      return NextResponse.json(
        { error: 'Invalid day. Must be between 01 and 31' },
        { status: 400 }
      );
    }
    
    // Generate cache keys
    const cacheKey = getCacheKey(dateStr, language, type);
    const ongoingKey = getOngoingKey(dateStr, language, type);
    
    // Step 1: Check memory cache first (fastest)
    const now = Date.now();
    const memoryCached = memoryCache.get(cacheKey);
    if (memoryCached && memoryCached.expiresAt > now) {
      // Memory cache hit - return immediately
      return NextResponse.json(memoryCached.data, getCacheControlHeaders());
    }
    
    // Step 2: Check Redis cache (memory miss)
    try {
      const cachedDataStr = await redis.get(cacheKey);
      if (cachedDataStr !== null && cachedDataStr !== undefined) {
        // Redis cache hit - parse and store in memory cache
        try {
          const cachedData = typeof cachedDataStr === 'string' 
            ? JSON.parse(cachedDataStr) 
            : cachedDataStr;
          
          // Store in memory cache for future requests
          const expiresAt = getExpiresAtTimestamp();
          memoryCache.set(cacheKey, { data: cachedData, expiresAt });
          
          return NextResponse.json(cachedData, getCacheControlHeaders());
        } catch (parseError) {
          console.error('[OnThisDay] Error parsing cached data:', parseError);
          // If parsing fails, continue to API call
        }
      }
    } catch (error) {
      console.error('[OnThisDay] Error getting from Redis cache:', error);
      // Continue to API call if cache read fails
    }
    
    // Cache miss - check if there's an ongoing request
    try {
      const hasOngoing = await redis.exists(ongoingKey);
      if (hasOngoing === 1) {
        // Another request is fetching this data, wait and retry
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        
        // Retry cache lookup (check memory first, then Redis)
        const retryMemoryCached = memoryCache.get(cacheKey);
        if (retryMemoryCached && retryMemoryCached.expiresAt > Date.now()) {
          return NextResponse.json(retryMemoryCached.data, getCacheControlHeaders());
        }
        
        const retryCachedDataStr = await redis.get(cacheKey);
        if (retryCachedDataStr !== null && retryCachedDataStr !== undefined) {
          try {
            const retryCachedData = typeof retryCachedDataStr === 'string'
              ? JSON.parse(retryCachedDataStr)
              : retryCachedDataStr;
            
            // Store in memory cache
            const expiresAt = getExpiresAtTimestamp();
            memoryCache.set(cacheKey, { data: retryCachedData, expiresAt });
            
            return NextResponse.json(retryCachedData, getCacheControlHeaders());
          } catch (parseError) {
            // If parsing fails, continue
          }
        }
        
        // If still not cached, wait a bit more and retry once more
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s more
        
        // Final retry (check memory first, then Redis)
        const finalMemoryCached = memoryCache.get(cacheKey);
        if (finalMemoryCached && finalMemoryCached.expiresAt > Date.now()) {
          return NextResponse.json(finalMemoryCached.data, getCacheControlHeaders());
        }
        
        const finalCachedDataStr = await redis.get(cacheKey);
        if (finalCachedDataStr !== null && finalCachedDataStr !== undefined) {
          try {
            const finalCachedData = typeof finalCachedDataStr === 'string'
              ? JSON.parse(finalCachedDataStr)
              : finalCachedDataStr;
            
            // Store in memory cache
            const expiresAt = getExpiresAtTimestamp();
            memoryCache.set(cacheKey, { data: finalCachedData, expiresAt });
            
            return NextResponse.json(finalCachedData, getCacheControlHeaders());
          } catch (parseError) {
            // If parsing fails, continue
          }
        }
      }
    } catch (error) {
      console.error('[OnThisDay] Error checking ongoing request:', error);
      // Continue to API call if lock check fails
    }
    
    // Set ongoing request lock
    try {
      await redis.setex(ongoingKey, ONGOING_REQUEST_TTL, 'true');
    } catch (error) {
      console.error('[OnThisDay] Error setting ongoing request lock:', error);
      // Continue even if lock setting fails
    }
    
    // Build Wikimedia API URL
    const apiUrl = `https://api.wikimedia.org/feed/v1/wikipedia/${language}/onthisday/${type}/${monthValue}/${dayValue}`;
    
    // Fetch from Wikimedia API
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'ChatApp/1.0 (https://chatflix.app)',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      // Clean up ongoing lock on error
      try {
        await redis.del(ongoingKey);
      } catch (error) {
        // Ignore cleanup errors
      }
      
      // Handle different error statuses
      if (response.status === 400) {
        return NextResponse.json(
          { error: 'Invalid parameter provided to Wikimedia API' },
          { status: 400 }
        );
      }
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'No data found for the requested date' },
          { status: 404 }
        );
      }
      
      if (response.status === 501) {
        return NextResponse.json(
          { error: 'Unsupported language' },
          { status: 501 }
        );
      }
      
      return NextResponse.json(
        { error: `Wikimedia API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Store in both memory and Redis cache
    const expiresAt = getExpiresAtTimestamp();
    const ttl = getTTLUntilMidnightUTC();
    
    // Store in memory cache (immediate)
    memoryCache.set(cacheKey, { data, expiresAt });
    
    // Store in Redis cache with TTL until next day midnight UTC
    try {
      await redis.setex(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('[OnThisDay] Error storing in Redis cache:', error);
      // Continue even if cache storage fails
    }
    
    // Clean up ongoing lock
    try {
      await redis.del(ongoingKey);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Return the data
    return NextResponse.json(data, getCacheControlHeaders());
    
  } catch (error: any) {
    console.error('Error fetching On This Day data:', error);
    
    // Handle timeout errors
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout. Please try again.' },
        { status: 408 }
      );
    }
    
    // Handle fetch errors
    if (error.message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to fetch data from Wikimedia API' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



