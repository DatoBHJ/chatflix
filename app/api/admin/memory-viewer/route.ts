import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { getAllMemoryBank, ALLOWED_MEMORY_CATEGORIES } from '@/utils/memory-bank'

const V2_TEMP_TABLE = 'memory_bank_v2_temp'

function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function GET(req: NextRequest) {
  try {
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    const source = searchParams.get('source') === 'v2_temp' ? 'v2_temp' : 'live'

    if (!userId) {
      return NextResponse.json({ error: 'user_id parameter is required' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (source === 'v2_temp') {
      const { data: rows, error } = await serviceSupabase
        .from(V2_TEMP_TABLE)
        .select('category, content, version, metadata, migration_run_id, generated_at')
        .eq('user_id', userId)
        .in('category', [...ALLOWED_MEMORY_CATEGORIES])

      if (error) {
        console.error('Error fetching v2 temp memory:', error)
        return NextResponse.json({ error: 'Failed to fetch v2 temp memory' }, { status: 500 })
      }

      if (!rows || rows.length === 0) {
        return NextResponse.json(
          { error: 'No v2 migration data found for this user', user_id: userId },
          { status: 404 }
        )
      }

      const sorted = [...rows].sort((a, b) => a.category.localeCompare(b.category))
      const memoryContent = sorted
        .map(
          (item) =>
            `## ${formatCategoryName(item.category)}\n\n${(item.content ?? '').trim() || '[Empty]'}`
        )
        .join('\n\n---\n\n')

      const entries_meta = sorted.map((r) => ({
        category: r.category,
        version: r.version ?? null,
        metadata: r.metadata ?? null,
        migration_run_id: r.migration_run_id ?? null,
        generated_at: r.generated_at ?? null,
      }))

      return NextResponse.json({
        user_id: userId,
        memory_data: memoryContent,
        timestamp: new Date().toISOString(),
        source: 'v2_temp',
        entries_meta,
      })
    }

    const { data: memoryData, error } = await getAllMemoryBank(serviceSupabase, userId)

    if (error) {
      console.error('Error fetching user memory:', error)
      return NextResponse.json({ error: 'Failed to fetch user memory' }, { status: 500 })
    }

    if (!memoryData) {
      return NextResponse.json(
        { error: 'No memory data found for this user', user_id: userId },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user_id: userId,
      memory_data: memoryData,
      timestamp: new Date().toISOString(),
      source: 'live',
    })
  } catch (error) {
    console.error('Error processing memory viewer request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
