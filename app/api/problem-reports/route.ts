import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { report_type, content, chat_id, metadata } = await req.json()

    if (!report_type || !content) {
      return NextResponse.json({ error: 'Report type and content are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('problem_reports')
      .insert({
        user_id: user.id,
        email: user.email,
        report_type,
        content,
        chat_id,
        metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving problem report:', error)
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 