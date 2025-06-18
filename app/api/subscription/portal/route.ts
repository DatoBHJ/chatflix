import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getCustomerPortalUrl } from '@/lib/polar'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get customer portal URL
    const portalUrl = await getCustomerPortalUrl(user.id)
    
    return NextResponse.json({ portalUrl })
  } catch (error) {
    console.error('Error getting customer portal URL:', error)
    return NextResponse.json({ error: 'Failed to get customer portal URL' }, { status: 500 })
  }
} 