import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { getAllMemoryBank } from '@/utils/memory-bank'

export async function GET(req: NextRequest) {
  try {
    // Check if user is admin
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get user_id from query parameters
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id parameter is required' }, { status: 400 })
    }

    // Use service role client to bypass RLS for admin queries
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all memory bank data for the user
    const { data: memoryData, error } = await getAllMemoryBank(serviceSupabase, userId)

    if (error) {
      console.error('Error fetching user memory:', error)
      return NextResponse.json({ error: 'Failed to fetch user memory' }, { status: 500 })
    }

    if (!memoryData) {
      return NextResponse.json({ 
        error: 'No memory data found for this user',
        user_id: userId 
      }, { status: 404 })
    }

    return NextResponse.json({
      user_id: userId,
      memory_data: memoryData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing memory viewer request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
