import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  // Await the params as they're now a Promise in Next.js 13+
  const { chatId } = await params
  
  // First authenticate the request using regular client
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Use service role client to bypass RLS for admin queries
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceSupabase = createServiceClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data, error } = await serviceSupabase
      .from('messages')
      .select('id, content, role, created_at, model, experimental_attachments')
      .eq('chat_session_id', chatId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching chat messages:', error)
      return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 