import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string, slideId: string }> }
) {
  try {
    const { id: projectId, slideId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 프로젝트 소유권 확인
    const { data: project, error: projectError } = await supabase
      .from('pensieve_projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 404 })
    }

    const body = await req.json()
    const {
      prompt,
      ai_prompt,
      ai_json_prompt
    } = body

    const updateData: any = {}
    if (prompt !== undefined) updateData.prompt = prompt
    if (ai_prompt !== undefined) updateData.ai_prompt = ai_prompt
    if (ai_json_prompt !== undefined) updateData.ai_json_prompt = ai_json_prompt

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No data to update' }, { status: 400 })
    }

    const { data: slide, error: slideError } = await supabase
      .from('pensieve_project_slides')
      .update(updateData)
      .eq('id', slideId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (slideError) {
      console.error('Failed to update slide:', slideError)
      return NextResponse.json({ error: 'Failed to update slide' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      slide
    })

  } catch (error) {
    console.error('[PROJECTS] PATCH slide error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update slide' },
      { status: 500 }
    )
  }
}

