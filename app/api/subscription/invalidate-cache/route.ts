import { createClient } from '@/utils/supabase/server'
import { clearAllDatabaseSubscriptionCache } from '@/lib/subscription-db'
import { clearSubscriptionCache } from '@/lib/polar'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // Get current user for authorization
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Only authenticated users can invalidate cache
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    // Clear all server-side caches (updated for Redis)
    await clearAllDatabaseSubscriptionCache()
    await clearSubscriptionCache()
    
    console.log(`🔄 Server subscription caches invalidated by user: ${user.id}`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Server caches invalidated successfully'
    })
  } catch (error) {
    console.error('Error invalidating server caches:', error)
    return NextResponse.json(
      { error: 'Failed to invalidate server caches' }, 
      { status: 500 }
    )
  }
}
