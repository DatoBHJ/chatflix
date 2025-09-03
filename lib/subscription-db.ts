import { createClient } from '@/utils/supabase/server'
import { SubscriptionCache } from '@/lib/subscription-cache'

// In-memory ongoing requests tracking (Redis는 Promise를 저장할 수 없으므로 메모리에 유지)
const ongoingDbRequests = new Map<string, Promise<boolean>>()

// Check subscription status from database first, fallback to Polar API
export async function checkSubscriptionFromDatabase(externalId: string): Promise<boolean> {
  try {
    // Check if there's an ongoing request for this user (메모리에서 확인)
    if (ongoingDbRequests.has(externalId)) {
      return await ongoingDbRequests.get(externalId)!
    }

    // Check if there's an ongoing request in Redis
    const hasOngoingRequest = await SubscriptionCache.hasOngoingRequest(externalId)
    if (hasOngoingRequest) {
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 100))
      const cachedResult = await SubscriptionCache.getStatus(externalId)
      if (cachedResult !== null) {
        return cachedResult
      }
    }

    // Check Redis cache first
    const cached = await SubscriptionCache.getStatus(externalId)
    if (cached !== null) {
      console.log('[subscription-db.ts]: Using Redis cached status for user:', externalId)
      return cached
    }

    // Set ongoing request lock in Redis
    await SubscriptionCache.setOngoingRequest(externalId)

    // Create promise for this request to prevent duplicate calls
    const requestPromise = performDatabaseSubscriptionCheck(externalId)
    ongoingDbRequests.set(externalId, requestPromise)

    try {
      const result = await requestPromise
      
      // Cache the result in Redis
      await SubscriptionCache.setStatus(externalId, result)
      
      console.log('[subscription-db.ts]: Cached subscription status in Redis for user:', externalId, 'status:', result)

      return result
    } finally {
      // Clean up ongoing request (both memory and Redis)
      ongoingDbRequests.delete(externalId)
      await SubscriptionCache.deleteOngoingRequest(externalId)
    }
  } catch (error) {
    console.error('[subscription-db.ts]: Error checking subscription from database:', error)
    // Clean up ongoing request on error
    await SubscriptionCache.deleteOngoingRequest(externalId)
    return false
  }
}

// Actual database check function
async function performDatabaseSubscriptionCheck(externalId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    // Use the database function to get subscription status
    const { data, error } = await supabase.rpc('get_user_subscription_status', {
      p_user_id: externalId
    })
    
    if (error) {
      console.error('Error getting subscription status from database:', error)
      // If database function doesn't exist or fails, fallback to Polar API
      return await fallbackToPolarAPI(externalId)
    }
    
    // If no data returned, user doesn't have subscription record
    if (!data || data.length === 0) {
      console.log('No subscription record found in database for user:', externalId)
      // Fallback to Polar API when no data in database
      return await fallbackToPolarAPI(externalId)
    }
    
    const subscription = data[0]
    let isActive = subscription.is_active
    
    // Check if subscription period has actually ended
    if (subscription.current_period_end) {
      const now = new Date()
      const periodEnd = new Date(subscription.current_period_end)
      const isPeriodEnded = now > periodEnd
      
      if (isPeriodEnded) {
        isActive = false
      } else {
        isActive = true
      }
    }
    

    
    return isActive
  } catch (error) {
    console.error('Error in performDatabaseSubscriptionCheck:', error)
    // Fallback to Polar API
    return await fallbackToPolarAPI(externalId)
  }
}

// Fallback to Polar API if database check fails
async function fallbackToPolarAPI(externalId: string): Promise<boolean> {
  console.log('Falling back to Polar API for user:', externalId)
  
  try {
    const { checkSubscription } = await import('@/lib/polar')
    const result = await checkSubscription(externalId)
    
    // If we got a result from Polar API, update the database
    if (result) {
      await updateDatabaseFromPolarAPI(externalId, true)
    }
    
    return result
  } catch (error) {
    console.error('Error in fallbackToPolarAPI:', error)
    return false
  }
}

// Update database with data from Polar API
async function updateDatabaseFromPolarAPI(externalId: string, isActive: boolean) {
  try {
    const supabase = await createClient()
    
    // Use the database function to update subscription data
    const { error } = await supabase.rpc('upsert_user_subscription', {
      p_user_id: externalId,
      p_is_active: isActive,
      p_subscription_id: null,
      p_customer_id: null,
      p_product_id: null,
      p_status: isActive ? 'active' : 'inactive',
      p_current_period_start: null,
      p_current_period_end: null,
      p_event_type: 'api_fallback'
    })
    
    if (error) {
      console.error('Error updating database from Polar API:', error)
    } else {
      console.log('Database updated from Polar API for user:', externalId)
    }
  } catch (error) {
    console.error('Error in updateDatabaseFromPolarAPI:', error)
  }
}

// Clear database cache for specific user (used by webhooks)
export async function clearDatabaseSubscriptionCache(externalId: string) {
  // Clear Redis cache
  await SubscriptionCache.clearUserCache(externalId)
  
  // Clear memory cache
  ongoingDbRequests.delete(externalId)
  
  console.log('🗑️ Cleared database subscription cache (Redis + Memory) for user:', externalId)
}

// Clear all database cache
export async function clearAllDatabaseSubscriptionCache() {
  // Clear Redis cache
  await SubscriptionCache.clearAllCache()
  
  // Clear memory cache
  ongoingDbRequests.clear()
  
  console.log('🗑️ Cleared all database subscription cache (Redis + Memory)')
}

// Get detailed subscription information from database
export async function getSubscriptionDetails(externalId: string) {
  try {
    // Check Redis cache first
    const cached = await SubscriptionCache.getDetails(externalId)
    if (cached !== null) {
      console.log('[subscription-db.ts]: Using Redis cached details for user:', externalId)
      return cached
    }

    const supabase = await createClient()
    
    const { data, error } = await supabase.rpc('get_user_subscription_status', {
      p_user_id: externalId
    })
    
    if (error) {
      console.error('Error getting subscription details:', error)
      return null
    }
    
    const result = data && data.length > 0 ? data[0] : null
    
    // Cache the result in Redis if we got data
    if (result) {
      await SubscriptionCache.setDetails(externalId, result)
      console.log('[subscription-db.ts]: Cached subscription details in Redis for user:', externalId)
    }
    
    return result
  } catch (error) {
    console.error('Error in getSubscriptionDetails:', error)
    return null
  }
}

// Get subscription events for audit trail
export async function getSubscriptionEvents(externalId: string, limit: number = 10) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('user_id', externalId)
      .order('processed_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error getting subscription events:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getSubscriptionEvents:', error)
    return []
  }
}
