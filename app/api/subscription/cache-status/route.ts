import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { SubscriptionCache } from '@/lib/subscription-cache'

// Redis 캐시 상태 확인용 API (관리자/테스트 용도)
export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get cache statistics
    const cacheStats = await SubscriptionCache.getCacheStats()
    
    // Check current user's cache status
    const userCacheStatus = await SubscriptionCache.getStatus(user.id)
    const userCacheDetails = await SubscriptionCache.getDetails(user.id)
    const userHasOngoingRequest = await SubscriptionCache.hasOngoingRequest(user.id)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cacheStats,
      currentUser: {
        id: user.id,
        email: user.email,
        cacheStatus: userCacheStatus,
        hasOngoingRequest: userHasOngoingRequest,
        cacheDetails: userCacheDetails ? 'Present' : null
      }
    })
  } catch (error) {
    console.error('Error checking cache status:', error)
    return NextResponse.json(
      { error: 'Failed to check cache status', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// Redis 캐시 클리어용 API (관리자/테스트 용도)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const userId = url.searchParams.get('userId')

    if (action === 'clear-user' && userId) {
      // Clear specific user's cache
      await SubscriptionCache.clearUserCache(userId)
      return NextResponse.json({ 
        success: true, 
        message: `Cleared cache for user: ${userId}`,
        timestamp: new Date().toISOString()
      })
    } else if (action === 'clear-current') {
      // Clear current user's cache
      await SubscriptionCache.clearUserCache(user.id)
      return NextResponse.json({ 
        success: true, 
        message: `Cleared cache for current user: ${user.id}`,
        timestamp: new Date().toISOString()
      })
    } else if (action === 'clear-all') {
      // Clear all cache (admin only - be careful!)
      await SubscriptionCache.clearAllCache()
      return NextResponse.json({ 
        success: true, 
        message: 'Cleared all subscription cache',
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use: clear-user, clear-current, or clear-all' 
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}
