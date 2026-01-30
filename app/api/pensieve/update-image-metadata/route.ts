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

    const { imageId, ai_prompt, ai_json_prompt } = await req.json()

    if (!imageId) {
      return NextResponse.json({ error: 'Missing imageId' }, { status: 400 })
    }

    const updateData: any = {}
    if (ai_prompt !== undefined) updateData.ai_prompt = ai_prompt
    if (ai_json_prompt !== undefined) updateData.ai_json_prompt = ai_json_prompt

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No data to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('user_background_settings')
      .update(updateData)
      .eq('id', imageId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update image metadata:', updateError)
      return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('update-image-metadata error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

