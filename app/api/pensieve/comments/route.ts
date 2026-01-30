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

  // Get comments with author names from all_user
  const { data: comments, error } = await supabase
    .from('pensieve_comments')
    .select(`
      id,
      user_id,
      content,
      created_at,
      all_user!inner(name)
    `)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true })

  if (error) {
    // Fallback: get comments without join if all_user relation fails
    const { data: fallbackComments, error: fallbackError } = await supabase
      .from('pensieve_comments')
      .select('id, user_id, content, created_at')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: true })

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 })
    }

    return NextResponse.json({
      comments: fallbackComments?.map(c => ({ ...c, author_name: 'User' })) || []
    })
  }

  const formattedComments = comments?.map(c => ({
    id: c.id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author_name: (c.all_user as any)?.name || 'User'
  })) || []

  return NextResponse.json({ comments: formattedComments })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { targetType, targetId, content } = await req.json()

  if (!targetType || !targetId || !content) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  if (content.length > 500) {
    return NextResponse.json({ error: 'Comment too long (max 500 chars)' }, { status: 400 })
  }

  const { data: newComment, error: insertError } = await supabase
    .from('pensieve_comments')
    .insert({ user_id: user.id, target_type: targetType, target_id: targetId, content })
    .select('id, user_id, content, created_at')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Get author name
  const { data: authorData } = await supabase
    .from('all_user')
    .select('name')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    comment: {
      ...newComment,
      author_name: authorData?.name || 'User'
    }
  })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const commentId = searchParams.get('id')

  if (!commentId) {
    return NextResponse.json({ error: 'Missing comment ID' }, { status: 400 })
  }

  // Verify ownership before deleting
  const { data: comment } = await supabase
    .from('pensieve_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (!comment || comment.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('pensieve_comments')
    .delete()
    .eq('id', commentId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
