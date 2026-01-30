import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Get view count for a single target
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get('targetType')
  const targetId = searchParams.get('targetId')

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const { count, error } = await supabase
    .from('pensieve_views')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: count || 0 })
}

// Record a view (simple - no deduplication)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { targetType, targetId } = await req.json()

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Get viewer info
  const { data: { user } } = await supabase.auth.getUser()
  const viewerId = user?.id || null
  
  // Get IP from headers
  const forwarded = req.headers.get('x-forwarded-for')
  const viewerIp = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown'

  // Record view (no deduplication - every click counts)
  // NOTE: Previous deduplication logic is commented out below for reference
  // If you need to re-enable 24-hour deduplication, uncomment the code below and comment out the simple insert
  
  // // Check for duplicate view in last 24 hours
  // const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  // 
  // let existingView = null
  // 
  // if (viewerId) {
  //   // 가입자: viewer_id로 중복 체크
  //   const { data } = await supabase
  //     .from('pensieve_views')
  //     .select('id')
  //     .eq('target_type', targetType)
  //     .eq('target_id', targetId)
  //     .eq('viewer_id', viewerId)
  //     .gte('created_at', oneDayAgo)
  //     .limit(1)
  //     .single()
  //   existingView = data
  // } else {
  //   // 비가입자: viewer_ip로 중복 체크
  //   const { data } = await supabase
  //     .from('pensieve_views')
  //     .select('id')
  //     .eq('target_type', targetType)
  //     .eq('target_id', targetId)
  //     .eq('viewer_ip', viewerIp)
  //     .is('viewer_id', null) // viewer_id가 null인 것만 (비가입자만)
  //     .gte('created_at', oneDayAgo)
  //     .limit(1)
  //     .single()
  //   existingView = data
  // }
  // 
  // if (!existingView) {
  //   // Record new view
  //   await supabase
  //     .from('pensieve_views')
  //     .insert({
  //       target_type: targetType,
  //       target_id: targetId,
  //       viewer_id: viewerId,
  //       viewer_ip: viewerIp
  //     })
  // }

  // Simple insert - every view is recorded
  await supabase
    .from('pensieve_views')
    .insert({
      target_type: targetType,
      target_id: targetId,
      viewer_id: viewerId,
      viewer_ip: viewerIp
    })

  // Return updated count
  const { count } = await supabase
    .from('pensieve_views')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  return NextResponse.json({ count: count || 0 })
}
