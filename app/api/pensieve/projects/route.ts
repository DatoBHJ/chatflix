import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUrlExpired, extractBucketName } from '@/app/utils/urlUtils'

// GET /api/pensieve/projects - 프로젝트 목록 조회
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const publicOnly = searchParams.get('public') === 'true'

    // thumbnail_url 갱신 헬퍼 함수
    const refreshThumbnailUrl = async (project: any) => {
      // thumbnail_url이 없거나 만료되었는지 확인
      const needsRefresh = !project.thumbnail_url || 
        (project.thumbnail_url && isUrlExpired(project.thumbnail_url))
      
      // URL이 유효하면 즉시 반환 (DB 업데이트 불필요)
      if (!needsRefresh) {
        return project
      }
      
      if (project.thumbnail_path) {
        try {
          // 버킷 이름 결정: DB 값 우선, URL에서 추출한 값 fallback
          let bucketName = project.original_bucket_name || 'generated-images'
          
          // DB의 original_bucket_name이 잘못되었을 수 있으므로, URL에서 버킷 이름 추출 시도
          if (project.thumbnail_url) {
            const urlBucketName = extractBucketName(project.thumbnail_url)
            if (urlBucketName) {
              bucketName = urlBucketName
            }
          }
          
          const { data: signedData } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(project.thumbnail_path, 24 * 60 * 60)

          if (signedData?.signedUrl) {
            // DB 업데이트 (올바른 bucket_name도 함께 업데이트)
            // 비동기로 처리하여 응답 속도 향상 (await 제거)
            supabase
              .from('pensieve_projects')
              .update({ 
                thumbnail_url: signedData.signedUrl,
                original_bucket_name: bucketName
              })
              .eq('id', project.id)
              .then(() => {}) // 에러 무시
            
            return { ...project, thumbnail_url: signedData.signedUrl, original_bucket_name: bucketName }
          }
        } catch (e) {
          console.error(`Failed to refresh thumbnail URL for project ${project.id}:`, e)
        }
      }
      return project
    }

    if (publicOnly) {
      // 공개 프로젝트 조회 (Strands 탭용)
      const { data, error } = await supabase
        .from('pensieve_projects')
        .select(`
          id,
          user_id,
          name,
          thumbnail_url,
          thumbnail_path,
          original_bucket_name,
          prompt,
          ai_prompt,
          slide_count,
          is_public,
          created_at,
          updated_at
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // thumbnail_url 갱신
      const refreshedProjects = await Promise.all(
        (data || []).map(refreshThumbnailUrl)
      )

      return NextResponse.json({ projects: refreshedProjects })
    } else {
      // 본인 프로젝트 조회 (Cabinet 탭용)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data, error } = await supabase
        .from('pensieve_projects')
        .select(`
          id,
          user_id,
          name,
          thumbnail_url,
          thumbnail_path,
          original_image_url,
          original_image_path,
          original_bucket_name,
          prompt,
          ai_prompt,
          ai_json_prompt,
          selected_model,
          slide_count,
          is_public,
          created_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // thumbnail_url 갱신
      const refreshedProjects = await Promise.all(
        (data || []).map(refreshThumbnailUrl)
      )

      return NextResponse.json({ projects: refreshedProjects })
    }
  } catch (error) {
    console.error('[PROJECTS] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST /api/pensieve/projects - 프로젝트 생성
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      originalImageUrl,
      originalImagePath,
      originalBucketName,
      prompt,
      aiPrompt,
      aiJsonPrompt,
      selectedModel,
      isPublic,
      // 첫 번째 슬라이드 정보 (원본 이미지)
      firstSlide
    } = body

    // 프로젝트 생성
    const { data: project, error: projectError } = await supabase
      .from('pensieve_projects')
      .insert({
        user_id: user.id,
        name: name || null,
        thumbnail_url: firstSlide?.imageUrl || originalImageUrl,
        thumbnail_path: firstSlide?.imagePath || originalImagePath,
        original_image_url: originalImageUrl,
        original_image_path: originalImagePath,
        original_bucket_name: originalBucketName || 'generated-images',
        prompt: prompt || null,
        ai_prompt: aiPrompt || null,
        ai_json_prompt: aiJsonPrompt || null,
        selected_model: selectedModel || 'nano-banana-pro',
        is_public: isPublic || false,
        slide_count: firstSlide ? 1 : 0
      })
      .select()
      .single()

    if (projectError) throw projectError

    // 첫 번째 슬라이드가 있으면 생성
    let firstSlideData = null
    if (firstSlide) {
      const { data: slide, error: slideError } = await supabase
        .from('pensieve_project_slides')
        .insert({
          project_id: project.id,
          slide_index: 0,
          parent_slide_id: null,
          image_url: firstSlide.imageUrl,
          image_path: firstSlide.imagePath,
          bucket_name: firstSlide.bucketName || 'generated-images',
          url_expires_at: firstSlide.urlExpiresAt || null,
          prompt: firstSlide.prompt || prompt,
          ai_prompt: firstSlide.aiPrompt || aiPrompt,
          ai_json_prompt: firstSlide.aiJsonPrompt || aiJsonPrompt,
          is_original: true
        })
        .select()
        .single()

      if (slideError) {
        // 슬라이드 생성 실패 시 프로젝트도 삭제
        await supabase.from('pensieve_projects').delete().eq('id', project.id)
        throw slideError
      }
      
      firstSlideData = slide
    }

    return NextResponse.json({
      success: true,
      project: project,
      firstSlide: firstSlideData
    })

  } catch (error) {
    console.error('[PROJECTS] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    )
  }
}

