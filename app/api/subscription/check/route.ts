import { createClient } from '@/utils/supabase/server'
import { checkSubscription } from '@/lib/polar'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription status
    const isSubscribed = await checkSubscription(user.id)
    
    return NextResponse.json({ isSubscribed })
  } catch (error) {
    console.error('Error checking subscription:', error)
    return NextResponse.json(
      { error: 'Failed to check subscription' }, 
      { status: 500 }
    )
  }
} 