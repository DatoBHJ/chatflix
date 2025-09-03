import { createClient } from '@/utils/supabase/server'
import { getSubscriptionDetails, getSubscriptionEvents } from '@/lib/subscription-db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // 🚀 익명 사용자 지원: 익명 사용자는 기본 정보 반환
    if (userError || !user) {
      console.log('Anonymous user or auth error - returning basic info');
      return NextResponse.json({ 
        subscription: {
          status: 'free',
          plan: 'Free Plan',
          isSubscribed: false
        },
        events: []
      })
    }

    // Get subscription details from database
    const subscriptionDetails = await getSubscriptionDetails(user.id)
    
    // Get recent subscription events for audit trail
    const subscriptionEvents = await getSubscriptionEvents(user.id, 5)
    
    return NextResponse.json({ 
      subscription: subscriptionDetails,
      events: subscriptionEvents
    })
  } catch (error) {
    console.error('Error getting subscription details:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription details' }, 
      { status: 500 }
    )
  }
}
