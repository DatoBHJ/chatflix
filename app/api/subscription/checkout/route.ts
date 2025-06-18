import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createCheckoutSession } from '@/lib/polar'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has required data
    if (!user.id || !user.email) {
      return NextResponse.json({ error: 'User account information is incomplete' }, { status: 400 })
    }

    // Extract additional data from request body if needed
    const body = await request.json()
    const name = body.name || user.user_metadata?.full_name || user.email.split('@')[0]

    // Get the origin from the request
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000'
    const successUrl = `${origin}/subscription/success`

    // Create checkout session
    const checkout = await createCheckoutSession(user.id, user.email, name, successUrl)
    
    return NextResponse.json({ checkout })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
} 