import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// POST /api/pensieve/projects/[id]/toggle-public - 프로젝트 공개/비공개 토글
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { isPublic } = body

    if (typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
    }

    // 프로젝트 소유권 확인 및 업데이트
    const { data: project, error } = await supabase
      .from('pensieve_projects')
      .update({ is_public: isPublic })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, is_public')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      project
    })

  } catch (error) {
    console.error('[PROJECTS] toggle-public error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle public status' },
      { status: 500 }
    )
  }
}

