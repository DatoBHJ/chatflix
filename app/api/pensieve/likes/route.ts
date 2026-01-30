import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get('targetType')
  const targetId = searchParams.get('targetId')

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Get like count
  const { count, error: countError } = await supabase
    .from('pensieve_likes')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  // Check if current user liked
  let liked = false
  if (user) {
    const { data: userLike } = await supabase
      .from('pensieve_likes')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('user_id', user.id)
      .single()
    liked = !!userLike
  }

  return NextResponse.json({ count: count || 0, liked })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { targetType, targetId } = await req.json()

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Check if already liked
  const { data: existing } = await supabase
    .from('pensieve_likes')
    .select('id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // Unlike
    await supabase
      .from('pensieve_likes')
      .delete()
      .eq('id', existing.id)
  } else {
    // Like
    const { error: insertError } = await supabase
      .from('pensieve_likes')
      .insert({ user_id: user.id, target_type: targetType, target_id: targetId })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Return updated count
  const { count } = await supabase
    .from('pensieve_likes')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  return NextResponse.json({ liked: !existing, count: count || 0 })
}
