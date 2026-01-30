import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { imageId, isPublic } = await req.json()

    if (!imageId || typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('user_background_settings')
      .update({ is_public: isPublic })
      .eq('id', imageId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update is_public:', updateError)
      return NextResponse.json({ error: 'Failed to update visibility' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('toggle-public error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
