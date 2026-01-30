import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Batch get view counts for multiple targets (for thumbnails)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { targetType, targetIds } = await req.json()

  if (!targetType || !targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
    return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })
  }

  // Limit to prevent abuse
  if (targetIds.length > 100) {
    return NextResponse.json({ error: 'Too many IDs (max 100)' }, { status: 400 })
  }

  // Get counts for all target IDs using a single query with grouping
  const { data, error } = await supabase
    .from('pensieve_views')
    .select('target_id')
    .eq('target_type', targetType)
    .in('target_id', targetIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Count occurrences of each target_id
  const counts: { [id: string]: number } = {}
  targetIds.forEach(id => { counts[id] = 0 })
  
  if (data) {
    data.forEach(row => {
      if (counts[row.target_id] !== undefined) {
        counts[row.target_id]++
      }
    })
  }

  return NextResponse.json({ counts })
}
