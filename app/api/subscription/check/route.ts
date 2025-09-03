import { createClient } from '@/utils/supabase/server'
import { checkSubscriptionFromDatabase } from '@/lib/subscription-db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // 🚀 익명 사용자 지원: 익명 사용자는 Free Plan으로 처리
    if (userError || !user) {
      console.log('Anonymous user or auth error - treating as Free Plan');
      return NextResponse.json({ isSubscribed: false })
    }

    // Check subscription status from database first, with fallback to Polar API
    const isSubscribed = await checkSubscriptionFromDatabase(user.id)
    
    return NextResponse.json({ isSubscribed })
  } catch (error) {
    console.error('Error checking subscription:', error)
    return NextResponse.json(
      { error: 'Failed to check subscription' }, 
      { status: 500 }
    )
  }
} 