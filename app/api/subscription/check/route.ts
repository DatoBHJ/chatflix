import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkSubscription } from '@/lib/polar'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription status
    const isSubscribed = await checkSubscription(user.id)
    
    return NextResponse.json({ isSubscribed })
  } catch (error) {
    console.error('Error checking subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 